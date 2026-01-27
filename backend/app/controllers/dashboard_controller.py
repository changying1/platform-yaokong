from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.security import get_current_user  # ✅ 新增：按你项目实际路径调整

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    """
    顶部三张卡片统计：
    - fenceCount: 电子围栏数量
    - alarmCount: 今日报警数量（使用 alarm_records.timestamp）
    - deviceCount: 设备数量
    """
    # 设备数量
    device_count = db.execute(
        text("SELECT COUNT(*) FROM devices")
    ).scalar() or 0

    # 今日报警数量（你的表字段名就是 timestamp）
    alarm_count = db.execute(
        text("""
            SELECT COUNT(*)
            FROM alarm_records
            WHERE DATE(`timestamp`) = CURDATE()
        """)
    ).scalar() or 0

    # 围栏数量
    fence_count = db.execute(
        text("SELECT COUNT(*) FROM electronic_fences")
    ).scalar() or 0

    return {
        "fenceCount": int(fence_count),
        "alarmCount": int(alarm_count),
        "deviceCount": int(device_count),
    }


@router.get("/branches")
def list_branches(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),  # ✅ 新增：仅用于判断 HQ / BRANCH
):
    """
    分公司列表：给前端地图展示使用
    前端需要 coord: [lng, lat]（经度在前）
    """
    # ✅ 仅增加：总部/分部可见性控制（不改变返回结构）
    where_sql = ""
    params = {}
    if user.get("role") == "BRANCH":
        where_sql = "WHERE id = :bid"
        params["bid"] = user.get("department_id")

    rows = db.execute(text(f"""
        SELECT
          id, province, name, lng, lat, address, project, manager, phone,
          device_count, status, updated_at, remark
        FROM branches
        {where_sql}
        ORDER BY id ASC
    """), params).mappings().all()

    data = []
    for r in rows:
        coord = None
        if r["lng"] is not None and r["lat"] is not None:
            coord = [float(r["lng"]), float(r["lat"])]

        data.append({
            "id": int(r["id"]),
            "province": r.get("province") or "",
            "name": r.get("name") or "",
            "coord": coord,  # [lng, lat]
            "address": r.get("address"),
            "project": r.get("project"),
            "manager": r.get("manager"),
            "phone": r.get("phone"),
            "deviceCount": int(r.get("device_count") or 0),
            "status": r.get("status") or "正常",
            "updatedAt": str(r.get("updated_at")) if r.get("updated_at") else None,
            "remark": r.get("remark"),
        })

    return data
