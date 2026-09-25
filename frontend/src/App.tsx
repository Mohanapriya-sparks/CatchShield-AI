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
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      const fd = new URLSearchParams()
      fd.append('username', 'admin')
      fd.append('password', password)
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd
      })
      
      if (!res.ok) throw new Error('Invalid password')
      
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      setRole('admin')
      setShowAdminLogin(false)
      setPassword('')
    } catch (err) {
      setLoginError('Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setRole(null)
  }

  if (!role) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐟</div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>CatchShield AI</h1>
        
        {!showAdminLogin ? (
          <div style={{ display: 'flex', gap: '2rem' }}>
            <button className="btn btn-primary" style={{ padding: '1.5rem 3rem', fontSize: '1.2rem' }} onClick={() => setShowAdminLogin(true)}>
              👨‍💼 Staff Login
            </button>
            <button className="btn btn-outline" style={{ padding: '1.5rem 3rem', fontSize: '1.2rem' }} onClick={() => setRole('customer')}>
              🛒 Public Tracking
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <div className="section-title">Staff Authentication</div>
            <div className="form-group">
              <label>Passcode</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter staff passcode"
                autoFocus
              />
            </div>
            {loginError && <div className="alert-box alert-danger" style={{ marginBottom: '1rem' }}>{loginError}</div>}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Authenticating...' : 'Login'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAdminLogin(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
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
            <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleLogout}>
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
