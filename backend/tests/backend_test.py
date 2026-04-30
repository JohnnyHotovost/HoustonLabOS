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
    def test_upload_and_attach(self, token, client):
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
            # serve file
            r = requests.get(f"{BASE_URL}{att['url']}")
            assert r.status_code == 200
            assert b"hello houston" in r.content
        finally:
            client.delete(f"{API}/jobs/{jid}")
            client.delete(f"{API}/clients/{c['id']}")


# -------- DASHBOARD --------
class TestDashboard:
    def test_stats(self, client):
        r = client.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("counts", "revenue", "by_status", "by_category", "recent_activity", "recent_clients", "recent_devices", "upcoming"):
            assert k in d

    def test_finance(self, client):
        r = client.get(f"{API}/dashboard/finance")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_revenue", "unpaid_total", "by_category", "monthly", "unpaid_jobs", "paid_jobs"):
            assert k in d
        assert len(d["monthly"]) == 6


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
        # change to temp then back — ensure admin pw preserved
        r = client.post(f"{API}/auth/change-password", json={"current_password": ADMIN_PW, "new_password": "TempPW9999!"})
        assert r.status_code == 200
        try:
            r2 = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": "TempPW9999!"})
            assert r2.status_code == 200
        finally:
            # restore
            r = client.post(f"{API}/auth/change-password", json={"current_password": "TempPW9999!", "new_password": ADMIN_PW})
            assert r.status_code == 200
            # verify
            r3 = requests.post(f"{API}/auth/login", json={"identifier": "admin", "password": ADMIN_PW})
            assert r3.status_code == 200
