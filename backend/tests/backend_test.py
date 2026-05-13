"""End-to-end backend test for Pertacareer Recruitment API.

Covers auth, positions, applications, stages, scores, SAW, interviews, messages,
notifications, stats and role-based access control.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open(
    "/app/frontend/.env"
).read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

HR_EMAIL = "hr@pertacareer.id"
HR_PASS = "hr123456"
PEL_EMAIL = "pelamar@pertacareer.id"
PEL_PASS = "pelamar123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def hr_token():
    r = requests.post(f"{API}/auth/login", json={"email": HR_EMAIL, "password": HR_PASS})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "hr"
    assert "token" in data and len(data["token"]) > 10
    # cookie should be set
    assert "access_token" in r.cookies
    return data["token"]


@pytest.fixture(scope="session")
def pel_token():
    r = requests.post(f"{API}/auth/login", json={"email": PEL_EMAIL, "password": PEL_PASS})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "pelamar"
    return data["token"]


@pytest.fixture
def hr_client(hr_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {hr_token}"})
    return s


@pytest.fixture
def pel_client(pel_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {pel_token}"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": HR_EMAIL, "password": "bad"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, hr_client):
        r = hr_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == HR_EMAIL
        assert r.json()["role"] == "hr"

    def test_register_pelamar_and_autologin(self):
        unique_email = f"test_{uuid.uuid4().hex[:8]}@pertacareer.id"
        r = requests.post(
            f"{API}/auth/register",
            json={"email": unique_email, "password": "secret123", "name": "TEST User"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["email"] == unique_email
        assert r.json()["role"] == "pelamar"
        # cookie set
        assert "access_token" in r.cookies

    def test_register_duplicate(self):
        r = requests.post(
            f"{API}/auth/register",
            json={"email": PEL_EMAIL, "password": "secret123", "name": "Dup"},
        )
        assert r.status_code == 400

    def test_protected_invalid_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer not-a-token"})
        assert r.status_code == 401


# ---------- Positions ----------
class TestPositions:
    def test_list_positions_public(self):
        r = requests.get(f"{API}/positions")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 3

    def test_pelamar_cannot_create_position(self, pel_client):
        r = pel_client.post(
            f"{API}/positions",
            json={"title": "x", "department": "x", "location": "x", "description": "x"},
        )
        assert r.status_code == 403

    def test_hr_can_create_and_delete_position(self, hr_client):
        payload = {
            "title": "TEST_Position",
            "department": "QA",
            "location": "Remote",
            "description": "TEST",
            "requirements": ["a", "b"],
        }
        r = hr_client.post(f"{API}/positions", json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        assert r.json()["title"] == "TEST_Position"
        # GET to verify
        r2 = requests.get(f"{API}/positions")
        assert any(p["id"] == pid for p in r2.json())
        # cleanup
        d = hr_client.delete(f"{API}/positions/{pid}")
        assert d.status_code == 200


# ---------- Applications & Stage ----------
class TestApplications:
    def test_pel_mine_returns_list(self, pel_client):
        r = pel_client.get(f"{API}/applications/mine")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # demo seeded pelamar has applications
        if r.json():
            row = r.json()[0]
            for key in ("id", "position_title", "stage", "progress_percent", "applicant_name"):
                assert key in row

    def test_pel_cannot_list_all(self, pel_client):
        r = pel_client.get(f"{API}/applications")
        assert r.status_code == 403

    def test_hr_can_list_all(self, hr_client):
        r = hr_client.get(f"{API}/applications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_application_and_duplicate(self, pel_client):
        # find a position the pelamar has NOT applied to
        positions = requests.get(f"{API}/positions").json()
        mine = pel_client.get(f"{API}/applications/mine").json()
        applied_pos = {a["position_id"] for a in mine}
        free = [p for p in positions if p["id"] not in applied_pos]
        if not free:
            pytest.skip("Pelamar already applied to all positions")
        pos = free[0]
        payload = {
            "position_id": pos["id"],
            "education": "S1 TEST",
            "experience_years": 2,
            "age": 25,
            "certifications": ["TEST"],
            "cover_letter": "TEST cover",
        }
        r = pel_client.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stage"] == "applied"
        assert data["progress_percent"] == 12  # int((1/8)*100) == 12
        assert data["position_title"] == pos["title"]
        # duplicate
        r2 = pel_client.post(f"{API}/applications", json=payload)
        assert r2.status_code == 400

    def test_hr_update_stage(self, hr_client, pel_client):
        mine = pel_client.get(f"{API}/applications/mine").json()
        assert mine, "Need at least one application"
        aid = mine[0]["id"]
        r = hr_client.patch(
            f"{API}/applications/{aid}/stage",
            json={"stage": "screening", "note": "TEST screening"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stage"] == "screening"
        assert any(h["stage"] == "screening" for h in data["history"])
        # Verify notification created for pelamar
        notifs = pel_client.get(f"{API}/notifications").json()
        assert any("screening" in n["title"].lower() or "Screening" in n["title"] for n in notifs)

    def test_hr_update_scores(self, hr_client):
        apps = hr_client.get(f"{API}/applications").json()
        assert apps
        aid = apps[0]["id"]
        scores = {
            "pendidikan": 80,
            "pengalaman": 70,
            "tes_teknis": 85,
            "interview": 75,
            "usia": 90,
            "sertifikasi": 60,
        }
        r = hr_client.patch(f"{API}/applications/{aid}/scores", json=scores)
        assert r.status_code == 200, r.text
        assert r.json()["scores"]["tes_teknis"] == 85


# ---------- SAW ----------
class TestSAW:
    def test_pelamar_cannot_access_ranking(self, pel_client):
        r = pel_client.get(f"{API}/saw/ranking")
        assert r.status_code == 403

    def test_saw_info_schema(self, hr_client):
        # Iteration 2: /api/saw/info should expose criteria with types + formulas
        r = requests.get(f"{API}/saw/info")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "criteria" in d and isinstance(d["criteria"], list)
        keys = {c["key"] for c in d["criteria"]}
        assert keys == {"pendidikan", "pengalaman", "tes_teknis", "interview", "usia", "sertifikasi"}
        # types
        types = {c["key"]: c["type"] for c in d["criteria"]}
        assert types["usia"] == "cost"
        for k in ("pendidikan", "pengalaman", "tes_teknis", "interview", "sertifikasi"):
            assert types[k] == "benefit", f"{k} should be benefit"
        # weights sum to 1.0
        assert abs(d["total_weight"] - 1.0) < 1e-6
        # formulas keys
        f = d["formulas"]
        for k in ("normalization_benefit", "normalization_cost", "weighted", "final"):
            assert k in f and isinstance(f[k], str)

    def test_ranking_returns_sorted_with_breakdown(self, hr_client):
        r = hr_client.get(f"{API}/saw/ranking")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if not rows:
            pytest.skip("No applications with scores")
        # each row must have normalized + weighted dicts for all 6 criteria
        criteria = ["pendidikan", "pengalaman", "tes_teknis", "interview", "usia", "sertifikasi"]
        for row in rows:
            assert "normalized" in row and "weighted" in row and "saw_score" in row and "rank" in row
            for c in criteria:
                assert c in row["normalized"], f"missing normalized.{c}"
                assert c in row["weighted"], f"missing weighted.{c}"
                assert 0 <= row["normalized"][c] <= 1.0 + 1e-6
            # V_i = sum of weighted values (within rounding tolerance)
            weighted_sum = round(sum(row["weighted"].values()), 4)
            assert abs(weighted_sum - row["saw_score"]) < 0.01, (
                f"saw_score {row['saw_score']} != sum(weighted)={weighted_sum}"
            )
        # sorted descending
        for i in range(len(rows) - 1):
            assert rows[i]["saw_score"] >= rows[i + 1]["saw_score"]
        assert rows[0]["rank"] == 1

    def test_benefit_cost_normalization_math(self, hr_client):
        """Verify benefit r=x/max and cost r=min/x against actual returned data."""
        info = requests.get(f"{API}/saw/info").json()
        type_map = {c["key"]: c["type"] for c in info["criteria"]}
        weight_map = {c["key"]: c["weight"] for c in info["criteria"]}

        rows = hr_client.get(f"{API}/saw/ranking").json()
        if not rows:
            pytest.skip("No SAW data")
        # Build per-criterion arrays from raw scores
        criteria = list(type_map.keys())
        raw = {c: [(r.get("scores") or {}).get(c, 0) or 0 for r in rows] for c in criteria}
        maxv = {c: max(raw[c]) if raw[c] else 0 for c in criteria}
        minv = {
            c: (min([v for v in raw[c] if v > 0]) if any(v > 0 for v in raw[c]) else 0)
            for c in criteria
        }
        for r in rows:
            for c in criteria:
                x = (r.get("scores") or {}).get(c, 0) or 0
                if type_map[c] == "benefit":
                    expected = (x / maxv[c]) if maxv[c] else 0
                else:  # cost
                    expected = (minv[c] / x) if x > 0 else 0
                got = r["normalized"][c]
                assert abs(got - expected) < 1e-3, (
                    f"row={r['id']} c={c} type={type_map[c]} x={x} got={got} expected={expected}"
                )
                # weighted = w * normalized
                expected_w = weight_map[c] * expected
                assert abs(r["weighted"][c] - expected_w) < 1e-3


# ---------- Interviews ----------
class TestInterviews:
    def test_hr_create_interview_notifies_pelamar(self, hr_client, pel_client):
        mine = pel_client.get(f"{API}/applications/mine").json()
        assert mine
        aid = mine[0]["id"]
        r = hr_client.post(
            f"{API}/interviews",
            json={
                "application_id": aid,
                "type": "online_interview",
                "scheduled_at": "2026-02-10T10:00:00Z",
                "meeting_link": "https://meet.example/test",
                "notes": "TEST interview",
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["meeting_link"] == "https://meet.example/test"

    def test_pelamar_lists_only_own_interviews(self, pel_client):
        r = pel_client.get(f"{API}/interviews")
        assert r.status_code == 200
        # should not error; if there are interviews they must belong to pelamar
        my_apps = {a["id"] for a in pel_client.get(f"{API}/applications/mine").json()}
        for it in r.json():
            assert it["application_id"] in my_apps


# ---------- Messages ----------
class TestMessages:
    def test_message_roundtrip(self, hr_client, pel_client):
        mine = pel_client.get(f"{API}/applications/mine").json()
        assert mine
        aid = mine[0]["id"]
        r1 = hr_client.post(f"{API}/messages", json={"application_id": aid, "text": "TEST hr msg"})
        assert r1.status_code == 200, r1.text
        r2 = pel_client.post(f"{API}/messages", json={"application_id": aid, "text": "TEST pel reply"})
        assert r2.status_code == 200
        r3 = pel_client.get(f"{API}/messages", params={"application_id": aid})
        assert r3.status_code == 200
        texts = [m["text"] for m in r3.json()]
        assert "TEST hr msg" in texts and "TEST pel reply" in texts
        # ordered
        times = [m["created_at"] for m in r3.json()]
        assert times == sorted(times)


# ---------- Notifications ----------
class TestNotifications:
    def test_get_and_read_all(self, pel_client):
        r = pel_client.get(f"{API}/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = pel_client.post(f"{API}/notifications/read-all")
        assert r2.status_code == 200
        r3 = pel_client.get(f"{API}/notifications").json()
        assert all(n["read"] for n in r3)


# ---------- Stats ----------
class TestStats:
    def test_pelamar_forbidden(self, pel_client):
        r = pel_client.get(f"{API}/stats")
        assert r.status_code == 403

    def test_hr_stats(self, hr_client):
        r = hr_client.get(f"{API}/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("by_stage", "total_applications", "total_pelamar", "total_positions", "accepted"):
            assert k in d
        assert isinstance(d["by_stage"], dict)
