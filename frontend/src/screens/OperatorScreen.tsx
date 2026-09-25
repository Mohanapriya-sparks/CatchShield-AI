import { useState, useRef, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { registerBatch, getConditions } from '../api'
import { queueBatch, updateBatchStatus } from '../offlineQueue'
import { getStatusBadge, getStatusLabel } from '../utils'

const ZONES = ['Zone 01', 'Zone 02', 'Zone 03', 'Zone 04', 'Zone 05', 'Zone 06', 'Zone 07', 'Zone 08', 'Zone 09', 'Zone 10']

interface RegisterResult {
  batch_id: string
  fingerprint: string
  qr_url: string
  status: string
  disclaimer: string
}

export default function OperatorScreen() {
  const [form, setForm] = useState({
    fisher_internal_id: '',
    species: '',
    weight_kg: '',
    catch_zone: 'Zone 01',
    catch_time: new Date().toISOString().slice(0, 16),
    landing_centre: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [conditions, setConditions] = useState<any>(null)
  const [loadingConditions, setLoadingConditions] = useState(false)

  useEffect(() => {
    let active = true
    const fetchConditions = async () => {
      try {
        if (!form.catch_zone || !form.catch_time) return
        setLoadingConditions(true)
        const dateIso = new Date(form.catch_time).toISOString()
        const data = await getConditions(form.catch_zone, dateIso)
        if (active) setConditions(data)
      } catch (err) {
        if (active) console.error("Failed to load conditions", err)
      } finally {
        if (active) setLoadingConditions(false)
      }
    }
    
    // Add small debounce
    const t = setTimeout(fetchConditions, 300)
    return () => { active = false; clearTimeout(t) }
  }, [form.catch_zone, form.catch_time])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    const idempotency_key = `${form.fisher_internal_id}-${form.catch_time}-${Date.now()}`

    if (!navigator.onLine) {
      // Queue for later sync
      await queueBatch({ ...form, weight_kg: parseFloat(form.weight_kg), idempotency_key })
      setLoading(false)
      setError('⏳ OFFLINE – batch queued for sync when connectivity is restored.')
      return
    }

    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      fd.append('idempotency_key', idempotency_key)

      // Register in queue first (will be updated on success)
      await queueBatch({ ...form, weight_kg: parseFloat(form.weight_kg), idempotency_key })
      
      const res: RegisterResult = await registerBatch(fd)
      await updateBatchStatus(idempotency_key, { status: 'SYNCED', batch_id: res.batch_id })
      setResult(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await updateBatchStatus(idempotency_key, { status: 'FAILED', error: msg })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚓ Operator: Register Batch</h1>
        <p>Create a Digital Catch Passport. The fisher does not need to visit this website.</p>
      </div>

      <div className="alert-box alert-disclaimer">
        ⚠️ No alert overlap or matching hash proves seafood safety.
      </div>

      {isOffline && (
        <div className="alert-box alert-danger">
          📡 OFFLINE MODE – Batches will be queued locally (IndexedDB) with PENDING SYNC status and retried when connectivity is restored. Idempotency keys prevent duplicates.
        </div>
      )}

      {conditions && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">🌊 Conditions for {conditions.zone}</div>

          {/* Pollution alert status */}
          <div className={`alert-box ${conditions.has_alert ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>
            <strong style={{ display: 'block', marginBottom: '0.3rem' }}>
              {conditions.has_alert ? '⚠️' : '✅'} {conditions.pollution_title}
            </strong>
            <span style={{ fontSize: '0.875rem' }}>{conditions.pollution_message}</span>
          </div>

          {/* Sea forecast */}
          <div className="card-glass" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sea Forecast</strong>
              {conditions.advisory?.sample_data && (
                <span className="badge badge-review" style={{ fontSize: '0.7rem' }}>Sample — not live</span>
              )}
            </div>
            <div style={{ fontSize: '0.9rem', marginBottom: conditions.advisory?.wave_height_m ? '0.5rem' : 0 }}>
              {conditions.advisory?.advisory || 'Current sea forecast unavailable.'}
            </div>
            {conditions.advisory?.wave_height_m && conditions.advisory?.wind_speed_kmh && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  🌊 Wave: <strong style={{ color: 'var(--text-primary)' }}>{conditions.advisory.wave_height_m} m</strong>
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  💨 Wind: <strong style={{ color: 'var(--text-primary)' }}>{conditions.advisory.wind_speed_kmh} km/h</strong>
                </span>
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
              Source: {conditions.advisory?.source || 'Unknown'} · Updated: {conditions.advisory?.fetched_at ? new Date(conditions.advisory.fetched_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="section-title">Catch Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Fisher Internal ID *</label>
                <input
                  id="fisher-id"
                  required
                  value={form.fisher_internal_id}
                  onChange={e => setForm(f => ({ ...f, fisher_internal_id: e.target.value }))}
                  placeholder="e.g. FISHER-004"
                />
              </div>
              <div className="form-group">
                <label>Species *</label>
                <input
                  id="species"
                  required
                  value={form.species}
                  onChange={e => setForm(f => ({ ...f, species: e.target.value }))}
                  placeholder="e.g. Sardine"
                />
              </div>
              <div className="form-group">
                <label>Weight (kg) *</label>
                <input
                  id="weight"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={form.weight_kg}
                  onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                  placeholder="e.g. 85.0"
                />
              </div>
              <div className="form-group">
                <label>Catch Zone *</label>
                <select
                  id="catch-zone"
                  value={form.catch_zone}
                  onChange={e => setForm(f => ({ ...f, catch_zone: e.target.value }))}
                >
                  {ZONES.map(z => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Catch Date & Time *</label>
                <input
                  id="catch-time"
                  type="datetime-local"
                  required
                  value={form.catch_time}
                  onChange={e => setForm(f => ({ ...f, catch_time: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Landing Centre *</label>
                <input
                  id="landing-centre"
                  required
                  value={form.landing_centre}
                  onChange={e => setForm(f => ({ ...f, landing_centre: e.target.value }))}
                  placeholder="e.g. Kochi Fish Landing Centre"
                />
              </div>
            </div>

            {error && <div className="alert-box alert-danger" style={{ marginTop: '1rem' }}>{error}</div>}

            <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem' }}>
              <button id="submit-batch" className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" />Registering…</> : '✓ Register Batch & Generate QR'}
              </button>
            </div>
          </div>
        </form>

        {result && (
          <div className="card fade-in">
            <div className="section-title">✅ Batch Registered</div>
            
            <div className="qr-block">
              <QRCodeSVG
                value={`${window.location.origin}/lookup/${result.batch_id}`}
                size={180}
                fgColor="#0a3d60"
              />
              <div className="qr-label">
                <div className="batch-id">{result.batch_id}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Scan to view public status
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Status</span>
                <span className={getStatusBadge(result.status)}>{getStatusLabel(result.status)}</span>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>SHA-256 Fingerprint</div>
                <div className="hash-display">{result.fingerprint}</div>
              </div>
              <div className="alert-box alert-disclaimer" style={{ fontSize: '0.78rem' }}>
                {result.disclaimer}
              </div>
              <a
                href={`/lookup/${result.batch_id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ textAlign: 'center' }}
              >
                🔗 Open Public Lookup
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
