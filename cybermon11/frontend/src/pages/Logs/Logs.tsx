import { useEffect, useState, useCallback } from 'react'
import { eventsAPI, blacklistAPI } from '../../services/api'

interface Event { id:string;ip:string;action:string;status:string;risk_score:number;category:string;country:string;sim_timestamp:string }
interface BLModal { open:boolean; ip:string; eventType:string }

const RISK_COLOR=(r:number)=>r>=80?'text-error':r>=50?'text-secondary':'text-tertiary'
const CAT_STYLE: Record<string,string>={
  ATTACK:   'text-error bg-error-container/10 border-error/20',
  CRITICAL: 'text-error bg-error-container/20 border-error/40 animate-pulse',
  SUSPICIOUS:'text-secondary bg-secondary/10 border-secondary/20',
  NORMAL:   'text-tertiary bg-tertiary/10 border-tertiary/20',
}

// CSV → PDF download
function exportToPDF(events: Event[]) {
  const w = window.open('','_blank')!
  w.document.write(`
    <html><head><title>CYBERMON Logs Export</title>
    <style>
      body{font-family:monospace;background:#0b1326;color:#dae2fd;padding:20px}
      h1{color:#adc6ff;letter-spacing:4px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th{background:#171f33;color:#8c909f;padding:8px;text-align:left;text-transform:uppercase;letter-spacing:2px}
      td{padding:8px;border-bottom:1px solid #2d3449;color:#c2c6d6}
      .risk-high{color:#ffb4ab} .risk-med{color:#ffb3ad} .risk-low{color:#4edea3}
      @media print{body{background:white;color:black} th{background:#eee;color:black} td{color:#333}}
    </style></head><body>
    <h1>CYBERMON — LOGS EXPORT</h1>
    <p style="color:#8c909f;font-size:11px">Generated: ${new Date().toLocaleString()} | ${events.length} events</p>
    <table><tr><th>Timestamp</th><th>IP</th><th>Event</th><th>Status</th><th>Country</th><th>Risk</th><th>Category</th></tr>
    ${events.map(e=>`<tr>
      <td>${e.sim_timestamp?new Date(e.sim_timestamp).toLocaleString():''}</td>
      <td>${e.ip}</td><td>${e.action.replace(/_/g,' ')}</td>
      <td>${e.status}</td><td>${e.country??''}</td>
      <td class="${e.risk_score>=80?'risk-high':e.risk_score>=50?'risk-med':'risk-low'}">${e.risk_score}</td>
      <td>${e.category}</td></tr>`).join('')}
    </table></body></html>`)
  w.document.close()
  setTimeout(()=>w.print(),500)
}

export default function Logs() {
  const [events,  setEvents]  = useState<Event[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [filterIp,  setFilterIp]  = useState('')
  const [filterRisk,setFilterRisk]= useState(0)
  const [modal,   setModal]   = useState<BLModal>({open:false,ip:'',eventType:''})
  const [blReason,setBlReason]= useState('')
  const [blLevel, setBlLevel] = useState('WARNING')
  const [blMsg,   setBlMsg]   = useState('')
  const [blIps,   setBlIps]   = useState<Set<string>>(new Set())

  const load = useCallback(async (p=page) => {
    setLoading(true)
    try {
      const r = await eventsAPI.list({page:p,limit:25,
        ...(filterCat?{category:filterCat}:{}),
        ...(filterIp?{ip:filterIp}:{}),
        ...(filterRisk>0?{min_risk:filterRisk}:{})})
      setEvents(r.events); setTotal(r.total); setPages(r.pages)
    } catch {} finally { setLoading(false) }
  },[page,filterCat,filterIp,filterRisk])

  // Load blacklisted IPs for status display
  const loadBL = useCallback(async () => {
    try {
      const bl = await blacklistAPI.list()
      setBlIps(new Set(bl.map((b:any)=>b.ip)))
    } catch {}
  },[])

  useEffect(()=>{ load(page); loadBL() },[page])
  useEffect(()=>{ const i=setInterval(()=>{ load(page); loadBL() },4000); return ()=>clearInterval(i) },[load,page])

  const handleAddBL = async () => {
    if(!blReason.trim()){setBlMsg('Reason required');return}
    try {
      await blacklistAPI.add({ip:modal.ip,reason:blReason,threat_level:blLevel,event_type:modal.eventType})
      setBlIps(prev=>new Set([...prev,modal.ip]))
      setBlMsg('✓ IP blocked successfully')
      setTimeout(()=>{ setModal({open:false,ip:'',eventType:''}); setBlMsg(''); setBlReason('') },1200)
    } catch(e:any){ setBlMsg(e?.response?.data?.detail??'Error') }
  }

  const handleUnblock = async (ip:string) => {
    try { await blacklistAPI.remove(ip); setBlIps(prev=>{ const s=new Set(prev); s.delete(ip); return s }) }
    catch {}
  }

  const getStatus = (ev: Event) => {
    if (blIps.has(ev.ip)) return 'BLOCKED'
    if (ev.category==='NORMAL') return '—'
    if (ev.category==='SUSPICIOUS') return 'WARNING'
    return ev.status
  }
  const STATUS_STYLE: Record<string,string>={
    BLOCKED: 'bg-error-container/20 text-error border-error/30',
    WARNING: 'bg-secondary/10 text-secondary border-secondary/30',
    SECURE:  'bg-tertiary/10 text-tertiary border-tertiary/30',
    '—':     'text-slate-600',
  }

  return (
    <div className="p-8 space-y-6">
      {/* Filters */}
      <section className="bg-surface-container rounded-xl p-6 border border-outline-variant/5">
        <div className="grid grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest">Category</label>
            <div className="relative">
              <select className="w-full bg-surface-container-high border-none text-sm text-on-surface rounded p-2 focus:ring-1 focus:ring-primary appearance-none outline-none"
                value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                <option value="">All Events</option>
                <option value="NORMAL">Normal</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="ATTACK">Attack</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-2 text-slate-500 pointer-events-none text-sm">filter_list</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest">Source IP</label>
            <div className="relative">
              <input className="w-full bg-surface-container-high border-none text-sm text-on-surface font-mono rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                placeholder="192.168.0.1" value={filterIp} onChange={e=>setFilterIp(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-widest">
              Min Risk <span className="text-primary font-mono">{filterRisk}+</span>
            </label>
            <input type="range" min={0} max={100} value={filterRisk} onChange={e=>setFilterRisk(+e.target.value)}
              className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary mt-3" />
          </div>
          <div className="flex items-end gap-2 col-span-2">
            <button onClick={()=>{ setPage(1); load(1) }}
              className="flex-1 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest hover:opacity-90">
              Apply
            </button>
            <button onClick={()=>{ setFilterCat(''); setFilterIp(''); setFilterRisk(0); setPage(1); }}
              className="p-2.5 bg-surface-container-highest text-slate-400 rounded-lg hover:text-primary">
              <span className="material-symbols-outlined">restart_alt</span>
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant/5">
        <div className="px-6 py-4 flex justify-between items-center bg-surface-container-high/50">
          <div className="flex items-center gap-4">
            <h2 className="font-headline font-bold text-lg text-primary">Active Sentinel Stream</h2>
            <div className={`h-2 w-2 rounded-full ${loading?'bg-yellow-400 animate-pulse':'bg-tertiary'}`}></div>
          </div>
          <button onClick={()=>exportToPDF(events)}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-surface-container-high rounded border border-outline-variant/20 hover:text-on-surface flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">download</span> Export PDF
          </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30">
                {['Timestamp','Source IP','Event Type','Status','Country','Risk','Category','Action'].map(h=>(
                  <th key={h} className={`px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest ${h==='Action'?'text-right':h==='Status'||h==='Country'||h==='Risk'?'text-center':''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {events.map(ev => {
                const status = getStatus(ev)
                const isBlocked = blIps.has(ev.ip)
                return (
                  <tr key={ev.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                      {ev.sim_timestamp?new Date(ev.sim_timestamp).toLocaleString():''}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-primary">{ev.ip}</td>
                    <td className="px-6 py-4 text-xs font-medium text-on-surface">{ev.action.replace(/_/g,' ')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`border text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_STYLE[status]??'text-slate-500'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-400">{ev.country??'??'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`${RISK_COLOR(ev.risk_score)} font-mono font-bold text-sm`}>{String(ev.risk_score).padStart(2,'0')}</span>
                        <div className="w-12 h-1 bg-surface-container-highest rounded-full overflow-hidden mt-1">
                          <div className={`h-full ${ev.risk_score>=80?'bg-error':ev.risk_score>=50?'bg-secondary':'bg-tertiary'}`}
                            style={{width:`${ev.risk_score}%`}} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${CAT_STYLE[ev.category]??''}`}>
                        {ev.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isBlocked ? (
                        <button onClick={()=>handleUnblock(ev.ip)}
                          className="bg-tertiary/20 text-tertiary font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded transition-all active:scale-95 border border-tertiary/30 hover:bg-tertiary/30">
                          Unblock
                        </button>
                      ) : (
                        <button onClick={()=>{ setModal({open:true,ip:ev.ip,eventType:ev.action}); setBlReason('') }}
                          className="bg-error hover:bg-error/90 text-on-error font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded transition-all active:scale-95">
                          Add to Blacklist
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {events.length===0&&!loading&&(
                <tr><td colSpan={8} className="text-center py-12 text-slate-600 font-mono text-xs">No events — start simulation in Settings</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-6 py-4 bg-surface-container-high/30 flex justify-between items-center border-t border-outline-variant/10">
          <p className="text-[10px] uppercase font-bold text-slate-500">{total.toLocaleString()} Events</p>
          <div className="flex items-center gap-1">
            <button disabled={page<=1} onClick={()=>setPage(1)} className="p-1.5 text-slate-500 hover:text-primary disabled:opacity-30">
              <span className="material-symbols-outlined text-lg">first_page</span>
            </button>
            <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="p-1.5 text-slate-500 hover:text-primary disabled:opacity-30">
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <div className="flex items-center gap-1 px-3">
              {[...Array(Math.min(5,pages))].map((_,i)=>{
                const p=Math.max(1,page-2)+i; if(p>pages)return null
                return <button key={p} onClick={()=>setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${page===p?'bg-primary text-on-primary':'hover:bg-surface-container-highest'}`}>{p}</button>
              })}
            </div>
            <button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="p-1.5 text-slate-300 hover:text-primary disabled:opacity-30">
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
            <button disabled={page>=pages} onClick={()=>setPage(pages)} className="p-1.5 text-slate-300 hover:text-primary disabled:opacity-30">
              <span className="material-symbols-outlined text-lg">last_page</span>
            </button>
          </div>
        </div>
      </div>

      {/* Blacklist Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">block</span> Add to Blacklist
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">IP Address</label>
                <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono outline-none" value={modal.ip} readOnly />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Reason</label>
                <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Brute Force Attack" value={blReason} onChange={e=>setBlReason(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Threat Level</label>
                <select className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none"
                  value={blLevel} onChange={e=>setBlLevel(e.target.value)}>
                  <option>LOW</option><option>WARNING</option><option>CRITICAL</option>
                </select>
              </div>
              {blMsg && <div className={`text-xs font-mono px-3 py-2 rounded ${blMsg.startsWith('✓')?'bg-tertiary/10 text-tertiary':'bg-error-container/20 text-error'}`}>{blMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddBL}
                  className="flex-1 bg-error text-on-error font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest hover:opacity-90">
                  Confirm Block
                </button>
                <button onClick={()=>{ setModal({open:false,ip:'',eventType:''}); setBlMsg('') }}
                  className="flex-1 bg-surface-container-highest text-slate-300 font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
