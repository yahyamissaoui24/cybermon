import axios from 'axios'

const BASE = 'http://localhost:8000'
const api  = axios.create({ baseURL: `${BASE}/api` })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { localStorage.clear(); window.location.href='/' }
  return Promise.reject(err)
})

export const authAPI = {
  login:    (email:string,password:string) => api.post('/auth/login',{email,password}).then(r=>r.data),
  register: (name:string,email:string,password:string,role:string) =>
            api.post('/auth/register',{name,email,password}).then(r=>r.data),
  logout:   () => api.post('/auth/logout').then(r=>r.data),
}
export const eventsAPI = {
  list:     (params?:Record<string,any>) => api.get('/events',{params}).then(r=>r.data),
  timeline: ()                           => api.get('/events/timeline').then(r=>r.data),
}
export const statsAPI  = { get: () => api.get('/stats').then(r=>r.data) }
export const alertsAPI = {
  list:       (u?:boolean) => api.get('/alerts',{params:u?{unread_only:true}:{}}).then(r=>r.data),
  markRead:   (id:string)  => api.patch(`/alerts/${id}/read`).then(r=>r.data),
  markAllRead:()           => api.patch('/alerts/read-all').then(r=>r.data),
  clear:      ()           => api.delete('/alerts/clear').then(r=>r.data),
}
export const blacklistAPI = {
  list:  ()  => api.get('/blacklist').then(r=>r.data),
  stats: ()  => api.get('/blacklist/stats').then(r=>r.data),
  add:   (d:{ip:string;reason:string;threat_level:string;event_type?:string;auto_blocked?:boolean}) =>
         api.post('/blacklist',d).then(r=>r.data),
  remove:(ip:string) => api.delete(`/blacklist/${ip}`).then(r=>r.data),
}
export const usersAPI = {
  list:    () => api.get('/users').then(r=>r.data),
  create:  (d:{name:string;email:string;password:string;role:string}) => api.post('/users',d).then(r=>r.data),
  disable: (id:string) => api.patch(`/users/${id}/disable`).then(r=>r.data),
  delete:  (id:string) => api.delete(`/users/${id}`).then(r=>r.data),
}
export const simAPI = {
  start:   () => api.post('/simulation/start').then(r=>r.data),
  pause:   () => api.post('/simulation/pause').then(r=>r.data),
  resume:  () => api.post('/simulation/resume').then(r=>r.data),
  stop:    () => api.post('/simulation/stop').then(r=>r.data),
  setScale:(s:number) => api.post(`/simulation/scale/${s}`).then(r=>r.data),
  status:  () => api.get('/simulation/status').then(r=>r.data),
}
export const settingsAPI = {
  getThresholds:    () => api.get('/settings/thresholds').then(r=>r.data),
  updateThresholds: (d:{normal:number;suspicious:number;attack:number;critical:number}) =>
                    api.patch('/settings/thresholds',d).then(r=>r.data),
  updateProfile:    (d:{name?:string;email?:string;password?:string}) =>
                    api.patch('/settings/profile',d).then(r=>r.data),
  getNotifPrefs:    () => api.get('/settings/notifications').then(r=>r.data),
  saveNotifPrefs:   (d:{alerts_enabled:boolean;email_enabled?:boolean;critical_only?:boolean}) =>
                    api.patch('/settings/notifications',d).then(r=>r.data),
}
export const reportAPI = {
  get: () => api.get('/report').then(r => r.data),
}
export default api
