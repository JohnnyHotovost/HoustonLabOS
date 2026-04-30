"""Clients routes."""
from fastapi import APIRouter, HTTPException, Depends, Request
from auth import get_current_user
from models import Client, ClientIn, now_iso, new_id

router = APIRouter(prefix="/clients", tags=["clients"], dependencies=[Depends(get_current_user)])


@router.get("")
async def list_clients():
    from server import db
    items = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # enrich with job count, last_job_date, total_spent
    for c in items:
        agg = await db.jobs.aggregate([
            {"$match": {"client_id": c["id"]}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "last": {"$max": "$created_at"},
                "spent": {"$sum": "$finance.paid_amount"},
            }}
        ]).to_list(1)
        if agg:
            c["job_count"] = agg[0]["count"]
            c["last_job_date"] = agg[0]["last"]
            c["total_spent"] = agg[0]["spent"]
        else:
            c["job_count"] = 0
            c["last_job_date"] = None
            c["total_spent"] = 0
    return items


@router.post("")
async def create_client(payload: ClientIn):
    from server import db
    doc = Client(**payload.model_dump()).model_dump()
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/{client_id}")
async def get_client(client_id: str):
    from server import db
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Client not found")
    devices = await db.devices.find({"client_id": client_id}, {"_id": 0}).to_list(500)
    jobs = await db.jobs.find({"client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_spent = sum(j.get("finance", {}).get("paid_amount", 0) for j in jobs)
    return {**c, "devices": devices, "jobs": jobs, "total_spent": total_spent}


@router.put("/{client_id}")
async def update_client(client_id: str, payload: ClientIn):
    from server import db
    update = payload.model_dump()
    res = await db.clients.update_one({"id": client_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Client not found")
    return await db.clients.find_one({"id": client_id}, {"_id": 0})


@router.delete("/{client_id}")
async def delete_client(client_id: str, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    from audit import log_event
    from auth import client_ip, user_agent
    c = await db.clients.find_one({"id": client_id}, {"_id": 0, "full_name": 1})
    res = await db.clients.delete_one({"id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Client not found")
    await log_event(db, event="client.deleted", user_id=user["id"], username=user["username"],
                    entity_type="client", entity_id=client_id, entity_label=(c or {}).get("full_name"),
                    ip=client_ip(request), user_agent=user_agent(request))
    return {"ok": True}
