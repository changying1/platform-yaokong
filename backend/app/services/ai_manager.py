import threading
import time
import cv2
import os
import uuid
from datetime import datetime
from app.services.ai_service import AIService
from app.models.alarm_records import AlarmRecord
from app.core.database import SessionLocal
# 务必保留此导入，防止数据库外键报错
from app.models.fence import ElectronicFence 

class AIManager:
    def __init__(self):
        self.active_monitors = {} # device_id -> {"stop_event": Event, "thread": Thread}
        self.ai_service = AIService()
        
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.static_dir = os.path.join(self.base_dir, "static", "alarms")
        os.makedirs(self.static_dir, exist_ok=True)

    def start_monitoring(self, device_id, rtsp_url, algo_type="helmet"):
        """
        algo_type: 可以是单个类型 "helmet"，也可以是组合 "helmet,signage,hole_curb"
        """
        if device_id in self.active_monitors:
            print(f"⚠️ 设备 {device_id} 已经在监控中，请先停止再重新启动")
            return False

        print(f"--- 启动 AI 监控: {device_id} | 启用功能: {algo_type} ---")
        stop_event = threading.Event()
        
        thread = threading.Thread(
            target=self._monitor_loop,
            args=(device_id, rtsp_url, algo_type, stop_event),
            daemon=True
        )
        self.active_monitors[device_id] = {"stop_event": stop_event, "thread": thread}
        thread.start()
        return True

    def stop_monitoring(self, device_id):
        if device_id not in self.active_monitors:
            return False
        print(f"--- 停止 AI 监控: {device_id} ---")
        self.active_monitors[device_id]["stop_event"].set()
        del self.active_monitors[device_id]
        return True

    def _monitor_loop(self, device_id, rtsp_url, algo_type_str, stop_event):
        print(f"📷 正在连接视频流: {rtsp_url}")
        try:
            if rtsp_url == "0": rtsp_url = 0
            cap = cv2.VideoCapture(rtsp_url)
        except Exception as e:
            print(f"❌ 视频流打开失败: {e}")
            return

        # 🛠️ 解析功能列表 (支持多选并行)
        # 例如输入 "helmet,signage" -> ["helmet", "signage"]
        active_algos = [x.strip() for x in algo_type_str.split(',') if x.strip()]
        
        frame_interval = 5 
        frame_count = 0

        # 离岗检测专用变量
        last_seen_person_time = time.time()
        OFF_POST_THRESHOLD = 300 # 正式环境建议 300秒
        is_already_alarmed = False

        while not stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                time.sleep(2)
                continue

            frame_count += 1
            if frame_count % frame_interval != 0:
                continue

            # ================== 核心逻辑分支 (并行版) ==================
            # 注意：这里把 elif 全改成了 if，这样一张图可以同时检测多个风险
            
            try:
                # 👉 功能 1: 安全帽检测
                if "helmet" in active_algos:
                    is_alarm, details = self.ai_service.detect_safety_helmet(frame)
                    if is_alarm:
                        img_path = self._save_alarm_image(frame, device_id, details)
                        self._save_alarm_to_db(device_id, details, img_path)

                # 👉 功能 2: 监护人离岗检测
                if "off_post" in active_algos:
                    supervisor_count = self.ai_service.count_supervisors(frame)
                    if supervisor_count > 0:
                        last_seen_person_time = time.time()
                        if is_already_alarmed:
                            is_already_alarmed = False
                    else:
                        duration = time.time() - last_seen_person_time
                        if duration > OFF_POST_THRESHOLD and not is_already_alarmed:
                            img_path = self._save_alarm_image(frame, device_id, details={
                                "type": "监护人员离岗",
                                "msg": f"监护人离岗超过 {int(OFF_POST_THRESHOLD)} 秒"
                            })
                            details = {
                                "type": "监护人员离岗",
                                "msg": f"监护人离岗超过 {int(OFF_POST_THRESHOLD)} 秒"
                            }
                            self._save_alarm_to_db(device_id, details, img_path)
                            is_already_alarmed = True

                # 👉 功能 3: 孔口挡坎检测
                if "hole_curb" in active_algos:
                    is_alarm, details = self.ai_service.detect_hole_curb(frame)
                    if is_alarm:
                        img_path = self._save_alarm_image(frame, device_id, details)
                        self._save_alarm_to_db(device_id, details, img_path)

                # 👉 功能 4: 现场标识检测
                if "signage" in active_algos:
                    is_alarm, details = self.ai_service.detect_site_signage(frame)
                    if is_alarm:
                        img_path = self._save_alarm_image(frame, device_id, details)
                        self._save_alarm_to_db(device_id, details, img_path)

            except Exception as logic_error:
                print(f"⚠️ [逻辑错误] 循环中发生异常: {logic_error}")

            # ==========================================================
            time.sleep(0.02)

        cap.release()
        print(f"--- 监控线程已退出: {device_id} ---")

    # 修改 ai_manager.py 中的 _save_alarm_image 函数
    def _save_alarm_image(self, frame, device_id, details=None): # 👈 增加 details 参数
        try:
            # 📋 如果有坐标信息，先把框画在图片上再保存
            if details and 'coords' in details and details['coords']:
                coords = details['coords']
                # 只有当坐标格式是 [x1, y1, x2, y2] 时才画框 (适用于缺失检测的 ROI)
                if len(coords) == 4 and isinstance(coords[0], (int, float)):
                    x1, y1, x2, y2 = map(int, coords)
                    # 画一个红色的矩形框，表示“这里应该是标识”
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    # 写上提示文字
                    cv2.putText(frame, "Missing Sign Area", (x1, y1-10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            filename = f"{device_id}_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
            filepath = os.path.join(self.static_dir, filename)
            cv2.imwrite(filepath, frame)
            return f"/static/alarms/{filename}"
        except Exception as e:
            print(f"❌ 图片保存失败: {e}")
            return ""

    def _save_alarm_to_db(self, device_id, details, image_path):
        if not details: return
        db = SessionLocal()
        try:
            record = AlarmRecord(
                device_id=str(device_id),
                alarm_type=details.get('type', 'unknown'),
                severity="HIGH",
                description=details.get('msg', '检测到异常'),
                recording_path=image_path,
                status="pending",
                timestamp=datetime.now()
            )
            db.add(record)
            db.commit()
            print(f"✅ [数据库] 报警记录已保存 (ID: {record.id})")
        except Exception as e:
            print(f"❌ 数据库保存失败: {e}")
            db.rollback()
        finally:
            db.close()

ai_manager = AIManager()