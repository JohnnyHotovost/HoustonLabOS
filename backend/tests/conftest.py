"""Shared test setup for HoustonLab OS.

Ensures a dedicated, TEST-ONLY admin account (`qa_admin`) exists so the
automated suite is self-contained and never depends on real production users
(e.g. `wmatěj`) or the default `admin` account (which is intentionally demoted
to `collaborator` in production).

Credentials are documented in /app/memory/test_credentials.md.
"""
import asyncio
import os
import sys

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")

from auth import hash_password  # noqa: E402
from models import now_iso, new_id  # noqa: E402

QA_ADMIN_IDENT = "qa_admin"
QA_ADMIN_EMAIL = "qa_admin@houstonlab.local"
QA_ADMIN_NAME = "HoustonLab QA Admin"
QA_ADMIN_PW = "QaAdmin12345!"

# Exact leftover test users to remove (from a previous, uncleaned test run).
LEFTOVER_TEST_USERS = ["test_collab_d6dc7f", "test_spec_d6dc7f"]

# Prefix patterns for users the suite itself generates — safe to purge.
# These never match real accounts (wmatěj, admin, qa_admin).
TEST_USER_PREFIX_RE = r"^test_(collab|spec|admin2)_"


async def _purge_generated_test_users(db):
    await db.users.delete_many({"username": {"$regex": TEST_USER_PREFIX_RE}})


async def _setup():
    mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    try:
        # Ensure the dedicated test admin exists and is a proper, active admin.
        existing = await db.users.find_one({"username": QA_ADMIN_IDENT})
        if existing is None:
            await db.users.insert_one({
                "id": new_id(),
                "username": QA_ADMIN_IDENT,
                "email": QA_ADMIN_EMAIL,
                "name": QA_ADMIN_NAME,
                "role": "admin",
                "is_active": True,
                "password_hash": hash_password(QA_ADMIN_PW),
                "must_change_password": False,
                "created_at": now_iso(),
                "last_login_at": None,
            })
        else:
            # Self-heal: keep it a proper active admin with the known password.
            await db.users.update_one(
                {"username": QA_ADMIN_IDENT},
                {"$set": {
                    "email": QA_ADMIN_EMAIL,
                    "name": QA_ADMIN_NAME,
                    "role": "admin",
                    "is_active": True,
                    "password_hash": hash_password(QA_ADMIN_PW),
                    "must_change_password": False,
                }},
            )

        # Remove the two known leftover test users + any suite-generated ones.
        await db.users.delete_many({"username": {"$in": LEFTOVER_TEST_USERS}})
        await _purge_generated_test_users(db)
    finally:
        mc.close()


async def _teardown():
    mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mc[os.environ["DB_NAME"]]
    try:
        await _purge_generated_test_users(db)
    finally:
        mc.close()


@pytest.fixture(scope="session", autouse=True)
def qa_admin_account():
    asyncio.run(_setup())
    yield
    asyncio.run(_teardown())
