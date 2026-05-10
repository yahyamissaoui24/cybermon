"""CYBERMON API Routes v9 — clean, complete"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid

from src.database.connection import get_db, Event, Alert, Blacklist, User, Session
from src.database.redis_client import get_redis
from src.modules.auth.auth import (get_current_user, require_admin,
                                    hash_password, verify_password, create_token)
from src.modules.simulation.engine import simulation_engine

router = APIRouter()

def _utcnow():
    return datetime.now(timezone.utc)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AUTH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

@router.post("/auth/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == body.email))
    user = res.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.last_login = _utcnow()
    user.status     = "active"
    await db.commit()
    token = create_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token, "token_type": "bearer",
        "user": {"id": str(user.id), "name": user.name,
                 "email": user.email, "role": user.role}
    }

@router.post("/auth/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    ex = await db.execute(select(User).where(User.email == body.email))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    # Self-register always gets role=user
    u = User(name=body.name, email=body.email,
             password_hash=hash_password(body.password),
             role="user", status="offline")
    db.add(u)
    await db.commit()
    return {"message": "Account created. You can now log in."}

@router.post("/auth/logout")
async def logout(db: AsyncSession = Depends(get_db),
                 user: User = Depends(get_current_user)):
    user.status = "offline"
    await db.commit()
    return {"ok": True}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EVENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/events")
async def get_events(
    page:     int           = Query(1, ge=1),
    limit:    int           = Query(25, ge=1, le=100),
    category: Optional[str] = None,
    ip:       Optional[str] = None,
    min_risk: Optional[int] = None,
    country:  Optional[str] = None,
    db:   AsyncSession      = Depends(get_db),
    _:    User              = Depends(get_current_user),
):
    q = select(Event).order_by(desc(Event.sim_timestamp))
    if category and category not in ("", "All Events"):
        q = q.where(Event.category == category)
    if ip:
        q = q.where(Event.ip.contains(ip))
    if min_risk and min_risk > 0:
        q = q.where(Event.risk_score >= min_risk)
    if country:
        q = q.where(Event.country == country)

    total  = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    result = await db.execute(q.offset((page - 1) * limit).limit(limit))
    events = result.scalars().all()

    bl_res = await db.execute(select(Blacklist.ip))
    bl_ips = {r[0] for r in bl_res.fetchall()}

    return {
        "events": [_ev(e, bl_ips) for e in events],
        "total": total, "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }

@router.get("/events/timeline")
async def get_timeline(
    db: AsyncSession = Depends(get_db),
    _: User          = Depends(get_current_user),
):
    q = (select(Event.sim_timestamp, Event.risk_score, Event.action, Event.category)
         .order_by(Event.sim_timestamp).limit(500))
    rows = (await db.execute(q)).fetchall()
    return [{"t": r[0].isoformat(), "risk": r[1], "action": r[2], "category": r[3]}
            for r in rows]

def _ev(e: Event, bl_ips: set = None) -> dict:
    status = "BLOCKED" if (bl_ips and e.ip in bl_ips) else e.status
    return {
        "id": str(e.id), "ip": e.ip, "user_id": e.user_id,
        "action": e.action, "status": status,
        "risk_score": e.risk_score, "category": e.category,
        "country": e.country, "details": e.details,
        "sim_timestamp": e.sim_timestamp.isoformat() if e.sim_timestamp else None,
    }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STATS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db),
                    _: User = Depends(get_current_user)):
    day_start = datetime(2024, 1, 1, 0,  0,  0, tzinfo=timezone.utc)
    day_end   = datetime(2024, 1, 1, 23, 59, 59, tzinfo=timezone.utc)

    total_24h = (await db.execute(
        select(func.count()).where(Event.sim_timestamp.between(day_start, day_end))
    )).scalar() or 0

    active_alerts = (await db.execute(
        select(func.count()).select_from(Alert)
        .where(Alert.is_read == False)
        .where(Alert.level.in_(["ATTACK", "CRITICAL"]))
    )).scalar() or 0

    all_unread = (await db.execute(
        select(func.count()).select_from(Alert).where(Alert.is_read == False)
    )).scalar() or 0

    blocked_24h = (await db.execute(
        select(func.count()).select_from(Blacklist)
    )).scalar() or 0

    avg_risk = (await db.execute(
        select(func.avg(Event.risk_score))
        .where(Event.sim_timestamp.between(day_start, day_end))
    )).scalar() or 0.0

    cats_res = await db.execute(
        select(Event.category, func.count())
        .where(Event.sim_timestamp.between(day_start, day_end))
        .group_by(Event.category))
    cats = {r[0]: r[1] for r in cats_res.fetchall()}

    top5_res = await db.execute(
        select(Event.country, func.count().label("cnt"),
               func.avg(Event.risk_score).label("avg_r"))
        .where(Event.sim_timestamp.between(day_start, day_end))
        .where(Event.country != None)
        .group_by(Event.country)
        .order_by(desc("cnt")).limit(5))
    top5 = [{"code": r[0], "count": r[1], "avg_risk": round(r[2] or 0, 1)}
            for r in top5_res.fetchall()]

    sim = simulation_engine.get_stats()
    return {
        "total_events_24h": total_24h,
        "active_alerts":     active_alerts,
        "all_unread_alerts": all_unread,
        "blocked_24h":       blocked_24h,
        "avg_risk":          round(float(avg_risk), 1),
        "categories":        cats,
        "top_countries":     top5,
        "sim_running":       sim["running"],
        "sim_time":          sim["sim_time"],
        "sim_progress":      sim["sim_progress"],
        "time_scale":        sim["time_scale"],
    }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ALERTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/alerts")
async def get_alerts(unread_only: bool = False,
                     db: AsyncSession = Depends(get_db),
                     _: User = Depends(get_current_user)):
    q = select(Alert).order_by(desc(Alert.created_at))
    if unread_only:
        q = q.where(Alert.is_read == False)
    res = await db.execute(q.limit(100))
    return [_al(a) for a in res.scalars().all()]

@router.patch("/alerts/{alert_id}/read")
async def mark_read(alert_id: str, db: AsyncSession = Depends(get_db),
                    _: User = Depends(get_current_user)):
    r = await db.execute(select(Alert).where(Alert.id == uuid.UUID(alert_id)))
    a = r.scalar_one_or_none()
    if a:
        a.is_read = True
        await db.commit()
    return {"ok": True}

@router.patch("/alerts/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db),
                        _: User = Depends(get_current_user)):
    await db.execute(text("UPDATE alerts SET is_read=TRUE WHERE is_read=FALSE"))
    await db.commit()
    return {"ok": True}

@router.delete("/alerts/clear")
async def clear_alerts(db: AsyncSession = Depends(get_db),
                       _: User = Depends(get_current_user)):
    await db.execute(text("DELETE FROM alerts"))
    await db.commit()
    return {"ok": True}

def _al(a: Alert) -> dict:
    return {"id": str(a.id), "level": a.level, "message": a.message,
            "ip": a.ip, "is_read": a.is_read,
            "created_at": a.created_at.isoformat() if a.created_at else None}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLACKLIST
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class BLAdd(BaseModel):
    ip: str
    reason: str
    threat_level: str = "WARNING"
    event_type: Optional[str] = None
    auto_blocked: bool = False

@router.get("/blacklist")
async def get_bl(db: AsyncSession = Depends(get_db),
                 _: User = Depends(get_current_user)):
    res = await db.execute(select(Blacklist).order_by(desc(Blacklist.created_at)))
    return [_bl(b) for b in res.scalars().all()]

@router.post("/blacklist")
async def add_bl(body: BLAdd, db: AsyncSession = Depends(get_db),
                 user: User = Depends(get_current_user)):
    ex = await db.execute(select(Blacklist).where(Blacklist.ip == body.ip))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="IP already blacklisted")
    b = Blacklist(ip=body.ip, reason=body.reason, threat_level=body.threat_level,
                  auto_blocked=body.auto_blocked, event_type=body.event_type,
                  added_by=user.id)
    db.add(b)
    await db.commit()
    simulation_engine.blacklisted_ips.add(body.ip)
    return _bl(b)

@router.delete("/blacklist/{ip}")
async def remove_bl(ip: str, db: AsyncSession = Depends(get_db),
                    _: User = Depends(get_current_user)):
    r = await db.execute(select(Blacklist).where(Blacklist.ip == ip))
    b = r.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(b)
    await db.commit()
    simulation_engine.blacklisted_ips.discard(ip)
    return {"ok": True}

@router.get("/blacklist/stats")
async def bl_stats(db: AsyncSession = Depends(get_db),
                   _: User = Depends(get_current_user)):
    total = (await db.execute(select(func.count()).select_from(Blacklist))).scalar() or 0
    auto  = (await db.execute(
        select(func.count()).select_from(Blacklist)
        .where(Blacklist.auto_blocked == True))).scalar() or 0
    top_r = await db.execute(
        select(Blacklist.event_type, func.count().label("c"))
        .where(Blacklist.event_type != None)
        .group_by(Blacklist.event_type).order_by(desc("c")).limit(1))
    row = top_r.fetchone()
    return {"total": total, "auto_blocked": auto,
            "top_event_type": row[0] if row else "—"}

def _bl(b: Blacklist) -> dict:
    return {"id": str(b.id), "ip": b.ip, "reason": b.reason,
            "threat_level": b.threat_level, "auto_blocked": b.auto_blocked,
            "event_type": b.event_type,
            "created_at": b.created_at.isoformat() if b.created_at else None}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# USERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "analyst"

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    res = await db.execute(select(User).order_by(User.created_at))
    return [_usr(u) for u in res.scalars().all()]

@router.post("/users")
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db),
                      _: User = Depends(require_admin)):
    ex = await db.execute(select(User).where(User.email == body.email))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    u = User(name=body.name, email=body.email,
             password_hash=hash_password(body.password), role=body.role)
    db.add(u)
    await db.commit()
    return _usr(u)

@router.patch("/users/{uid}/disable")
async def disable_user(uid: str, db: AsyncSession = Depends(get_db),
                       _: User = Depends(require_admin)):
    r = await db.execute(select(User).where(User.id == uuid.UUID(uid)))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    u.status = "disabled"
    await db.commit()
    return {"ok": True}

@router.delete("/users/{uid}")
async def delete_user(uid: str, db: AsyncSession = Depends(get_db),
                      me: User = Depends(require_admin)):
    if str(me.id) == uid:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    r = await db.execute(select(User).where(User.id == uuid.UUID(uid)))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(u)
    await db.commit()
    return {"ok": True}

def _usr(u: User) -> dict:
    return {"id": str(u.id), "name": u.name, "email": u.email,
            "role": u.role, "status": u.status,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SIMULATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/simulation/start")
async def start_sim(_: User = Depends(get_current_user)):
    simulation_engine.start()
    return {"running": True, "sim_time": simulation_engine.sim_time_str}

@router.post("/simulation/pause")
async def pause_sim(_: User = Depends(get_current_user)):
    simulation_engine.paused = True
    return {"paused": True}

@router.post("/simulation/resume")
async def resume_sim(_: User = Depends(get_current_user)):
    if simulation_engine.paused and simulation_engine._sim_elapsed < 86400:
        simulation_engine.paused  = False
        simulation_engine.running = True
    return {"paused": False}

@router.post("/simulation/stop")
async def stop_sim(_: User = Depends(get_current_user)):
    simulation_engine.running = False
    simulation_engine.paused  = False
    return {"running": False}

@router.post("/simulation/scale/{scale}")
async def set_scale(scale: int, _: User = Depends(get_current_user)):
    if scale not in (1, 10, 60, 1440):
        raise HTTPException(status_code=400, detail="Scale must be 1, 10, 60 or 1440")
    simulation_engine.set_time_scale(scale)
    return {"time_scale": scale}

@router.get("/simulation/status")
async def sim_status(_: User = Depends(get_current_user)):
    return simulation_engine.get_stats()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SETTINGS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ThresholdsUpdate(BaseModel):
    normal: int = 0
    suspicious: int = 30
    attack: int = 60
    critical: int = 85

@router.get("/settings/thresholds")
async def get_thresh(db: AsyncSession = Depends(get_db),
                     _: User = Depends(get_current_user)):
    r = await db.execute(
        text("SELECT key, value FROM sim_config WHERE key LIKE 'threshold_%'"))
    return {row[0].replace("threshold_", ""): int(row[1]) for row in r.fetchall()}

@router.patch("/settings/thresholds")
async def update_thresh(body: ThresholdsUpdate,
                        db: AsyncSession = Depends(get_db),
                        _: User = Depends(require_admin)):
    for cat, val in [("normal", body.normal), ("suspicious", body.suspicious),
                     ("attack", body.attack), ("critical", body.critical)]:
        await db.execute(
            text("UPDATE sim_config SET value=:v WHERE key=:k"),
            {"v": str(val), "k": f"threshold_{cat}"})
    await db.commit()
    simulation_engine.update_thresholds(
        body.normal, body.suspicious, body.attack, body.critical)
    return {"ok": True}

class ProfileUpdate(BaseModel):
    name:     Optional[str] = None
    email:    Optional[str] = None
    password: Optional[str] = None

@router.patch("/settings/profile")
async def update_profile(body: ProfileUpdate,
                         db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    if body.name:     user.name          = body.name
    if body.email:    user.email         = body.email
    if body.password: user.password_hash = hash_password(body.password)
    await db.commit()
    return _usr(user)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTIFICATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class NotifPrefsUpdate(BaseModel):
    alerts_enabled: bool = True
    email_enabled:  bool = False
    critical_only:  bool = False

@router.get("/settings/notifications")
async def get_notif_prefs(db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    r = await db.execute(
        text("SELECT alerts_enabled, email_enabled, critical_only "
             "FROM notif_prefs WHERE user_id=:uid"),
        {"uid": user.id})
    row = r.fetchone()
    if row:
        return {"alerts_enabled": row[0], "email_enabled": row[1], "critical_only": row[2]}
    return {"alerts_enabled": True, "email_enabled": False, "critical_only": False}

@router.patch("/settings/notifications")
async def save_notif_prefs(body: NotifPrefsUpdate,
                           db: AsyncSession = Depends(get_db),
                           user: User = Depends(get_current_user)):
    await db.execute(text("""
        INSERT INTO notif_prefs (user_id, alerts_enabled, email_enabled, critical_only)
        VALUES (:uid, :ae, :ee, :co)
        ON CONFLICT (user_id) DO UPDATE
        SET alerts_enabled=:ae, email_enabled=:ee, critical_only=:co
    """), {"uid": user.id, "ae": body.alerts_enabled,
           "ee": body.email_enabled, "co": body.critical_only})
    await db.commit()
    return {"ok": True}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DAILY REPORT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/report")
async def get_daily_report(
    db:  AsyncSession = Depends(get_db),
    _:   User         = Depends(get_current_user),
):
    """Return full day statistics for the in-app report modal."""
    day_start = datetime(2024, 1, 1, 0,  0,  0, tzinfo=timezone.utc)
    day_end   = datetime(2024, 1, 1, 23, 59, 59, tzinfo=timezone.utc)

    total = (await db.execute(
        select(func.count())
        .where(Event.sim_timestamp.between(day_start, day_end))
    )).scalar() or 0

    avg_risk = (await db.execute(
        select(func.avg(Event.risk_score))
        .where(Event.sim_timestamp.between(day_start, day_end))
    )).scalar() or 0.0

    cats_res = await db.execute(
        select(Event.category, func.count())
        .where(Event.sim_timestamp.between(day_start, day_end))
        .group_by(Event.category))
    cats = {r[0]: r[1] for r in cats_res.fetchall()}

    top5_res = await db.execute(
        select(Event.country,
               func.count().label("cnt"),
               func.avg(Event.risk_score).label("avg_r"))
        .where(Event.sim_timestamp.between(day_start, day_end))
        .where(Event.country != None)
        .group_by(Event.country)
        .order_by(desc("cnt")).limit(5))
    top5 = [{"code": r[0], "count": r[1], "avg_risk": round(r[2] or 0, 1)}
            for r in top5_res.fetchall()]

    # Top attacking IPs
    top_ips_res = await db.execute(
        select(Event.ip, func.count().label("cnt"),
               func.max(Event.risk_score).label("max_r"),
               Event.country)
        .where(Event.sim_timestamp.between(day_start, day_end))
        .where(Event.category.in_(["ATTACK","CRITICAL"]))
        .group_by(Event.ip, Event.country)
        .order_by(desc("cnt")).limit(10))
    top_ips = [{"ip": r[0], "count": r[1], "max_risk": r[2], "country": r[3]}
               for r in top_ips_res.fetchall()]

    # Recent critical alerts
    alerts_res = await db.execute(
        select(Alert.level, Alert.message, Alert.ip, Alert.created_at)
        .where(Alert.level.in_(["ATTACK","CRITICAL"]))
        .order_by(desc(Alert.created_at)).limit(15))
    alerts = [{"level": r[0], "message": r[1], "ip": r[2],
               "created_at": r[3].isoformat() if r[3] else None}
              for r in alerts_res.fetchall()]

    bl_count = (await db.execute(
        select(func.count()).select_from(Blacklist)
    )).scalar() or 0

    sim = simulation_engine.get_stats()

    return {
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "sim_time":       sim["sim_time"],
        "sim_complete":   sim["sim_progress"] >= 99.9,
        "total_events":   total,
        "avg_risk":       round(float(avg_risk), 1),
        "categories":     cats,
        "top_countries":  top5,
        "top_ips":        top_ips,
        "recent_alerts":  alerts,
        "blocked_ips":    bl_count,
    }
