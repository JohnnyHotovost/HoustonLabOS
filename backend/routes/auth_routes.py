"""Auth routes."""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_MIN, REMEMBER_ME_DAYS,
)
from models import LoginPayload, ChangePasswordPayload, ProfileUpdatePayload

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, token: str, remember: bool):
    max_age = REMEMBER_ME_DAYS * 86400 if remember else ACCESS_TOKEN_MIN * 60
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=False, samesite="lax", max_age=max_age, path="/",
    )


@router.post("/login")
async def login(payload: LoginPayload, response: Response):
    from server import db
    ident = payload.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"username": ident}]})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"], remember=payload.remember)
    _set_cookie(response, token, payload.remember)
    return {
        "token": token,
        "user": {
            "id": user["id"], "username": user["username"], "email": user["email"],
            "name": user.get("name"), "role": user.get("role", "admin"),
            "created_at": user["created_at"],
        }
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/change-password")
async def change_password(payload: ChangePasswordPayload, user: dict = Depends(get_current_user)):
    from server import db
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(payload.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    return {"ok": True}


@router.post("/profile")
async def update_profile(payload: ProfileUpdatePayload, user: dict = Depends(get_current_user)):
    from server import db
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return user
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated
