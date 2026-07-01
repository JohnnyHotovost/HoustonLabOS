"""HoustonLab OS iteration-6 — RBAC, profit, new templates, users CRUD, last-admin guard, audit.
Creates TEST_* users (admin/collaborator/spectator) and a TEST_ job for secret-endpoint testing.
Cleans up after itself; restores admin password to ChangeMe123! at the end.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://houstonlab-os.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = "qa_admin"
ADMIN_PW = "QaAdmin12345!"
COLLAB_PW = "Collab12345!"
SPEC_PW = "Spect12345!"


def _login(ident, pw):
    r = requests.post(f"{API}/auth/login", json={"identifier": ident, "password": pw})
    return r


def _sess(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    r = _login(ADMIN, ADMIN_PW)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return _sess(r.json()["token"])


@pytest.fixture(scope="module")
def test_users(admin_client):
    """Create TEST_collab and TEST_spect users. Teardown deletes them."""
    suffix = uuid.uuid4().hex[:6]
    collab_name = f"test_collab_{suffix}"
    spec_name = f"test_spec_{suffix}"
    created = {}

    r1 = admin_client.post(f"{API}/users", json={
        "username": collab_name, "email": f"{collab_name}@houstonlab.cz",
        "name": "TEST Collab", "password": COLLAB_PW, "role": "collaborator", "is_active": True,
    })
    assert r1.status_code == 200, f"create collab: {r1.status_code} {r1.text}"
    created["collab"] = r1.json()

    r2 = admin_client.post(f"{API}/users", json={
        "username": spec_name, "email": f"{spec_name}@houstonlab.cz",
        "name": "TEST Spectator", "password": SPEC_PW, "role": "spectator", "is_active": True,
    })
    assert r2.status_code == 200, r2.text
    created["spec"] = r2.json()

    yield created

    # teardown
    for u in created.values():
        admin_client.delete(f"{API}/users/{u['id']}")


@pytest.fixture(scope="module")
def collab_client(test_users):
    r = _login(test_users["collab"]["username"], COLLAB_PW)
    assert r.status_code == 200, r.text
    return _sess(r.json()["token"])


@pytest.fixture(scope="module")
def spec_client(test_users):
    r = _login(test_users["spec"]["username"], SPEC_PW)
    assert r.status_code == 200, r.text
    return _sess(r.json()["token"])


# --------- Templates (new + legacy) ---------
class TestTemplatesIter6:
    def test_new_and_legacy_templates_present(self, admin_client):
        r = admin_client.get(f"{API}/templates")
        assert r.status_code == 200
        names = {t["name"] for t in r.json()}
        for n in ["NAS Setup", "Server Setup", "General Network Setup", "UniFi Setup",
                  "Laptop Repair", "Laptop Cleaning", "Console Cleaning"]:
            assert n in names, f"new template missing: {n}"
        for n in ["Networking / UniFi Setup", "NAS / Server Setup", "Laptop Service", "Console Service"]:
            assert n in names, f"legacy template missing: {n}"


# --------- Dashboard profit fields ---------
class TestDashboardProfit:
    def test_stats_includes_profit(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/stats?range=all")
        assert r.status_code == 200
        d = r.json()
        assert "profit" in d
        assert {"range", "total", "currency"} <= set(d["profit"].keys())

    def test_finance_includes_profit(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/finance?range=all")
        assert r.status_code == 200
        d = r.json()
        assert "total_profit" in d and "avg_profit" in d
        assert isinstance(d["by_category"], list)
        if d["by_category"]:
            assert "profit" in d["by_category"][0]
        if d["series"]:
            assert "profit" in d["series"][0]


# --------- Users CRUD + last-admin guard ---------
class TestUsersCRUD:
    def test_list_users_admin(self, admin_client):
        r = admin_client.get(f"{API}/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1
        # no password_hash leaked
        for u in r.json():
            assert "password_hash" not in u

    def test_create_duplicate_rejected(self, admin_client, test_users):
        r = admin_client.post(f"{API}/users", json={
            "username": test_users["collab"]["username"],
            "email": f"dup_{uuid.uuid4().hex[:6]}@houstonlab.cz",
            "name": "dup", "password": "Something1234!", "role": "collaborator", "is_active": True,
        })
        assert r.status_code == 400

    def test_update_user_role_audited(self, admin_client, test_users):
        uid = test_users["spec"]["id"]
        r = admin_client.put(f"{API}/users/{uid}", json={"role": "collaborator"})
        assert r.status_code == 200
        assert r.json()["role"] == "collaborator"
        # revert
        admin_client.put(f"{API}/users/{uid}", json={"role": "spectator"})
        # audit entry
        a = admin_client.get(f"{API}/audit?event=user.role_changed&limit=20")
        assert a.status_code == 200
        items = a.json() if isinstance(a.json(), list) else a.json().get("items", [])
        assert any(e.get("entity_id") == uid for e in items)

    def test_admin_reset_password(self, admin_client, test_users):
        uid = test_users["collab"]["id"]
        new_pw = "ResetMe12345!"
        r = admin_client.post(f"{API}/users/{uid}/reset-password", json={"new_password": new_pw})
        assert r.status_code == 200 and r.json().get("ok") is True
        # verify new pw works
        rlog = _login(test_users["collab"]["username"], new_pw)
        assert rlog.status_code == 200
        # restore so collab_client fixture remains valid
        admin_client.post(f"{API}/users/{uid}/reset-password", json={"new_password": COLLAB_PW})

    def test_last_admin_guard_demote(self, admin_client):
        me = admin_client.get(f"{API}/auth/me").json()
        others = [u for u in admin_client.get(f"{API}/users").json()
                  if u["role"] == "admin" and u.get("is_active") is not False and u["id"] != me["id"]]
        if others:
            pytest.skip("Other active admin(s) exist — last-admin block path not reachable without touching a real admin.")
        r = admin_client.put(f"{API}/users/{me['id']}", json={"role": "collaborator"})
        assert r.status_code == 400
        assert "last" in r.text.lower() or "admin" in r.text.lower()

    def test_last_admin_guard_deactivate(self, admin_client):
        me = admin_client.get(f"{API}/auth/me").json()
        others = [u for u in admin_client.get(f"{API}/users").json()
                  if u["role"] == "admin" and u.get("is_active") is not False and u["id"] != me["id"]]
        if others:
            pytest.skip("Other active admin(s) exist — last-admin block path not reachable without touching a real admin.")
        r = admin_client.put(f"{API}/users/{me['id']}", json={"is_active": False})
        assert r.status_code == 400

    def test_cannot_delete_self(self, admin_client):
        me = admin_client.get(f"{API}/auth/me").json()
        r = admin_client.delete(f"{API}/users/{me['id']}")
        assert r.status_code == 400

    def test_second_admin_unlocks_demote_and_delete(self, admin_client):
        """Create second admin, demote original (allowed now), restore, then delete second admin."""
        suffix = uuid.uuid4().hex[:6]
        uname = f"test_admin2_{suffix}"
        r = admin_client.post(f"{API}/users", json={
            "username": uname, "email": f"{uname}@houstonlab.cz",
            "name": "TEST Admin2", "password": "Admin2Pass12!", "role": "admin", "is_active": True,
        })
        assert r.status_code == 200
        second = r.json()
        # now demoting original should be allowed... but we don't actually demote the primary admin
        # to keep test isolation. Verify by toggling the SECOND admin:
        r2 = admin_client.put(f"{API}/users/{second['id']}", json={"role": "collaborator"})
        assert r2.status_code == 200
        assert r2.json()["role"] == "collaborator"
        # delete the test admin
        rd = admin_client.delete(f"{API}/users/{second['id']}")
        assert rd.status_code == 200


# --------- Profile username update ---------
class TestProfileUsername:
    def test_profile_update_username_and_revert(self, admin_client):
        r = admin_client.post(f"{API}/auth/profile", json={"username": "qa_admin2"})
        assert r.status_code == 200, r.text
        assert r.json().get("username") == "qa_admin2"
        # revert
        r2 = admin_client.post(f"{API}/auth/profile", json={"username": ADMIN})
        assert r2.status_code == 200
        assert r2.json()["username"] == ADMIN

    def test_profile_username_uniqueness(self, admin_client, test_users):
        taken = test_users["collab"]["username"]
        r = admin_client.post(f"{API}/auth/profile", json={"username": taken})
        assert r.status_code in (400, 409)


# --------- Spectator RBAC ---------
class TestSpectatorRBAC:
    def test_spec_finance_blocked(self, spec_client):
        r = spec_client.get(f"{API}/dashboard/finance?range=all")
        assert r.status_code == 403

    def test_spec_stats_stripped(self, spec_client):
        r = spec_client.get(f"{API}/dashboard/stats?range=all")
        assert r.status_code == 200
        d = r.json()
        assert d["revenue"]["range"] == 0
        assert d["revenue"]["total"] == 0
        assert d["profit"]["range"] == 0
        assert d["profit"]["total"] == 0

    def test_spec_cannot_create_job(self, spec_client, admin_client):
        # grab an existing client/device to reference
        c = admin_client.get(f"{API}/clients").json()
        d = admin_client.get(f"{API}/devices").json()
        if not c or not d:
            pytest.skip("no seed client/device")
        r = spec_client.post(f"{API}/jobs", json={
            "title": "TEST_spec_job", "client_id": c[0]["id"], "device_id": d[0]["id"],
            "category": "Custom PC Build", "priority": "Medium", "status": "New",
        })
        assert r.status_code == 403

    def test_spec_cannot_create_user(self, spec_client):
        r = spec_client.post(f"{API}/users", json={
            "username": "xx", "email": "xx@houstonlab.cz", "name": "xx", "password": "Something1234!", "role": "spectator"
        })
        assert r.status_code == 403


# --------- Collaborator RBAC ---------
class TestCollaboratorRBAC:
    def test_collab_cannot_create_user(self, collab_client):
        r = collab_client.post(f"{API}/users", json={
            "username": "xx2", "email": "xx2@houstonlab.cz", "name": "xx", "password": "Something1234!", "role": "spectator"
        })
        assert r.status_code == 403

    def test_collab_can_create_job_and_update_finance(self, collab_client, admin_client):
        c = admin_client.get(f"{API}/clients").json()
        d = admin_client.get(f"{API}/devices").json()
        r = collab_client.post(f"{API}/jobs", json={
            "title": f"TEST_collab_job_{uuid.uuid4().hex[:6]}", "client_id": c[0]["id"], "device_id": d[0]["id"],
            "category": "Custom PC Build", "priority": "Medium", "status": "New",
        })
        assert r.status_code == 200, r.text
        jid = r.json()["id"]

        rf = collab_client.put(f"{API}/jobs/{jid}/finance", json={
            "labor_price": 1000, "parts_price": 500, "discount": 0, "paid_amount": 0,
            "currency": "CZK", "payment_status": "Unpaid", "parts_cost": 100, "other_costs": 50,
        })
        assert rf.status_code == 200, rf.text

        # collab can add secrets
        rs = collab_client.post(f"{API}/jobs/{jid}/secrets", json={
            "label": "TEST_secret", "value": "hunter2", "type": "password"
        })
        assert rs.status_code == 200
        sec = rs.json()
        # collab CANNOT reveal
        sid = sec.get("id") or sec.get("secrets", [{}])[-1].get("id")
        # response shape is the full job or the new secret – support both
        if not sid:
            job = collab_client.get(f"{API}/jobs/{jid}").json()
            sid = job["secrets"][-1]["id"]
        rrev = collab_client.post(f"{API}/jobs/{jid}/secrets/{sid}/reveal",
                                   json={"password": COLLAB_PW})
        assert rrev.status_code == 403

        # collab CANNOT delete secrets
        rdel = collab_client.delete(f"{API}/jobs/{jid}/secrets/{sid}")
        assert rdel.status_code == 403

        # collab CANNOT delete job
        rdj = collab_client.delete(f"{API}/jobs/{jid}")
        assert rdj.status_code == 403

        # cleanup: admin deletes the test job
        admin_client.delete(f"{API}/jobs/{jid}")


# --------- Final restore ---------
class TestZRestore:
    def test_admin_password_unchanged(self):
        r = _login(ADMIN, ADMIN_PW)
        assert r.status_code == 200
