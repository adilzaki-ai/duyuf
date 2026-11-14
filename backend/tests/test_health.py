from __future__ import annotations

from datetime import datetime, timedelta, timezone

from conftest import as_op
from issue_key import issue

from duyuf.core.db import owner_session
from duyuf.core.jobs import fire_due_alerts
from duyuf.health.rules import assess

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def _series(minutes: int, every: int = 5, hr=None, temp=None):
    """Readings every `every` minutes for the last `minutes`, ending now."""
    return [(NOW - timedelta(minutes=m), hr, temp) for m in range(minutes, -1, -every)]


# ---- the rules, by hand ----

def test_one_high_reading_is_not_a_fever_but_a_held_one_is():
    assert assess(_series(20, temp=36.8) + [(NOW, None, 38.6)], NOW, NOW)["temperature"]["state"] == "raised"
    held = assess(_series(30, temp=38.4), NOW, NOW)
    assert held["temperature"]["state"] == "fever" and held["level"] == "warning" and "fever" in held["reasons"]
    assert assess(_series(10, temp=39.8), NOW, NOW)["level"] == "danger"


def test_the_heart_alone_can_be_dangerous():
    assert assess(_series(10, hr=125), NOW, NOW)["heart"]["state"] == "high"
    assert assess(_series(5, every=1, hr=158), NOW, NOW)["reasons"][0] == "heart_danger_high"
    assert assess(_series(5, every=1, hr=36), NOW, NOW)["reasons"][0] == "heart_danger_low"
    jumpy = [(NOW - timedelta(minutes=m), 70 if m % 2 else 125, None) for m in range(10, -1, -1)]
    assert assess(jumpy, NOW, NOW)["heart"]["state"] == "unstable"


def test_fever_with_a_racing_heart_is_danger():
    both = [(at, 128, 38.5) for at, _, _ in _series(30)]
    out = assess(both, NOW, NOW)
    assert out["level"] == "danger" and out["reasons"][:2] == ["fever_and_heart", "fever"]


def test_water_reminders_and_dehydration_risk():
    calm = _series(30, hr=80, temp=36.9)
    assert assess(calm, NOW - timedelta(minutes=30), NOW)["hydration"] == "ok"
    assert assess(calm, NOW - timedelta(minutes=150), NOW)["hydration"] == "due"
    strained = _series(30, hr=115, temp=37.9)
    out = assess(strained, NOW - timedelta(minutes=100), NOW)
    assert out["hydration"] == "risk" and out["level"] == "warning"


def test_old_readings_say_nothing_about_now():
    old = [(NOW - timedelta(minutes=40), 160, 39.9)]
    out = assess(old, NOW, NOW)
    assert out["heart"]["state"] == "unknown" and out["level"] == "unknown"


# ---- on the platform ----

def _pilgrim(client, slug, passport="AB1234567"):
    g = client.post("/v1/groups", headers=as_op(slug), json={
        "code": "U-PK-0001", "name": "Lahore Umrah", "kind": "umrah", "season": "1448", "origin_country": "PK",
        "leader_name": "Bilal Ahmed", "leader_phone": "+92 300 1234567"}).json()
    p = client.post("/v1/pilgrims", headers=as_op(slug), json={
        "group_id": g["id"], "full_name": "Imran Khan", "gender": "male", "nationality": "PK",
        "passport_no": passport, "language": "ur"}).json()
    card = client.post(f"/v1/pilgrims/{p['id']}/rafeeq", headers=as_op(slug), json={}).json()
    return p, {"Authorization": f"Bearer {card['token']}"}


def _ago(minutes: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()


def _dangerous(client, card):
    """Fever and a racing heart, held for half an hour."""
    return client.post("/v1/rafeeq/readings", headers=card, json={"readings": [
        {"at": _ago(m), "heart_rate": 132, "temperature": 38.7} for m in range(32, -1, -4)]})


def _run_out(pilgrim_id: str):
    with owner_session() as conn:
        conn.execute("UPDATE health_alert SET fires_at = now() - interval '1 second' "
                     "WHERE pilgrim_id = %s AND state = 'counting'", (pilgrim_id,))


def test_nothing_is_taken_without_consent_and_withdrawing_removes_it(client, op_a):
    p, card = _pilgrim(client, op_a)
    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["consent"] == {"health": False, "location": False} and page["health"] is None
    assert _dangerous(client, card).status_code == 409
    assert client.post("/v1/rafeeq/location", headers=card, json={"lat": 24.47, "lon": 39.61}).status_code == 409

    page = client.post("/v1/rafeeq/consent", headers=card, json={"health": True, "location": True}).json()
    assert page["consent"] == {"health": True, "location": True}
    client.post("/v1/rafeeq/readings", headers=card, json={"readings": [{"heart_rate": 82, "temperature": 36.8}]})
    assert client.post("/v1/rafeeq/location", headers=card,
                       json={"lat": 24.47, "lon": 39.61, "accuracy_m": 12}).status_code == 204
    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["health"]["heart"]["bpm"] == 82 and page["location_at"]

    page = client.post("/v1/rafeeq/consent", headers=card, json={"health": False, "location": False}).json()
    assert page["health"] is None and page["location_at"] is None
    with owner_session() as conn:
        left = conn.execute("""SELECT (SELECT count(*) FROM vital_reading WHERE pilgrim_id = %(p)s)
                                    + (SELECT count(*) FROM pilgrim_location WHERE pilgrim_id = %(p)s) AS n""",
                            {"p": p["id"]}).fetchone()["n"]
    assert left == 0


def test_danger_counts_down_and_i_am_ok_stops_it(client, op_a):
    p, card = _pilgrim(client, op_a)
    client.post("/v1/rafeeq/consent", headers=card, json={"health": True})
    page = _dangerous(client, card).json()
    assert page["health"]["level"] == "danger"
    alert = page["alert"]
    assert alert and alert["reasons"] == ["fever_and_heart"] and 25 <= alert["seconds_left"] <= 30
    # pressed again: still one countdown
    assert _dangerous(client, card).json()["alert"]["id"] == alert["id"]

    page = client.post(f"/v1/rafeeq/alert/{alert['id']}/ok", headers=card).json()
    assert page["alert"] is None
    # still dangerous a moment later: they just said they are OK, so no new countdown yet
    assert _dangerous(client, card).json()["alert"] is None
    fire_due_alerts()
    assert client.get("/v1/incidents", headers=as_op(op_a)).json()["items"] == []


def test_a_countdown_that_runs_out_calls_the_medics_with_the_place(client, op_a):
    p, card = _pilgrim(client, op_a)
    client.post("/v1/rafeeq/consent", headers=card, json={"health": True, "location": True})
    client.post("/v1/rafeeq/location", headers=card, json={"lat": 21.42250, "lon": 39.82620, "accuracy_m": 30})
    alert = _dangerous(client, card).json()["alert"]
    _run_out(p["id"])
    raised = fire_due_alerts()
    assert len(raised) == 1 and fire_due_alerts() == []      # once only

    i = client.get(f"/v1/incidents/{raised[0]}", headers=as_op(op_a)).json()
    assert i["kind"] == "medical" and i["priority"] == "urgent" and i["reported_by"] == "Rafeeq health alert"
    assert i["location"] == "21.42250, 39.82620 (±30 m)" and i["live_location"]["lat"] == 21.4225
    assert "38.7" not in i["description"] and "132" not in i["description"]   # no numbers for everyone
    assert i["health"]["alert"]["reasons"] == ["fever_and_heart"]             # the developer is an administrator
    assert client.post(f"/v1/rafeeq/alert/{alert['id']}/ok", headers=card).status_code == 409

    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["calls"][0]["kind"] == "medical" and page["alert"] is None
    # more dangerous readings while the case is open go on it, not into a new countdown
    assert _dangerous(client, card).json()["alert"] is None
    # and the case follows them as they move
    client.post("/v1/rafeeq/location", headers=card, json={"lat": 21.42300, "lon": 39.82700, "accuracy_m": 15})
    assert client.get(f"/v1/incidents/{raised[0]}", headers=as_op(op_a)).json()["location"].startswith("21.42300")


def test_only_medics_and_administrators_see_the_numbers(client, op_a, op_b):
    p, card = _pilgrim(client, op_a)
    client.post("/v1/rafeeq/consent", headers=card, json={"health": True, "location": True})
    client.post("/v1/rafeeq/location", headers=card, json={"lat": 24.4672, "lon": 39.6112})
    _dangerous(client, card)
    _run_out(p["id"])
    iid = fire_due_alerts()[0]

    def key(role):
        return {"Authorization": f"Bearer {issue(op_a, 'test', principal=role, role=role, display_name=role)}"}
    medic, desk = key("medic"), key("staff")

    board = client.get("/v1/health", headers=medic).json()
    row = board["items"][0]
    assert row["full_name"] == "Imran Khan" and row["health"]["level"] == "danger" and row["alert"]["incident_ref"]
    assert board["stats"]["danger"] == 1 and board["stats"]["fever"] == 1 and board["stats"]["sharing_location"] == 1
    detail = client.get(f"/v1/health/pilgrims/{p['id']}", headers=medic).json()
    assert len(detail["readings"]) == 9 and detail["alerts"][0]["state"] == "sent"
    assert client.get(f"/v1/incidents/{iid}", headers=medic).json()["health"]["alert"]["heart_rate"] == 132

    # the desk goes to help: the place, not the readings
    assert client.get("/v1/health", headers=desk).status_code == 403
    seen = client.get(f"/v1/incidents/{iid}", headers=desk).json()
    assert seen["health"] is None and seen["live_location"]["lon"] == 39.6112
    # a medic works incidents but does not manage pilgrims
    assert client.post(f"/v1/incidents/{iid}/assign", headers=medic, json={"team": "Medics, gate 21"}).status_code == 200
    assert client.patch(f"/v1/pilgrims/{p['id']}", headers=medic, json={"phone": "1"}).status_code == 403
    # another operator sees none of it
    assert client.get("/v1/health", headers=as_op(op_b)).json()["items"] == []
    assert client.get(f"/v1/health/pilgrims/{p['id']}", headers=as_op(op_b)).status_code == 404


def test_the_wearable_door_and_simulated_readings(client, op_a):
    p, card = _pilgrim(client, op_a)
    client.post("/v1/rafeeq/consent", headers=card, json={"health": True, "location": True})
    admin = {"Authorization": f"Bearer {issue(op_a, 'band maker', principal='bands', role='administrator')}"}
    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='d', role='staff', display_name='Desk')}"}
    body = {"pilgrim_id": p["id"], "device": "Band 3", "readings": [
        {"at": _ago(m), "heart_rate": 160} for m in range(6, -1, -1)],
        "places": [{"lat": 21.42, "lon": 39.83, "accuracy_m": 8}]}
    assert client.post("/v1/devices/readings", headers=desk, json=body).status_code == 403
    r = client.post("/v1/devices/readings", headers=admin, json=body).json()
    assert r["level"] == "danger" and r["alert"]["reasons"] == ["heart_danger_high"]
    # simulated readings are for demonstration operators only
    sim = {"readings": [{"heart_rate": 90}], "source": "simulated"}
    assert client.post("/v1/rafeeq/readings", headers=card, json=sim).status_code == 403


def test_a_medic_can_be_added_to_the_staff(client, op_a):
    r = client.post("/v1/staff", headers=as_op(op_a), json={
        "display_name": "Dr Huda", "email": f"huda@{op_a}.test", "role": "medic", "password": "a-long-pass-1448"})
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "medic"


def test_the_demo_shows_fevers_a_fast_heart_thirst_and_a_quiet_watch(client):
    from seed_demo import seed
    seed(reset=True)
    board = client.get("/v1/health", headers=as_op("duyuf-demo")).json()
    s = board["stats"]
    # dehydration: the strained pilgrim, and the one with a fever who has not drunk for over two hours
    assert (s["fever"], s["heart"], s["dehydration"], s["no_readings"], s["danger"]) == (2, 1, 2, 1, 0)
    assert s["sharing_health"] == 9 and s["sharing_location"] == 10
    assert all(x["health"]["simulated"] for x in board["items"] if x["health"])


def test_heat_stress_exhaustion_and_stroke_risk_from_the_body():
    assert assess(_series(15, hr=80, temp=36.8), NOW, NOW)["heat"] == "ok"
    stress = assess(_series(15, hr=114, temp=37.0), NOW, NOW)
    assert stress["heat"] == "stress" and "heat_stress" in stress["reasons"] and stress["level"] == "watch"
    worn = assess(_series(15, hr=114, temp=37.9), NOW, NOW)
    assert worn["heat"] == "exhaustion" and "heat_exhaustion" in worn["reasons"] and worn["level"] == "warning"
    assert assess(_series(15, temp=39.7), NOW, NOW)["heat"] == "stroke_risk"
    assert assess([], NOW, NOW)["heat"] == "unknown"


def test_a_demonstration_button_replaces_the_last_ones_readings(client):
    from seed_demo import seed
    seed(reset=True)
    h = as_op("duyuf-demo")
    p = client.get("/v1/pilgrims", headers=h, params={"status": "in_madinah", "limit": 1}).json()["items"][0]
    card = {"Authorization": f"Bearer {client.post(f'/v1/pilgrims/{p['id']}/rafeeq', headers=h, json={}).json()['token']}"}
    client.post("/v1/rafeeq/consent", headers=card, json={"health": True})
    calm = [{"at": _ago(m), "heart_rate": 80, "temperature": 36.8} for m in range(15, -1, -5)]
    hot = [{"at": _ago(m), "heart_rate": 114, "temperature": 37.9} for m in range(15, -1, -5)]
    client.post("/v1/rafeeq/readings", headers=card, json={"readings": calm, "source": "simulated"})
    page = client.post("/v1/rafeeq/readings", headers=card, json={"readings": hot, "source": "simulated"}).json()
    assert page["health"]["heat"] == "exhaustion"


def test_find_my_way_shows_the_meeting_point_and_where_most_of_the_group_is(client, op_a):
    p, card = _pilgrim(client, op_a)
    gid = p["group_id"]
    r = client.patch(f"/v1/groups/{gid}", headers=as_op(op_a),
                     json={"meeting_name": "Hotel lobby", "meeting_lat": 24.4689, "meeting_lon": 39.6081})
    assert r.status_code == 200 and r.json()["meeting_name"] == "Hotel lobby"
    # a place needs both halves
    assert client.patch(f"/v1/groups/{gid}", headers=as_op(op_a), json={"meeting_lon": None}).status_code == 400

    page = client.get("/v1/rafeeq/me", headers=card).json()
    assert page["meeting"] == {"name": "Hotel lobby", "lat": 24.4689, "lon": 39.6081} and page["group_now"] is None

    # three others share their place: their middle is shown, never one person's own place
    others = []
    for i, (lat, lon) in enumerate([(24.4670, 39.6110), (24.4672, 39.6112), (24.4690, 39.6150)]):
        q = client.post("/v1/pilgrims", headers=as_op(op_a), json={
            "group_id": gid, "full_name": f"Other {i}", "gender": "male", "nationality": "PK",
            "passport_no": f"ZZ{i}234567"}).json()
        c = {"Authorization": f"Bearer {client.post(f'/v1/pilgrims/{q['id']}/rafeeq', headers=as_op(op_a), json={}).json()['token']}"}
        client.post("/v1/rafeeq/consent", headers=c, json={"location": True})
        client.post("/v1/rafeeq/location", headers=c, json={"lat": lat, "lon": lon})
        others.append(c)
        if i == 1:
            assert client.get("/v1/rafeeq/me", headers=card).json()["group_now"] is None   # two is not enough
    now = client.get("/v1/rafeeq/me", headers=card).json()["group_now"]
    assert now["count"] == 3 and (now["lat"], now["lon"]) == (24.4672, 39.6112)
    # the pilgrim's own place does not count towards their group
    client.post("/v1/rafeeq/consent", headers=card, json={"location": True, "health": True})
    client.post("/v1/rafeeq/location", headers=card, json={"lat": 21.42, "lon": 39.82})
    assert client.get("/v1/rafeeq/me", headers=card).json()["group_now"]["count"] == 3
    # and recent readings come back for the page's details
    client.post("/v1/rafeeq/readings", headers=card, json={"readings": [{"heart_rate": 77, "temperature": 36.9}]})
    assert client.get("/v1/rafeeq/me", headers=card).json()["recent"][0]["heart_rate"] == 77
