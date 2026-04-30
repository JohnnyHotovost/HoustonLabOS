"""Lightweight security audit log."""
from typing import Optional
from datetime import datetime, timezone
import uuid


async def log_event(
    db,
    *,
    event: str,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_label: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
    meta: Optional[dict] = None,
) -> None:
    """Persist a single audit event. Never raises — audit must not break main flows."""
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "event": event,
            "user_id": user_id,
            "username": username,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_label": entity_label,
            "ip": ip,
            "user_agent": user_agent,
            "success": success,
            "meta": meta or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.audit_log.insert_one(doc)
    except Exception:
        pass
