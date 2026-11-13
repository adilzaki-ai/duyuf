"""Write sample/demo.json: the invented operator both halves of Duyuf show.

One file, read by two readers — scripts/seed_demo.py loads it into the demo
operator, and the web app's sample mode (frontend/src/mock) serves it as is.
So the sample on screen and the demo in the database cannot drift apart.

Dates are kept as day offsets from "today" and resolved when read, so the
demo always has groups landing this week. Deterministic: same file every run.

    .venv/bin/python scripts/make_demo_sample.py
"""
from __future__ import annotations

import json
import pathlib
import random

OUT = pathlib.Path(__file__).resolve().parents[2] / "sample" / "demo.json"

# (first name, gender, Arabic or None)
FIRST = {
    "ID": [("Ahmad", "male", None), ("Siti", "female", None), ("Budi", "male", None), ("Dewi", "female", None),
           ("Rizki", "male", None), ("Nur", "female", None), ("Agus", "male", None), ("Fitri", "female", None)],
    "PK": [("Muhammad", "male", None), ("Ayesha", "female", None), ("Imran", "male", None), ("Fatima", "female", None),
           ("Bilal", "male", None), ("Zainab", "female", None), ("Usman", "male", None), ("Sana", "female", None)],
    "IN": [("Mohammed", "male", None), ("Ruksana", "female", None), ("Abdul", "male", None), ("Shabana", "female", None),
           ("Irfan", "male", None), ("Nasreen", "female", None), ("Salim", "male", None), ("Farzana", "female", None)],
    "EG": [("Mahmoud", "male", "محمود"), ("Mona", "female", "منى"), ("Mostafa", "male", "مصطفى"),
           ("Heba", "female", "هبة"), ("Ahmed", "male", "أحمد"), ("Nadia", "female", "نادية")],
    "JO": [("Khaled", "male", "خالد"), ("Rania", "female", "رانيا"), ("Omar", "male", "عمر"),
           ("Lina", "female", "لينا"), ("Yazan", "male", "يزن"), ("Huda", "female", "هدى")],
    "TR": [("Mehmet", "male", None), ("Ayşe", "female", None), ("Mustafa", "male", None), ("Zeynep", "female", None),
           ("Hasan", "male", None), ("Emine", "female", None)],
    "MY": [("Azman", "male", None), ("Nurul", "female", None), ("Hafiz", "male", None), ("Farah", "female", None)],
    "NG": [("Abubakar", "male", None), ("Hauwa", "female", None), ("Musa", "male", None), ("Aisha", "female", None),
           ("Ibrahim", "male", None), ("Zainab", "female", None)],
    "BD": [("Kamal", "male", None), ("Rahima", "female", None), ("Abdur", "male", None), ("Nasrin", "female", None)],
    "GB": [("Yusuf", "male", None), ("Hannah", "female", None), ("Adam", "male", None), ("Sarah", "female", None),
           ("Idris", "male", None), ("Maryam", "female", None)],
}
LAST = {
    "ID": [("Santoso", None), ("Wijaya", None), ("Hidayat", None), ("Saputra", None), ("Lestari", None)],
    "PK": [("Khan", None), ("Malik", None), ("Qureshi", None), ("Chaudhry", None), ("Shah", None)],
    "IN": [("Ansari", None), ("Shaikh", None), ("Siddiqui", None), ("Qadri", None), ("Pathan", None)],
    "EG": [("Hassan", "حسن"), ("Mansour", "منصور"), ("Farouk", "فاروق"), ("Abdelrahman", "عبد الرحمن")],
    "JO": [("Al-Masri", "المصري"), ("Haddad", "حداد"), ("Al-Khatib", "الخطيب"), ("Odeh", "عودة")],
    "TR": [("Yılmaz", None), ("Kaya", None), ("Demir", None), ("Şahin", None)],
    "MY": [("Ismail", None), ("Abdullah", None), ("Rahman", None)],
    "NG": [("Bello", None), ("Abdullahi", None), ("Sani", None), ("Usman", None)],
    "BD": [("Hossain", None), ("Islam", None), ("Uddin", None), ("Akter", None)],
    "GB": [("Patel", None), ("Hussain", None), ("Ali", None), ("Begum", None)],
}

# code, name, kind, season, country, arrive (days from today), depart, size, stage
GROUPS = [
    ("U-MY-0221", "Kuala Lumpur Umrah — early", "umrah", "1448", "MY", -16, -2, 22, "departed"),
    ("U-ID-0412", "Jakarta Umrah", "umrah", "1448", "ID", -10, 2, 40, "in_madinah"),
    ("U-GB-0044", "London Umrah", "umrah", "1448", "GB", -6, 1, 18, "in_madinah"),
    ("U-PK-0318", "Lahore Umrah", "umrah", "1448", "PK", -4, 10, 36, "in_makkah"),
    ("U-EG-0207", "Cairo Umrah", "umrah", "1448", "EG", 1, 15, 30, "visa_issued"),
    ("U-TR-0155", "Istanbul Umrah", "umrah", "1448", "TR", 3, 12, 26, "visa_issued"),
    ("U-NG-0090", "Kano Umrah", "umrah", "1448", "NG", 6, 20, 28, "visa_mixed"),
    ("U-BD-0310", "Dhaka Umrah", "umrah", "1448", "BD", 12, 26, 24, "registered"),
    ("H-ID-0001", "Surabaya Hajj", "hajj", "1448", "ID", 182, 222, 45, "registered"),
    ("H-PK-0007", "Karachi Hajj", "hajj", "1448", "PK", 185, 220, 40, "registered"),
    ("H-IN-0012", "Hyderabad Hajj", "hajj", "1448", "IN", 184, 224, 38, "registered"),
    ("H-JO-0003", "Amman Hajj", "hajj", "1448", "JO", 190, 212, 25, "registered"),
    # Added for the arrivals board, at the end so the people above stay the same:
    # groups landing in the next two days, on the flights below.
    ("U-PK-0322", "Karachi Umrah", "umrah", "1448", "PK", 0, 14, 48, "visa_issued"),
    ("U-ID-0430", "Makassar Umrah", "umrah", "1448", "ID", 1, 13, 44, "visa_issued"),
    ("U-IN-0118", "Hyderabad Umrah", "umrah", "1448", "IN", 2, 16, 34, "visa_issued"),
    ("U-NG-0095", "Abuja Umrah", "umrah", "1448", "NG", 2, 17, 26, "visa_mixed"),
]

# The language each pilgrim speaks, by passport country (ISO 639-1). Nigeria
# alternates Hausa and English by position, so no random draw is spent on it.
LANGUAGE = {"ID": "id", "PK": "ur", "IN": "ur", "EG": "ar", "JO": "ar", "TR": "tr",
            "MY": "ms", "NG": "ha", "BD": "bn", "GB": "en"}

# Invented flights, on real airline codes. number, from, to, day (from today),
# Saudi time, minutes late, and which pilgrims: (group, first, last) by position.
# Spread through the day so a board opened at any hour has flights on it.
FLIGHTS = [
    ("PK 743", "KHI", "JED", 0, "05:40", 0, [("U-PK-0322", 0, 24)]),
    ("SV 705", "KHI", "JED", 0, "21:15", 0, [("U-PK-0322", 24, 48)]),
    ("MS 683", "CAI", "JED", 1, "04:10", 0, [("U-EG-0207", 0, 30)]),
    ("GA 980", "UPG", "MED", 1, "09:25", 95, [("U-ID-0430", 0, 44)]),
    ("6E 63", "HYD", "JED", 2, "02:50", 0, [("U-IN-0118", 0, 34)]),
    ("SV 3304", "ABV", "MED", 2, "13:05", 0, [("U-NG-0095", 0, 26)]),
    ("TK 92", "IST", "MED", 3, "07:00", 20, [("U-TR-0155", 0, 26)]),
]

# What the operator has on shift: airport, kind, language, how many, from and to
# (days from today, at midnight Saudi time). Jeddah is covered; Madinah is short
# of wheelchairs and has no Hausa or Turkish interpreter, so the board shows gaps.
RESOURCES = [
    ("JED", "wheelchair", None, 6, -1, 8),
    ("JED", "bus", None, 2, -1, 8),
    ("JED", "interpreter", "ur", 1, -1, 8),
    ("MED", "wheelchair", None, 3, -1, 8),
    ("MED", "bus", None, 1, -1, 8),
    ("MED", "interpreter", "id", 1, -1, 8),
]

# Incidents, timed in minutes before now: kind, priority, group, pilgrim (position
# in the group, or None for the whole group), where, what, raised by, opened,
# then minutes after opening when assigned (and to whom) and resolved (and how).
# Only pilgrims in the Kingdom: position 3 in each group there went home early.
INCIDENTS = [
    ("sos", "urgent", "U-PK-0318", 5, "Al-Haram, gate 79", "Pressed SOS. Not answering the phone.",
     "Group leader", 6, None, None, None, None),
    ("lost", "high", "U-ID-0412", 12, "Prophet's Mosque, door 21",
     "Separated from the group after Isha. Speaks Indonesian only.", "Group leader", 28, 4,
     "Madinah field team", None, None),
    ("heat", "high", "U-PK-0318", 20, "Ajyad street", "Dizzy and very hot after tawaf.",
     "Hotel desk", 41, None, None, None, None),
    ("medical", "normal", "U-GB-0044", 2, "Hotel, room 512", "Needs insulin kept cold.",
     "Group leader", 190, 9, "Hotel desk", 75, "Fridge in the room arranged with the hotel."),
    ("transport", "normal", "U-PK-0318", None, "Hotel entrance", "Bus for the Ziyarat tour did not come at 08:00.",
     "Group leader", 1500, 12, "Transport desk", 55, "Replacement bus sent; left at 09:10."),
    ("lost", "urgent", "U-ID-0412", 30, "Quba Mosque", "Elderly pilgrim did not come back to the bus.",
     "Bus driver", 2900, 6, "Madinah field team", 48, "Found at the mosque clinic; back at the hotel."),
]

PATH = ["registered", "visa_issued", "arrived", "in_makkah", "in_madinah", "departed"]


def history(steps: list[str], arrive: int, depart: int, early_exit: bool = False) -> list[dict]:
    """Day offsets (from today) for each step taken. Nothing lands in the future."""
    mid = arrive + max(1, (depart - arrive) // 2)
    # Hajj groups sign up months ahead; their registration is still in the past.
    day = {"registered": min(arrive - 45, -12), "visa_issued": arrive - 14, "arrived": arrive,
           "in_makkah": arrive, "in_madinah": mid, "departed": -1 if early_exit else depart}
    hour = {"registered": 10, "visa_issued": 13, "arrived": 6, "in_makkah": 11, "in_madinah": 16, "departed": 9}
    out, prev = [], None
    for s in steps:
        out.append({"from": prev, "to": s, "day": min(day[s], 0), "hour": hour[s]})
        prev = s
    return out


def main() -> None:
    rng = random.Random(1448)
    groups, pilgrims, seen = [], [], set()
    for code, name, kind, season, cc, arrive, depart, size, stage in GROUPS:
        leader_first, _, _ = rng.choice([f for f in FIRST[cc] if f[1] == "male"])
        leader_last, _ = rng.choice(LAST[cc])
        groups.append({"code": code, "name": name, "kind": kind, "season": season, "origin_country": cc,
                       "arrive_in_days": arrive, "depart_in_days": depart,
                       "leader_name": f"{leader_first} {leader_last}",
                       "leader_phone": f"+966 55 {code[-4:-2]}0 {code[-2:]}{rng.randint(10, 99)}"})
        for i in range(size):
            first, gender, first_ar = rng.choice(FIRST[cc])
            last, last_ar = rng.choice(LAST[cc])
            age = rng.choice([rng.randint(28, 55), rng.randint(45, 68), rng.randint(60, 82)])
            born = f"{2026 - age}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"
            while True:
                passport = f"{chr(65 + rng.randint(0, 25))}{rng.randint(1000000, 9999999)}"
                if (cc, passport) not in seen:
                    seen.add((cc, passport))
                    break
            needs = []
            if age >= 70:
                needs.append("elderly")
            if rng.random() < (0.25 if age >= 70 else 0.03):
                needs.append("wheelchair")
            if rng.random() < 0.06:
                needs.append("medical")
            if rng.random() < 0.03:
                needs.append("dietary")
            status = {"visa_mixed": "visa_issued" if i % 3 else "registered"}.get(stage, stage)
            # One still applying in a group whose visas are out, and one sent
            # home early from each group already in the Kingdom.
            if stage == "visa_issued" and i == size - 1:
                status = "registered"
            steps = PATH[: PATH.index(status) + 1]
            early = stage in ("in_makkah", "in_madinah") and i == 3
            if early:
                status = "departed"
                steps = PATH[: PATH.index(stage) + 1] + ["departed"]
            hist = history(steps, arrive, depart, early_exit=early)
            flight = next((f[0] for f in FLIGHTS for g, a, b in f[6] if g == code and a <= i < b), None)
            pilgrims.append({
                "group_code": code, "full_name": f"{first} {last}",
                "full_name_ar": f"{first_ar} {last_ar}" if first_ar and last_ar else None,
                "gender": gender, "date_of_birth": born, "nationality": cc, "passport_no": passport,
                "phone": None, "status": status, "needs": needs, "history": hist,
                "language": "en" if cc == "NG" and i % 3 == 0 else LANGUAGE[cc], "flight": flight,
            })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "operator": {"slug": "duyuf-demo", "name": "Duyuf (demonstration)", "name_ar": "ضيوف (عرض توضيحي)"},
        "note": "Invented people. Passport numbers, names and phones are made up.",
        "groups": groups, "pilgrims": pilgrims,
        "flights": [{"number": n, "origin_airport": o, "arrival_airport": a, "day": d, "time": t,
                     "delay_minutes": late} for n, o, a, d, t, late, _ in FLIGHTS],
        "resources": [{"airport": a, "kind": k, "language": lang, "quantity": q, "from_day": f, "to_day": t}
                      for a, k, lang, q, f, t in RESOURCES],
        "incidents": [{"kind": k, "priority": pr, "group_code": g, "pilgrim_index": i, "location": loc,
                       "description": d, "reported_by": by, "minutes_ago": ago, "assigned_after": aa,
                       "team": team, "resolved_after": ra, "resolution": res}
                      for k, pr, g, i, loc, d, by, ago, aa, team, ra, res in INCIDENTS],
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} — {len(groups)} groups, {len(pilgrims)} pilgrims, {len(FLIGHTS)} flights, {len(RESOURCES)} shifts, {len(INCIDENTS)} incidents")


if __name__ == "__main__":
    main()
