import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../../services/api'

export default function Register() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState({name:'',email:'',password:''})
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name||!form.email||!form.password) { setError('All fields required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      await authAPI.register(form.name, form.email, form.password, 'user')
      setSuccess('Account created! Redirecting to login...')
      setTimeout(()=>navigate('/login'), 1400)
    } catch(err:any) {
      setError(err?.response?.data?.detail ?? 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-on-background overflow-y-auto"
      style={{backgroundImage:'radial-gradient(circle at 1px 1px,rgba(173,198,255,0.05) 1px,transparent 0)',backgroundSize:'32px 32px'}}>
      <header className="w-full flex justify-between items-center px-8 h-14 sticky top-0 z-10 bg-[#0b1326]/90 backdrop-blur-sm">
        <div className="text-xl font-black text-primary tracking-widest font-headline">CYBERMON</div>
        <span className="text-[10px] font-mono text-tertiary uppercase tracking-widest px-2 py-1 bg-tertiary/10 rounded-sm border border-tertiary/20">
          SENTINEL PROTOCOL
        </span>
      </header>
      <div className="flex justify-center px-6 py-8">
        <div className="w-full max-w-[480px]">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/5 mb-4 ring-1 ring-primary/20">
              <span className="material-symbols-outlined text-primary text-3xl">person_add</span>
            </div>
            <h1 className="font-headline font-bold text-2xl tracking-widest text-primary">CREATE ACCOUNT</h1>
            <p className="text-sm text-outline mt-1">Access will be granted by the administrator</p>
          </div>
          <div className="rounded-[20px] p-8"
            style={{background:'#1c2230',boxShadow:'0 0 40px -10px rgba(173,198,255,0.15),inset 0 0 0 1px rgba(173,198,255,0.08)'}}>
            <form className="space-y-5" onSubmit={handle}>
              {[
                {key:'name',  label:'Operator Name', ph:'John Doe',          type:'text'},
                {key:'email', label:'Email',          ph:'agent@cybermon.io', type:'email'},
              ].map(f=>(
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-outline uppercase tracking-widest mb-1.5">{f.label}</label>
                  <input className="w-full bg-[#252b3b] border border-transparent rounded-xl py-3.5 px-4 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 text-sm transition-all"
                    type={f.type} placeholder={f.ph}
                    value={(form as any)[f.key]}
                    onChange={e=>{setForm(p=>({...p,[f.key]:e.target.value}));setError('')}} required />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-bold text-outline uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <input className="w-full bg-[#252b3b] border border-transparent rounded-xl py-3.5 px-4 pr-12 text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/50 transition-all text-sm"
                    type={showPw?'text':'password'} placeholder="Min. 6 characters" value={form.password}
                    onChange={e=>{setForm(p=>({...p,password:e.target.value}));setError('')}} required />
                  <button type="button" onClick={()=>setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline/60 hover:text-primary">
                    <span className="material-symbols-outlined text-xl">{showPw?'visibility_off':'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Info box - no role choice */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
                <div>
                  <p className="text-xs text-primary font-bold">Limited Access Account</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">New accounts have access to Dashboard and Logs. The administrator can grant additional permissions.</p>
                </div>
              </div>

              {error   && <div className="bg-error-container/20 border border-error/30 rounded-xl px-4 py-3 text-xs text-error font-mono">{error}</div>}
              {success && <div className="bg-tertiary/10 border border-tertiary/30 rounded-xl px-4 py-3 text-xs text-tertiary font-mono">{success}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-[#0b1326] font-headline font-black py-3.5 rounded-xl tracking-[0.1em] text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
              <p className="text-center text-xs text-outline">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
