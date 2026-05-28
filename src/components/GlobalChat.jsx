import { useState, useRef, useEffect } from 'react'
import { gameControls } from '@/lib/gameControls'
import { supabase } from '@/lib/supabase'
import { audioSystem } from '@/lib/audioSystem'

// open / onOpenChange are optional — if omitted, component manages its own state
export default function GlobalChat({ globalMessages, onSendGlobal, onlineCount, open: openProp, onOpenChange, unreadCount }) {
  const controlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlled ? openProp : internalOpen

  const setOpen = (val) => {
    if (controlled) { onOpenChange?.(val) }
    else            { setInternalOpen(val) }
  }

  const [input, setInput] = useState('')
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [globalMessages, open])

  const send = () => {
    const text = input.trim()
    if (!text) return
    audioSystem.playChatSent()
    onSendGlobal(text)
    setInput('')
  }

  const handleFocus = () => { gameControls.enabled = false }
  const handleBlur  = () => { gameControls.enabled = true  }

  const notConfigured = !supabase

  return (
    <div className="fixed bottom-6 left-4 z-50 font-body">
      {open && (
        <div
          className="w-[300px] rounded-xl overflow-hidden flex flex-col mb-2"
          style={{
            background: 'rgba(8,4,20,0.92)',
            border: '1.5px solid rgba(124,58,237,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(124,58,237,0.2)' }}
          >
            <span className="text-violet-400 font-bold text-[13px]">🌍 Global Chat</span>
            <button
              onClick={() => { setOpen(false); gameControls.enabled = true }}
              className="bg-transparent border-0 text-slate-500 cursor-pointer text-base leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="h-[200px] overflow-y-auto px-3 py-2 flex flex-col gap-1">
            {notConfigured ? (
              <div className="text-red-400 text-[11px] text-center mt-[60px]">
                Multiplayer not configured.<br />
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
              </div>
            ) : globalMessages.length === 0 ? (
              <div className="text-slate-600 text-[11px] text-center mt-[60px]">No messages yet</div>
            ) : (
              globalMessages.map((m, i) => (
                <div key={m.id ?? i} className="text-xs leading-[1.4]">
                  <span className="text-violet-400 font-bold">{m.name}</span>
                  <span className="text-slate-500">: </span>
                  <span className="text-slate-200">{m.content}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!notConfigured && (
            <div
              className="px-2.5 py-2 flex gap-1.5"
              style={{ borderTop: '1px solid rgba(124,58,237,0.2)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                placeholder="Say something to everyone…"
                maxLength={200}
                className="flex-1 rounded-lg text-slate-200 text-xs font-body outline-none py-[5px] px-2.5"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
              <button
                onClick={send}
                className="rounded-lg py-[5px] px-3 text-white font-bold text-xs cursor-pointer font-body border-0"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="rounded-[20px] py-[6px] px-[14px] text-slate-200 font-body text-[13px] font-bold cursor-pointer flex items-center gap-1.5 relative"
        style={{
          background: open ? 'rgba(124,58,237,0.7)' : 'rgba(8,4,20,0.82)',
          border: '1.5px solid ' + (open ? '#7c3aed' : 'rgba(124,58,237,0.35)'),
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        💬 Chat
        {!open && unreadCount > 0 && (
          <span className="bg-red-500 text-white rounded-[10px] text-[10px] font-extrabold px-[5px] py-[1px] leading-[1.4] min-w-[16px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {(open || !unreadCount) && onlineCount > 0 && (
          <span className="bg-green-400 text-black rounded-[10px] text-[10px] font-extrabold px-[5px] py-[1px] leading-[1.4]">
            {onlineCount}
          </span>
        )}
      </button>
    </div>
  )
}
