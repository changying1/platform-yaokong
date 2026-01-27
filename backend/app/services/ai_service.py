import cv2
import numpy as np
from ultralytics import YOLO
from shapely.geometry import Point, Polygon
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    def __init__(self, model_path='yolov8n.pt'):
        self.model = YOLO(model_path)
        self.names = self.model.names

    def process_frame(self, frame, features_config=None):
        if features_config is None:
            features_config = {}

        # 1. YOLO 推理 - 关键修改：classes=[0]
        # 这行代码表示：只检测 "Person" (id=0)，过滤掉手套、瓶子等所有杂物
        results = self.model(frame, stream=True, verbose=False, conf=0.5, classes=[0])
        
        alarms = []
        # 复制一份画面，用于我们需要手动画红框/绿框
        annotated_frame = frame.copy()

        for result in results:
            boxes = result.boxes
            
            # --- 准备：危险区域数据 ---
            danger_zone_points = features_config.get("danger_zone", [])
            is_zone_valid = len(danger_zone_points) >= 3
            poly_zone = None
            zone_color = (0, 255, 0) # 默认区域颜色：绿色
            
            if is_zone_valid:
                poly_zone = Polygon(danger_zone_points)

            # --- 遍历检测到的每一个人 ---
            for box in boxes:
                # 获取坐标 (x1, y1)左上角, (x2, y2)右下角
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                # 默认状态：绿色（安全）
                color = (0, 255, 0) 
                label = "Person"
                is_danger = False

                # --- 逻辑 1: 危险区域入侵检测 ---
                if is_zone_valid and poly_zone:
                    # 计算脚底坐标 (中心x, 最底部y)
                    foot_x, foot_y = int((x1 + x2) / 2), y2
                    
                    if poly_zone.contains(Point(foot_x, foot_y)):
                        color = (0, 0, 255) # 变红
                        label = "INTRUSION"
                        is_danger = True
                        zone_color = (0, 0, 255) # 区域也变红
                        
                        alarms.append({"type": "INTRUSION", "msg": "危险区域入侵"})
                        
                        # 标记脚底，方便调试
                        cv2.circle(annotated_frame, (foot_x, foot_y), 5, (0, 0, 255), -1)

                # --- 逻辑 2: 安全帽检测 (模拟) ---
                # 如果没有触发入侵，再检查安全帽
                elif features_config.get("helmet_check", True):
                    # 真实场景：这里需要第二个模型判断头部是否有帽子
                    # 测试场景：为了让你看到报警效果，我们强制把所有人标记为“未戴帽(红框)”
                    # 如果你想看绿框，把下面改为 True
                    simulate_helmet_wearing = False 
                    
                    if not simulate_helmet_wearing:
                        color = (0, 0, 255) # 红色
                        label = "NO HELMET"
                        is_danger = True
                        alarms.append({"type": "NO_HELMET", "msg": "未佩戴安全帽"})
                    else:
                        label = "Helmet OK"

                # --- 统一绘图 (画框 + 标签) ---
                # 1. 画矩形框
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                
                # 2. 画标签背景条 (让文字更清晰)
                (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                cv2.rectangle(annotated_frame, (x1, y1 - 20), (x1 + w, y1), color, -1)
                
                # 3. 写字
                cv2.putText(annotated_frame, label, (x1, y1 - 5), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

            # --- 最后画危险区域 ---
            if is_zone_valid:
                pts = np.array(danger_zone_points, np.int32).reshape((-1, 1, 2))
                cv2.polylines(annotated_frame, [pts], True, zone_color, 2)
                if zone_color == (0, 0, 255):
                    cv2.putText(annotated_frame, "DANGER ZONE ALARM!", (50, 50), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        return annotated_frame, alarms