from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db  # 你项目 core/database.py 里应该有 get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    """
    返回 Dashboard 顶部三个统计数据：
    - 电子围栏数量: electronic_fences
    - 报警数量(今日): alarm_records 按 timestamp
    - 设备数量: devices
    """
    fence_count = db.execute(text("SELECT COUNT(1) FROM electronic_fences")).scalar() or 0

    # timestamp 是 MySQL 关键字，用反引号更稳
    alarm_count = db.execute(
        text("SELECT COUNT(1) FROM alarm_records WHERE DATE(`timestamp`) = CURDATE()")
    ).scalar() or 0

    device_count = db.execute(text("SELECT COUNT(1) FROM devices")).scalar() or 0

    return {
        "fenceCount": int(fence_count),
        "alarmCount": int(alarm_count),
        "deviceCount": int(device_count),
    }
