import cv2
import os
import time
# 移除顶部的 YOLO 导入，防止启动时冲突 (我们在函数里导入)
from ultralytics import YOLO 
import numpy as np

class AIService:
    def __init__(self, model_path="app/models/best.pt", cooldown_seconds=5):
        # 1. 基础配置
        self.model_path = model_path
        self.model = None
        self.cooldown_seconds = cooldown_seconds
        self.last_alarm_time = 0

        # ✅ 新增：用于标识缺失检测的计数器
        self.sign_missing_counter = 0 
        self.MISSING_THRESHOLD = 3  # 连续 3 次检测都没看到，才判定为缺失
        
        # 🌟🌟🌟【正式配置】类别 ID 映射 🌟🌟🌟
        # 请务必确保这里 ID 与你训练模型时的 data.yaml 一致
        self.class_names = {
            0: 'helmet',          
            1: 'no_helmet',       
            2: 'person',          
            3: 'hole_danger',     # ⚠️ 孔口无挡坎
            4: 'safety_sign'     # ⚠️ 标识缺失
        }

    def _load_model_safe(self):
        """延迟加载模型"""
        if self.model is not None:
            return True
        try:
            print("⏳ [AI服务] 正在初始化模型 (CPU模式)...")
            base_dir = os.getcwd()
            full_path = os.path.join(base_dir, self.model_path)
            
            if not os.path.exists(full_path):
                print(f"❌ [错误] 找不到模型文件: {full_path}")
                return False

            loaded_model = YOLO(full_path)
            loaded_model.to('cpu') # 强制 CPU
            self.model = loaded_model
            print("✅ [AI服务] 模型加载完成")
            return True
        except Exception as e:
            print(f"❌ [严重错误] 模型加载失败: {e}")
            return False

    def detect_safety_helmet(self, frame):
        """安全帽检测"""
        if self.model is None and not self._load_model_safe(): return False, None
        if frame is None: return False, None

        try:
            results = self.model(frame, conf=0.5, verbose=False)[0]
            has_violation = False
            box_coords = []
            conf_score = 0.0

            for box in results.boxes:
                cls_id = int(box.cls[0])
                label = self.class_names.get(cls_id, 'unknown')
                
                if label == 'no_helmet':
                    has_violation = True
                    conf_score = float(box.conf[0])
                    box_coords = box.xyxy[0].tolist()
                    break 
            
            if has_violation:
                return self._check_cooldown_and_alarm("未佩戴安全帽", "检测到人员未佩戴安全帽", conf_score, box_coords)
            
            return False, None
        except Exception as e:
            print(f"⚠️ 安全帽检测出错: {e}")
            return False, None

    # =========== 正式功能: 孔口挡坎检测 ===========
    def detect_hole_curb(self, frame):
        """
        检测 'hole_danger' 类别
        """
        if self.model is None and not self._load_model_safe(): return False, None
        if frame is None: return False, None

        try:
            # 真实推理
            results = self.model(frame, conf=0.45, verbose=False)[0]
            
            for box in results.boxes:
                cls_id = int(box.cls[0])
                label = self.class_names.get(cls_id, 'unknown')
                
                if label == 'hole_danger':
                    conf = float(box.conf[0])
                    coords = box.xyxy[0].tolist()
                    
                    return self._check_cooldown_and_alarm(
                        "孔口挡坎违规", 
                        "检测到孔口未设置挡坎或挡坎高度不足(<15cm)", 
                        conf, 
                        coords
                    )
            return False, None
        except Exception as e:
            print(f"⚠️ 孔口检测出错: {e}")
            return False, None

    # =========== 正式功能: 现场标识检测 ===========
    # =========== 正式功能: 现场标识检测 (ROI 缺失检测版) ===========
    def detect_site_signage(self, frame):
        """
        检测 'safety_sign' 类别
        逻辑：如果预设区域(ROI)内【没有】检测到标识，则报警。
        """
        if self.model is None and not self._load_model_safe(): return False, None
        if frame is None: return False, None

        try:
            h, w, _ = frame.shape
            
            # 1. 定义 ROI (感兴趣区域) - 假设标识应该在画面中央
            # 这里默认设置为画面的中间区域 (x: 20%~80%, y: 20%~80%)
            # ⚠️ 后续你可以根据实际摄像头固定的位置修改这些比例
            roi_x1, roi_y1 = int(w * 0.2), int(h * 0.2)
            roi_x2, roi_y2 = int(w * 0.8), int(h * 0.8)
            
            # (可选) 你可以在调试时把 ROI 画在 frame 上看一眼，但不要在生产环境画
            # cv2.rectangle(frame, (roi_x1, roi_y1), (roi_x2, roi_y2), (255, 0, 0), 2)

            # 2. 进行推理
            results = self.model(frame, conf=0.45, verbose=False)[0]
            sign_found_in_roi = False
            
            for box in results.boxes:
                cls_id = int(box.cls[0])
                label = self.class_names.get(cls_id, 'unknown')
                
                if label == 'safety_sign':
                    # 获取检测框坐标
                    bx1, by1, bx2, by2 = map(int, box.xyxy[0])
                    
                    # 计算检测框中心点
                    center_x = (bx1 + bx2) / 2
                    center_y = (by1 + by2) / 2
                    
                    # 3. 判断中心点是否在 ROI 内
                    if roi_x1 < center_x < roi_x2 and roi_y1 < center_y < roi_y2:
                        sign_found_in_roi = True
                        break # 只要找到一个合格的，就认为正常

            # 4. 判定逻辑
            if sign_found_in_roi:
                # 正常情况：重置计数器
                self.sign_missing_counter = 0
                return False, None
            else:
                # 异常情况：未检测到标识，计数器 +1
                self.sign_missing_counter += 1
                
                # 只有连续 N 次都没看到，才真正触发报警
                if self.sign_missing_counter >= self.MISSING_THRESHOLD:
                    # 重置计数器，避免一直重复刷屏（或者你可以保留让 cooldown 去控制）
                    # self.sign_missing_counter = 0 
                    
                    return self._check_cooldown_and_alarm(
                        "安全标识缺失", 
                        "固定监控区域内未检测到风险告知牌/操作规程牌", 
                        1.0, # 确信度直接给 1.0，因为这是逻辑判定
                        [roi_x1, roi_y1, roi_x2, roi_y2] # 把 ROI 坐标传回去，方便前端画框
                    )
                
            return False, None
            
        except Exception as e:
            print(f"⚠️ 标识检测出错: {e}")
            return False, None

    def count_supervisors(self, frame):
        """监护人统计 (保持不变)"""
        if self.model is None and not self._load_model_safe(): return 0
        if frame is None: return 0

        try:
            results = self.model(frame, conf=0.5, verbose=False)[0]
            supervisor_count = 0
            
            for box in results.boxes:
                cls_id = int(box.cls[0])
                label = self.class_names.get(cls_id, 'unknown')
                
                if label == 'helmet':
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    h, w, _ = frame.shape
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    
                    helmet_crop = frame[y1:y2, x1:x2]
                    color = self._get_helmet_color(helmet_crop)
                    
                    if color == 'red':
                        supervisor_count += 1
            return supervisor_count
        except Exception as e:
            return 0
        
    def _check_cooldown_and_alarm(self, alarm_type, msg, score, coords):
        current_time = time.time()
        if current_time - self.last_alarm_time > self.cooldown_seconds:
            self.last_alarm_time = current_time
            print(f"🚨 [AI监测] 发现违规! ({alarm_type}) 置信度: {score:.2f}")
            return True, {
                "type": alarm_type,
                "msg": msg,
                "score": score,
                "coords": coords
            }
        return False, None

    def _get_helmet_color(self, img_crop):
        """颜色识别 (保持不变)"""
        if img_crop is None or img_crop.size == 0: return 'unknown'
        try:
            hsv = cv2.cvtColor(img_crop, cv2.COLOR_BGR2HSV)
            lower_red1 = np.array([0, 100, 100])
            upper_red1 = np.array([10, 255, 255])
            lower_red2 = np.array([170, 100, 100])
            upper_red2 = np.array([180, 255, 255])
            mask_red = cv2.bitwise_or(cv2.inRange(hsv, lower_red1, upper_red1), 
                                      cv2.inRange(hsv, lower_red2, upper_red2))
            red_pixels = cv2.countNonZero(mask_red)
            lower_yellow = np.array([20, 100, 100])
            upper_yellow = np.array([30, 255, 255])
            mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
            yellow_pixels = cv2.countNonZero(mask_yellow)
            
            total_pixels = img_crop.shape[0] * img_crop.shape[1]
            if red_pixels > yellow_pixels and red_pixels > (total_pixels * 0.1): return 'red'
            elif yellow_pixels > red_pixels and yellow_pixels > (total_pixels * 0.1): return 'yellow'
            return 'other'
        except:
            return 'unknown'