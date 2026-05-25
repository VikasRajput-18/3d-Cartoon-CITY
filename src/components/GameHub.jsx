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
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#a78bfa', fontFamily: 'Nunito, sans-serif', fontSize: 16, fontWeight: 700 }}>
      Loading game…
    </div>
  )
}

function ScoreRow({ rank, name, score, isMe }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
      background: isMe ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
      borderRadius: 8, marginBottom: 4,
      border: isMe ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ color: rank === 1 ? '#facc15' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#475569', fontSize: 14, fontWeight: 800, width: 22, textAlign: 'center' }}>
        {rank === 1 ? '👑' : rank}
      </span>
      <span style={{ flex: 1, color: isMe ? '#a78bfa' : '#e2e8f0', fontSize: 13, fontWeight: isMe ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <span style={{ color: '#facc15', fontSize: 13, fontWeight: 700 }}>{score}</span>
    </div>
  )
}

export default function GameHub({ open, onClose, onlinePlayers = [], myUid, myName }) {
  const [view,       setView]       = useState('hub')   // hub | game | result | leaderboard | challenges | sendChallenge
  const [activeGame, setActiveGame] = useState(null)
  const [gameKey,    setGameKey]    = useState(0)
  const [paused,     setPaused]     = useState(false)
  const [result,     setResult]     = useState(null)   // { score, isNewBest, coinsEarned, globalBest, myRank }
  const [lbGame,     setLbGame]     = useState('snake')
  const [, forceUpdate]             = useState(0)
  const [challengeGame,  setChallengeGame]  = useState(null)
  const [challengeScore, setChallengeScore] = useState(0)
  const [activeChallengeId, setActiveChallengeId] = useState(null)
  const [sending,       setSending]       = useState(false)
  const [sentTo,        setSentTo]        = useState(null)
  const [fetchedPlayers, setFetchedPlayers] = useState(null)  // null=loading, []+=loaded
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

  // Fetch fresh online players whenever the challenge picker opens
  useEffect(() => {
    if (view !== 'sendChallenge') return
    setSentTo(null)
    setFetchedPlayers(null)
    setLoadingPlayers(true)
    fetchOnlinePlayers(myUid).then(players => {
      setFetchedPlayers(players)
      setLoadingPlayers(false)
    }).catch(() => {
      // Fallback to the prop list
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: '#000', display: 'flex', flexDirection: 'column', fontFamily: 'Nunito, sans-serif' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '6px 12px', background: 'rgba(0,0,0,0.95)', gap: 10, minHeight: 50, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 22 }}>{GAME_EMOJIS[activeGame]}</span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{GAME_NAMES[activeGame]}</span>
          {activeChallengeId && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚔️ CHALLENGE</span>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setPaused(p => !p)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 38 }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => { setView('hub'); setPaused(false) }} style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid #ef4444', borderRadius: 8, padding: '7px 12px', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 38 }}>
            ✕ Exit
          </button>
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Suspense fallback={<GameLoading />}>
            <GameComp key={gameKey} paused={paused} onResult={handleGameEnd} />
          </Suspense>

          {paused && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 10 }}>
              <div style={{ fontSize: 42 }}>⏸</div>
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>PAUSED</div>
              <button onClick={() => setPaused(false)} style={{ background: '#7c3aed', border: 'none', borderRadius: 14, padding: '13px 40px', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', minHeight: 54 }}>
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ background: 'rgba(8,4,20,0.98)', border: `2px solid ${result.isNewBest ? '#facc15' : '#7c3aed'}`, borderRadius: 20, padding: '28px 32px', textAlign: 'center', maxWidth: 340, width: '90vw' }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>{result.isNewBest ? '🏆' : result.score > 0 ? '⭐' : '💀'}</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{GAME_NAMES[result.gameId]}</div>

          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px', margin: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Your score</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{result.score}</span>
            </div>
            {result.isNewBest && (
              <div style={{ color: '#facc15', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🌟 New Personal Best!</div>
            )}
            {result.myRank > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Your rank</span>
                <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 14 }}>#{result.myRank}</span>
              </div>
            )}
            {result.globalBest && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Global best</span>
                <span style={{ color: '#64748b', fontSize: 13 }}>{result.globalBest.score} by {result.globalBest.player_name}</span>
              </div>
            )}
          </div>

          <div style={{ color: '#4ade80', fontSize: 15, fontWeight: 700, marginBottom: result.dailyBonus ? 4 : 14 }}>
            🪙 +{result.coinsEarned} coins earned!
          </div>
          {result.dailyBonus > 0 && (
            <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 14 }}>🎁 +{result.dailyBonus} daily first-game bonus included!</div>
          )}

          {/* Challenge result */}
          {cr && (
            <div style={{ background: cr.won ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: `1px solid ${cr.won ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              <div style={{ color: cr.won ? '#4ade80' : '#f87171', fontWeight: 800, fontSize: 15 }}>
                {cr.won ? '🎉 You won the challenge!' : '😅 You lost the challenge!'}
              </div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Their score: {cr.challengerScore} · Yours: {result.score}
              </div>
              <div style={{ color: '#facc15', fontSize: 12 }}>+{cr.reward} coins</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={playAgain} style={{ background: '#7c3aed', border: 'none', borderRadius: 12, padding: '12px 0', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', minHeight: 48 }}>
              🔄 Play Again
            </button>
            {!cr && (
              <button
                onClick={() => { setChallengeGame(result.gameId); setChallengeScore(result.score); setView('sendChallenge') }}
                style={{ background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.4)', borderRadius: 12, padding: '12px 0', color: '#f9a8d4', fontWeight: 700, fontSize: 15, cursor: 'pointer', minHeight: 48 }}
              >
                ⚔️ Challenge a Friend
              </button>
            )}
            <button onClick={() => setView('leaderboard')} style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, padding: '12px 0', color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 44 }}>
              🏆 View Leaderboard
            </button>
            <button onClick={() => setView('hub')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 0', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
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
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(236,72,153,0.4)', borderRadius: 20, padding: '24px 28px', maxWidth: 320, width: '90vw' }}>
          <div style={{ color: '#f9a8d4', fontWeight: 800, fontSize: 17, marginBottom: 4 }}>⚔️ Challenge a Friend</div>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
            {GAME_EMOJIS[challengeGame]} {GAME_NAMES[challengeGame]} · Beat your score: <strong style={{ color: '#fff' }}>{challengeScore}</strong>
          </div>

          {sentTo ? (
            <div style={{ color: '#4ade80', textAlign: 'center', fontWeight: 700, fontSize: 15, padding: '20px 0' }}>
              ✅ Challenge sent to {sentTo}!
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {loadingPlayers ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: 20 }}>Loading players…</div>
              ) : (fetchedPlayers !== null && fetchedPlayers.length === 0) ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: 20, fontSize: 13, lineHeight: 1.5 }}>
                  No players online right now.<br />Share your score to challenge friends later!
                </div>
              ) : (
                (fetchedPlayers || []).map(p => (
                  <button key={p.uid} onClick={() => handleSendChallenge(p)} disabled={sending} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', marginBottom: 6,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                    cursor: sending ? 'wait' : 'pointer', color: '#e2e8f0', fontSize: 14, fontWeight: 600, fontFamily: 'Nunito, sans-serif',
                  }}>
                    <span style={{ fontSize: 18 }}>👤</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{p.name || p.uid?.slice(-6)}</span>
                    <span style={{ color: '#a78bfa', fontSize: 12 }}>Challenge →</span>
                  </button>
                ))
              )}
            </div>
          )}

          <button onClick={() => setView('result')} style={{ marginTop: 12, width: '100%', padding: '10px 0', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#64748b', cursor: 'pointer', fontSize: 14 }}>
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ── View: LEADERBOARD ────────────────────────────────────────────────────
  if (view === 'leaderboard') {
    const lb = getLeaderboard(lbGame)
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(251,191,36,0.35)', borderRadius: 20, width: 340, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#facc15', fontWeight: 800, fontSize: 17 }}>🏆 Leaderboard</div>
            <button onClick={() => setView(result ? 'result' : 'hub')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Game tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', padding: '8px 12px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {GAME_IDS.map(gid => (
              <button key={gid} onClick={() => setLbGame(gid)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: lbGame === gid ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                border: lbGame === gid ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: lbGame === gid ? '#fff' : '#94a3b8',
              }}>
                {GAME_EMOJIS[gid]} {GAME_NAMES[gid]}
              </button>
            ))}
          </div>

          {/* Scores */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
            {lb.length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: 24, fontSize: 14 }}>No scores yet — be the first!</div>
            ) : (
              lb.map((entry, i) => (
                <ScoreRow key={entry.player_uid} rank={i + 1} name={entry.player_name} score={entry.score} isMe={entry.player_uid === myUid} />
              ))
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={() => startGame(lbGame)} style={{ width: '100%', padding: '11px 0', background: '#7c3aed', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
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
    const sent      = getMyChallenges().filter(c => c.challenger_uid === myUid)
    const resolved  = getMyChallenges().filter(c => c.status !== 'pending' && (c.challenged_uid === myUid || c.challenger_uid === myUid))

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
        <div style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(124,58,237,0.35)', borderRadius: 20, width: 340, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 17 }}>⚔️ Challenges</div>
            <button onClick={() => setView('hub')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
            {pending.length > 0 && (
              <>
                <div style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>INCOMING ({pending.length})</div>
                {pending.map(c => (
                  <div key={c.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ color: '#f9a8d4', fontSize: 13, fontWeight: 700 }}>
                      {GAME_EMOJIS[c.game_id]} {c.challenger_name} challenged you!
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Beat {GAME_NAMES[c.game_id]} · Their score: {c.challenger_score}</div>
                    <button
                      onClick={() => startGame(c.game_id, c.id, c.challenger_score)}
                      style={{ marginTop: 8, padding: '7px 16px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      ⚔️ Accept & Play
                    </button>
                  </div>
                ))}
              </>
            )}

            {resolved.length > 0 && (
              <>
                <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 8 }}>COMPLETED</div>
                {resolved.slice(0, 6).map(c => {
                  const iAm = c.challenged_uid === myUid ? 'challenged' : 'challenger'
                  const won = (iAm === 'challenged' && c.status === 'challenged_won') || (iAm === 'challenger' && c.status === 'challenger_won')
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 16 }}>{won ? '🏆' : '💀'}</span>
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <div style={{ color: '#e2e8f0' }}>{GAME_EMOJIS[c.game_id]} vs {iAm === 'challenged' ? c.challenger_name : c.challenged_name}</div>
                        <div style={{ color: '#64748b' }}>{c.challenger_score} vs {c.challenged_score ?? '?'}</div>
                      </div>
                      <span style={{ color: won ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 700 }}>{won ? 'WON' : 'LOST'}</span>
                    </div>
                  )
                })}
              </>
            )}

            {pending.length === 0 && resolved.length === 0 && (
              <div style={{ color: '#475569', textAlign: 'center', padding: 32, fontSize: 14 }}>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ background: 'rgba(8,4,20,0.98)', border: '1.5px solid rgba(124,58,237,0.35)', borderRadius: 24, width: 380, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 80px rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#a78bfa', fontWeight: 900, fontSize: 20 }}>🎮 Game Zone</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Cartoon Arcade · 5 Quick Games</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <button onClick={() => setView('challenges')} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '6px 10px', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer', position: 'relative' }}>
                ⚔️ {pendingCount}
              </button>
            )}
            <button onClick={() => setView('leaderboard')} style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '6px 10px', color: '#fbbf24', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              🏆 LB
            </button>
            {pendingCount === 0 && (
              <button onClick={() => setView('challenges')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                ⚔️ Challenges
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* My best scores row */}
        {myStats && (
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
            {GAME_IDS.map(gid => (
              <div key={gid} style={{ flex: '0 0 auto', padding: '8px 14px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 16 }}>{GAME_EMOJIS[gid]}</div>
                <div style={{ color: '#facc15', fontSize: 12, fontWeight: 700 }}>{myStats[`best_${gid}`] || 0}</div>
              </div>
            ))}
            <div style={{ flex: '0 0 auto', padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 16 }}>🪙</div>
              <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>{myStats.coins_earned_from_games || 0}</div>
            </div>
          </div>
        )}

        {/* Game stations */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 16px' }}>
          <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>GAME STATIONS</div>
          {GAME_IDS.map((gid, idx) => {
            const lb      = getLeaderboard(gid)
            const top     = lb[0]
            const myBest  = myStats?.[`best_${gid}`] || 0
            const color   = STATION_COLORS[idx]
            return (
              <div
                key={gid}
                onClick={() => startGame(gid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${color}33`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 12, marginBottom: 8, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${color}18`}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{GAME_EMOJIS[gid]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{GAME_NAMES[gid]}</div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{GAME_DESC[gid]}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ color: '#64748b', fontSize: 11 }}>My best: <span style={{ color: '#facc15' }}>{myBest}</span></span>
                    {top && <span style={{ color: '#64748b', fontSize: 11 }}>Global: <span style={{ color: '#a78bfa' }}>{top.score}</span></span>}
                  </div>
                </div>
                <div style={{ color: color, fontSize: 18 }}>▶</div>
              </div>
            )
          })}
        </div>

        {/* Footer: my stats summary */}
        {myStats && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 20, justifyContent: 'center' }}>
            <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>🏆 {myStats.total_wins}W</span>
            <span style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>💀 {myStats.total_losses}L</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{myStats.total_games} games</span>
            <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>🪙 {myStats.coins_earned_from_games} earned</span>
          </div>
        )}
      </div>
    </div>
  )
}
