import { useState, useEffect } from 'react'
import { settingsAPI, simAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSim } from '../../context/SimContext'

const TABS = ['Profile','Detection Thresholds','Notifications','Engine Core','Infrastructure']

export default function Settings() {
  const { user } = useAuth()
  const { running, paused, timeScale, setTimeScale, refresh: refreshSim } = useSim()
  const [tab,      setTab]      = useState('Profile')
  const [name,     setName]     = useState(user?.name??'')
  const [email,    setEmail]    = useState(user?.email??'')
  const [password, setPassword] = useState('')
  const [msg,      setMsg]      = useState('')
  const [thresholds, setThresholds] = useState({normal:0,suspicious:30,attack:60,critical:85})
  const [thMsg, setThMsg] = useState('')
  // Notifications - functional state
  const [notifs, setNotifs] = useState({alerts_enabled:true})
  const [notifMsg, setNotifMsg] = useState('')
  // Sim clock
  const [simTime,     setSimTime]     = useState('00:00:00')
  const [simProgress, setSimProgress] = useState(0)

  // Poll sim status every second
  useEffect(()=>{
    const load = async () => {
      try {
        const s = await simAPI.status()
        setSimTime(s.sim_time??'00:00:00')
        setSimProgress(Math.min(100, s.sim_progress??0))
      } catch {}
    }
    load()
    const i = setInterval(load, 1000)
    return ()=>clearInterval(i)
  },[])

  // Load thresholds
  useEffect(()=>{
    settingsAPI.getThresholds().then(t=>{
      if (t) setThresholds({normal:t.normal??0,suspicious:t.suspicious??30,attack:t.attack??60,critical:t.critical??85})
    }).catch(()=>{})
  },[])

  // Load notification prefs
  useEffect(()=>{
    settingsAPI.getNotifPrefs().then(p=>{
      if (p) setNotifs({alerts_enabled:p.alerts_enabled??true})
    }).catch(()=>{})
  },[])

  const saveProfile = async () => {
    try {
      await settingsAPI.updateProfile({name,email,...(password?{password}:{})})
      setMsg('✓ Profile updated'); setTimeout(()=>setMsg(''),2000)
    } catch { setMsg('Error updating profile') }
  }

  const saveThresholds = async () => {
    try {
      await settingsAPI.updateThresholds(thresholds)
      setThMsg('✓ Thresholds updated'); setTimeout(()=>setThMsg(''),2000)
    } catch { setThMsg('Error saving') }
  }

  const saveNotifs = async () => {
    try {
      await settingsAPI.saveNotifPrefs({alerts_enabled: notifs.alerts_enabled, email_enabled: false, critical_only: false})
      setNotifMsg('✓ Preferences saved'); setTimeout(()=>setNotifMsg(''),2000)
    } catch { setNotifMsg('Error saving') }
  }

  const handleStart  = async () => { try { await simAPI.start();  refreshSim() } catch {} }
  const handlePause  = async () => { try { await simAPI.pause();  refreshSim() } catch {} }
  const handleResume = async () => { try { await simAPI.resume(); refreshSim() } catch {} }
  const handleStop   = async () => { try { await simAPI.stop();   refreshSim() } catch {} }

  const CAT_C: Record<string,string>={normal:'text-tertiary',suspicious:'text-primary',attack:'text-secondary',critical:'text-error'}
  const SCALE_LABELS: Record<number,string> = {1:'×1 (real-time)',10:'×10',60:'×60 (1min=1h)',1440:'×1440 (1min=1day)'}

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-[1400px] mx-auto p-8">
        <div className="mb-6">
          <h2 className="text-4xl font-headline font-bold tracking-tight text-white mb-2">
            Sentinel Protocol <span className="text-primary">Configuration</span>
          </h2>
          <p className="text-on-surface-variant">Manage administrative profile, detection parameters, and system core state.</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-outline-variant/20">
          <div className="flex gap-8 overflow-x-auto pb-px no-scrollbar">
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`px-1 py-4 text-xs font-headline font-bold uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${tab===t?'text-primary border-tertiary':'text-slate-500 hover:text-slate-300 border-transparent'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Profile */}
        {tab==='Profile'&&(
          <div className="max-w-2xl bg-surface-container rounded-xl p-8 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary">security</span>
              <h3 className="text-sm font-headline font-bold uppercase tracking-[0.2em]">Identity & Access</h3>
            </div>
            <div className="space-y-5">
              {[
                {label:'Administrative Name',type:'text',    val:name,     set:setName},
                {label:'Secure Email',       type:'email',   val:email,    set:setEmail},
                {label:'Protocol Password',  type:'password',val:password, set:setPassword},
              ].map(f=>(
                <div key={f.label}>
                  <label className="block text-[10px] font-headline font-bold text-slate-500 uppercase tracking-widest mb-1.5">{f.label}</label>
                  <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                    type={f.type} value={f.val} placeholder={f.type==='password'?'••••••••':''}
                    onChange={e=>f.set(e.target.value)} />
                </div>
              ))}
              {msg&&<div className="text-xs font-mono text-tertiary bg-tertiary/10 px-3 py-2 rounded">{msg}</div>}
              <button onClick={saveProfile}
                className="w-full py-3 bg-surface-container-high border border-outline-variant/30 text-primary font-headline font-bold text-xs uppercase tracking-widest hover:bg-surface-variant rounded-lg">
                Update Profile
              </button>
            </div>
          </div>
        )}

        {/* Detection Thresholds */}
        {tab==='Detection Thresholds'&&(
          <div className="bg-surface-container rounded-xl p-8 border border-outline-variant/10 max-w-3xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary">analytics</span>
                <h3 className="text-sm font-headline font-bold uppercase tracking-[0.2em]">Risk Score Thresholds</h3>
              </div>
              <div className="px-3 py-1 bg-tertiary/10 border border-tertiary/30 rounded text-[10px] font-mono text-tertiary font-bold">CONFIGURABLE</div>
            </div>
            <p className="text-xs text-slate-500 font-mono mb-8">
              Set the minimum risk score that classifies an event into each category.
            </p>
            <div className="space-y-8">
              {(['normal','suspicious','attack','critical'] as const).map(cat=>(
                <div key={cat}>
                  <div className="flex justify-between mb-2">
                    <label className={`text-[10px] font-headline font-bold uppercase tracking-widest ${CAT_C[cat]}`}>
                      {cat.toUpperCase()} — events with score ≥ <span className="font-mono">{thresholds[cat]}</span>
                    </label>
                    <span className={`font-mono text-lg font-bold ${CAT_C[cat]}`}>{thresholds[cat]}</span>
                  </div>
                  <input type="range" min={0} max={99} step={1}
                    value={thresholds[cat]}
                    onChange={e=>setThresholds(p=>({...p,[cat]:+e.target.value}))}
                    className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
                    style={{accentColor: cat==='normal'?'#4edea3':cat==='suspicious'?'#adc6ff':cat==='attack'?'#ffb3ad':'#ffb4ab'}}/>
                  <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-1">
                    <span>0</span><span>50</span><span>99</span>
                  </div>
                </div>
              ))}
            </div>
            {thMsg&&<div className="text-xs font-mono text-tertiary bg-tertiary/10 px-3 py-2 rounded mt-4">{thMsg}</div>}
            <button onClick={saveThresholds}
              className="mt-6 w-full py-3 bg-primary text-on-primary font-headline font-bold text-xs uppercase tracking-widest hover:opacity-90 rounded-lg">
              Save Thresholds
            </button>
          </div>
        )}

        {/* Notifications — FUNCTIONAL */}
        {tab==='Notifications'&&(
          <div className="max-w-3xl bg-surface-container rounded-xl p-8 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-secondary">notifications_active</span>
              <h3 className="text-sm font-headline font-bold uppercase tracking-[0.2em]">Notification Preferences</h3>
            </div>
            <div className="space-y-4">
              {[
                {key:'alerts_enabled', label:'Enable Alerts', desc:'Show real-time alerts in the dashboard'},
              ].map(n=>(
                <div key={n.key} className="flex items-center justify-between p-5 bg-surface-container-low rounded-xl border border-outline-variant/10">
                  <div>
                    <p className="text-sm font-bold text-white">{n.label}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{n.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={(notifs as any)[n.key]}
                      onChange={e=>setNotifs(p=>({...p,[n.key]:e.target.checked}))} />
                    <div className={`w-12 h-6 rounded-full transition-all duration-300 relative
                      ${(notifs as any)[n.key]?'bg-tertiary shadow-[0_0_12px_rgba(78,222,163,0.4)]':'bg-surface-container-highest'}
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                      ${(notifs as any)[n.key]?'after:translate-x-6':''}`}></div>
                  </label>
                </div>
              ))}
            </div>
            {notifMsg&&<div className="text-xs font-mono text-tertiary bg-tertiary/10 px-3 py-2 rounded mt-4">{notifMsg}</div>}
            <button onClick={saveNotifs}
              className="mt-6 w-full py-3 bg-primary text-on-primary font-headline font-bold text-xs uppercase tracking-widest hover:opacity-90 rounded-lg">
              Save Preferences
            </button>
          </div>
        )}

        {/* Engine Core */}
        {tab==='Engine Core'&&(
          <div className="bg-surface-container rounded-xl p-8 border-l-4 border-primary max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-headline font-semibold uppercase tracking-widest text-[#d8e2ff]">Engine Core 01</h3>
                <p className="text-xs text-on-surface-variant font-mono uppercase mt-1">
                  Fake 24h day: 00:00:00 → 23:59:59
                </p>
              </div>
              <div className="flex gap-3">
                {!running&&!paused&&(
                  <button onClick={handleStart}
                    className="flex items-center gap-2 px-6 py-3 bg-tertiary text-[#003824] font-headline font-bold rounded-lg hover:brightness-110">
                    <span className="material-symbols-outlined">play_arrow</span> START SIMULATION
                  </button>
                )}
                {running&&!paused&&(
                  <button onClick={handlePause}
                    className="flex items-center gap-2 px-6 py-3 bg-surface-container-high text-on-surface font-headline font-bold rounded-lg border border-outline-variant/30 hover:bg-surface-container-highest">
                    <span className="material-symbols-outlined">pause</span> PAUSE
                  </button>
                )}
                {paused&&(
                  <button onClick={handleResume}
                    className="flex items-center gap-2 px-6 py-3 bg-primary-container text-on-primary-container font-headline font-bold rounded-lg hover:brightness-110">
                    <span className="material-symbols-outlined">play_arrow</span> RESUME
                  </button>
                )}
                {(running||paused)&&(
                  <button onClick={handleStop}
                    className="flex items-center gap-2 px-4 py-3 bg-error-container text-on-error-container font-headline font-bold rounded-lg hover:brightness-110">
                    <span className="material-symbols-outlined">stop</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-surface-container-low rounded-lg border border-outline-variant/20">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${running?'bg-tertiary animate-pulse shadow-[0_0_8px_#4edea3]':paused?'bg-yellow-400':'bg-slate-600'}`}></div>
              <span className="font-mono text-sm font-bold">
                {running?'SIMULATION RUNNING':paused?'SIMULATION PAUSED':'SIMULATION STOPPED'}
              </span>
            </div>

            {/* Fake clock display */}
            <div className="mb-6 p-6 bg-surface-container-low rounded-lg border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                    Simulated Clock (00:00:00 → 23:59:59)
                  </span>
                  <span className="text-3xl font-mono font-bold text-tertiary">{simTime}</span>
                  <span className="text-slate-600 text-sm font-mono ml-3">/ 23:59:59</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="w-48 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-500"
                      style={{width:`${simProgress}%`}}/>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{simProgress.toFixed(1)}% of simulated day</span>
                </div>
                {running&&(
                  <div className="flex gap-1.5 ml-4">
                    <div className="w-1.5 h-8 bg-tertiary rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-5 bg-tertiary/40 rounded-full"></div>
                    <div className="w-1.5 h-10 bg-tertiary/60 rounded-full animate-pulse" style={{animationDelay:'0.1s'}}></div>
                  </div>
                )}
              </div>
            </div>

            {/* Time scale */}
            <div>
              <label className="text-[10px] font-headline font-bold text-slate-500 uppercase tracking-widest mb-3 block">
                Time Acceleration
              </label>
              <div className="grid grid-cols-4 gap-3">
                {([1,10,60,1440] as const).map(s=>(
                  <button key={s} onClick={()=>setTimeScale(s)}
                    className={`py-3 font-headline font-bold rounded-lg border transition-all text-sm flex flex-col items-center gap-1 ${timeScale===s?'bg-primary text-on-primary border-primary':'bg-surface-container-high border-outline-variant/30 text-slate-400 hover:text-white'}`}>
                    <span>{s===1440?'×1440':s===60?'×60':s===10?'×10':'×1'}</span>
                    <span className={`text-[9px] font-mono font-normal ${timeScale===s?'text-on-primary/70':'text-slate-600'}`}>
                      {s===1?'1s=1s':s===10?'1s=10s':s===60?'1s=1min':'1min=1day'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-slate-600 mt-3">
                ×1440: complete simulated day in 1 real minute
              </p>
            </div>
          </div>
        )}

        {/* Infrastructure */}
        {tab==='Infrastructure'&&(
          <div className="max-w-md bg-surface-container-high rounded-xl p-8 border border-outline-variant/10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline font-bold text-sm tracking-widest uppercase text-slate-400">Infrastructure</h3>
              <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            <div className="space-y-4">
              {[{icon:'database',label:'PostgreSQL',status:'ONLINE'},{icon:'bolt',label:'Redis Cache',status:'SYNCED'},{icon:'sync_alt',label:'WebSocket',status:'CONNECTED'}].map(s=>(
                <div key={s.label} className="flex items-center justify-between p-4 bg-surface-container rounded border-l-4 border-tertiary">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary text-sm">{s.icon}</span>
                    <span className="font-mono text-xs">{s.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-tertiary">{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
