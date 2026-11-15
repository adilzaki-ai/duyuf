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
# The terminal and gate are invented; the last flight has none yet, as often
# happens three days out.
FLIGHTS = [
    ("PK 743", "KHI", "JED", 0, "05:40", 0, [("U-PK-0322", 0, 24)], "Hajj Terminal", "H4"),
    ("SV 705", "KHI", "JED", 0, "21:15", 0, [("U-PK-0322", 24, 48)], "Terminal 1", "A21"),
    ("MS 683", "CAI", "JED", 1, "04:10", 0, [("U-EG-0207", 0, 30)], "Hajj Terminal", "H9"),
    ("GA 980", "UPG", "MED", 1, "09:25", 95, [("U-ID-0430", 0, 44)], "Main Terminal", "6"),
    ("6E 63", "HYD", "JED", 2, "02:50", 0, [("U-IN-0118", 0, 34)], "Hajj Terminal", "H2"),
    ("SV 3304", "ABV", "MED", 2, "13:05", 0, [("U-NG-0095", 0, 26)], "Main Terminal", "3"),
    ("TK 92", "IST", "MED", 3, "07:00", 20, [("U-TR-0155", 0, 26)], None, None),
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

# Pilgrims sharing health readings and their place on Rafeeq (they agreed):
# group, position, how the last hour looked, minutes since they last drank,
# and the city they are in. A pattern of None shares the place only.
# Invented readings, labelled as the demonstration on every screen.
VITALS = [
    ("U-ID-0412", 0, "fever", 140, "MED"),
    ("U-ID-0412", 1, "normal", 30, "MED"),
    ("U-ID-0412", 2, "strained", 115, "MED"),
    ("U-ID-0412", 4, "normal", 50, "MED"),
    ("U-GB-0044", 0, "fast_heart", 40, "MED"),
    ("U-GB-0044", 1, "normal", 20, "MED"),
    ("U-PK-0318", 0, "fever", 70, "MKK"),
    ("U-PK-0318", 1, "normal", 60, "MKK"),
    ("U-PK-0318", 2, "no_signal", 200, "MKK"),
    ("U-PK-0318", 4, None, None, "MKK"),
]
# heart rate and temperature ranges per pattern, and how long ago the last reading was
PATTERNS = {
    "normal": ((72, 88), (36.6, 37.0), 0),
    "fever": ((96, 104), (38.3, 38.6), 0),
    "fast_heart": ((124, 130), (36.9, 37.2), 0),
    "strained": ((112, 118), (37.8, 37.95), 0),
    "no_signal": ((78, 84), (36.7, 36.9), 45),
}
PLACES = {"MED": (24.4672, 39.6112), "MKK": (21.4225, 39.8262)}
# Where three groups gather. Invented places near the two mosques, approximate.
MEETING = {
    "U-ID-0412": ("Hotel lobby, Al-Salam street", 24.4689, 39.6081),
    "U-GB-0044": ("Gate 21, Prophet's Mosque", 24.4686, 39.6128),
    "U-PK-0318": ("King Abdulaziz Gate", 21.4219, 39.8247),
}


def vitals(rng: random.Random) -> list[dict]:
    out = []
    for code, i, pattern, water, city in VITALS:
        lat, lon = PLACES[city]
        place = {"lat": round(lat + rng.uniform(-0.004, 0.004), 5), "lon": round(lon + rng.uniform(-0.004, 0.004), 5),
                 "accuracy_m": rng.choice([8, 12, 20, 35]), "minutes_ago": rng.randint(1, 6)}
        readings = []
        if pattern:
            (h0, h1), (c0, c1), late = PATTERNS[pattern]
            readings = [{"minutes_ago": late + m, "heart_rate": rng.randint(h0, h1),
                         "temperature": round(rng.uniform(c0, c1), 1)} for m in range(60, -1, -5)]
        out.append({"group_code": code, "pilgrim_index": i, "pattern": pattern, "health": pattern is not None,
                    "water_minutes_ago": water, "readings": readings, "place": place})
    return out


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


def visa_ends(status: str, kind: str, arrive: int, depart: int, i: int) -> int | None:
    """Days from today to the last day of the visa; None before it is issued. An Umrah visa runs
    90 days from issue (issued two weeks before arrival here); a Hajj visa a little past departure.
    One pilgrim in each group already in the Kingdom has a visa that ends before the group leaves,
    so staff and Rafeeq both have the case to show."""
    if status == "registered":
        return None
    if status in ("in_makkah", "in_madinah") and i == 7:
        return depart - 2
    return depart + 10 if kind == "hajj" else arrive - 14 + 90


# Flights home, leg by leg: number, from, to, days from today (the group's departure day),
# leaves (Saudi time), minutes in the air. Invented numbers on real airline codes, like FLIGHTS.
RETURN_LEGS = {
    "U-ID-0412": [("SV 1466", "MED", "JED", "08:10", 70), ("SV 818", "JED", "CGK", "13:40", 600)],
    "U-GB-0044": [("SV 1472", "MED", "JED", "06:30", 70), ("SV 113", "JED", "LHR", "12:15", 400)],
    "U-PK-0318": [("PK 744", "JED", "KHI", "15:20", 195), ("PK 302", "KHI", "LHE", "21:00", 105)],
    "U-EG-0207": [("MS 684", "JED", "CAI", "06:15", 140)],
    "U-TR-0155": [("TK 93", "MED", "IST", "09:00", 225)],
    "U-NG-0090": [("SV 3307", "JED", "KAN", "14:20", 320)],
    "U-BD-0310": [("BG 136", "JED", "DAC", "18:10", 330)],
    "U-PK-0322": [("SV 704", "JED", "KHI", "22:30", 190)],
    "U-ID-0430": [("GA 981", "MED", "UPG", "11:40", 600)],
    "U-IN-0118": [("6E 64", "JED", "HYD", "04:20", 270)],
    "U-NG-0095": [("SV 3305", "MED", "ABV", "15:00", 330)],
}

# Places to stay, eat and visit. INVENTED names and ratings (rating_source "Sample"):
# the real list is the operator's own, with ratings from a named source.
# kind, city, name, name_ar, stars, price level (1 simple … 4 upscale), cuisine, rating, count,
# SAR from (a night / a person), metres north and east of the main mosque.
VENUES = [
    ("hotel", "makkah", "Qiblah Tower Hotel", "فندق برج القبلة", 5, None, None, 4.7, 3120, 1450, 250, -120),
    ("hotel", "makkah", "Ajyad Palace Suites", "أجنحة قصر أجياد", 5, None, None, 4.6, 2210, 1180, -380, -60),
    ("hotel", "makkah", "Misfalah Grand", "مسفلة جراند", 4, None, None, 4.3, 1780, 620, -900, -300),
    ("hotel", "makkah", "Ibrahim Khalil Inn", "نزل إبراهيم الخليل", 4, None, None, 4.1, 950, 480, -1300, -500),
    ("hotel", "makkah", "Kudai Stay", "إقامة كدي", 3, None, None, 4.0, 1320, 290, -2600, 300),
    ("hotel", "makkah", "Shubaika Rooms", "غرف الشبيكة", 3, None, None, 3.8, 640, 240, 500, -700),
    ("hotel", "makkah", "Aziziyah Family Lodge", "نزل العزيزية العائلي", 2, None, None, 3.9, 410, 160, -1200, 3900),
    ("hotel", "makkah", "Pilgrim Rest House", "دار راحة الحاج", 2, None, None, 3.6, 520, 120, 1800, 1500),
    ("hotel", "madinah", "Rawdah Gardens Hotel", "فندق حدائق الروضة", 5, None, None, 4.8, 2890, 1300, 300, 150),
    ("hotel", "madinah", "Quba Royal Residence", "مقر قباء الملكي", 5, None, None, 4.5, 1450, 980, -420, 60),
    ("hotel", "madinah", "Al Salam Avenue Hotel", "فندق جادة السلام", 4, None, None, 4.4, 1610, 540, 150, -350),
    ("hotel", "madinah", "Bab Jibril Suites", "أجنحة باب جبريل", 4, None, None, 4.2, 870, 450, -100, 380),
    ("hotel", "madinah", "Markaziyah Comfort", "راحة المركزية", 3, None, None, 4.0, 990, 260, 650, -200),
    ("hotel", "madinah", "Sultanah Inn", "نزل السلطانة", 3, None, None, 3.9, 510, 210, -900, -1200),
    ("hotel", "madinah", "Uhud View Lodge", "نزل إطلالة أحد", 2, None, None, 3.8, 330, 140, 2900, 200),
    ("hotel", "madinah", "Anbariyah Rooms", "غرف العنبرية", 2, None, None, 3.5, 290, 110, -500, -1300),
    ("restaurant", "makkah", "Clock View Grill", "مشويات إطلالة الساعة", None, 4, "Arabic grill", 4.6, 1840, 220, 280, -150),
    ("restaurant", "makkah", "Saffron Terrace", "شرفة الزعفران", None, 3, "Indian", 4.4, 1210, 110, -400, -80),
    ("restaurant", "makkah", "Bukhari House", "بيت البخاري", None, 2, "Saudi rice dishes", 4.5, 2630, 55, -950, -250),
    ("restaurant", "makkah", "Mandi Corner", "ركن المندي", None, 1, "Yemeni mandi", 4.3, 3110, 30, -1250, -450),
    ("restaurant", "makkah", "Istanbul Kebab Hall", "صالة كباب إسطنبول", None, 2, "Turkish", 4.2, 870, 60, 450, -650),
    ("restaurant", "makkah", "Nusantara Kitchen", "مطبخ نوسانتارا", None, 2, "Indonesian", 4.1, 640, 45, -2500, 350),
    ("restaurant", "makkah", "Lahore Karahi Point", "كراهي لاهور", None, 1, "Pakistani", 4.0, 1980, 25, -1100, 3800),
    ("restaurant", "makkah", "Date Palm Café", "مقهى النخلة", None, 1, "Café", 4.2, 760, 20, 200, 120),
    ("restaurant", "madinah", "Manakha Fine Dining", "مطعم المناخة الراقي", None, 4, "International", 4.6, 1320, 240, 280, -180),
    ("restaurant", "madinah", "Quba Garden Restaurant", "مطعم حديقة قباء", None, 3, "Arabic", 4.5, 1040, 95, -2900, 120),
    ("restaurant", "madinah", "Madinah Dates & Coffee", "تمور وقهوة المدينة", None, 1, "Café", 4.4, 2210, 20, 120, 260),
    ("restaurant", "madinah", "Kabsa Majlis", "مجلس الكبسة", None, 2, "Saudi", 4.3, 1760, 50, 600, -250),
    ("restaurant", "madinah", "Cairo Koshary", "كشري القاهرة", None, 1, "Egyptian", 4.0, 690, 22, -800, -1100),
    ("restaurant", "madinah", "Jakarta Rasa", "جاكرتا رسا", None, 2, "Indonesian", 4.2, 930, 40, 180, -420),
    ("restaurant", "madinah", "Anatolia Grill", "مشويات الأناضول", None, 2, "Turkish", 4.3, 1150, 65, -150, 420),
    ("restaurant", "madinah", "Biryani Darbar", "برياني دربار", None, 1, "Pakistani and Indian", 4.1, 1580, 25, -450, -950),
]

# Attractions that take a booking (through the operator), by the Rafeeq guide's place id.
ATTRACTIONS = [
    ("makkah", "hira_district", "Hira Cultural District", "حي حراء الثقافي", 21.4548, 39.8597),
    ("makkah", "architecture", "Two Holy Mosques Architecture Exhibition", "معرض عمارة الحرمين الشريفين", 21.4346, 39.7547),
    ("makkah", "kiswa", "Kiswa Factory visit", "زيارة مجمع كسوة الكعبة", 21.4348, 39.7564),
    ("madinah", "dar_madinah", "Dar Al Madinah Museum", "متحف دار المدينة", 24.4766, 39.6876),
    ("madinah", "seerah", "Museum of the Prophet's Life", "المتحف الدولي للسيرة النبوية", 24.4658, 39.6094),
    ("madinah", "hejaz_railway", "Hejaz Railway Museum", "متحف سكة حديد الحجاز", 24.4617, 39.6002),
    ("madinah", "quran_complex", "King Fahd Quran Printing Complex tour", "جولة في مجمع الملك فهد لطباعة المصحف", 24.5164, 39.5414),
]

# A few requests waiting in the staff app: group, pilgrim index, place name, days ahead, time,
# nights, people, status, SAR (asked or agreed), note from the pilgrim.
BOOKINGS = [
    ("U-ID-0412", 0, "Jakarta Rasa", 0, "20:30", None, 4, "requested", None, "Table for my family, please."),
    ("U-ID-0412", 4, "Rawdah Gardens Hotel", 1, None, 1, 2, "awaiting_payment", 1300, None),
    ("U-GB-0044", 2, "Museum of the Prophet's Life", 0, "16:00", None, 3, "confirmed", 0, None),
    ("U-PK-0318", 1, "Bukhari House", 0, "13:30", None, 6, "requested", None, "Two of us use wheelchairs."),
    ("U-PK-0318", 5, "Kiswa Factory visit", 3, None, None, 10, "requested", None, "Our whole group, if possible."),
]

# The room asked for, for the hotel bookings above (by position).
BOOKING_ROOMS = {
    1: {"rooms": 1, "room_type": "double", "bed": "king", "access_needs": ["wheelchair_room", "roll_in_shower", "near_elevator"],
        "extras": ["breakfast", "mosque_view"]},
}

MOSQUE = {"makkah": (21.4225, 39.8262), "madinah": (24.4672, 39.6111)}

# What the sample hotels offer, by their stars: room types, and help for a disability or old age.
ROOMS_BY_STARS = {
    5: ["single", "double", "twin", "triple", "quad", "family", "suite"],
    4: ["single", "double", "twin", "triple", "quad", "family"],
    3: ["double", "twin", "triple", "quad"],
    2: ["double", "triple", "quad"],
}
ACCESS_BY_STARS = {
    5: ["wheelchair_room", "roll_in_shower", "grab_bars", "near_elevator", "low_floor", "wheelchair_loan", "carer_bed",
        "visual_aids", "hearing_aids"],
    4: ["wheelchair_room", "grab_bars", "near_elevator", "low_floor", "wheelchair_loan", "carer_bed"],
    3: ["grab_bars", "near_elevator", "wheelchair_loan"],
    2: ["near_elevator"],
}


def venues() -> list[dict]:
    out = []
    for kind, city, name, name_ar, stars, price, cuisine, rating, count, price_from, north, east in VENUES:
        lat0, lon0 = MOSQUE[city]
        out.append({"kind": kind, "city": city, "name": name, "name_ar": name_ar, "stars": stars, "price_level": price,
                    "cuisine": cuisine, "rating": rating, "rating_count": count, "rating_source": "Sample",
                    "price_from": price_from, "site_id": None,
                    "room_types": ROOMS_BY_STARS[stars] if kind == "hotel" else [],
                    "accessibility": ACCESS_BY_STARS[stars] if kind == "hotel" else [],
                    "lat": round(lat0 + north / 111_000, 5), "lon": round(lon0 + east / 101_000, 5)})
    for city, site, name, name_ar, lat, lon in ATTRACTIONS:
        out.append({"kind": "attraction", "city": city, "name": name, "name_ar": name_ar, "stars": None,
                    "price_level": None, "cuisine": None, "rating": None, "rating_count": None, "rating_source": None,
                    "price_from": None, "site_id": site, "lat": lat, "lon": lon, "room_types": [], "accessibility": []})
    return out


# The roster: invented people who can cover shifts. Name, Arabic name, roles, languages they interpret, airports.
# No Hausa speaker on purpose: the demo shows a gap nobody on the roster can cover. Phones are invented
# (+966 50 0000 1NN); the demo never opens them.
WORKERS = [
    ("Amina Raza", "أمينة رضا", ["interpreter"], ["ur", "en"], ["JED"]),
    ("Bilal Qureshi", "بلال قريشي", ["interpreter"], ["ur"], ["JED"]),
    ("Sana Iqbal", "سناء إقبال", ["interpreter"], ["ur", "en"], ["JED", "MED"]),
    ("Siti Rahma", "سيتي رحمة", ["interpreter"], ["id", "ms"], ["MED"]),
    ("Dewi Lestari", "ديوي ليستاري", ["interpreter"], ["id"], ["MED", "JED"]),
    ("Emre Yildiz", "أمره يلدز", ["interpreter"], ["tr", "en"], ["MED"]),
    ("Karim Mansour", "كريم منصور", ["wheelchair"], [], ["JED"]),
    ("Dalia Saleh", "داليا صالح", ["wheelchair"], [], ["JED"]),
    ("Faisal Otaibi", "فيصل العتيبي", ["wheelchair"], [], ["JED"]),
    ("Yusuf Kareem", "يوسف كريم", ["wheelchair"], [], ["MED"]),
    ("Khalid Harbi", "خالد الحربي", ["wheelchair"], [], ["MED"]),
    ("Fatimah Zahrani", "فاطمة الزهراني", ["wheelchair"], [], ["MED"]),
    ("Omar Faruk", "عمر فاروق", ["wheelchair", "bus"], [], ["MED"]),
    ("Hamid Ali", "حامد علي", ["bus"], [], ["JED"]),
    ("Nasser Qahtani", "ناصر القحطاني", ["bus"], [], ["MED", "JED"]),
]


def main() -> None:
    rng = random.Random(1448)
    groups, pilgrims, seen = [], [], set()
    for code, name, kind, season, cc, arrive, depart, size, stage in GROUPS:
        leader_first, _, _ = rng.choice([f for f in FIRST[cc] if f[1] == "male"])
        leader_last, _ = rng.choice(LAST[cc])
        groups.append({"code": code, "name": name, "kind": kind, "season": season, "origin_country": cc,
                       "arrive_in_days": arrive, "depart_in_days": depart,
                       "leader_name": f"{leader_first} {leader_last}",
                       "leader_phone": f"+966 55 {code[-4:-2]}0 {code[-2:]}{rng.randint(10, 99)}",
                       "meeting": dict(zip(("name", "lat", "lon"), MEETING[code])) if code in MEETING else None})
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
            visa = visa_ends(status if status != "departed" else stage, kind, arrive, depart, i)
            flight = next((f[0] for f in FLIGHTS for g, a, b in f[6] if g == code and a <= i < b), None)
            pilgrims.append({
                "group_code": code, "full_name": f"{first} {last}",
                "full_name_ar": f"{first_ar} {last_ar}" if first_ar and last_ar else None,
                "gender": gender, "date_of_birth": born, "nationality": cc, "passport_no": passport,
                "phone": None, "status": status, "needs": needs, "history": hist,
                "language": "en" if cc == "NG" and i % 3 == 0 else LANGUAGE[cc], "flight": flight,
                "visa_ends_in_days": visa,
            })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "operator": {"slug": "duyuf-demo", "name": "Duyuf (demonstration)", "name_ar": "ضيوف (عرض توضيحي)"},
        "note": "Invented people. Passport numbers, names and phones are made up.",
        "groups": groups, "pilgrims": pilgrims,
        "flights": [{"number": n, "origin_airport": o, "arrival_airport": a, "day": d, "time": t,
                     "delay_minutes": late, "terminal": term, "gate": gate}
                    for n, o, a, d, t, late, _, term, gate in FLIGHTS],
        "resources": [{"airport": a, "kind": k, "language": lang, "quantity": q, "from_day": f, "to_day": t}
                      for a, k, lang, q, f, t in RESOURCES],
        "incidents": [{"kind": k, "priority": pr, "group_code": g, "pilgrim_index": i, "location": loc,
                       "description": d, "reported_by": by, "minutes_ago": ago, "assigned_after": aa,
                       "team": team, "resolved_after": ra, "resolution": res}
                      for k, pr, g, i, loc, d, by, ago, aa, team, ra, res in INCIDENTS],
        "vitals": vitals(random.Random(1449)),
        "return_legs": {code: [dict(zip(("flight_number", "from_airport", "to_airport", "time", "minutes"), leg))
                               for leg in legs] for code, legs in RETURN_LEGS.items()},
        "venues": venues(),
        "workers": [{"name": n, "name_ar": a, "phone": f"+966 50 0000 1{i:02d}", "roles": r, "languages": l,
                     "airports": ap} for i, (n, a, r, l, ap) in enumerate(WORKERS)],
        "bookings": [{**dict(zip(("group_code", "pilgrim_index", "venue", "days_ahead", "time", "nights", "people",
                                  "status", "amount", "note"), b)), **BOOKING_ROOMS.get(i, {})}
                     for i, b in enumerate(BOOKINGS)],
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} — {len(groups)} groups, {len(pilgrims)} pilgrims, {len(FLIGHTS)} flights, {len(RESOURCES)} shifts, {len(INCIDENTS)} incidents")


if __name__ == "__main__":
    main()
