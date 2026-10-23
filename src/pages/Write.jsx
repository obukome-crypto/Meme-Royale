// Write page: the template plus a text box. Captions are max 8 words.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { MAX_WORDS, MAX_CAPTIONS_PER_DAY } from '../config'
import { moderateCaption, wordCount } from '../lib/game'

export default function Write() {
  const [template, setTemplate] = useState(null)
  const [userId, setUserId] = useState(null)
  const [mine, setMine] = useState([])
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user.id)
    const { data: t } = await supabase.from('daily_templates').select('*').eq('status', 'live').maybeSingle()
    setTemplate(t)
    if (t) {
      const { data } = await supabase
        .from('captions')
        .select('id, text, slot')
        .eq('user_id', user.id)
        .eq('template_id', t.id)
        .order('slot')
      setMine(data ?? [])
    }
    setLoading(false)
  }

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    const clean = text.trim()
    if (!clean) return

    if (wordCount(clean) > MAX_WORDS) {
      setMessage(`keep it to ${MAX_WORDS} words or fewer`)
      return
    }
    if (mine.length >= MAX_CAPTIONS_PER_DAY) {
      setMessage('you already used both caption slots today')
      return
    }
    const check = moderateCaption(clean)
    if (check.flagged) {
      setMessage('that caption was flagged. try a different one.')
      return
    }

    // Use the first free slot (1 or 2)
    const takenSlots = mine.map((c) => c.slot)
    const slot = takenSlots.includes(1) ? 2 : 1

    const { error } = await supabase.from('captions').insert({
      template_id: template.id,
      user_id: userId,
      slot,
      text: clean,
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setText('')
    setMessage('submitted. it enters the pool once you have voted enough today.')
    load()
  }

  if (loading) return <p className="center">loading...</p>
  if (!template) return <p className="center">no live template yet.</p>

  const full = mine.length >= MAX_CAPTIONS_PER_DAY

  return (
    <section>
      <div className="card">
        <img className="template" src={template.image_url} alt={template.title} />
        <h2>{template.title}</h2>
      </div>

      <form className="card" onSubmit={submit}>
        <textarea
          rows={3}
          placeholder={full ? 'both slots used today' : 'your caption (max 8 words)'}
          value={text}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="hint">{wordCount(text)} / {MAX_WORDS} words</p>
        <button className="btn" type="submit" disabled={full || !text.trim()}>
          submit caption {mine.length + 1} of {MAX_CAPTIONS_PER_DAY}
        </button>
        {message && <p className="hint">{message}</p>}
      </form>
    </section>
  )
}
