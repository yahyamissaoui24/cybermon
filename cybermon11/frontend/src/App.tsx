import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SimProvider } from './context/SimContext'
import { useWebSocket } from './hooks/useWebSocket'
import { Sidebar, Topbar, Footer } from './components/Layout'
import Login    from './pages/Login/Login'
import Register from './pages/Register/Register'
import Dashboard     from './pages/Dashboard/Dashboard'
import Logs          from './pages/Logs/Logs'
import Alerts        from './pages/Alerts/Alerts'
import BlacklistPage from './pages/Blacklist/BlacklistPage'
import Settings      from './pages/Settings/Settings'
import Users         from './pages/Users/Users'

const BREADCRUMBS: Record<string,string> = {
  '/dashboard':'Overview','/logs':'Logs','/alerts':'Alerts',
  '/blacklist':'Blocked IPs','/settings':'Settings','/users':'Users'
}

function Shell() {
  const { user } = useAuth()
  const { events, connected } = useWebSocket()
  const location = useLocation()
  const bc = BREADCRUMBS[location.pathname] ?? 'Overview'

  if (!user) return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*"         element={<Login />} />
    </Routes>
  )

  return (
    <SimProvider>
      <div className="bg-surface text-on-surface font-body overflow-hidden">
        <Sidebar />
        <Topbar breadcrumb={bc} />
        <main className="ml-64 mt-16 pb-8 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar">
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/login"     element={<Navigate to="/dashboard" replace />} />
            <Route path="/register"  element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard liveEvents={events} />} />
            <Route path="/logs"      element={<Logs />} />
            {/* Restricted routes */}
            {user.role !== 'user' && <>
              <Route path="/alerts"    element={<Alerts />} />
              <Route path="/blacklist" element={<BlacklistPage />} />
            </>}
            {(user.role === 'admin' || user.role === 'security_engineer') && <>
              <Route path="/settings"  element={<Settings />} />
            </>}
            {user.role === 'admin' && <>
              <Route path="/users"     element={<Users />} />
            </>}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <Footer connected={connected} />
      </div>
    </SimProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  )
}
