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
            pilgrims.append({
                "group_code": code, "full_name": f"{first} {last}",
                "full_name_ar": f"{first_ar} {last_ar}" if first_ar and last_ar else None,
                "gender": gender, "date_of_birth": born, "nationality": cc, "passport_no": passport,
                "phone": None, "status": status, "needs": needs, "history": hist,
            })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "operator": {"slug": "duyuf-demo", "name": "Duyuf (demonstration)", "name_ar": "ضيوف (عرض توضيحي)"},
        "note": "Invented people. Passport numbers, names and phones are made up.",
        "groups": groups, "pilgrims": pilgrims,
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} — {len(groups)} groups, {len(pilgrims)} pilgrims")


if __name__ == "__main__":
    main()
