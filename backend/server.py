"""Pertacareer Recruitment System - FastAPI Backend.

Auth: JWT (Bearer + httpOnly cookie). Roles: hr, pelamar.
Stages flow: applied -> screening -> qualified -> assessment ->
online_interview -> user_interview -> top_management_interview -> accepted|rejected|reserve
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from motor.motor_asyncio import AsyncIOMotorClient


# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day for simplicity

STAGES = [
    "applied",
    "screening",
    "qualified",
    "assessment",
    "online_interview",
    "user_interview",
    "top_management_interview",
    "accepted",
    "rejected",
    "reserve",
]

STAGE_PROGRESS_INDEX = {
    "applied": 1,
    "screening": 2,
    "qualified": 3,
    "assessment": 4,
    "online_interview": 5,
    "user_interview": 6,
    "top_management_interview": 7,
    "accepted": 8,
    "rejected": 8,
    "reserve": 8,
}

STAGE_MESSAGES = {
    "applied": "Lamaran berhasil diterima sistem.",
    "screening": "Dokumen sedang diperiksa HR.",
    "qualified": "Selamat, anda lolos seleksi administrasi.",
    "assessment": "Silakan mengikuti tes sesuai jadwal.",
    "online_interview": "Interview HR dijadwalkan.",
    "user_interview": "Interview dengan user perusahaan.",
    "top_management_interview": "Interview final dengan top management.",
    "accepted": "Selamat! Anda diterima bergabung.",
    "rejected": "Mohon maaf, anda belum sesuai pada posisi ini.",
    "reserve": "Anda masuk daftar kandidat cadangan.",
}


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_doc(d: dict) -> dict:
    """Drop _id and password_hash from a MongoDB doc."""
    d.pop("_id", None)
    d.pop("password_hash", None)
    return d


# ---------- Models ----------
class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Literal["hr", "pelamar"]
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    role: Literal["pelamar"] = "pelamar"  # public registration only pelamar


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PositionIn(BaseModel):
    title: str
    department: str
    location: str
    description: str
    requirements: List[str] = []
    closing_date: Optional[str] = None


class PositionOut(PositionIn):
    id: str
    is_open: bool = True
    created_at: str


class ApplicationCreateIn(BaseModel):
    position_id: str
    education: str
    experience_years: int = 0
    age: int
    certifications: List[str] = []
    cover_letter: Optional[str] = None
    cv_url: Optional[str] = None


class ApplicationOut(BaseModel):
    id: str
    applicant_id: str
    applicant_name: str
    applicant_email: EmailStr
    applicant_phone: Optional[str] = None
    position_id: str
    position_title: str
    department: str
    location: str
    education: str
    experience_years: int
    age: int
    certifications: List[str] = []
    cover_letter: Optional[str] = None
    cv_url: Optional[str] = None
    stage: str
    progress_percent: int
    history: List[dict] = []
    scores: dict = Field(default_factory=dict)
    saw_score: Optional[float] = None
    applied_at: str
    updated_at: str


class StageUpdateIn(BaseModel):
    stage: Literal[
        "applied",
        "screening",
        "qualified",
        "assessment",
        "online_interview",
        "user_interview",
        "top_management_interview",
        "accepted",
        "rejected",
        "reserve",
    ]
    note: Optional[str] = None


class ScoresIn(BaseModel):
    pendidikan: float = Field(ge=0, le=100)
    pengalaman: float = Field(ge=0, le=100)
    tes_teknis: float = Field(ge=0, le=100)
    interview: float = Field(ge=0, le=100)
    usia: float = Field(ge=0, le=100)
    sertifikasi: float = Field(ge=0, le=100)


class InterviewIn(BaseModel):
    application_id: str
    type: Literal["assessment", "online_interview", "user_interview", "top_management_interview"]
    scheduled_at: str  # ISO
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class InterviewOut(InterviewIn):
    id: str
    created_at: str


class MessageIn(BaseModel):
    application_id: str
    text: str


class MessageOut(BaseModel):
    id: str
    application_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    text: str
    created_at: str


class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    read: bool = False
    created_at: str


# ---------- App ----------
app = FastAPI(title="Pertacareer Recruitment API")
api = APIRouter(prefix="/api")


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    return user


def require_role(*roles):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _dep


# ---------- Auth routes ----------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        "access_token", token,
        httponly=True, secure=False, samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )


@api.post("/auth/register", response_model=UserOut)
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "name": body.name,
        "phone": body.phone,
        "role": body.role,
        "photo_url": None,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(uid, email, body.role)
    set_auth_cookie(response, token)
    return UserOut(**clean_doc({**doc}))


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"user": UserOut(**clean_doc({**user})), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


# ---------- Positions ----------
@api.get("/positions", response_model=List[PositionOut])
async def list_positions():
    rows = await db.positions.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [PositionOut(**r) for r in rows]


@api.post("/positions", response_model=PositionOut)
async def create_position(body: PositionIn, _hr: dict = Depends(require_role("hr"))):
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "is_open": True, "created_at": now_iso()}
    await db.positions.insert_one(doc)
    doc.pop("_id", None)
    return PositionOut(**doc)


@api.delete("/positions/{pid}")
async def delete_position(pid: str, _hr: dict = Depends(require_role("hr"))):
    r = await db.positions.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Position not found")
    return {"ok": True}


# ---------- Applications ----------
async def _enrich_application(app_doc: dict) -> dict:
    pos = await db.positions.find_one({"id": app_doc["position_id"]}, {"_id": 0})
    user = await db.users.find_one({"id": app_doc["applicant_id"]}, {"_id": 0, "password_hash": 0})
    return {
        **app_doc,
        "position_title": pos["title"] if pos else "—",
        "department": pos["department"] if pos else "—",
        "location": pos["location"] if pos else "—",
        "applicant_name": user["name"] if user else "—",
        "applicant_email": user["email"] if user else "—",
        "applicant_phone": user.get("phone") if user else None,
        "progress_percent": int((STAGE_PROGRESS_INDEX.get(app_doc["stage"], 1) / 8) * 100),
    }


@api.post("/applications", response_model=ApplicationOut)
async def create_application(body: ApplicationCreateIn, user: dict = Depends(require_role("pelamar"))):
    pos = await db.positions.find_one({"id": body.position_id}, {"_id": 0})
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    if await db.applications.find_one({"position_id": body.position_id, "applicant_id": user["id"]}):
        raise HTTPException(status_code=400, detail="Anda sudah melamar posisi ini")
    aid = str(uuid.uuid4())
    doc = {
        "id": aid,
        "applicant_id": user["id"],
        "position_id": body.position_id,
        "education": body.education,
        "experience_years": body.experience_years,
        "age": body.age,
        "certifications": body.certifications,
        "cover_letter": body.cover_letter,
        "cv_url": body.cv_url,
        "stage": "applied",
        "history": [{"stage": "applied", "at": now_iso(), "note": STAGE_MESSAGES["applied"]}],
        "scores": {},
        "saw_score": None,
        "applied_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.applications.insert_one(doc)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": "Lamaran terkirim",
        "body": f"Lamaran anda untuk posisi {pos['title']} berhasil diterima.",
        "read": False,
        "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return ApplicationOut(**(await _enrich_application(doc)))


@api.get("/applications/mine", response_model=List[ApplicationOut])
async def my_applications(user: dict = Depends(require_role("pelamar"))):
    rows = await db.applications.find({"applicant_id": user["id"]}, {"_id": 0}).sort("applied_at", -1).to_list(200)
    return [ApplicationOut(**(await _enrich_application(r))) for r in rows]


@api.get("/applications", response_model=List[ApplicationOut])
async def list_applications(stage: Optional[str] = None, _hr: dict = Depends(require_role("hr"))):
    q = {"stage": stage} if stage else {}
    rows = await db.applications.find(q, {"_id": 0}).sort("applied_at", -1).to_list(500)
    return [ApplicationOut(**(await _enrich_application(r))) for r in rows]


@api.get("/applications/{aid}", response_model=ApplicationOut)
async def get_application(aid: str, user: dict = Depends(get_current_user)):
    doc = await db.applications.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and doc["applicant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ApplicationOut(**(await _enrich_application(doc)))


@api.patch("/applications/{aid}/stage", response_model=ApplicationOut)
async def update_stage(aid: str, body: StageUpdateIn, hr: dict = Depends(require_role("hr"))):
    doc = await db.applications.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    history = doc.get("history", [])
    history.append({
        "stage": body.stage,
        "at": now_iso(),
        "note": body.note or STAGE_MESSAGES.get(body.stage, ""),
        "by": hr["name"],
    })
    await db.applications.update_one(
        {"id": aid},
        {"$set": {"stage": body.stage, "history": history, "updated_at": now_iso()}},
    )
    # Notify applicant
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": doc["applicant_id"],
        "title": f"Status berubah: {body.stage.replace('_', ' ').title()}",
        "body": body.note or STAGE_MESSAGES.get(body.stage, ""),
        "read": False,
        "created_at": now_iso(),
    })
    new_doc = await db.applications.find_one({"id": aid}, {"_id": 0})
    return ApplicationOut(**(await _enrich_application(new_doc)))


@api.patch("/applications/{aid}/scores", response_model=ApplicationOut)
async def update_scores(aid: str, body: ScoresIn, _hr: dict = Depends(require_role("hr"))):
    doc = await db.applications.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    scores = body.model_dump()
    await db.applications.update_one(
        {"id": aid},
        {"$set": {"scores": scores, "updated_at": now_iso()}},
    )
    new_doc = await db.applications.find_one({"id": aid}, {"_id": 0})
    return ApplicationOut(**(await _enrich_application(new_doc)))


# ---------- SAW (Simple Additive Weighting) ----------
# Each criterion has: weight (sum must = 1.0) and type ("benefit" or "cost").
# Benefit -> r_ij = x_ij / max(x_j)
# Cost    -> r_ij = min(x_j) / x_ij
# V_i = Σ (w_j * r_ij)
SAW_CRITERIA = {
    "pendidikan":  {"weight": 0.20, "type": "benefit", "label": "Pendidikan"},
    "pengalaman":  {"weight": 0.20, "type": "benefit", "label": "Pengalaman Kerja"},
    "tes_teknis":  {"weight": 0.25, "type": "benefit", "label": "Tes Teknis"},
    "interview":   {"weight": 0.20, "type": "benefit", "label": "Interview"},
    "usia":        {"weight": 0.05, "type": "cost",    "label": "Usia"},
    "sertifikasi": {"weight": 0.10, "type": "benefit", "label": "Sertifikasi"},
}


@api.get("/saw/info")
async def saw_info():
    """Public-ish description of SAW weights & criteria types (for HR UI)."""
    return {
        "criteria": [
            {"key": k, **v} for k, v in SAW_CRITERIA.items()
        ],
        "total_weight": round(sum(c["weight"] for c in SAW_CRITERIA.values()), 4),
        "formulas": {
            "normalization_benefit": "r_ij = x_ij / max(x_j)",
            "normalization_cost": "r_ij = min(x_j) / x_ij",
            "weighted": "v_ij = w_j * r_ij",
            "final": "V_i = Σ (w_j * r_ij)  for j = 1..n",
        },
    }


@api.get("/saw/ranking")
async def saw_ranking(position_id: Optional[str] = None, _hr: dict = Depends(require_role("hr"))):
    q = {"scores": {"$ne": {}}}
    if position_id:
        q["position_id"] = position_id
    rows = await db.applications.find(q, {"_id": 0}).to_list(500)
    rows = [r for r in rows if r.get("scores")]
    if not rows:
        return []

    criteria = list(SAW_CRITERIA.keys())
    # Build decision matrix
    matrix = {c: [(r["scores"].get(c, 0) or 0) for r in rows] for c in criteria}
    maxv = {c: (max(matrix[c]) if matrix[c] else 0) for c in criteria}
    # For cost criteria, smallest non-zero matters; if all zeros, fallback to 1 to avoid div/0
    minv = {c: (min([v for v in matrix[c] if v > 0]) if any(v > 0 for v in matrix[c]) else 0) for c in criteria}

    ranked = []
    for idx, r in enumerate(rows):
        normalized = {}
        weighted = {}
        v_total = 0.0
        for c in criteria:
            cfg = SAW_CRITERIA[c]
            x = r["scores"].get(c, 0) or 0
            if cfg["type"] == "benefit":
                denom = maxv[c] or 1
                norm = x / denom
            else:  # cost
                # r_ij = min / x  ; if x is 0 -> norm = 0 (avoid div/0)
                norm = (minv[c] / x) if x > 0 else 0
            normalized[c] = round(norm, 4)
            w = cfg["weight"] * norm
            weighted[c] = round(w, 4)
            v_total += w
        v_total = round(v_total, 4)
        await db.applications.update_one({"id": r["id"]}, {"$set": {"saw_score": v_total}})
        enriched = await _enrich_application(r)
        enriched["saw_score"] = v_total
        enriched["normalized"] = normalized
        enriched["weighted"] = weighted
        ranked.append(enriched)

    ranked.sort(key=lambda x: x["saw_score"], reverse=True)
    for i, row in enumerate(ranked):
        row["rank"] = i + 1
    return ranked


# ---------- Interviews ----------
@api.post("/interviews", response_model=InterviewOut)
async def create_interview(body: InterviewIn, _hr: dict = Depends(require_role("hr"))):
    app_doc = await db.applications.find_one({"id": body.application_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    iid = str(uuid.uuid4())
    doc = {**body.model_dump(), "id": iid, "created_at": now_iso()}
    await db.interviews.insert_one(doc)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": app_doc["applicant_id"],
        "title": f"Jadwal {body.type.replace('_', ' ').title()}",
        "body": f"Anda dijadwalkan pada {body.scheduled_at}. {body.notes or ''}".strip(),
        "read": False,
        "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return InterviewOut(**doc)


@api.get("/interviews", response_model=List[InterviewOut])
async def list_interviews(application_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if application_id:
        q["application_id"] = application_id
    if user["role"] == "pelamar":
        # only those tied to applicant
        my_apps = await db.applications.find({"applicant_id": user["id"]}, {"_id": 0, "id": 1}).to_list(200)
        ids = [a["id"] for a in my_apps]
        q["application_id"] = {"$in": ids} if not application_id else application_id
    rows = await db.interviews.find(q, {"_id": 0}).sort("scheduled_at", 1).to_list(200)
    return [InterviewOut(**r) for r in rows]


# ---------- Messages ----------
@api.post("/messages", response_model=MessageOut)
async def send_message(body: MessageIn, user: dict = Depends(get_current_user)):
    app_doc = await db.applications.find_one({"id": body.application_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and app_doc["applicant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    mid = str(uuid.uuid4())
    doc = {
        "id": mid,
        "application_id": body.application_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "text": body.text,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    # Notify the other party
    other_user_id = app_doc["applicant_id"] if user["role"] == "hr" else None
    if other_user_id:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": other_user_id,
            "title": "Pesan baru dari HR",
            "body": body.text[:120],
            "read": False,
            "created_at": now_iso(),
        })
    doc.pop("_id", None)
    return MessageOut(**doc)


@api.get("/messages", response_model=List[MessageOut])
async def list_messages(application_id: str, user: dict = Depends(get_current_user)):
    app_doc = await db.applications.find_one({"id": application_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and app_doc["applicant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = await db.messages.find({"application_id": application_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [MessageOut(**r) for r in rows]


# ---------- Notifications ----------
@api.get("/notifications", response_model=List[NotificationOut])
async def my_notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [NotificationOut(**r) for r in rows]


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- HR stats ----------
@api.get("/stats")
async def hr_stats(_hr: dict = Depends(require_role("hr"))):
    pipeline = [{"$group": {"_id": "$stage", "count": {"$sum": 1}}}]
    by_stage = {s: 0 for s in STAGES}
    async for row in db.applications.aggregate(pipeline):
        by_stage[row["_id"]] = row["count"]
    total_app = await db.applications.count_documents({})
    total_pos = await db.positions.count_documents({})
    total_pelamar = await db.users.count_documents({"role": "pelamar"})
    accepted = by_stage.get("accepted", 0)
    return {
        "by_stage": by_stage,
        "total_applications": total_app,
        "total_positions": total_pos,
        "total_pelamar": total_pelamar,
        "accepted": accepted,
    }


app.include_router(api)


# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Seed ----------
async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.applications.create_index([("applicant_id", 1), ("position_id", 1)])

    # HR admin
    hr_email = os.environ.get("ADMIN_EMAIL", "hr@pertacareer.id")
    hr_password = os.environ.get("ADMIN_PASSWORD", "hr123456")
    existing = await db.users.find_one({"email": hr_email})
    if not existing:
        hr_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": hr_id, "email": hr_email, "name": "Sari Wulandari (HR)",
            "phone": "+628123456789", "role": "hr", "photo_url": None,
            "password_hash": hash_password(hr_password), "created_at": now_iso(),
        })
    else:
        if not verify_password(hr_password, existing["password_hash"]):
            await db.users.update_one(
                {"email": hr_email},
                {"$set": {"password_hash": hash_password(hr_password)}},
            )
        hr_id = existing["id"]

    # Demo pelamar
    demo_email = "pelamar@pertacareer.id"
    pelamar = await db.users.find_one({"email": demo_email})
    if not pelamar:
        pid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": pid, "email": demo_email, "name": "Ahmad Pratama",
            "phone": "+628111222333", "role": "pelamar", "photo_url": None,
            "password_hash": hash_password("pelamar123"),
            "created_at": now_iso(),
        })
    else:
        pid = pelamar["id"]

    demo2_email = "budi@pertacareer.id"
    pelamar2 = await db.users.find_one({"email": demo2_email})
    if not pelamar2:
        p2 = str(uuid.uuid4())
        await db.users.insert_one({
            "id": p2, "email": demo2_email, "name": "Budi Santoso",
            "phone": "+628112223334", "role": "pelamar", "photo_url": None,
            "password_hash": hash_password("pelamar123"),
            "created_at": now_iso(),
        })
    else:
        p2 = pelamar2["id"]

    # Positions
    if await db.positions.count_documents({}) == 0:
        positions = [
            {"id": str(uuid.uuid4()), "title": "Petroleum Engineer", "department": "Upstream",
             "location": "Jakarta", "description": "Bertanggung jawab atas analisa reservoir dan optimalisasi produksi minyak & gas.",
             "requirements": ["S1 Teknik Perminyakan", "Min. 2 tahun pengalaman", "Sertifikasi SPE diutamakan"],
             "closing_date": "2026-04-30", "is_open": True, "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "title": "Refinery Operator", "department": "Downstream",
             "location": "Cilacap", "description": "Mengoperasikan unit kilang dan memastikan standar mutu serta keselamatan kerja.",
             "requirements": ["D3/S1 Teknik Kimia", "Lulusan fresh graduate dipersilakan", "Bersedia shift"],
             "closing_date": "2026-04-15", "is_open": True, "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "title": "Data Analyst", "department": "Corporate IT",
             "location": "Jakarta", "description": "Membangun dashboard, analisa data operasi, dan support keputusan bisnis.",
             "requirements": ["S1 IT/Statistika", "SQL, Python, BI tools", "Komunikasi baik"],
             "closing_date": "2026-05-10", "is_open": True, "created_at": now_iso()},
        ]
        await db.positions.insert_many(positions)
        pos_ids = [p["id"] for p in positions]
    else:
        pos_ids = [p["id"] for p in await db.positions.find({}, {"_id": 0, "id": 1}).to_list(100)]

    # Demo applications across stages
    if await db.applications.count_documents({}) == 0 and pos_ids:
        sample = [
            (pid, pos_ids[0], "online_interview", {"pendidikan": 85, "pengalaman": 70, "tes_teknis": 88, "interview": 80, "usia": 90, "sertifikasi": 75},
             "S1 Teknik Perminyakan UI", 3, 26, ["SPE Member", "K3 Migas"]),
            (pid, pos_ids[2], "assessment", {}, "S1 Teknik Perminyakan UI", 3, 26, ["SPE Member"]),
            (p2, pos_ids[1], "screening", {}, "D3 Teknik Kimia POLBAN", 1, 24, []),
            (p2, pos_ids[0], "qualified", {"pendidikan": 80, "pengalaman": 60, "tes_teknis": 82, "interview": 0, "usia": 88, "sertifikasi": 70},
             "D3 Teknik Kimia POLBAN", 1, 24, []),
        ]
        for applicant_id, position_id, stage, scores, edu, exp, age, certs in sample:
            history = []
            order = ["applied", "screening", "qualified", "assessment", "online_interview", "user_interview", "top_management_interview"]
            for s in order:
                history.append({"stage": s, "at": now_iso(), "note": STAGE_MESSAGES[s], "by": "Sari Wulandari (HR)"})
                if s == stage:
                    break
            await db.applications.insert_one({
                "id": str(uuid.uuid4()),
                "applicant_id": applicant_id,
                "position_id": position_id,
                "education": edu,
                "experience_years": exp,
                "age": age,
                "certifications": certs,
                "cover_letter": "Saya tertarik untuk berkontribusi pada perusahaan.",
                "cv_url": None,
                "stage": stage,
                "history": history,
                "scores": scores,
                "saw_score": None,
                "applied_at": now_iso(),
                "updated_at": now_iso(),
            })


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
        logger.info("Seed complete.")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"app": "Pertacareer Recruitment API", "status": "ok"}
