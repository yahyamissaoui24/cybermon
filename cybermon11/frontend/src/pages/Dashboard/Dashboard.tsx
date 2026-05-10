import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip as ReTip, ResponsiveContainer,
         AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { statsAPI, eventsAPI } from '../../services/api'
import type { LiveEvent } from '../../hooks/useWebSocket'
import { useSim } from '../../context/SimContext'

interface Props { liveEvents: LiveEvent[] }

// Accurate country positions as PERCENTAGES of the map image (1920×1080)
// Formula: x = (lon+180)/360*100, y = (90-lat)/180*100  (equirectangular)
const CC: Record<string, { x: number; y: number; name: string }> = {
  US: { x: 22.7, y: 28.1, name: 'United States' },
  CA: { x: 23.2, y: 18.8, name: 'Canada' },
  BR: { x: 35.3, y: 55.6, name: 'Brazil' },
  MX: { x: 21.7, y: 37.2, name: 'Mexico' },
  GB: { x: 49.4, y: 20.0, name: 'United Kingdom' },
  FR: { x: 50.6, y: 24.3, name: 'France' },
  DE: { x: 52.9, y: 21.6, name: 'Germany' },
  NL: { x: 51.5, y: 21.1, name: 'Netherlands' },
  ES: { x: 49.0, y: 27.5, name: 'Spain' },
  IT: { x: 53.5, y: 26.7, name: 'Italy' },
  RU: { x: 75.0, y: 15.8, name: 'Russia' },
  CN: { x: 78.9, y: 30.1, name: 'China' },
  JP: { x: 88.4, y: 29.9, name: 'Japan' },
  KR: { x: 85.5, y: 29.7, name: 'South Korea' },
  IN: { x: 71.9, y: 38.6, name: 'India' },
  AU: { x: 87.2, y: 64.1, name: 'Australia' },
  NG: { x: 52.4, y: 44.9, name: 'Nigeria' },
  ZA: { x: 57.0, y: 66.1, name: 'South Africa' },
  EG: { x: 58.6, y: 35.1, name: 'Egypt' },
  TR: { x: 59.8, y: 28.3, name: 'Turkey' },
  SA: { x: 62.5, y: 36.6, name: 'Saudi Arabia' },
  TW: { x: 83.6, y: 36.8, name: 'Taiwan' },
  ID: { x: 81.6, y: 50.4, name: 'Indonesia' },
  UA: { x: 58.9, y: 22.8, name: 'Ukraine' },
  PL: { x: 55.3, y: 21.2, name: 'Poland' },
}

const FEED_STYLE: Record<string, { border: string; text: string; label: string }> = {
  CRITICAL:  { border: 'border-secondary-container', text: 'text-secondary', label: 'CRITICAL_ALERT' },
  ATTACK:    { border: 'border-primary-container',   text: 'text-primary',   label: 'ATTACK_VECTOR' },
  SUSPICIOUS:{ border: 'border-primary-container',   text: 'text-primary',   label: 'SUSPICIOUS_TRAFFIC' },
  NORMAL:    { border: 'border-tertiary-container',  text: 'text-tertiary',  label: 'SYSTEM_LOG' },
}
const CAT_COLORS: Record<string, string> = {
  CRITICAL:  'text-error bg-error-container/20 border-error/40',
  ATTACK:    'text-error bg-error-container/10 border-error/20',
  SUSPICIOUS:'text-secondary bg-secondary/10 border-secondary/20',
  NORMAL:    'text-tertiary bg-tertiary/10 border-tertiary/20',
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-surface-container-high border border-outline-variant/30 rounded-lg p-3 shadow-xl min-w-[160px]">
      <p className="text-[10px] font-mono text-primary font-bold mb-1">⏱ {label}</p>
      <p className="text-xs">Risk: <span className={`font-bold ${d?.risk >= 80 ? 'text-error' : d?.risk >= 50 ? 'text-secondary' : 'text-tertiary'}`}>{d?.risk}</span></p>
      {d?.action && <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">{d.action}</p>}
    </div>
  )
}

export default function Dashboard({ liveEvents }: Props) {
  const navigate  = useNavigate()
  const { timeScale } = useSim()

  const [stats,     setStats]     = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [feedFull,  setFeedFull]  = useState(false)
  const [mapFull,   setMapFull]   = useState(false)
  const [localFeed, setLocalFeed] = useState<LiveEvent[]>([])
  const [hoveredCC,    setHoveredCC]    = useState<string | null>(null)
  const [countryModal, setCountryModal] = useState<{ code: string; name: string } | null>(null)
  const [countryEvts,  setCountryEvts]  = useState<any[]>([])
  const [loadingCE,    setLoadingCE]    = useState(false)

  const chartBuf = useRef<Map<string, { risks: number[]; action: string }>>(new Map())

  useEffect(() => {
    if (liveEvents.length === 0) return
    const ev = liveEvents[0]
    let key = '??:??'
    try {
      const d = new Date(ev.sim_timestamp)
      key = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    } catch {}
    const buf = chartBuf.current
    if (!buf.has(key)) buf.set(key, { risks: [], action: '' })
    const slot = buf.get(key)!
    slot.risks.push(ev.risk_score)
    slot.action = ev.action.replace(/_/g, ' ')
    const arr = Array.from(buf.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t, d]) => ({
        t,
        risk: Math.round(d.risks.reduce((a, b) => a + b, 0) / d.risks.length),
        action: d.action,
      }))
    setChartData(arr)
    setLocalFeed(prev => [ev, ...prev].slice(0, 300))
  }, [liveEvents])

  const loadStats = useCallback(async () => {
    try { setStats(await statsAPI.get()) } catch {}
  }, [])

  useEffect(() => {
    loadStats()
    const i = setInterval(loadStats, 5000)
    return () => clearInterval(i)
  }, [loadStats])

  const openCountry = async (code: string, name: string) => {
    setCountryModal({ code, name }); setLoadingCE(true)
    try {
      const r = await eventsAPI.list({ country: code, limit: 50 })
      setCountryEvts(r.events || [])
    } catch {} finally { setLoadingCE(false) }
  }

  const cats  = stats?.categories ?? {}
  const total: number = (Object.values(cats).reduce((a: number, b: unknown) => a + (Number(b) || 0), 0) as number) || 1
  const donut = [
    { name: 'Normal',    value: cats.NORMAL    || 0, color: '#4edea3' },
    { name: 'Suspicious',value: cats.SUSPICIOUS || 0, color: '#4d8eff' },
    { name: 'Attack',    value: cats.ATTACK    || 0, color: '#ffb3ad' },
    { name: 'Critical',  value: cats.CRITICAL  || 0, color: '#a40217' },
  ]
  const top5: { code: string; count: number; avg_risk: number }[] = stats?.top_countries ?? []
  const simTime:     string = stats?.sim_time    ?? '00:00:00'

  // ── Map Component ── percentage-based positioning, always accurate ──────────
  const MapComponent = ({ tall = false }: { tall?: boolean }) => (
    <div
      className={`relative w-full ${tall ? 'h-[60vh]' : 'h-[210px]'} rounded-xl overflow-hidden`}
      style={{ background: '#040d18' }}>

      {/* World map background image */}
      <img
        src="/worldmap.jpg"
        alt="World Map"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'fill', opacity: 0.88 }}
      />

      {/* Subtle dark overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(4,13,24,0.25) 0%, rgba(4,13,24,0.08) 50%, rgba(4,13,24,0.35) 100%)' }}
      />

      {/* Country ping markers — using % positioning directly on the container */}
      {top5.map((c, idx) => {
        const coord = CC[c.code]
        if (!coord) return null
        const delay   = idx * 0.6
        const isHov   = hoveredCC === c.code

        return (
          <div
            key={c.code}
            className="absolute"
            style={{
              left:      `${coord.x}%`,
              top:       `${coord.y}%`,
              transform: 'translate(-50%, -50%)',
              cursor:    'pointer',
              zIndex:    10,
            }}
            onClick={()  => openCountry(c.code, coord.name)}
            onMouseEnter={() => setHoveredCC(c.code)}
            onMouseLeave={() => setHoveredCC(null)}>

            {/* Animated pulse rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="absolute rounded-full border border-red-400/70"
                style={{
                  width: 36, height: 36,
                  animation: `ping 2.5s ease-out ${delay}s infinite`,
                  opacity: 0,
                }}
              />
              <div
                className="absolute rounded-full border border-red-300/50"
                style={{
                  width: 22, height: 22,
                  animation: `ping 2.5s ease-out ${delay + 0.4}s infinite`,
                  opacity: 0,
                }}
              />
            </div>

            {/* Core dot */}
            <div
              className="relative rounded-full flex items-center justify-center"
              style={{
                width:     isHov ? 14 : 11,
                height:    isHov ? 14 : 11,
                background: '#ff3030',
                boxShadow: `0 0 ${isHov ? 16 : 10}px rgba(255,60,60,0.8)`,
                transition: 'all 0.15s ease',
              }}>
              <div className="rounded-full bg-white"
                style={{ width: isHov ? 5 : 4, height: isHov ? 5 : 4 }} />
            </div>

            {/* Code badge */}
            <div
              className="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-center whitespace-nowrap"
              style={{
                bottom:     '115%',
                background: isHov ? '#0b1326' : 'rgba(5,12,25,0.85)',
                border:     `1px solid ${isHov ? '#ff4060' : '#00cfff'}`,
                minWidth:   28,
              }}>
              <span className="font-mono font-bold"
                style={{ fontSize: 8, color: isHov ? '#ff6080' : '#00cfff' }}>
                {c.code}
              </span>
            </div>

            {/* Hover tooltip */}
            {isHov && (
              <div
                className="absolute z-20 rounded-lg px-3 py-2 whitespace-nowrap pointer-events-none"
                style={{
                  top:       '120%',
                  left:      '50%',
                  transform: 'translateX(-50%)',
                  background:'rgba(5,12,25,0.95)',
                  border:    '1px solid #00cfff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  minWidth:  120,
                }}>
                <p className="text-[10px] font-bold text-white">{coord.name}</p>
                <p className="text-[9px] font-mono text-red-300 mt-0.5">
                  {c.count.toLocaleString()} events · avg risk {c.avg_risk}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {/* Fullscreen toggle */}
      <button
        onClick={() => setMapFull(p => !p)}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded flex items-center justify-center text-[#00cfff]/60 hover:text-[#00cfff] transition-colors"
        style={{ background: 'rgba(4,13,24,0.8)', border: '1px solid rgba(0,207,255,0.3)' }}>
        <span className="material-symbols-outlined text-sm">
          {mapFull ? 'close_fullscreen' : 'open_in_full'}
        </span>
      </button>
      <div className="absolute bottom-1.5 left-3 text-[7px] font-mono uppercase tracking-widest"
        style={{ color: 'rgba(0,207,255,0.25)' }}>
        GLOBAL THREAT VECTORS — REAL-TIME
      </div>
    </div>
  )

  return (
    <div className="p-8 grid grid-cols-12 gap-6 pb-12">

      {/* KPI Cards — no progress bar here */}
      <section className="col-span-12 grid grid-cols-4 gap-6">
        {[
          { label: 'Total Events',   value: (stats?.total_events_24h ?? 0).toLocaleString(), sub: 'Simulated day',  subClr: 'text-tertiary',  icon: 'trending_up', route: '/logs',      clr: 'text-primary' },
          { label: 'Active Alerts',  value: stats?.active_alerts ?? 0,                        sub: 'Attack+Critical',subClr: 'text-secondary', icon: 'warning',     route: '/alerts',    clr: 'text-secondary' },
          { label: 'Blocked IPs',    value: stats?.blocked_24h ?? 0,                           sub: 'Total blocked',  subClr: 'text-slate-500', icon: 'block',       route: '/blacklist', clr: 'text-tertiary' },
          { label: 'Avg Risk Score', value: `${(stats?.avg_risk ?? 0).toFixed(1)}`,             sub: 'All events',     subClr: 'text-slate-500', icon: 'analytics',   route: null,         clr: 'text-[#d8e2ff]' },
        ].map(k => (
          <div key={k.label}
            className={`bg-surface-container p-5 rounded-lg flex flex-col justify-between ${k.route ? 'cursor-pointer hover:bg-surface-container-high transition-colors' : ''}`}
            onClick={() => k.route && navigate(k.route)}>
            <span className="text-xs text-slate-400 font-headline uppercase tracking-widest">{k.label}</span>
            <div className="flex items-end justify-between mt-2">
              <span className={`text-3xl font-headline font-bold ${k.clr}`}>{k.value}</span>
              <span className={`text-xs font-mono flex items-center gap-1 ${k.subClr}`}>
                <span className="material-symbols-outlined text-sm">{k.icon}</span>{k.sub}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Left column */}
      <div className="col-span-8 grid grid-cols-12 gap-6">

        {/* Chart */}
        <section className="col-span-12 bg-surface-container p-6 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-on-surface">Real-time Risk Vector</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {chartData.length > 0
                  ? `Sim clock: ${simTime} — ${chartData.length} time slots`
                  : 'Settings → Engine Core → START SIMULATION'}
              </p>
            </div>
          </div>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#adc6ff" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#adc6ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#424754" opacity={0.2} />
                <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                <ReferenceLine y={80} stroke="#ffb4ab" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: '⚠ 80+', position: 'insideTopRight', fill: '#ffb4ab', fontSize: 9, fontFamily: 'JetBrains Mono', dy: -4 }} />
                <ReTip content={<ChartTip />} />
                <Area type="monotone" dataKey="risk" stroke="#adc6ff" strokeWidth={2.5}
                  fill="url(#rg)" dot={false} connectNulls
                  activeDot={{ r: 5, fill: '#adc6ff', stroke: '#0b1326', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-5xl text-slate-700 block mb-3">show_chart</span>
                <p className="text-slate-600 font-mono text-xs mb-3">
                  {chartData.length === 1 ? 'Waiting for more data points…' : 'Start simulation to see the live risk curve'}
                </p>
                {chartData.length === 0 && (
                  <button onClick={() => navigate('/settings')}
                    className="text-[10px] font-bold text-primary hover:text-white border border-primary/30 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    Go to Settings →
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Donut */}
        <section className="col-span-4 bg-surface-container p-6 rounded-lg flex flex-col items-center">
          <h3 className="font-headline font-bold text-sm text-on-surface self-start mb-4 uppercase tracking-widest">Event Distribution</h3>
          <div className="relative w-36 h-36">
            <PieChart width={144} height={144}>
              <Pie data={donut} cx={68} cy={68} innerRadius={48} outerRadius={66} dataKey="value" stroke="none">
                {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-headline font-bold">
                {total > 999999 ? `${(total / 1e6).toFixed(1)}M` : total > 999 ? `${(total / 1000).toFixed(0)}K` : total > 1 ? total : '—'}
              </span>
              <span className="text-[8px] text-slate-500 font-mono">TOTAL</span>
            </div>
          </div>
          <div className="w-full grid grid-cols-2 gap-y-2 gap-x-2 mt-4">
            {donut.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[9px] text-slate-400 font-mono uppercase">
                  {d.name} ({total > 1 ? Math.round(d.value / total * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Map */}
        <section className="col-span-8 bg-surface-container p-5 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-headline font-bold text-sm text-on-surface uppercase tracking-widest">Global Threat Map</h3>
            <span className="text-[10px] text-secondary font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_#ffb4ab] animate-pulse" />
              MOST ACTIVE INCURSIONS
            </span>
          </div>
          <MapComponent />
          <div className="mt-3">
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest block mb-2">
              Top source geographies — click to view events
            </span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {top5.length > 0 ? top5.map((c, i) => (
                <button key={c.code}
                  onClick={() => openCountry(c.code, CC[c.code]?.name ?? c.code)}
                  className="flex-shrink-0 px-3 py-2 bg-surface-variant border border-secondary/30 rounded-lg flex items-center gap-2 hover:border-secondary/70 transition-all min-w-[90px]">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-secondary font-mono">{c.code}</span>
                    <span className="text-[8px] text-slate-600 font-mono">#{i + 1}</span>
                  </div>
                  <div className="w-px h-8 bg-outline-variant/30" />
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-mono text-slate-300">{c.count.toLocaleString()}</span>
                    <span className="text-[8px] font-mono text-slate-600">avg: {c.avg_risk}</span>
                  </div>
                </button>
              )) : (
                <span className="text-[10px] text-slate-700 font-mono py-2">No data — start simulation</span>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Live Feed */}
      <aside
        className={`col-span-4 flex flex-col bg-surface-container-low rounded-lg overflow-hidden
          ${feedFull ? 'fixed inset-0 z-[60] ml-64 mt-16 mb-8' : ''}`}
        style={feedFull ? { height: 'calc(100vh - 6rem)' } : { height: '790px' }}>
        <div className="p-4 bg-surface-container-high flex justify-between items-center border-b border-outline-variant/10 flex-shrink-0">
          <h3 className="font-headline font-bold text-sm text-on-surface uppercase tracking-widest">Live Sentinel Feed</h3>
          <button onClick={() => setFeedFull(p => !p)} className="text-slate-400 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">{feedFull ? 'close_fullscreen' : 'open_in_full'}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar font-mono p-4 space-y-2 min-h-0">
          {localFeed.length > 0 ? localFeed.map((ev, i) => {
            const s = FEED_STYLE[ev.category] ?? FEED_STYLE.NORMAL
            let simTs = '??:??:??'
            try {
              const d = new Date(ev.sim_timestamp)
              simTs = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`
            } catch {}
            return (
              <div key={`${ev.id}-${i}`} className={`flex flex-col gap-0.5 border-l-2 ${s.border} pl-3 pb-1`}>
                <div className={`flex justify-between ${s.text} text-[10px]`}>
                  <span className="font-bold">{s.label}</span>
                  <span className="text-slate-500">{simTs}</span>
                </div>
                <div className="text-slate-300 text-[11px]">
                  {ev.action.replace(/_/g, ' ')}: <span className="text-primary">{ev.ip}</span>
                </div>
                <div className="text-[9px] text-slate-600">
                  Risk: <span className={ev.risk_score >= 80 ? 'text-error' : ev.risk_score >= 50 ? 'text-secondary' : 'text-tertiary'}>{ev.risk_score}</span>
                  {' '}| {ev.country ?? '??'} | {ev.category}
                </div>
              </div>
            )
          }) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <span className="material-symbols-outlined text-4xl text-slate-700 block mb-2">stream</span>
              <p className="text-[10px] text-slate-600 font-mono">No events yet</p>
              <p className="text-[9px] text-slate-700 font-mono mt-1">Start simulation in Settings</p>
            </div>
          )}
        </div>
        <div className="p-3 bg-surface-container flex items-center justify-between border-t border-outline-variant/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${localFeed.length > 0 ? 'bg-tertiary animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-mono text-tertiary uppercase">
              {localFeed.length > 0 ? `Live · ×${timeScale} · ${localFeed.length} events` : 'Idle'}
            </span>
          </div>
          <button onClick={() => setLocalFeed([])}
            className="text-[9px] font-mono text-slate-500 uppercase hover:text-error transition-colors px-2 py-1 rounded hover:bg-error-container/20">
            Clear Feed
          </button>
        </div>
      </aside>

      {/* Fullscreen map overlay */}
      {mapFull && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setMapFull(false)}>
          <div className="w-full max-w-6xl bg-surface-container rounded-2xl p-6 border border-outline-variant/20 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline font-bold text-xl text-on-surface">Global Threat Map</h3>
              <button onClick={() => setMapFull(false)} className="text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <MapComponent tall={true} />
            <div className="flex gap-3 mt-4 flex-wrap">
              {top5.map(c => (
                <button key={c.code}
                  onClick={() => { openCountry(c.code, CC[c.code]?.name ?? c.code); setMapFull(false) }}
                  className="px-3 py-2 bg-surface-variant border border-secondary/30 rounded-lg flex items-center gap-2 hover:border-secondary/60">
                  <span className="text-xs font-bold text-secondary font-mono">{c.code}</span>
                  <span className="text-[10px] font-mono text-slate-300">{c.count.toLocaleString()} events</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Country events modal */}
      {countryModal && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setCountryModal(null)}>
          <div className="w-full max-w-3xl bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden max-h-[80vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-surface-container-high border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="font-headline font-bold text-lg text-on-surface">
                  Events from <span className="text-secondary">{countryModal.name}</span>
                </h3>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">Code: {countryModal.code}</p>
              </div>
              <button onClick={() => setCountryModal(null)} className="text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar">
              {loadingCE ? (
                <div className="py-12 text-center">
                  <span className="text-[10px] font-mono text-slate-500 animate-pulse">Loading events...</span>
                </div>
              ) : countryEvts.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-surface-container-high/50 text-[10px] uppercase tracking-widest text-slate-500 sticky top-0">
                    <tr>
                      {['Sim Time', 'IP', 'Event', 'Risk', 'Category'].map(h => (
                        <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-xs">
                    {countryEvts.map((ev: any) => {
                      let simTs = '—'
                      try {
                        const d = new Date(ev.sim_timestamp)
                        simTs = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`
                      } catch {}
                      return (
                        <tr key={ev.id} className="hover:bg-surface-container-high/30">
                          <td className="px-5 py-3 font-mono text-[10px] text-slate-400">{simTs}</td>
                          <td className="px-5 py-3 font-mono text-primary text-[11px]">{ev.ip}</td>
                          <td className="px-5 py-3 text-on-surface">{ev.action?.replace(/_/g, ' ')}</td>
                          <td className="px-5 py-3">
                            <span className={`font-bold font-mono text-sm ${ev.risk_score >= 80 ? 'text-error' : ev.risk_score >= 50 ? 'text-secondary' : 'text-tertiary'}`}>
                              {ev.risk_score}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${CAT_COLORS[ev.category] ?? ''}`}>
                              {ev.category}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-600 font-mono text-xs">
                  No events found for {countryModal.code}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
