// Login page: email + password. "Sign up" creates the account, "Log in" signs in.
// After either succeeds, supabase fires onAuthStateChange in App.jsx, which shows the app.
import { useState } from 'react'
import { supabase } from '../supabase'
import { APP_NAME } from '../config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signUp() {
    setError('')
    setMessage('')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data.session) {
      // Supabase still wants email confirmation on this project
      setMessage('account created, logging in...')
    }
  }

  async function logIn() {
    setError('')
    setMessage('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="center">
      <h1 style={{ color: '#ffcc00' }}>{APP_NAME}</h1>
      <p>one meme. up to two captions. vote on the funniest.</p>
      <form className="card" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          required
          placeholder="you@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p />
        <input
          type="password"
          required
          minLength={6}
          placeholder="password (6+ characters)"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p />
        <button className="btn" type="button" disabled={busy} onClick={logIn}>
          Log in
        </button>
        <p />
        <button className="btn ghost" type="button" disabled={busy} onClick={signUp}>
          Sign up
        </button>
        {message && <p className="hint">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
