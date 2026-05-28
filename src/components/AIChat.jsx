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
    <div className="flex gap-1 py-1 px-0.5 items-center">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: '#64748b' }}
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
      className="absolute bottom-0 left-0 right-0 h-[44vh] flex flex-col z-[200] font-body backdrop-blur-[18px]"
      style={{
        background: 'rgba(8,6,18,0.94)',
        borderTop: '1.5px solid rgba(124,58,237,0.45)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-[10px] flex items-center gap-[10px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="text-[22px]">{npc.emoji}</span>
        <div className="flex-1">
          <div className="text-yellow-400 font-bold text-sm">{npc.name}</div>
          <div className="text-slate-500 text-[11px]">{npc.location}</div>
        </div>
        <div className="text-slate-400 text-[11px] mr-2">Esc to close</div>
        <button onClick={onClose}
          className="bg-transparent border-0 text-slate-400 cursor-pointer text-xl leading-none">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-[10px] flex flex-col gap-2">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[78%] py-2 px-[13px] text-white text-[13px] leading-[1.55] ${m.role === 'user' ? 'self-end' : 'self-start'}`}
            style={{
              background: m.role === 'user' ? 'rgba(124,58,237,0.75)' : 'rgba(255,255,255,0.09)',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div
            className="self-start py-[9px] px-4"
            style={{
              background: 'rgba(255,255,255,0.07)',
              borderRadius: '16px 16px 16px 4px',
            }}
          >
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-[10px] flex gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <input ref={inputRef} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); else audioSystem.playTyping() }}
          placeholder="Type anything..."
          className="flex-1 text-white text-[13px] outline-none rounded-xl py-[9px] px-[14px]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="rounded-xl py-[9px] px-5 text-white font-bold text-[13px] cursor-pointer border-0"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#EC4899)',
            opacity: (loading || !input.trim()) ? 0.4 : 1,
          }}>
          Send
        </button>
      </div>
    </motion.div>
  )
}
