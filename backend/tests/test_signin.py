"""Staff sign in. Each test has its own client: cookies must not leak into other tests."""
from __future__ import annotations

import pytest
from conftest import as_op
from fastapi.testclient import TestClient
from set_login import set_login

from duyuf.core.auth import SESSION_COOKIE
from duyuf.core.db import tenant_session
from duyuf.main import app

WEB = {"X-Duyuf-Client": "web"}
PW = "a-long-pass-1448"


@pytest.fixture
def browser() -> TestClient:
    return TestClient(app)


def _email(slug: str, who: str = "amina") -> str:
    return f"{who}@{slug}.test"


def _sign_in(c: TestClient, email: str, password: str = PW, headers=WEB):
    return c.post("/v1/auth/sign-in", headers=headers, json={"email": email, "password": password})


def test_sign_in_opens_a_session_that_names_the_person(browser, op_a):
    set_login(op_a, _email(op_a), "Amina Al-Harbi", "administrator", PW, must_change=False)
    r = _sign_in(browser, _email(op_a).upper())         # email is not case-sensitive
    assert r.status_code == 200, r.text
    assert r.json()["principal"]["name"] == "Amina Al-Harbi" and r.json()["via"] == "session"
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "max-age=43200" in cookie
    assert browser.get("/v1/me").json()["tenant"]["slug"] == op_a
    # changes with the cookie need the web app's header; reads do not
    g = {"code": "U-PK-0001", "name": "Lahore", "kind": "umrah", "season": "1448", "origin_country": "PK"}
    assert browser.post("/v1/groups", json=g).status_code == 403
    assert browser.post("/v1/groups", json=g, headers=WEB).status_code == 201
    p = browser.post("/v1/pilgrims", headers=WEB, json={
        "group_id": browser.get("/v1/groups").json()["items"][0]["id"], "full_name": "Imran Khan",
        "gender": "male", "nationality": "PK", "passport_no": "AB1234567"}).json()
    # the history now names the person, not "developer"
    assert p["history"][0]["actor"] == "Amina Al-Harbi"

    assert browser.post("/v1/auth/sign-out").status_code == 204
    assert browser.get("/v1/me").status_code == 401


def test_wrong_and_unknown_are_refused_alike_and_guessing_is_slowed(browser, op_a):
    set_login(op_a, _email(op_a), "Amina", "administrator", PW, must_change=False)
    wrong = _sign_in(browser, _email(op_a), "not-the-password")
    nobody = _sign_in(browser, _email(op_a, "nobody"), "not-the-password")
    assert wrong.status_code == nobody.status_code == 401
    assert wrong.json()["detail"] == nobody.json()["detail"] == "that email and password do not match"
    assert _sign_in(browser, _email(op_a), headers={}).status_code == 403   # not from the web app
    for _ in range(4):
        _sign_in(browser, _email(op_a), "still-wrong")
    locked = _sign_in(browser, _email(op_a))                                  # even the right one, for now
    assert locked.status_code == 429 and "15 minutes" in locked.json()["detail"]


def test_a_new_password_is_required_before_anything_else(browser, op_a):
    temp = set_login(op_a, _email(op_a), "Amina", "administrator")           # made up, must change
    me = _sign_in(browser, _email(op_a), temp).json()
    assert me["principal"]["must_change_password"] is True
    assert browser.get("/v1/groups").status_code == 403
    assert browser.post("/v1/auth/password", headers=WEB, json={"current": "wrong", "new": PW}).status_code == 403
    assert browser.post("/v1/auth/password", headers=WEB, json={"current": temp, "new": "short"}).status_code == 422
    assert browser.post("/v1/auth/password", headers=WEB, json={"current": temp, "new": temp}).status_code == 422
    other = TestClient(app)
    _sign_in(other, _email(op_a), temp)
    r = browser.post("/v1/auth/password", headers=WEB, json={"current": temp, "new": PW})
    assert r.status_code == 200 and r.json()["principal"]["must_change_password"] is False
    assert browser.get("/v1/groups").status_code == 200
    assert other.get("/v1/me").status_code == 401                             # every other session ends
    assert _sign_in(TestClient(app), _email(op_a), PW).status_code == 200


def test_administrators_manage_staff_and_cannot_lock_the_operator_out(browser, op_a):
    set_login(op_a, _email(op_a), "Amina", "administrator", PW, must_change=False)
    _sign_in(browser, _email(op_a))
    me_id = browser.get("/v1/me").json()["principal"]["id"]
    r = browser.post("/v1/staff", headers=WEB, json={"display_name": "Arrivals desk", "email": _email(op_a, "Desk"),
                                                     "role": "staff", "password": "desk-first-1448"})
    assert r.status_code == 201, r.text
    desk = r.json()
    assert desk["email"] == _email(op_a, "desk") and desk["must_change_password"] is True
    assert "password_hash" not in desk
    assert browser.post("/v1/staff", headers=WEB, json={"display_name": "x", "email": _email(op_a, "x"),
                                                        "role": "staff", "password": "short"}).status_code == 422

    # the desk signs in, changes the handed-over password, and cannot manage staff
    d = TestClient(app)
    _sign_in(d, _email(op_a, "desk"), "desk-first-1448")
    d.post("/v1/auth/password", headers=WEB, json={"current": "desk-first-1448", "new": "desk-own-pass-1"})
    assert d.get("/v1/staff").status_code == 403
    assert d.get("/v1/pilgrims").status_code == 200

    # switching them off signs them out at once; so does a reset
    assert browser.patch(f"/v1/staff/{desk['id']}", headers=WEB, json={"disabled": True}).json()["disabled"] is True
    assert d.get("/v1/me").status_code == 401
    assert _sign_in(TestClient(app), _email(op_a, "desk"), "desk-own-pass-1").status_code == 403
    browser.patch(f"/v1/staff/{desk['id']}", headers=WEB, json={"disabled": False, "password": "desk-reset-1448"})
    assert _sign_in(TestClient(app), _email(op_a, "desk"), "desk-own-pass-1").status_code == 401
    again = _sign_in(TestClient(app), _email(op_a, "desk"), "desk-reset-1448").json()
    assert again["principal"]["must_change_password"] is True

    # no self-demotion, and always one administrator who can sign in
    assert browser.patch(f"/v1/staff/{me_id}", headers=WEB, json={"role": "viewer"}).status_code == 409
    assert browser.patch(f"/v1/staff/{me_id}", headers=WEB, json={"disabled": True}).status_code == 409
    dev = TestClient(app)
    r = dev.patch(f"/v1/staff/{me_id}", headers=as_op(op_a), json={"role": "supervisor"})
    assert r.status_code == 409 and "at least one administrator" in r.json()["detail"]


def test_staff_and_sessions_stay_inside_their_operator(browser, op_a, op_b):
    set_login(op_a, _email(op_a), "A admin", "administrator", PW, must_change=False)
    set_login(op_b, _email(op_b), "B admin", "administrator", PW, must_change=False)
    _sign_in(browser, _email(op_b))
    a_people = TestClient(app).get("/v1/staff", headers=as_op(op_a)).json()["items"]
    a_admin = next(x for x in a_people if x["email"] == _email(op_a))
    assert all(x["email"] != _email(op_a) for x in browser.get("/v1/staff").json()["items"])
    assert browser.patch(f"/v1/staff/{a_admin['id']}", headers=WEB, json={"disabled": True}).status_code == 404
    # one email, one operator
    r = browser.post("/v1/staff", headers=WEB, json={"display_name": "x", "email": _email(op_a),
                                                     "role": "staff", "password": "another-1448"})
    assert r.status_code == 409


def test_the_app_role_cannot_read_password_hashes(op_a):
    set_login(op_a, _email(op_a), "Amina", "administrator", PW, must_change=False)
    from duyuf.core.db import owner_session
    with owner_session() as conn:
        tid = conn.execute("SELECT id::text FROM tenant WHERE slug = %s", (op_a,)).fetchone()["id"]
    with pytest.raises(Exception, match="permission denied"):
        with tenant_session(tid) as conn:
            conn.execute("SELECT password_hash FROM principal").fetchall()
    with pytest.raises(Exception, match="permission denied"):
        with tenant_session(tid) as conn:
            conn.execute("SELECT * FROM staff_session").fetchall()


def test_a_disabled_persons_key_stops_working(op_a):
    from issue_key import issue
    key = issue(op_a, "test", principal="bot", role="staff", display_name="Bot")
    c = TestClient(app)
    h = {"Authorization": f"Bearer {key}"}
    assert c.get("/v1/me", headers=h).status_code == 200
    bot = next(x for x in c.get("/v1/staff", headers=as_op(op_a)).json()["items"] if x["display_name"] == "Bot")
    c.patch(f"/v1/staff/{bot['id']}", headers=as_op(op_a), json={"disabled": True})
    assert c.get("/v1/me", headers=h).status_code == 401


def test_the_demo_has_one_sign_in_per_role(browser):
    from seed_demo import DEMO_PASSWORD, DEMO_STAFF, seed
    seed(reset=True)
    for email, _, role in DEMO_STAFF:
        r = _sign_in(TestClient(app), email, DEMO_PASSWORD)
        assert r.status_code == 200 and r.json()["principal"]["role"] == role
    assert SESSION_COOKIE == "duyuf_session"
