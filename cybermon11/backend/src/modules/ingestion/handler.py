"""Ingestion — batch-friendly, non-blocking DB writes"""
import logging
from datetime import datetime, timezone
from src.database.connection import AsyncSessionLocal, Event
from src.database.redis_client import get_redis

logger = logging.getLogger("ingestion")

async def ingest_event(event: dict):
    if event.get("__type"):
        return  # skip meta-events
    try:
        async with AsyncSessionLocal() as db:
            db_event = Event(
                ip=event["ip"],
                user_id=event.get("user_id"),
                action=event["action"],
                status=event["status"],
                risk_score=event["risk_score"],
                category=event["category"],
                country=event.get("country"),
                details=event.get("details", {}),
                sim_timestamp=datetime.fromisoformat(event["sim_timestamp"]),
                created_at=datetime.now(timezone.utc),
            )
            db.add(db_event)
            await db.commit()
            event["db_id"] = str(db_event.id)
    except Exception as e:
        logger.debug(f"Ingest error: {e}")
    # Update Redis counters (best-effort)
    try:
        redis = await get_redis()
        pipe = redis.pipeline()
        pipe.incr("stats:total_events")
        pipe.incr(f"stats:category:{event.get('category','UNKNOWN')}")
        if event.get("country"):
            pipe.incr(f"stats:country:{event['country']}")
        await pipe.execute()
    except Exception:
        pass
