import { NavLink } from 'react-router-dom'

export default function HomeScreen() {
  return (
    <div className="fade-in">
      <div className="page-header" style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 3rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🐟</div>
        <h1 style={{ fontSize: '2.2rem' }}>CatchShield AI</h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Digital Catch Passport System — CodeGyaan'26 ChainCraft MVP
        </p>
      </div>

      <div className="alert-box alert-disclaimer" style={{ maxWidth: 700, margin: '0 auto 2rem' }}>
        ℹ️ <strong>IMPORTANT DISCLAIMER:</strong> No alert overlap or matching hash proves seafood safety.
        Inspector decisions in this prototype are demo decisions, not official government clearance.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', maxWidth: 900, margin: '0 auto' }}>
        {SCREENS.map((s) => (
          <NavLink key={s.path} to={s.path} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal-500)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = ''
                ;(e.currentTarget as HTMLDivElement).style.borderColor = ''
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--teal-400)' }}>
                {s.role}
              </div>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          </NavLink>
        ))}
      </div>

    </div>
  )
}

const SCREENS = [
  {
    path: '/operator',
    icon: '⚓',
    role: 'Landing Operator',
    title: 'Register Batch',
    desc: 'Create a Digital Catch Passport for a fish batch. Generate unique Batch ID and QR code.',
  },
  {
    path: '/officer',
    icon: '🌊',
    role: 'Environmental Officer',
    title: 'Screen & Confirm Alert',
    desc: 'Upload ocean image for heuristic screening. Explicitly confirm or reject a pollution alert.',
  },
  {
    path: '/matching',
    icon: '🔍',
    role: 'System Dashboard',
    title: 'Matching Dashboard',
    desc: 'View which batches overlap confirmed alerts by zone and time, with reasons.',
  },
  {
    path: '/inspector',
    icon: '🔬',
    role: 'Inspector',
    title: 'Record Decision',
    desc: 'Record a demo inspection decision on matched batches. Explicit action required.',
  },
]
