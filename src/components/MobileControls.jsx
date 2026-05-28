import { useRef, useState, useCallback } from 'react'
import { mobileInput } from '@/lib/mobileInput'
import { gameControls } from '@/lib/gameControls'
import { useStore } from '@/store'

const JOY_SIZE = 128   // outer ring px
const JOY_THUMB = 46   // inner thumb px
const JOY_MAX  = (JOY_SIZE - JOY_THUMB) / 2  // max thumb travel from centre

const EMOTES = [
  { emoji: '😄', label: 'Happy',   expr: 'happy'  },
  { emoji: '👋', label: 'Wave',    expr: 'wave'   },
  { emoji: '💃', label: 'Dance',   expr: 'dance'  },
  { emoji: '😢', label: 'Sad',     expr: 'sad'    },
]

// Dispatch a synthetic key event so the existing keyboard handlers fire
function fakeKey(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 80)
}

function ActionBtn({ label, color, onPress, children, pressed }) {
  return (
    <button
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onPress() }}
      className="flex flex-col items-center justify-center"
      style={{
        width: 58, height: 58, borderRadius: '50%',
        background: pressed ? `${color}60` : `${color}30`,
        border: `2px solid ${color}90`,
        color: '#fff',
        fontSize: label ? 14 : 22,
        fontFamily: 'monospace', fontWeight: 'bold',
        cursor: 'pointer', touchAction: 'manipulation',
        boxShadow: `0 0 12px ${color}40`,
        lineHeight: 1, gap: 1,
        transition: 'background 0.1s',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {children}
      {label && <span className="text-[9px] opacity-70 mt-0.5">{label}</span>}
    </button>
  )
}

export default function MobileControls() {
  const toast    = useStore(s => s.toast)
  const setAvatar = useStore(s => s.setAvatar)

  const [thumb, setThumb]       = useState({ x: 0, y: 0 })
  const [showEmotes, setShowEmotes] = useState(false)
  const [pressedE, setPressedE] = useState(false)
  const [pressedF, setPressedF] = useState(false)

  const joyRef = useRef()
  const ptrRef = useRef(null)   // pointer ID claimed by joystick

  // ── Joystick pointer handlers ──────────────────────────────────────────
  const updateJoy = useCallback((e) => {
    if (!joyRef.current) return
    const rect = joyRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > JOY_MAX) { dx = (dx / dist) * JOY_MAX; dy = (dy / dist) * JOY_MAX }
    setThumb({ x: dx, y: dy })
    mobileInput.joyX = dx / JOY_MAX
    mobileInput.joyY = dy / JOY_MAX
  }, [])

  const onJoyDown = useCallback((e) => {
    e.stopPropagation()
    if (ptrRef.current !== null) return
    joyRef.current?.setPointerCapture(e.pointerId)
    ptrRef.current = e.pointerId
    mobileInput.joyActive = true
    updateJoy(e)
  }, [updateJoy])

  const onJoyMove = useCallback((e) => {
    if (e.pointerId !== ptrRef.current) return
    e.stopPropagation()
    updateJoy(e)
  }, [updateJoy])

  const onJoyUp = useCallback((e) => {
    if (e.pointerId !== ptrRef.current) return
    e.stopPropagation()
    ptrRef.current = null
    mobileInput.joyX = 0
    mobileInput.joyY = 0
    mobileInput.joyActive = false
    setThumb({ x: 0, y: 0 })
  }, [])

  // ── Action handlers ────────────────────────────────────────────────────
  const handleE = useCallback(() => {
    fakeKey('KeyE')
    setPressedE(true)
    setTimeout(() => setPressedE(false), 150)
  }, [])

  const handleF = useCallback(() => {
    fakeKey('KeyF')
    setPressedF(true)
    setTimeout(() => setPressedF(false), 150)
  }, [])

  const handleEmote = useCallback((emote) => {
    setAvatar({ expression: emote.expr })
    toast(`${emote.emoji} ${emote.label}!`, 'info')
    setShowEmotes(false)
  }, [setAvatar, toast])

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none touch-none">
      {/* ── Virtual joystick — bottom left ───────────────────────────── */}
      <div className="absolute bottom-9 left-6 pointer-events-auto touch-none">
        {/* Outer ring */}
        <div
          ref={joyRef}
          onPointerDown={onJoyDown}
          onPointerMove={onJoyMove}
          onPointerUp={onJoyUp}
          onPointerCancel={onJoyUp}
          className="flex items-center justify-center relative touch-none"
          style={{
            width: JOY_SIZE, height: JOY_SIZE, borderRadius: '50%',
            background: 'rgba(0,0,0,0.38)',
            border: '2px solid rgba(255,255,255,0.22)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
          }}
        >
          {/* Thumb */}
          <div className="absolute rounded-full pointer-events-none" style={{
            width: JOY_THUMB, height: JOY_THUMB,
            background: 'radial-gradient(circle at 35% 35%, #c4b5fd, #7c3aed)',
            border: '2px solid rgba(255,255,255,0.55)',
            boxShadow: '0 0 14px rgba(124,58,237,0.7)',
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
            transition: thumb.x === 0 && thumb.y === 0 ? 'transform 0.15s ease-out' : 'none',
          }} />
        </div>
        {/* Label */}
        <div
          className="text-center text-[10px] font-mono mt-1 tracking-[0.08em]"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >MOVE</div>
      </div>

      {/* ── Action buttons — bottom right ────────────────────────────── */}
      <div className="absolute bottom-9 right-5 flex flex-col items-end gap-[10px] pointer-events-auto touch-none">
        {/* Emote popup */}
        {showEmotes && (
          <div
            className="rounded-xl py-2 px-[10px] backdrop-blur-sm flex gap-2 mb-1"
            style={{
              background: 'rgba(8,6,18,0.80)',
              border: '1px solid rgba(124,58,237,0.30)',
            }}
          >
            {EMOTES.map(em => (
              <button
                key={em.expr}
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); handleEmote(em) }}
                className="w-12 h-12 rounded-[10px] text-2xl cursor-pointer touch-manipulation flex flex-col items-center justify-center gap-0.5"
                style={{
                  background: 'rgba(124,58,237,0.25)',
                  border: '1px solid rgba(124,58,237,0.4)',
                }}
              >
                <span>{em.emoji}</span>
                <span className="text-[8px] text-slate-400">{em.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Button row */}
        <div className="flex gap-[10px] items-center">
          {/* Emote */}
          <ActionBtn
            color="#7c3aed"
            onPress={() => setShowEmotes(v => !v)}
          >
            <span>😊</span>
            <span className="text-[9px] opacity-70">EMOTE</span>
          </ActionBtn>

          {/* F — interact */}
          <ActionBtn
            color="#0ea5e9"
            pressed={pressedF}
            onPress={handleF}
          >
            <span className="text-xl">F</span>
            <span className="text-[9px] opacity-70">TALK</span>
          </ActionBtn>

          {/* E — enter/exit */}
          <ActionBtn
            color="#f59e0b"
            pressed={pressedE}
            onPress={handleE}
          >
            <span className="text-xl">E</span>
            <span className="text-[9px] opacity-70">ENTER</span>
          </ActionBtn>
        </div>
      </div>

      {/* Tap anywhere outside emotes to close the popup */}
      {showEmotes && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{ zIndex: -1 }}
          onPointerDown={() => setShowEmotes(false)}
        />
      )}
    </div>
  )
}
