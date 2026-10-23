// Login page: passwordless. You type your email and get a magic link.
import { useState } from 'react'
import { supabase } from '../supabase'
import { APP_NAME } from '../config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function sendLink(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="center">
      <h1 style={{ color: '#ffcc00' }}>{APP_NAME}</h1>
      <p>one meme. up to two captions. vote on the funniest.</p>
      {sent ? (
        <p>check your email for the login link.</p>
      ) : (
        <form onSubmit={sendLink} className="card">
          <input type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p />
          <button className="btn" type="submit">email me a login link</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  )
}
