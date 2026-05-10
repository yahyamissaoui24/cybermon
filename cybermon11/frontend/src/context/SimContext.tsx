import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { simAPI } from '../services/api'

interface SimCtx {
  running:boolean; paused:boolean; timeScale:number
  setTimeScale:(s:number)=>void; refresh:()=>void
}
const Ctx = createContext<SimCtx>({running:false,paused:false,timeScale:60,setTimeScale:()=>{},refresh:()=>{}})

export function SimProvider({children}:{children:ReactNode}) {
  const [running,    setRunning]   = useState(false)
  const [paused,     setPaused]    = useState(false)
  const [timeScale,  setTimeScaleS]= useState(60)

  const refresh = async () => {
    try {
      const s = await simAPI.status()
      setRunning(s.running); setPaused(s.paused??false); setTimeScaleS(s.time_scale)
    } catch {}
  }

  const setTimeScale = async (s:number) => {
    try { await simAPI.setScale(s); setTimeScaleS(s) } catch {}
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    refresh()
    const i = setInterval(()=>{ if(localStorage.getItem('token')) refresh() }, 5000)
    return ()=>clearInterval(i)
  }, [])

  return <Ctx.Provider value={{running,paused,timeScale,setTimeScale,refresh}}>{children}</Ctx.Provider>
}
export const useSim = () => useContext(Ctx)
