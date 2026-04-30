"""HoustonLab OS — Comprehensive backend API test suite.
Tests auth, templates, clients, devices, jobs (+ nested), secrets, uploads, dashboard, search, settings.
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://technical-hub-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_IDENT = "admin"
ADMIN_PW = "ChangeMe123!"


# -------- fixtures --------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_IDENT, "password": ADMIN_PW, "remember": True})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# -------- AUTH --------
class TestAuth:
    def test_login_with_username(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": ADMIN_PW})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["username"] == "admin"
        assert d["user"]["email"] == "admin@houstonlab.local"
        assert d["user"]["role"] == "admin"
        # httpOnly cookie set
        assert "access_token" in r.cookies

    def test_login_with_email(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": "admin@houstonlab.local", "password": ADMIN_PW})
        assert r.status_code == 200

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["username"] == "admin"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_logout(self, client):
        r = client.post(f"{API}/auth/logout")
        assert r.status_code == 200
        assert r.json().get("ok") is True


# -------- TEMPLATES --------
class TestTemplates:
    def test_list_templates(self, client):
        r = client.get(f"{API}/templates")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 12, f"expected >=12 templates, got {len(data)}"
        for t in data:
            assert "fields" in t and isinstance(t["fields"], list)
            assert "checklist" in t and isinstance(t["checklist"], list)
            assert "category" in t and "name" in t


# -------- CLIENTS CRUD --------
class TestClients:
    def test_list_clients(self, client):
        r = client.get(f"{API}/clients")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # seed has >= 6
        assert len(r.json()) >= 6

    def test_client_crud(self, client):
        # CREATE
        payload = {"full_name": "TEST_Client X", "phone": "+420111222333", "email": "testclient@x.test", "address": "A", "notes": "n", "trust_notes": "t"}
        r = client.post(f"{API}/clients", json=payload)
        assert r.status_code == 200
        c = r.json()
        assert c["full_name"] == "TEST_Client X"
        cid = c["id"]
        # GET one
        r = client.get(f"{API}/clients/{cid}")
        assert r.status_code == 200
        d = r.json()
        assert d["full_name"] == "TEST_Client X"
        assert "jobs" in d and "devices" in d and "total_spent" in d
        # UPDATE
        payload["notes"] = "updated"
        r = client.put(f"{API}/clients/{cid}", json=payload)
        assert r.status_code == 200
        # verify via GET
        r = client.get(f"{API}/clients/{cid}")
        assert r.json()["notes"] == "updated"
        # DELETE
        r = client.delete(f"{API}/clients/{cid}")
        assert r.status_code == 200
        r = client.get(f"{API}/clients/{cid}")
        assert r.status_code == 404


# -------- DEVICES CRUD --------
class TestDevices:
    def test_list_devices(self, client):
        r = client.get(f"{API}/devices")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 7

    def test_device_crud(self, client):
        payload = {"name": "TEST_Device Y", "device_type": "Laptop", "brand": "Dell", "model": "XPS", "serial": "SN1", "notes": "n", "status": "Active", "photos": [], "specs": {"cpu": "i7"}}
        r = client.post(f"{API}/devices", json=payload)
        assert r.status_code == 200
        did = r.json()["id"]
        r = client.get(f"{API}/devices/{did}")
        assert r.status_code == 200
        d = r.json()
        assert "jobs" in d
        assert d["name"] == "TEST_Device Y"
        payload["notes"] = "updated"
        r = client.put(f"{API}/devices/{did}", json=payload)
        assert r.status_code == 200
        assert r.json()["notes"] == "updated"
        r = client.delete(f"{API}/devices/{did}")
        assert r.status_code == 200
        r = client.get(f"{API}/devices/{did}")
        assert r.status_code == 404


# -------- JOBS CRUD + NESTED --------
@pytest.fixture(scope="class")
def job_ctx(client):
    # Pick a template for auto-fill
    tpls = client.get(f"{API}/templates").json()
    tpl = next((t for t in tpls if t.get("checklist")), tpls[0])
    # Create a throwaway client + device
    c = client.post(f"{API}/clients", json={"full_name": "TEST_JobClient"}).json()
    d = client.post(f"{API}/devices", json={"name": "TEST_JobDevice", "device_type": "Laptop", "client_id": c["id"]}).json()
    payload = {
        "title": "TEST_Job", "template_id": tpl["id"], "category": tpl["category"],
        "status": "New", "priority": "Normal", "client_id": c["id"], "device_id": d["id"],
        "description": "desc", "tags": ["test"], "custom_fields": {"foo": "bar"},
    }
    r = client.post(f"{API}/jobs", json=payload)
    assert r.status_code == 200, r.text
    job = r.json()
    yield {"job": job, "client_id": c["id"], "device_id": d["id"], "template_id": tpl["id"], "template_checklist_len": len(tpl.get("checklist", []))}
    # teardown
    client.delete(f"{API}/jobs/{job['id']}")
    client.delete(f"{API}/devices/{d['id']}")
    client.delete(f"{API}/clients/{c['id']}")


class TestJobs:
    def test_list_jobs_enriched(self, client):
        r = client.get(f"{API}/jobs")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 7
        # enrichment fields present
        has_any_name = any(("client_name" in j) or ("device_name" in j) for j in items)
        assert has_any_name

    def test_create_job_autofill_checklist(self, client, job_ctx):
        job = job_ctx["job"]
        assert job["code"].startswith("HL-")
        assert len(job["checklist"]) == job_ctx["template_checklist_len"]

    def test_get_job_with_relations(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        r = client.get(f"{API}/jobs/{jid}")
        assert r.status_code == 200
        d = r.json()
        assert d["client"]["id"] == job_ctx["client_id"]
        assert d["device"]["id"] == job_ctx["device_id"]
        assert d["template"]["id"] == job_ctx["template_id"]

    def test_update_job(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        payload = {
            "title": "TEST_Job Updated", "template_id": job_ctx["template_id"],
            "category": job_ctx["job"]["category"], "status": "In Progress", "priority": "High",
            "client_id": job_ctx["client_id"], "device_id": job_ctx["device_id"],
            "description": "new desc", "tags": [],
        }
        r = client.put(f"{API}/jobs/{jid}", json=payload)
        assert r.status_code == 200
        r = client.get(f"{API}/jobs/{jid}")
        assert r.json()["title"] == "TEST_Job Updated"
        assert r.json()["status"] == "In Progress"

    def test_timeline_ops(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        r = client.post(f"{API}/jobs/{jid}/timeline", json={"type": "Note", "text": "hello", "customer_visible": False})
        assert r.status_code == 200
        eid = r.json()["id"]
        r = client.get(f"{API}/jobs/{jid}")
        assert any(t["id"] == eid for t in r.json()["timeline"])
        r = client.delete(f"{API}/jobs/{jid}/timeline/{eid}")
        assert r.status_code == 200
        r = client.get(f"{API}/jobs/{jid}")
        assert all(t["id"] != eid for t in r.json()["timeline"])

    def test_checklist_ops(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        r = client.post(f"{API}/jobs/{jid}/checklist", json={"text": "new check", "done": False})
        assert r.status_code == 200
        item_id = r.json()["id"]
        # update done=True
        r = client.put(f"{API}/jobs/{jid}/checklist/{item_id}", json={"done": True, "note": "n"})
        assert r.status_code == 200
        r = client.get(f"{API}/jobs/{jid}")
        it = next(x for x in r.json()["checklist"] if x["id"] == item_id)
        assert it["done"] is True and it.get("completed_at")
        r = client.delete(f"{API}/jobs/{jid}/checklist/{item_id}")
        assert r.status_code == 200

    def test_finance_update(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        fin = {"labor_price": 1000, "parts_price": 500, "discount": 100, "currency": "CZK",
               "payment_status": "Paid", "payment_method": "Cash", "payment_date": "2026-01-15T10:00:00+00:00",
               "payment_note": "ok", "paid_amount": 1400}
        r = client.put(f"{API}/jobs/{jid}/finance", json=fin)
        assert r.status_code == 200
        r = client.get(f"{API}/jobs/{jid}")
        assert r.json()["finance"]["paid_amount"] == 1400
        assert r.json()["finance"]["payment_status"] == "Paid"

    def test_secrets_flow(self, client, job_ctx):
        jid = job_ctx["job"]["id"]
        r = client.post(f"{API}/jobs/{jid}/secrets", json={"label": "Admin PW", "value": "super-secret-xyz"})
        assert r.status_code == 200
        sdata = r.json()
        sid = sdata["id"]
        assert "masked" in sdata
        # list - value should be masked/hidden
        r = client.get(f"{API}/jobs/{jid}")
        s_in_list = next(s for s in r.json()["secrets"] if s["id"] == sid)
        assert "encrypted_value" not in s_in_list
        assert "value" not in s_in_list
        # reveal requires password
        r = client.post(f"{API}/jobs/{jid}/secrets/{sid}/reveal", json={"password": "WRONG"})
        assert r.status_code == 401
        r = client.post(f"{API}/jobs/{jid}/secrets/{sid}/reveal", json={"password": ADMIN_PW})
        assert r.status_code == 200
        assert r.json()["value"] == "super-secret-xyz"
        # delete
        r = client.delete(f"{API}/jobs/{jid}/secrets/{sid}")
        assert r.status_code == 200


# -------- UPLOADS --------
class TestUploads:
    def test_upload_requires_auth(self):
        # Upload without auth should be rejected
        files = {"file": ("test.txt", io.BytesIO(b"x"), "text/plain")}
        r = requests.post(f"{API}/uploads", files=files)
        assert r.status_code in (401, 403)

    def test_upload_and_attach_and_authenticated_serve(self, token, client):
        # create temp job
        c = client.post(f"{API}/clients", json={"full_name": "TEST_UpC"}).json()
        job = client.post(f"{API}/jobs", json={"title": "TEST_UpJob", "category": "Other", "client_id": c["id"]}).json()
        jid = job["id"]
        try:
            files = {"file": ("test.txt", io.BytesIO(b"hello houston"), "text/plain")}
            data = {"job_id": jid, "category": "Docs", "caption": "unit test"}
            r = requests.post(f"{API}/uploads", headers={"Authorization": f"Bearer {token}"}, files=files, data=data)
            assert r.status_code == 200, r.text
            att = r.json()
            assert att["url"].startswith("/api/files/")
            # verify attached
            r = client.get(f"{API}/jobs/{jid}")
            assert any(a["id"] == att["id"] for a in r.json()["attachments"])
            # serve file WITHOUT auth — must be unauthorized now
            r_noauth = requests.get(f"{BASE_URL}{att['url']}")
            assert r_noauth.status_code in (401, 403), f"expected 401/403, got {r_noauth.status_code}"
            # serve file WITH auth — should work
            r_auth = requests.get(f"{BASE_URL}{att['url']}", headers={"Authorization": f"Bearer {token}"})
            assert r_auth.status_code == 200
            assert b"hello houston" in r_auth.content
        finally:
            client.delete(f"{API}/jobs/{jid}")
            client.delete(f"{API}/clients/{c['id']}")


# -------- DASHBOARD --------
class TestDashboard:
    def test_stats_default(self, client):
        r = client.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("counts", "revenue", "by_status", "by_category", "recent_activity",
                  "recent_clients", "recent_devices", "upcoming", "series", "range"):
            assert k in d, f"missing key {k}"
        # revenue shape
        assert "range" in d["revenue"] and "total" in d["revenue"]
        # range object
        assert "key" in d["range"] and "granularity" in d["range"]
        # series is list of {bucket, revenue}
        assert isinstance(d["series"], list)
        for item in d["series"]:
            assert "bucket" in item and "revenue" in item

    @pytest.mark.parametrize("rng", ["today", "week", "month", "year", "6m", "all"])
    def test_stats_range_param(self, client, rng):
        r = client.get(f"{API}/dashboard/stats", params={"range": rng})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["range"]["key"] == rng
        # Granularity is auto-picked by date span; verify it's one of the valid values
        assert d["range"]["granularity"] in ("day", "week", "month")
        # Sanity per-range bounds
        if rng == "all":
            assert d["range"]["from"] is None
        else:
            assert d["range"]["from"] is not None
        assert d["range"]["to"] is not None

    def test_stats_custom_range(self, client):
        r = client.get(f"{API}/dashboard/stats", params={
            "range": "custom",
            "from": "2025-01-01T00:00:00+00:00",
            "to": "2026-01-31T23:59:59+00:00",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["range"]["key"] == "custom"
        assert d["range"]["from"] is not None
        assert d["range"]["to"] is not None

    def test_finance_default(self, client):
        r = client.get(f"{API}/dashboard/finance")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_revenue", "unpaid_total", "by_category", "series",
                  "unpaid_jobs", "paid_jobs", "range"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["series"], list)
        for item in d["series"]:
            assert "bucket" in item and "revenue" in item

    def test_finance_range_month(self, client):
        r = client.get(f"{API}/dashboard/finance", params={"range": "month"})
        assert r.status_code == 200
        d = r.json()
        assert d["range"]["key"] == "month"
        assert d["range"]["granularity"] == "day"

    def test_finance_range_year(self, client):
        r = client.get(f"{API}/dashboard/finance", params={"range": "year"})
        assert r.status_code == 200
        d = r.json()
        assert d["range"]["key"] == "year"
        assert d["range"]["granularity"] in ("day", "week", "month")


# -------- AUDIT --------
class TestAudit:
    def test_audit_list(self, client):
        r = client.get(f"{API}/audit")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_unauth(self):
        r = requests.get(f"{API}/audit")
        assert r.status_code in (401, 403)

    def test_secret_reveal_logs_audit(self, client):
        # Create a temp job + secret, reveal it (success and denied), check audit
        c = client.post(f"{API}/clients", json={"full_name": "TEST_AuditClient"}).json()
        job = client.post(f"{API}/jobs", json={"title": "TEST_AuditJob", "category": "Other", "client_id": c["id"]}).json()
        jid = job["id"]
        try:
            s = client.post(f"{API}/jobs/{jid}/secrets", json={"label": "AuditSecret", "value": "audit-value-001"}).json()
            sid = s["id"]
            # Reveal denied (wrong password)
            r_denied = client.post(f"{API}/jobs/{jid}/secrets/{sid}/reveal", json={"password": "WRONG"})
            assert r_denied.status_code == 401
            # Reveal success
            r_ok = client.post(f"{API}/jobs/{jid}/secrets/{sid}/reveal", json={"password": ADMIN_PW})
            assert r_ok.status_code == 200
            assert r_ok.json()["value"] == "audit-value-001"

            # check audit log for events
            r_rev = client.get(f"{API}/audit", params={"event": "secret.revealed"})
            assert r_rev.status_code == 200
            events_rev = r_rev.json()
            assert any(e.get("entity_id") == sid for e in events_rev), \
                f"secret.revealed missing for sid={sid}; got {len(events_rev)} events"

            r_den = client.get(f"{API}/audit", params={"event": "secret.reveal_denied"})
            assert r_den.status_code == 200
            events_den = r_den.json()
            assert any(e.get("entity_id") == sid for e in events_den), \
                f"secret.reveal_denied missing for sid={sid}"
        finally:
            client.delete(f"{API}/jobs/{jid}")
            client.delete(f"{API}/clients/{c['id']}")


# -------- SEARCH --------
class TestSearch:
    def test_search(self, client):
        r = client.get(f"{API}/search", params={"q": "a"})
        assert r.status_code == 200
        d = r.json()
        # expect keys jobs/clients/devices at least
        assert isinstance(d, dict)


# -------- SETTINGS --------
class TestSettings:
    def test_get_update_settings(self, client):
        r = client.get(f"{API}/settings")
        assert r.status_code == 200
        cur = r.json()
        brand = cur.get("brand_name", "HoustonLab")
        payload = {"brand_name": brand, "accent_color": "#34D399", "currency": "CZK"}
        r = client.put(f"{API}/settings", json=payload)
        assert r.status_code == 200


# -------- PROFILE --------
class TestProfile:
    def test_profile_update(self, client):
        r = client.post(f"{API}/auth/profile", json={"name": "HoustonLab Admin"})
        assert r.status_code == 200
        assert r.json()["name"] == "HoustonLab Admin"

    def test_change_password_wrong_current(self, client):
        r = client.post(f"{API}/auth/change-password", json={"current_password": "WRONG", "new_password": "Whatever123!"})
        assert r.status_code == 400

    def test_change_password_roundtrip_preserves_admin(self, client):
        # change to temp then back — ensure admin pw preserved.
        # NOTE: backend now blocks setting new_password == DEFAULT_ADMIN_PASSWORD ('ChangeMe123!'),
        # so we restore via direct DB write to avoid contaminating the seed credentials.
        r = client.post(f"{API}/auth/change-password", json={"current_password": ADMIN_PW, "new_password": "TempPW9999!"})
        assert r.status_code == 200
        try:
            r2 = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": "TempPW9999!"})
            assert r2.status_code == 200
            # API rejects new == default password — verify that policy
            r_block = client.post(f"{API}/auth/change-password", json={"current_password": "TempPW9999!", "new_password": ADMIN_PW})
            assert r_block.status_code == 400
        finally:
            # Restore admin password back to ChangeMe123! via direct DB write
            import asyncio
            from motor.motor_asyncio import AsyncIOMotorClient
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            import sys
            sys.path.insert(0, "/app/backend")
            from auth import hash_password as _hp

            async def _reset():
                mc = AsyncIOMotorClient(os.environ["MONGO_URL"])
                _db = mc[os.environ["DB_NAME"]]
                await _db.users.update_one({"username": "admin"}, {"$set": {"password_hash": _hp(ADMIN_PW)}})
                mc.close()

            asyncio.get_event_loop().run_until_complete(_reset()) if False else asyncio.run(_reset())
            r3 = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": ADMIN_PW})
            assert r3.status_code == 200, "Failed to restore admin password to ChangeMe123!"
