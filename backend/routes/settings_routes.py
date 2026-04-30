"""Settings routes."""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, client_ip, user_agent
from audit import log_event
from models import now_iso

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


class SettingsIn(BaseModel):
    brand_name: Optional[str] = None
    accent_color: Optional[str] = None
    currency: Optional[str] = None
    logo_url: Optional[str] = None
    language: Optional[str] = None


@router.get("")
async def get_settings():
    from server import db
    s = await db.settings.find_one({"_id": "app"})
    if s:
        s.pop("_id", None)
    return s or {"brand_name": "HoustonLab", "accent_color": "#34D399", "currency": "CZK", "logo_url": None, "language": "en"}


@router.put("")
async def update_settings(payload: SettingsIn, request: Request, user: dict = Depends(get_current_user)):
    from server import db
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.settings.update_one({"_id": "app"}, {"$set": update}, upsert=True)
    s = await db.settings.find_one({"_id": "app"})
    if s:
        s.pop("_id", None)
    await log_event(db, event="settings.updated", user_id=user["id"], username=user["username"],
                    ip=client_ip(request), user_agent=user_agent(request),
                    meta={"fields": list(update.keys())})
    return s
