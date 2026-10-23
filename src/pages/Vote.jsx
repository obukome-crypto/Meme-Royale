// Vote page: head-to-head rounds. Two captions on the template, tap the funnier one.
// No vote counts are shown here on purpose (that would cause bandwagoning).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { VOTE_OPEN_HOUR } from '../config'

export default function Vote() {
  const [template, setTemplate] = useState(null)
  const [pair, setPair] = useState(null)
  const [castCount, setCastCount] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const votingOpen = new Date().getHours() >= VOTE_OPEN_HOUR

  // Asks the database for a random pair of captions you have not voted on yet
  const loadNextPair = useCallback(async (t) => {
    const { data, error } = await supabase.rpc('get_next_pair', { p_template: t.id })
    if (error) {
      setMessage(error.message)
      setPair(null)
      return
    }
    setPair(data?.[0] ?? null)
  }, [])

  useEffect(() => {
    async function start() {
      const { data: t } = await supabase.from('daily_templates').select('*').eq('status', 'live').maybeSingle()
      setTemplate(t)
      if (t && votingOpen) await loadNextPair(t)
      setLoading(false)
    }
    start()
  }, [loadNextPair, votingOpen])

  async function choose(winnerId, loserId) {
    if (busy) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('cast_vote', { p_winner: winnerId, p_loser: loserId })
    setBusy(false)
    if (error) setMessage(error.message)
    else setCastCount((n) => n + 1)
    if (template) await loadNextPair(template)
  }

  async function report(captionId) {
    const { error } = await supabase.rpc('report_caption', {
      p_caption: captionId,
      p_reason: 'reported in vote round',
    })
    setMessage(error ? error.message : 'thanks, reported.')
    if (template) await loadNextPair(template)
  }

  if (loading) return <p className="center">loading...</p>
  if (!template) return <p className="center">no live template yet.</p>
  if (!votingOpen) return <p className="center">voting opens at {VOTE_OPEN_HOUR}:00 your time.</p>

  return (
    <section>
      <div className="card">
        <img className="template" src={template.image_url} alt={template.title} />
        <p className="hint">votes you've cast this session: {castCount}</p>
      </div>

      {!pair ? (
        <p className="center">no more pairs right now. check back later.</p>
      ) : (
        <div className="card">
          <p className="hint">which one is funnier?</p>
          <button className="caption-btn" disabled={busy} onClick={() => choose(pair.caption_a, pair.caption_b)}>
            {pair.text_a}
          </button>
          <p className="vs">vs</p>
          <button className="caption-btn" disabled={busy} onClick={() => choose(pair.caption_b, pair.caption_a)}>
            {pair.text_b}
          </button>
          <div className="center">
            <button className="small-link" onClick={() => report(pair.caption_a)}>report left</button>
            {' '}
            <button className="small-link" onClick={() => report(pair.caption_b)}>report right</button>
          </div>
        </div>
      )}

      {message && <p className="hint">{message}</p>}
    </section>
  )
}
