"""One-time data migration from MongoDB to SQLite.

Runs on startup. Idempotent: if SQLite already has data or MongoDB is empty/unreachable,
the migration is skipped silently.
"""
import os
import logging

from sqlalchemy import select, func

logger = logging.getLogger(__name__)


# ---------- Mongo connection helpers ----------
async def _open_mongo():
    """Return (client, db) if MongoDB is reachable and has users; else (None, None)."""
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=2000)
        await client.admin.command("ping")
        mdb = client[os.environ["DB_NAME"]]
        n_users = await mdb.users.count_documents({})
        if n_users == 0:
            logger.info("MongoDB empty, nothing to migrate.")
            client.close()
            return None, None, 0
        return client, mdb, n_users
    except Exception as e:
        logger.warning("MongoDB not reachable, skip migration: %s", e)
        return None, None, 0


# ---------- Row mappers (mongo doc -> SA kwargs) ----------
def _map_user(r: dict) -> dict:
    return {
        "id": r["id"], "email": r["email"], "name": r["name"],
        "phone": r.get("phone"), "role": r["role"],
        "photo_url": r.get("photo_url"),
        "password_hash": r["password_hash"], "created_at": r["created_at"],
    }


def _map_position(r: dict) -> dict:
    return {
        "id": r["id"], "title": r["title"], "department": r["department"],
        "location": r["location"], "description": r["description"],
        "requirements": r.get("requirements") or [],
        "closing_date": r.get("closing_date"),
        "is_open": bool(r.get("is_open", True)),
        "created_at": r["created_at"],
    }


def _map_application(r: dict) -> dict:
    return {
        "id": r["id"], "applicant_id": r["applicant_id"], "position_id": r["position_id"],
        "education": r.get("education") or "",
        "experience_years": int(r.get("experience_years") or 0),
        "age": int(r.get("age") or 18),
        "certifications": r.get("certifications") or [],
        "cover_letter": r.get("cover_letter"), "cv_url": r.get("cv_url"),
        "stage": r.get("stage") or "applied",
        "history": r.get("history") or [],
        "scores": r.get("scores") or {},
        "saw_score": r.get("saw_score"),
        "applied_at": r["applied_at"],
        "updated_at": r.get("updated_at") or r["applied_at"],
    }


def _map_message(r: dict) -> dict:
    return {
        "id": r["id"], "application_id": r["application_id"],
        "sender_id": r["sender_id"], "sender_name": r["sender_name"],
        "sender_role": r["sender_role"], "text": r["text"],
        "created_at": r["created_at"],
    }


def _map_interview(r: dict) -> dict:
    return {
        "id": r["id"], "application_id": r["application_id"], "type": r["type"],
        "scheduled_at": r["scheduled_at"], "meeting_link": r.get("meeting_link"),
        "location": r.get("location"), "notes": r.get("notes"),
        "created_at": r["created_at"],
    }


def _map_notification(r: dict) -> dict:
    return {
        "id": r["id"], "user_id": r["user_id"],
        "title": r["title"], "body": r["body"],
        "read": bool(r.get("read", False)),
        "created_at": r["created_at"],
    }


# ---------- Copy helper ----------
async def _copy(session_factory, model, cursor, mapper) -> int:
    async with session_factory() as s:
        objs = [model(**mapper(raw)) async for raw in cursor]
        if objs:
            s.add_all(objs)
            await s.commit()
        return len(objs)


# ---------- Entry point ----------
async def migrate_mongo_to_sqlite(session_factory) -> None:
    from models import (
        User, Position, Application, Message, Interview, Notification,
    )

    # Already migrated?
    async with session_factory() as s:
        existing = await s.scalar(select(func.count()).select_from(User))
    if existing and existing > 0:
        logger.info("SQLite already populated (users=%s), skip migration.", existing)
        return

    client, mdb, n_users = await _open_mongo()
    if mdb is None:
        return

    logger.info("Migrating MongoDB -> SQLite (users=%s)...", n_users)
    try:
        counts = {
            "users":         await _copy(session_factory, User, mdb.users.find({}, {"_id": 0}), _map_user),
            "positions":     await _copy(session_factory, Position, mdb.positions.find({}, {"_id": 0}), _map_position),
            "applications":  await _copy(session_factory, Application, mdb.applications.find({}, {"_id": 0}), _map_application),
            "messages":      await _copy(session_factory, Message, mdb.messages.find({}, {"_id": 0}), _map_message),
            "interviews":    await _copy(session_factory, Interview, mdb.interviews.find({}, {"_id": 0}), _map_interview),
            "notifications": await _copy(session_factory, Notification, mdb.notifications.find({}, {"_id": 0}), _map_notification),
        }
        logger.info("Migration done. %s", " ".join(f"{k}={v}" for k, v in counts.items()))
    finally:
        client.close()
