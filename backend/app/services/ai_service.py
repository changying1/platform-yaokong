import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    def __init__(self, model_path='yolov8n.pt'):
        """
        初始化 AI 服务
        :param model_path: 模型路径。初次运行会自动下载 yolov8n.pt
        """
        logger.info(f"正在加载 YOLO 模型: {model_path} ...")
        self.model = YOLO(model_path)
        self.names = self.model.names
        logger.info(f"模型加载成功. 支持类别: {self.names}")

    def process_frame(self, frame, features_config=None):
        """
        处理单帧图像
        """
        if features_config is None:
            features_config = {}

        # 1. YOLO 推理
        # stream=True 可以在处理视频流时节省内存
        # verbose=False 关闭每帧的控制台打印
        results = self.model(frame, stream=True, verbose=False)
        
        alarms = []
        annotated_frame = frame.copy()

        for result in results:
            # 绘制 YOLO 自带的预测结果（画框）
            annotated_frame = result.plot()
            
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                class_name = self.names[cls_id]
                
                # --- 功能一：安全帽检测逻辑 ---
                if features_config.get("helmet_check", True):
                    # 目前使用的是通用模型，只能检测到 'person'
                    if class_name == 'person':
                        # TODO: 这里未来要替换为"安全帽分类模型"
                        # 现在的逻辑是：只要检测到人，就模拟产生一条"检测中"的记录
                        pass 
                        
                        # 模拟报警逻辑 (例如：为了测试，我们可以假设每100帧或者随机触发一个报警)
                        # 在真实场景中，这里会判断 (not has_helmet)
                        # alarm = {
                        #     "type": "NO_HELMET",
                        #     "msg": "未佩戴安全帽",
                        #     "bbox": box.xyxy[0].cpu().numpy().tolist(),
                        #     "time": datetime.now().isoformat()
                        # }
                        # alarms.append(alarm)

        return annotated_frame, alarms