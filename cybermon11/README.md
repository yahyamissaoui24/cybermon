# 🛡️ CYBERMON v6 — Sentinel Protocol

## 🚀 Launch

```bash
cd cybermon6
docker compose down -v      # clean database reset
docker compose up --build   # first build ~4 min
```
Open **http://localhost:3000** → **S'inscrire** → create account → log in

---

## ▶️ Start the Simulation

1. Go to **Settings → Engine Core**
2. Click **START SIMULATION**
3. Choose speed: ×1 / ×10 / ×60

---

## 🧠 How the Simulation Clock Works

### The Fake 24-Hour Day

The simulation runs an **internal fake clock** that starts at `00:00:00`
and counts up to `23:59:59`, completely independent of real wall time.

```
Fake clock:   00:00:00 ──────────────────────────► 23:59:59
                   ↑                                     ↑
              START SIMULATION                    Auto-stops here
```

All event `sim_timestamp` values use this fake clock — they are stored
as `2024-01-01 HH:MM:SS` where `HH:MM:SS` is the fake time.

### ⏱️ Time Scale = Speed of the Fake Clock

| Scale | 1 fake second = | Full day (00:00→23:59) = |
|-------|----------------|--------------------------|
| ×1    | 1 real second  | 24 real hours            |
| ×10   | 0.1 real sec   | 2 hrs 24 min real        |
| ×60   | 0.017 real sec | **24 real minutes**      |

### 📊 Circadian Model (uses fake hour)

| Fake hour | Activity |
|-----------|----------|
| 02:00–05:00 | Low normal traffic, high attack probability |
| 09:00–11:00 | Morning peak (normal events) |
| 13:00–15:00 | Afternoon peak (normal events) |
| 22:00–02:00 | Night — attackers most active |

### 🎯 Risk Score Formula
```
risk = base_score
     + freq_bonus    (repeat IP: +0 to +15)
     + time_bonus    (fake night: +10)
     + geo_bonus     (RU/CN/BR/KR/NG: +8)
     + chain_bonus   (kill chain detected: +15 to +20)
     + history_bonus (repeat offender: +0 to +10)
     cap = 100
```

### 🔗 Kill Chains (3% probability per tick)
```
recon:     PORT_SCAN → BRUTE_FORCE → PRIVILEGE_ESCALATION
sql:       SQL_INJECTION → DATA_EXFILTRATION
ddos:      5-12 simultaneous DDoS from different IPs
```

### 📈 Risk Chart
X-axis = fake HH:MM (00:00 → 23:59)
Y-axis = average risk score per minute slot
Red dashed line = critical threshold (80+)

---

## 🗄️ Database

```bash
docker exec -it cybermon_postgres psql -U cybermon -d cybermon

-- View sim day events
SELECT to_char(sim_timestamp,'HH24:MI') as sim_time,
       category, COUNT(*), AVG(risk_score)::int as avg_risk
FROM events
GROUP BY 1,2 ORDER BY 1;

-- Top countries
SELECT country, COUNT(*) as hits
FROM events GROUP BY country ORDER BY hits DESC LIMIT 10;
```

---

## 🐳 Commands

```bash
docker compose up -d              # background
docker compose logs -f backend    # watch
docker compose down               # stop (keep data)
docker compose down -v            # stop + wipe DB
```
