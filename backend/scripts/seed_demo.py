"""Load (or reload) the demonstration operator from sample/demo.json.

    .venv/bin/python scripts/seed_demo.py           create the operator if needed, then load
    .venv/bin/python scripts/seed_demo.py --reset   wipe its groups, pilgrims, flights, shifts and incidents first

Refuses any operator that is not a demonstration, in the same statement that
deletes, so a real company's pilgrims can never be wiped by this. The wipe and
the load are one transaction: if the load fails, the previous demo stays.
Run it before each demonstration so "arriving this week" is this week.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "api"))
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

from duyuf.core.db import owner_session  # noqa: E402
from provision import provision  # noqa: E402
from set_login import set_login  # noqa: E402

# The demo operator's staff, one per role, so each role can be tried. Invented
# people with a shared password: the demo holds invented pilgrims only, and
# these accounts exist on demonstration operators only (seed refuses others).
DEMO_STAFF = [
    ("amina@duyuf.demo", "Amina Al-Harbi", "administrator"),
    ("omar@duyuf.demo", "Omar Siddiqui", "supervisor"),
    ("desk@duyuf.demo", "Arrivals desk", "staff"),
    ("viewer@duyuf.demo", "Ministry visitor", "viewer"),
    ("medic@duyuf.demo", "Dr Huda Al-Qahtani", "medic"),
]
DEMO_PASSWORD = os.environ.get("DUYUF_DEMO_PASSWORD", "duyuf-demo-1448")

SAMPLE = ROOT / "sample" / "demo.json"


def seed(reset: bool = False) -> dict:
    data = json.loads(SAMPLE.read_text())
    op = data["operator"]
    tid = provision(op["slug"], op["name"], op["name_ar"], demo=True)
    with owner_session() as conn:
        if not conn.execute("SELECT is_demo FROM tenant WHERE id = %s", (tid,)).fetchone()["is_demo"]:
            raise SystemExit(f"{op['slug']} is not a demonstration operator; refusing")
        existing = conn.execute("SELECT count(*)::int AS n FROM pilgrim_group WHERE tenant_id = %s",
                                (tid,)).fetchone()["n"]
        if existing and not reset:
            raise SystemExit(f"{op['slug']} already holds {existing} groups; pass --reset to reload")
        for table in ("health_alert", "vital_reading", "water_log", "pilgrim_location", "pilgrim_consent",
                      "incident_event", "incident", "rafeeq_card", "pilgrim_event", "pilgrim", "flight_event", "flight",
                      "pilgrim_group", "resource_shift"):
            conn.execute(f"""DELETE FROM {table} x USING tenant t
                              WHERE x.tenant_id = t.id AND t.id = %s AND t.is_demo""", (tid,))
        fid = {}
        for f in data["flights"]:
            # Saudi wall-clock time: the session's zone is Asia/Riyadh (core/db.py).
            fid[f["number"]] = conn.execute(
                """INSERT INTO flight (tenant_id, number, origin_airport, arrival_airport, scheduled_at, estimated_at,
                                      terminal, gate)
                   SELECT %(t)s, %(number)s, %(origin_airport)s, %(arrival_airport)s, s,
                          CASE WHEN %(delay_minutes)s > 0 THEN s + make_interval(mins => %(delay_minutes)s) END,
                          %(terminal)s, %(gate)s
                     FROM (SELECT ((current_date + %(day)s) + %(time)s::time)::timestamptz AS s) x
                   RETURNING id""", {"terminal": None, "gate": None, **f, "t": tid}).fetchone()["id"]
            conn.execute("""INSERT INTO flight_event (tenant_id, flight_id, kind, detail, actor, at)
                            VALUES (%s, %s, 'created', '{}', 'Demo load', current_date - 20)""", (tid, fid[f["number"]]))
        for r in data["resources"]:
            conn.execute(
                """INSERT INTO resource_shift (tenant_id, airport, kind, language, quantity, starts_at, ends_at,
                       created_by)
                   VALUES (%(t)s, %(airport)s, %(kind)s, %(language)s, %(quantity)s,
                           (current_date + %(from_day)s)::timestamptz, (current_date + %(to_day)s)::timestamptz,
                           'Demo load')""", {**r, "t": tid})
        gid = {}
        for g in data["groups"]:
            gid[g["code"]] = conn.execute(
                """INSERT INTO pilgrim_group (tenant_id, code, name, kind, season, origin_country,
                       arrival_date, departure_date, leader_name, leader_phone)
                   VALUES (%s, %s, %s, %s, %s, %s, current_date + %s, current_date + %s, %s, %s)
                   RETURNING id""",
                (tid, g["code"], g["name"], g["kind"], g["season"], g["origin_country"],
                 g["arrive_in_days"], g["depart_in_days"], g["leader_name"], g["leader_phone"])).fetchone()["id"]
        by_place: dict[tuple[str, int], str] = {}
        place: dict[str, int] = {}
        for p in data["pilgrims"]:
            last = p["history"][-1]
            pid = conn.execute(
                """INSERT INTO pilgrim (tenant_id, group_id, full_name, full_name_ar, gender, date_of_birth,
                       nationality, passport_no, phone, language, arrival_flight_id, status, needs,
                       created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                           (current_date + %s)::timestamp + make_interval(hours => %s),
                           (current_date + %s)::timestamp + make_interval(hours => %s))
                   RETURNING id""",
                (tid, gid[p["group_code"]], p["full_name"], p["full_name_ar"], p["gender"], p["date_of_birth"],
                 p["nationality"], p["passport_no"], p["phone"], p["language"], fid.get(p["flight"]),
                 p["status"], p["needs"],
                 p["history"][0]["day"], p["history"][0]["hour"], last["day"], last["hour"])).fetchone()["id"]
            by_place[(p["group_code"], place.setdefault(p["group_code"], 0))] = pid
            place[p["group_code"]] += 1
            for h in p["history"]:
                conn.execute(
                    """INSERT INTO pilgrim_event (tenant_id, pilgrim_id, from_status, to_status, actor, at)
                       VALUES (%s, %s, %s, %s, 'Demo load',
                               (current_date + %s)::timestamp + make_interval(hours => %s))""",
                    (tid, pid, h["from"], h["to"], h["day"], h["hour"]))
        for x in data["incidents"]:
            opened = f"now() - make_interval(mins => {int(x['minutes_ago'])})"
            after = lambda m: f"{opened} + make_interval(mins => {int(m)})" if m is not None else "NULL"
            status = "resolved" if x["resolved_after"] is not None else "assigned" if x["team"] else "open"
            pid = by_place[(x["group_code"], x["pilgrim_index"])] if x["pilgrim_index"] is not None else None
            iid = conn.execute(
                f"""INSERT INTO incident (tenant_id, kind, priority, status, pilgrim_id, group_id, location, description,
                        team, resolution, reported_by, opened_at, assigned_at, resolved_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, {opened}, {after(x['assigned_after'])},
                            {after(x['resolved_after'])}, now())
                    RETURNING id""",
                (tid, x["kind"], x["priority"], status, pid, gid[x["group_code"]], x["location"],
                 x["description"], x["team"], x["resolution"], x["reported_by"])).fetchone()["id"]
            steps = [("opened", None, None, x["reported_by"], opened)]
            if x["team"]:
                steps.append(("assigned", x["team"], None, "Operations desk", after(x["assigned_after"])))
            if x["resolved_after"] is not None:
                steps.append(("resolved", None, x["resolution"], x["team"], after(x["resolved_after"])))
            for kind, team, note, actor, at in steps:
                conn.execute(f"""INSERT INTO incident_event (tenant_id, incident_id, kind, team, note, actor, at)
                                 VALUES (%s, %s, %s, %s, %s, %s, {at})""", (tid, iid, kind, team, note, actor))
        for g in data["groups"]:
            if g.get("meeting"):
                conn.execute("""UPDATE pilgrim_group SET meeting_name = %s, meeting_lat = %s, meeting_lon = %s
                                WHERE id = %s""", (g["meeting"]["name"], g["meeting"]["lat"], g["meeting"]["lon"],
                                                   gid[g["code"]]))
        # Health readings and places, from pilgrims who agreed; times counted back from now.
        for v in data.get("vitals", []):
            pid = by_place[(v["group_code"], v["pilgrim_index"])]
            conn.execute("""INSERT INTO pilgrim_consent (tenant_id, pilgrim_id, health_at, location_at)
                            VALUES (%s, %s, CASE WHEN %s THEN now() - interval '2 days' END, now() - interval '2 days')""",
                         (tid, pid, v["health"]))
            for r in v["readings"]:
                conn.execute("""INSERT INTO vital_reading (tenant_id, pilgrim_id, at, heart_rate, temperature, source, device)
                                VALUES (%s, %s, now() - make_interval(mins => %s), %s, %s, 'simulated', 'Demo band')""",
                             (tid, pid, r["minutes_ago"], r["heart_rate"], r["temperature"]))
            if v["water_minutes_ago"] is not None and v["health"]:
                conn.execute("INSERT INTO water_log (tenant_id, pilgrim_id, at) VALUES (%s, %s, now() - make_interval(mins => %s))",
                             (tid, pid, v["water_minutes_ago"]))
            pl = v["place"]
            conn.execute("""INSERT INTO pilgrim_location (tenant_id, pilgrim_id, at, lat, lon, accuracy_m, source)
                            VALUES (%s, %s, now() - make_interval(mins => %s), %s, %s, %s, 'simulated')""",
                         (tid, pid, pl["minutes_ago"], pl["lat"], pl["lon"], pl["accuracy_m"]))
    for email, name, role in DEMO_STAFF:
        set_login(op["slug"], email, name, role, DEMO_PASSWORD, must_change=False)
    counts = {"groups": len(data["groups"]), "pilgrims": len(data["pilgrims"]), "flights": len(data["flights"]),
              "shifts": len(data["resources"]), "incidents": len(data["incidents"])}
    print(f"loaded {op['slug']}: {counts['groups']} groups, {counts['pilgrims']} pilgrims, "
          f"{counts['flights']} flights, {counts['shifts']} shifts, {counts['incidents']} incidents")
    return counts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    seed(ap.parse_args().reset)


if __name__ == "__main__":
    main()
