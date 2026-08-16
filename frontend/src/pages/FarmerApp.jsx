import { useState, useEffect, useRef } from 'react'
import { submitCrop, getClaims, getSubmissions, createClaim } from '../api'

const STAGES = [
  { id:'sowing',     label:'Sowing',     emoji:'🌱' },
  { id:'vegetative', label:'Vegetative', emoji:'🌿' },
  { id:'flowering',  label:'Flowering',  emoji:'🌸' },
  { id:'maturity',   label:'Maturity',   emoji:'🌾' },
]
const CROPS = ['Wheat','Rice','Cotton','Maize','Soybean','Groundnut','Pulses','Sugarcane']
const DISTRICTS = [
  ['Vidarbha','Maharashtra',20.50,78.10],['Nashik','Maharashtra',20.00,73.80],
  ['Ludhiana','Punjab',30.90,75.80],['Amritsar','Punjab',31.60,74.90],
  ['Kurnool','Andhra Pradesh',15.80,78.00],['Guntur','Andhra Pradesh',16.30,80.40],
  ['Barmer','Rajasthan',25.70,71.40],['Warangal','Telangana',18.00,79.60],
]
const DAMAGE_COLOR = { none:'#22863a',lodging:'#e36209',flood_inundation:'#0366d6',water_stress:'#b08800',pest_attack:'#cb2431',fungal_disease:'#6f42c1' }
const STATUS_STYLE = { pending:{bg:'#fff8e1',color:'#b08800'}, approved:{bg:'#e6f4ea',color:'#1a5c2a'}, rejected:{bg:'#ffeef0',color:'#cb2431'} }

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg:'#f0f0f0', color:'#888' }
  return <span style={{ background:s.bg, color:s.color, borderRadius:6, padding:'2px 9px', fontSize:12, fontWeight:600, textTransform:'capitalize' }}>{status}</span>
}

// ── Shared card style ──
const card = { background:'#fff', borderRadius:14, padding:24, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', marginBottom:16 }
const inp  = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #ddd', fontSize:15, boxSizing:'border-box', outline:'none' }
const btn  = (bg='#1a5c2a') => ({ background:bg, color:'#fff', border:'none', borderRadius:10, padding:'12px 0', width:'100%', fontSize:15, fontWeight:600, cursor:'pointer' })

export default function FarmerApp({ user }) {
  const [tab, setTab] = useState('upload')        // upload | claims
  const [step, setStep] = useState(1)             // 1=details 2=capture 3=result
  const [form, setForm] = useState({ district_idx:0, growth_stage:'vegetative', crop_type:'Wheat', notes:'' })
  const [imageB64, setImageB64] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [claims, setClaims] = useState([])
  const [claimStep, setClaimStep] = useState(null)   // null | {submission}
  const [claimForm, setClaimForm] = useState({ damage_description:'', claimed_damage_type:'', affected_area_acres:'', estimated_loss_inr:'' })
  const [claimResult, setClaimResult] = useState(null)
  const fileRef = useRef()

  const district = DISTRICTS[form.district_idx]

  useEffect(() => {
    if (tab === 'claims') {
      getSubmissions({ limit:20 }).then(setSubmissions)
      getClaims().then(setClaims)
    }
  }, [tab])

  function handleImage(e) {
    const file = e.target.files[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = ev => { const full=ev.target.result; setImagePreview(full); setImageB64(full.split(',')[1]) }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    setLoading(true); setError(null)
    try {
      const payload = {
        district:district[0], state:district[1],
        latitude:district[2]+((Math.random()-0.5)*0.4),
        longitude:district[3]+((Math.random()-0.5)*0.4),
        growth_stage:form.growth_stage, crop_type:form.crop_type,
        notes:form.notes||null,
        image_base64:imageB64, image_filename:'crop_photo.jpg',
      }
      const res = await submitCrop(payload)
      setResult(res); setStep(3)
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  async function handleClaimSubmit() {
    setLoading(true); setError(null)
    try {
      const res = await createClaim({
        submission_id: claimStep.id,
        damage_description: claimForm.damage_description,
        claimed_damage_type: claimForm.claimed_damage_type || claimStep.damage_type,
        affected_area_acres: parseFloat(claimForm.affected_area_acres) || null,
        estimated_loss_inr:  parseFloat(claimForm.estimated_loss_inr)  || null,
      })
      setClaimResult(res); setClaimStep(null); setClaims(c => [res,...c])
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  function reset() { setStep(1); setResult(null); setImageB64(null); setImagePreview(null); setError(null) }

  // ── Claim filing modal ──
  if (claimStep) return (
    <div style={{ maxWidth:460, margin:'0 auto', padding:'24px 16px' }}>
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:17, marginBottom:4 }}>File Insurance Claim</div>
        <div style={{ fontSize:13, color:'#888', marginBottom:18 }}>Submission #{claimStep.id} · {claimStep.crop_type} · {claimStep.district}</div>
        {claimResult
          ? <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ fontSize:40 }}>✅</div>
              <div style={{ fontWeight:700, fontSize:17, color:'#1a5c2a', marginTop:8 }}>Claim #{claimResult.id} Filed</div>
              <div style={{ fontSize:13, color:'#888', marginTop:4 }}>Status: <Badge status={claimResult.status} /></div>
              <button style={{ ...btn(), marginTop:20, width:'auto', padding:'10px 28px' }} onClick={() => { setClaimResult(null); setTab('claims') }}>View My Claims →</button>
            </div>
          : <>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>Damage description *</div>
                <textarea style={{ ...inp, height:90, resize:'vertical' }} placeholder="Describe the damage in detail…"
                  value={claimForm.damage_description} onChange={e => setClaimForm(f=>({...f,damage_description:e.target.value}))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>Area affected (acres)</div>
                  <input style={inp} type="number" placeholder="e.g. 2.5" value={claimForm.affected_area_acres}
                    onChange={e => setClaimForm(f=>({...f,affected_area_acres:e.target.value}))} />
                </div>
                <div>
                  <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>Est. loss (₹)</div>
                  <input style={inp} type="number" placeholder="e.g. 25000" value={claimForm.estimated_loss_inr}
                    onChange={e => setClaimForm(f=>({...f,estimated_loss_inr:e.target.value}))} />
                </div>
              </div>
              {error && <div style={{ background:'#ffeef0', color:'#cb2431', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:12 }}>{error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button style={{ ...btn('#888'), flex:'0 0 80px' }} onClick={() => { setClaimStep(null); setError(null) }}>Cancel</button>
                <button style={{ ...btn(), flex:1 }} disabled={loading || !claimForm.damage_description} onClick={handleClaimSubmit}>
                  {loading ? 'Submitting…' : 'Submit Claim →'}
                </button>
              </div>
            </>
        }
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:460, margin:'0 auto', padding:'20px 16px' }}>
      {/* Tab bar */}
      <div style={{ display:'flex', background:'#fff', borderRadius:12, padding:4, marginBottom:20, boxShadow:'0 1px 6px rgba(0,0,0,0.07)' }}>
        {[['upload','📸 Upload Crop'],['claims','📋 My Claims']].map(([t,label])=>(
          <button key={t} onClick={() => setTab(t)} style={{ flex:1, border:'none', borderRadius:9, padding:'10px 0', fontSize:14, fontWeight: tab===t?700:400, background: tab===t?'#1a5c2a':'transparent', color: tab===t?'#fff':'#555', cursor:'pointer' }}>{label}</button>
        ))}
      </div>

      {/* ══ UPLOAD TAB ══ */}
      {tab === 'upload' && <>
        {/* Progress */}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {['Details','Photo','Result'].map((s,i)=>(
            <div key={i} style={{ flex:1, textAlign:'center' }}>
              <div style={{ height:4, borderRadius:4, marginBottom:5, background: step>i+1?'#1a5c2a':step===i+1?'#4caf50':'#ddd' }} />
              <span style={{ fontSize:11, color:step===i+1?'#1a5c2a':'#aaa', fontWeight:step===i+1?600:400 }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 1 — Details */}
        {step===1 && <>
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>Step 1 — Crop Details</div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>District</div>
              <select style={inp} value={form.district_idx} onChange={e=>setForm(f=>({...f,district_idx:+e.target.value}))}>
                {DISTRICTS.map(([d,s],i)=><option key={i} value={i}>{d}, {s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>Crop Type</div>
              <select style={inp} value={form.crop_type} onChange={e=>setForm(f=>({...f,crop_type:e.target.value}))}>
                {CROPS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:13, color:'#555', marginBottom:5 }}>Notes (optional)</div>
              <input style={inp} placeholder="e.g. Heavy rain last week" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Growth Stage</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {STAGES.map(s=>(
                <div key={s.id} onClick={()=>setForm(f=>({...f,growth_stage:s.id}))} style={{ border:`2px solid ${form.growth_stage===s.id?'#1a5c2a':'#e0e0e0'}`, borderRadius:10, padding:'12px 8px', textAlign:'center', cursor:'pointer', background:form.growth_stage===s.id?'#f0f9f0':'#fafafa' }}>
                  <div style={{ fontSize:24 }}>{s.emoji}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginTop:4, color:form.growth_stage===s.id?'#1a5c2a':'#333' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <button style={btn()} onClick={()=>setStep(2)}>Next — Take Photo →</button>
        </>}

        {/* Step 2 — Capture */}
        {step===2 && <>
          <div style={card}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Step 2 — Capture Photo</div>
            <div style={{ fontSize:13, color:'#666', marginBottom:16 }}>Capture a clear image in daylight. Ensure crop fills the frame.</div>
            <div onClick={()=>fileRef.current.click()} style={{ background:imagePreview?'transparent':'#111', borderRadius:12, height:220, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', border:'2px dashed #444', position:'relative' }}>
              {imagePreview
                ? <img src={imagePreview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{ textAlign:'center', color:'#aaa' }}>
                    <div style={{ position:'absolute', inset:18, border:'2px solid rgba(80,220,80,0.6)', borderRadius:8, pointerEvents:'none' }} />
                    <div style={{ fontSize:38 }}>📷</div>
                    <div style={{ fontSize:14, marginTop:6 }}>Tap to select image</div>
                    <div style={{ fontSize:12, opacity:.7, marginTop:2 }}>Gallery or camera</div>
                  </div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImage} />
            <div style={{ marginTop:12, padding:'9px 13px', background:'#fff8e1', borderRadius:8, fontSize:12, color:'#7a6000' }}>
              📍 GPS auto-captured · {district[0]}, {district[1]}
            </div>
          </div>
          {error && <div style={{ background:'#ffeef0', color:'#cb2431', borderRadius:8, padding:12, fontSize:13, marginBottom:12 }}>{error}</div>}
          <div style={{ display:'flex', gap:10 }}>
            <button style={{ ...btn('#888'), flex:'0 0 70px' }} onClick={()=>setStep(1)}>← Back</button>
            <button style={{ ...btn(), flex:1 }} disabled={loading} onClick={handleSubmit}>
              {loading ? '🧠 Analysing…' : imageB64 ? '🚀 Submit for AI Analysis' : 'Submit (no photo / demo)'}
            </button>
          </div>
        </>}

        {/* Step 3 — Result */}
        {step===3 && result && <>
          <div style={{ ...card, borderLeft:`5px solid ${result.prediction_label==='healthy'?'#1a5c2a':'#cb2431'}` }}>
            <div style={{ fontWeight:700, fontSize:18, color:result.prediction_label==='healthy'?'#1a5c2a':'#cb2431' }}>
              {result.prediction_label==='healthy' ? '✅ Healthy Crop' : `⚠️ Disease Detected: ${result.disease_type || result.damage_type}`}
            </div>
            <div style={{ fontSize:12, color:'#888', marginTop:2, marginBottom:16 }}>Submission #{result.id}</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                ['Crop', result.crop_type, '#333'],
                ['Stage', result.growth_stage, '#555'],
                ['Damage', (result.damage_type||'none').replace('_',' '), DAMAGE_COLOR[result.damage_type]||'#555'],
                ['AI Confidence', result.damage_confidence ? `${(result.damage_confidence*100).toFixed(0)}%` : '—', '#555'],
              ].map(([l,v,c])=>(
                <div key={l} style={{ background:'#f8f8f8', borderRadius:10, padding:'11px 13px' }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>{l}</div>
                  <div style={{ fontWeight:700, fontSize:14, color:c, textTransform:'capitalize' }}>{v}</div>
                </div>
              ))}
            </div>

            {result.severity_score != null && <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                <span style={{ color:'#555' }}>Severity Score</span>
                <span style={{ fontWeight:700 }}>{result.severity_score}/100</span>
              </div>
              <div style={{ height:10, background:'#eee', borderRadius:5, overflow:'hidden', marginBottom:14 }}>
                <div style={{ height:'100%', borderRadius:5, width:`${result.severity_score}%`, background: result.severity_score>60?'#cb2431':result.severity_score>30?'#e36209':'#1a5c2a', transition:'width .8s ease' }} />
              </div>
              <div style={{ background:'#fff3cd', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:12, color:'#7a6000', marginBottom:2 }}>Estimated Yield Loss</div>
                <div style={{ fontSize:30, fontWeight:700, color:'#e36209' }}>{result.yield_loss_pct}%</div>
              </div>
            </>}
          </div>

          {result.prediction_label === 'diseased' && (
            <button style={btn('#0366d6')} onClick={() => { setClaimStep(result); reset() }}>
              📝 File Insurance Claim →
            </button>
          )}
          <button style={{ ...btn('#555'), marginTop:8 }} onClick={reset}>Submit Another →</button>
        </>}
      </>}

      {/* ══ CLAIMS TAB (Steps 10, 17) ══ */}
      {tab === 'claims' && <>
        <div style={card}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>My Insurance Claims</div>
          {claims.length === 0
            ? <div style={{ color:'#aaa', textAlign:'center', padding:'20px 0' }}>No claims filed yet.<br/><span style={{ fontSize:13 }}>Upload a crop photo and file a claim if damage is detected.</span></div>
            : claims.map(c => (
              <div key={c.id} style={{ borderBottom:'1px solid #f0f0f0', paddingBottom:14, marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>Claim #{c.id}</span>
                  <Badge status={c.status} />
                </div>
                <div style={{ fontSize:13, color:'#555', marginBottom:3 }}>{c.damage_description.slice(0,80)}…</div>
                <div style={{ fontSize:12, color:'#888', display:'flex', gap:16 }}>
                  {c.affected_area_acres && <span>📐 {c.affected_area_acres} acres</span>}
                  {c.estimated_loss_inr && <span>₹ {c.estimated_loss_inr.toLocaleString()}</span>}
                  <span>{new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                {c.review_notes && (
                  <div style={{ marginTop:8, background:'#f8f8f8', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#555' }}>
                    💬 Official note: {c.review_notes}
                  </div>
                )}
              </div>
            ))
          }
        </div>

        <div style={{ ...card, marginTop:0 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>My Submissions — file a claim</div>
          {submissions.filter(s=>s.prediction_label==='diseased').length === 0
            ? <div style={{ color:'#aaa', fontSize:13 }}>No diseased submissions found.</div>
            : submissions.filter(s=>s.prediction_label==='diseased').map(s=>(
              <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f5f5f5' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>#{s.id} — {s.crop_type} · {s.district}</div>
                  <div style={{ fontSize:12, color: DAMAGE_COLOR[s.damage_type]||'#888' }}>{(s.damage_type||'').replace('_',' ')} · Severity {s.severity_score}</div>
                </div>
                <button onClick={()=>setClaimStep(s)} style={{ background:'#1a5c2a', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Claim →</button>
              </div>
            ))
          }
        </div>
      </>}
    </div>
  )
}
