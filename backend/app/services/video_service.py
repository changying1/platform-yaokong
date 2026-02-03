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
import signal
from datetime import datetime, timedelta, timezone
import logging
import sys
import hashlib
import base64
import uuid

# [日志压制]
def suppress_verbose_logging():
    for logger_name in ["zeep", "urllib3", "onvif", "wsdl", "requests"]:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.CRITICAL)
        logger.propagate = False

suppress_verbose_logging()

from app.models.alarm_records import AlarmRecord
from app.core.database import SessionLocal

try:
    import onvif
    from onvif import ONVIFCamera
except Exception:
    onvif = None
    ONVIFCamera = None

logger = get_logger("VideoService")

# --- 配置部分 ---
NMS_HOST = "http://127.0.0.1:8001"
NMS_USER = "admin"
NMS_PASS = "123456" 
NMS_MEDIA_ROOT = os.path.abspath(os.getenv("NMS_MEDIA_ROOT", r"C:\media"))

# --- 全局缓存 ---
ONVIF_CLIENT_CACHE = {}

# [新增] 全局字典：用于存储正在运行的 FFmpeg 进程 {stream_name: process_object}
FFMPEG_PROCESSES = {}

class VideoService:
    # -------------------------------------------------------------------------
    # 核心 1: 获取连接
    # -------------------------------------------------------------------------
    def _get_onvif_service(self, db_video):
        global ONVIF_CLIENT_CACHE
        if not ONVIFCamera: raise ImportError("ONVIF library missing")

        if db_video.id in ONVIF_CLIENT_CACHE:
            try:
                cam = ONVIF_CLIENT_CACHE[db_video.id]
                return cam, cam.create_ptz_service(), cam.create_media_service()
            except Exception:
                if db_video.id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[db_video.id]

        logger.info(f"Connecting to {db_video.ip_address}...")
        
        try:
            base_dir = os.path.dirname(os.path.dirname(__file__))
            root_dir = os.path.dirname(base_dir)
            possible_paths = [
                os.path.join(root_dir, 'wsdl'),
                os.path.join(base_dir, 'wsdl'),
                os.path.join(os.getcwd(), 'wsdl')
            ]
            
            wsdl_path = None
            for p in possible_paths:
                if os.path.exists(p) and os.path.isdir(p):
                    wsdl_path = p
                    logger.info(f"Loaded local WSDL from: {p}")
                    break
            
            kwargs = {'no_cache': False}
            if wsdl_path:
                kwargs['wsdl_dir'] = wsdl_path

            camera = ONVIFCamera(
                db_video.ip_address, db_video.port or 80, 
                db_video.username, db_video.password, 
                **kwargs
            )
            
            ONVIF_CLIENT_CACHE[db_video.id] = camera
            return camera, camera.create_ptz_service(), camera.create_media_service()
            
        except Exception as e:
            logger.error(f"Connection Failed: {e}")
            raise ValueError(f"连接失败: {e}")

    # -------------------------------------------------------------------------
    # 辅助: 生成 WS-Security Header (模拟 ODM 认证)
    # -------------------------------------------------------------------------
    def _generate_wsse_header(self, username, password):
        nonce_raw = os.urandom(16)
        nonce_b64 = base64.b64encode(nonce_raw).decode('utf-8')
        created = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        sha1 = hashlib.sha1()
        sha1.update(nonce_raw)
        sha1.update(created.encode('utf-8'))
        sha1.update(password.encode('utf-8'))
        digest = base64.b64encode(sha1.digest()).decode('utf-8')
        
        return f"""<s:Header>
    <Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
        <UsernameToken>
            <Username>{username}</Username>
            <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest}</Password>
            <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</Nonce>
            <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">{created}</Created>
        </UsernameToken>
    </Security>
</s:Header>"""

    # -------------------------------------------------------------------------
    # 核心 2: 原始 SOAP 停止 (ODMFix)
    # -------------------------------------------------------------------------
    def _send_raw_soap_stop(self, camera, ptz_service, profile_token, username, password):
        ptz_url = None
        if hasattr(ptz_service, 'binding') and hasattr(ptz_service.binding, 'options'):
            ptz_url = ptz_service.binding.options.get('address')
        if not ptz_url:
            ptz_url = camera.xaddrs.get('http://www.onvif.org/ver20/ptz/wsdl')
        
        if not ptz_url:
            logger.error("No PTZ URL found")
            return False

        security_header = self._generate_wsse_header(username, password)

        payloads = [
            # 方案 0: Wireshark 抓包复刻
            f"""<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  {security_header}
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>{profile_token}</ProfileToken>
      <PanTilt>true</PanTilt>
      <Zoom>false</Zoom>
    </Stop>
  </s:Body>
</s:Envelope>""",
            # 方案 A: 备用
            f"""<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  {security_header}
  <s:Body>
    <tptz:Stop>
      <tptz:ProfileToken>{profile_token}</tptz:ProfileToken>
      <tptz:PanTilt>true</tptz:PanTilt>
      <tptz:Zoom>true</tptz:Zoom>
    </tptz:Stop>
  </s:Body>
</s:Envelope>""",
            # 方案 B: 备用
            f"""<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  {security_header}
  <s:Body>
    <tptz:Stop>
      <tptz:ProfileToken>{profile_token}</tptz:ProfileToken>
      <tptz:PanTilt>1</tptz:PanTilt>
      <tptz:Zoom>1</tptz:Zoom>
    </tptz:Stop>
  </s:Body>
</s:Envelope>"""
        ]

        headers = {
            'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver20/ptz/wsdl/Stop"'
        }

        for i, payload in enumerate(payloads):
            try:
                response = requests.post(ptz_url, data=payload, headers=headers, timeout=2)
                if 200 <= response.status_code < 300:
                    logger.info(f"Raw SOAP Variant {i} (Capture Match) SUCCESS")
                    return True
                else:
                    logger.warning(f"Raw SOAP Variant {i} Failed: {response.status_code}")
            except Exception as e:
                logger.error(f"Raw SOAP Variant {i} Error: {e}")
        return False

    def ptz_stop_move(self, db: Session, video_id: int):
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video: raise ValueError("Device not found")

        try:
            camera, ptz, media = self._get_onvif_service(db_video)
            token = self._get_profile_token(media)
            
            logger.info(f"STOPPING {db_video.name} using ODM Raw Mode...")

            if self._send_raw_soap_stop(camera, ptz, token, db_video.username, db_video.password):
                return {"status": "success", "message": "Stopped (ODM Mode)"}
            
            # 兜底
            try:
                space_uri = "http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace"
                stop_req = {
                    'ProfileToken': token, 
                    'Velocity': {'PanTilt': {'x': 0.0, 'y': 0.0, 'space': space_uri}}
                }
                ptz.ContinuousMove(stop_req)
                ptz.ContinuousMove(stop_req)
                logger.info("Stopped via ZeroVel Fallback")
                return {"status": "success", "message": "Stopped (ZeroVel)"}
            except Exception as e:
                logger.warning(f"ZeroVel Failed: {e}")

            if video_id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[video_id]
            raise ValueError("所有停止方法均失败")

        except Exception as e:
            if video_id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[video_id]
            logger.error(f"Stop Fatal Error: {e}")
            raise ValueError(f"停止失败: {e}")

    def ptz_start_move(self, db: Session, video_id: int, direction: str, speed: float = 0.5):
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video: raise ValueError("Device not found")

        try:
            camera, ptz, media = self._get_onvif_service(db_video)
            token = self._get_profile_token(media)

            pan = speed if direction == 'right' else (-speed if direction == 'left' else 0.0)
            tilt = speed if direction == 'up' else (-speed if direction == 'down' else 0.0)

            request = {
                'ProfileToken': token,
                'Velocity': {'PanTilt': {'x': pan, 'y': tilt}},
                'Timeout': 'PT5S' 
            }
            ptz.ContinuousMove(request)
            return {"status": "success"}
        except Exception as e:
            if video_id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[video_id]
            raise ValueError(f"Start failed: {e}")

    def _get_profile_token(self, media_service):
        profiles = media_service.GetProfiles()
        if not profiles: raise Exception("No profiles")
        return profiles[0].token

    def _get_direction_name(self, direction: str) -> str:
        return {'up':'上','down':'下','left':'左','right':'右'}.get(direction, direction)

    # -------------------------------------------------------------------------
    # 核心业务: 添加/删除/更新
    # -------------------------------------------------------------------------
    def add_camera_to_media_server(self, db: Session, camera_data: CameraCreateRequest):
        logger.info(f"Adding stream: {camera_data.name}")
        stream_name = camera_data.name.replace(" ", "_").replace("/", "_").lower()
        
        # [修改] 1. 启动推流并存入全局字典
        self.start_ffmpeg_stream(camera_data.rtsp_url, stream_name)

        # 2. 构造播放地址
        flv_url = f"{NMS_HOST}/live/{stream_name}.flv"
        
        new_video = VideoDevice(
            name=camera_data.name, 
            ip_address=camera_data.ip_address, 
            port=camera_data.port, 
            username=camera_data.username, 
            password=camera_data.password, 
            stream_url=flv_url, 
            latitude=camera_data.latitude, 
            longitude=camera_data.longitude, 
            status="online", 
            remark=camera_data.remark
        )
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        return new_video

    def create_video(self, db: Session, video_data: VideoCreate):
        new_video = VideoDevice(**video_data.model_dump())
        db.add(new_video)
        db.commit()
        db.refresh(new_video)
        return new_video
    
    def get_videos(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(VideoDevice).offset(skip).limit(limit).all()

    def update_video(self, db: Session, video_id: int, video_data: VideoUpdate):
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if not db_video: return None
        for key, value in video_data.model_dump(exclude_unset=True).items():
            setattr(db_video, key, value)
        db.commit()
        db.refresh(db_video)
        if video_id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[video_id]
        return db_video

    def delete_video(self, db: Session, video_id: int):
        db_video = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        if db_video:
            # [新增] 删除视频时，先停止对应的推流进程
            stream_name = db_video.name.replace(" ", "_").replace("/", "_").lower()
            self.stop_ffmpeg_stream(stream_name)
            
            db.delete(db_video)
            db.commit()
            if video_id in ONVIF_CLIENT_CACHE: del ONVIF_CLIENT_CACHE[video_id]
            return True
        return False

    def get_stream_url(self, db: Session, video_id: int):
        v = db.query(VideoDevice).filter(VideoDevice.id == video_id).first()
        return v.stream_url if v else None
        
    def ptz_move(self, db: Session, video_id: int, direction: str, speed: float = 0.5, duration: float = 0.5):
        try:
            self.ptz_start_move(db, video_id, direction, speed)
            time.sleep(duration)
            self.ptz_stop_move(db, video_id)
            return {"status": "success"}
        except Exception as e:
            raise ValueError(f"Move error: {e}")

    # -------------------------------------------------------------------------
    # [新功能] V4 极速推流 + 进程管理
    # -------------------------------------------------------------------------
    def start_ffmpeg_stream(self, rtsp_url: str, stream_name: str):
        """
        启动 FFmpeg 推流 (隐藏窗口 + 全局管理)
        """
        # 如果已经存在同名推流，先停止旧的
        self.stop_ffmpeg_stream(stream_name)

        ffmpeg_path = r"C:\Users\DELL\Desktop\platform-shipin-yaokong\platform-yaokong\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe" 
        rtmp_url = f"rtmp://127.0.0.1:19350/live/{stream_name}"
        
        # V4 完美配置
        command = [
            ffmpeg_path, "-y",
            "-f", "rtsp", "-rtsp_transport", "tcp",
            "-user_agent", "LIVE555 Streaming Media v2013.02.11",
            "-fflags", "nobuffer", "-flags", "low_delay",
            "-strict", "experimental",
            "-analyzeduration", "100000", "-probesize", "100000",
            "-i", rtsp_url,
            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
            "-b:v", "4000k", "-maxrate", "6000k", "-bufsize", "1000k",
            "-pix_fmt", "yuv420p", "-g", "15",
            "-c:a", "aac", "-b:a", "64k", "-ar", "16000",
            "-flvflags", "no_duration_filesize",
            "-f", "flv", rtmp_url
        ]

        logger.info(f"Starting FFmpeg Stream for {stream_name}...")
        
        try:
            # [修改关键点] 隐藏 CMD 窗口
            startupinfo = None
            creationflags = 0
            
            if os.name == 'nt':
                # Windows 下使用 CREATE_NO_WINDOW (0x08000000) 彻底隐藏
                creationflags = 0x08000000 
            
            process = subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.DEVNULL,
                creationflags=creationflags
            )
            
            # [新增] 存入全局字典
            FFMPEG_PROCESSES[stream_name] = process
            logger.info(f"Stream {stream_name} started (PID: {process.pid})")
            
            return process
        except Exception as e:
            logger.error(f"FFmpeg start failed: {e}")
            return None

    def stop_ffmpeg_stream(self, stream_name: str):
        """
        [新增] 停止并清理 FFmpeg 进程
        """
        global FFMPEG_PROCESSES
        process = FFMPEG_PROCESSES.get(stream_name)
        
        if process:
            try:
                logger.info(f"Stopping FFmpeg for {stream_name} (PID: {process.pid})...")
                process.terminate() # 尝试温和关闭
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()  # 强制关闭
                logger.info(f"Stream {stream_name} stopped.")
            except Exception as e:
                logger.error(f"Error stopping stream {stream_name}: {e}")
            finally:
                # 无论如何从字典中移除
                if stream_name in FFMPEG_PROCESSES:
                    del FFMPEG_PROCESSES[stream_name]