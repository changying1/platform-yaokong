from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.alarm_schema import AlarmOut, AlarmCreate, AlarmUpdate
from app.services.alarm_service import AlarmService
from app.services.video_service import VideoService

router = APIRouter(prefix="/alarms", tags=["Alarm Records"])
service = AlarmService()
video_service = VideoService()

@router.get("/", response_model=list[AlarmOut])
def get_alarms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return service.get_alarms(db, skip, limit)

# @router.post("/", response_model=AlarmOut)
@router.post("/", response_model=AlarmOut)
def create_alarm(alarm: AlarmCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. 创建报警记录
    new_alarm = service.create_alarm(db, alarm)
    
    # 2. 如果报警关联了设备 (device_id)，则触发后台录制任务
    # 注意：这里我们传入 alarm_id，后台任务会根据 ID 重新查库，确保线程安全
    if new_alarm.device_id:
        background_tasks.add_task(video_service.process_alarm_video, new_alarm.id)
        
    return new_alarm

@router.put("/{alarm_id}", response_model=AlarmOut)
def update_alarm(alarm_id: int, alarm: AlarmUpdate, db: Session = Depends(get_db)):
    updated = service.update_alarm(db, alarm_id, alarm)
    if not updated:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return updated

@router.delete("/{alarm_id}")
def delete_alarm(alarm_id: int, db: Session = Depends(get_db)):
    success = service.delete_alarm(db, alarm_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return {"status": "success"}
