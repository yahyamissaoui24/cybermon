import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSim } from '../context/SimContext'
import { useState, useEffect, useRef } from 'react'
import { statsAPI, reportAPI } from '../services/api'

const ALL_NAV = [
  { to:'/dashboard', icon:'dashboard', label:'Dashboard',  roles:['admin','analyst','security_engineer','user'] },
  { to:'/logs',      icon:'terminal',  label:'Logs',       roles:['admin','analyst','security_engineer','user'] },
  { to:'/alerts',    icon:'warning',   label:'Alerts',     roles:['admin','analyst','security_engineer'] },
  { to:'/blacklist', icon:'block',     label:'Blacklist',  roles:['admin','analyst','security_engineer'] },
  { to:'/settings',  icon:'settings',  label:'Settings',   roles:['admin','security_engineer'] },
  { to:'/users',     icon:'group',     label:'Users',      roles:['admin'] },
]
const ROLE_LABELS: Record<string,string> = {
  admin:'Admin', analyst:'Threat Analyst',
  security_engineer:'Security Engineer', user:'User'
}

/* ── Report Modal ─────────────────────────────────────────────────────────── */
function ReportModal({ onClose }: { onClose: () => void }) {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    reportAPI.get()
      .then(d  => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }, [])

  const printReport = () => window.print()

  const cats  = data?.categories ?? {}
  const total = data?.total_events ?? 0

  const CAT_COLOR: Record<string,string> = {
    CRITICAL:'text-error', ATTACK:'text-secondary',
    SUSPICIOUS:'text-primary', NORMAL:'text-tertiary'
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface-container rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm">assessment</span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface">Daily Simulation Report</h2>
              <p className="text-[10px] font-mono text-slate-500">
                {data ? `Generated at sim ${data.sim_time}` : 'Loading...'}
                {data?.sim_complete && <span className="text-tertiary ml-2">✓ Simulation complete</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={printReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg text-xs font-bold text-primary hover:bg-primary/20 transition-colors uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">print</span>Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <span className="text-xs font-mono text-slate-500">Loading report data...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-error block mb-2">error</span>
                <p className="text-sm text-error font-mono">{error}</p>
                <p className="text-xs text-slate-500 mt-1">Start the simulation first to generate data.</p>
              </div>
            </div>
          )}
          {data && !loading && (
            <div className="space-y-6">

              {/* KPI row */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label:'Total Events',    value: total.toLocaleString(),        color:'text-primary' },
                  { label:'Avg Risk Score',  value: `${data.avg_risk}`,            color:'text-[#d8e2ff]' },
                  { label:'Blocked IPs',     value: data.blocked_ips,              color:'text-tertiary' },
                  { label:'Critical Alerts', value: data.recent_alerts?.length??0, color:'text-error' },
                ].map(k => (
                  <div key={k.label} className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{k.label}</p>
                    <p className={`text-2xl font-headline font-bold ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Event distribution */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5">
                  <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Event Distribution
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(cats).map(([cat, count]: any) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold font-mono w-20 ${CAT_COLOR[cat]??'text-slate-400'}`}>
                          {cat}
                        </span>
                        <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${total > 0 ? Math.round(count/total*100) : 0}%`,
                              background: cat==='CRITICAL'?'#ffb4ab':cat==='ATTACK'?'#ffb3ad':cat==='SUSPICIOUS'?'#adc6ff':'#4edea3'
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 w-16 text-right">
                          {count.toLocaleString()} ({total>0?Math.round(count/total*100):0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top countries */}
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5">
                  <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Top Source Geographies
                  </h3>
                  <div className="space-y-2">
                    {data.top_countries?.map((c: any, i: number) => (
                      <div key={c.code} className="flex items-center gap-3 py-1.5 border-b border-outline-variant/10 last:border-0">
                        <span className="text-[10px] font-mono text-slate-600">#{i+1}</span>
                        <span className="text-xs font-bold text-secondary font-mono w-8">{c.code}</span>
                        <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full"
                            style={{width:`${data.top_countries[0]?.count>0?Math.round(c.count/data.top_countries[0].count*100):0}%`}}/>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{c.count.toLocaleString()}</span>
                        <span className="text-[9px] font-mono text-slate-600">avg {c.avg_risk}</span>
                      </div>
                    ))}
                    {(!data.top_countries || data.top_countries.length === 0) && (
                      <p className="text-xs text-slate-600 font-mono">No data yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Top attacking IPs */}
              {data.top_ips?.length > 0 && (
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5">
                  <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Top Attacking IPs
                  </h3>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-mono text-slate-500 uppercase tracking-widest border-b border-outline-variant/10">
                        <th className="pb-2 font-semibold">IP Address</th>
                        <th className="pb-2 font-semibold">Country</th>
                        <th className="pb-2 font-semibold text-right">Events</th>
                        <th className="pb-2 font-semibold text-right">Max Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {data.top_ips.map((ip: any) => (
                        <tr key={ip.ip} className="hover:bg-surface-container/50">
                          <td className="py-2 font-mono text-primary text-xs">{ip.ip}</td>
                          <td className="py-2 text-[10px] font-bold text-secondary font-mono">{ip.country}</td>
                          <td className="py-2 font-mono text-xs text-slate-300 text-right">{ip.count}</td>
                          <td className="py-2 font-mono text-xs text-right">
                            <span className={ip.max_risk >= 80 ? 'text-error' : ip.max_risk >= 50 ? 'text-secondary' : 'text-tertiary'}>
                              {ip.max_risk}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recent critical alerts */}
              {data.recent_alerts?.length > 0 && (
                <div className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5">
                  <h3 className="text-xs font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Recent Critical &amp; Attack Alerts
                  </h3>
                  <div className="space-y-2">
                    {data.recent_alerts.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-outline-variant/5 last:border-0">
                        <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          a.level==='CRITICAL'?'text-error bg-error-container/20 border-error/30':'text-secondary bg-secondary/10 border-secondary/20'}`}>
                          {a.level}
                        </span>
                        <span className="text-[11px] text-slate-300 flex-1">{a.message}</span>
                        {a.ip && <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{a.ip}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-center text-[10px] font-mono text-slate-700 pt-2">
                © CYBERMON Sentinel Protocol — Auto-generated simulation report
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showLogout, setShowLogout] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const nav = ALL_NAV.filter(n => user && n.roles.includes(user.role))
  const initials = user?.name?.split(/[_\s]/).map(p=>p[0]).join('').slice(0,2).toUpperCase() ?? '??'

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node))
        setShowLogout(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0b1326] flex flex-col py-6 shadow-[12px_0_32px_-4px_rgba(11,19,38,0.4)] z-50">
      <div className="px-6 mb-10">
        <h1 className="text-xl font-bold text-primary tracking-widest font-headline">CYBERMON</h1>
        <p className="text-[10px] text-tertiary font-mono uppercase tracking-tighter mt-1">Sentinel Protocol Active</p>
      </div>
      <nav className="flex-1 space-y-1">
        {nav.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 font-headline text-sm font-medium transition-colors duration-200 ` +
              (isActive
                ? 'text-primary bg-[#171f33] border-r-2 border-tertiary'
                : 'text-slate-500 hover:text-slate-300 hover:bg-[#222a3d]')}>
            <span className="material-symbols-outlined mr-3">{icon}</span>{label}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 mt-auto relative" ref={popupRef}>
        {showLogout && (
          <div className="absolute bottom-full left-0 right-0 mb-2 px-1">
            <div className="bg-surface-container-highest border border-outline-variant/30 rounded-xl p-3 shadow-2xl">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 px-1">
                Connected as
              </div>
              <div className="px-1 mb-3">
                <p className="text-sm font-bold text-on-surface">{user?.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                <span className="text-[9px] font-bold text-tertiary uppercase mt-1 block">
                  {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                </span>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-error-container/20 hover:bg-error-container/40 text-error rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                <span className="material-symbols-outlined text-sm">logout</span>Sign Out
              </button>
            </div>
          </div>
        )}
        <button onClick={() => setShowLogout(p => !p)}
          className="w-full p-3 bg-surface-container rounded-lg flex items-center gap-3 hover:bg-surface-container-high transition-colors">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs font-mono flex-shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs font-bold truncate">{user?.name ?? '—'}</span>
            <span className="text-[10px] text-tertiary truncate">
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </span>
          </div>
          <span className="material-symbols-outlined text-slate-500 text-sm ml-auto">
            {showLogout ? 'expand_more' : 'expand_less'}
          </span>
        </button>
      </div>
    </aside>
  )
}

/* ── Topbar ───────────────────────────────────────────────────────────────── */
export function Topbar({ breadcrumb }: { breadcrumb: string }) {
  const { timeScale, setTimeScale, running } = useSim()
  const navigate = useNavigate()
  const [alertCount,  setAlertCount]  = useState(0)
  const [showReport,  setShowReport]  = useState(false)
  const [reportReady, setReportReady] = useState(false)  // glows when sim ended

  useEffect(() => {
    const load = async () => {
      try {
        const s = await statsAPI.get()
        setAlertCount(s.all_unread_alerts ?? 0)
        // Mark report ready when simulation is complete (progress >= 99.9%)
        if (s.sim_progress >= 99.9) setReportReady(true)
      } catch {}
    }
    if (!localStorage.getItem('token')) return
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  // Also listen for WS sim_ended control message
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'control' && msg.data?.sim_ended) {
          setReportReady(true)
        }
      } catch {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <>
      <header className="fixed top-0 right-0 left-64 h-16 bg-[#0b1326]/60 backdrop-blur-xl z-40 flex items-center justify-between px-8 border-b border-outline-variant/10">
        <nav className="flex items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          <span>Dashboard</span>
          <span className="material-symbols-outlined text-xs mx-2">chevron_right</span>
          <span className="text-primary">{breadcrumb}</span>
        </nav>

        <div className="flex items-center gap-6">

          {/* Report button — left of time scales */}
          <button
            onClick={() => setShowReport(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
              reportReady
                ? 'bg-primary/15 text-primary border-primary/40 shadow-[0_0_12px_rgba(173,198,255,0.3)] animate-pulse'
                : 'bg-surface-container text-slate-400 border-outline-variant/20 hover:text-slate-200 hover:border-outline-variant/40'
            }`}
            title={reportReady ? 'Daily report ready!' : 'View simulation report'}>
            <span className="material-symbols-outlined text-sm">assessment</span>
            <span className="hidden sm:inline">Report</span>
            {reportReady && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
            )}
          </button>

          {/* Time scales */}
          <div className="flex items-center gap-4 font-headline text-sm font-medium uppercase tracking-wider">
            {[1, 10, 60, 1440].map(s => (
              <button key={s} onClick={() => setTimeScale(s)}
                className={timeScale === s ? 'text-tertiary font-bold' : 'text-slate-400 hover:text-slate-300'}>
                {s === 1440 ? '×day' : `×${s}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 border-l border-outline-variant/30 pl-6">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
              running
                ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
                : 'bg-slate-700/30 text-slate-500 border-slate-600/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-tertiary animate-pulse' : 'bg-slate-600'}`} />
              {running ? 'Simulation Active' : 'Simulation Stopped'}
            </div>
            <button onClick={() => navigate('/alerts')} className="relative text-primary hover:text-white transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full text-[9px] flex items-center justify-center text-on-secondary font-bold">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Report modal */}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </>
  )
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
export function Footer({ connected }: { connected: boolean }) {
  return (
    <footer className="fixed bottom-0 right-0 left-64 h-8 bg-[#060e20] flex items-center justify-end px-6 gap-4 z-50">
      {['WebSocket', 'DB', 'Redis'].map(s => (
        <span key={s} className="text-[10px] font-mono uppercase flex items-center gap-1.5 text-tertiary">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-tertiary' : 'bg-red-500'}`} />
          {s}: {connected ? 'Online' : 'Reconnecting'}
        </span>
      ))}
      <span className="text-[10px] font-mono text-slate-600 ml-2">© 2024 CYBERMON Sentinel</span>
    </footer>
  )
}
