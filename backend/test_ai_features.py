import cv2
import sys
import os

# 将当前目录添加到路径
sys.path.append(os.getcwd())

from app.services.ai_service import AIService

def main():
    print(">>> 正在初始化 AI 服务，首次运行可能需要下载模型 (约6MB)...")
    ai_service = AIService('yolov8n.pt') 

    # --- 视频源设置 ---
    # 0 代表电脑自带摄像头
    # 如果你有工地视频文件，请改为: video_source = "test_video.mp4"
    video_source = 0 
    
    cap = cv2.VideoCapture(video_source)

    if not cap.isOpened():
        print(f"!!! 无法打开视频源: {video_source}")
        return

    print(">>> 开始视频分析... 按 'q' 键退出")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("视频结束")
            break

        # 缩小画面一点，防止卡顿，也可以不缩放
        # frame = cv2.resize(frame, (1280, 720))

        # 调用核心服务
        config = {"helmet_check": True}
        annotated_frame, alarms = ai_service.process_frame(frame, config)

        # 额外在左上角显示提示
        cv2.putText(annotated_frame, "Mode: Helmet Detection (Test)", (20, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # 显示画面
        cv2.imshow("Platform Yaokong - AI Test", annotated_frame)

        # 按 'q' 退出
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()