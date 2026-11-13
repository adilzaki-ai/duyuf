from __future__ import annotations

from conftest import as_op
from issue_key import issue


def _group(client, slug, code="U-PK-0001"):
    r = client.post("/v1/groups", headers=as_op(slug), json={
        "code": code, "name": "Lahore Umrah", "kind": "umrah", "season": "1448", "origin_country": "PK"})
    assert r.status_code == 201, r.text
    return r.json()


GOOD = [
    {"full_name": "Imran Khan", "gender": "M", "date_of_birth": "02/03/1950", "nationality": "pk",
     "passport_no": "ab 123 4567", "language": "UR", "needs": "Wheelchair; medical"},
    {"Full_Name": " Ayesha Malik ", "gender": "female", "date_of_birth": "1980-07-01", "nationality": "PK",
     "passport_no": "AB7654321", "phone": "", "needs": ""},
]


def test_a_clean_file_is_checked_then_saved(client, op_a):
    g = _group(client, op_a)
    url = f"/v1/groups/{g['id']}/pilgrims/import"
    dry = client.post(url, headers=as_op(op_a), json={"rows": GOOD, "dry_run": True}).json()
    assert dry == {"rows": 2, "valid": 2, "errors": [], "saved": False}
    assert client.get("/v1/pilgrims", headers=as_op(op_a)).json()["total"] == 0

    done = client.post(url, headers=as_op(op_a), json={"rows": GOOD}).json()
    assert done["saved"] is True
    people = {p["full_name"]: p for p in client.get("/v1/pilgrims", headers=as_op(op_a)).json()["items"]}
    imran = client.get(f"/v1/pilgrims/{people['Imran Khan']['id']}", headers=as_op(op_a)).json()
    assert imran["passport_no"] == "AB1234567" and imran["date_of_birth"] == "1950-03-02"
    assert imran["gender"] == "male" and imran["language"] == "ur" and imran["needs"] == ["wheelchair", "medical"]
    assert imran["history"][0]["note"] == "Imported from a spreadsheet"
    assert people["Ayesha Malik"]["phone"] is None and people["Ayesha Malik"]["needs"] == []

    # the same file again: every passport is already there, and nothing is added
    again = client.post(url, headers=as_op(op_a), json={"rows": GOOD}).json()
    assert again["saved"] is False and again["valid"] == 0
    assert [e["message"] for e in again["errors"]] == ["already registered with this operator"] * 2


def test_one_bad_row_saves_nothing_and_every_problem_is_listed(client, op_a):
    g = _group(client, op_a)
    rows = GOOD + [
        {"full_name": "", "gender": "x", "nationality": "Pakistan", "passport_no": "12", "needs": "wings"},
        {"full_name": "Twin", "gender": "m", "nationality": "PK", "passport_no": "AB1234567",
         "date_of_birth": "31/02/1990"},
    ]
    r = client.post(f"/v1/groups/{g['id']}/pilgrims/import", headers=as_op(op_a), json={"rows": rows}).json()
    assert r["saved"] is False and r["valid"] == 2
    got = {(e["row"], e["field"]): e["message"] for e in r["errors"]}
    assert got[(3, "full_name")] == "required"
    assert got[(3, "gender")] == "male or female (M or F)"
    assert got[(3, "nationality")] == "two letters, like PK"
    assert got[(3, "passport_no")] == "5 to 20 letters and digits"
    assert got[(3, "needs")].startswith("unknown need wings")
    assert got[(4, "date_of_birth")].startswith("a date like")
    assert client.get("/v1/pilgrims", headers=as_op(op_a)).json()["total"] == 0


def test_a_repeat_inside_the_file_is_named(client, op_a):
    g = _group(client, op_a)
    r = client.post(f"/v1/groups/{g['id']}/pilgrims/import", headers=as_op(op_a),
                    json={"rows": [GOOD[0], {**GOOD[0], "full_name": "Copy"}], "dry_run": True}).json()
    assert r["errors"] == [{"row": 2, "field": "passport_no", "message": "same passport as row 1"}]


def test_only_those_who_may_add_pilgrims_import_and_only_into_their_own_groups(client, op_a, op_b):
    g = _group(client, op_a)
    url = f"/v1/groups/{g['id']}/pilgrims/import"
    assert client.post(url, headers=as_op(op_b), json={"rows": GOOD}).status_code == 404
    desk = {"Authorization": f"Bearer {issue(op_a, 'test', principal='desk', role='staff', display_name='Desk')}"}
    assert client.post(url, headers=desk, json={"rows": GOOD}).status_code == 403
    too_many = [{"full_name": "x"}] * 2001
    assert client.post(url, headers=as_op(op_a), json={"rows": too_many}).status_code == 422
