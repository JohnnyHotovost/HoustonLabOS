"""Templates routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user, require_role
from models import JobTemplate, CustomFieldDef, now_iso, new_id

router = APIRouter(prefix="/templates", tags=["templates"], dependencies=[Depends(get_current_user)])


class TemplateIn(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    fields: List[CustomFieldDef] = []
    checklist: List[str] = []
    timeline_types: List[str] = []
    attachment_categories: List[str] = []
    supports_devices: bool = True
    supports_secrets: bool = False


@router.get("")
async def list_templates():
    from server import db
    items = await db.templates.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return items


@router.post("")
async def create_template(payload: TemplateIn, user: dict = Depends(require_role("admin"))):
    from server import db
    doc = {
        "id": new_id(),
        **payload.model_dump(),
        "is_predefined": False,
        "created_at": now_iso(),
    }
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/{template_id}")
async def get_template(template_id: str):
    from server import db
    t = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.put("/{template_id}")
async def update_template(template_id: str, payload: TemplateIn, user: dict = Depends(require_role("admin"))):
    from server import db
    res = await db.templates.update_one({"id": template_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Template not found")
    return await db.templates.find_one({"id": template_id}, {"_id": 0})


@router.delete("/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(require_role("admin"))):
    from server import db
    t = await db.templates.find_one({"id": template_id})
    if not t:
        raise HTTPException(404, "Template not found")
    if t.get("is_predefined"):
        raise HTTPException(400, "Cannot delete predefined template")
    await db.templates.delete_one({"id": template_id})
    return {"ok": True}
