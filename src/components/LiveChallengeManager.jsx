// Orchestrates the whole live 1v1 flow as a single always-mounted overlay:
// game picker → send/incoming/waiting → 3·2·1 countdown → split-screen arena → result.
import { useEffect, useRef, useState } from 'react'
import { GAME_IDS, GAME_NAMES, GAME_EMOJIS } from '@/lib/gameState'
import { getEconomyState } from '@/lib/economyState'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import {
  onLiveUpdate, sendLiveChallenge, sendNpcChallenge, acceptChallenge,
  declineChallenge, cancelOutgoing, dismissResult, broadcastLiveState,
  setLiveOpponentScore, finishLive,
} from '@/lib/liveChallengeService'
import LiveSnake from '@/games/LiveSnake'

// Only Snake is wired for the LIVE arena so far; others stay selectable for the
// existing async "Send Challenge" (play later) flow.
const LIVE_READY = { snake: true, flappy: false, tictactoe: false, memory: false, dodge: false, cricket: false }
const STAKES = [0, 25, 50, 100]

function useCountdown(targetMs) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!targetMs) return
    const iv = setInterval(() => force(n => n + 1), 250)
    return () => clearInterval(iv)
  }, [targetMs])
  return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
}

export default function LiveChallengeManager() {
  const [live, setLive] = useState({ phase: 'idle' })
  const [picker, setPicker] = useState(null)   // { opponentId, opponentName, isNpc }
  const [pickGame, setPickGame] = useState('snake')
  const [stake, setStake] = useState(0)
  const [count, setCount] = useState(null)       // 3..1, 'GO', null
  const myScoreRef = useRef(0)
  const finishedRef = useRef(false)

  useEffect(() => onLiveUpdate(setLive), [])

  // open the picker from chat
  useEffect(() => {
    const onPick = (e) => {
      if (live.phase !== 'idle') return
      setPicker(e.detail); setPickGame('snake'); setStake(0)
    }
    window.addEventListener('live-challenge-picker', onPick)
    return () => window.removeEventListener('live-challenge-picker', onPick)
  }, [live.phase])

  const overlayOpen = picker || live.phase !== 'idle'

  // take over controls + pause the city while any live UI is on screen
  useEffect(() => {
    if (!overlayOpen) return
    const prev = gameControls.enabled
    gameControls.enabled = false
    window.dispatchEvent(new CustomEvent('minigame-3d', { detail: { active: true } }))
    return () => {
      gameControls.enabled = prev
      window.dispatchEvent(new CustomEvent('minigame-3d', { detail: { active: false } }))
    }
  }, [overlayOpen])

  // run the 3·2·1·GO countdown when a match becomes active
  useEffect(() => {
    if (live.phase !== 'active') { setCount(null); return }
    finishedRef.current = false; myScoreRef.current = 0
    let n = 3
    setCount(n); audioSystem.playClick?.()
    const iv = setInterval(() => {
      n--
      if (n === 0) { setCount('GO'); audioSystem.playSuccess?.() }
      else if (n < 0) { setCount(null); clearInterval(iv) }
      else { setCount(n); audioSystem.playClick?.() }
    }, 800)
    return () => clearInterval(iv)
  }, [live.phase])

  // 60-second match clock
  const remaining = useCountdown(live.phase === 'active' ? live.endsAt : 0)
  useEffect(() => {
    if (live.phase === 'active' && count === null && remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true
      finishLive(myScoreRef.current)
    }
  }, [remaining, live.phase, count])

  if (!overlayOpen) return null

  const eco = getEconomyState()

  // ── Game picker ─────────────────────────────────────────────────────────────
  if (picker && live.phase === 'idle') {
    const canLive = LIVE_READY[pickGame]
    return (
      <Shell>
        <div className="w-[360px] rounded-2xl overflow-hidden" style={panel}>
          <Head title={`Challenge ${picker.opponentName}`} onClose={() => setPicker(null)} />
          <div className="p-4">
            <div className="text-slate-400 text-[11px] font-bold mb-2">PICK A GAME</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {GAME_IDS.map(g => (
                <button key={g} onClick={() => setPickGame(g)}
                  className="rounded-xl py-2 flex flex-col items-center gap-1 cursor-pointer font-body border-0 relative"
                  style={{ background: pickGame === g ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)', border: `1px solid ${pickGame === g ? '#7c3aed' : 'rgba(255,255,255,0.08)'}` }}>
                  <span className="text-2xl">{GAME_EMOJIS[g]}</span>
                  <span className="text-slate-200 text-[11px] font-bold">{GAME_NAMES[g]}</span>
                  {!LIVE_READY[g] && <span className="text-slate-500 text-[8px] absolute top-1 right-1">soon</span>}
                </button>
              ))}
            </div>

            <div className="text-slate-400 text-[11px] font-bold mb-2">STAKE COINS (optional)</div>
            <div className="flex gap-2 mb-4">
              {STAKES.map(s => (
                <button key={s} onClick={() => setStake(s)} disabled={s > eco.coins}
                  className="flex-1 rounded-lg py-2 text-[12px] font-bold cursor-pointer font-body border-0 disabled:opacity-30"
                  style={{ background: stake === s ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.05)', color: stake === s ? '#fde68a' : '#94a3b8', border: `1px solid ${stake === s ? '#f59e0b' : 'rgba(255,255,255,0.08)'}` }}>
                  {s === 0 ? 'None' : `🪙${s}`}
                </button>
              ))}
            </div>

            <div className="text-center text-slate-300 text-[13px] mb-3">
              Challenge <b className="text-white">{picker.opponentName}</b> to <b className="text-violet-300">{GAME_NAMES[pickGame]}</b>?
            </div>

            <button
              disabled={!canLive}
              onClick={() => {
                const r = picker.isNpc
                  ? sendNpcChallenge({ opponentName: picker.opponentName, gameId: pickGame, stake })
                  : null
                if (!picker.isNpc) {
                  sendLiveChallenge({ opponentId: picker.opponentId, opponentName: picker.opponentName, gameId: pickGame, stake })
                    .then(res => { if (!res.ok) alert(res.reason || 'Could not send') })
                } else if (r && !r.ok) { alert(r.reason); return }
                setPicker(null)
              }}
              className="w-full rounded-xl py-3 mb-2 text-white font-extrabold text-[15px] cursor-pointer font-body border-0 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
              ⚡ Live Challenge {canLive ? '(play now together)' : '— Snake only for now'}
            </button>
            <button
              onClick={() => { setPicker(null); window.dispatchEvent(new CustomEvent('open-game-zone')) }}
              className="w-full rounded-xl py-2 text-slate-300 font-bold text-[13px] cursor-pointer font-body"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              📨 Send Challenge (they play later) →
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Incoming (opponent receives) ─────────────────────────────────────────────
  if (live.phase === 'incoming') return <IncomingPopup live={live} />

  // ── Outgoing waiting / NPC accepting ─────────────────────────────────────────
  if (live.phase === 'outgoing' || live.phase === 'npc-accepting') {
    return (
      <Shell>
        <div className="w-[320px] rounded-2xl p-6 text-center" style={panel}>
          <div className="text-4xl mb-3">{GAME_EMOJIS[live.challenge?.game_id] || '🎮'}</div>
          <div className="text-white font-extrabold text-[17px] mb-1">
            {live.phase === 'npc-accepting' ? `${live.challenge?.opponent_name} is getting ready…` : `Waiting for ${live.challenge?.opponent_name}…`}
          </div>
          <div className="text-slate-400 text-[13px] mb-4">
            {GAME_NAMES[live.challenge?.game_id]}{live.stake > 0 ? ` · 🪙${live.stake} stake` : ''}
          </div>
          {live.phase === 'outgoing' && <WaitTimer />}
          <button onClick={() => cancelOutgoing()} className="mt-4 w-full rounded-xl py-2 text-red-300 font-bold text-[13px] cursor-pointer font-body" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            Cancel
          </button>
        </div>
      </Shell>
    )
  }

  if (live.phase === 'declined') {
    return <Shell><div className="rounded-2xl px-8 py-6 text-center" style={panel}><div className="text-3xl mb-2">😔</div><div className="text-slate-200 font-bold">{live.challenge?.opponent_name} declined.</div></div></Shell>
  }

  // ── Active arena (split screen) ──────────────────────────────────────────────
  if (live.phase === 'active') {
    const isNpc = live.challenge?.opponent_id === 'npc'
    const opponentLabel = live.oppName || live.challenge?.opponent_name || 'Opponent'
    const running = count === null
    return (
      <div className="fixed inset-0 z-[760] flex flex-col font-body" style={{ background: '#05030f' }}>
        {/* Top HUD */}
        <div className="shrink-0 flex items-center justify-center gap-5 py-2" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="text-right">
            <div className="text-violet-300 text-[11px] font-bold">YOU</div>
            <div className="text-white text-[26px] font-black leading-none tabular-nums">{live.myScore}</div>
          </div>
          <div className="text-center px-3">
            <div className="text-slate-400 text-[10px] font-bold">TIME</div>
            <div className="text-amber-300 text-[24px] font-black leading-none tabular-nums">{running ? remaining : 60}</div>
            <div className="text-slate-500 text-[9px]">{GAME_NAMES[live.challenge?.game_id]}</div>
          </div>
          <div className="text-left">
            <div className="text-pink-300 text-[11px] font-bold">{opponentLabel}</div>
            <div className="text-white text-[26px] font-black leading-none tabular-nums">{live.opponentScore}</div>
          </div>
        </div>

        {/* Split boards */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="flex-1 relative flex items-center justify-center min-h-0" style={{ borderRight: '2px solid rgba(124,58,237,0.4)' }}>
            <span className="absolute top-1 left-2 text-violet-300 text-[11px] font-bold z-10">YOU</span>
            <div className="w-full h-full max-w-[420px] max-h-[420px] aspect-square p-2">
              <LiveSnake mode="play" running={running} paused={false}
                onState={(st) => broadcastLiveState(st, st.score)}
                onScore={(s) => { myScoreRef.current = s }}
                color="#7c3aed" accent="#a78bfa" />
            </div>
          </div>
          <div className="flex-1 relative flex items-center justify-center min-h-0">
            <span className="absolute top-1 left-2 text-pink-300 text-[11px] font-bold z-10">{opponentLabel}{isNpc ? ' 🤖' : ''}</span>
            <div className="w-full h-full max-w-[420px] max-h-[420px] aspect-square p-2">
              {isNpc
                ? <LiveSnake mode="ai" running={running} paused={false} onScore={setLiveOpponentScore} color="#be185d" accent="#f472b6" />
                : <LiveSnake mode="mirror" state={live.opponentState} color="#be185d" accent="#f472b6" />}
            </div>
          </div>
        </div>

        {/* GO countdown */}
        {count !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div className="text-white font-black" style={{ fontSize: count === 'GO' ? 90 : 120, textShadow: '0 4px 30px rgba(124,58,237,0.8)' }}>{count}</div>
          </div>
        )}

        <div className="shrink-0 text-center text-slate-500 text-[11px] py-1 hidden md:block">WASD / Arrows / Swipe — eat 🍎, most points in 60s wins</div>
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  if (live.phase === 'result' && live.result) {
    const r = live.result
    return (
      <Shell>
        <div className="w-[320px] rounded-2xl p-7 text-center" style={{ ...panel, border: `2px solid ${r.tie ? '#94a3b8' : r.iWon ? '#facc15' : '#ef4444'}` }}>
          <div className="text-5xl mb-2">{r.tie ? '🤝' : r.iWon ? '🏆' : '😤'}</div>
          <div className="font-black text-[24px] mb-1" style={{ color: r.tie ? '#cbd5e1' : r.iWon ? '#facc15' : '#f87171' }}>
            {r.tie ? "IT'S A TIE!" : r.iWon ? 'YOU WIN!' : 'YOU LOSE'}
          </div>
          {r.forfeit && <div className="text-slate-400 text-[12px] mb-1">Opponent left — win by default</div>}
          <div className="flex items-center justify-center gap-4 my-3">
            <div><div className="text-violet-300 text-[11px]">You</div><div className="text-white text-[28px] font-black">{r.myScore}</div></div>
            <div className="text-slate-600 text-xl">vs</div>
            <div><div className="text-pink-300 text-[11px]">Opp</div><div className="text-white text-[28px] font-black">{r.oppScore}</div></div>
          </div>
          <div className={`font-bold text-[15px] mb-4 ${r.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {r.delta >= 0 ? `🪙 +${r.delta} coins` : `🪙 ${r.delta} coins`}
          </div>
          <button onClick={dismissResult} className="w-full rounded-xl py-3 text-white font-extrabold text-[15px] cursor-pointer font-body border-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            Back to City
          </button>
        </div>
      </Shell>
    )
  }

  return null
}

// ── small pieces ───────────────────────────────────────────────────────────────
const panel = { background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(124,58,237,0.4)', boxShadow: '0 20px 80px rgba(0,0,0,0.85)' }
function Shell({ children }) {
  return <div className="fixed inset-0 z-[760] flex items-center justify-center font-body px-4" style={{ background: 'rgba(0,0,0,0.85)' }}>{children}</div>
}
function Head({ title, onClose }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-violet-300 font-extrabold text-[15px]">⚔️ {title}</div>
      <button onClick={onClose} className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer">✕</button>
    </div>
  )
}
function WaitTimer() {
  const [s, setS] = useState(60)
  useEffect(() => { const iv = setInterval(() => setS(v => Math.max(0, v - 1)), 1000); return () => clearInterval(iv) }, [])
  return <div className="text-amber-300 text-[14px] font-bold">⏳ {s}s to accept</div>
}
function IncomingPopup({ live }) {
  const [s, setS] = useState(60)
  useEffect(() => {
    audioSystem.playNotification?.() || audioSystem.playChime?.()
    const iv = setInterval(() => setS(v => Math.max(0, v - 1)), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <Shell>
      <div className="w-[330px] rounded-2xl p-6 text-center" style={{ ...panel, border: '2px solid #ec4899' }}>
        <div className="text-4xl mb-2">{GAME_EMOJIS[live.challenge?.game_id] || '⚔️'}</div>
        <div className="text-white font-extrabold text-[17px] mb-1">{live.challenge?.challenger_name} challenges you!</div>
        <div className="text-slate-400 text-[13px] mb-1">{GAME_NAMES[live.challenge?.game_id]} · Live 1v1{live.stake > 0 ? ` · 🪙${live.stake} stake` : ''}</div>
        <div className="text-amber-300 text-[13px] font-bold mb-4">{s}s to accept</div>
        <div className="flex gap-2">
          <button onClick={declineChallenge} className="flex-1 rounded-xl py-3 text-red-300 font-bold text-[14px] cursor-pointer font-body" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>Decline</button>
          <button onClick={acceptChallenge} className="flex-1 rounded-xl py-3 text-white font-extrabold text-[15px] cursor-pointer font-body border-0" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>Accept ⚡</button>
        </div>
      </div>
    </Shell>
  )
}
