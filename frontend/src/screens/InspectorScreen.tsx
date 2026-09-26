import { useState, useEffect } from 'react'
import { listBatches, listAlerts, listInspections, recordInspection, getFingerprint } from '../api'
import { getStatusBadge, getStatusLabel, formatDateTime } from '../utils'

interface Batch {
  id: string
  species: string
  weight_kg: number
  catch_zone: string
  catch_time: string
  landing_centre: string
  status: string
  registered_at: string
  fingerprint: string
}

interface Alert {
  id: string
  zone: string
  start_time: string
  end_time: string
  reason: string
  confirmed_by: string
  status: string
}

interface FingerprintResult {
  batch_id: string
  stored_fingerprint: string
  computed_fingerprint: string
  match: boolean
  integrity_status: string
}

export default function InspectorScreen() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    batch_id: '',
    alert_id: '',
    inspector_name: '',
    decision: 'CLEARED_DEMO',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<Record<string, unknown> | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fpResult, setFpResult] = useState<FingerprintResult | null>(null)
  const [fpLoading, setFpLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [b, a] = await Promise.all([listBatches(), listAlerts()])
      setBatches(b)
      setAlerts(a.filter((al: Alert) => al.status === 'CONFIRMED'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const reviewBatches = batches.filter(b =>
    b.status === 'UNDER_ENVIRONMENTAL_REVIEW' || b.status === 'INSPECTION_PENDING'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await recordInspection(form)
      setSubmitResult(res as Record<string, unknown>)
      await load()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const checkFingerprint = async (batchId: string) => {
    setFpLoading(true)
    try {
      const res = await getFingerprint(batchId)
      setFpResult(res)
    } finally {
      setFpLoading(false)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })

  if (loading) return <div className="loading-center"><span className="spinner" /> Loading…</div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🔬 Inspector Screen</h1>
        <p>Record inspection decisions on matched batches. Explicit action required — batches never clear themselves.</p>
      </div>

      <div className="alert-box alert-disclaimer">
        ⚠️ All decisions below are DEMO DECISIONS, not official government clearance. No alert overlap or matching hash proves seafood safety.
      </div>

      <div className="demo-notice" style={{ marginBottom: '1.5rem' }}>
        🎭 Decisions are labelled CLEARED_DEMO or FLAGGED_DEMO. They carry no legal authority.
      </div>

      {error && <div className="alert-box alert-danger">{error}</div>}

      {/* Batches Under Review */}
      <div className="section-title">Batches Requiring Review ({reviewBatches.length})</div>
      {reviewBatches.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          No batches currently under environmental review.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Species</th>
                <th>Zone</th>
                <th>Catch Time</th>
                <th>Status</th>
                <th>Integrity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reviewBatches.map(b => (
                <tr key={b.id}>
                  <td><strong style={{ color: 'var(--amber-400)' }}>{b.id}</strong></td>
                  <td>{b.species}</td>
                  <td>{b.catch_zone}</td>
                  <td style={{ fontSize: '0.8rem' }}>{fmt(b.catch_time)}</td>
                  <td><span className={getStatusBadge(b.status)}>{getStatusLabel(b.status)}</span></td>
                  <td>
                    <button className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => checkFingerprint(b.id)} disabled={fpLoading}>
                      🔐 Check
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                      onClick={() => setForm(f => ({ ...f, batch_id: b.id, alert_id: alerts[0]?.id || '' }))}>
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fingerprint Result */}
      {fpResult && (
        <div className={`alert-box ${fpResult.match ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1.5rem' }}>
          <strong>Fingerprint Check – {fpResult.batch_id}</strong><br />
          Status: <strong>{fpResult.integrity_status}</strong><br />
          <span style={{ fontSize: '0.78rem' }}>
            Stored: <code>{fpResult.stored_fingerprint.slice(0, 20)}…</code>
            {' | '}
            Computed: <code>{fpResult.computed_fingerprint.slice(0, 20)}…</code>
          </span>
          {!fpResult.match && (
            <div style={{ marginTop: '0.5rem', fontWeight: 700 }}>
              ⚠️ MISMATCH DETECTED – Registration data may have been altered after creation.
            </div>
          )}
        </div>
      )}

      {/* Decision Form */}
      <div className="card">
        <div className="section-title">Record Inspection Decision</div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Batch ID *</label>
              <select id="inspect-batch" required value={form.batch_id} onChange={e => setForm(f => ({ ...f, batch_id: e.target.value }))}>
                <option value="">Select batch…</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.id} – {b.species} ({b.status})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Alert ID *</label>
              <select id="inspect-alert" required value={form.alert_id} onChange={e => setForm(f => ({ ...f, alert_id: e.target.value }))}>
                <option value="">Select alert…</option>
                {alerts.map(a => (
                  <option key={a.id} value={a.id}>{a.id} – {a.zone}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Inspector Name *</label>
              <input id="inspector-name" required value={form.inspector_name} onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="form-group">
              <label>Decision *</label>
              <select id="inspect-decision" value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value }))}>
                <option value="CLEARED_DEMO">CLEARED_DEMO – No concern found (demo)</option>
                <option value="FLAGGED_DEMO">FLAGGED_DEMO – Concern confirmed (demo)</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Reason / Notes *</label>
              <textarea id="inspect-reason" rows={3} required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Describe findings…" />
            </div>
          </div>

          {submitError && <div className="alert-box alert-danger" style={{ marginTop: '1rem' }}>{submitError}</div>}
          {submitResult && (
            <div className="alert-box alert-success" style={{ marginTop: '1rem' }}>
              ✓ Decision recorded: <strong>{String((submitResult as Record<string, unknown>)['decision'] ?? '')}</strong>
              <br /><span style={{ fontSize: '0.8rem' }}>{String((submitResult as Record<string, unknown>)['note'] ?? '')}</span>
              <a
                href={`/lookup/${form.batch_id}`}
                className="btn btn-primary"
                style={{ display: 'block', textAlign: 'center', background: '#c4b5fd', color: '#000', marginTop: '1rem', textDecoration: 'none' }}
              >
                4. Next Step: View Final Traceability Passport →
              </a>
            </div>
          )}


          <div style={{ marginTop: '1rem' }}>
            <button id="submit-decision" className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? <><span className="spinner" />Recording…</> : '✓ Record Decision'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            💬 SMS Preview (label only – no actual gateway integrated):
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '0.6rem', fontSize: '0.8rem', color: 'var(--slate-300)', marginTop: '0.4rem', fontStyle: 'italic' }}>
            [CatchShield DEMO SMS Preview]: Batch {form.batch_id || 'CF-???'} decision: {form.decision}. {form.reason.slice(0, 60)}{form.reason.length > 60 ? '…' : ''}
            <br /><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>⚠️ Not sent – no SMS gateway integrated in this MVP.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
