import { useState, useEffect } from 'react'
import { getMe } from './api'
import LoginPage from './pages/LoginPage'
import FarmerApp from './pages/FarmerApp'
import OfficialDashboard from './pages/OfficialDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const role = normalizeRole(user?.role)

  useEffect(() => {
    const token = localStorage.getItem('cropic_token')
    if (token) {
      getMe().then(u => { setUser(u); setLoading(false) }).catch(() => { localStorage.clear(); setLoading(false) })
    } else {
      setLoading(false)
    }
  }, [])

  function handleLogin(userData, token) {
    localStorage.setItem('cropic_token', token)
    setUser(userData)
  }

  function handleLogout() {
    localStorage.clear()
    setUser(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f0' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌾</div>
        <div>Loading CROPIC…</div>
      </div>
    </div>
  )

  if (!user) return <LoginPage onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top nav */}
      <nav style={{ background: '#1a5c2a', color: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', height: 52, gap: 16 }}>
        <span style={{ fontSize: 20 }}>🌾</span>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.4 }}>CROPIC</span>
        <span style={{ fontSize: 11, opacity: 0.65 }}>PMFBY · Ministry of Agriculture</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>{user.full_name}</span>
          <span style={{ fontSize: 11, background: role === 'official' ? '#e36209' : '#2e7d32', padding: '2px 8px', borderRadius: 4 }}>
            {role}
          </span>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Logout
          </button>
        </div>
      </nav>

      {role === 'official'
        ? <OfficialDashboard user={user} />
        : <FarmerApp user={user} />
      }
    </div>
  )
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  return value === 'officer' ? 'official' : value
}
