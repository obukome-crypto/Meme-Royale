// Today page: shows today's template, your voting progress, and your captions.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { MIN_VOTES_TO_UNLOCK, MAX_CAPTIONS_PER_DAY } from '../config'

export default function Today() {
  const [template, setTemplate] = useState(null)
  const [myVotes, setMyVotes] = useState(0)
  const [myCaptions, setMyCaptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: t } = await supabase.from('daily_templates').select('*').eq('status', 'live').maybeSingle()
      setTemplate(t)
      if (t) {
        // Only counts YOUR votes (the database only lets you read your own votes)
        const { count } = await supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('voter_id', user.id)
          .eq('template_id', t.id)
        setMyVotes(count ?? 0)

        const { data: caps } = await supabase
          .from('captions')
          .select('id, text, slot, eligible, hidden')
          .eq('user_id', user.id)
          .eq('template_id', t.id)
          .order('slot')
        setMyCaptions(caps ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="center">loading today...</p>
  if (!template) return <p className="center">no template is live yet. a new one drops at midnight.</p>

  const unlocked = myVotes >= MIN_VOTES_TO_UNLOCK

  return (
    <section>
      <div className="card">
        <img className="template" src={template.image_url} alt={template.title} />
        <h2>{template.title}</h2>
        <p className="hint">one template for everyone today.</p>
      </div>

      <div className="card">
        <p>votes cast: {myVotes} of {MIN_VOTES_TO_UNLOCK} needed</p>
        <p className="hint">
          {unlocked
            ? 'your captions are in the pool.'
            : 'vote in the evening round to unlock your captions.'}
        </p>
        <Link className="btn ghost" to="/vote">go vote</Link>
      </div>

      <div className="card">
        <p>your captions: {myCaptions.length} of {MAX_CAPTIONS_PER_DAY}</p>
        <ul>
          {myCaptions.map((c) => (
            <li key={c.id}>
              {c.text} {c.hidden ? <span className="hint">(hidden)</span> : null}
            </li>
          ))}
        </ul>
        <Link className="btn" to="/write">write captions</Link>
      </div>
    </section>
  )
}
