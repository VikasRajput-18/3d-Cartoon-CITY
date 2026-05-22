import { useState, useRef, useEffect } from 'react'
import { gameControls } from '@/lib/gameControls'
import { supabase } from '@/lib/supabase'

const BUBBLE = {
  position: 'fixed', bottom: 24, left: 16, zIndex: 50,
  fontFamily: 'Nunito, sans-serif',
}

const PANEL = {
  width: 300,
  background: 'rgba(8,4,20,0.92)',
  border: '1.5px solid rgba(124,58,237,0.35)',
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  marginBottom: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
}

export default function GlobalChat({ globalMessages, onSendGlobal, onlineCount }) {
  const [open,  setOpen]  = useState(false)
  const [input, setInput] = useState('')
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [globalMessages, open])

  const send = () => {
    const text = input.trim()
    if (!text) return
    onSendGlobal(text)
    setInput('')
  }

  const handleFocus = () => { gameControls.enabled = false }
  const handleBlur  = () => { gameControls.enabled = true  }

  const notConfigured = !supabase

  return (
    <div style={BUBBLE}>
      {open && (
        <div style={PANEL}>
          {/* Header */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid rgba(124,58,237,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>🌍 Global Chat</span>
            <button
              onClick={() => { setOpen(false); gameControls.enabled = true }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{ height: 200, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {notConfigured ? (
              <div style={{ color: '#f87171', fontSize: 11, textAlign: 'center', marginTop: 60 }}>
                Multiplayer not configured.<br />
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
              </div>
            ) : globalMessages.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 60 }}>No messages yet</div>
            ) : (
              globalMessages.map((m, i) => (
                <div key={m.id ?? i} style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>{m.name}</span>
                  <span style={{ color: '#64748b' }}>: </span>
                  <span style={{ color: '#e2e8f0' }}>{m.content}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!notConfigured && (
            <div style={{
              padding: '8px 10px', borderTop: '1px solid rgba(124,58,237,0.2)',
              display: 'flex', gap: 6,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                placeholder="Say something to everyone…"
                maxLength={200}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#e2e8f0', fontSize: 12, padding: '5px 10px',
                  fontFamily: 'Nunito, sans-serif', outline: 'none',
                }}
              />
              <button
                onClick={send}
                style={{
                  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                  border: 'none', borderRadius: 8, padding: '5px 12px',
                  color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'rgba(124,58,237,0.7)' : 'rgba(8,4,20,0.82)',
          border: '1.5px solid ' + (open ? '#7c3aed' : 'rgba(124,58,237,0.35)'),
          borderRadius: 20, padding: '6px 14px',
          color: '#e2e8f0', fontFamily: 'Nunito, sans-serif',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        💬 Chat
        {onlineCount > 0 && (
          <span style={{
            background: '#4ade80', color: '#000', borderRadius: 10,
            fontSize: 10, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4,
          }}>
            {onlineCount}
          </span>
        )}
      </button>
    </div>
  )
}
