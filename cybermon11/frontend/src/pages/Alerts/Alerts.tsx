import { useEffect, useState } from 'react'
import { alertsAPI } from '../../services/api'

interface Alert { id: string; level: string; message: string; ip: string; is_read: boolean; created_at: string }

const LEVEL_STYLE: Record<string, { badge: string; icon: string; iconColor: string }> = {
  CRITICAL:  { badge: 'bg-error-container/20 text-error border-error/30', icon: 'monitoring', iconColor: 'text-orange-400' },
  ATTACK:    { badge: 'bg-error-container/20 text-error border-error/30', icon: 'gavel',      iconColor: 'text-secondary' },
  WARNING:   { badge: 'bg-secondary/10 text-secondary border-secondary/30', icon: 'warning', iconColor: 'text-secondary' },
}

const FILTER_LABELS = ['All', 'Unread', 'ATTACK', 'CRITICAL']

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const data = await alertsAPI.list(); setAlerts(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const i = setInterval(load, 5000); return () => clearInterval(i) }, [])

  const filtered = alerts.filter(a => {
    if (filter === 'Unread') return !a.is_read
    if (filter === 'ATTACK') return a.level === 'ATTACK'
    if (filter === 'CRITICAL') return a.level === 'CRITICAL'
    return true
  })

  const unread = alerts.filter(a => !a.is_read).length

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-2xl">notifications_active</span>
              <h2 className="font-headline text-3xl font-bold text-on-surface">
                Alerts{' '}
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-on-secondary-container bg-secondary-container rounded-full">
                  {alerts.length}
                </span>
              </h2>
            </div>
            <p className="text-sm text-slate-500 font-mono mt-1">
              {alerts.length} total — {unread} unread
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={async () => { await alertsAPI.markAllRead(); load() }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-high border border-outline-variant/20 rounded-lg text-sm font-medium text-on-surface hover:bg-surface-variant transition-colors">
              <span className="material-symbols-outlined text-sm">visibility</span>
              Mark All Read
            </button>
            <button onClick={async () => { await alertsAPI.clear(); load() }}
              className="flex items-center gap-2 px-4 py-2 bg-secondary-container/20 border border-secondary-container/30 rounded-lg text-sm font-medium text-error hover:bg-secondary-container/30 transition-colors">
              <span className="material-symbols-outlined text-sm">delete</span>
              Clear All
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">filter_list</span>
          </button>
          <div className="flex gap-2">
            {FILTER_LABELS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-6 py-1.5 text-xs font-bold font-mono rounded-lg uppercase tracking-wider transition-colors ${
                  filter === f
                    ? 'bg-tertiary/20 text-tertiary border border-tertiary/30'
                    : 'bg-surface-container-high text-slate-400 border border-outline-variant/20 hover:text-slate-300'
                }`}>
                {f}
              </button>
            ))}
          </div>
          {loading && <span className="text-[10px] font-mono text-slate-600 animate-pulse">LOADING...</span>}
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {filtered.map(alert => {
            const style = LEVEL_STYLE[alert.level] ?? LEVEL_STYLE.WARNING
            return (
              <div key={alert.id}
                className={`group relative flex items-center gap-6 p-6 bg-surface-container-low border border-outline-variant/10 rounded-xl hover:border-outline-variant/30 transition-all ${!alert.is_read ? 'border-l-2 border-l-primary' : ''}`}>
                {/* Unread dot */}
                {!alert.is_read && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                )}
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className={`absolute inset-0 w-full h-full opacity-20`} viewBox="0 0 40 40">
                      <path d="M0 20 Q10 10 20 20 T40 20" fill="none" stroke="currentColor" strokeWidth="2" className={style.iconColor}>
                        <animate attributeName="d"
                          values="M0 20 Q10 10 20 20 T40 20; M0 20 Q10 30 20 20 T40 20; M0 20 Q10 10 20 20 T40 20"
                          dur={alert.level === 'ATTACK' ? '0.8s' : '3s'} repeatCount="indefinite" />
                      </path>
                    </svg>
                    <span className={`material-symbols-outlined ${style.iconColor} text-2xl ${alert.level === 'ATTACK' ? 'animate-pulse' : ''}`}>
                      {style.icon}
                    </span>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded border ${style.badge}`}>
                      {alert.level}
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
                      {alert.level === 'ATTACK' ? 'THREAT DETECTED' : 'SUSPICIOUS ACTIVITY'}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${alert.level === 'ATTACK' ? 'bg-secondary animate-ping' : 'bg-error'}`}></span>
                  </div>
                  <h3 className="text-on-surface font-medium mb-1">{alert.message}</h3>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                    <span>{fmt(alert.created_at)}</span>
                    {alert.ip && <>
                      <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                      <span>IP: {alert.ip}</span>
                    </>}
                  </div>
                </div>
                {/* Mark read */}
                {!alert.is_read && (
                  <button onClick={async () => { await alertsAPI.markRead(alert.id); load() }}
                    className="flex-shrink-0 text-[10px] font-mono text-slate-500 hover:text-primary transition-colors uppercase tracking-wider">
                    Mark Read
                  </button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-600 font-mono text-xs">
              {loading ? 'Loading alerts...' : 'No alerts found'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
