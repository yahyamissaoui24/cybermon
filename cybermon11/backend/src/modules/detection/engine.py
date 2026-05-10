"""Detection Engine v3 — auto-blacklist with event_type tracking"""
import logging, asyncio
from src.database.connection import AsyncSessionLocal, Alert, Blacklist
from src.database.redis_client import get_redis

logger = logging.getLogger("detection")

BRUTE_THRESHOLD     = 5
SUSPICIOUS_THRESHOLD = 10
PORT_SCAN_THRESHOLD = 4

async def detect(event: dict):
    if event.get("__type") == "sim_ended":
        return
    try:
        redis   = await get_redis()
        cat     = event["category"]
        ip      = event["ip"]
        action  = event["action"]
        alert   = None

        if cat == "CRITICAL":
            alert = {"level":"CRITICAL","message":f"Critical threat: {action} from {ip}","ip":ip,"event_id":event.get("db_id")}
        elif cat == "ATTACK":
            alert = {"level":"ATTACK","message":f"Attack detected: {action} from {ip}","ip":ip,"event_id":event.get("db_id")}

        if action in ("LOGIN_FAILED","BRUTE_FORCE"):
            key = f"detect:brute:{ip}"
            cnt = await redis.incr(key); await redis.expire(key,300)
            if cnt == BRUTE_THRESHOLD:
                alert = {"level":"CRITICAL","message":f"Brute force from {ip} — {cnt} attempts","ip":ip}
                await _auto_blacklist(ip, "Auto-blocked: Brute Force", "CRITICAL", "BRUTE_FORCE")

        if action == "PORT_SCAN":
            key = f"detect:portscan:{ip}"
            cnt = await redis.incr(key); await redis.expire(key,120)
            if cnt == PORT_SCAN_THRESHOLD:
                alert = {"level":"ATTACK","message":f"Port scan from {ip} — {cnt} ports","ip":ip}
                await _auto_blacklist(ip, "Auto-blocked: Port Scan", "WARNING", "PORT_SCAN")

        if action == "DDoS":
            key = f"detect:ddos_count"; cnt = await redis.incr(key); await redis.expire(key,60)
            if cnt % 10 == 0:
                alert = {"level":"CRITICAL","message":f"DDoS flood — {cnt} vectors in 60s","ip":ip}

        if cat == "SUSPICIOUS":
            key = f"detect:susp:{ip}"; cnt = await redis.incr(key); await redis.expire(key,300)
            if cnt >= SUSPICIOUS_THRESHOLD:
                alert = {"level":"CRITICAL","message":f"Suspicious activity from {ip} — {cnt} requests","ip":ip}

        if alert:
            await _save_alert(alert)
            
                

    except Exception as e:
        logger.error(f"Detection error: {e}")

async def _auto_blacklist(ip, reason, level, event_type):
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            existing = await db.execute(select(Blacklist).where(Blacklist.ip == ip))
            if existing.scalar_one_or_none(): return
            bl = Blacklist(ip=ip, reason=reason, threat_level=level,
                           auto_blocked=True, event_type=event_type)
            db.add(bl); await db.commit()
            from src.modules.simulation.engine import simulation_engine
            simulation_engine.blacklisted_ips.add(ip)
    except Exception as e:
        logger.error(f"Auto-blacklist error: {e}")

async def _save_alert(alert: dict):
    try:
        async with AsyncSessionLocal() as db:
            db_alert = Alert(level=alert["level"], message=alert["message"], ip=alert.get("ip"), is_read=False)
            db.add(db_alert); await db.commit()
    except Exception as e:
        logger.error(f"Alert save error: {e}")
