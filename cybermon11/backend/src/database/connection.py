from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Boolean, Text, DateTime, JSON, ForeignKey, UUID as SQLUUID
from datetime import datetime
import uuid
from src.config.settings import settings

engine = create_async_engine(
    settings.DATABASE_URL, echo=False, pool_pre_ping=True,
    pool_size=20, max_overflow=40  # larger pool for concurrent writes
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id:            Mapped[uuid.UUID]       = mapped_column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name:          Mapped[str]             = mapped_column(String(100))
    email:         Mapped[str]             = mapped_column(String(255), unique=True)
    password_hash: Mapped[str]             = mapped_column(String(255))
    role:          Mapped[str]             = mapped_column(String(30), default="user")
    status:        Mapped[str]             = mapped_column(String(20), default="offline")
    created_at:    Mapped[datetime]        = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_login:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Event(Base):
    __tablename__ = "events"
    id:            Mapped[uuid.UUID]       = mapped_column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:       Mapped[str | None]      = mapped_column(String(100), nullable=True)
    ip:            Mapped[str]             = mapped_column(String(45))
    action:        Mapped[str]             = mapped_column(String(50))
    status:        Mapped[str]             = mapped_column(String(20))
    risk_score:    Mapped[int]             = mapped_column(Integer, default=0)
    category:      Mapped[str]             = mapped_column(String(20))
    country:       Mapped[str | None]      = mapped_column(String(5), nullable=True)
    details:       Mapped[dict]            = mapped_column(JSON, default=dict)
    sim_timestamp: Mapped[datetime]        = mapped_column(DateTime(timezone=True))
    created_at:    Mapped[datetime]        = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Blacklist(Base):
    __tablename__ = "blacklist"
    id:           Mapped[uuid.UUID]        = mapped_column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip:           Mapped[str]              = mapped_column(String(45), unique=True)
    reason:       Mapped[str]              = mapped_column(Text)
    threat_level: Mapped[str]              = mapped_column(String(20), default="WARNING")
    auto_blocked: Mapped[bool]             = mapped_column(Boolean, default=False)
    event_type:   Mapped[str | None]       = mapped_column(String(50), nullable=True)
    added_by:     Mapped[uuid.UUID | None] = mapped_column(SQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    expires_at:   Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)
    created_at:   Mapped[datetime]         = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id:         Mapped[uuid.UUID]        = mapped_column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id:   Mapped[uuid.UUID | None] = mapped_column(SQLUUID(as_uuid=True), ForeignKey("events.id"), nullable=True)
    level:      Mapped[str]              = mapped_column(String(20))
    message:    Mapped[str]              = mapped_column(Text)
    ip:         Mapped[str | None]       = mapped_column(String(45), nullable=True)
    is_read:    Mapped[bool]             = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime]         = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"
    id:          Mapped[uuid.UUID] = mapped_column(SQLUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:     Mapped[uuid.UUID] = mapped_column(SQLUUID(as_uuid=True), ForeignKey("users.id"))
    device:      Mapped[str | None]= mapped_column(String(255), nullable=True)
    ip:          Mapped[str | None]= mapped_column(String(45), nullable=True)
    last_active: Mapped[datetime]  = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    is_active:   Mapped[bool]      = mapped_column(Boolean, default=True)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

class NotifPrefs(Base):
    __tablename__ = "notif_prefs"
    id:             Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:        Mapped[uuid.UUID]     = mapped_column(SQLUUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    alerts_enabled: Mapped[bool]          = mapped_column(Boolean, default=True)
    email_enabled:  Mapped[bool]          = mapped_column(Boolean, default=False)
    critical_only:  Mapped[bool]          = mapped_column(Boolean, default=False)
