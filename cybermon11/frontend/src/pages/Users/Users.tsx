import { useEffect, useState } from 'react'
import { usersAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface AppUser { id:string;name:string;email:string;role:string;status:string;last_login:string|null }

const ROLE_LABELS: Record<string,string> = { admin:'Admin', analyst:'Threat Analyst', security_engineer:'Security Engineer' }
const ROLE_STYLE:  Record<string,string> = {
  admin:             'bg-secondary-container/10 text-secondary border-secondary-container/20',
  analyst:           'bg-primary/10 text-primary border-primary/20',
  security_engineer: 'bg-tertiary/10 text-tertiary border-tertiary/20',
}
const STATUS_DOT: Record<string,string> = { active:'bg-tertiary shadow-[0_0_8px_#4edea3]', offline:'bg-slate-600', disabled:'bg-error' }
const INIT_COLORS = ['text-primary','text-secondary','text-tertiary','text-on-surface-variant']

export default function Users() {
  const { user: me } = useAuth()
  const [users,  setUsers]  = useState<AppUser[]>([])
  const [modal,  setModal]  = useState(false)
  const [form,   setForm]   = useState({name:'',email:'',password:'',role:'analyst'})
  const [error,  setError]  = useState('')
  const [confirm,setConfirm]= useState<{open:boolean;id:string;name:string;action:'delete'|'disable'}>({open:false,id:'',name:'',action:'delete'})

  const load = async () => { try { setUsers(await usersAPI.list()) } catch {} }
  useEffect(()=>{ load() },[])

  const handleCreate = async () => {
    if(!form.name||!form.email||!form.password) { setError('All fields required'); return }
    try { await usersAPI.create(form); setModal(false); setForm({name:'',email:'',password:'',role:'analyst'}); setError(''); load() }
    catch(e:any){ setError(e?.response?.data?.detail??'Error') }
  }

  const handleAction = async () => {
    try {
      if(confirm.action==='delete') await usersAPI.delete(confirm.id)
      else await usersAPI.disable(confirm.id)
      setConfirm({open:false,id:'',name:'',action:'delete'}); load()
    } catch(e:any){ alert(e?.response?.data?.detail??'Error') }
  }

  const initials = (name:string) => name.split(/[_\s]/).map(p=>p[0]).join('').slice(0,2).toUpperCase()
  const fmt = (iso:string|null) => iso ? new Date(iso).toLocaleString() : 'Never'

  return (
    <div className="p-8 min-h-screen bg-surface-container-lowest">
      <div className="flex flex-col mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface">User Management</h2>
        <p className="text-sm text-slate-500 mt-1">Personnel access control and real-time operator authorization.</p>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden shadow-xl border border-outline-variant/10">
        <div className="p-6 border-b border-outline-variant/5 flex justify-between items-center">
          <h3 className="font-headline font-bold text-lg text-primary tracking-wide uppercase">Sentinel Operators</h3>
          <button onClick={()=>setModal(true)}
            className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">person_add</span> Provision Operator
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                {['Operator','Role','Status','Last Login','Actions'].map(h=>(
                  <th key={h} className={`px-6 py-4 font-medium ${h==='Actions'?'text-right':''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {users.map((u,idx)=>(
                <tr key={u.id} className="hover:bg-surface-container-high transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded bg-surface-variant flex items-center justify-center font-mono text-xs font-bold border border-outline-variant/20 ${INIT_COLORS[idx%INIT_COLORS.length]}`}>
                        {initials(u.name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{u.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">id: {u.id.slice(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border uppercase tracking-tighter ${ROLE_STYLE[u.role]??ROLE_STYLE.analyst}`}>
                      {ROLE_LABELS[u.role]??u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[u.status]??'bg-slate-600'}`}></span>
                      <span className="text-xs text-on-surface capitalize">{u.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{fmt(u.last_login)}</td>
                  <td className="px-6 py-4 text-right">
                    {me?.id!==u.id&&(
                      <div className="flex items-center justify-end gap-3">
                        {u.status!=='disabled'&&(
                          <button onClick={()=>setConfirm({open:true,id:u.id,name:u.name,action:'disable'})}
                            className="text-[10px] font-mono text-slate-500 hover:text-yellow-400 transition-colors uppercase">
                            Block
                          </button>
                        )}
                        <button onClick={()=>setConfirm({open:true,id:u.id,name:u.name,action:'delete'})}
                          className="text-[10px] font-mono text-slate-500 hover:text-error transition-colors uppercase">
                          Delete
                        </button>
                      </div>
                    )}
                    {me?.id===u.id&&<span className="text-[10px] font-mono text-slate-600">(you)</span>}
                  </td>
                </tr>
              ))}
              {users.length===0&&(
                <tr><td colSpan={5} className="text-center py-12 text-slate-600 font-mono text-xs">
                  No operators registered yet — create accounts via the Register page
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/5 flex justify-center">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
            {users.length} Operator{users.length!==1?'s':''} registered
          </p>
        </div>
      </div>

      {/* Create Modal */}
      {modal&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person_add</span> Provision Operator
            </h3>
            <div className="space-y-4">
              {[
                {key:'name',    label:'Name',     ph:'John_Doe',              type:'text'},
                {key:'email',   label:'Email',    ph:'op@cybermon.io',        type:'email'},
                {key:'password',label:'Password', ph:'••••••••',              type:'password'},
              ].map(f=>(
                <div key={f.key}>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">{f.label}</label>
                  <input className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    type={f.type} placeholder={f.ph}
                    value={(form as any)[f.key]}
                    onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1.5">Role</label>
                <select className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm outline-none"
                  value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
                  <option value="analyst">Threat Analyst</option>
                  <option value="security_engineer">Security Engineer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {error&&<div className="text-xs font-mono text-error bg-error-container/20 px-3 py-2 rounded">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate}
                  className="flex-1 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest">
                  Create
                </button>
                <button onClick={()=>{setModal(false);setError('')}}
                  className="flex-1 bg-surface-container-highest text-slate-300 font-bold text-xs py-2.5 rounded-lg uppercase hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action */}
      {confirm.open&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-8 w-full max-w-sm shadow-2xl text-center">
            <span className={`material-symbols-outlined text-4xl mb-3 block ${confirm.action==='delete'?'text-error':'text-yellow-400'}`}>
              {confirm.action==='delete'?'delete_forever':'block'}
            </span>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">
              {confirm.action==='delete'?'Delete Operator':'Block Operator'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {confirm.action==='delete'
                ?`Permanently delete "${confirm.name}"? This cannot be undone.`
                :`Disable access for "${confirm.name}"?`}
            </p>
            <div className="flex gap-3">
              <button onClick={handleAction}
                className={`flex-1 font-bold text-xs py-2.5 rounded-lg uppercase tracking-widest ${confirm.action==='delete'?'bg-error text-on-error':'bg-yellow-500 text-black'}`}>
                Confirm
              </button>
              <button onClick={()=>setConfirm({open:false,id:'',name:'',action:'delete'})}
                className="flex-1 bg-surface-container-highest text-slate-300 font-bold text-xs py-2.5 rounded-lg uppercase hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
