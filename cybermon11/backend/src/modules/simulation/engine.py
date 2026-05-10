"""
CYBERMON Simulation Engine v7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fake 24h clock: 00:00:00 → 23:59:59
Scales: ×1 / ×10 / ×60 / ×1440
×1440 = full simulated day in 1 real minute
"""
import asyncio, random, math, uuid, logging
from datetime import datetime, timezone

logger = logging.getLogger("simulation")

EVENT_TYPES = {
    "LOGIN_SUCCESS":        {"category": "NORMAL",    "base_score": 5},
    "LOGOUT":               {"category": "NORMAL",    "base_score": 2},
    "HTTP_REQUEST":         {"category": "NORMAL",    "base_score": 3},
    "FILE_ACCESS":          {"category": "NORMAL",    "base_score": 5},
    "LOGIN_FAILED":         {"category": "SUSPICIOUS","base_score": 30},
    "UNKNOWN_IP_ACCESS":    {"category": "SUSPICIOUS","base_score": 35},
    "UNUSUAL_HOUR_LOGIN":   {"category": "SUSPICIOUS","base_score": 45},
    "PORT_SCAN":            {"category": "ATTACK",    "base_score": 60},
    "BRUTE_FORCE":          {"category": "ATTACK",    "base_score": 80},
    "DDoS":                 {"category": "ATTACK",    "base_score": 75},
    "SQL_INJECTION":        {"category": "ATTACK",    "base_score": 85},
    "PRIVILEGE_ESCALATION": {"category": "CRITICAL",  "base_score": 90},
    "DATA_EXFILTRATION":    {"category": "CRITICAL",  "base_score": 95},
    "MALWARE_DETECTED":     {"category": "CRITICAL",  "base_score": 92},
}

MALICIOUS = [
    ("45.155.205.", "RU"), ("91.108.4.",   "RU"), ("185.220.101.", "RU"),
    ("45.33.32.",   "CN"), ("103.21.244.", "CN"), ("203.0.113.",   "CN"),
    ("185.220.100.","BR"), ("198.235.24.", "BR"),
    ("94.102.49.",  "DE"), ("77.24.110.",  "DE"),
    ("46.101.166.", "NL"), ("167.99.146.", "FR"),
    ("1.179.112.",  "KR"), ("180.97.251.", "TW"),
    ("41.190.200.", "NG"), ("196.200.145.","ZA"),
]
LEGIT = [
    ("10.0.0.",    "US"), ("192.168.1.",  "US"), ("172.16.0.",  "US"),
    ("10.10.0.",   "GB"), ("192.168.10.", "CA"),
]
USERS   = ["admin","root","user01","jsmith","api_user","db_user","jenkins"]
PATHS   = ["/api/v1/users","/api/v1/events","/health","/admin","/login"]
PORTS   = [21,22,23,25,80,443,3306,5432,6379,8080,8443,9200]
CREDS   = ["admin:admin","root:root","admin:password","admin:123456"]
SQL_PAY = ["' OR 1=1--","' UNION SELECT NULL--","'; DROP TABLE users--"]

def _rip(pool):
    p, c = random.choice(pool)
    return f"{p}{random.randint(1,254)}", c


class SimulationEngine:
    def __init__(self):
        self.running    = False
        self.paused     = False
        self.time_scale = 60          # fake-seconds per real-second
        self._sim_elapsed: float = 0.0
        self._real_start: datetime | None = None
        self.blacklisted_ips: set = set()
        self.ip_history:      dict = {}
        self.total_events:    int  = 0
        # Thresholds
        self.th_normal = 0; self.th_suspicious = 30
        self.th_attack = 60; self.th_critical  = 85

    # ── controls ─────────────────────────────────────────────────────────────
    def start(self):
        self.running       = True
        self.paused        = False
        self._sim_elapsed  = 0.0
        self._real_start   = datetime.now(timezone.utc)
        self.total_events  = 0
        self.ip_history    = {}
        logger.info("Simulation started — fake clock 00:00:00")

    def set_time_scale(self, s: int):
        # snapshot current progress so scale change doesn't reset it
        self._sim_elapsed = self.sim_seconds
        self._real_start  = datetime.now(timezone.utc)
        self.time_scale   = s

    def update_blacklist(self, ips: set): self.blacklisted_ips = ips
    def update_thresholds(self, n, s, a, c):
        self.th_normal=n; self.th_suspicious=s; self.th_attack=a; self.th_critical=c

    # ── fake clock ────────────────────────────────────────────────────────────
    @property
    def sim_seconds(self) -> float:
        if not self.running or self._real_start is None:
            return self._sim_elapsed
        real_dt = (datetime.now(timezone.utc) - self._real_start).total_seconds()
        return self._sim_elapsed + real_dt * self.time_scale

    @property
    def sim_hour(self) -> int:
        return int(self.sim_seconds // 3600) % 24

    @property
    def sim_time_str(self) -> str:
        secs = min(int(self.sim_seconds), 86399)
        h, r = divmod(secs, 3600); m, s = divmod(r, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    @property
    def sim_timestamp_iso(self) -> str:
        secs = min(int(self.sim_seconds), 86399)
        h, r = divmod(secs, 3600); m, s = divmod(r, 60)
        return datetime(2024, 1, 1, h, m, s, tzinfo=timezone.utc).isoformat()

    @property
    def sim_progress(self) -> float:
        return min(100.0, round(self.sim_seconds / 86400 * 100, 2))

    def get_stats(self) -> dict:
        return {
            "running":      self.running and not self.paused,
            "paused":       self.paused,
            "time_scale":   self.time_scale,
            "sim_time":     self.sim_time_str,
            "sim_progress": self.sim_progress,
            "total_events": self.total_events,
        }

    # ── risk / category ───────────────────────────────────────────────────────
    def _category(self, score: int) -> str:
        if score >= self.th_critical:   return "CRITICAL"
        if score >= self.th_attack:     return "ATTACK"
        if score >= self.th_suspicious: return "SUSPICIOUS"
        return "NORMAL"

    def _risk(self, action, ip, sim_hour, country) -> int:
        base = EVENT_TYPES[action]["base_score"]
        hist = self.ip_history.get(ip, [])
        freq   = min(15, len(hist) * 2)
        time_b = 10 if (sim_hour < 6 or sim_hour > 22) else 0
        geo    = 8  if country in ("RU","CN","BR","KR","NG") else 0
        corr   = 0
        if "PORT_SCAN" in hist and action == "LOGIN_FAILED":           corr = 15
        if "BRUTE_FORCE" in hist and action == "PRIVILEGE_ESCALATION": corr = 20
        if "SQL_INJECTION" in hist and action == "DATA_EXFILTRATION":  corr = 20
        hist_b = min(10, len([h for h in hist if h in
                    ("BRUTE_FORCE","SQL_INJECTION","DDoS","PORT_SCAN")])*3)
        return min(100, base + freq + time_b + geo + corr + hist_b)

    def _build(self, action, ip, country, details=None) -> dict:
        score = self._risk(action, ip, self.sim_hour, country)
        cat   = self._category(score)
        self.ip_history.setdefault(ip, [])
        self.ip_history[ip] = (self.ip_history[ip] + [action])[-20:]
        self.total_events += 1
        return {
            "id":            str(uuid.uuid4()),
            "user_id":       random.choice(USERS),
            "ip":            ip, "action": action,
            "status":        "WARNING",
            "risk_score":    score, "category": cat, "country": country,
            "sim_timestamp": self.sim_timestamp_iso,
            "sim_time_str":  self.sim_time_str,
            "details":       details or {},
        }

    # ── generators ────────────────────────────────────────────────────────────
    def _normal(self):
        a = random.choices(["LOGIN_SUCCESS","LOGOUT","HTTP_REQUEST","FILE_ACCESS"],
                           weights=[.25,.20,.45,.10])[0]
        ip, c = _rip(LEGIT)
        d = {}
        if a == "HTTP_REQUEST": d = {"method":"GET","path":random.choice(PATHS)}
        if a == "FILE_ACCESS":  d = {"file":"/var/log/auth.log"}
        return self._build(a, ip, c, d)

    def _suspicious(self):
        a = random.choices(["LOGIN_FAILED","UNKNOWN_IP_ACCESS","UNUSUAL_HOUR_LOGIN"],
                           weights=[.5,.3,.2])[0]
        ip, c = _rip(MALICIOUS)
        return self._build(a, ip, c, {"attempt":random.randint(1,5)} if a=="LOGIN_FAILED" else {})

    def _port_scan(self):
        ip, c = _rip(MALICIOUS)
        return [self._build("PORT_SCAN",ip,c,{"port":p})
                for p in random.sample(PORTS, random.randint(3,6))]

    def _brute_force(self):
        ip, c = _rip(MALICIOUS)
        return [self._build("BRUTE_FORCE",ip,c,
                {"user":cr.split(":")[0],"pass":cr.split(":")[1]})
                for cr in random.sample(CREDS, random.randint(2,4))]

    def _ddos(self):
        return [self._build("DDoS",*_rip(MALICIOUS),
                {"pps":random.randint(100,5000),"proto":random.choice(["UDP","ICMP"])})
                for _ in range(random.randint(3,8))]

    def _sql(self):
        ip, c = _rip(MALICIOUS)
        return self._build("SQL_INJECTION",ip,c,{"payload":random.choice(SQL_PAY)})

    def _critical(self):
        a = random.choice(["PRIVILEGE_ESCALATION","DATA_EXFILTRATION","MALWARE_DETECTED"])
        ip, c = _rip(MALICIOUS)
        d = {
            "PRIVILEGE_ESCALATION":{"from":"www-data","to":"root"},
            "DATA_EXFILTRATION":   {"bytes":random.randint(10000,500_000_000)},
            "MALWARE_DETECTED":    {"hash":uuid.uuid4().hex[:16],"type":"Trojan"},
        }[a]
        return self._build(a, ip, c, d)

    def _kill_chain(self):
        if random.random() > 0.02: return []
        chain = random.choice(["recon","sql","ddos"])
        evs = []
        if chain == "recon":
            evs.extend(self._port_scan()); evs.extend(self._brute_force())
            if random.random() > .6: evs.append(self._critical())
        elif chain == "sql":
            evs.append(self._sql())
            if random.random() > .5: evs.append(self._critical())
        else:
            evs.extend(self._ddos())
        return evs

    # ── tick ──────────────────────────────────────────────────────────────────
    async def _tick(self):
        """Generate ONE realistic batch of events per tick.
        Frequency is deliberately low to be realistic."""
        h    = self.sim_hour
        # Circadian model based on fake hour
        morning   = math.exp(-((h-10)**2)/8)
        afternoon = math.exp(-((h-14)**2)/8)
        rate      = max(0.1, morning*.7 + afternoon*.6)
        prob_atk  = 0.05 + (1-rate)*.12

        evs = []
        # Normal: 1-3 events max per tick (not 4-10)
        n_normal = random.choices([1,2,3], weights=[.5,.35,.15])[0]
        if random.random() < rate:
            for _ in range(n_normal): evs.append(self._normal())

        # Suspicious: only sometimes
        if random.random() < prob_atk * 1.5:
            evs.append(self._suspicious())

        # Attack: lower probability
        if random.random() < prob_atk:
            r = random.random()
            if   r < .25: evs.extend(self._port_scan())
            elif r < .45: evs.extend(self._brute_force())
            elif r < .60: evs.extend(self._ddos())
            elif r < .80: evs.append(self._sql())
            else:          evs.append(self._critical())

        evs.extend(self._kill_chain())
        return [e for e in evs if e["ip"] not in self.blacklisted_ips]

    # ── run loop ──────────────────────────────────────────────────────────────
    async def run(self, bus):
        logger.info("Simulation loop running — idle until START")
        last_real = datetime.now(timezone.utc)
        while True:
            try:
                now_real = datetime.now(timezone.utc)
                real_dt  = (now_real - last_real).total_seconds()
                last_real = now_real

                if self.running and not self.paused:
                    self._sim_elapsed += real_dt * self.time_scale

                    # 24h cap
                    if self._sim_elapsed >= 86400:
                        self._sim_elapsed = 86400
                        self.running = False
                        self.paused  = False
                        logger.info("Simulation complete — 23:59:59 reached")
                        await bus.publish({"__type":"sim_ended"})
                        await asyncio.sleep(1)
                        continue

                    evs = await self._tick()
                    for e in evs:
                        await bus.publish(e)

                    # Sleep time: at ×1440 we sleep very briefly
                    sleep_t = max(0.02, 1.0 / max(1, self.time_scale / 10))
                    await asyncio.sleep(sleep_t)
                else:
                    await asyncio.sleep(0.2)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Sim error: {e}", exc_info=True)
                await asyncio.sleep(1)

simulation_engine = SimulationEngine()
