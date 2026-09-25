import { useState, useEffect } from 'react'
import { getMatchingDashboard } from '../api'

interface BatchEntry {
  batch_id: string
  species: string
  catch_zone: string
  catch_time: string
  matched: boolean
  reason: string
}

interface AlertResult {
  alert_id: string
  alert_zone: string
  alert_window: { start: string; end: string }
  alert_reason: string
  matched_batches: BatchEntry[]
  non_matched_batches: BatchEntry[]
}

interface DashboardData {
  disclaimer: string
  confirmed_alerts_evaluated: number
  total_batches: number
  results: AlertResult[]
}

export default function MatchingDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMatchingDashboard()
      setData(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })

  if (loading) return <div className="loading-center"><span className="spinner" /> Loading dashboard…</div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🔍 Matching Dashboard</h1>
        <p>Batches overlapping confirmed alerts by zone AND time. Reasons shown for both matches and non-matches.</p>
      </div>

      <div className="alert-box alert-disclaimer">
        ℹ️ {data?.disclaimer}
      </div>

      <div className="card-glass" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', fontWeight: 600 }}>
          CatchShield Decision Pipeline
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>Environmental Data</div>
          <div style={{ color: 'var(--teal-500)' }}>→</div>
          <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c4b5fd', borderRadius: '4px' }}>AI Risk Assessment</div>
          <div style={{ color: 'var(--teal-500)' }}>→</div>
          <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--amber-400)', borderRadius: '4px' }}>Zone+Time Correlation</div>
          <div style={{ color: 'var(--teal-500)' }}>→</div>
          <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(45, 159, 212, 0.1)', border: '1px solid rgba(45, 159, 212, 0.3)', color: 'var(--ocean-300)', borderRadius: '4px' }}>Inspector Review</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal-400)' }}>{data?.confirmed_alerts_evaluated ?? 0}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Confirmed Alerts</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ocean-300)' }}>{data?.total_batches ?? 0}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Batches</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--amber-400)' }}>
            {data?.results.reduce((s, r) => s + r.matched_batches.length, 0) ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Matched Batches</div>
        </div>
        <button id="refresh-dashboard" className="btn btn-outline" onClick={load} style={{ alignSelf: 'center' }}>
          🔄 Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--amber-400)', background: 'linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--amber-400)', fontSize: '1.1rem' }}>Demo Scenario</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Alert A17 — Zone 03 • 2 batches currently require review.
            </p>
          </div>
          <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => {
            const el = document.querySelector('[id^="alert-"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            View Scenario →
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-danger">{error}</div>}

      {data?.results.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No confirmed alerts yet. Use the Environmental Officer screen to confirm an alert.
        </div>
      )}

      {data?.results.map(alertRes => (
        <div key={alertRes.alert_id} id={`alert-${alertRes.alert_id}`} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--amber-400)' }}>
                ⚠️ Alert {alertRes.alert_id}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Zone: <strong>{alertRes.alert_zone}</strong> | Window: {fmt(alertRes.alert_window.start)} → {fmt(alertRes.alert_window.end)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{alertRes.alert_reason}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="badge badge-review">{alertRes.matched_batches.length} matched</span>
              <span className="badge badge-clear">{alertRes.non_matched_batches.length} no match</span>
            </div>
          </div>

          {/* Matched batches */}
          {alertRes.matched_batches.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="section-title" style={{ color: 'var(--amber-400)', marginBottom: '0.5rem' }}>🔴 Matched Batches</div>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                {alertRes.matched_batches.map(b => (
                  <div key={b.batch_id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ color: 'var(--amber-400)', fontSize: '1.1rem' }}>{b.batch_id}</strong>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(245,158,11,0.2)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--amber-300)' }}>INSPECTION REQUIRED</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                      {b.species} • {b.catch_zone} • {fmt(b.catch_time)}
                    </div>
                    
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ocean-300)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Why was this batch flagged?</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-300)' }}>✓ Spatial overlap (Zone matches alert)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-300)' }}>✓ Temporal overlap (Time within window)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--amber-300)', marginTop: '0.2rem' }}>⚠ {b.reason}</div>
                    </div>

                    <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c4b5fd', textTransform: 'uppercase' }}>AI Risk Context</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--amber-400)' }}>72 / 100</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ELEVATED RISK LEVEL</div>
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-300)', display: 'grid', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Alert severity</span> <span>█████████░</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Temporal proximity</span> <span>██████████</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Spatial proximity</span> <span>███████░░░</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Env conditions</span> <span>████████░░</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-matched toggle */}
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
            onClick={() => setExpanded(ex => ({ ...ex, [alertRes.alert_id]: !ex[alertRes.alert_id] }))}
          >
            {expanded[alertRes.alert_id] ? '▲ Hide' : '▼ Show'} non-matched ({alertRes.non_matched_batches.length})
          </button>
          {expanded[alertRes.alert_id] && alertRes.non_matched_batches.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Species</th>
                    <th>Zone</th>
                    <th>Catch Time</th>
                    <th>Reason (no match)</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRes.non_matched_batches.map(b => (
                    <tr key={b.batch_id}>
                      <td>{b.batch_id}</td>
                      <td>{b.species}</td>
                      <td>{b.catch_zone}</td>
                      <td style={{ fontSize: '0.8rem' }}>{fmt(b.catch_time)}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
