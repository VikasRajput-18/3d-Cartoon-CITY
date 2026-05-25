import { useState, useRef, useEffect } from 'react'

const EMOTES = [
  { name: 'greet',     label: 'Greet',     emoji: '👋', key: '1' },
  { name: 'dance',     label: 'Dance',     emoji: '💃', key: '2' },
  { name: 'laughing',  label: 'Laugh',     emoji: '😂', key: '3' },
  { name: 'handshake', label: 'Handshake', emoji: '🤝', key: '4' },
]

export default function EmotePicker() {
  const [open, setOpen] = useState(false)
  const popupRef = useRef()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const trigger = (emoteName) => {
    window.dispatchEvent(new CustomEvent('emote-trigger', { detail: { emote: emoteName } }))
    setOpen(false)
  }

  return (
    <div ref={popupRef} style={{ position: 'fixed', bottom: 170, right: 16, zIndex: 350 }}>
      {/* Emote picker popup */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 64, right: 0,
          background: 'rgba(8,4,20,0.96)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 14, padding: '8px 6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          minWidth: 130,
        }}>
          <div style={{
            color: '#a78bfa', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
            padding: '2px 10px 6px', fontFamily: 'Nunito, sans-serif',
          }}>
            Emotes
          </div>
          {EMOTES.map(e => (
            <button
              key={e.name}
              onClick={() => trigger(e.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px',
                background: 'none', border: 'none', borderRadius: 9,
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'Nunito, sans-serif',
                minHeight: 48,
                transition: 'background 0.12s',
              }}
              onMouseEnter={el => { el.currentTarget.style.background = 'rgba(124,58,237,0.2)' }}
              onMouseLeave={el => { el.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{e.emoji}</span>
              <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, flex: 1 }}>{e.label}</span>
              <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>[{e.key}]</span>
            </button>
          ))}
        </div>
      )}

      {/* Emote button */}
      <button
        onClick={() => setOpen(s => !s)}
        title="Emotes"
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: open ? 'rgba(124,58,237,0.3)' : 'rgba(8,4,20,0.82)',
          border: `2px solid ${open ? 'rgba(124,58,237,0.7)' : 'rgba(124,58,237,0.3)'}`,
          cursor: 'pointer', fontSize: 24, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.2s, background 0.2s',
          boxShadow: open ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
        }}
      >
        😊
      </button>
    </div>
  )
}
