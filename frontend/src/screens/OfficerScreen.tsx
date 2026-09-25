import { useState, useRef } from 'react'
import { screenImage, confirmAlert, rejectAlert, getAdvisory } from '../api'

const ZONES = ['Zone 01', 'Zone 02', 'Zone 03', 'Zone 04', 'Zone 05', 'Zone 06']

interface ScreeningResult {
  signal: 'ELEVATED' | 'NORMAL' | 'INDETERMINATE'
  advisory: string
  method: string
  disclaimer: string
  details: Record<string, unknown>
}

type ApiRecord = Record<string, string | boolean | string[]>

export default function OfficerScreen() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [screening, setScreening] = useState<ScreeningResult | null>(null)
  const [screenLoading, setScreenLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [alertForm, setAlertForm] = useState({
    alert_id: '',
    zone: 'Zone 03',
    start_time: '2026-09-24T06:00',
    end_time: '2026-09-24T10:00',
    reason: '',
    confirmed_by: '',
  })
  const [confirmResult, setConfirmResult] = useState<ApiRecord | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [advisory, setAdvisory] = useState<ApiRecord | null>(null)
  const [advLoading, setAdvLoading] = useState(false)

  const handleImage = (file: File) => {
    setImageFile(file)
    setScreening(null)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleScreen = async () => {
    if (!imageFile) return
    setScreenLoading(true)
    try {
      const res = await screenImage(imageFile)
      setScreening(res)
    } catch (e: unknown) {
      window.alert('Screening failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setScreenLoading(false)
    }
  }

  const handleConfirm = async () => {
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const body = {
        ...alertForm,
        start_time: alertForm.start_time + ':00Z',
        end_time: alertForm.end_time + ':00Z',
        screening_note: screening ? `${screening.method}: ${screening.advisory}` : undefined,
      }
      const res = await confirmAlert(body)
      setConfirmResult(res as ApiRecord)
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleReject = async () => {
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const body = {
        ...alertForm,
        start_time: alertForm.start_time + ':00Z',
        end_time: alertForm.end_time + ':00Z',
      }
      const res = await rejectAlert(body)
      setConfirmResult({ ...res, rejected: 'true' } as ApiRecord)
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmLoading(false)
    }
  }

  const fetchAdvisory = async () => {
    setAdvLoading(true)
    try {
      const res = await getAdvisory(alertForm.zone)
      setAdvisory(res as ApiRecord)
    } finally {
      setAdvLoading(false)
    }
  }

  const signalColor: Record<string, string> = {
    ELEVATED: 'var(--amber-400)',
    NORMAL: 'var(--green-400)',
    INDETERMINATE: 'var(--slate-400)',
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🌊 Environmental Officer</h1>
        <p>Screen ocean images and confirm or reject pollution alerts. AI must not confirm alerts automatically.</p>
      </div>

      <div className="alert-box alert-disclaimer">
        ⚠️ AI advisory is a DEMONSTRATION HEURISTIC only — no measured accuracy. Officer must make the final decision.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Alert Form */}
        <div className="card">
          <div className="section-title">⚠️ Confirm / Reject Alert</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label>Alert ID (optional)</label>
              <input id="alert-id" value={alertForm.alert_id} onChange={e => setAlertForm(a => ({ ...a, alert_id: e.target.value }))} placeholder="e.g. PA-21 (auto-generated if blank)" />
            </div>
            <div className="form-group">
              <label>Zone *</label>
              <select id="alert-zone" value={alertForm.zone} onChange={e => setAlertForm(a => ({ ...a, zone: e.target.value }))}>
                {ZONES.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Start Time *</label>
              <input id="alert-start" type="datetime-local" value={alertForm.start_time} onChange={e => setAlertForm(a => ({ ...a, start_time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>End Time *</label>
              <input id="alert-end" type="datetime-local" value={alertForm.end_time} onChange={e => setAlertForm(a => ({ ...a, end_time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Reason *</label>
              <textarea id="alert-reason" rows={3} value={alertForm.reason} onChange={e => setAlertForm(a => ({ ...a, reason: e.target.value }))} placeholder="Describe the pollution concern…" />
            </div>
            <div className="form-group">
              <label>Officer Name *</label>
              <input id="officer-name" value={alertForm.confirmed_by} onChange={e => setAlertForm(a => ({ ...a, confirmed_by: e.target.value }))} placeholder="Your display name" />
            </div>
          </div>

          {confirmError && <div className="alert-box alert-danger" style={{ marginTop: '0.75rem' }}>{confirmError}</div>}
          {confirmResult && confirmResult['rejected'] !== 'true' && (
            <div className="alert-box alert-success" style={{ marginTop: '0.75rem' }}>
              ✓ Alert <strong>{String(confirmResult['alert_id'])}</strong> CONFIRMED. Matched batches: {(confirmResult['matched_batches'] as string[] ?? []).join(', ') || 'none'}
            </div>
          )}
          {confirmResult && confirmResult['rejected'] === 'true' && (
            <div className="alert-box alert-info" style={{ marginTop: '0.75rem' }}>
              Alert <strong>{String(confirmResult['alert_id'])}</strong> REJECTED (no matching triggered).
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button id="confirm-alert-btn" className="btn btn-danger" onClick={handleConfirm} disabled={confirmLoading || !alertForm.reason || !alertForm.confirmed_by} style={{ flex: 1 }}>
              {confirmLoading ? <span className="spinner" /> : '⚠️ CONFIRM Alert'}
            </button>
            <button id="reject-alert-btn" className="btn btn-outline" onClick={handleReject} disabled={confirmLoading || !alertForm.reason || !alertForm.confirmed_by} style={{ flex: 1 }}>
              ✗ Reject
            </button>
          </div>
          <div className="demo-notice" style={{ marginTop: '0.75rem' }}>
            🔒 Officer decision is irreversible. AI does not auto-confirm.
          </div>
        </div>

        {/* Image Screening */}
        <div className="card">
          <div className="section-title">📸 Image Screening</div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              Upload your document
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Upload the ocean sample image as a JPG or PNG by dragging it here or choosing a file.
            </p>
          </div>

          {/* Drop Zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}
            style={{
              border: '2px dashed var(--border-accent)',
              borderRadius: '12px',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background 0.2s',
              background: imagePreview ? 'rgba(0,240,255,0.04)' : 'rgba(4,25,41,0.4)',
              marginBottom: '1.25rem',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#00F0FF'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,240,255,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLDivElement).style.background = imagePreview ? 'rgba(0,240,255,0.04)' : 'rgba(4,25,41,0.4)' }}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Ocean sample" style={{ maxHeight: 180, borderRadius: 8, maxWidth: '100%' }} />
            ) : (
              <>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: 'rgba(0,240,255,0.12)', marginBottom: '1rem',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>
                  Drag &amp; drop your document here
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  JPG, JPEG or PNG · Max 10 MB
                </div>
                <button
                  type="button"
                  style={{
                    background: 'var(--teal-600, #0d9488)', color: '#fff',
                    border: 'none', borderRadius: '8px',
                    padding: '0.6rem 1.6rem', fontWeight: 700,
                    fontSize: '0.9rem', cursor: 'pointer',
                    pointerEvents: 'none',
                  }}
                >
                  Choose file
                </button>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {imagePreview && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => { setImageFile(null); setImagePreview(null); setScreening(null) }}
              >
                ← Clear &amp; Re-upload
              </button>
            )}
            <button
              id="screen-image-btn"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleScreen}
              disabled={!imageFile || screenLoading}
            >
              {screenLoading ? <><span className="spinner" />Analysing…</> : '🔬 Run Heuristic Screen'}
            </button>
          </div>

          {screening && (
            <div style={{ marginTop: '1rem' }}>
              <div className="alert-heuristic">
                🔬 {screening.method}
                <br />{screening.disclaimer}
              </div>
              <div className="card-glass" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <strong>Signal</strong>
                  <span style={{ fontWeight: 700, color: signalColor[screening.signal] ?? 'var(--slate-400)' }}>
                    {screening.signal}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {screening.advisory}
                </p>
                <details style={{ marginTop: '0.6rem' }}>
                  <summary style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Image statistics (debug)
                  </summary>
                  <pre style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', overflowX: 'auto' }}>
                    {JSON.stringify(screening.details, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trip Advisory */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="section-title">⛵ Marine Trip Advisory</div>
        <div className="alert-box alert-info" style={{ marginBottom: '1rem' }}>
          Source: Open-Meteo Marine API (open-meteo.com). 'Safe to sail' is NEVER displayed by this system.
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Zone:</span>
          <strong>{alertForm.zone}</strong>
          <button id="fetch-advisory-btn" className="btn btn-outline" onClick={fetchAdvisory} disabled={advLoading}>
            {advLoading ? <span className="spinner" /> : '🌤 Fetch Conditions'}
          </button>
        </div>
        {advisory && (
          <div className="card-glass" style={{ marginTop: '1rem' }}>
            {advisory['sample_data'] === 'true' && (
              <div className="badge badge-review" style={{ marginBottom: '0.75rem' }}>SAMPLE DATA</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>WAVE HEIGHT</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{String(advisory['wave_height_m'] ?? '–')} m</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>WIND SPEED</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{String(advisory['wind_speed_kmh'] ?? '–')} km/h</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DATA TIME</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{String(advisory['data_time'] ?? '–')}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{String(advisory['advisory'] ?? '')}</p>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Source: {String(advisory['source'] ?? '')} | Fetched: {String(advisory['fetched_at'] ?? '')}
            </div>
            <div className="demo-notice" style={{ marginTop: '0.75rem' }}>
              {String(advisory['note'] ?? '')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
