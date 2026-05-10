import { useEffect, useState, useCallback } from 'react'
import { blacklistAPI } from '../../services/api'

interface BLItem { id:string;ip:string;reason:string;threat_level:string;auto_blocked:boolean;event_type:string|null;created_at:string }

const LEVEL_STYLE: Record<string,string>={
  CRITICAL:'bg-secondary-container/20 text-secondary border-secondary/20',
  WARNING: 'bg-on-secondary-container/10 text-on-secondary-container border-on-secondary-container/20',
  LOW:     'bg-tertiary/10 text-tertiary border-tertiary/20',
}

export default function BlacklistPage() {
  const [items,   setItems]   = useState<BLItem[]>([])
  const [bstats,  setBstats]  = useState<any>({total:0,auto_blocked:0,top_event_type:'—'})
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({ip:'',reason:'',threat_level:'WARNING'})
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bl, bs] = await Promise.all([blacklistAPI.list(), blacklistAPI.stats()])
      setItems(bl); setBstats(bs)
    } catch {} finally { setLoading(false) }
  },[])

  useEffect(()=>{ load() },[])
  useEffect(()=>{ const i=setInterval(load,10000); return()=>clearInterval(i) },[load])

  const filtered = items.filter(i=>i.ip.includes(search)||i.reason.toLowerCase().includes(search.toLowerCase()))

  const handleAdd = async () => {
    if (!form.ip||!form.reason) { setError('IP and reason required'); return }
    try {
      await blacklistAPI.add({ip:form.ip,reason:form.reason,threat_level:form.threat_level})
      setModal(false); setForm({ip:'',reason:'',threat_level:'WARNING'}); setError(''); load()
    } catch(e:any){ setError(e?.response?.data?.detail??'Error') }
  }

  const handleUnblock = async (ip:string) => {
    try { await blacklistAPI.remove(ip); load() } catch {}
  }

  return (
    <div className="max-w-[1600px] mx-auto p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-headline text-3xl font-bold text-on-surface tracking-tight">Blocked IPs</h2>
          <p className="text-slate-500 font-body text-sm mt-1">Manage network exclusions and infrastructure security.</p>
        </div>
        <button onClick={()=>setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-lg uppercase tracking-widest hover:opacity-90">
          <span className="material-symbols-outlined text-sm">add</span> Add IP
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label:'Total Blocked IPs',     value:bstats.total,          sub:'All time',              color:'text-on-surface', icon:'public_off' },
          { label:'Auto-Blocked by System', value:bstats.auto_blocked,   sub:`Manual: ${bstats.total-bstats.auto_blocked}`, color:'text-secondary', icon:'smart_toy' },
          { label:'Most Blocked Event',     value:bstats.top_event_type?.replace(/_/g,' ')??'—', sub:'Top threat pattern', color:'text-primary', icon:'bug_report' },
        ].map(s=>(
          <div key={s.label} className="bg-surface-container p-6 rounded-xl border border-outline-variant/10 relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] opacity-5">
              <span className="material-symbols-outlined text-8xl">{s.icon}</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-headline font-bold block mb-2">{s.label}</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-slate-400">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">security</span>
            <h3 className="font-headline font-bold text-on-surface">Blacklisted Protocol Addresses</h3>
            {loading&&<span className="text-[10px] font-mono text-slate-500 animate-pulse">Syncing...</span>}
          </div>
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
            <input className="bg-surface-container-lowest border border-outline-variant/10 text-[10px] py-2 pl-9 pr-3 w-full rounded focus:ring-1 focus:ring-primary text-on-surface outline-none"
              placeholder="Search IP, Reason..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body">
            <thead className="bg-surface-container-high/50 text-[10px] uppercase tracking-widest text-slate-500 border-b border-outline-variant/10">
              <tr>
                {['IP Address','Reason','Type','Date Added','Threat Level','Source','Action'].map(h=>(
                  <th key={h} className={`px-6 py-4 font-semibold ${h==='Action'?'text-right':''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-outline-variant/5">
              {filtered.map(item=>(
                <tr key={item.id} className="hover:bg-surface-container-high/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary font-medium">{item.ip}</td>
                  <td className="px-6 py-4 max-w-[200px] truncate">{item.reason}</td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{item.event_type?.replace(/_/g,' ')??'—'}</td>
                  <td className="px-6 py-4 text-slate-400">{item.created_at?new Date(item.created_at).toLocaleString():'—'}</td>
                  <td className="px-6 py-4">
                    <span className={`${LEVEL_STYLE[item.threat_level]??LEVEL_STYLE.WARNING} px-2 py-0.5 rounded text-[9px] font-bold tracking-wider border`}>
                      {item.threat_level}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-bold font-mono uppercase ${item.auto_blocked?'text-secondary':'text-slate-400'}`}>
                      {item.auto_blocked?'AUTO':'MANUAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={()=>handleUnblock(item.ip)}
                      className="text-slate-500 hover:text-tertiary transition-colors font-bold uppercase text-[10px]">
                      Unblock
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&(
                <tr><td colSpan={7} className="text-center py-12 text-slate-600 font-mono text-xs">
                  {loading?'Loading...':'No blocked IPs'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-surface-container-low text-[10px] text-slate-500 flex justify-between">
          <span>Showing {filtered.length} of {items.length} blocked nodes</span>
        </div>
      </div>

      {/* Add Modal — NO expires field */}
      {modal&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">block</span> Add to Blacklist
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">IP Address</label>
                <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary font-mono"
                  placeholder="192.168.1.1" value={form.ip} onChange={e=>setForm(p=>({...p,ip:e.target.value}))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Reason</label>
                <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. DDoS attack" value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Threat Level</label>
                <select className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none"
                  value={form.threat_level} onChange={e=>setForm(p=>({...p,threat_level:e.target.value}))}>
                  <option>LOW</option><option>WARNING</option><option>CRITICAL</option>
                </select>
              </div>
              {error&&<div className="text-xs font-mono text-error bg-error-container/20 px-3 py-2 rounded">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAdd} className="flex-1 bg-error text-on-error font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest">Block IP</button>
                <button onClick={()=>{setModal(false);setError('')}} className="flex-1 bg-surface-container-highest text-slate-300 font-bold text-xs py-2.5 rounded-lg uppercase hover:text-white">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
