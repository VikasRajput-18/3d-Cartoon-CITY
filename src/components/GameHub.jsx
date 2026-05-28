import { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from 'react'
import { gameControls } from '@/lib/gameControls'
import {
  GAME_IDS, GAME_NAMES, GAME_EMOJIS,
  getLeaderboard, getMyStats, getMyChallenges,
  onGameUpdate, submitScore, sendChallenge, resolveChallenge, fetchLeaderboards,
  fetchOnlinePlayers, getDailyStreak, getWinStreak, getMyRank, getAchievements,
  getTickerEvents, ACHIEVEMENTS, RANKS,
} from '@/lib/gameState'
import {
  getTournamentState, onTournamentUpdate, initTournaments,
  joinTournament, submitTournamentScore, fmtCountdown, ENTRY_FEE,
  PRIZE_1ST, PRIZE_2ND, PRIZE_3RD,
} from '@/lib/tournamentState'
import {
  getOpenChallenges, onOpenChallengeUpdate, initOpenChallenges,
  postOpenChallenge, acceptOpenChallenge, settleOpenChallenge,
} from '@/lib/openChallengesState'
import { getEconomyState, onEconomyUpdate, spendCoins, addCoins } from '@/lib/economyState'

const SnakeGame  = lazy(() => import('@/games/SnakeGame'))
const FlappyGame = lazy(() => import('@/games/FlappyGame'))
const TicTacToe  = lazy(() => import('@/games/TicTacToeGame'))
const MemoryGame = lazy(() => import('@/games/MemoryGame'))
const DodgeGame  = lazy(() => import('@/games/DodgeGame'))

const GAME_COMPONENTS = { snake: SnakeGame, flappy: FlappyGame, tictactoe: TicTacToe, memory: MemoryGame, dodge: DodgeGame }
const GAME_DESC = {
  snake: 'Eat food, grow longer. WASD / Arrows.', flappy: 'Tap to fly. Space / Tap.',
  tictactoe: 'Best of 3 vs AI.', memory: '60s to match all 12 pairs.', dodge: 'Dodge falling objects.',
}
const STATION_COLORS = ['#7c3aed','#ec4899','#f59e0b','#10b981','#3b82f6']
const NEON_ZONE = { snake:'#16a34a', flappy:'#38bdf8', memory:'#8b5cf6', dodge:'#ef4444', tictactoe:'#92400e' }

// Power-ups
const POWER_UPS = [
  { id: 'double',  label: 'Double Points',  emoji: '✌️', cost: 20, desc: '2× your final score' },
  { id: 'boost',   label: 'Speed Boost',    emoji: '⚡', cost: 10, desc: '+20% coin bonus' },
  { id: 'shield',  label: 'Lucky Play',     emoji: '🛡', cost: 15, desc: '+50 bonus coins if top 5' },
  { id: 'freeze',  label: 'Score Freeze',   emoji: '❄️', cost: 25, desc: '+5 second grace on result' },
  { id: 'revive',  label: 'Second Chance',  emoji: '💫', cost: 30, desc: 'Free replay on score 0' },
]

function GameLoading() {
  return <div className="flex-1 flex items-center justify-center bg-black text-violet-400 font-body text-base font-bold">Loading…</div>
}

function ScoreRow({ rank, name, score, isMe, extra }) {
  const rc = rank===1?'#facc15':rank===2?'#94a3b8':rank===3?'#b45309':'#475569'
  return (
    <div className="flex items-center gap-2 rounded-lg mb-1"
      style={{ padding:'6px 10px', background: isMe?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.03)', border: isMe?'1px solid rgba(167,139,250,0.3)':'1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[14px] font-extrabold w-[22px] text-center" style={{ color: rc }}>
        {rank===1?'👑':rank===2?'🥈':rank===3?'🥉':rank}
      </span>
      <span className={`flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap ${isMe?'text-violet-400 font-bold':'text-slate-200 font-medium'}`}>{name}</span>
      {extra && <span className="text-slate-500 text-[11px] shrink-0">{extra}</span>}
      <span className="text-yellow-400 text-[13px] font-bold">{score}</span>
    </div>
  )
}

// ── Scrolling ticker ───────────────────────────────────────────────────────────
function Ticker() {
  const [events, setEvents] = useState(getTickerEvents)
  useEffect(() => {
    const h = () => setEvents(getTickerEvents())
    window.addEventListener('ticker-event', h)
    return () => window.removeEventListener('ticker-event', h)
  }, [])
  const text = events.length ? events.map(e => e.text).join('   •   ') : 'Welcome to Game Zone — compete, win, rise!'
  return (
    <div className="shrink-0 overflow-hidden" style={{ background:'rgba(124,58,237,0.12)', borderBottom:'1px solid rgba(124,58,237,0.2)', padding:'5px 0' }}>
      <div className="ticker-wrap">
        <div className="ticker-text text-violet-300 text-[11px] font-bold whitespace-nowrap">{text}</div>
      </div>
      <style>{`.ticker-wrap{overflow:hidden}.ticker-text{display:inline-block;animation:ticker 22s linear infinite}.ticker-text:hover{animation-play-state:paused}@keyframes ticker{0%{transform:translateX(100vw)}100%{transform:translateX(-100%)}}`}</style>
    </div>
  )
}

// ── Countdown timer (re-renders every second) ──────────────────────────────────
function Countdown({ ms, label, color = '#a78bfa' }) {
  const [display, setDisplay] = useState(fmtCountdown(ms))
  useEffect(() => {
    const start = Date.now()
    const iv = setInterval(() => {
      const remaining = ms - (Date.now() - start)
      setDisplay(fmtCountdown(remaining))
      if (remaining <= 0) clearInterval(iv)
    }, 1000)
    return () => clearInterval(iv)
  }, [ms])
  return <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{label} {display}</span>
}

export default function GameHub({ open, onClose, onlinePlayers = [], myUid, myName }) {
  const [view,              setView]              = useState('hub')
  const [activeGame,        setActiveGame]        = useState(null)
  const [gameKey,           setGameKey]           = useState(0)
  const [paused,            setPaused]            = useState(false)
  const [result,            setResult]            = useState(null)
  const [lbGame,            setLbGame]            = useState('snake')
  const [, forceUpdate]                            = useState(0)
  const [challengeGame,     setChallengeGame]     = useState(null)
  const [challengeScore,    setChallengeScore]    = useState(0)
  const [activeChallengeId, setActiveChallengeId] = useState(null)
  const [sending,           setSending]           = useState(false)
  const [sentTo,            setSentTo]            = useState(null)
  const [fetchedPlayers,    setFetchedPlayers]    = useState(null)
  const [loadingPlayers,    setLoadingPlayers]    = useState(false)

  // New state
  const [tourn,             setTourn]             = useState(getTournamentState)
  const [openChalls,        setOpenChalls]        = useState(getOpenChallenges)
  const [eco,               setEco]               = useState(getEconomyState)
  const [activePowerUps,    setActivePowerUps]    = useState([])   // selected before game
  const [openChallId,       setOpenChallId]       = useState(null) // active open-challenge id
  const [hubTab,            setHubTab]            = useState('games')  // games|tournament|wall|fame

  // Post-challenge form state
  const [wallGameId,   setWallGameId]   = useState('snake')
  const [wallStake,    setWallStake]    = useState(50)
  const [wallMsg,      setWallMsg]      = useState('')
  const [wallPosting,  setWallPosting]  = useState(false)

  useEffect(() => onGameUpdate(() => forceUpdate(n => n + 1)), [])
  useEffect(() => onTournamentUpdate(setTourn), [])
  useEffect(() => onOpenChallengeUpdate(setOpenChalls), [])
  useEffect(() => onEconomyUpdate(setEco), [])

  useEffect(() => {
    if (!open || !myUid) return
    initTournaments(myUid)
    initOpenChallenges()
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [open, myUid])

  useEffect(() => {
    if (!open || view !== 'game') return
    const onKey = (e) => { if (e.code === 'Escape') { e.preventDefault(); setPaused(p => !p) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, view])

  useEffect(() => {
    if (view !== 'sendChallenge') return
    setSentTo(null); setFetchedPlayers(null); setLoadingPlayers(true)
    fetchOnlinePlayers(myUid)
      .then(pl => { setFetchedPlayers(pl); setLoadingPlayers(false) })
      .catch(() => { setFetchedPlayers(onlinePlayers.filter(p => p.uid !== myUid)); setLoadingPlayers(false) })
  }, [view, myUid])

  // Countdown tick every second for hub display
  const [, tickSecond] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => tickSecond(n => n + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const startGame = useCallback((id, challengeId = null, _cScore = null, powerUps = [], openChId = null) => {
    // Deduct power-up costs before game starts
    powerUps.forEach(pu => {
      const def = POWER_UPS.find(p => p.id === pu)
      if (def) spendCoins(def.cost)
    })
    setActiveGame(id)
    setActiveChallengeId(challengeId)
    setActivePowerUps(powerUps)
    setOpenChallId(openChId)
    setGameKey(k => k + 1)
    setPaused(false)
    setResult(null)
    setView('game')
  }, [])

  const handleGameEnd = useCallback(async (score) => {
    // Apply power-up effects
    let mult = 1
    if (activePowerUps.includes('double'))  mult = 2

    const res = await submitScore(activeGame, score, mult)

    // Submit to tournament if active + registered
    if (tourn.current?.status === 'active' && tourn.isJoined) {
      await submitTournamentScore(myUid, myName, Math.floor(score * mult))
    }

    // Settle open challenge if any
    if (openChallId) {
      const ch = openChalls.find(c => c.id === openChallId)
      if (ch) {
        const isWinner = Math.floor(score * mult) > (ch.challenger_id === myUid ? 0 : ch.stake_coins)
        await settleOpenChallenge(openChallId, isWinner ? myUid : ch.challenger_id, myName, isWinner)
      }
      setOpenChallId(null)
    }

    // Second-chance power-up: replay once if score is 0
    if (activePowerUps.includes('revive') && score === 0) {
      setActivePowerUps(prev => prev.filter(p => p !== 'revive'))
      setGameKey(k => k + 1); setPaused(false)
      return
    }

    // Lucky play: +50 if top 5
    if (activePowerUps.includes('shield') && res.myRank > 0 && res.myRank <= 5) {
      addCoins(50)
      window.dispatchEvent(new CustomEvent('ticker-event', { detail: { text: `${myName} activated Lucky Play — +50 coins!` } }))
    }

    // Resolve private challenge
    if (activeChallengeId) {
      const cRes = await resolveChallenge(activeChallengeId, Math.floor(score * mult))
      if (cRes) res.challengeResult = cRes
    }

    setResult({ score: Math.floor(score * mult), rawScore: score, powerUpMult: mult, ...res, gameId: activeGame })
    setActivePowerUps([])
    setView('result')
  }, [activeGame, activeChallengeId, activePowerUps, tourn, openChallId, openChalls, myUid, myName])

  const handleSendChallenge = useCallback(async (targetPlayer) => {
    setSending(true)
    const ok = await sendChallenge(targetPlayer.uid, targetPlayer.name, challengeGame, challengeScore)
    setSending(false)
    if (ok) setSentTo(targetPlayer.name)
    setTimeout(() => { setSentTo(null); setView('result') }, 2000)
  }, [challengeGame, challengeScore])

  const playAgain = useCallback(() => {
    setGameKey(k => k + 1); setPaused(false); setResult(null); setView('game')
  }, [])

  if (!open) return null
  const myStats = getMyStats()
  const rank    = getMyRank()
  const dStreak = getDailyStreak()
  const wStreak = getWinStreak()
  const pendingCount = getMyChallenges().filter(c => c.challenged_uid === myUid && c.status === 'pending').length

  // ── View: POWER-UP SELECT ─────────────────────────────────────────────────
  if (view === 'powerUpSelect') {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.88)' }}>
        <div className="w-[360px] rounded-[20px] overflow-hidden" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(124,58,237,0.4)' }}>
          <div className="flex items-center justify-between" style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="text-violet-400 font-extrabold text-[16px]">⚡ Power-Ups</div>
              <div className="text-slate-500 text-[11px]">Select up to 2 · Max 2 per game</div>
            </div>
            <button onClick={() => startGame(activeGame, null, null, [])} className="bg-transparent border-0 text-slate-400 text-[13px] cursor-pointer font-body">Skip →</button>
          </div>
          <div style={{ padding:'12px 14px' }}>
            {POWER_UPS.map(pu => {
              const sel = activePowerUps.includes(pu.id)
              const canSelect = !sel && activePowerUps.length < 2 && eco.coins >= pu.cost
              return (
                <div key={pu.id} onClick={() => {
                  if (sel) setActivePowerUps(prev => prev.filter(p => p !== pu.id))
                  else if (canSelect) setActivePowerUps(prev => [...prev, pu.id])
                }}
                  className="flex items-center gap-3 rounded-xl mb-2 cursor-pointer"
                  style={{ padding:'10px 12px', background: sel?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.04)', border:`1px solid ${sel?'rgba(124,58,237,0.5)':'rgba(255,255,255,0.08)'}`, opacity: (!sel && !canSelect) ? 0.4 : 1 }}>
                  <span className="text-2xl">{pu.emoji}</span>
                  <div className="flex-1">
                    <div className="text-slate-200 text-[13px] font-bold">{pu.label}</div>
                    <div className="text-slate-500 text-[11px]">{pu.desc}</div>
                  </div>
                  <div className="text-yellow-400 text-[12px] font-bold">🪙 {pu.cost}</div>
                  {sel && <div className="text-green-400 text-[12px] font-bold">✓</div>}
                </div>
              )
            })}
            <button
              onClick={() => startGame(activeGame, null, null, activePowerUps)}
              className="w-full mt-2 py-[11px] bg-violet-600 border-0 rounded-xl text-white font-bold text-[15px] cursor-pointer font-body"
            >
              {GAME_EMOJIS[activeGame]} Play {activePowerUps.length > 0 ? `with ${activePowerUps.length} power-up${activePowerUps.length>1?'s':''}` : 'now'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: PLAYING ─────────────────────────────────────────────────────────
  if (view === 'game') {
    const GameComp = GAME_COMPONENTS[activeGame]
    return (
      <div className="fixed inset-0 z-[600] bg-black flex flex-col font-body">
        <div className="shrink-0 flex items-center gap-[10px] min-h-[50px]"
          style={{ padding:'6px 12px', background:'rgba(0,0,0,0.95)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-[22px]">{GAME_EMOJIS[activeGame]}</span>
          <span className="text-white font-extrabold text-base">{GAME_NAMES[activeGame]}</span>
          {activeChallengeId && <span className="bg-red-600 text-white rounded-[6px] text-[11px] font-bold" style={{ padding:'2px 8px' }}>⚔️ CHALLENGE</span>}
          {tourn.current?.status === 'active' && tourn.isJoined && (
            <span className="bg-yellow-600 text-black rounded-[6px] text-[11px] font-bold" style={{ padding:'2px 8px' }}>🏆 TOURNAMENT</span>
          )}
          {activePowerUps.map(pu => <span key={pu} className="text-[16px]">{POWER_UPS.find(p=>p.id===pu)?.emoji}</span>)}
          <div className="flex-1" />
          <button onClick={() => setPaused(p => !p)} className="border-0 rounded-lg text-white cursor-pointer text-[13px] font-semibold min-h-[38px] font-body" style={{ background:'rgba(255,255,255,0.1)', padding:'7px 14px' }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => { setView('hub'); setPaused(false) }} className="rounded-lg cursor-pointer text-red-500 text-[13px] font-semibold min-h-[38px] font-body" style={{ background:'rgba(239,68,68,0.18)', border:'1px solid #ef4444', padding:'7px 12px' }}>✕</button>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={<GameLoading />}>
            <GameComp key={gameKey} paused={paused} onResult={handleGameEnd} />
          </Suspense>
          {paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10" style={{ background:'rgba(0,0,0,0.72)' }}>
              <div className="text-[42px]">⏸</div>
              <div className="text-white text-[26px] font-extrabold">PAUSED</div>
              <button onClick={() => setPaused(false)} className="bg-violet-600 border-0 rounded-[14px] text-white text-[17px] font-bold cursor-pointer min-h-[54px] font-body" style={{ padding:'13px 40px' }}>▶ Resume</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── View: RESULT ──────────────────────────────────────────────────────────
  if (view === 'result' && result) {
    const cr = result.challengeResult
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.92)' }}>
        <div className="rounded-[20px] text-center max-w-[340px] w-[90vw]" style={{ background:'rgba(8,4,20,0.98)', border:`2px solid ${result.isNewBest?'#facc15':'#7c3aed'}`, padding:'28px 32px' }}>
          <div className="text-[48px] mb-[6px]">{result.isGlobalRecord?'🌍':result.isNewBest?'🏆':result.score>0?'⭐':'💀'}</div>
          <div className="text-white text-[22px] font-extrabold mb-1">{GAME_NAMES[result.gameId]}</div>
          {result.isGlobalRecord && <div className="text-yellow-300 font-bold text-[13px] mb-1">🌍 NEW CITY RECORD!</div>}

          <div className="rounded-xl my-3" style={{ background:'rgba(255,255,255,0.04)', padding:'12px 16px' }}>
            <div className="flex justify-between mb-[6px]">
              <span className="text-slate-400 text-[13px]">Your score</span>
              <span className="text-white font-extrabold text-lg">{result.score}{result.powerUpMult>1 && <span className="text-yellow-400 text-[11px] ml-1">×{result.powerUpMult}</span>}</span>
            </div>
            {result.isNewBest && <div className="text-yellow-400 text-[13px] font-bold mb-[6px]">🌟 New Personal Best!</div>}
            {result.myRank > 0 && <div className="flex justify-between mb-[6px]"><span className="text-slate-400 text-[13px]">Your rank</span><span className="text-violet-400 font-bold text-[14px]">#{result.myRank}</span></div>}
            {result.globalBest && <div className="flex justify-between"><span className="text-slate-400 text-[13px]">Global best</span><span className="text-slate-500 text-[13px]">{result.globalBest.score} by {result.globalBest.player_name}</span></div>}
          </div>

          <div className={`text-green-400 text-[15px] font-bold ${result.dailyBonus?'mb-1':'mb-[14px]'}`}>🪙 +{result.coinsEarned} coins!</div>
          {result.dailyBonus > 0 && <div className="text-yellow-300 text-[12px] mb-1">🎁 +{result.dailyBonus} daily bonus!</div>}
          {result.streakMult > 1 && <div className="text-amber-400 text-[12px] mb-[14px]">🔥 {result.dailyStreak}-day streak · {result.streakMult}× multiplier!</div>}
          {result.winStreak >= 3 && <div className="text-orange-400 text-[12px] mb-2">⚡ {result.winStreak}-win streak!</div>}

          {cr && (
            <div className="rounded-[10px] mb-[14px]" style={{ background:cr.won?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${cr.won?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, padding:'10px 14px' }}>
              <div className={`font-extrabold text-[15px] ${cr.won?'text-green-400':'text-red-400'}`}>{cr.won?'🎉 You won!':'😅 You lost!'}</div>
              <div className="text-slate-500 text-[12px] mt-1">Their score: {cr.challengerScore} · Yours: {result.score}</div>
              <div className="text-yellow-400 text-[12px]">+{cr.reward} coins</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={playAgain} className="bg-violet-600 border-0 rounded-xl py-3 text-white font-bold text-[15px] cursor-pointer min-h-[48px] font-body">🔄 Play Again</button>
            {!cr && <button onClick={() => { setChallengeGame(result.gameId); setChallengeScore(result.score); setView('sendChallenge') }} className="rounded-xl py-3 text-pink-300 font-bold text-[15px] cursor-pointer min-h-[48px] font-body border-0" style={{ background:'rgba(236,72,153,0.2)', border:'1px solid rgba(236,72,153,0.4)' }}>⚔️ Challenge a Friend</button>}
            <button onClick={() => setView('leaderboard')} className="rounded-xl py-3 text-yellow-400 font-bold text-[14px] cursor-pointer min-h-[44px] font-body border-0" style={{ background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)' }}>🏆 Leaderboard</button>
            <button onClick={() => setView('hub')} className="rounded-xl py-[10px] text-slate-500 font-semibold text-[14px] cursor-pointer font-body border-0" style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>← Back to Game Zone</button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: SEND CHALLENGE ──────────────────────────────────────────────────
  if (view === 'sendChallenge') {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="rounded-[20px] max-w-[320px] w-[90vw]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(236,72,153,0.4)', padding:'24px 28px' }}>
          <div className="text-pink-300 font-extrabold text-[17px] mb-1">⚔️ Challenge a Friend</div>
          <div className="text-slate-500 text-[12px] mb-4">{GAME_EMOJIS[challengeGame]} {GAME_NAMES[challengeGame]} · Beat score: <strong className="text-white">{challengeScore}</strong></div>
          {sentTo ? <div className="text-green-400 text-center font-bold text-[15px] py-5">✅ Challenge sent to {sentTo}!</div> : (
            <div className="max-h-[280px] overflow-y-auto">
              {loadingPlayers ? <div className="text-slate-600 text-center p-5">Loading…</div>
               : (fetchedPlayers !== null && fetchedPlayers.length === 0) ? <div className="text-slate-600 text-center p-5 text-[13px]">No players online right now.</div>
               : (fetchedPlayers||[]).map(p => (
                  <button key={p.uid} onClick={() => handleSendChallenge(p)} disabled={sending}
                    className="flex items-center gap-[10px] w-full rounded-[10px] mb-[6px] text-slate-200 text-[14px] font-semibold font-body border-0 cursor-pointer"
                    style={{ padding:'10px 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <span>👤</span><span className="flex-1 text-left">{p.name||p.uid?.slice(-6)}</span><span className="text-violet-400 text-[12px]">Challenge →</span>
                  </button>
                ))}
            </div>
          )}
          <button onClick={() => setView('result')} className="mt-3 w-full py-[10px] bg-transparent rounded-[10px] text-slate-500 cursor-pointer text-[14px] font-body border-0" style={{ border:'1px solid rgba(255,255,255,0.1)' }}>← Back</button>
        </div>
      </div>
    )
  }

  // ── View: LEADERBOARD ─────────────────────────────────────────────────────
  if (view === 'leaderboard') {
    const lb = getLeaderboard(lbGame)
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="w-[340px] max-h-[85vh] flex flex-col overflow-hidden rounded-[20px]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(251,191,36,0.35)' }}>
          <div className="flex items-center justify-between" style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-yellow-400 font-extrabold text-[17px]">🏆 Leaderboard</div>
            <button onClick={() => setView(result?'result':'hub')} className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer">✕</button>
          </div>
          <div className="flex overflow-x-auto gap-[6px]" style={{ padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {GAME_IDS.map(gid => (
              <button key={gid} onClick={() => setLbGame(gid)} className="rounded-lg text-[12px] font-bold cursor-pointer whitespace-nowrap font-body border-0"
                style={{ padding:'5px 12px', background: lbGame===gid?'#7c3aed':'rgba(255,255,255,0.06)', color: lbGame===gid?'#fff':'#94a3b8' }}>
                {GAME_EMOJIS[gid]} {GAME_NAMES[gid]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding:'10px 14px' }}>
            {lb.length===0 ? <div className="text-slate-600 text-center p-6 text-[14px]">No scores yet!</div>
             : lb.map((e,i) => <ScoreRow key={e.player_uid} rank={i+1} name={e.player_name} score={e.score} isMe={e.player_uid===myUid} />)}
          </div>
          <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => { setActiveGame(lbGame); setView('powerUpSelect'); setActivePowerUps([]) }} className="w-full py-[11px] bg-violet-600 border-0 rounded-[10px] text-white font-bold text-[15px] cursor-pointer font-body">
              {GAME_EMOJIS[lbGame]} Play {GAME_NAMES[lbGame]}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: CHALLENGES ──────────────────────────────────────────────────────
  if (view === 'challenges') {
    const pending  = getMyChallenges().filter(c => c.challenged_uid===myUid && c.status==='pending')
    const resolved = getMyChallenges().filter(c => c.status!=='pending' && (c.challenged_uid===myUid||c.challenger_uid===myUid))
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="w-[340px] max-h-[85vh] flex flex-col overflow-hidden rounded-[20px]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(124,58,237,0.35)' }}>
          <div className="flex items-center justify-between" style={{ padding:'16px 18px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-violet-400 font-extrabold text-[17px]">⚔️ My Challenges</div>
            <button onClick={() => setView('hub')} className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding:'10px 14px' }}>
            {pending.length>0 && <>
              <div className="text-red-400 text-[12px] font-bold mb-2">INCOMING ({pending.length})</div>
              {pending.map(c => (
                <div key={c.id} className="rounded-[10px] mb-2" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', padding:'10px 12px' }}>
                  <div className="text-pink-300 text-[13px] font-bold">{GAME_EMOJIS[c.game_id]} {c.challenger_name} challenged you!</div>
                  <div className="text-slate-400 text-[12px]">Beat {GAME_NAMES[c.game_id]} · Their score: {c.challenger_score}</div>
                  <button onClick={() => startGame(c.game_id, c.id, c.challenger_score)} className="mt-2 bg-red-600 border-0 rounded-lg text-white font-bold cursor-pointer text-[13px] font-body" style={{ padding:'7px 16px' }}>⚔️ Accept &amp; Play</button>
                </div>
              ))}
            </>}
            {resolved.length>0 && <>
              <div className="text-slate-500 text-[12px] font-bold mb-2 mt-2">COMPLETED</div>
              {resolved.slice(0,6).map(c => {
                const iAm = c.challenged_uid===myUid?'challenged':'challenger'
                const won = (iAm==='challenged'&&c.status==='challenged_won')||(iAm==='challenger'&&c.status==='challenger_won')
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg mb-[5px]" style={{ padding:'8px 10px', background:'rgba(255,255,255,0.03)' }}>
                    <span>{won?'🏆':'💀'}</span>
                    <div className="flex-1 text-[12px]">
                      <div className="text-slate-200">{GAME_EMOJIS[c.game_id]} vs {iAm==='challenged'?c.challenger_name:c.challenged_name}</div>
                      <div className="text-slate-500">{c.challenger_score} vs {c.challenged_score??'?'}</div>
                    </div>
                    <span className={`text-[12px] font-bold ${won?'text-green-400':'text-red-400'}`}>{won?'WON':'LOST'}</span>
                  </div>
                )
              })}
            </>}
            {pending.length===0&&resolved.length===0 && <div className="text-slate-600 text-center p-8 text-[14px]">No challenges yet!</div>}
          </div>
        </div>
      </div>
    )
  }

  // ── View: TOURNAMENT ──────────────────────────────────────────────────────
  if (view === 'tournament') {
    const t     = tourn.current ?? tourn.upcoming
    const gId   = t?.game_id ?? 'snake'
    const isReg = t?.status === 'registering'
    const isAct = t?.status === 'active'
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="w-[360px] max-h-[88vh] flex flex-col overflow-hidden rounded-[20px]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(251,191,36,0.4)' }}>
          <div className="flex items-center justify-between" style={{ padding:'16px 18px 12px', background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(245,158,11,0.15))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="text-yellow-400 font-black text-[17px]">🏆 Tournament</div>
              {t && <div className="text-slate-400 text-[11px] mt-[2px]">{GAME_EMOJIS[gId]} {GAME_NAMES[gId]}</div>}
            </div>
            <button onClick={() => setView('hub')} className="bg-transparent border-0 text-slate-400 text-xl cursor-pointer">✕</button>
          </div>

          {!t ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <div className="text-4xl">⏳</div>
              <div className="text-slate-400 text-[14px] text-center">No tournament scheduled yet.<br/>Open again in a few seconds…</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ padding:'12px 14px' }}>
              {/* Status banner */}
              <div className="rounded-xl mb-3 text-center" style={{ padding:'12px 14px', background: isAct?'rgba(239,68,68,0.1)':isReg?'rgba(251,191,36,0.1)':'rgba(255,255,255,0.04)', border:`1px solid ${isAct?'rgba(239,68,68,0.3)':isReg?'rgba(251,191,36,0.3)':'rgba(255,255,255,0.08)'}` }}>
                <div className="font-extrabold text-[15px]" style={{ color: isAct?'#ef4444':isReg?'#fbbf24':'#94a3b8' }}>
                  {isAct?'🔴 LIVE NOW':isReg?'📋 Register Now':'⏳ Upcoming'}
                </div>
                {tourn.countdownMs != null && (
                  <div className="text-[13px] mt-1" style={{ color: isAct?'#fca5a5':'#fde68a' }}>
                    {isAct?'Ends in: ':isReg?'Starts in: ':'Starts in: '}
                    <span className="font-bold tabular-nums">{fmtCountdown(tourn.countdownMs)}</span>
                  </div>
                )}
              </div>

              {/* Prizes */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[['🥇','1st',t.prize_1st??PRIZE_1ST,'#facc15'],['🥈','2nd',t.prize_2nd??PRIZE_2ND,'#94a3b8'],['🥉','3rd',t.prize_3rd??PRIZE_3RD,'#b45309']].map(([em,lbl,val,c]) => (
                  <div key={lbl} className="text-center rounded-lg" style={{ padding:'8px 4px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-xl">{em}</div>
                    <div className="font-bold text-[13px]" style={{ color:c }}>🪙 {val}</div>
                    <div className="text-slate-500 text-[10px]">{lbl} place</div>
                  </div>
                ))}
              </div>

              {/* Entry fee + join */}
              {isReg && !tourn.isJoined && (
                <button
                  onClick={async () => { const r = await joinTournament(myUid, myName); if (r.ok) { window.dispatchEvent(new CustomEvent('ticker-event',{detail:{text:`${myName} joined the ${GAME_NAMES[r.gameId]} tournament!`}})) } }}
                  className="w-full py-[11px] mb-3 border-0 rounded-xl font-bold text-[15px] cursor-pointer font-body text-black"
                  style={{ background:'linear-gradient(135deg,#facc15,#f59e0b)' }}
                >
                  🏆 Join Tournament · 🪙 {t.entry_fee ?? ENTRY_FEE}
                </button>
              )}
              {tourn.isJoined && isAct && (
                <button
                  onClick={() => { setActiveGame(gId); setActivePowerUps([]); setView('powerUpSelect') }}
                  className="w-full py-[11px] mb-3 border-0 rounded-xl font-bold text-[15px] cursor-pointer font-body text-white"
                  style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow:'0 0 20px rgba(239,68,68,0.4)' }}
                >
                  ▶ Play NOW — Tournament Live!
                </button>
              )}
              {tourn.isJoined && !isAct && (
                <div className="rounded-xl mb-3 text-center text-green-400 font-bold text-[13px]" style={{ padding:'10px', background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)' }}>
                  ✅ Registered! Ready when tournament starts.
                </div>
              )}

              {/* Live leaderboard */}
              {(isAct || tourn.liveScores.length > 0) && (
                <>
                  <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wide mb-2">
                    {isAct?'🔴 Live Scores':'Final Scores'}
                  </div>
                  {tourn.liveScores.length === 0
                    ? <div className="text-slate-600 text-[13px] text-center py-3">No scores yet — be first!</div>
                    : tourn.liveScores.map((s,i) => (
                        <ScoreRow key={s.player_id} rank={i+1} name={s.player_name} score={s.score} isMe={s.player_id===myUid} />
                      ))
                  }
                </>
              )}

              {/* Participants */}
              {(t.participants||[]).length > 0 && (
                <div className="mt-2 text-slate-500 text-[11px]">
                  {(t.participants||[]).length} player{(t.participants||[]).length!==1?'s':''} registered
                  {(t.participants||[]).map(p => <span key={p.id} className="ml-1 text-violet-400">{p.name}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── View: CHALLENGE WALL ──────────────────────────────────────────────────
  if (view === 'wall') {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="w-[380px] max-h-[88vh] flex flex-col overflow-hidden rounded-[20px]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(236,72,153,0.4)' }}>
          <div className="flex items-center justify-between" style={{ padding:'14px 18px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-pink-400 font-black text-[16px]">📋 Challenge Wall</div>
            <button onClick={() => setView('hub')} className="bg-transparent border-0 text-slate-400 text-xl cursor-pointer">✕</button>
          </div>

          {/* Post a challenge */}
          <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(236,72,153,0.05)' }}>
            <div className="text-slate-400 text-[11px] font-bold mb-2">POST A CHALLENGE</div>
            <div className="flex gap-2 mb-2">
              <select value={wallGameId} onChange={e => setWallGameId(e.target.value)}
                className="flex-1 rounded-lg font-body text-[12px] text-slate-200 border-0 outline-none"
                style={{ background:'rgba(255,255,255,0.07)', padding:'6px 8px' }}>
                {GAME_IDS.map(gid => <option key={gid} value={gid}>{GAME_EMOJIS[gid]} {GAME_NAMES[gid]}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 text-[13px]">🪙</span>
                <input type="number" min={10} max={500} value={wallStake} onChange={e => setWallStake(+e.target.value)}
                  className="w-[60px] rounded-lg font-body text-[12px] text-yellow-400 font-bold border-0 outline-none text-center"
                  style={{ background:'rgba(255,255,255,0.07)', padding:'6px 4px' }} />
              </div>
            </div>
            <input type="text" placeholder='e.g. "Beat my 200 score in Snake!"' value={wallMsg}
              onChange={e => setWallMsg(e.target.value.slice(0, 60))}
              className="w-full rounded-lg font-body text-[12px] text-slate-200 border-0 outline-none mb-2"
              style={{ background:'rgba(255,255,255,0.07)', padding:'6px 8px' }} />
            <button
              disabled={wallPosting || wallStake < 10 || eco.coins < wallStake}
              onClick={async () => {
                setWallPosting(true)
                await postOpenChallenge(myUid, myName, wallGameId, wallStake, wallMsg || `${myName} challenges anyone to ${GAME_NAMES[wallGameId]}!`)
                setWallMsg(''); setWallPosting(false)
              }}
              className="w-full py-[8px] border-0 rounded-xl font-bold text-[13px] cursor-pointer font-body text-white disabled:opacity-40"
              style={{ background:'rgba(236,72,153,0.6)' }}>
              {wallPosting?'Posting…':`Post Challenge · 🪙 ${wallStake} stake`}
            </button>
          </div>

          {/* Live challenges */}
          <div className="flex-1 overflow-y-auto" style={{ padding:'10px 14px' }}>
            {openChalls.length === 0
              ? <div className="text-slate-600 text-center py-8 text-[13px]">No open challenges yet!<br/>Post one above to get started.</div>
              : openChalls.map(ch => {
                  const isOwn = ch.challenger_id === myUid
                  return (
                    <div key={ch.id} className="rounded-xl mb-3"
                      style={{ padding:'10px 12px', background: isOwn?'rgba(124,58,237,0.1)':'rgba(255,255,255,0.04)', border:`1px solid ${isOwn?'rgba(124,58,237,0.35)':'rgba(255,255,255,0.08)'}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{GAME_EMOJIS[ch.game_id]}</span>
                        <span className="text-slate-200 font-bold text-[13px] flex-1">{ch.challenger_name}</span>
                        <span className="text-yellow-400 text-[12px] font-bold">🪙 {ch.stake_coins} stake</span>
                        {isOwn && <span className="text-violet-400 text-[10px] font-bold">YOUR</span>}
                      </div>
                      {ch.message && <div className="text-slate-400 text-[11px] italic mb-2">"{ch.message}"</div>}
                      {!isOwn && eco.coins >= ch.stake_coins && (
                        <button
                          onClick={async () => {
                            const r = await acceptOpenChallenge(ch.id, myUid, myName)
                            if (r.ok) { setView('hub'); startGame(r.challenge.game_id, null, null, [], ch.id) }
                          }}
                          className="w-full py-[6px] border-0 rounded-lg font-bold text-[12px] cursor-pointer font-body text-white"
                          style={{ background:'rgba(236,72,153,0.5)' }}>
                          ⚔️ Accept · 🪙 {ch.stake_coins}
                        </button>
                      )}
                    </div>
                  )
                })
            }
          </div>
        </div>
      </div>
    )
  }

  // ── View: HALL OF FAME ────────────────────────────────────────────────────
  if (view === 'fame') {
    return (
      <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
        <div className="w-[380px] max-h-[88vh] flex flex-col overflow-hidden rounded-[20px]" style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(251,191,36,0.5)', boxShadow:'0 0 40px rgba(251,191,36,0.1)' }}>
          <div className="text-center" style={{ padding:'16px 18px 12px', background:'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.1))', borderBottom:'1px solid rgba(251,191,36,0.2)' }}>
            <div className="text-yellow-400 font-black text-[20px]">🏛️ Hall of Fame</div>
            <div className="text-slate-500 text-[11px] mt-1">All-time legends of the Game Zone</div>
          </div>
          <button onClick={() => setView('hub')} className="absolute top-3 right-4 bg-transparent border-0 text-slate-500 text-xl cursor-pointer">✕</button>

          <div className="flex-1 overflow-y-auto" style={{ padding:'12px 14px' }}>
            {GAME_IDS.map((gid, idx) => {
              const lb = getLeaderboard(gid)
              const top = lb[0]
              const color = STATION_COLORS[idx]
              return (
                <div key={gid} className="rounded-xl mb-3" style={{ border:`1px solid ${color}44`, background:`${color}0d`, padding:'10px 12px' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{GAME_EMOJIS[gid]}</span>
                    <span className="font-bold text-[13px]" style={{ color }}>{GAME_NAMES[gid]}</span>
                    {top && <span className="ml-auto text-yellow-400 text-[11px] font-bold">🏆 RECORD: {top.score}</span>}
                  </div>
                  {lb.slice(0,3).map((e,i) => (
                    <div key={e.player_uid} className="flex items-center gap-2 rounded-lg mb-1"
                      style={{ padding:'5px 8px', background: i===0?`${color}22`:'rgba(255,255,255,0.03)', border: i===0?`1px solid ${color}55`:'1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[13px] font-bold w-5 text-center" style={{ color: i===0?'#facc15':i===1?'#94a3b8':'#b45309' }}>
                        {i===0?'👑':i===1?'🥈':'🥉'}
                      </span>
                      <span className={`flex-1 text-[12px] ${e.player_uid===myUid?'text-violet-400 font-bold':'text-slate-300'}`}>{e.player_name}</span>
                      <span className="font-bold text-[13px]" style={{ color: i===0?'#facc15':'#94a3b8' }}>{e.score}</span>
                    </div>
                  ))}
                  {lb.length===0 && <div className="text-slate-600 text-[12px] text-center py-1">No records yet — be the first!</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── View: HUB (main lobby) ────────────────────────────────────────────────
  const t = tourn.current ?? tourn.upcoming
  const tStatus = t?.status
  const isActiveTournament = tStatus === 'active'
  const isRegOpen = tStatus === 'registering'

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background:'rgba(0,0,0,0.88)' }}>
      <div className="w-[400px] max-h-[92vh] flex flex-col overflow-hidden rounded-[24px]"
        style={{ background:'rgba(8,4,20,0.98)', border:'1.5px solid rgba(124,58,237,0.35)', boxShadow:'0 20px 80px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding:'14px 18px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(0,0,0,0))' }}>
          <div>
            <div className="text-violet-400 font-black text-xl flex items-center gap-2">
              🎮 Game Zone
              {/* Rank badge */}
              <span className="text-[11px] font-extrabold rounded-md px-[6px] py-[1px]"
                style={{ background:`${rank.color}22`, color: rank.color, border:`1px solid ${rank.color}55` }}>
                {rank.emoji} {rank.name}
              </span>
            </div>
            <div className="flex gap-3 mt-[3px]">
              {dStreak > 0 && <span className="text-[11px] text-amber-400 font-bold">🔥 {dStreak}-day streak</span>}
              {wStreak.streak >= 3 && <span className="text-[11px] text-orange-400 font-bold">⚡ {wStreak.streak}-win streak</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {pendingCount > 0 && (
              <button onClick={() => setView('challenges')} className="relative rounded-lg text-red-400 font-bold text-[12px] cursor-pointer font-body border-0"
                style={{ background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)', padding:'5px 9px' }}>
                ⚔️ {pendingCount}
              </button>
            )}
            <button onClick={onClose} className="bg-transparent border-0 text-slate-500 text-[22px] cursor-pointer leading-none">✕</button>
          </div>
        </div>

        {/* Ticker */}
        <Ticker />

        {/* Tournament alert banner */}
        {(isActiveTournament || isRegOpen) && (
          <div
            onClick={() => setView('tournament')}
            className="shrink-0 flex items-center gap-2 cursor-pointer"
            style={{ padding:'7px 16px', background: isActiveTournament?'rgba(239,68,68,0.15)':'rgba(251,191,36,0.12)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-[16px]">{isActiveTournament?'🔴':'📋'}</span>
            <span className="flex-1 text-[12px] font-bold" style={{ color: isActiveTournament?'#fca5a5':'#fde68a' }}>
              {isActiveTournament
                ? `LIVE ${GAME_NAMES[t.game_id]} Tournament — ${tourn.isJoined?'You\'re in! Play now →':'Watch live →'}`
                : `${GAME_NAMES[t.game_id]} Tournament open for registration!`}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: isActiveTournament?'#ef4444':'#f59e0b' }}>
              {fmtCountdown(tourn.countdownMs)}
            </span>
          </div>
        )}

        {/* Hub tabs */}
        <div className="flex shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {[['games','🕹 Games'],['tournament','🏆 Tourn'],['wall','📋 Wall'],['fame','🏛 Fame']].map(([id, lbl]) => (
            <button key={id} onClick={() => setHubTab(id)}
              className="flex-1 text-[11px] font-bold py-[8px] cursor-pointer border-0 font-body"
              style={{ background: hubTab===id?'rgba(124,58,237,0.2)':'transparent', color: hubTab===id?'#a78bfa':'#64748b', borderBottom: hubTab===id?'2px solid #7c3aed':'2px solid transparent' }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* My bests row */}
        {myStats && hubTab === 'games' && (
          <div className="flex overflow-x-auto shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {GAME_IDS.map(gid => (
              <div key={gid} className="shrink-0 text-center" style={{ padding:'6px 12px', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-base">{GAME_EMOJIS[gid]}</div>
                <div className="text-yellow-400 text-[11px] font-bold">{myStats[`best_${gid}`]||0}</div>
              </div>
            ))}
            <div className="shrink-0 text-center" style={{ padding:'6px 12px' }}>
              <div className="text-base">🪙</div>
              <div className="text-green-400 text-[11px] font-bold">{myStats.coins_earned_from_games||0}</div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto" style={{ padding:'10px 12px 14px' }}>

          {/* ── Games tab ── */}
          {hubTab === 'games' && (
            <>
              <div className="text-slate-600 text-[11px] font-bold tracking-[1px] mb-[8px]">GAME STATIONS</div>
              {GAME_IDS.map((gid, idx) => {
                const lb     = getLeaderboard(gid)
                const top    = lb[0]
                const myBest = myStats?.[`best_${gid}`] || 0
                const color  = STATION_COLORS[idx]
                const spectators = tourn.liveScores.filter(s => s.player_id !== myUid).length
                return (
                  <div key={gid}
                    onClick={() => { setActiveGame(gid); setActivePowerUps([]); setView('powerUpSelect') }}
                    className="flex items-center gap-3 rounded-xl mb-[7px] cursor-pointer"
                    style={{ padding:'11px 12px', background:'rgba(255,255,255,0.03)', border:`1px solid ${color}33`, borderLeft:`3px solid ${color}` }}
                    onMouseEnter={e => e.currentTarget.style.background=`${color}18`}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                  >
                    <span className="text-[26px] shrink-0">{GAME_EMOJIS[gid]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 text-[13px] font-bold">{GAME_NAMES[gid]}</div>
                      <div className="text-slate-600 text-[10px] mt-[1px]">{GAME_DESC[gid]}</div>
                      <div className="flex gap-3 mt-[3px]">
                        <span className="text-slate-500 text-[10px]">Best: <span className="text-yellow-400">{myBest}</span></span>
                        {top && <span className="text-slate-500 text-[10px]">Global: <span style={{ color }}>{top.score}</span></span>}
                        {spectators > 0 && isActiveTournament && <span className="text-slate-500 text-[10px]">👁 {spectators}</span>}
                      </div>
                    </div>
                    <div className="text-sm shrink-0" style={{ color }}>▶</div>
                  </div>
                )
              })}
            </>
          )}

          {/* ── Tournament tab (inline) ── */}
          {hubTab === 'tournament' && (() => {
            const t2 = tourn.current ?? tourn.upcoming
            if (!t2) return <div className="text-slate-600 text-center py-8">No upcoming tournaments. Check back soon!</div>
            return (
              <>
                <div className="rounded-xl mb-3 text-center" style={{ padding:'12px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)' }}>
                  <div className="text-yellow-400 font-bold text-[14px]">{GAME_EMOJIS[t2.game_id]} {GAME_NAMES[t2.game_id]} Tournament</div>
                  <div className="text-slate-400 text-[12px] mt-1">
                    {t2.status==='active'?'🔴 LIVE':'📋 Registering'} · {fmtCountdown(tourn.countdownMs)} {t2.status==='active'?'remaining':'to start'}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['🥇',`${t2.prize_1st??500}`,'#facc15'],['🥈',`${t2.prize_2nd??200}`,'#94a3b8'],['🥉',`${t2.prize_3rd??100}`,'#b45309']].map(([em,val,c],i) => (
                    <div key={i} className="text-center rounded-lg" style={{ padding:'7px 4px', background:'rgba(255,255,255,0.04)' }}>
                      <div>{em}</div>
                      <div className="font-bold text-[12px]" style={{ color: c }}>🪙{val}</div>
                    </div>
                  ))}
                </div>
                {t2.status==='registering' && !tourn.isJoined && (
                  <button onClick={async () => { const r = await joinTournament(myUid, myName); if (r.ok) forceUpdate(n=>n+1) }}
                    className="w-full py-[11px] mb-3 border-0 rounded-xl font-bold text-[15px] cursor-pointer font-body text-black"
                    style={{ background:'linear-gradient(135deg,#facc15,#f59e0b)' }}>
                    Join · 🪙 {t2.entry_fee??5}
                  </button>
                )}
                {tourn.isJoined && t2.status==='active' && (
                  <button onClick={() => { setActiveGame(t2.game_id); setActivePowerUps([]); setView('powerUpSelect') }}
                    className="w-full py-[11px] mb-3 border-0 rounded-xl font-bold text-[15px] cursor-pointer font-body text-white"
                    style={{ background:'rgba(239,68,68,0.7)' }}>
                    ▶ Play Tournament Game!
                  </button>
                )}
                {tourn.liveScores.length > 0 && <>
                  <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wide mb-2">Live Scores</div>
                  {tourn.liveScores.slice(0,5).map((s,i) => <ScoreRow key={s.player_id} rank={i+1} name={s.player_name} score={s.score} isMe={s.player_id===myUid} />)}
                </>}
                <button onClick={() => setView('tournament')} className="w-full mt-2 py-[8px] border-0 rounded-lg text-violet-400 text-[12px] font-bold cursor-pointer font-body" style={{ background:'rgba(124,58,237,0.1)' }}>
                  Full Tournament View →
                </button>
              </>
            )
          })()}

          {/* ── Wall tab (inline preview) ── */}
          {hubTab === 'wall' && (
            <>
              <div className="flex justify-between items-center mb-2">
                <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">CHALLENGE WALL</div>
                <button onClick={() => setView('wall')} className="text-pink-400 text-[11px] font-bold bg-transparent border-0 cursor-pointer font-body">Post Challenge →</button>
              </div>
              {openChalls.length === 0
                ? <div className="text-slate-600 text-center py-6">No open challenges.<br /><button onClick={() => setView('wall')} className="text-pink-400 bg-transparent border-0 cursor-pointer font-body">Post one!</button></div>
                : openChalls.slice(0, 5).map(ch => (
                    <div key={ch.id} className="rounded-xl mb-2" style={{ padding:'9px 11px', background: ch.challenger_id===myUid?'rgba(124,58,237,0.1)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <span>{GAME_EMOJIS[ch.game_id]}</span>
                        <span className="text-slate-200 text-[12px] font-bold flex-1">{ch.challenger_name}</span>
                        <span className="text-yellow-400 text-[11px] font-bold">🪙{ch.stake_coins}</span>
                      </div>
                      {ch.message && <div className="text-slate-500 text-[10px] mt-1 italic">"{ch.message}"</div>}
                      {ch.challenger_id !== myUid && (
                        <button onClick={async () => {
                          const r = await acceptOpenChallenge(ch.id, myUid, myName)
                          if (r.ok) { setView('hub'); startGame(r.challenge.game_id, null, null, [], ch.id) }
                        }}
                          className="mt-1 border-0 rounded-lg text-white text-[11px] font-bold cursor-pointer font-body" style={{ background:'rgba(236,72,153,0.5)', padding:'4px 10px' }}>
                          ⚔️ Accept
                        </button>
                      )}
                    </div>
                  ))
              }
            </>
          )}

          {/* ── Fame tab (inline top scores) ── */}
          {hubTab === 'fame' && (
            <>
              <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wide mb-2">ALL-TIME RECORDS</div>
              {GAME_IDS.map((gid, idx) => {
                const top = getLeaderboard(gid)[0]
                const color = STATION_COLORS[idx]
                return (
                  <div key={gid} className="flex items-center gap-2 rounded-xl mb-2"
                    style={{ padding:'8px 12px', background:`${color}0d`, border:`1px solid ${color}33` }}>
                    <span className="text-lg">{GAME_EMOJIS[gid]}</span>
                    <div className="flex-1">
                      <div className="font-bold text-[12px]" style={{ color }}>{GAME_NAMES[gid]}</div>
                      {top ? <div className="text-slate-400 text-[11px]">👑 {top.player_name} · {top.score}</div>
                           : <div className="text-slate-600 text-[11px]">No record yet</div>}
                    </div>
                    <span className="text-yellow-400 font-black text-[14px]">{top?.score ?? '—'}</span>
                  </div>
                )
              })}
              <button onClick={() => setView('fame')} className="w-full mt-1 py-[8px] border-0 rounded-lg text-yellow-400 text-[12px] font-bold cursor-pointer font-body" style={{ background:'rgba(251,191,36,0.08)' }}>
                Full Hall of Fame →
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        {myStats && (
          <div className="flex gap-4 justify-center shrink-0" style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-green-400 text-[11px] font-bold">🏆 {myStats.total_wins}W</span>
            <span className="text-red-400 text-[11px] font-bold">💀 {myStats.total_losses}L</span>
            <span className="text-slate-400 text-[11px]">{myStats.total_games} games</span>
            <span className="text-yellow-400 text-[11px] font-bold">🪙 {myStats.coins_earned_from_games} earned</span>
          </div>
        )}
      </div>
    </div>
  )
}
