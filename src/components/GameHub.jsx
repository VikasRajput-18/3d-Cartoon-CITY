import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { gameControls } from '@/lib/gameControls'
import {
  GAME_IDS, GAME_NAMES, GAME_EMOJIS,
  getLeaderboard, getMyStats, getMyChallenges,
  onGameUpdate, submitScore, sendChallenge, resolveChallenge, fetchLeaderboards,
  fetchOnlinePlayers,
} from '@/lib/gameState'

const SnakeGame    = lazy(() => import('@/games/SnakeGame'))
const FlappyGame   = lazy(() => import('@/games/FlappyGame'))
const TicTacToe    = lazy(() => import('@/games/TicTacToeGame'))
const MemoryGame   = lazy(() => import('@/games/MemoryGame'))
const DodgeGame    = lazy(() => import('@/games/DodgeGame'))

const GAME_COMPONENTS = {
  snake: SnakeGame, flappy: FlappyGame, tictactoe: TicTacToe, memory: MemoryGame, dodge: DodgeGame,
}

const GAME_DESC = {
  snake:    'Eat food, grow longer. WASD / Arrows / Swipe.',
  flappy:   'Tap to fly past obstacles. Space / Tap.',
  tictactoe:'Best of 3 vs AI. Easy, Medium or Hard.',
  memory:   '60 seconds to match all 12 card pairs.',
  dodge:    'Dodge falling objects as long as possible.',
}

const STATION_COLORS = ['#7c3aed','#ec4899','#f59e0b','#10b981','#3b82f6']

function GameLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-black text-violet-400 font-body text-base font-bold">
      Loading game…
    </div>
  )
}

function ScoreRow({ rank, name, score, isMe }) {
  const rankColor = rank === 1 ? '#facc15' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#475569'
  return (
    <div
      className="flex items-center gap-2 rounded-lg mb-1"
      style={{
        padding: '6px 10px',
        background: isMe ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
        border: isMe ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span className="text-[14px] font-extrabold w-[22px] text-center" style={{ color: rankColor }}>
        {rank === 1 ? '👑' : rank}
      </span>
      <span className={`flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap ${isMe ? 'text-violet-400 font-bold' : 'text-slate-200 font-medium'}`}>
        {name}
      </span>
      <span className="text-yellow-400 text-[13px] font-bold">{score}</span>
    </div>
  )
}

export default function GameHub({ open, onClose, onlinePlayers = [], myUid, myName }) {
  const [view,       setView]       = useState('hub')
  const [activeGame, setActiveGame] = useState(null)
  const [gameKey,    setGameKey]    = useState(0)
  const [paused,     setPaused]     = useState(false)
  const [result,     setResult]     = useState(null)
  const [lbGame,     setLbGame]     = useState('snake')
  const [, forceUpdate]             = useState(0)
  const [challengeGame,  setChallengeGame]  = useState(null)
  const [challengeScore, setChallengeScore] = useState(0)
  const [activeChallengeId, setActiveChallengeId] = useState(null)
  const [sending,       setSending]       = useState(false)
  const [sentTo,        setSentTo]        = useState(null)
  const [fetchedPlayers, setFetchedPlayers] = useState(null)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  useEffect(() => onGameUpdate(() => forceUpdate(n => n + 1)), [])

  useEffect(() => {
    if (!open) return
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [open])

  useEffect(() => {
    if (!open || view !== 'game') return
    const onKey = (e) => { if (e.code === 'Escape') { e.preventDefault(); setPaused(p => !p) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, view])

  useEffect(() => {
    if (view !== 'sendChallenge') return
    setSentTo(null)
    setFetchedPlayers(null)
    setLoadingPlayers(true)
    fetchOnlinePlayers(myUid).then(players => {
      setFetchedPlayers(players)
      setLoadingPlayers(false)
    }).catch(() => {
      setFetchedPlayers(onlinePlayers.filter(p => p.uid !== myUid))
      setLoadingPlayers(false)
    })
  }, [view, myUid])

  const startGame = useCallback((id, challengeId = null, challengerScore = null) => {
    setActiveGame(id)
    setActiveChallengeId(challengeId)
    setGameKey(k => k + 1)
    setPaused(false)
    setResult(null)
    setView('game')
  }, [])

  const handleGameEnd = useCallback(async (score) => {
    const res = await submitScore(activeGame, score)
    setResult({ score, ...res, gameId: activeGame })
    if (activeChallengeId) {
      const cRes = await resolveChallenge(activeChallengeId, score)
      if (cRes) setResult(prev => ({ ...prev, challengeResult: cRes }))
    }
    setView('result')
  }, [activeGame, activeChallengeId])

  const handleSendChallenge = useCallback(async (targetPlayer) => {
    setSending(true)
    const ok = await sendChallenge(targetPlayer.uid, targetPlayer.name, challengeGame, challengeScore)
    setSending(false)
    if (ok) setSentTo(targetPlayer.name)
    setTimeout(() => { setSentTo(null); setView('result') }, 2000)
  }, [challengeGame, challengeScore])

  const playAgain = useCallback(() => {
    setGameKey(k => k + 1)
    setPaused(false)
    setResult(null)
    setView('game')
  }, [])

  if (!open) return null

  const myStats = getMyStats()

  // ── View: PLAYING ─────────────────────────────────────────────────────────
  if (view === 'game') {
    const GameComp = GAME_COMPONENTS[activeGame]
    return (
      <div className="fixed inset-0 z-[600] bg-black flex flex-col font-body">
        <div
          className="shrink-0 flex items-center gap-[10px] min-h-[50px]"
          style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-[22px]">{GAME_EMOJIS[activeGame]}</span>
          <span className="text-white font-extrabold text-base">{GAME_NAMES[activeGame]}</span>
          {activeChallengeId && (
            <span className="bg-red-600 text-white rounded-[6px] text-[11px] font-bold" style={{ padding: '2px 8px' }}>
              ⚔️ CHALLENGE
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setPaused(p => !p)}
            className="border-0 rounded-lg text-white cursor-pointer text-[13px] font-semibold min-h-[38px] font-body"
            style={{ background: 'rgba(255,255,255,0.1)', padding: '7px 14px' }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => { setView('hub'); setPaused(false) }}
            className="rounded-lg cursor-pointer text-red-500 text-[13px] font-semibold min-h-[38px] font-body"
            style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid #ef4444', padding: '7px 12px' }}
          >
            ✕ Exit
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={<GameLoading />}>
            <GameComp key={gameKey} paused={paused} onResult={handleGameEnd} />
          </Suspense>

          {paused && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10"
              style={{ background: 'rgba(0,0,0,0.72)' }}
            >
              <div className="text-[42px]">⏸</div>
              <div className="text-white text-[26px] font-extrabold">PAUSED</div>
              <button
                onClick={() => setPaused(false)}
                className="bg-violet-600 border-0 rounded-[14px] text-white text-[17px] font-bold cursor-pointer min-h-[54px] font-body"
                style={{ padding: '13px 40px' }}
              >
                ▶ Resume
              </button>
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
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center font-body"
        style={{ background: 'rgba(0,0,0,0.92)' }}
      >
        <div
          className="rounded-[20px] text-center max-w-[340px] w-[90vw]"
          style={{
            background: 'rgba(8,4,20,0.98)',
            border: `2px solid ${result.isNewBest ? '#facc15' : '#7c3aed'}`,
            padding: '28px 32px',
          }}
        >
          <div className="text-[48px] mb-[6px]">{result.isNewBest ? '🏆' : result.score > 0 ? '⭐' : '💀'}</div>
          <div className="text-white text-[22px] font-extrabold mb-1">{GAME_NAMES[result.gameId]}</div>

          <div className="rounded-xl my-3" style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px' }}>
            <div className="flex justify-between mb-[6px]">
              <span className="text-slate-400 text-[13px]">Your score</span>
              <span className="text-white font-extrabold text-lg">{result.score}</span>
            </div>
            {result.isNewBest && (
              <div className="text-yellow-400 text-[13px] font-bold mb-[6px]">🌟 New Personal Best!</div>
            )}
            {result.myRank > 0 && (
              <div className="flex justify-between mb-[6px]">
                <span className="text-slate-400 text-[13px]">Your rank</span>
                <span className="text-violet-400 font-bold text-[14px]">#{result.myRank}</span>
              </div>
            )}
            {result.globalBest && (
              <div className="flex justify-between">
                <span className="text-slate-400 text-[13px]">Global best</span>
                <span className="text-slate-500 text-[13px]">{result.globalBest.score} by {result.globalBest.player_name}</span>
              </div>
            )}
          </div>

          <div className={`text-green-400 text-[15px] font-bold ${result.dailyBonus ? 'mb-1' : 'mb-[14px]'}`}>
            🪙 +{result.coinsEarned} coins earned!
          </div>
          {result.dailyBonus > 0 && (
            <div className="text-yellow-300 text-[12px] mb-[14px]">🎁 +{result.dailyBonus} daily first-game bonus included!</div>
          )}

          {cr && (
            <div
              className="rounded-[10px] mb-[14px]"
              style={{
                background: cr.won ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${cr.won ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                padding: '10px 14px',
              }}
            >
              <div className={`font-extrabold text-[15px] ${cr.won ? 'text-green-400' : 'text-red-400'}`}>
                {cr.won ? '🎉 You won the challenge!' : '😅 You lost the challenge!'}
              </div>
              <div className="text-slate-500 text-[12px] mt-1">
                Their score: {cr.challengerScore} · Yours: {result.score}
              </div>
              <div className="text-yellow-400 text-[12px]">+{cr.reward} coins</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={playAgain}
              className="bg-violet-600 border-0 rounded-xl py-3 text-white font-bold text-[15px] cursor-pointer min-h-[48px] font-body"
            >
              🔄 Play Again
            </button>
            {!cr && (
              <button
                onClick={() => { setChallengeGame(result.gameId); setChallengeScore(result.score); setView('sendChallenge') }}
                className="rounded-xl py-3 text-pink-300 font-bold text-[15px] cursor-pointer min-h-[48px] font-body border-0"
                style={{ background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.4)' }}
              >
                ⚔️ Challenge a Friend
              </button>
            )}
            <button
              onClick={() => setView('leaderboard')}
              className="rounded-xl py-3 text-yellow-400 font-bold text-[14px] cursor-pointer min-h-[44px] font-body border-0"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}
            >
              🏆 View Leaderboard
            </button>
            <button
              onClick={() => setView('hub')}
              className="rounded-xl py-[10px] text-slate-500 font-semibold text-[14px] cursor-pointer font-body border-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ← Back to Game Zone
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: SEND CHALLENGE ─────────────────────────────────────────────────
  if (view === 'sendChallenge') {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center font-body"
        style={{ background: 'rgba(0,0,0,0.88)' }}
      >
        <div
          className="rounded-[20px] max-w-[320px] w-[90vw]"
          style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(236,72,153,0.4)', padding: '24px 28px' }}
        >
          <div className="text-pink-300 font-extrabold text-[17px] mb-1">⚔️ Challenge a Friend</div>
          <div className="text-slate-500 text-[12px] mb-4">
            {GAME_EMOJIS[challengeGame]} {GAME_NAMES[challengeGame]} · Beat your score: <strong className="text-white">{challengeScore}</strong>
          </div>

          {sentTo ? (
            <div className="text-green-400 text-center font-bold text-[15px] py-5">
              ✅ Challenge sent to {sentTo}!
            </div>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              {loadingPlayers ? (
                <div className="text-slate-600 text-center p-5">Loading players…</div>
              ) : (fetchedPlayers !== null && fetchedPlayers.length === 0) ? (
                <div className="text-slate-600 text-center p-5 text-[13px] leading-[1.5]">
                  No players online right now.<br />Share your score to challenge friends later!
                </div>
              ) : (
                (fetchedPlayers || []).map(p => (
                  <button
                    key={p.uid}
                    onClick={() => handleSendChallenge(p)}
                    disabled={sending}
                    className={`flex items-center gap-[10px] w-full rounded-[10px] mb-[6px] text-slate-200 text-[14px] font-semibold font-body border-0 ${sending ? 'cursor-wait' : 'cursor-pointer'}`}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-lg">👤</span>
                    <span className="flex-1 text-left">{p.name || p.uid?.slice(-6)}</span>
                    <span className="text-violet-400 text-[12px]">Challenge →</span>
                  </button>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => setView('result')}
            className="mt-3 w-full py-[10px] bg-transparent rounded-[10px] text-slate-500 cursor-pointer text-[14px] font-body border-0"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >← Back</button>
        </div>
      </div>
    )
  }

  // ── View: LEADERBOARD ────────────────────────────────────────────────────
  if (view === 'leaderboard') {
    const lb = getLeaderboard(lbGame)
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center font-body"
        style={{ background: 'rgba(0,0,0,0.88)' }}
      >
        <div
          className="w-[340px] max-h-[85vh] flex flex-col overflow-hidden rounded-[20px]"
          style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(251,191,36,0.35)' }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-yellow-400 font-extrabold text-[17px]">🏆 Leaderboard</div>
            <button
              onClick={() => setView(result ? 'result' : 'hub')}
              className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer"
            >✕</button>
          </div>

          <div
            className="flex overflow-x-auto gap-[6px]"
            style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {GAME_IDS.map(gid => (
              <button
                key={gid}
                onClick={() => setLbGame(gid)}
                className="rounded-lg text-[12px] font-bold cursor-pointer whitespace-nowrap font-body border-0"
                style={{
                  padding: '5px 12px',
                  background: lbGame === gid ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                  border: lbGame === gid ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: lbGame === gid ? '#fff' : '#94a3b8',
                }}
              >
                {GAME_EMOJIS[gid]} {GAME_NAMES[gid]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: '10px 14px' }}>
            {lb.length === 0 ? (
              <div className="text-slate-600 text-center p-6 text-[14px]">No scores yet — be the first!</div>
            ) : (
              lb.map((entry, i) => (
                <ScoreRow key={entry.player_uid} rank={i + 1} name={entry.player_name} score={entry.score} isMe={entry.player_uid === myUid} />
              ))
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => startGame(lbGame)}
              className="w-full py-[11px] bg-violet-600 border-0 rounded-[10px] text-white font-bold text-[15px] cursor-pointer font-body"
            >
              {GAME_EMOJIS[lbGame]} Play {GAME_NAMES[lbGame]}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── View: CHALLENGES ─────────────────────────────────────────────────────
  if (view === 'challenges') {
    const pending   = getMyChallenges().filter(c => c.challenged_uid === myUid && c.status === 'pending')
    const resolved  = getMyChallenges().filter(c => c.status !== 'pending' && (c.challenged_uid === myUid || c.challenger_uid === myUid))

    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center font-body"
        style={{ background: 'rgba(0,0,0,0.88)' }}
      >
        <div
          className="w-[340px] max-h-[85vh] flex flex-col overflow-hidden rounded-[20px]"
          style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(124,58,237,0.35)' }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-violet-400 font-extrabold text-[17px]">⚔️ Challenges</div>
            <button onClick={() => setView('hub')} className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: '10px 14px' }}>
            {pending.length > 0 && (
              <>
                <div className="text-red-400 text-[12px] font-bold mb-2">INCOMING ({pending.length})</div>
                {pending.map(c => (
                  <div
                    key={c.id}
                    className="rounded-[10px] mb-2"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 12px' }}
                  >
                    <div className="text-pink-300 text-[13px] font-bold">
                      {GAME_EMOJIS[c.game_id]} {c.challenger_name} challenged you!
                    </div>
                    <div className="text-slate-400 text-[12px]">Beat {GAME_NAMES[c.game_id]} · Their score: {c.challenger_score}</div>
                    <button
                      onClick={() => startGame(c.game_id, c.id, c.challenger_score)}
                      className="mt-2 bg-red-600 border-0 rounded-lg text-white font-bold cursor-pointer text-[13px] font-body"
                      style={{ padding: '7px 16px' }}
                    >
                      ⚔️ Accept &amp; Play
                    </button>
                  </div>
                ))}
              </>
            )}

            {resolved.length > 0 && (
              <>
                <div className="text-slate-500 text-[12px] font-bold mb-2 mt-2">COMPLETED</div>
                {resolved.slice(0, 6).map(c => {
                  const iAm = c.challenged_uid === myUid ? 'challenged' : 'challenger'
                  const won = (iAm === 'challenged' && c.status === 'challenged_won') || (iAm === 'challenger' && c.status === 'challenger_won')
                  return (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg mb-[5px]" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-base">{won ? '🏆' : '💀'}</span>
                      <div className="flex-1 text-[12px]">
                        <div className="text-slate-200">{GAME_EMOJIS[c.game_id]} vs {iAm === 'challenged' ? c.challenger_name : c.challenged_name}</div>
                        <div className="text-slate-500">{c.challenger_score} vs {c.challenged_score ?? '?'}</div>
                      </div>
                      <span className={`text-[12px] font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>{won ? 'WON' : 'LOST'}</span>
                    </div>
                  )
                })}
              </>
            )}

            {pending.length === 0 && resolved.length === 0 && (
              <div className="text-slate-600 text-center p-8 text-[14px]">
                No challenges yet!<br />Play a game and challenge friends.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── View: HUB (main lobby) ───────────────────────────────────────────────
  const pendingCount = getMyChallenges().filter(c => c.challenged_uid === myUid && c.status === 'pending').length

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center font-body"
      style={{ background: 'rgba(0,0,0,0.88)' }}
    >
      <div
        className="w-[380px] max-h-[88vh] flex flex-col overflow-hidden rounded-[24px]"
        style={{
          background: 'rgba(8,4,20,0.98)',
          border: '1.5px solid rgba(124,58,237,0.35)',
          boxShadow: '0 20px 80px rgba(0,0,0,0.9)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <div className="text-violet-400 font-black text-xl">🎮 Game Zone</div>
            <div className="text-slate-500 text-[12px] mt-[2px]">Cartoon Arcade · 5 Quick Games</div>
          </div>
          <div className="flex gap-2 items-center">
            {pendingCount > 0 && (
              <button
                onClick={() => setView('challenges')}
                className="relative rounded-lg text-red-400 font-bold text-[12px] cursor-pointer font-body border-0"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', padding: '6px 10px' }}
              >
                ⚔️ {pendingCount}
              </button>
            )}
            <button
              onClick={() => setView('leaderboard')}
              className="rounded-lg text-yellow-400 font-bold text-[12px] cursor-pointer font-body border-0"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', padding: '6px 10px' }}
            >
              🏆 LB
            </button>
            {pendingCount === 0 && (
              <button
                onClick={() => setView('challenges')}
                className="rounded-lg text-slate-400 font-bold text-[12px] cursor-pointer font-body border-0"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px' }}
              >
                ⚔️ Challenges
              </button>
            )}
            <button onClick={onClose} className="bg-transparent border-0 text-slate-500 text-[22px] cursor-pointer leading-none">✕</button>
          </div>
        </div>

        {/* My best scores row */}
        {myStats && (
          <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {GAME_IDS.map(gid => (
              <div key={gid} className="shrink-0 text-center" style={{ padding: '8px 14px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-base">{GAME_EMOJIS[gid]}</div>
                <div className="text-yellow-400 text-[12px] font-bold">{myStats[`best_${gid}`] || 0}</div>
              </div>
            ))}
            <div className="shrink-0 text-center" style={{ padding: '8px 14px' }}>
              <div className="text-base">🪙</div>
              <div className="text-green-400 text-[12px] font-bold">{myStats.coins_earned_from_games || 0}</div>
            </div>
          </div>
        )}

        {/* Game stations */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px 16px' }}>
          <div className="text-slate-600 text-[11px] font-bold tracking-[1px] mb-[10px]">GAME STATIONS</div>
          {GAME_IDS.map((gid, idx) => {
            const lb      = getLeaderboard(gid)
            const top     = lb[0]
            const myBest  = myStats?.[`best_${gid}`] || 0
            const color   = STATION_COLORS[idx]
            return (
              <div
                key={gid}
                onClick={() => startGame(gid)}
                className="flex items-center gap-3 rounded-xl mb-2 cursor-pointer transition-[background] duration-150"
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${color}33`,
                  borderLeft: `3px solid ${color}`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${color}18`}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <span className="text-[28px] shrink-0">{GAME_EMOJIS[gid]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-200 text-[14px] font-bold">{GAME_NAMES[gid]}</div>
                  <div className="text-slate-600 text-[11px] mt-[2px]">{GAME_DESC[gid]}</div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-slate-500 text-[11px]">My best: <span className="text-yellow-400">{myBest}</span></span>
                    {top && <span className="text-slate-500 text-[11px]">Global: <span className="text-violet-400">{top.score}</span></span>}
                  </div>
                </div>
                <div className="text-lg" style={{ color }}>▶</div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {myStats && (
          <div
            className="flex gap-5 justify-center"
            style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-green-400 text-[12px] font-bold">🏆 {myStats.total_wins}W</span>
            <span className="text-red-400 text-[12px] font-bold">💀 {myStats.total_losses}L</span>
            <span className="text-slate-400 text-[12px]">{myStats.total_games} games</span>
            <span className="text-yellow-400 text-[12px] font-bold">🪙 {myStats.coins_earned_from_games} earned</span>
          </div>
        )}
      </div>
    </div>
  )
}
