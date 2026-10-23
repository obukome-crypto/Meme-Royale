// Profile page: your streak, wins, badges, and a logout button.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: s } = await supabase.from('streaks').select('*').eq('user_id', user.id).single()
      setProfile(p)
      setStreak(s)
    }
    load()
  }, [])

  if (!profile || !streak) return <p className="center">loading...</p>

  const inTimeout = profile.timeout_until && new Date(profile.timeout_until) > new Date()

  return (
    <section>
      <div className="card">
        <h2>@{profile.username}</h2>
        {inTimeout && (
          <p className="error">
            you are in a timeout until {new Date(profile.timeout_until).toLocaleString()} (captions reported by the community)
          </p>
        )}
      </div>

      <div className="card">
        <div className="stat-row"><span>current streak</span><span>{streak.current_streak} days</span></div>
        <div className="stat-row"><span>longest streak</span><span>{streak.longest_streak} days</span></div>
        <div className="stat-row"><span>daily wins</span><span>{profile.wins}</span></div>
        <div className="stat-row"><span>people's champ wins</span><span>{profile.people_champ_wins}</span></div>
      </div>

      <div className="card">
        <h2>badges</h2>
        {profile.badges?.length ? (
          profile.badges.map((b) => <span className="badge" key={b}>{b}</span>)
        ) : (
          <p className="hint">no badges yet. vote, write, and win.</p>
        )}
      </div>

      <button className="btn ghost" onClick={() => supabase.auth.signOut()}>log out</button>
    </section>
  )
}
