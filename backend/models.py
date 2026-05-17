"""SQLAlchemy models for Pertacareer.

All ids are UUID strings (matches the legacy MongoDB schema).
Datetimes are stored as ISO 8601 strings for portability.
Nested data (history / scores / requirements / certifications) uses JSON columns.
"""
from typing import Optional
from sqlalchemy import ForeignKey, JSON, Text, Boolean, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str]
    phone: Mapped[Optional[str]] = mapped_column(default=None)
    role: Mapped[str]  # 'hr' | 'pelamar'
    photo_url: Mapped[Optional[str]] = mapped_column(default=None)
    password_hash: Mapped[str]
    created_at: Mapped[str]


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[str] = mapped_column(primary_key=True)
    title: Mapped[str]
    department: Mapped[str]
    location: Mapped[str]
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[list] = mapped_column(JSON, default=list)
    closing_date: Mapped[Optional[str]] = mapped_column(default=None)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str]


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(primary_key=True)
    applicant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    position_id: Mapped[str] = mapped_column(ForeignKey("positions.id"), index=True)
    education: Mapped[str]
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    age: Mapped[int] = mapped_column(Integer, default=18)
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, default=None)
    cv_url: Mapped[Optional[str]] = mapped_column(default=None)
    stage: Mapped[str] = mapped_column(default="applied")
    history: Mapped[list] = mapped_column(JSON, default=list)
    scores: Mapped[dict] = mapped_column(JSON, default=dict)
    saw_score: Mapped[Optional[float]] = mapped_column(Float, default=None)
    applied_at: Mapped[str]
    updated_at: Mapped[str]

    applicant: Mapped["User"] = relationship(lazy="selectin")
    position: Mapped["Position"] = relationship(lazy="selectin")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    sender_name: Mapped[str]
    sender_role: Mapped[str]
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str]


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[str] = mapped_column(primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), index=True)
    type: Mapped[str]
    scheduled_at: Mapped[str]
    meeting_link: Mapped[Optional[str]] = mapped_column(default=None)
    location: Mapped[Optional[str]] = mapped_column(default=None)
    notes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    created_at: Mapped[str]


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str]
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str]
