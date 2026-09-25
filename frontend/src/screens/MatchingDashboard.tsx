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
        ⚠️ {data?.disclaimer}
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

      {error && <div className="alert-box alert-danger">{error}</div>}

      {data?.results.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No confirmed alerts yet. Use the Environmental Officer screen to confirm an alert.
        </div>
      )}

      {data?.results.map(alertRes => (
        <div key={alertRes.alert_id} className="card" style={{ marginBottom: '1rem' }}>
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
            <div style={{ marginBottom: '0.75rem' }}>
              <div className="section-title" style={{ color: 'var(--amber-400)' }}>🔴 Matched Batches</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Batch ID</th>
                      <th>Species</th>
                      <th>Zone</th>
                      <th>Catch Time</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertRes.matched_batches.map(b => (
                      <tr key={b.batch_id}>
                        <td><strong style={{ color: 'var(--amber-400)' }}>{b.batch_id}</strong></td>
                        <td>{b.species}</td>
                        <td>{b.catch_zone}</td>
                        <td style={{ fontSize: '0.8rem' }}>{fmt(b.catch_time)}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--green-400)' }}>{b.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
