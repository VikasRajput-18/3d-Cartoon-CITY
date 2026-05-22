import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import { groqChat, getTimeLabel, getWeatherDesc, LANGUAGE_RULE } from '@/lib/groqChat'
import { timeWeatherState } from '@/lib/timeWeatherState'

const GENERIC_FALLBACKS = [
  "Hmm, signal's a bit choppy here — what were you saying?",
  "Sorry, got distracted for a sec! Could you repeat that?",
  "One moment... my mind wandered. Say that again?",
]

function buildPrompt(npc, playerName) {
  const time    = getTimeLabel(timeWeatherState.timeOfDay)
  const weather = getWeatherDesc(timeWeatherState.weather)
  const ctx     = `It is ${time}. ${weather} You are talking with ${playerName}.`
  return `${npc.systemPrompt}\n\n${ctx}\n${LANGUAGE_RULE}`
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 2px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b' }}
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

export default function AIChat({ npc, onClose }) {
  const avatar   = useStore(s => s.avatar)
  const [msgs, setMsgs]     = useState([])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef  = useRef()
  const bottomRef = useRef()
  const histRef   = useRef([])

  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Opening greeting
  useEffect(() => {
    if (!npc) return
    inputRef.current?.focus()
    setLoading(true)
    const playerName = avatar?.name || 'traveler'
    const sysPrompt  = buildPrompt(npc, playerName)
    groqChat(
      [],
      sysPrompt + `\n\nGreet ${playerName} in ONE short friendly sentence as they walk up to you. Stay completely in character.`,
    )
      .then(g => {
        const greeting = [{ role: 'assistant', content: g }]
        histRef.current = greeting
        setMsgs(greeting)
        setLoading(false)
        audioSystem.playNotification()
      })
      .catch(() => setLoading(false))
  }, [npc])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const send = async () => {
    if (!input.trim() || loading) return
    const playerName = avatar?.name || 'traveler'
    const userMsg    = { role: 'user', content: input.trim() }
    const next       = [...histRef.current, userMsg]
    histRef.current  = next
    setMsgs(next)
    setInput('')
    setLoading(true)
    try {
      const sysPrompt = buildPrompt(npc, playerName)
      const reply     = await groqChat(next, sysPrompt)
      const updated   = [...next, { role: 'assistant', content: reply }]
      histRef.current = updated
      setMsgs(updated)
      audioSystem.playNotification()
    } catch {
      const fallback = GENERIC_FALLBACKS[Math.floor(Math.random() * GENERIC_FALLBACKS.length)]
      const updated  = [...next, { role: 'assistant', content: fallback }]
      histRef.current = updated
      setMsgs(updated)
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
        display: 'flex', alignItems: 'center', gap: 10,
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
            borderRadius: '16px 16px 16px 4px', padding: '9px 16px',
          }}>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
        <input ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); else audioSystem.playTyping() }}
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
