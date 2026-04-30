"""New Audit-feature tests: /audit filters, /audit/meta, file.viewed event."""
import io
import os
import pytest
import requests

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": "admin", "password": "ChangeMe123!", "remember": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def hdr(token):
    return {"Authorization": f"Bearer {token}"}


# --- /api/audit/meta ---
def test_audit_meta_shape(hdr):
    r = requests.get(f"{BASE_URL}/api/audit/meta", headers=hdr, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "events" in data and isinstance(data["events"], list)
    assert "users" in data and isinstance(data["users"], list)
    # Expect at least a handful of auth events from normal admin usage
    assert "login.success" in data["events"]


# --- /api/audit filters ---
def test_audit_event_filter(hdr):
    r = requests.get(
        f"{BASE_URL}/api/audit", params={"event": "login.success", "range": "all"}, headers=hdr, timeout=15
    )
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert all(x.get("event") == "login.success" for x in rows)


def test_audit_q_filter(hdr):
    r = requests.get(f"{BASE_URL}/api/audit", params={"q": "admin", "range": "all"}, headers=hdr, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_audit_range_today_vs_all(hdr):
    r_all = requests.get(f"{BASE_URL}/api/audit", params={"range": "all", "limit": 1000}, headers=hdr).json()
    r_tdy = requests.get(f"{BASE_URL}/api/audit", params={"range": "today", "limit": 1000}, headers=hdr).json()
    assert len(r_tdy) <= len(r_all)


def test_audit_custom_range(hdr):
    r = requests.get(
        f"{BASE_URL}/api/audit",
        params={"range": "custom", "from": "2020-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"},
        headers=hdr,
        timeout=15,
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --- file.viewed audit event ---
def test_file_viewed_audit_event(hdr):
    # 1) Upload a file (no job/device attach required for this flow —
    #    but /files/{id} resolves via job attachments, so attach to a job)
    jobs = requests.get(f"{BASE_URL}/api/jobs", headers=hdr, timeout=15).json()
    assert isinstance(jobs, list) and len(jobs) > 0, "need at least one job to attach upload for retrieval"
    job_id = jobs[0]["id"]

    files = {"file": ("TEST_audit_view.txt", io.BytesIO(b"hello-audit"), "text/plain")}
    r = requests.post(
        f"{BASE_URL}/api/uploads",
        headers=hdr,
        files=files,
        data={"job_id": job_id, "category": "other"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    att = r.json()
    attachment_id = att["id"]

    # 2) View the file once
    vr = requests.get(f"{BASE_URL}/api/files/{attachment_id}", headers=hdr, timeout=15)
    assert vr.status_code == 200

    # 3) Audit should contain file.viewed for this attachment_id
    ar = requests.get(
        f"{BASE_URL}/api/audit",
        params={"event": "file.viewed", "range": "all", "limit": 500},
        headers=hdr,
        timeout=15,
    )
    assert ar.status_code == 200
    rows = ar.json()
    assert any(row.get("entity_id") == attachment_id for row in rows), \
        "file.viewed audit row for this attachment not found"

    # And meta should now include file.viewed
    mr = requests.get(f"{BASE_URL}/api/audit/meta", headers=hdr).json()
    assert "file.viewed" in mr["events"]

    # Cleanup
    requests.delete(f"{BASE_URL}/api/uploads/{attachment_id}", headers=hdr, params={"job_id": job_id})
