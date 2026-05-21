import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { gameControls } from '@/lib/gameControls'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_KEY = import.meta.env.VITE_APP_GROQ_SECRET_KEY
const MODEL = 'llama-3.3-70b-versatile'

async function groqChat(history, systemPrompt) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 120,
      temperature: 0.85,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? "Sorry, couldn't hear you!"
}

export default function AIChat({ npc, onClose }) {
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()
  const bottomRef = useRef()

  // Disable game controls while this panel is mounted
  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Opening greeting
  useEffect(() => {
    if (!npc) return
    inputRef.current?.focus()
    setLoading(true)
    groqChat([], npc.systemPrompt + ' Greet the player in one short friendly sentence as they approach.')
      .then(g => { setMsgs([{ role: 'assistant', content: g }]); setLoading(false) })
      .catch(() => setLoading(false))
  }, [npc])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const next = [...msgs, userMsg]
    setMsgs(next); setInput(''); setLoading(true)
    try {
      const reply = await groqChat(next, npc.systemPrompt)
      setMsgs(m => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: "Sorry, didn't catch that!" }])
    }
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '44vh',
        background: 'rgba(8,6,18,0.94)', backdropFilter: 'blur(18px)',
        borderTop: '1.5px solid rgba(124,58,237,0.45)',
        display: 'flex', flexDirection: 'column', zIndex: 200,
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{ fontSize: 22 }}>{npc.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#facc15', fontWeight: 700, fontSize: 14 }}>{npc.name}</div>
          <div style={{ color: '#64748b', fontSize: 11 }}>{npc.location}</div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11, marginRight: 8 }}>Esc to close</div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '78%',
            background: m.role === 'user' ? 'rgba(124,58,237,0.75)' : 'rgba(255,255,255,0.09)',
            borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '8px 13px', color: '#fff', fontSize: 13, lineHeight: 1.55,
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start', background: 'rgba(255,255,255,0.07)',
            borderRadius: '16px 16px 16px 4px', padding: '9px 16px', color: '#64748b', fontSize: 14
          }}>
            ●●●
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
        <input ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type anything..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '9px 14px', color: '#fff', fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#EC4899)', border: 'none',
            borderRadius: 12, padding: '9px 20px', color: '#fff', fontWeight: 700,
            fontSize: 13, cursor: 'pointer', opacity: (loading || !input.trim()) ? 0.4 : 1,
          }}>
          Send
        </button>
      </div>
    </motion.div>
  )
}
