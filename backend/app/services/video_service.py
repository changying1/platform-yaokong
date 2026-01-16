import json
from sqlalchemy.orm import Session
from urllib.parse import urlparse
from app.models.video import VideoDevice
from app.models.device import Device
from app.schemas.video_schema import VideoCreate, VideoUpdate, CameraCreateRequest
from app.utils.logger import get_logger
import requests
import os
import glob
import time
import subprocess
from datetime import datetime, timedelta, timezone
from app.models.alarm_records import AlarmRecord
from app.core.database import SessionLocal
try:
    import onvif
    from onvif import ONVIFCamera
except Exception:
    onvif = None
    ONVIFCamera = None

logger = get_logger("VideoService")

# --- NMS Configuration ---
# In a real production environment, these should be loaded from environment variables
# For example: NMS_HOST = os.getenv('NMS_HOST', 'http://127.0.0.1:8001')
NMS_HOST = "http://127.0.0.1:8001"
NMS_USER = "admin"
# IMPORTANT: Use the same password you set in app.js and consider using environment variables
NMS_PASS = "123456" 
NMS_MEDIA_ROOT = os.path.abspath(
    os.getenv("NMS_MEDIA_ROOT", r"C:\Users\DELL\Desktop\platform-baocun\media_server\media\live")
)

class VideoService:
    def add_camera_to_media_server(self, db: Session, camera_data: CameraCreateRequest):
        """
        通过调用 Node Media Server v2.x 的 API 动态添加摄像头流，
        然后保存设备信息到数据库。
        """
        logger.info(f"正在添加新的摄像头流: {camera_data.name}")
        
        # 使用摄像头名称作为流名称，确保URL安全
        stream_name = camera_data.name.replace(" ", "_").replace("/", "_").lower()

        # 1. 调用 Node Media Server API 开始拉取 RTSP 流
        # v2.x 使用 /api/relay/pull 端点，使用 url 参数（不是 edge）
        nms_api_url = f"{NMS_HOST}/api/relay/pull"
        
        # 构建正确的payload格式（关键：使用 url 而不是 edge）
        payload = {
            "app": "live",
            "mode": "static",
            "url": camera_data.rtsp_url,  # 使用 url 参数
            "name": stream_name
        }
        
        # 检查流是否已经存在，避免重复推流
        check_url = f"{NMS_HOST}/api/streams"
        try:
            check_response = requests.get(check_url, auth=(NMS_USER, NMS_PASS), timeout=5)
            if check_response.status_code == 200:
                streams = check_response.json()
                stream_path = f"/live/{stream_name}"
                # 检查是否已有该流在推送
                if isinstance(streams, dict):
                    for app_name, app_streams in streams.items():
                        if isinstance(app_streams, dict):
                            for stream_key, stream_info in app_streams.items():
                                if stream_key == stream_name or stream_info.get('streamPath') == stream_path:
                                    logger.info(f"Stream '{stream_name}' already exists, skipping relay task creation")
                                    # 流已存在，直接返回使用现有流
                                    flv_url = f"{NMS_HOST}/live/{stream_name}.flv"
                                    # 检查数据库中是否已有记录
                                    existing_device = db.query(VideoDevice).filter(
                                        VideoDevice.name == camera_data.name
                                    ).first()
                                    if existing_device:
                                        logger.info(f"Device '{camera_data.name}' already exists in database")
                                        return existing_device
                                    break
        except Exception as e:
            logger.warning(f"Failed to check existing streams: {e}, will proceed with relay task creation")

        try:
            logger.info(f"正在调用 NMS API: {nms_api_url}")
            logger.info(f"Payload: {payload}")
            
            response = requests.post(
                nms_api_url, 
                json=payload, 
                auth=(NMS_USER, NMS_PASS), 
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            # 记录详细响应信息
            logger.info(f"NMS 响应状态码: {response.status_code}")
            logger.info(f"NMS 响应内容: {response.text}")
            
            response.raise_for_status()
            logger.info(f"NMS API 调用成功，流名称: '{stream_name}'")

        except requests.exceptions.HTTPError as e:
            logger.error(f"NMS API 返回错误状态码: {response.status_code}")
            logger.error(f"错误响应内容: {response.text}")
            raise ValueError(f"流媒体服务器返回错误 ({response.status_code}): {response.text}")
        except requests.exceptions.RequestException as e:
            logger.error(f"调用 NMS API 失败，流名称: '{stream_name}'。错误: {e}")
            raise ValueError(f"无法连接到流媒体服务器: {e}")

        # 2. API 调用成功后，在数据库中创建记录
        logger.info(f"NMS 命令执行成功，正在保存设备 '{camera_data.name}' 到数据库")
        
        # NMS 生成的最终 HLS 播放地址
        flv_url = f"{NMS_HOST}/live/{stream_name}.flv"

        new_video_device = VideoDevice(
            name=camera_data.name,
            ip_address=camera_data.ip_address,
            port=camera_data.port,
            username=camera_data.username,
            password=camera_data.password,
            stream_url=flv_url,
            latitude=camera_data.latitude,
            longitude=camera_data.longitude,
            status="online",  # NMS 已接受，假设在线
            remark=camera_data.remark
        )
        db.add(new_video_device)
        db.commit()
        db.refresh(new_video_device)
        
        logger.info(f"摄像头添加成功！FLV 播放地址: {flv_url}")
        return new_video_device

    def create_video(self, db: Session, video_data: VideoCreate):
        """手动创建新的视频设备记录"""
        logger.info(f"Creating new video device: {video_data.name}")
        
        new_video = VideoDevice(
            name=video_data.name,
            ip_address=video_data.ip_address,
            port=video_data.port,
            username=video_data.username,
            password=video_data.password,
            stream_url=video_data.stream_url,
            latitude=video_data.latitude,
            longitude=video_data.longitude,
            status=video_data.status,
            remark=video_data.remark
        )
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        return new_video

    def get_videos(self, db: Session, skip: int = 0, limit: int = 100):
        """获取视频设备列表"""
        return db.query(VideoDevice).offset(skip).limit(limit).all()

    def update_video(self, db: Session, video_id: int, video_data: VideoUpdate):
        """更新视频设备信息"""
        logger.info(f"Updating video device ID: {video_id}")
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video:
            return None

        # 动态更新字段
        update_data = video_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_video, key, value)

        db.commit()
        db.refresh(db_video)
        return db_video

    def delete_video(self, db: Session, video_id: int):
        """删除视频设备"""
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if db_video:
            db.delete(db_video)
            db.commit()
            return True
        return False

    def sync_hikvision_devices(self, db: Session):
        """
        连接海康威视 SDK 或 API 获取设备列表并更新数据库
        这里可以预留调用第三方海康 SDK 的逻辑
        """
        logger.info("Starting synchronization with Hikvision devices...")
        # TODO: 集成海康 SDK 调用逻辑
        pass

    def get_stream_url(self, db: Session, video_id: int):
        """
        为前端播放器生成 RTSP 或 HLS/FLV URL
        """
        logger.info(f"Requesting stream for device ID: {video_id}")
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video:
            return None
            
        # 如果数据库已存储转换后的地址则直接返回，否则返回原始配置的 stream_url
        return db_video.stream_url or "rtsp://placeholder/stream"

    def ptz_move(self, db: Session, video_id: int, direction: str, speed: float = 0.5, duration: float = 0.5):
        """
        执行摄像头云台移动 (PTZ - Pan Tilt Zoom)
        """
        import time
        from onvif import ONVIFCamera
    
        # 参数验证
        if direction not in ['up', 'down', 'left', 'right']:
            raise ValueError(f"Invalid direction: {direction}")
        if not (0.1 <= speed <= 1.0):
         raise ValueError(f"Speed must be between 0.1 and 1.0")
        if not (0.1 <= duration <= 5.0):
         raise ValueError(f"Duration must be between 0.1 and 5.0")
    
        # 获取设备信息
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video:
            raise ValueError(f"Video device not found: {video_id}")
    
        try:
            logger.info(f"PTZ 控制开始 - 设备: {db_video.name}, IP: {db_video.ip_address}, 用户: {db_video.username}")
            # 初始化 ONVIF 摄像头
            camera = ONVIFCamera(
                db_video.ip_address,
                db_video.port or 80,
                db_video.username,
                db_video.password
            )  
        
            media_service = camera.create_media_service()
            ptz_service = camera.create_ptz_service()
        
            #    获取 Profile Token
            profiles = media_service.GetProfiles()
            if not profiles:
                raise Exception("No media profiles found on camera")
        
            profile_token = profiles[0].token
        
            # 设置速度值（0-1.0 范围）
            pan_speed = speed if direction in ['left', 'right'] else 0.0
            tilt_speed = speed if direction in ['up', 'down'] else 0.0
        
            if direction == 'left':
                pan_speed = -speed
            elif direction == 'down':
                tilt_speed = -speed
        
            # 构建移动请求
            move_request = {
                'ProfileToken': profile_token,
                'Velocity': {
                    'PanTilt': {
                        'x': pan_speed,
                        'y': tilt_speed
                    },
                    'Zoom': {
                        'x': 0.0
                    }
                }
            }
        
            # 执行摄像头移动
            ptz_service.ContinuousMove(move_request)
        
            # 等待指定时间
            time.sleep(duration)
        
            # 停止移动 - 发送速度为 0 的 ContinuousMove 命令
            stop_request = {
                'ProfileToken': profile_token,
                'Velocity': {
                    'PanTilt': {
                        'x': 0.0,
                        'y': 0.0
                    },
                    'Zoom': {
                        'x': 0.0
                    }
                }
            }
        
            ptz_service.ContinuousMove(stop_request)
        
            direction_name = self._get_direction_name(direction)
            logger.info(f"PTZ moved {direction_name} on device {db_video.name} (ID: {video_id})")
            return {"status": "success", "message": f"云台向    {direction_name}移动成功"}
        
        except Exception as e:
            error_msg = str(e)
            logger.error(f"PTZ control error on device {db_video.name}: {error_msg}")
            raise ValueError(f"设备控制失败: {error_msg}")



    def ptz_start_move(self, db: Session, video_id: int, direction: str, speed: float = 0.5):
        """Start continuous PTZ move; stop via ptz_stop_move"""
        from onvif import ONVIFCamera

        if direction not in ['up', 'down', 'left', 'right']:
            raise ValueError(f"Invalid direction: {direction}")
        if not (0.05 <= speed <= 1.0):
            raise ValueError("Speed must be between 0.05 and 1.0")

        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video:
            raise ValueError(f"Video device not found: {video_id}")

        camera = ONVIFCamera(db_video.ip_address, db_video.port or 80, db_video.username, db_video.password)
        media_service = camera.create_media_service()
        ptz_service = camera.create_ptz_service()
        profiles = media_service.GetProfiles()
        if not profiles:
            raise Exception("No media profiles found on camera")
        profile_token = profiles[0].token

        pan_speed = speed if direction in ['left', 'right'] else 0.0
        tilt_speed = speed if direction in ['up', 'down'] else 0.0
        if direction == 'left':
            pan_speed = -speed
        if direction == 'down':
            tilt_speed = -speed

        move_request = {
            'ProfileToken': profile_token,
            'Velocity': {
                'PanTilt': {'x': pan_speed, 'y': tilt_speed},
                'Zoom': {'x': 0.0}
            }
        }
        ptz_service.ContinuousMove(move_request)
        return {"status": "success", "message": f"云台开始向{self._get_direction_name(direction)}移动"}

    def ptz_stop_move(self, db: Session, video_id: int):
        """Stop continuous PTZ move"""
        from onvif import ONVIFCamera
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video:
            raise ValueError(f"Video device not found: {video_id}")

        camera = ONVIFCamera(db_video.ip_address, db_video.port or 80, db_video.username, db_video.password)
        media_service = camera.create_media_service()
        ptz_service = camera.create_ptz_service()
        profiles = media_service.GetProfiles()
        if not profiles:
            raise Exception("No media profiles found on camera")
        profile_token = profiles[0].token

        stop_request = {
            'ProfileToken': profile_token,
            'Velocity': {
                'PanTilt': {'x': 0.0, 'y': 0.0},
                'Zoom': {'x': 0.0}
            }
        }
        try:
            ptz_service.ContinuousMove(stop_request)
        except Exception:
            ptz_service.Stop({'ProfileToken': profile_token})
        return {"status": "success", "message": "云台已停止"}

    def _get_direction_name(self, direction: str) -> str:
        """获取方向的中文名称"""
        direction_map = {
            'up': '上',
            'down': '下',
            'left': '左',
            'right': '右'
        }
        return direction_map.get(direction, direction)

