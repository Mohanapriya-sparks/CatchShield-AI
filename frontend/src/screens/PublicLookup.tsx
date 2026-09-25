import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useParams, useNavigate } from 'react-router-dom'
import { publicLookup } from '../api'
import { getStatusBadge, getStatusLabel } from '../utils'

interface CustodyEvent {
  event_type: string
  actor_role: string
  event_time: string
  note: string | null
}

interface PublicBatch {
  batch_id: string
  species: string
  catch_zone: string
  catch_date: string
  landing_centre: string
  registered_at: string
  status: string
  status_display: string
  fingerprint: string
  chain_tx: string | null
  custody_timeline: CustodyEvent[]
  disclaimer: string
}

// Step: 'landing' | 'scanning' | 'upload' | 'result'
export default function PublicLookup() {
  const { batchId: urlBatchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<'landing' | 'scanning' | 'upload' | 'result'>('landing')
  const [input, setInput] = useState(urlBatchId || '')
  const [data, setData] = useState<PublicBatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadScanning, setUploadScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadFile = (file: File) => {
    setUploadFile(file)
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = () => setUploadPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const scanUploadedFile = async () => {
    if (!uploadFile) return
    setUploadScanning(true)
    setUploadError(null)
    try {
      const scanner = new Html5Qrcode('__offscreen_scanner__')
      const decoded = await scanner.scanFile(uploadFile, false)
      let id = decoded
      if (id.includes('/lookup/')) id = id.split('/lookup/')[1]
      setInput(id.trim().toUpperCase())
      await lookup(id.trim().toUpperCase())
    } catch {
      setUploadError('No QR code found in this image. Please upload a clear photo of the fish batch QR code.')
    } finally {
      setUploadScanning(false)
    }
  }

  // Auto-lookup if a batchId is in the URL
  useEffect(() => {
    if (urlBatchId) {
      lookup(urlBatchId)
    }
  }, [urlBatchId])

  // Start/stop camera when step changes
  useEffect(() => {
    if (step === 'scanning') {
      const html5QrCode = new Html5Qrcode('qr-reader')
      scannerRef.current = html5QrCode
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10 },
        (decodedText) => {
          if (scannerRef.current?.isScanning) {
            scannerRef.current.stop().catch(console.error)
            scannerRef.current = null
          }
          let id = decodedText
          if (id.includes('/lookup/')) id = id.split('/lookup/')[1]
          setInput(id)
          lookup(id)
        },
        () => { /* ignore scan errors */ }
      ).catch(err => console.error('Failed to start scanner', err))
    }
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
        scannerRef.current = null
      }
    }
  }, [step])

  const lookup = async (id: string) => {
    if (!id.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await publicLookup(id.trim().toUpperCase())
      setData(res)
      setStep('result')
      navigate(`/lookup/${id.trim().toUpperCase()}`, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Batch not found')
      setStep('landing')
    } finally {
      setLoading(false)
    }
  }

  const stopScanner = () => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(console.error)
      scannerRef.current = null
    }
    setStep('landing')
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

  const statusIcon = (status: string) => {
    switch (status) {
      case 'NO_CONFIRMED_ALERT_OVERLAP_FOUND': return '✅'
      case 'UNDER_ENVIRONMENTAL_REVIEW': return '⚠️'
      case 'INSPECTION_PENDING': return '🔍'
      case 'CLEARED_DEMO': return '✓'
      case 'FLAGGED_DEMO': return '🚫'
      case 'TRACEABILITY_INCOMPLETE': return '❓'
      default: return '•'
    }
  }

  /* ─── STEP 1: Landing ─── */
  if (step === 'landing') {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '2rem' }}>
        {/* Card */}
        <div style={{
          background: 'rgba(10,25,47,0.85)',
          border: '1px solid var(--border-accent)',
          borderRadius: '20px',
          padding: '3rem 2.5rem',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* QR Icon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '100px', height: '100px', borderRadius: '20px',
            border: '2px solid var(--border-accent)',
            marginBottom: '1.5rem',
            background: 'rgba(0,240,255,0.06)',
          }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="5" y="5" width="3" height="3" fill="#00F0FF" stroke="none"/>
              <rect x="16" y="5" width="3" height="3" fill="#00F0FF" stroke="none"/>
              <rect x="5" y="16" width="3" height="3" fill="#00F0FF" stroke="none"/>
              <path d="M14 14h2v2h-2zM18 14h3M18 18h3M14 18v3M14 21h2" strokeWidth="1.5"/>
            </svg>
          </div>

          {/* Title row with three-dots */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.6rem' }}>
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0 }}>Scan QR</h1>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1, padding: '0 4px', letterSpacing: '2px' }}
              title="More options"
            >···</button>
            {showMenu && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: 'rgba(10,25,47,0.98)', border: '1px solid var(--border-accent)', borderRadius: '10px', padding: '0.4rem 0', minWidth: '180px', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <button
                  onClick={() => { setShowMenu(false); setStep('upload') }}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  📄 Upload Document
                </button>
              </div>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            Click the button below to scan a QR code using your camera.
          </p>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 700, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
            onClick={() => setStep('scanning')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h7v7"/>
            </svg>
            Scan QR
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            OR
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Manual entry */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="batch-lookup-input"
              style={{
                flex: 1, background: 'rgba(4,25,41,0.8)',
                border: '1px solid var(--border-accent)', borderRadius: '8px',
                padding: '0.65rem 0.9rem', color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)', fontSize: '1rem',
                fontWeight: 700, letterSpacing: '0.06em', outline: 'none',
              }}
              placeholder="e.g. CF-104"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup(input)}
            />
            <button
              id="lookup-btn"
              className="btn btn-outline"
              style={{ padding: '0.65rem 1rem', borderRadius: '8px' }}
              onClick={() => lookup(input)}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : '→'}
            </button>
          </div>

          {error && <div className="alert-box alert-danger" style={{ marginTop: '1rem', textAlign: 'left' }}>{error}</div>}
        </div>
      </div>
    )
  }

  /* ─── STEP 2: Camera Scanning ─── */
  if (step === 'scanning') {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Scan QR Code</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Position the QR code within the frame.
        </p>

        <div style={{
          position: 'relative', width: '100%', maxWidth: '560px', margin: '0 auto',
          background: '#0a192f', borderRadius: '20px', overflow: 'hidden', minHeight: '360px',
        }}>
          <div id="qr-reader" style={{ width: '100%' }} />

          {/* Corner brackets overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ position: 'absolute', top: '18%', left: '12%', width: '50px', height: '50px', borderTop: '4px solid #00F0FF', borderLeft: '4px solid #00F0FF', borderRadius: '4px 0 0 0' }} />
            <div style={{ position: 'absolute', top: '18%', right: '12%', width: '50px', height: '50px', borderTop: '4px solid #00F0FF', borderRight: '4px solid #00F0FF', borderRadius: '0 4px 0 0' }} />
            <div style={{ position: 'absolute', bottom: '18%', left: '12%', width: '50px', height: '50px', borderBottom: '4px solid #00F0FF', borderLeft: '4px solid #00F0FF', borderRadius: '0 0 0 4px' }} />
            <div style={{ position: 'absolute', bottom: '18%', right: '12%', width: '50px', height: '50px', borderBottom: '4px solid #00F0FF', borderRight: '4px solid #00F0FF', borderRadius: '0 0 4px 0' }} />
            {/* Scan line */}
            <div style={{ position: 'absolute', left: '12%', right: '12%', height: '2px', background: '#00F0FF', boxShadow: '0 0 10px #00F0FF, 0 0 20px #00F0FF', animation: 'qrscan 2s ease-in-out infinite' }} />
          </div>
        </div>

        {/* Status pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,240,255,0.1)', color: '#00F0FF', padding: '0.5rem 1.2rem', borderRadius: '999px', marginTop: '1.5rem', fontWeight: 600 }}>
          <div style={{ width: '8px', height: '8px', background: '#00F0FF', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
          Looking for QR code
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-outline" onClick={stopScanner}>Cancel</button>
        </div>

        <style>{`
          @keyframes qrscan {
            0%   { top: 20%; opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 1; }
            100% { top: 80%; opacity: 0; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          #qr-reader video { object-fit: cover; width: 100% !important; border-radius: 20px; }
          #qr-reader img, #qr-reader button, #qr-reader select, #qr-reader span { display: none !important; }
        `}</style>
      </div>
    )
  }

  /* ─── STEP: Upload Document ─── */
  if (step === 'upload') {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '2rem' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          {/* Upload icon */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '16px', background: 'rgba(0,240,255,0.08)', border: '1px solid var(--border-accent)', marginBottom: '1.2rem' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 12 15 15"/>
            </svg>
          </div>

          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>Upload Document</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.8rem' }}>
            Drag and drop your file here, or click to choose from your device.
          </p>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUploadFile(f) }}
            style={{
              border: '2px dashed var(--border-accent)',
              borderRadius: '16px',
              padding: uploadPreview ? '1rem' : '3rem 2rem',
              cursor: 'pointer',
              background: 'rgba(4,25,41,0.5)',
              marginBottom: '1.5rem',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#00F0FF'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,240,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(4,25,41,0.5)' }}
          >
            {uploadPreview ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={uploadPreview} alt="Preview" style={{ maxHeight: '200px', borderRadius: '10px', maxWidth: '100%', display: 'block' }} />
                {/* × Remove button */}
                <button
                  onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  title="Remove file"
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px',
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: '#ef4444', border: '2px solid #fff',
                    color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', lineHeight: 1, padding: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    zIndex: 10,
                  }}
                >×</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(0,240,255,0.1)', marginBottom: '1rem' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>Drag & Drop your file here</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                  Supported formats: PDF, JPG, JPEG, PNG · Max file size: 10 MB
                </div>
                <button
                  type="button"
                  style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.65rem 1.8rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', pointerEvents: 'none' }}
                >
                  📄 Choose File
                </button>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleUploadFile(e.target.files[0])} />
          </div>

          {uploadFile && (
            <div style={{ background: 'rgba(0,240,255,0.06)', border: '1px solid var(--border-accent)', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📄 <strong>{uploadFile.name}</strong>
              <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{(uploadFile.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          {uploadError && (
            <div className="alert-box alert-danger" style={{ marginBottom: '1rem', textAlign: 'left' }}>
              ⚠️ {uploadError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setStep('landing'); setUploadFile(null); setUploadPreview(null); setUploadError(null) }}>
              ← Back to scanner
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!uploadFile || uploadScanning}
              onClick={scanUploadedFile}
            >
              {uploadScanning ? <><span className="spinner" /> Scanning…</> : 'Continue →'}
            </button>
          </div>

          {/* Hidden div required by Html5Qrcode.scanFile */}
          <div id="__offscreen_scanner__" style={{ display: 'none' }} />
        </div>
      </div>
    )
  }

  /* ─── STEP 3: Result ─── */
  return (
    <div className="fade-in">
      {loading && (
        <div className="loading-center"><span className="spinner" /> Looking up batch…</div>
      )}

      {data && (
        <>
          {/* Status Hero */}
          <div className="card-glass" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{statusIcon(data.status)}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--teal-400)', marginBottom: '0.4rem' }}>
              {data.batch_id}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className={getStatusBadge(data.status)} style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                {getStatusLabel(data.status)}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{data.status_display}</div>
            <button className="btn btn-outline" style={{ marginTop: '1.25rem', fontSize: '0.85rem' }} onClick={() => { setData(null); setStep('landing'); navigate('/lookup', { replace: true }) }}>
              ← Scan another
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Batch Info */}
            <div className="card">
              <div className="section-title">Batch Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Species', value: data.species },
                  { label: 'General Region', value: data.catch_zone },
                  { label: 'Catch Date', value: data.catch_date },
                  { label: 'Landing Centre', value: data.landing_centre },
                  { label: 'Registered', value: fmt(data.registered_at) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>SHA-256 Fingerprint</div>
                <div className="hash-display">{data.fingerprint}</div>
              </div>
            </div>

            {/* Custody Timeline */}
            <div className="card">
              <div className="section-title">Custody Timeline</div>
              {data.custody_timeline.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events recorded.</div>
              ) : (
                <div className="timeline">
                  {data.custody_timeline.map((ev, i) => (
                    <div key={i} className="timeline-item">
                      <div style={{ position: 'relative' }}>
                        <div className="timeline-dot" />
                        {i < data.custody_timeline.length - 1 && <div className="timeline-line" />}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-label">{ev.event_type}</div>
                        <div className="timeline-time">{fmt(ev.event_time)} · {ev.actor_role}</div>
                        {ev.note && <div className="timeline-note">{ev.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="alert-box alert-disclaimer" style={{ marginTop: '1.5rem' }}>
            ⚠️ {data.disclaimer}
          </div>
        </>
      )}
    </div>
  )
}
