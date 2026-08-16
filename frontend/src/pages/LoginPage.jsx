import { useState } from 'react'
import { login } from '../api'

const DEMO = [
  { label: 'Farmer — Ramesh Kumar', u: 'ramesh_k', p: 'pass123', role: 'farmer' },
  { label: 'Farmer — Sunita Devi',  u: 'sunita_d', p: 'pass123', role: 'farmer' },
  { label: 'Official — Deepak Sharma', u: 'officer_mh', p: 'admin123', role: 'official' },
]

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(u = username, p = password) {
    if (!u || !p) { setError('Enter username and password'); return }
    setLoading(true); setError('')
    try {
      const res = await login(u, p)
      localStorage.setItem("cropic_token", res.token)
      onLogin({ id: res.user_id, full_name: res.full_name, role: normalizeRole(res.role), username: u }, res.token)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1a5c2a,#2e7d32,#388e3c)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44 }}>🌾</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#1a5c2a', marginTop: 6 }}>CROPIC</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>PMFBY Crop Monitoring Portal</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Username</label>
          <input style={inp} placeholder="e.g. ramesh_k" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Password</label>
          <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        {error && <div style={{ background: '#ffeef0', color: '#cb2431', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button onClick={() => handleLogin()} disabled={loading} style={{ width: '100%', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 18 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10, textAlign: 'center' }}>Quick demo login</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO.map(d => (
              <button key={d.u} onClick={() => { setUsername(d.u); setPassword(d.p); handleLogin(d.u, d.p) }}
                style={{ background: d.role === 'official' ? '#fff3e0' : '#f0f9f0', border: `1px solid ${d.role === 'official' ? '#e36209' : '#1a5c2a'}`, borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: d.role === 'official' ? '#e36209' : '#1a5c2a', fontWeight: 500, textAlign: 'left' }}>
                {d.role === 'official' ? '🏛️' : '👨‍🌾'} {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  return value === 'officer' ? 'official' : value
}
