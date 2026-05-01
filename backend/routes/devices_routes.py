"""Devices routes."""
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user, require_min_role, require_role
from models import Device, DeviceIn

router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[Depends(get_current_user)])


@router.get("")
async def list_devices():
    from server import db
    items = await db.devices.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # enrich with client name + job count
    for d in items:
        if d.get("client_id"):
            c = await db.clients.find_one({"id": d["client_id"]}, {"_id": 0, "full_name": 1})
            d["client_name"] = c["full_name"] if c else None
        else:
            d["client_name"] = None
        d["job_count"] = await db.jobs.count_documents({"device_id": d["id"]})
    return items


@router.post("")
async def create_device(payload: DeviceIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    doc = Device(**payload.model_dump()).model_dump()
    await db.devices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/{device_id}")
async def get_device(device_id: str):
    from server import db
    d = await db.devices.find_one({"id": device_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Device not found")
    if d.get("client_id"):
        c = await db.clients.find_one({"id": d["client_id"]}, {"_id": 0})
        d["client"] = c
    jobs = await db.jobs.find({"device_id": device_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {**d, "jobs": jobs}


@router.put("/{device_id}")
async def update_device(device_id: str, payload: DeviceIn, user: dict = Depends(require_min_role("collaborator"))):
    from server import db
    update = payload.model_dump()
    res = await db.devices.update_one({"id": device_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Device not found")
    return await db.devices.find_one({"id": device_id}, {"_id": 0})


@router.delete("/{device_id}")
async def delete_device(device_id: str, request: Request, user: dict = Depends(require_role("admin"))):
    from server import db
    from audit import log_event
    from auth import client_ip, user_agent
    d = await db.devices.find_one({"id": device_id}, {"_id": 0, "name": 1})
    res = await db.devices.delete_one({"id": device_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Device not found")
    await log_event(db, event="device.deleted", user_id=user["id"], username=user["username"],
                    entity_type="device", entity_id=device_id, entity_label=(d or {}).get("name"),
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}
