import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email||!password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try { await login(email, password); navigate('/dashboard') }
    catch(err:any) {
      const msg = err?.response?.data?.detail
      setError(msg==='Invalid credentials'?'Invalid email or password. Please try again.':(msg??'Connection error — backend may still be starting up'))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-on-background overflow-y-auto relative">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none"
        style={{backgroundImage:'radial-gradient(circle at 1px 1px,rgba(173,198,255,0.05) 1px,transparent 0)',backgroundSize:'32px 32px'}}/>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="w-full flex justify-between items-center px-8 h-16 flex-shrink-0">
          <div className="text-xl font-black text-primary tracking-widest font-headline">CYBERMON</div>
          <span className="text-[10px] font-mono text-tertiary uppercase tracking-widest px-2 py-1 bg-tertiary/10 rounded-sm border border-tertiary/20">
            SYSTEM STATUS: OPERATIONAL
          </span>
        </header>

        {/* Form — centered with padding to ensure visibility */}
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[480px]">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5 mb-5 ring-1 ring-primary/20"
                style={{filter:'drop-shadow(0 0 12px rgba(173,198,255,0.3))'}}>
                <span className="material-symbols-outlined text-primary text-4xl">shield</span>
              </div>
              <h1 className="font-headline font-bold text-3xl tracking-widest text-primary mb-2">CYBERMON</h1>
              <p className="text-sm text-outline font-medium">Connexion au système de monitoring</p>
            </div>

            {/* Card */}
            <div className="rounded-[20px] p-10"
              style={{background:'#1c2230',boxShadow:'0 0 40px -10px rgba(173,198,255,0.15),inset 0 0 0 1px rgba(173,198,255,0.08)'}}>
              <form className="space-y-6" onSubmit={handle}>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-outline uppercase tracking-widest">Email</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/60 text-xl pointer-events-none">mail</span>
                    <input className="w-full bg-[#252b3b] border border-transparent rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-mono text-sm"
                      placeholder="agent@cybermon.io" type="email" value={email}
                      onChange={e=>{setEmail(e.target.value);setError('')}} autoComplete="email" required/>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-outline uppercase tracking-widest">Mot de passe</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/60 text-xl pointer-events-none">lock</span>
                    <input className="w-full bg-[#252b3b] border border-transparent rounded-xl py-4 pl-12 pr-12 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-mono text-sm"
                      placeholder="••••••••" type={showPw?'text':'password'} value={password}
                      onChange={e=>{setPassword(e.target.value);setError('')}} autoComplete="current-password" required/>
                    <button type="button" onClick={()=>setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-outline/60 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl">{showPw?'visibility_off':'visibility'}</span>
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 flex items-start gap-3">
                    <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
                    <span className="text-xs text-error font-mono">{error}</span>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-primary text-[#0b1326] font-headline font-black py-4 rounded-xl tracking-[0.1em] text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
                  {loading
                    ?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-[#0b1326]/40 border-t-[#0b1326] rounded-full animate-spin"></span>AUTHENTIFICATION...</span>
                    :'ACCÉDER AU SYSTÈME'}
                </button>
                <p className="text-center text-xs text-outline">
                  Pas encore de compte ?{' '}
                  <Link to="/register" className="text-primary hover:underline font-medium">S'inscrire</Link>
                </p>
              </form>
            </div>

            <div className="mt-8 text-center opacity-30 font-mono text-[9px] text-outline uppercase tracking-tighter space-x-3">
              <span>NODE: ALPHA-7-CENTAURI</span><span>•</span><span>LATENCY: 12ms</span><span>•</span><span>SEC: AES-256</span>
            </div>
          </div>
        </main>

        <footer className="flex-shrink-0 w-full flex justify-between items-center px-8 py-5 border-t border-outline-variant/10">
          <div className="font-body text-[10px] uppercase tracking-widest font-semibold text-outline/50">
            © 2024 SENTINEL PROTOCOL
          </div>
          <div className="flex gap-8">
            {['Privacy','Security Whitepaper','Contact'].map(l=>(
              <a key={l} href="#" className="font-body text-[10px] uppercase tracking-widest text-outline/30 hover:text-primary transition-colors">{l}</a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}
