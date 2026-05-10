import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

export interface User { id:string; name:string; email:string; role:string }
interface AuthCtx {
  user: User|null; token:string|null
  login:(e:string,p:string)=>Promise<void>
  logout:()=>void
  isAdmin:boolean; isAnalyst:boolean; isSecEng:boolean; isUser:boolean
}
const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({children}:{children:ReactNode}) {
  const [user,  setUser]  = useState<User|null>(null)
  const [token, setToken] = useState<string|null>(null)

  useEffect(()=>{
    const t=localStorage.getItem('token'), u=localStorage.getItem('user')
    if(t&&u){ try{ setToken(t); setUser(JSON.parse(u)) }catch{ localStorage.clear() } }
  },[])

  const login = async (email:string, password:string) => {
    const d = await authAPI.login(email, password)
    localStorage.setItem('token', d.access_token)
    localStorage.setItem('user',  JSON.stringify(d.user))
    setToken(d.access_token); setUser(d.user)
  }
  const logout = async () => {
    try { await authAPI.logout() } catch {}
    localStorage.clear(); setToken(null); setUser(null)
  }
  return (
    <Ctx.Provider value={{ user, token, login, logout,
      isAdmin:  user?.role==='admin',
      isAnalyst:user?.role==='analyst',
      isSecEng: user?.role==='security_engineer',
      isUser:   user?.role==='user',
    }}>
      {children}
    </Ctx.Provider>
  )
}
export const useAuth = () => useContext(Ctx)
