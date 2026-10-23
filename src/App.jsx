// The app shell: checks if someone is logged in, then shows the pages and the bottom nav.
import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { APP_NAME } from './config'
import Login from './pages/Login'
import Today from './pages/Today'
import Write from './pages/Write'
import Vote from './pages/Vote'
import Results from './pages/Results'
import Profile from './pages/Profile'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    // Runs whenever someone logs in or out
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="center">loading...</div>
  if (!session) return <Login />

  return (
    <div className="app">
      <header className="topbar">
        <h1>{APP_NAME}</h1>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/write" element={<Write />} />
          <Route path="/vote" element={<Vote />} />
          <Route path="/results" element={<Results />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <nav className="bottomnav">
        <NavLink to="/" end>Today</NavLink>
        <NavLink to="/write">Write</NavLink>
        <NavLink to="/vote">Vote</NavLink>
        <NavLink to="/results">Results</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
    </div>
  )
}
