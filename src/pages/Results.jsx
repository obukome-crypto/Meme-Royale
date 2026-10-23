// Results page: shows the latest finished day, the top 10 captions, and the winner card button.
// Vote counts only appear here, after the day is finished.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { makeWinnerCard, shareCard } from '../lib/cardGenerator'

export default function Results() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: t } = await supabase
      .from('daily_templates')
      .select('*')
      .eq('status', 'finished')
      .order('day', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!t) {
      setData({ none: true })
      return
    }

    const { data: result } = await supabase.from('daily_results').select('*').eq('template_id', t.id).maybeSingle()

    let winner = null
    let champ = null
    if (result?.winner_caption_id) {
      const { data } = await supabase
        .from('captions')
        .select('id, text, profiles(username)')
        .eq('id', result.winner_caption_id)
        .maybeSingle()
      winner = data
    }
    if (result?.people_champ_caption_id) {
      const { data } = await supabase
        .from('captions')
        .select('id, text, profiles(username)')
        .eq('id', result.people_champ_caption_id)
        .maybeSingle()
      champ = data
    }

    const { data: top } = await supabase
      .from('elo_ratings')
      .select('caption_id, rating, raw_votes, captions(id, text, profiles(username))')
      .eq('template_id', t.id)
      .order('rating', { ascending: false })
      .limit(10)

    setData({ template: t, winner, champ, top: top ?? [] })
  }

  async function share() {
    setMessage('')
    try {
      const blob = await makeWinnerCard({
        imageUrl: data.template.image_url,
        caption: data.winner.text,
        username: data.winner.profiles?.username ?? 'player',
        title: data.template.title,
      })
      await shareCard(blob, `my Meme Royale winner: "${data.winner.text}"`)
    } catch (e) {
      setMessage(`could not make the card: ${e.message}`)
    }
  }

  if (!data) return <p className="center">loading...</p>
  if (data.none) return <p className="center">no finished day yet. the first winner is crowned at midnight.</p>

  return (
    <section>
      <div className="card">
        <p className="hint">yesterday's template</p>
        <img className="template" src={data.template.image_url} alt={data.template.title} />
        <h2>{data.template.title}</h2>
      </div>

      <div className="card">
        <h2>daily winner</h2>
        {data.winner ? (
          <>
            <p>"{data.winner.text}"</p>
            <p className="hint">by @{data.winner.profiles?.username}</p>
            <button className="btn" onClick={share}>make and share winner card</button>
          </>
        ) : (
          <p className="hint">no winner this day.</p>
        )}
        {data.champ && (
          <p className="hint">people's champ (most votes): "{data.champ.text}" by @{data.champ.profiles?.username}</p>
        )}
        {message && <p className="error">{message}</p>}
      </div>

      <div className="card">
        <h2>top 10</h2>
        <ol className="top-list">
          {data.top.map((row) => (
            <li key={row.caption_id}>
              "{row.captions?.text}" by @{row.captions?.profiles?.username}
              <span className="hint"> elo {row.rating}, {row.raw_votes} votes</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
