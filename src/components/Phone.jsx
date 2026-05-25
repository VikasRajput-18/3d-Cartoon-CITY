import { useState, useRef, useEffect } from 'react'
import { gameControls } from '@/lib/gameControls'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { audioSystem } from '@/lib/audioSystem'
import { useMobile } from '@/lib/useMobile'

// ── Global scroll-hide style (injected once) ──────────────────────────────────
export const phoneStyle = `
  .ph-scroll::-webkit-scrollbar { display: none; }
  .ph-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
`

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function fmtHour(h) {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60).toString().padStart(2, '0')
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const disp = ((hh % 12) || 12).toString().padStart(2, '0')
  return `${disp}:${mm} ${ampm}`
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const BTN = (bg, color = '#fff') => ({
  border: 'none', borderRadius: 999, cursor: 'pointer',
  fontFamily: 'Nunito, sans-serif', fontWeight: 800,
  color, background: bg, transition: 'opacity 0.15s',
  flexShrink: 0,
})

const TAB_STYLE = (active) => ({
  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
  background: active ? 'rgba(124,58,237,0.28)' : 'transparent',
  color: active ? '#a78bfa' : '#475569',
  fontWeight: active ? 800 : 600, fontSize: 11,
  fontFamily: 'Nunito, sans-serif',
  borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap', overflow: 'hidden',
})

const PANEL_COMMON = {
  background: 'linear-gradient(160deg,#0a0a1e 0%,#0d0726 100%)',
  border: '1.5px solid rgba(124,58,237,0.45)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
  fontFamily: 'Nunito, sans-serif',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}

// NPC list that can be called
const NPCS = [
  'Anaya', 'Rahul', 'Zoya', 'Kabir', 'Meera', 'Arjun',
  'Priya', 'Dev', 'Nisha', 'Rohan', 'Sana', 'Vivek',
]

// ── Panel positioning by device ───────────────────────────────────────────────
function usePanelStyles(isMobile) {
  // Idle phone panel (contacts/missed tabs)
  const idlePanel = isMobile ? {
    ...PANEL_COMMON,
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
    maxHeight: '75vh',
    borderRadius: '20px 20px 0 0',
  } : {
    ...PANEL_COMMON,
    position: 'fixed', bottom: 70, left: 16, zIndex: 90,
    width: 320,
    maxHeight: '70vh',
    borderRadius: 20,
  }

  // Call screens (outgoing / active / npc-ringing)
  const callPanel = isMobile ? {
    ...PANEL_COMMON,
    position: 'fixed',
    bottom: 80, left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 90,
    width: 'min(300px, calc(100vw - 32px))',
    borderRadius: 20,
  } : {
    ...PANEL_COMMON,
    position: 'fixed', bottom: 70, left: 16, zIndex: 90,
    width: 320,
    borderRadius: 20,
  }

  return { idlePanel, callPanel }
}

// ── Main Phone component ──────────────────────────────────────────────────────
export default function Phone({
  myId, myName, onlinePlayers = [],
  phoneOpen, onToggle,
  callStatus, callMeta, callElapsed, missedCalls, clearMissed,
  npcSession, npcTyping, micMuted,
  onMakeCall, onAcceptCall, onRejectCall, onEndCall, onToggleMic,
  onCallNPC, onSendNpcMessage,
}) {
  const isMobile = useMobile()
  const { idlePanel, callPanel } = usePanelStyles(isMobile)

  const [tab, setTab] = useState('contacts')
  const [npcInput, setNpcInput] = useState('')
  const npcBottomRef = useRef()

  useEffect(() => {
    npcBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [npcSession?.messages])

  const handleNpcFocus = () => { gameControls.enabled = false }
  const handleNpcBlur = () => { gameControls.enabled = true }

  const sendNpcMsg = () => {
    const t = npcInput.trim()
    if (!t || npcTyping) return
    setNpcInput('')
    onSendNpcMessage(t)
  }

  // ── Incoming call — full-screen centered overlay ──────────────────────────
  if (callStatus === 'incoming') {
    return <IncomingOverlay meta={callMeta} onAccept={onAcceptCall} onReject={onRejectCall} />
  }

  // ── Outgoing ring ─────────────────────────────────────────────────────────
  if (callStatus === 'outgoing') {
    return (
      <div style={{ ...callPanel, alignItems: 'center', padding: '28px 20px', gap: 16 }}>
        <AvatarCircle name={callMeta?.receiverName} size={68} pulse />
        <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 16, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {callMeta?.receiverName}
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>Calling…</div>
        <button onClick={onEndCall} style={{ ...BTN('#ef4444'), width: 56, height: 56, fontSize: 22, marginTop: 8 }}>📵</button>
      </div>
    )
  }

  // ── NPC ringing (before NPC answers) ─────────────────────────────────────
  if (callStatus === 'npc') {
    return (
      <div style={{ ...callPanel, alignItems: 'center', padding: '28px 20px', gap: 16 }}>
        <AvatarCircle name={callMeta?.receiverName} size={68} pulse />
        <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 16, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {callMeta?.receiverName}
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>Ringing…</div>
        <button onClick={onEndCall} style={{ ...BTN('#ef4444'), width: 56, height: 56, fontSize: 22, marginTop: 8 }}>📵</button>
      </div>
    )
  }

  // ── Active call ───────────────────────────────────────────────────────────
  if (callStatus === 'active') {
    const otherName = callMeta?.receiverName || callMeta?.callerName || '?'
    return (
      <div style={{ ...callPanel, padding: '20px 16px', gap: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <AvatarCircle name={otherName} size={60} />
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
            {otherName}
          </div>
          <div style={{ color: '#4ade80', fontSize: 12 }}>{fmtTime(callElapsed)}</div>
        </div>

        {/* NPC chat messages */}
        {npcSession && (
          <div
            className="ph-scroll"
            style={{
              flex: 1, minHeight: 0, maxHeight: 200, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '0 2px',
            }}
          >
            {npcSession.messages.map((m, i) => {
              const isMe = m.role === 'user'
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
                  <div style={{
                    background: isMe ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid ' + (isMe ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'),
                    borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                    padding: '5px 10px', maxWidth: '82%',
                    color: '#e2e8f0', fontSize: 11, lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>{m.text}</div>
                </div>
              )
            })}
            {npcTyping && <div style={{ color: '#64748b', fontSize: 10, paddingLeft: 2 }}>typing…</div>}
            <div ref={npcBottomRef} />
          </div>
        )}

        {/* NPC input */}
        {npcSession && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              value={npcInput}
              onChange={e => setNpcInput(e.target.value)}
              onFocus={handleNpcFocus}
              onBlur={handleNpcBlur}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendNpcMsg() } }}
              placeholder="Say something…"
              maxLength={120}
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8,
                color: '#e2e8f0', fontSize: 11, padding: '6px 10px',
                fontFamily: 'Nunito, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={sendNpcMsg}
              disabled={npcTyping}
              style={{ ...BTN('rgba(124,58,237,0.4)'), padding: '6px 12px', fontSize: 11, opacity: npcTyping ? 0.5 : 1 }}
            >Send</button>
          </div>
        )}

        {/* Call controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexShrink: 0 }}>
          {!npcSession && (
            <button
              onClick={onToggleMic}
              style={{ ...BTN(micMuted ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'), width: 48, height: 48, fontSize: 20 }}
              title={micMuted ? 'Unmute' : 'Mute'}
            >{micMuted ? '🔇' : '🎙️'}</button>
          )}
          <button onClick={onEndCall} style={{ ...BTN('#ef4444'), width: 56, height: 56, fontSize: 22 }}>📵</button>
        </div>
      </div>
    )
  }

  // ── Idle: phone closed ─────────────────────────────────────────────────────
  if (!phoneOpen) return null

  const hour = timeWeatherState.timeOfDay ?? 12

  return (
    <>
      <style>{phoneStyle}</style>
      <div style={idlePanel}>
        {/* Status bar — fixed height, never scrolls */}
        <div style={{
          background: 'rgba(124,58,237,0.15)',
          padding: '10px 16px 8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            {myName}
          </span>
          <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 800, letterSpacing: 1, flexShrink: 0 }}>
            {fmtHour(hour)}
          </span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#4ade80', fontSize: 9 }}>●●●</span>
            <span style={{ fontSize: 10 }}>🔋</span>
          </div>
        </div>

        {/* Tab bar — fixed height, never scrolls */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {[
            ['contacts', '👥 Contacts'],
            ['missed', `📵 Missed${missedCalls.length ? ` (${missedCalls.length})` : ''}`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={TAB_STYLE(tab === key)}>{label}</button>
          ))}
        </div>

        {/* Scrollable content — flex: 1 so it fills remaining height */}
        <ScrollContent hasMany={(tab === 'contacts' ? 12 + onlinePlayers.length : missedCalls.length) > 5}>
          {tab === 'contacts' && (
            <ContactsList myId={myId} onlinePlayers={onlinePlayers} onCall={onMakeCall} onCallNPC={onCallNPC} />
          )}
          {tab === 'missed' && (
            <MissedList missed={missedCalls} onClear={clearMissed} onCallback={onMakeCall} />
          )}
        </ScrollContent>

        {/* Close button — fixed at bottom, never scrolls */}
        <button
          onClick={onToggle}
          style={{
            ...BTN('rgba(255,255,255,0.04)'),
            padding: '10px 16px', fontSize: 11, color: '#64748b',
            borderTop: '1px solid rgba(255,255,255,0.06)', borderRadius: 0,
            flexShrink: 0, width: '100%',
          }}
          className='z-50'
        >Close Phone</button>
      </div>
    </>
  )
}

// ── Scrollable content wrapper with fade hint ─────────────────────────────────
function ScrollContent({ children, hasMany }) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div
        className="ph-scroll"
        style={{ height: '100%', overflowY: 'auto' }}
      >
        {children}
      </div>
      {/* Fade gradient hinting more content below */}
      {hasMany && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
          background: 'linear-gradient(transparent, rgba(10,10,30,0.85))',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

// ── AvatarCircle ──────────────────────────────────────────────────────────────
function AvatarCircle({ name = '?', size = 56, pulse = false }) {
  const letter = name[0]?.toUpperCase() || '?'
  const hue = (name.charCodeAt(0) * 37) % 360
  return (
    <div style={{
      width: size, height: size, minWidth: size, borderRadius: '50%',
      background: `hsl(${hue},60%,28%)`,
      border: `2px solid hsl(${hue},60%,48%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800, color: '#fff', flexShrink: 0,
      animation: pulse ? 'ph-pulse 1.2s ease-in-out infinite' : 'none',
    }}>
      {letter}
      <style>{`
        @keyframes ph-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.55); }
          50%      { box-shadow: 0 0 0 14px rgba(124,58,237,0); }
        }
      `}</style>
    </div>
  )
}

// ── ContactsList ──────────────────────────────────────────────────────────────
function ContactsList({ myId, onlinePlayers, onCall, onCallNPC }) {
  const players = onlinePlayers.filter(p => p.uid !== myId)
  return (
    <div style={{ padding: '6px 0 16px' }}>
      {players.length > 0 && (
        <>
          <SectionLabel>ONLINE PLAYERS</SectionLabel>
          {players.map(p => (
            <ContactRow key={p.uid} name={p.name || p.uid} badge="🟢" onCall={() => onCall(p.uid, p.name || p.uid)} />
          ))}
        </>
      )}
      <SectionLabel>CITY RESIDENTS</SectionLabel>
      <div className="max-h-96 pb-10 overflow-auto">
        {NPCS.map(name => (
          <ContactRow key={name} name={name} badge="🤖" onCall={() => onCallNPC(name)} />
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      color: '#475569', fontSize: 9.5, padding: '6px 14px 3px',
      fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
    }}>{children}</div>
  )
}

// ── ContactRow — fixed 52px height, text truncated ───────────────────────────
function ContactRow({ name, badge, onCall }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => { setHover(true); audioSystem.playUIHover?.() }}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 52, display: 'flex', alignItems: 'center',
        padding: '0 12px',
        background: hover ? 'rgba(124,58,237,0.1)' : 'transparent',
        transition: 'background 0.12s',
        overflow: 'hidden',
      }}
    >
      <AvatarCircle name={name} size={34} />
      <span style={{
        flex: 1, minWidth: 0,
        color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginLeft: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </span>
      <span style={{ fontSize: 10, marginRight: 6, flexShrink: 0 }}>{badge}</span>
      <button
        onClick={onCall}
        onMouseDown={e => e.stopPropagation()}
        style={{
          ...BTN('rgba(74,222,128,0.18)'),
          width: 32, height: 32, fontSize: 15, color: '#4ade80',
          border: '1px solid rgba(74,222,128,0.3)',
        }}
        title={`Call ${name}`}
      >📞</button>
    </div>
  )
}

// ── MissedList ────────────────────────────────────────────────────────────────
function MissedList({ missed, onClear, onCallback }) {
  if (!missed.length) {
    return <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: 28 }}>No missed calls</div>
  }
  return (
    <div style={{ padding: '6px 0 16px' }}>
      {missed.map((m, i) => (
        <div key={i} style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 10, overflow: 'hidden',
        }}>
          <AvatarCircle name={m.name} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f87171', fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </div>
            <div style={{ color: '#475569', fontSize: 10 }}>
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {m.id && (
            <button
              onClick={() => onCallback(m.id, m.name)}
              style={{ ...BTN('rgba(74,222,128,0.18)'), width: 30, height: 30, fontSize: 14, color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
            >📞</button>
          )}
          <button
            onClick={() => onClear(m.id || m.name)}
            style={{ ...BTN('transparent'), width: 26, height: 26, fontSize: 16, color: '#475569' }}
          >×</button>
        </div>
      ))}
    </div>
  )
}

// ── Incoming call — centered overlay above all UI ─────────────────────────────
function IncomingOverlay({ meta, onAccept, onReject }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(5,2,15,0.93)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 22,
      fontFamily: 'Nunito, sans-serif',
    }}>
      <div style={{ color: '#64748b', fontSize: 13, letterSpacing: 1 }}>Incoming Call</div>
      <AvatarCircle name={meta?.callerName || '?'} size={96} pulse />
      <div style={{
        color: '#e2e8f0', fontWeight: 800, fontSize: 24,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: 260,
      }}>{meta?.callerName}</div>
      <div style={{ display: 'flex', gap: 48, marginTop: 12 }}>
        <CallAction emoji="📵" label="Decline" color="#ef4444" onClick={onReject} />
        <CallAction emoji="📞" label="Accept" color="#22c55e" onClick={onAccept} />
      </div>
    </div>
  )
}

function CallAction({ emoji, label, color, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          width: 68, height: 68, borderRadius: '50%', fontSize: 28,
          background: color, border: 'none', cursor: 'pointer',
          boxShadow: `0 4px 20px ${color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >{emoji}</button>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
    </div>
  )
}

// ── Phone toggle button ────────────────────────────────────────────────────────
// Desktop: bottom left, right of GlobalChat button (~110px from left)
// Mobile:  above the joystick (joystick top ≈ bottom:164px, so button at bottom:170)
export function PhoneButton({ onClick, callStatus, missedCount, isMobile }) {
  const ringing = callStatus === 'incoming'
  const style = isMobile ? {
    position: 'fixed', bottom: 178, left: 16, zIndex: 80,
  } : {
    position: 'fixed', bottom: 24, left: 116, zIndex: 80,
  }

  return (
    <button
      onClick={onClick}
      style={{
        ...style,
        background: ringing ? 'rgba(34,197,94,0.9)' : 'rgba(8,4,20,0.82)',
        border: '1.5px solid ' + (ringing ? '#22c55e' : 'rgba(124,58,237,0.35)'),
        borderRadius: 20, padding: '6px 14px',
        color: '#e2e8f0', fontFamily: 'Nunito, sans-serif',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        animation: ringing ? 'ph-ring-shake 0.4s ease-in-out infinite' : 'none',
      }}
    >
      📱
      {missedCount > 0 && (
        <span style={{
          background: '#ef4444', color: '#fff', borderRadius: 10,
          fontSize: 10, fontWeight: 800, padding: '1px 5px',
        }}>{missedCount}</span>
      )}
      <style>{`
        @keyframes ph-ring-shake {
          0%,100% { transform: rotate(0deg); }
          25%      { transform: rotate(-9deg); }
          75%      { transform: rotate(9deg); }
        }
      `}</style>
    </button>
  )
}
