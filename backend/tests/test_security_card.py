"""Tests for SecurityCard backend: GET /api/audit/summary + POST /jobs/.../secrets/.../copied."""
import os
import pytest
import requests

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"


@pytest.fixture(scope="module")
def hdr():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": "admin", "password": "ChangeMe123!", "remember": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# --- /api/audit/summary ---
EXPECTED_KEYS = {
    "login_success", "login_failed", "secret_revealed", "secret_reveal_denied",
    "secret_copied", "secret_created", "secret_deleted", "file_viewed",
    "file_uploaded", "file_deleted", "deletions", "settings_updated",
}


def test_audit_summary_default_day_shape(hdr):
    r = requests.get(f"{BASE_URL}/api/audit/summary", headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "range" in data and "counts" in data and "raw" in data
    assert set(data["counts"].keys()) == EXPECTED_KEYS
    # default key=day
    assert data["range"]["key"] in (None, "day")
    # all counts are non-negative ints
    for k, v in data["counts"].items():
        assert isinstance(v, int) and v >= 0, f"{k} = {v}"


def test_audit_summary_deletions_sum(hdr):
    r = requests.get(f"{BASE_URL}/api/audit/summary", params={"range": "all"}, headers=hdr, timeout=15)
    assert r.status_code == 200
    data = r.json()
    raw = data["raw"]
    expected = raw.get("job.deleted", 0) + raw.get("client.deleted", 0) + raw.get("device.deleted", 0)
    assert data["counts"]["deletions"] == expected


@pytest.mark.parametrize("rng", ["today", "day", "week", "month", "6m", "year", "all"])
def test_audit_summary_range_keys(hdr, rng):
    r = requests.get(f"{BASE_URL}/api/audit/summary", params={"range": rng}, headers=hdr, timeout=15)
    assert r.status_code == 200, f"range={rng} failed: {r.text}"
    assert set(r.json()["counts"].keys()) == EXPECTED_KEYS


def test_audit_summary_custom_range(hdr):
    r = requests.get(
        f"{BASE_URL}/api/audit/summary",
        params={"range": "custom", "from": "2020-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"},
        headers=hdr, timeout=15,
    )
    assert r.status_code == 200
    assert set(r.json()["counts"].keys()) == EXPECTED_KEYS


def test_audit_summary_requires_auth():
    r = requests.get(f"{BASE_URL}/api/audit/summary", timeout=15)
    assert r.status_code in (401, 403)


# --- POST /api/jobs/{job_id}/secrets/{secret_id}/copied ---
@pytest.fixture(scope="module")
def job_and_secret(hdr):
    """Create a TEST_ job + secret, return ids; cleanup at end."""
    job = requests.post(
        f"{BASE_URL}/api/jobs",
        headers=hdr,
        json={"title": "TEST_security_card_job", "status": "intake", "category": "data_recovery"},
        timeout=15,
    )
    assert job.status_code in (200, 201), job.text
    job_id = job.json()["id"]

    sec_value = "TEST_SECRET_VALUE_DO_NOT_LEAK_42"
    sec = requests.post(
        f"{BASE_URL}/api/jobs/{job_id}/secrets",
        headers=hdr, json={"label": "TEST_label", "value": sec_value}, timeout=15,
    )
    assert sec.status_code in (200, 201), sec.text
    secret_id = sec.json()["id"]

    yield {"job_id": job_id, "secret_id": secret_id, "value": sec_value, "label": "TEST_label"}

    # cleanup: delete secret + job
    requests.delete(f"{BASE_URL}/api/jobs/{job_id}/secrets/{secret_id}", headers=hdr)
    requests.delete(f"{BASE_URL}/api/jobs/{job_id}", headers=hdr)


def test_secret_copied_requires_auth(job_and_secret):
    r = requests.post(
        f"{BASE_URL}/api/jobs/{job_and_secret['job_id']}/secrets/{job_and_secret['secret_id']}/copied",
        timeout=15,
    )
    assert r.status_code in (401, 403)


def test_secret_copied_unknown_secret_returns_404(hdr, job_and_secret):
    r = requests.post(
        f"{BASE_URL}/api/jobs/{job_and_secret['job_id']}/secrets/does-not-exist/copied",
        headers=hdr, timeout=15,
    )
    assert r.status_code == 404


def test_secret_copied_writes_audit_row(hdr, job_and_secret):
    j = job_and_secret
    r = requests.post(
        f"{BASE_URL}/api/jobs/{j['job_id']}/secrets/{j['secret_id']}/copied",
        headers=hdr, timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    # verify audit row exists
    ar = requests.get(
        f"{BASE_URL}/api/audit",
        params={"event": "secret.copied", "range": "all", "limit": 500},
        headers=hdr, timeout=15,
    )
    assert ar.status_code == 200
    rows = ar.json()
    matched = [row for row in rows if row.get("entity_id") == j["secret_id"]]
    assert matched, f"no secret.copied audit row for {j['secret_id']}"
    row = matched[0]
    assert row["event"] == "secret.copied"
    assert row["entity_type"] == "secret"
    assert row["entity_label"] == j["label"]
    assert (row.get("meta") or {}).get("job_id") == j["job_id"]

    # CRITICAL: secret value must NOT appear anywhere in the audit row
    import json
    blob = json.dumps(row)
    assert j["value"] not in blob, "decrypted secret value leaked into audit row!"


def test_secret_copied_event_in_summary(hdr, job_and_secret):
    """After at least one copy event, summary.counts.secret_copied >= 1 in 'all' range."""
    s = requests.get(f"{BASE_URL}/api/audit/summary", params={"range": "all"}, headers=hdr).json()
    assert s["counts"]["secret_copied"] >= 1


def test_secret_copied_event_in_meta(hdr, job_and_secret):
    """After a copy event, /audit/meta distinct events list includes secret.copied."""
    m = requests.get(f"{BASE_URL}/api/audit/meta", headers=hdr).json()
    assert "secret.copied" in m["events"]
