import { useState, useRef, useEffect } from 'react'
import { gameControls } from '@/lib/gameControls'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { audioSystem } from '@/lib/audioSystem'
import { useMobile } from '@/lib/useMobile'

export const phoneStyle = `
  .ph-scroll::-webkit-scrollbar { display: none; }
  .ph-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
`

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

const BTN_CLS = 'border-0 rounded-full cursor-pointer font-body font-extrabold shrink-0 transition-opacity duration-150 flex items-center justify-center'

const PANEL_STYLE = {
  background: 'linear-gradient(160deg,#0a0a1e 0%,#0d0726 100%)',
  border: '1.5px solid rgba(124,58,237,0.45)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
}

const NPCS = [
  'Anaya', 'Rahul', 'Zoya', 'Kabir', 'Meera', 'Arjun',
  'Priya', 'Dev', 'Nisha', 'Rohan', 'Sana', 'Vivek',
]

const tabCls = (active) =>
  `flex-1 py-2 border-0 cursor-pointer font-body text-[11px] transition-all whitespace-nowrap overflow-hidden ${active ? 'font-extrabold' : 'font-semibold'}`

export default function Phone({
  myId, myName, onlinePlayers = [],
  phoneOpen, onToggle,
  callStatus, callMeta, callElapsed, callCost, lowCoins, callError,
  missedCalls, clearMissed,
  npcSession, npcTyping, npcFreeLeft, micMuted,
  onMakeCall, onAcceptCall, onRejectCall, onEndCall, onToggleMic,
  onCallNPC, onSendNpcMessage,
  onOpenShop,
  playerCoins = 0,
}) {
  const isMobile = useMobile()

  const idlePanelCls = isMobile
    ? 'flex flex-col overflow-hidden font-body fixed bottom-0 left-0 right-0 z-[90] max-h-[75vh] rounded-t-[20px]'
    : 'flex flex-col overflow-hidden font-body fixed z-[90] w-[320px] max-h-[70vh] rounded-[20px]'
  const idlePanelStyle = isMobile
    ? PANEL_STYLE
    : { ...PANEL_STYLE, bottom: 70, left: 16 }

  const npcPanelCls = isMobile
    ? 'flex flex-col overflow-hidden font-body fixed z-[90] -translate-x-1/2 rounded-[20px]'
    : 'flex flex-col overflow-hidden font-body fixed z-[90] w-[320px] rounded-[20px]'
  const npcPanelStyle = isMobile
    ? { ...PANEL_STYLE, bottom: 80, left: '50%', width: 'min(300px, calc(100vw - 32px))' }
    : { ...PANEL_STYLE, bottom: 70, left: 16 }

  const [tab, setTab] = useState('contacts')
  const [npcInput, setNpcInput] = useState('')
  const npcBottomRef = useRef()

  useEffect(() => {
    npcBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [npcSession?.messages])

  const handleNpcFocus = () => { gameControls.enabled = false }
  const handleNpcBlur  = () => { gameControls.enabled = true }

  const sendNpcMsg = () => {
    const t = npcInput.trim()
    if (!t || npcTyping) return
    setNpcInput('')
    onSendNpcMessage(t)
  }

  const inCall = callStatus !== 'idle'

  return (
    <>
      <style>{phoneStyle}</style>

      {callStatus === 'incoming' && (
        <IncomingOverlay meta={callMeta} onAccept={onAcceptCall} onReject={onRejectCall} />
      )}

      {inCall && callStatus !== 'incoming' && (
        <FloatingCallBar
          status={callStatus}
          meta={callMeta}
          elapsed={callElapsed}
          callCost={callCost}
          lowCoins={lowCoins}
          micMuted={micMuted}
          error={callError}
          hasNpc={!!npcSession}
          onEnd={onEndCall}
          onMute={onToggleMic}
          onOpenNpc={onToggle}
          onOpenShop={onOpenShop}
        />
      )}

      {/* NPC chat panel */}
      {callStatus === 'active' && npcSession && phoneOpen && (
        <div className={`${npcPanelCls} p-4 gap-[10px]`} style={npcPanelStyle}>
          <div className="flex justify-between items-center shrink-0">
            <span className="text-violet-400 font-extrabold text-[13px]">{npcSession.name}</span>
            <div className="flex items-center gap-2">
              {npcFreeLeft > 0
                ? <span className="text-green-400 text-[10px]">🆓 {npcFreeLeft} free left</span>
                : <span className="text-yellow-400 text-[10px]">🪙 15/msg</span>
              }
              <button
                onClick={onToggle}
                className={`${BTN_CLS} w-7 h-7 text-base text-slate-600`}
                style={{ background: 'transparent' }}
              >×</button>
            </div>
          </div>
          <div className="ph-scroll flex-1 min-h-0 max-h-[220px] overflow-y-auto flex flex-col gap-[6px]">
            {npcSession.messages.map((m, i) => {
              const isMe = m.role === 'user'
              return (
                <div key={i} className={`flex shrink-0 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="py-[5px] px-[10px] max-w-[82%] text-slate-200 text-[11px] leading-[1.4] break-words"
                    style={{
                      background: isMe ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)',
                      border: '1px solid ' + (isMe ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'),
                      borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                    }}
                  >{m.text}</div>
                </div>
              )
            })}
            {npcTyping && <div className="text-slate-500 text-[10px] pl-[2px]">typing…</div>}
            <div ref={npcBottomRef} />
          </div>
          <div className="flex gap-[6px] shrink-0">
            <input
              value={npcInput}
              onChange={e => setNpcInput(e.target.value)}
              onFocus={handleNpcFocus}
              onBlur={handleNpcBlur}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendNpcMsg() } }}
              placeholder="Say something…"
              maxLength={120}
              className="flex-1 min-w-0 rounded-lg text-slate-200 text-[11px] outline-none font-body"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(124,58,237,0.25)',
                padding: '6px 10px',
              }}
            />
            <button
              onClick={sendNpcMsg}
              disabled={npcTyping}
              className={BTN_CLS}
              style={{ background: 'rgba(124,58,237,0.4)', padding: '6px 12px', fontSize: 11, opacity: npcTyping ? 0.5 : 1 }}
            >Send</button>
          </div>
        </div>
      )}

      {/* Idle phone panel */}
      {callStatus === 'idle' && phoneOpen && (
        <div className={idlePanelCls} style={idlePanelStyle}>
          {/* Status bar */}
          <div
            className="flex justify-between items-center shrink-0"
            style={{ background: 'rgba(124,58,237,0.15)', padding: '10px 16px 8px' }}
          >
            <span className="text-violet-400 text-[11px] font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[90px]">
              {myName}
            </span>
            <span className="text-slate-200 text-[14px] font-extrabold tracking-[1px] shrink-0">
              {fmtHour(timeWeatherState.timeOfDay ?? 12)}
            </span>
            <div className="flex gap-[5px] items-center shrink-0">
              <span className="text-green-400 text-[9px]">●●●</span>
              <span className="text-[10px]">🔋</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['contacts', '👥 Contacts'],
              ['missed', `📵 Missed${missedCalls.length ? ` (${missedCalls.length})` : ''}`],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={tabCls(tab === key)}
                style={{
                  background: tab === key ? 'rgba(124,58,237,0.28)' : 'transparent',
                  color: tab === key ? '#a78bfa' : '#475569',
                  borderBottom: tab === key ? '2px solid #7c3aed' : '2px solid transparent',
                }}
              >{label}</button>
            ))}
          </div>

          <ScrollContent hasMany={(tab === 'contacts' ? 12 + onlinePlayers.length : missedCalls.length) > 5}>
            {tab === 'contacts' && (
              <ContactsList myId={myId} onlinePlayers={onlinePlayers} onCall={onMakeCall} onCallNPC={onCallNPC} />
            )}
            {tab === 'missed' && (
              <MissedList missed={missedCalls} onClear={clearMissed} onCallback={onMakeCall} />
            )}
          </ScrollContent>

          <button
            onClick={onToggle}
            className="border-0 cursor-pointer font-body font-extrabold shrink-0 transition-opacity duration-150 text-[11px] text-slate-500 w-full"
            style={{
              background: 'rgba(255,255,255,0.04)',
              padding: '10px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 0,
            }}
          >Close Phone</button>
        </div>
      )}
    </>
  )
}

function FloatingCallBar({ status, meta, elapsed, callCost, lowCoins, micMuted, error, hasNpc, onEnd, onMute, onOpenNpc, onOpenShop }) {
  const name = meta?.receiverName || meta?.callerName || '?'

  let statusText = ''
  let statusColor = '#64748b'
  if (status === 'outgoing')   { statusText = 'Calling…';     statusColor = '#a78bfa' }
  if (status === 'npc')        { statusText = 'Ringing…';     statusColor = '#a78bfa' }
  if (status === 'connecting') { statusText = 'Connecting…';  statusColor = '#fbbf24' }
  if (status === 'active')     { statusText = fmtTime(elapsed); statusColor = '#4ade80' }
  if (status === 'ended')      { statusText = 'Call ended';   statusColor = '#ef4444' }
  if (error)                   { statusText = error;          statusColor = '#ef4444' }

  const isActive  = status === 'active'
  const isPending = status === 'outgoing' || status === 'npc' || status === 'connecting'
  const isEnded   = status === 'ended'

  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto flex items-center gap-3 font-body min-w-[220px] max-w-[calc(100vw-32px)]"
      style={{
        background: 'linear-gradient(180deg,#0d0726 0%,#0a0a1e 100%)',
        border: '1px solid rgba(124,58,237,0.5)',
        borderTop: 'none',
        borderRadius: '0 0 18px 18px',
        padding: '8px 18px 10px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.15)',
      }}
    >
      <AvatarCircle name={name} size={34} pulse={isPending} />

      <div className="flex-1 min-w-0">
        <div className="text-slate-200 font-extrabold text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
          {name}
        </div>
        <div className="text-[11px] font-semibold" style={{ color: statusColor }}>
          {statusText}
          {status === 'active' && callCost > 0 && (
            <span className="text-yellow-400 ml-[6px]">· 🪙 {callCost} spent</span>
          )}
        </div>
        {lowCoins && status === 'active' && (
          <div className="text-red-500 text-[10px] mt-[1px] flex items-center gap-1">
            ⚠️ Low coins! Call will end soon.
            {onOpenShop && (
              <button
                onClick={onOpenShop}
                className="bg-transparent border-0 text-violet-400 text-[10px] cursor-pointer underline p-0 font-body"
              >Buy coins</button>
            )}
          </div>
        )}
      </div>

      {isActive && hasNpc && (
        <button
          onClick={onOpenNpc}
          className={`${BTN_CLS} w-[34px] h-[34px] text-[14px]`}
          style={{ background: 'rgba(124,58,237,0.3)' }}
          title="Open chat"
        >💬</button>
      )}

      {isActive && !hasNpc && (
        <button
          onClick={onMute}
          className={`${BTN_CLS} w-[38px] h-[38px] text-[17px]`}
          style={{ background: micMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)' }}
          title={micMuted ? 'Unmute' : 'Mute'}
        >{micMuted ? '🔇' : '🎙️'}</button>
      )}

      {!isEnded && (
        <button
          onClick={onEnd}
          className={`${BTN_CLS} w-[42px] h-[42px] text-[18px]`}
          style={{ background: '#ef4444' }}
          title="End call"
        >📵</button>
      )}

      <style>{`
        @keyframes ph-bar-pulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}

function ScrollContent({ children, hasMany }) {
  return (
    <div className="flex-1 min-h-0 relative">
      <div className="ph-scroll h-full overflow-y-auto">{children}</div>
      {hasMany && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[28px] pointer-events-none"
          style={{ background: 'linear-gradient(transparent, rgba(10,10,30,0.85))' }}
        />
      )}
    </div>
  )
}

function AvatarCircle({ name = '?', size = 56, pulse = false }) {
  const letter = name[0]?.toUpperCase() || '?'
  const hue = (name.charCodeAt(0) * 37) % 360
  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold text-white shrink-0"
      style={{
        width: size, height: size, minWidth: size,
        background: `hsl(${hue},60%,28%)`,
        border: `2px solid hsl(${hue},60%,48%)`,
        fontSize: size * 0.38,
        animation: pulse ? 'ph-pulse 1.2s ease-in-out infinite' : 'none',
      }}
    >
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

function ContactsList({ myId, onlinePlayers, onCall, onCallNPC }) {
  const players = onlinePlayers.filter(p => p.uid !== myId)
  return (
    <div className="py-[6px] pb-4">
      {players.length > 0 && (
        <>
          <SectionLabel>ONLINE PLAYERS</SectionLabel>
          {players.map(p => (
            <ContactRow key={p.uid} name={p.name || p.uid} badge="🟢" callCost={10} onCall={() => onCall(p.uid, p.name || p.uid)} />
          ))}
        </>
      )}
      <SectionLabel>CITY RESIDENTS</SectionLabel>
      <div className="max-h-96 pb-10 overflow-auto">
        {NPCS.map(name => (
          <ContactRow key={name} name={name} badge="🤖" callCost={0} onCall={() => onCallNPC(name)} />
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div
      className="text-slate-600 text-[9.5px] font-bold uppercase tracking-[1.2px]"
      style={{ padding: '6px 14px 3px' }}
    >{children}</div>
  )
}

function ContactRow({ name, badge, onCall, callCost }) {
  return (
    <div
      onMouseEnter={() => audioSystem.playUIHover?.()}
      className="flex items-center overflow-hidden transition-[background] duration-[120ms] h-[52px] px-3 hover:bg-[rgba(124,58,237,0.1)]"
    >
      <AvatarCircle name={name} size={34} />
      <div className="flex-1 min-w-0 ml-[10px]">
        <span className="block text-slate-200 text-[13px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
        {callCost > 0 && <span className="text-yellow-400 text-[10px]">🪙 {callCost} coins to call</span>}
        {callCost === 0 && badge === '🤖' && <span className="text-green-400 text-[10px]">Free NPC call</span>}
      </div>
      <span className="text-[10px] mr-[6px] shrink-0">{badge}</span>
      <button
        onClick={onCall}
        onMouseDown={e => e.stopPropagation()}
        className={`${BTN_CLS} w-8 h-8 text-[15px] text-green-400`}
        style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.3)' }}
        title={`Call ${name}`}
      >📞</button>
    </div>
  )
}

function MissedList({ missed, onClear, onCallback }) {
  if (!missed.length) {
    return <div className="text-slate-600 text-[12px] text-center p-7">No missed calls</div>
  }
  return (
    <div className="py-[6px] pb-4">
      {missed.map((m, i) => (
        <div key={i} className="flex items-center overflow-hidden h-[56px] px-3 gap-[10px]">
          <AvatarCircle name={m.name} size={34} />
          <div className="flex-1 min-w-0">
            <div className="text-red-400 font-extrabold text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">{m.name}</div>
            <div className="text-slate-600 text-[10px]">
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {m.id && (
            <button
              onClick={() => onCallback(m.id, m.name)}
              className={`${BTN_CLS} w-[30px] h-[30px] text-[14px] text-green-400`}
              style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.3)' }}
            >📞</button>
          )}
          <button
            onClick={() => onClear(m.id || m.name)}
            className={`${BTN_CLS} w-[26px] h-[26px] text-base text-slate-600`}
            style={{ background: 'transparent' }}
          >×</button>
        </div>
      ))}
    </div>
  )
}

function IncomingOverlay({ meta, onAccept, onReject }) {
  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center gap-[22px] font-body"
      style={{ background: 'rgba(5,2,15,0.93)' }}
    >
      <div className="text-slate-600 text-[13px] tracking-[1px]">Incoming Call</div>
      <AvatarCircle name={meta?.callerName || '?'} size={96} pulse />
      <div className="text-slate-200 font-extrabold text-[24px] overflow-hidden text-ellipsis whitespace-nowrap max-w-[260px]">
        {meta?.callerName}
      </div>
      <div className="flex gap-12 mt-3">
        <CallAction emoji="📵" label="Decline" color="#ef4444" onClick={onReject} />
        <CallAction emoji="📞" label="Accept"  color="#22c55e" onClick={onAccept} />
      </div>
    </div>
  )
}

function CallAction({ emoji, label, color, onClick }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className="w-[68px] h-[68px] rounded-full text-[28px] border-0 cursor-pointer flex items-center justify-center"
        style={{ background: color, boxShadow: `0 4px 20px ${color}66` }}
      >{emoji}</button>
      <span className="text-slate-600 text-[12px]">{label}</span>
    </div>
  )
}

export function PhoneButton({ onClick, callStatus, missedCount, isMobile }) {
  const ringing = callStatus === 'incoming'
  const posStyle = isMobile
    ? { position: 'fixed', bottom: 178, left: 16, zIndex: 80 }
    : { position: 'fixed', bottom: 24, left: 116, zIndex: 80 }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-[6px] font-body text-[13px] font-bold cursor-pointer"
      style={{
        ...posStyle,
        background: ringing ? 'rgba(34,197,94,0.9)' : 'rgba(8,4,20,0.82)',
        border: '1.5px solid ' + (ringing ? '#22c55e' : 'rgba(124,58,237,0.35)'),
        borderRadius: 20, padding: '6px 14px',
        color: '#e2e8f0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        animation: ringing ? 'ph-ring-shake 0.4s ease-in-out infinite' : 'none',
      }}
    >
      📱
      {missedCount > 0 && (
        <span className="bg-red-500 text-white rounded-[10px] text-[10px] font-extrabold px-[5px] py-[1px]">
          {missedCount}
        </span>
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
