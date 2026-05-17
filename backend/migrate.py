"""One-time data migration from MongoDB to SQLite.

Runs on startup. Idempotent: if the SQLite `users` table already has rows,
or if MongoDB is unreachable/empty, the migration is skipped silently.
"""
import os
import logging

from sqlalchemy import select, func

logger = logging.getLogger(__name__)


def _clean(doc: dict, *drop: str) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    for f in drop:
        d.pop(f, None)
    return d


async def migrate_mongo_to_sqlite(session_factory) -> None:
    from models import (
        User, Position, Application, Message, Interview, Notification,
    )

    # Skip if SQLite already has users
    async with session_factory() as s:
        existing = await s.scalar(select(func.count()).select_from(User))
        if existing and existing > 0:
            logger.info("SQLite already populated (users=%s), skip migration.", existing)
            return

    # Try to read from MongoDB
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=2000)
        mdb = client[os.environ["DB_NAME"]]
        # ping
        await client.admin.command("ping")
        n_users = await mdb.users.count_documents({})
        if n_users == 0:
            logger.info("MongoDB empty, nothing to migrate.")
            return
    except Exception as e:
        logger.warning("MongoDB not reachable, skip migration: %s", e)
        return

    logger.info("Migrating MongoDB -> SQLite (users=%s)...", n_users)

    async def copy(model, cursor, mapper):
        async with session_factory() as s:
            objs: list = []
            async for raw in cursor:
                objs.append(model(**mapper(raw)))
            if objs:
                s.add_all(objs)
                await s.commit()
        return len(objs)

    # Users
    nu = await copy(
        User,
        mdb.users.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"], "email": r["email"], "name": r["name"],
            "phone": r.get("phone"), "role": r["role"],
            "photo_url": r.get("photo_url"),
            "password_hash": r["password_hash"], "created_at": r["created_at"],
        },
    )

    # Positions
    npos = await copy(
        Position,
        mdb.positions.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"], "title": r["title"], "department": r["department"],
            "location": r["location"], "description": r["description"],
            "requirements": r.get("requirements") or [],
            "closing_date": r.get("closing_date"),
            "is_open": bool(r.get("is_open", True)),
            "created_at": r["created_at"],
        },
    )

    # Applications
    napp = await copy(
        Application,
        mdb.applications.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"],
            "applicant_id": r["applicant_id"],
            "position_id": r["position_id"],
            "education": r.get("education") or "",
            "experience_years": int(r.get("experience_years") or 0),
            "age": int(r.get("age") or 18),
            "certifications": r.get("certifications") or [],
            "cover_letter": r.get("cover_letter"),
            "cv_url": r.get("cv_url"),
            "stage": r.get("stage") or "applied",
            "history": r.get("history") or [],
            "scores": r.get("scores") or {},
            "saw_score": r.get("saw_score"),
            "applied_at": r["applied_at"],
            "updated_at": r.get("updated_at") or r["applied_at"],
        },
    )

    nmsg = await copy(
        Message,
        mdb.messages.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"], "application_id": r["application_id"],
            "sender_id": r["sender_id"], "sender_name": r["sender_name"],
            "sender_role": r["sender_role"], "text": r["text"],
            "created_at": r["created_at"],
        },
    )

    nint = await copy(
        Interview,
        mdb.interviews.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"], "application_id": r["application_id"],
            "type": r["type"], "scheduled_at": r["scheduled_at"],
            "meeting_link": r.get("meeting_link"),
            "location": r.get("location"),
            "notes": r.get("notes"),
            "created_at": r["created_at"],
        },
    )

    nnotif = await copy(
        Notification,
        mdb.notifications.find({}, {"_id": 0}),
        lambda r: {
            "id": r["id"], "user_id": r["user_id"],
            "title": r["title"], "body": r["body"],
            "read": bool(r.get("read", False)),
            "created_at": r["created_at"],
        },
    )

    logger.info(
        "Migration done. users=%s positions=%s applications=%s messages=%s interviews=%s notifications=%s",
        nu, npos, napp, nmsg, nint, nnotif,
    )
    client.close()
