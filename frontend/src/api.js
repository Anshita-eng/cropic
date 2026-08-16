const BASE = 'http://127.0.0.1:8000/api'

function authHeaders() {
  const token = localStorage.getItem('cropic_token')
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { headers: authHeaders(), ...opts })
  if (res.status === 401) { localStorage.clear(); window.location.reload() }
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || res.statusText) }
  return res.json()
}

// Auth
export const login = (username, password) =>
  req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })

export const register = (params) =>
  req(`/auth/register?${new URLSearchParams(params)}`, { method: 'POST' })

export const getMe = () => req('/auth/me')

// Submissions
export const submitCrop = (payload) =>
  req('/submit', { method: 'POST', body: JSON.stringify(payload) })

export const getSubmissions = (params = {}) =>
  req(`/submissions?${new URLSearchParams(params)}`)

export const getSubmission = (id) => req(`/submissions/${id}`)

// Claims
export const createClaim = (payload) =>
  req('/claims', { method: 'POST', body: JSON.stringify(payload) })

export const getClaims = (params = {}) =>
  req(`/claims?${new URLSearchParams(params)}`)

export const getClaim = (id) => req(`/claims/${id}`)

// Official
export const reviewClaim = (id, action, review_notes = '') =>
  req(`/claims/${id}/review`, { method: 'POST', body: JSON.stringify({ action, review_notes }) })


export const getOfficialClaims = (status = 'all') =>
  req(`/official/claims?status=${status}`)

// Stats
export const getStats = () => req('/stats')
