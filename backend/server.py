"""Pertacareer Recruitment System - FastAPI Backend (SQLite + SQLAlchemy async).

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

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db import init_db, get_session, AsyncSessionLocal
from migrate import migrate_mongo_to_sqlite
from models import (
    User as UserM, Position as PositionM, Application as ApplicationM,
    Message as MessageM, Interview as InterviewM, Notification as NotificationM,
)


JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 1 day

STAGES = [
    "applied", "screening", "qualified", "assessment",
    "online_interview", "user_interview", "top_management_interview",
    "accepted", "rejected", "reserve",
]

STAGE_PROGRESS_INDEX = {
    "applied": 1, "screening": 2, "qualified": 3, "assessment": 4,
    "online_interview": 5, "user_interview": 6, "top_management_interview": 7,
    "accepted": 8, "rejected": 8, "reserve": 8,
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
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def user_dict(u: UserM) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name, "phone": u.phone,
        "role": u.role, "photo_url": u.photo_url, "created_at": u.created_at,
    }


# ---------- Pydantic Models ----------
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
    role: Literal["pelamar"] = "pelamar"


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
        "applied", "screening", "qualified", "assessment",
        "online_interview", "user_interview", "top_management_interview",
        "accepted", "rejected", "reserve",
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
    scheduled_at: str
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
async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
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
    user = await session.get(UserM, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user_dict(user)


def require_role(*roles):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _dep


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        "access_token", token,
        httponly=True, secure=False, samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )


# ---------- Auth ----------
@api.post("/auth/register", response_model=UserOut)
async def register(body: RegisterIn, response: Response, session: AsyncSession = Depends(get_session)):
    email = body.email.lower()
    exists = await session.scalar(select(UserM).where(UserM.email == email))
    if exists:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = UserM(
        id=str(uuid.uuid4()), email=email, name=body.name,
        phone=body.phone, role=body.role, photo_url=None,
        password_hash=hash_password(body.password), created_at=now_iso(),
    )
    session.add(user)
    await session.commit()
    token = create_access_token(user.id, user.email, user.role)
    set_auth_cookie(response, token)
    return UserOut(**user_dict(user))


@api.post("/auth/login")
async def login(body: LoginIn, response: Response, session: AsyncSession = Depends(get_session)):
    email = body.email.lower()
    user = await session.scalar(select(UserM).where(UserM.email == email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user.id, user.email, user.role)
    set_auth_cookie(response, token)
    return {"user": UserOut(**user_dict(user)), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


# ---------- Positions ----------
def position_out(p: PositionM) -> PositionOut:
    return PositionOut(
        id=p.id, title=p.title, department=p.department, location=p.location,
        description=p.description, requirements=list(p.requirements or []),
        closing_date=p.closing_date, is_open=p.is_open, created_at=p.created_at,
    )


@api.get("/positions", response_model=List[PositionOut])
async def list_positions(session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(select(PositionM).order_by(PositionM.created_at.desc()))).all()
    return [position_out(p) for p in rows]


@api.post("/positions", response_model=PositionOut)
async def create_position(body: PositionIn, _hr: dict = Depends(require_role("hr")),
                          session: AsyncSession = Depends(get_session)):
    p = PositionM(
        id=str(uuid.uuid4()), **body.model_dump(),
        is_open=True, created_at=now_iso(),
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)
    return position_out(p)


@api.delete("/positions/{pid}")
async def delete_position(pid: str, _hr: dict = Depends(require_role("hr")),
                          session: AsyncSession = Depends(get_session)):
    p = await session.get(PositionM, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Position not found")
    await session.delete(p)
    await session.commit()
    return {"ok": True}


# ---------- Applications ----------
def _to_app_out(a: ApplicationM) -> ApplicationOut:
    user = a.applicant
    pos = a.position
    return ApplicationOut(
        id=a.id, applicant_id=a.applicant_id,
        applicant_name=user.name if user else "—",
        applicant_email=user.email if user else "unknown@example.com",
        applicant_phone=user.phone if user else None,
        position_id=a.position_id,
        position_title=pos.title if pos else "—",
        department=pos.department if pos else "—",
        location=pos.location if pos else "—",
        education=a.education, experience_years=a.experience_years, age=a.age,
        certifications=list(a.certifications or []),
        cover_letter=a.cover_letter, cv_url=a.cv_url,
        stage=a.stage,
        progress_percent=int((STAGE_PROGRESS_INDEX.get(a.stage, 1) / 8) * 100),
        history=list(a.history or []),
        scores=dict(a.scores or {}),
        saw_score=a.saw_score,
        applied_at=a.applied_at, updated_at=a.updated_at,
    )


@api.post("/applications", response_model=ApplicationOut)
async def create_application(body: ApplicationCreateIn,
                             user: dict = Depends(require_role("pelamar")),
                             session: AsyncSession = Depends(get_session)):
    pos = await session.get(PositionM, body.position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    dup = await session.scalar(
        select(ApplicationM).where(
            ApplicationM.position_id == body.position_id,
            ApplicationM.applicant_id == user["id"],
        )
    )
    if dup:
        raise HTTPException(status_code=400, detail="Anda sudah melamar posisi ini")
    app_row = ApplicationM(
        id=str(uuid.uuid4()),
        applicant_id=user["id"],
        position_id=body.position_id,
        education=body.education,
        experience_years=body.experience_years,
        age=body.age,
        certifications=body.certifications,
        cover_letter=body.cover_letter,
        cv_url=body.cv_url,
        stage="applied",
        history=[{"stage": "applied", "at": now_iso(), "note": STAGE_MESSAGES["applied"]}],
        scores={},
        saw_score=None,
        applied_at=now_iso(),
        updated_at=now_iso(),
    )
    session.add(app_row)
    session.add(NotificationM(
        id=str(uuid.uuid4()), user_id=user["id"],
        title="Lamaran terkirim",
        body=f"Lamaran anda untuk posisi {pos.title} berhasil diterima.",
        read=False, created_at=now_iso(),
    ))
    await session.commit()
    await session.refresh(app_row)
    return _to_app_out(app_row)


@api.get("/applications/mine", response_model=List[ApplicationOut])
async def my_applications(user: dict = Depends(require_role("pelamar")),
                          session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(
        select(ApplicationM)
        .where(ApplicationM.applicant_id == user["id"])
        .order_by(ApplicationM.applied_at.desc())
    )).all()
    return [_to_app_out(a) for a in rows]


@api.get("/applications", response_model=List[ApplicationOut])
async def list_applications(stage: Optional[str] = None,
                            _hr: dict = Depends(require_role("hr")),
                            session: AsyncSession = Depends(get_session)):
    q = select(ApplicationM).order_by(ApplicationM.applied_at.desc())
    if stage:
        q = q.where(ApplicationM.stage == stage)
    rows = (await session.scalars(q)).all()
    return [_to_app_out(a) for a in rows]


@api.get("/applications/{aid}", response_model=ApplicationOut)
async def get_application(aid: str, user: dict = Depends(get_current_user),
                          session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and a.applicant_id != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_app_out(a)


@api.patch("/applications/{aid}/stage", response_model=ApplicationOut)
async def update_stage(aid: str, body: StageUpdateIn,
                       hr: dict = Depends(require_role("hr")),
                       session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    history = list(a.history or [])
    history.append({
        "stage": body.stage, "at": now_iso(),
        "note": body.note or STAGE_MESSAGES.get(body.stage, ""),
        "by": hr["name"],
    })
    a.stage = body.stage
    a.history = history
    a.updated_at = now_iso()
    session.add(NotificationM(
        id=str(uuid.uuid4()), user_id=a.applicant_id,
        title=f"Status berubah: {body.stage.replace('_', ' ').title()}",
        body=body.note or STAGE_MESSAGES.get(body.stage, ""),
        read=False, created_at=now_iso(),
    ))
    await session.commit()
    await session.refresh(a)
    return _to_app_out(a)


@api.patch("/applications/{aid}/scores", response_model=ApplicationOut)
async def update_scores(aid: str, body: ScoresIn,
                        _hr: dict = Depends(require_role("hr")),
                        session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    a.scores = body.model_dump()
    a.updated_at = now_iso()
    await session.commit()
    await session.refresh(a)
    return _to_app_out(a)


@api.delete("/applications/{aid}")
async def delete_application(aid: str, _hr: dict = Depends(require_role("hr")),
                             session: AsyncSession = Depends(get_session)):
    """Hapus lamaran. Hanya yang berstatus 'rejected'."""
    a = await session.get(ApplicationM, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if a.stage != "rejected":
        raise HTTPException(
            status_code=400,
            detail="Hanya kandidat dengan status 'Rejected' yang dapat dihapus",
        )
    await session.execute(delete(MessageM).where(MessageM.application_id == aid))
    await session.execute(delete(InterviewM).where(InterviewM.application_id == aid))
    await session.delete(a)
    await session.commit()
    return {"ok": True, "deleted_id": aid}


# ---------- SAW ----------
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
    return {
        "criteria": [{"key": k, **v} for k, v in SAW_CRITERIA.items()],
        "total_weight": round(sum(c["weight"] for c in SAW_CRITERIA.values()), 4),
        "formulas": {
            "normalization_benefit": "r_ij = x_ij / max(x_j)",
            "normalization_cost": "r_ij = min(x_j) / x_ij",
            "weighted": "v_ij = w_j * r_ij",
            "final": "V_i = Σ (w_j * r_ij)  for j = 1..n",
        },
    }


@api.get("/saw/ranking")
async def saw_ranking(position_id: Optional[str] = None,
                      _hr: dict = Depends(require_role("hr")),
                      session: AsyncSession = Depends(get_session)):
    # Filter: must have scores AND not yet accepted
    q = select(ApplicationM).where(ApplicationM.stage != "accepted")
    if position_id:
        q = q.where(ApplicationM.position_id == position_id)
    rows = (await session.scalars(q)).all()
    rows = [r for r in rows if r.scores]
    if not rows:
        return []

    criteria = list(SAW_CRITERIA.keys())
    matrix = {c: [(r.scores.get(c, 0) or 0) for r in rows] for c in criteria}
    maxv = {c: (max(matrix[c]) if matrix[c] else 0) for c in criteria}
    minv = {c: (min([v for v in matrix[c] if v > 0]) if any(v > 0 for v in matrix[c]) else 0) for c in criteria}

    ranked = []
    for r in rows:
        normalized, weighted = {}, {}
        v_total = 0.0
        for c in criteria:
            cfg = SAW_CRITERIA[c]
            x = r.scores.get(c, 0) or 0
            if cfg["type"] == "benefit":
                norm = x / (maxv[c] or 1)
            else:  # cost
                norm = (minv[c] / x) if x > 0 else 0
            normalized[c] = round(norm, 4)
            w = cfg["weight"] * norm
            weighted[c] = round(w, 4)
            v_total += w
        v_total = round(v_total, 4)
        r.saw_score = v_total
        enriched = _to_app_out(r).model_dump()
        enriched["saw_score"] = v_total
        enriched["normalized"] = normalized
        enriched["weighted"] = weighted
        ranked.append(enriched)

    await session.commit()

    ranked.sort(key=lambda x: x["saw_score"], reverse=True)
    for i, row in enumerate(ranked):
        row["rank"] = i + 1
    return ranked


# ---------- Interviews ----------
@api.post("/interviews", response_model=InterviewOut)
async def create_interview(body: InterviewIn,
                           _hr: dict = Depends(require_role("hr")),
                           session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, body.application_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    iv = InterviewM(
        id=str(uuid.uuid4()), application_id=body.application_id, type=body.type,
        scheduled_at=body.scheduled_at, meeting_link=body.meeting_link,
        location=body.location, notes=body.notes, created_at=now_iso(),
    )
    session.add(iv)
    session.add(NotificationM(
        id=str(uuid.uuid4()), user_id=a.applicant_id,
        title=f"Jadwal {body.type.replace('_', ' ').title()}",
        body=f"Anda dijadwalkan pada {body.scheduled_at}. {body.notes or ''}".strip(),
        read=False, created_at=now_iso(),
    ))
    await session.commit()
    await session.refresh(iv)
    return InterviewOut(
        id=iv.id, application_id=iv.application_id, type=iv.type,
        scheduled_at=iv.scheduled_at, meeting_link=iv.meeting_link,
        location=iv.location, notes=iv.notes, created_at=iv.created_at,
    )


@api.get("/interviews", response_model=List[InterviewOut])
async def list_interviews(application_id: Optional[str] = None,
                          user: dict = Depends(get_current_user),
                          session: AsyncSession = Depends(get_session)):
    q = select(InterviewM).order_by(InterviewM.scheduled_at.asc())
    if user["role"] == "pelamar":
        sub = select(ApplicationM.id).where(ApplicationM.applicant_id == user["id"])
        ids = [row for row in (await session.scalars(sub)).all()]
        if application_id and application_id not in ids:
            raise HTTPException(status_code=403, detail="Forbidden")
        if application_id:
            q = q.where(InterviewM.application_id == application_id)
        else:
            q = q.where(InterviewM.application_id.in_(ids))
    elif application_id:
        q = q.where(InterviewM.application_id == application_id)
    rows = (await session.scalars(q)).all()
    return [
        InterviewOut(
            id=r.id, application_id=r.application_id, type=r.type,
            scheduled_at=r.scheduled_at, meeting_link=r.meeting_link,
            location=r.location, notes=r.notes, created_at=r.created_at,
        ) for r in rows
    ]


# ---------- Messages ----------
@api.post("/messages", response_model=MessageOut)
async def send_message(body: MessageIn,
                       user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, body.application_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and a.applicant_id != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    m = MessageM(
        id=str(uuid.uuid4()), application_id=body.application_id,
        sender_id=user["id"], sender_name=user["name"], sender_role=user["role"],
        text=body.text, created_at=now_iso(),
    )
    session.add(m)
    if user["role"] == "hr":
        session.add(NotificationM(
            id=str(uuid.uuid4()), user_id=a.applicant_id,
            title="Pesan baru dari HR", body=body.text[:120],
            read=False, created_at=now_iso(),
        ))
    await session.commit()
    await session.refresh(m)
    return MessageOut(
        id=m.id, application_id=m.application_id, sender_id=m.sender_id,
        sender_name=m.sender_name, sender_role=m.sender_role,
        text=m.text, created_at=m.created_at,
    )


@api.get("/messages", response_model=List[MessageOut])
async def list_messages(application_id: str,
                        user: dict = Depends(get_current_user),
                        session: AsyncSession = Depends(get_session)):
    a = await session.get(ApplicationM, application_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if user["role"] == "pelamar" and a.applicant_id != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = (await session.scalars(
        select(MessageM)
        .where(MessageM.application_id == application_id)
        .order_by(MessageM.created_at.asc())
    )).all()
    return [
        MessageOut(
            id=m.id, application_id=m.application_id, sender_id=m.sender_id,
            sender_name=m.sender_name, sender_role=m.sender_role,
            text=m.text, created_at=m.created_at,
        ) for m in rows
    ]


# ---------- Notifications ----------
@api.get("/notifications", response_model=List[NotificationOut])
async def my_notifications(user: dict = Depends(get_current_user),
                           session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(
        select(NotificationM)
        .where(NotificationM.user_id == user["id"])
        .order_by(NotificationM.created_at.desc())
    )).all()
    return [
        NotificationOut(id=n.id, user_id=n.user_id, title=n.title,
                        body=n.body, read=n.read, created_at=n.created_at)
        for n in rows
    ]


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user),
                            session: AsyncSession = Depends(get_session)):
    n = await session.get(NotificationM, nid)
    if n and n.user_id == user["id"]:
        n.read = True
        await session.commit()
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user),
                   session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(
        select(NotificationM).where(NotificationM.user_id == user["id"])
    )).all()
    for n in rows:
        n.read = True
    await session.commit()
    return {"ok": True}


# ---------- HR stats ----------
@api.get("/stats")
async def hr_stats(_hr: dict = Depends(require_role("hr")),
                   session: AsyncSession = Depends(get_session)):
    by_stage = {s: 0 for s in STAGES}
    rows = (await session.execute(
        select(ApplicationM.stage, func.count()).group_by(ApplicationM.stage)
    )).all()
    for stg, cnt in rows:
        by_stage[stg] = cnt
    total_app = await session.scalar(select(func.count()).select_from(ApplicationM)) or 0
    total_pos = await session.scalar(select(func.count()).select_from(PositionM)) or 0
    total_pelamar_all = await session.scalar(
        select(func.count()).select_from(UserM).where(UserM.role == "pelamar")
    ) or 0
    active_ids = (await session.scalars(
        select(ApplicationM.applicant_id).where(ApplicationM.stage != "rejected").distinct()
    )).all()
    return {
        "by_stage": by_stage,
        "total_applications": total_app,
        "total_positions": total_pos,
        "total_pelamar": len(set(active_ids)),
        "total_pelamar_all": total_pelamar_all,
        "rejected": by_stage.get("rejected", 0),
        "accepted": by_stage.get("accepted", 0),
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Seed (idempotent) ----------
async def seed():
    async with AsyncSessionLocal() as s:
        hr_email = os.environ.get("ADMIN_EMAIL", "hr@pertacareer.id")
        hr_password = os.environ.get("ADMIN_PASSWORD", "hr123456")
        hr_user = await s.scalar(select(UserM).where(UserM.email == hr_email))
        if not hr_user:
            hr_user = UserM(
                id=str(uuid.uuid4()), email=hr_email, name="Sari Wulandari (HR)",
                phone="+628123456789", role="hr", photo_url=None,
                password_hash=hash_password(hr_password), created_at=now_iso(),
            )
            s.add(hr_user)
            await s.commit()
        elif not verify_password(hr_password, hr_user.password_hash):
            hr_user.password_hash = hash_password(hr_password)
            await s.commit()

        # Demo pelamar
        for em, nm, ph in [
            ("pelamar@pertacareer.id", "Ahmad Pratama", "+628111222333"),
            ("budi@pertacareer.id", "Budi Santoso", "+628112223334"),
        ]:
            if not await s.scalar(select(UserM).where(UserM.email == em)):
                s.add(UserM(
                    id=str(uuid.uuid4()), email=em, name=nm, phone=ph,
                    role="pelamar", photo_url=None,
                    password_hash=hash_password("pelamar123"),
                    created_at=now_iso(),
                ))
        await s.commit()

        # Positions
        pos_count = await s.scalar(select(func.count()).select_from(PositionM)) or 0
        if pos_count == 0:
            positions = [
                PositionM(id=str(uuid.uuid4()), title="Petroleum Engineer", department="Upstream",
                          location="Jakarta", description="Analisa reservoir & optimalisasi produksi migas.",
                          requirements=["S1 Teknik Perminyakan", "Min. 2 tahun pengalaman", "SPE diutamakan"],
                          closing_date="2026-04-30", is_open=True, created_at=now_iso()),
                PositionM(id=str(uuid.uuid4()), title="Refinery Operator", department="Downstream",
                          location="Cilacap", description="Operasikan unit kilang & jaga standar mutu/keselamatan.",
                          requirements=["D3/S1 Teknik Kimia", "Fresh graduate dipersilakan", "Bersedia shift"],
                          closing_date="2026-04-15", is_open=True, created_at=now_iso()),
                PositionM(id=str(uuid.uuid4()), title="Data Analyst", department="Corporate IT",
                          location="Jakarta", description="Bangun dashboard & analisa data operasi bisnis.",
                          requirements=["S1 IT/Statistika", "SQL, Python, BI tools", "Komunikasi baik"],
                          closing_date="2026-05-10", is_open=True, created_at=now_iso()),
            ]
            for p in positions:
                s.add(p)
            await s.commit()


@app.on_event("startup")
async def on_startup():
    try:
        await init_db()
        await migrate_mongo_to_sqlite(AsyncSessionLocal)
        await seed()
        logger.info("Startup ready (SQLite at %s).", os.environ.get("DATABASE_URL"))
    except Exception as e:
        logger.exception("Startup failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    from db import engine
    await engine.dispose()


@api.get("/")
async def root():
    return {"app": "Pertacareer Recruitment API", "status": "ok", "db": "sqlite"}
