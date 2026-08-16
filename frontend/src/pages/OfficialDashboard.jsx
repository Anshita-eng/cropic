import { useState, useEffect } from 'react'
import { getStats, getOfficialClaims, reviewClaim } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'

const PIE_COLORS = ['#22863a','#e36209','#0366d6','#b08800','#cb2431','#6f42c1','#999']
const DAMAGE_COLOR = { none:'#22863a',lodging:'#e36209',flood_inundation:'#0366d6',water_stress:'#b08800',pest_attack:'#cb2431',fungal_disease:'#6f42c1' }

function KPI({ label, value, color='#1a5c2a', sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize:12, color:'#888', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function Badge({ status }) {
  const map = { pending:['#fff8e1','#b08800'], approved:['#e6f4ea','#1a5c2a'], rejected:['#ffeef0','#cb2431'] }
  const [bg,color] = map[status] || ['#f0f0f0','#888']
  return <span style={{ background:bg, color, borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:600, textTransform:'capitalize' }}>{status}</span>
}

// Minimal SVG map — district bubbles
function DistrictMap({ districts }) {
  if (!districts?.length) return null
  const latToY = lat => (37-lat)/(37-6.5)*320+30
  const lngToX = lng => (lng-68)/(97-68)*320+30
  return (
    <svg viewBox="0 0 380 380" style={{ width:'100%', maxHeight:340 }}>
      <rect width="380" height="380" fill="#edf2f7" rx="12"/>
      <text x="190" y="18" textAnchor="middle" style={{ fontSize:10, fill:'#999' }}>District severity overview</text>
      {districts.map((d,i) => {
        const x=lngToX(d.lng), y=latToY(d.lat), r=Math.max(9,Math.min(26,(d.count*2.8)))
        const c=d.avg_severity>60?'#cb2431':d.avg_severity>30?'#e36209':'#22863a'
        return <g key={i}>
          <circle cx={x} cy={y} r={r} fill={c} opacity={.75} stroke="#fff" strokeWidth={1.5}/>
          <text x={x} y={y+1} textAnchor="middle" dominantBaseline="central" style={{ fontSize:9, fill:'#fff', fontWeight:600 }}>{d.count}</text>
          <text x={x} y={y+r+10} textAnchor="middle" style={{ fontSize:9, fill:'#444' }}>{d.district}</text>
        </g>
      })}
      {[['Low','#22863a'],['Medium','#e36209'],['High','#cb2431']].map(([l,c],i)=>(
        <g key={l} transform={`translate(${8+i*90},362)`}>
          <circle r={5} cx={5} fill={c} opacity={.8}/><text x={13} dominantBaseline="central" style={{ fontSize:9, fill:'#555' }}>{l}</text>
        </g>
      ))}
    </svg>
  )
}

// Claim review panel
function ClaimCard({ claim, onReview }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle(action) {
    setLoading(true)
    try { await onReview(claim.claim_id, action, notes) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 8px rgba(0,0,0,0.07)', marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <span style={{ fontWeight:700, fontSize:15 }}>Claim #{claim.claim_id}</span>
          <span style={{ marginLeft:10 }}><Badge status={claim.claim_status} /></span>
        </div>
        <div style={{ fontSize:12, color:'#aaa' }}>{new Date(claim.created_at).toLocaleDateString('en-IN')}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        {[
          ['Farmer', claim.farmer_name],
          ['District', claim.district],
          ['Crop', claim.crop_type],
          ['Stage', claim.growth_stage],
          ['AI Prediction', claim.prediction_label === 'healthy' ? '✅ Healthy' : `⚠️ ${claim.disease_type||claim.damage_type}`],
          ['Severity', claim.severity_score != null ? `${claim.severity_score}/100` : '—'],
          ['Yield Loss', claim.yield_loss_pct != null ? `${claim.yield_loss_pct}%` : '—'],
          ['Area', claim.affected_area_acres ? `${claim.affected_area_acres} acres` : '—'],
        ].map(([l,v])=>(
          <div key={l} style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 12px' }}>
            <div style={{ fontSize:11, color:'#888' }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:500, marginTop:1, textTransform:'capitalize' }}>{v}</div>
          </div>
        ))}
      </div>

      {claim.estimated_loss_inr && (
        <div style={{ background:'#fff3cd', borderRadius:8, padding:'8px 14px', fontSize:13, marginBottom:12, color:'#7a6000' }}>
          💰 Claimed loss: <strong>₹{Number(claim.estimated_loss_inr).toLocaleString('en-IN')}</strong>
        </div>
      )}

      <div style={{ fontSize:13, color:'#444', marginBottom:12, background:'#f6f8fa', borderRadius:8, padding:'10px 12px' }}>
        <span style={{ fontWeight:600, fontSize:12, color:'#888' }}>FARMER'S DESCRIPTION</span><br/>
        {claim.damage_description}
      </div>

      {claim.claim_status === 'pending' && (
        <>
          <textarea
            value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Review notes (optional — visible to farmer)"
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #ddd', fontSize:13, boxSizing:'border-box', resize:'vertical', height:70, marginBottom:10, outline:'none' }}
          />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>handle('approve')} disabled={loading}
              style={{ flex:1, background:'#1a5c2a', color:'#fff', border:'none', borderRadius:9, padding:'11px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              ✔ Approve
            </button>
            <button onClick={()=>handle('reject')} disabled={loading}
              style={{ flex:1, background:'#cb2431', color:'#fff', border:'none', borderRadius:9, padding:'11px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              ✗ Reject
            </button>
          </div>
        </>
      )}
      {claim.claim_status !== 'pending' && claim.review_notes && (
        <div style={{ fontSize:12, color:'#555', background:'#f6f8fa', borderRadius:8, padding:'8px 12px' }}>
          💬 {claim.reviewer_name}: {claim.review_notes}
        </div>
      )}
    </div>
  )
}

export default function OfficialDashboard({ user }) {
  const [tab, setTab]       = useState('dashboard')
  const [stats, setStats]   = useState(null)
  const [claimsFilter, setClaimsFilter] = useState('all')
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadStats() { const s=await getStats(); setStats(s) }
  async function loadClaims(f) { const c=await getOfficialClaims(f); setClaims(c) }

  useEffect(() => { loadStats().finally(()=>setLoading(false)) }, [])
  useEffect(() => { if(tab==='claims') loadClaims(claimsFilter) }, [tab, claimsFilter])

  async function handleReview(claimId, action, review_notes) {
    await reviewClaim(claimId, action, review_notes)
    loadClaims(claimsFilter)
    loadStats()
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Loading…</div>

  const pieData = Object.entries(stats?.damage_breakdown||{}).map(([name,value])=>({ name:name.replace('_',' '),value }))
  const barData = (stats?.district_breakdown||[]).slice(0,8).map(d=>({ name:d.district, severity:d.avg_severity, loss:d.avg_yield_loss }))

  const s = { background:'#fff', borderRadius:12, padding:20, boxShadow:'0 1px 6px rgba(0,0,0,0.07)', marginBottom:20 }

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>
      {/* Sub-tab bar */}
      <div style={{ display:'flex', gap:4, background:'#fff', borderRadius:12, padding:4, marginBottom:24, boxShadow:'0 1px 6px rgba(0,0,0,0.06)', width:'fit-content' }}>
        {[['dashboard','📊 Dashboard'],['claims','🔍 Review Claims']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ border:'none', borderRadius:9, padding:'9px 20px', fontSize:14, fontWeight:tab===t?700:400, background:tab===t?'#1a5c2a':'transparent', color:tab===t?'#fff':'#555', cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {/* ══ DASHBOARD TAB ══ */}
      {tab==='dashboard' && <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:14, marginBottom:20 }}>
          <KPI label="Total Submissions" value={stats?.total_submissions} />
          <KPI label="Assessed" value={stats?.assessed} color="#1a5c2a" />
          <KPI label="Total Claims" value={stats?.total_claims} color="#0366d6" />
          <KPI label="Pending Review" value={stats?.claims_pending} color="#e36209" />
          <KPI label="Approved" value={stats?.claims_approved} color="#1a5c2a" sub="claims" />
          <KPI label="Rejected" value={stats?.claims_rejected} color="#cb2431" sub="claims" />
          <KPI label="Avg Severity" value={stats?.avg_severity!=null?`${stats.avg_severity}/100`:null} color="#cb2431" />
          <KPI label="Avg Yield Loss" value={stats?.avg_yield_loss!=null?`${stats.avg_yield_loss}%`:null} color="#b08800" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
          <div style={s}>
            <div style={{ fontWeight:600, marginBottom:14 }}>District severity map</div>
            <DistrictMap districts={stats?.district_breakdown} />
          </div>
          <div style={s}>
            <div style={{ fontWeight:600, marginBottom:14 }}>Damage type breakdown</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({name,percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                </Pie>
                <Tooltip/><Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={s}>
          <div style={{ fontWeight:600, marginBottom:14 }}>Avg severity &amp; yield loss by district</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top:0, right:10, left:-10, bottom:0 }}>
              <XAxis dataKey="name" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }}/>
              <Tooltip/><Legend/>
              <Bar dataKey="severity" name="Avg severity" fill="#e36209" radius={[4,4,0,0]}/>
              <Bar dataKey="loss" name="Yield loss %" fill="#cb2431" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>}

      {/* ══ CLAIMS REVIEW TAB (Steps 12-16) ══ */}
      {tab==='claims' && <>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <span style={{ fontWeight:600, fontSize:16 }}>Claim Review</span>
          <div style={{ display:'flex', gap:4, background:'#fff', borderRadius:10, padding:4, boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }}>
            {[['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['all','All']].map(([v,l])=>(
              <button key={v} onClick={()=>setClaimsFilter(v)} style={{ border:'none', borderRadius:7, padding:'7px 14px', fontSize:13, fontWeight:claimsFilter===v?700:400, background:claimsFilter===v?'#1a5c2a':'transparent', color:claimsFilter===v?'#fff':'#555', cursor:'pointer' }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize:13, color:'#888' }}>{claims.length} result{claims.length!==1?'s':''}</span>
        </div>

        {claims.length===0
          ? <div style={{ textAlign:'center', padding:'40px 20px', color:'#aaa' }}>No {claimsFilter} claims found.</div>
          : claims.map(c=><ClaimCard key={c.claim_id} claim={c} onReview={handleReview}/>)
        }
      </>}
    </div>
  )
}
