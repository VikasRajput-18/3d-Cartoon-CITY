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
    <div ref={popupRef} className="fixed bottom-[170px] right-4 z-[350]">
      {/* Emote picker popup */}
      {open && (
        <div
          className="absolute bottom-16 right-0 rounded-[14px] min-w-[130px] py-2 px-1.5"
          style={{
            background: 'rgba(8,4,20,0.96)',
            border: '1px solid rgba(124,58,237,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-violet-400 text-[10px] font-bold uppercase tracking-[1px] px-2.5 pt-0.5 pb-1.5 font-body">
            Emotes
          </div>
          {EMOTES.map(e => (
            <button
              key={e.name}
              onClick={() => trigger(e.name)}
              className="flex items-center gap-[10px] w-full py-[10px] px-3 bg-transparent border-0 rounded-[9px] cursor-pointer text-left font-body min-h-[48px] transition-[background] duration-[120ms] hover:bg-[rgba(124,58,237,0.2)]"
            >
              <span className="text-[22px] leading-none">{e.emoji}</span>
              <span className="text-slate-200 text-[13px] font-bold flex-1">{e.label}</span>
              <span className="text-slate-600 text-[11px] font-mono">[{e.key}]</span>
            </button>
          ))}
        </div>
      )}

      {/* Emote button */}
      <button
        onClick={() => setOpen(s => !s)}
        title="Emotes"
        className="w-14 h-14 rounded-full cursor-pointer text-2xl leading-none flex items-center justify-center transition-[border-color,background] duration-200"
        style={{
          background: open ? 'rgba(124,58,237,0.3)' : 'rgba(8,4,20,0.82)',
          border: `2px solid ${open ? 'rgba(124,58,237,0.7)' : 'rgba(124,58,237,0.3)'}`,
          boxShadow: open ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
        }}
      >
        😊
      </button>
    </div>
  )
}
