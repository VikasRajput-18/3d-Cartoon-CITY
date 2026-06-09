// Companion chat panel — talk to your AI companion (Groq), see level/XP, toggle
// world visibility. Disables game controls while open (has a text input).
import { useState, useEffect, useRef } from 'react'
import { gameControls } from '@/lib/gameControls'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { getEconomyState } from '@/lib/economyState'
import { getCompanion, onCompanionUpdate, chatWithCompanion, setCompanionVisible } from '@/lib/companionService'

export default function CompanionChat({ open, onClose }) {
  const [comp, setComp] = useState(getCompanion)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => onCompanionUpdate(setComp), [])
  useEffect(() => {
    if (!open) return
    gameControls.enabled = false
    setTimeout(() => inputRef.current?.focus(), 50)
    return () => { gameControls.enabled = true }
  }, [open])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [msgs, busy])

  if (!open || !comp) return null

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setMsgs(m => [...m, { role: 'user', content: text }])
    setInput(''); setBusy(true)
    const ctx = { time: timeWeatherState.isNight ? 'night' : 'day', weather: timeWeatherState.weather || 'clear', coins: getEconomyState().coins, location: 'the city' }
    const reply = await chatWithCompanion(text, ctx)
    setMsgs(m => [...m, { role: 'assistant', content: reply }])
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9400, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(94vw, 440px)', height: 'min(86vh, 560px)', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: comp.outfitColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>💗 {comp.name}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{comp.personality} · Lv {comp.level} · {comp.xp} XP</div>
          </div>
          <button onClick={() => setCompanionVisible(comp.visible === false)} title="Toggle companion visibility"
            style={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#cbd5e1', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {comp.visible === false ? '🙈 Hidden' : '👁 Visible'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.length === 0 && <div style={{ color: '#64748b', textAlign: 'center', marginTop: 20, fontSize: 13 }}>Say hi to {comp.name}! 👋</div>}
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', background: m.role === 'user' ? '#2563eb' : '#1e293b', color: '#fff', padding: '8px 12px', borderRadius: 12, fontSize: 14 }}>{m.content}</div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: 13 }}>{comp.name} is typing…</div>}
        </div>

        <div style={{ padding: 10, borderTop: '1px solid #1e293b', display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => { gameControls.enabled = false }}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') send(); else if (e.key === 'Escape') onClose() }}
            onKeyUp={e => e.stopPropagation()}
            placeholder={`Message ${comp.name}…`}
            disabled={busy}
            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none' }}
          />
          <button onClick={send} disabled={busy || !input.trim()} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 800, cursor: 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  )
}

export function CompanionButton({ onClick }) {
  return (
    <button onClick={onClick} title="Your AI companion"
      className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
      style={{ background: 'rgba(16,185,129,0.85)', border: '1.5px solid rgba(16,185,129,0.5)', boxShadow: '0 2px 12px rgba(16,185,129,0.4)' }}
    >🤖</button>
  )
}
