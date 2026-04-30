"""Global cross-entity search."""
import re
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(get_current_user)])


@router.get("")
async def search(q: str = ""):
    from server import db
    q = (q or "").strip()
    if not q:
        return {"jobs": [], "clients": [], "devices": []}
    rx = {"$regex": re.escape(q), "$options": "i"}

    jobs = await db.jobs.find(
        {"$or": [{"title": rx}, {"code": rx}, {"description": rx}, {"internal_notes": rx}, {"tags": rx}, {"category": rx}]},
        {"_id": 0, "id": 1, "code": 1, "title": 1, "status": 1, "category": 1, "client_id": 1}
    ).limit(15).to_list(15)
    clients = await db.clients.find(
        {"$or": [{"full_name": rx}, {"email": rx}, {"phone": rx}, {"notes": rx}]},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1}
    ).limit(15).to_list(15)
    devices = await db.devices.find(
        {"$or": [{"name": rx}, {"brand": rx}, {"model": rx}, {"serial": rx}, {"device_type": rx}]},
        {"_id": 0, "id": 1, "name": 1, "device_type": 1, "brand": 1, "model": 1, "serial": 1}
    ).limit(15).to_list(15)
    return {"jobs": jobs, "clients": clients, "devices": devices}
