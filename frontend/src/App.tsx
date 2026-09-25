import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import OperatorScreen from './screens/OperatorScreen'
import OfficerScreen from './screens/OfficerScreen'
import MatchingDashboard from './screens/MatchingDashboard'
import InspectorScreen from './screens/InspectorScreen'
import PublicLookup from './screens/PublicLookup'
import HomeScreen from './screens/HomeScreen'
import { SyncBanner } from './components/SyncBanner'

export default function App() {
  const [role, setRole] = useState<'admin' | 'customer' | null>(null)

  if (!role) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐟</div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>CatchShield AI</h1>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button className="btn btn-primary" style={{ padding: '1.5rem 3rem', fontSize: '1.2rem' }} onClick={() => setRole('admin')}>
            👨‍💼 Login as Admin
          </button>
          <button className="btn btn-outline" style={{ padding: '1.5rem 3rem', fontSize: '1.2rem' }} onClick={() => setRole('customer')}>
            🛒 Login as Customer
          </button>
        </div>
        <div className="demo-notice" style={{ marginTop: '3rem' }}>
          Note: This is a demo. Authentication is not verified by a server.
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="nav">
          <div className="nav-inner">
            <NavLink to="/" className="nav-brand">
              🐟 <span>CatchShield AI</span>
            </NavLink>
            <div className="nav-links">
              {role === 'admin' && (
                <>
                  <NavLink to="/operator" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Operator</NavLink>
                  <NavLink to="/officer" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Env Officer</NavLink>
                  <NavLink to="/matching" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Matching</NavLink>
                  <NavLink to="/inspector" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Inspector</NavLink>
                </>
              )}
              {role === 'customer' && (
                <NavLink to="/lookup" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Public Lookup</NavLink>
              )}
            </div>
            <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setRole(null)}>
              Logout
            </button>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            {role === 'admin' ? (
              <>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/operator" element={<OperatorScreen />} />
                <Route path="/officer" element={<OfficerScreen />} />
                <Route path="/matching" element={<MatchingDashboard />} />
                <Route path="/inspector" element={<InspectorScreen />} />
                <Route path="/lookup" element={<Navigate to="/" replace />} />
                <Route path="/lookup/:batchId" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to="/lookup" replace />} />
                <Route path="/lookup" element={<PublicLookup />} />
                <Route path="/lookup/:batchId" element={<PublicLookup />} />
                <Route path="*" element={<Navigate to="/lookup" replace />} />
              </>
            )}
          </Routes>
        </main>
      </div>
      <SyncBanner />
    </BrowserRouter>
  )
}
