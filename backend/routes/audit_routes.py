"""Audit log read-only API."""
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(get_current_user)])


@router.get("")
async def list_audit(event: str | None = None, limit: int = 200):
    from server import db
    q = {}
    if event:
        q["event"] = event
    cur = db.audit_log.find(q, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 1000))
    return await cur.to_list(1000)
