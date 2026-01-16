from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
import math
from datetime import datetime

# Add backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.database import SQLALCHEMY_DATABASE_URL
from app.core.database import Base
from app.models.admin_user import User
from app.models.alarm_records import AlarmRecord
from app.models.device import Device
from app.models.fence import ElectronicFence, ProjectRegion, FenceShape, AlarmLevel
from app.models.group_call import GroupCallSession
from app.models.video import VideoDevice

def reset_database():
    # confirm = input("DANGER: This will delete ALL tables in the database. Type 'DELETE' to confirm: ")
    # if confirm != "DELETE":
    #     print("Operation cancelled.")
    #     return
    print("Auto-confirming database reset...")

    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped successfully.")
    
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        devices = []
        # Center: Shanghai People's Square (GCJ02 is approx 31.2304, 121.4737)
        # We store GCJ-02 directly in the DB to align with AMap (Frontend) and Fence Service.
        
        base_lat = 31.2304
        base_lng = 121.4737
        
        print(f"Base GCJ-02: {base_lat}, {base_lng}")
        print("Initializing devices with GCJ-02 coordinates...")

        for i in range(1, 11):
            device_id = f"DEV-{i:04d}"
            
            # Place devices in a small circle around the base
            # Radius ~500m (0.005 degrees)
            angle = (i / 10) * 2 * math.pi
            
            # Use deterministic offsets
            lat_offset = 0.005 * math.cos(angle)
            lng_offset = 0.005 * math.sin(angle)
            
            # Special case: Device 1 is EXACTLY at the center
            if i == 1:
                lat_offset = 0
                lng_offset = 0
                
            final_lat = base_lat + lat_offset
            final_lng = base_lng + lng_offset
            
            print(f"  {device_id}: {final_lat:.6f}, {final_lng:.6f}")

            devices.append(
                Device(
                    id=device_id,
                    device_name=f"Device {i}",
                    device_type="HELMET_CAM",
                    ip_address=f"192.168.1.{100 + i}",
                    port=8000,
                    stream_url=f"rtsp://192.168.1.{100 + i}/stream",
                    is_online=True, # Set to True so they appear active
                    last_latitude=final_lat,
                    last_longitude=final_lng
                )
            )
        session.add_all(devices)
        
        # Add initial video device
        video_device = VideoDevice(
            id=3,
            name="11",
            ip_address="10.102.7.154",
            port=80,
            username="admin",
            password="Song@871023",
            stream_url="http://127.0.0.1:8001/live/11.flv",
            status="online",
            is_active=1
        )
        session.add(video_device)
        
        # Add initial project region
        project_region = ProjectRegion(
            id=1,
            name="1号施工区",
            coordinates_json='[[31.233481,121.468262],[31.226579,121.465625],[31.223856,121.475334],[31.227266,121.479739],[31.229741,121.480029]]',
            remark=""
        )
        session.add(project_region)
        session.flush() # Ensure region id=1 exists
        
        # Add initial electronic fence
        fence = ElectronicFence(
            id=1,
            name="1号围栏",
            project_region_id=1,
            shape=FenceShape.POLYGON,
            behavior="No Entry",
            coordinates_json='[[31.229948,121.468952],[31.229316,121.46802],[31.228078,121.467923],[31.225851,121.47101],[31.226511,121.472554]]',
            radius=80,
            effective_time="00:00-23:59",
            worker_count=2,
            remark="",
            alarm_type=AlarmLevel.MEDIUM,
            is_active=1
        )
        session.add(fence)
        session.flush() # Ensure fence id=1 exists
        
        # Add initial alarm records
        alarms = [
            AlarmRecord(
                id=1,
                alarm_type="电子围栏越界",
                severity="medium",
                timestamp=datetime.strptime("2026-01-16 08:13:58", "%Y-%m-%d %H:%M:%S"),
                description="Device Device 1 left designated area: 1号围栏",
                status="pending",
                location="1号围栏 31.230400, 121.474000",
                device_id="DEV-0001",
                fence_id=1
            ),
            AlarmRecord(
                id=2,
                alarm_type="电子围栏越界",
                severity="medium",
                timestamp=datetime.strptime("2026-01-16 08:13:58", "%Y-%m-%d %H:%M:%S"),
                description="Device Device 3 left designated area: 1号围栏",
                status="pending",
                location="1号围栏 31.228900, 121.478000",
                device_id="DEV-0003",
                fence_id=1
            ),
            AlarmRecord(
                id=3,
                alarm_type="电子围栏越界",
                severity="medium",
                timestamp=datetime.strptime("2026-01-16 08:13:58", "%Y-%m-%d %H:%M:%S"),
                description="Device Device 4 left designated area: 1号围栏",
                status="pending",
                location="1号围栏 31.226400, 121.477000",
                device_id="DEV-0004",
                fence_id=1
            ),
            AlarmRecord(
                id=4,
                alarm_type="电子围栏越界",
                severity="medium",
                timestamp=datetime.strptime("2026-01-16 08:13:58", "%Y-%m-%d %H:%M:%S"),
                description="Device Device 5 left designated area: 1号围栏",
                status="pending",
                location="1号围栏 31.225400, 121.474000",
                device_id="DEV-0005",
                fence_id=1
            ),
            AlarmRecord(
                id=5,
                alarm_type="电子围栏越界",
                severity="medium",
                timestamp=datetime.strptime("2026-01-16 08:13:58", "%Y-%m-%d %H:%M:%S"),
                description="Device Device 8 left designated area: 1号围栏",
                status="pending",
                location="1号围栏 31.231900, 121.469000",
                device_id="DEV-0008",
                fence_id=1
            )
        ]
        session.add_all(alarms)
        
        session.commit()
        print("Seeded 10 devices, 1 video device, 1 project region, 1 fence, and 5 alarm records.")
    finally:
        session.close()

if __name__ == "__main__":
    reset_database()