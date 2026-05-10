"""CYBERMON FastAPI Application v9 — clean startup, guaranteed admin account"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from src.database.connection import engine, Base, Blacklist, User
from src.modules.simulation.engine import simulation_engine
from src.modules.ingestion.handler import ingest_event
from src.modules.detection.engine import detect
from src.modules.api.websocket_manager import ws_manager, broadcast_event
from src.modules.api.routes import router

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s")
logger = logging.getLogger("cybermon")


async def ensure_admin():
    """Guarantee admin account exists, regardless of init.sql execution."""
    from src.database.connection import AsyncSessionLocal
    from src.modules.auth.auth import hash_password

    ADMIN_EMAIL = "azizarfaoui678@gmail.com"
    ADMIN_PASS  = "AzizArfa1234@@"
    ADMIN_NAME  = "Admin"

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if not res.scalar_one_or_none():
            admin = User(
                name=ADMIN_NAME,
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASS),
                role="admin",
                status="offline"
            )
            db.add(admin)
            await db.commit()
            logger.info(f"Admin account created: {ADMIN_EMAIL}")
        else:
            logger.info(f"Admin account already exists: {ADMIN_EMAIL}")


async def handle_sim_ended():
    """Send daily report when simulation reaches 23:59:59."""
    logger.info("Simulation complete — daily report available via /api/report endpoint")
    try:
        await send_daily_report(stats)
        from src.database.connection import AsyncSessionLocal, Event, Alert, Blacklist
        from sqlalchemy import func, desc
        from datetime import datetime, timezone

        day_start = datetime(2024, 1, 1, 0,  0,  0, tzinfo=timezone.utc)
        day_end   = datetime(2024, 1, 1, 23, 59, 59, tzinfo=timezone.utc)

        async with AsyncSessionLocal() as db:
            total    = (await db.execute(select(func.count()).where(
                Event.sim_timestamp.between(day_start, day_end)))).scalar() or 0
            avg_risk = (await db.execute(select(func.avg(Event.risk_score)).where(
                Event.sim_timestamp.between(day_start, day_end)))).scalar() or 0.0
            cats_res = await db.execute(
                select(Event.category, func.count())
                .where(Event.sim_timestamp.between(day_start, day_end))
                .group_by(Event.category))
            cats = {r[0]: r[1] for r in cats_res.fetchall()}
            top5_res = await db.execute(
                select(Event.country, func.count().label("c"),
                       func.avg(Event.risk_score).label("a"))
                .where(Event.sim_timestamp.between(day_start, day_end))
                .where(Event.country != None)
                .group_by(Event.country).order_by(desc("c")).limit(5))
            top5 = [{"code": r[0], "count": r[1], "avg_risk": round(r[2] or 0, 1)}
                    for r in top5_res.fetchall()]
            alerts_res = await db.execute(
                select(Alert.level, Alert.message, Alert.ip)
                .order_by(desc(Alert.created_at)).limit(20))
            alerts_list = [{"level": r[0], "message": r[1], "ip": r[2]}
                           for r in alerts_res.fetchall()]
            bl_count      = (await db.execute(select(func.count()).select_from(Blacklist))).scalar() or 0
            active_alerts = (await db.execute(select(func.count()).select_from(Alert)
                             .where(Alert.is_read == False))).scalar() or 0

        stats = {
            "total_events": total, "avg_risk": float(avg_risk),
            "categories": cats, "top_countries": top5,
            "recent_alerts": alerts_list, "blocked_ips": bl_count,
            "active_alerts": active_alerts,
        }
        # Report is available via GET /api/report — no email needed
        import logging
        logging.getLogger('cybermon').info(
            f"Daily report ready: {stats['total_events']} events, "
            f"avg risk {stats['avg_risk']:.1f}"
        )
    except Exception as e:
        logger.error(f"Daily report error: {e}", exc_info=True)


async def _dispatch(event: dict):
    """Dispatch a single event to all consumers."""
    if event.get("__type") == "sim_ended":
        asyncio.create_task(handle_sim_ended())
        await ws_manager.broadcast({"type": "control", "data": {"sim_ended": True}})
        return
    await ingest_event(event)
    await detect(event)
    await broadcast_event(event)


async def _sim_loop():
    """Main simulation loop — runs forever, idle until started."""
    from datetime import datetime, timezone
    logger.info("Simulation loop started (idle)")

    while True:
        try:
            if simulation_engine.running and not simulation_engine.paused:
                # Advance fake clock
                sim = simulation_engine
                if sim._real_start is None:
                    sim._real_start = datetime.now(timezone.utc)

                now_real = datetime.now(timezone.utc)
                real_dt  = (now_real - sim._real_start).total_seconds()
                sim._real_start  = now_real
                sim._sim_elapsed += real_dt * sim.time_scale

                # 24h cap
                if sim._sim_elapsed >= 86400:
                    sim._sim_elapsed = 86400
                    sim.running      = False
                    sim.paused       = False
                    logger.info("Simulation complete — 23:59:59 reached")
                    await _dispatch({"__type": "sim_ended"})
                    await asyncio.sleep(1)
                    continue

                # Generate events for this tick
                evs = await sim._tick()
                for e in evs:
                    await _dispatch(e)

                sleep_t = max(0.05, 1.0 / max(1, sim.time_scale / 10))
                await asyncio.sleep(sleep_t)
            else:
                # Idle — check often for start signal
                await asyncio.sleep(0.2)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Sim loop error: {e}", exc_info=True)
            await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CYBERMON v9 starting up...")

    # Create all DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Guarantee admin account exists
    await ensure_admin()

    # Load blacklisted IPs
    from src.database.connection import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Blacklist.ip))
        ips = {r[0] for r in res.fetchall()}
        simulation_engine.update_blacklist(ips)
        logger.info(f"Loaded {len(ips)} blacklisted IPs")

    # Start sim loop
    sim_task = asyncio.create_task(_sim_loop())
    logger.info("✅ CYBERMON ready — login: azizarfaoui678@gmail.com / AzizArfa1234@@")

    yield

    simulation_engine.running = False
    sim_task.cancel()
    try:
        await asyncio.wait_for(sim_task, timeout=2.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    await engine.dispose()
    logger.info("CYBERMON shut down cleanly.")


app = FastAPI(
    title="CYBERMON Sentinel API",
    version="9.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"service": "CYBERMON Sentinel", "status": "OPERATIONAL", "version": "9.0.0"}


@app.get("/health")
async def health():
    try:
        from src.database.redis_client import get_redis
        redis = await get_redis()
        await redis.ping()
        return {
            "status": "ok",
            "redis":  "connected",
            "sim_running": simulation_engine.running,
            "total_events": simulation_engine.total_events
        }
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=20.0)
                if data == "ping":
                    await ws.send_text('{"type":"pong"}')
            except asyncio.TimeoutError:
                try:
                    await ws.send_text('{"type":"ping"}')
                except Exception:
                    break
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        ws_manager.disconnect(ws)
