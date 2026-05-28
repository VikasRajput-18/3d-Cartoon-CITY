import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import { GAME_DEFS } from './index'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import { spendTicket, getEconomyState } from '@/lib/economyState'
import { COSTS } from '@/lib/costs'

const RacingGame   = lazy(() => import('./RacingGame'))
const ShootingGame = lazy(() => import('./ShootingGame'))
const RunnerGame   = lazy(() => import('./RunnerGame'))
const FootballGame = lazy(() => import('./FootballGame'))
const FishingGame  = lazy(() => import('./FishingGame'))

const COMPONENTS = { racing: RacingGame, shooting: ShootingGame, runner: RunnerGame, football: FootballGame, fishing: FishingGame }

function GameLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black text-violet-400 font-body text-base font-bold">
      Loading game…
    </div>
  )
}

export default function GameRunner({ gameId, onClose }) {
  const addCoins = useStore(s => s.addCoins)
  const def      = GAME_DEFS[gameId]
  const GameComp = COMPONENTS[gameId]

  const [result,       setResult]       = useState(null)
  const [paused,       setPaused]       = useState(false)
  const [gameKey,      setGameKey]      = useState(0)
  const [ticketError,  setTicketError]  = useState(null)

  useEffect(() => {
    gameControls.enabled = false
    const eco = getEconomyState()
    if (eco.tickets < COSTS.playGame) {
      setTicketError(`Need ${COSTS.playGame} tickets to play. You have ${eco.tickets}.`)
    } else {
      spendTicket()
      if (COSTS.playGame >= 2) spendTicket()
    }
    return () => { gameControls.enabled = true }
  }, [])

  useEffect(() => {
    const onKey = e => { if (e.code === 'Escape' && !result) setPaused(p => !p) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result])

  const handleResult = (win) => {
    const coins = win ? def.coins : 0
    if (win && coins > 0) addCoins(coins)
    setResult({ win, coins })
    audioSystem.playNotification()
  }

  const playAgain = () => {
    setResult(null)
    setPaused(false)
    setGameKey(k => k + 1)
  }

  if (ticketError) {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center font-body"
        style={{ background: 'rgba(0,0,0,0.9)' }}
      >
        <div
          className="rounded-[20px] text-center max-w-[88vw]"
          style={{ background: 'rgba(15,10,30,0.97)', border: '2px solid #ef4444', padding: '28px 36px' }}
        >
          <div className="text-[44px]">🎟️</div>
          <div className="text-red-400 text-xl font-extrabold mt-2">Not enough tickets</div>
          <div className="text-slate-400 text-[14px] mt-2">{ticketError}</div>
          <div className="text-slate-500 text-[12px] mt-[6px]">Tickets refill every 2 hours, or log in daily for a bonus.</div>
          <button
            onClick={onClose}
            className="mt-5 bg-violet-600 border-0 rounded-[10px] text-white font-bold text-[15px] cursor-pointer font-body"
            style={{ padding: '12px 32px' }}
          >OK</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col font-body">
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-[10px] min-h-[50px]"
        style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-xl">{def.emoji}</span>
        <span className="text-white font-bold text-[15px]">{def.label}</span>
        <div className="flex-1" />
        <button
          onClick={() => setPaused(p => !p)}
          className="border-0 rounded-lg text-white cursor-pointer text-[14px] font-semibold min-w-[80px] min-h-[40px] font-body"
          style={{ background: 'rgba(255,255,255,0.12)', padding: '8px 16px' }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg cursor-pointer text-red-500 text-[14px] font-semibold min-h-[40px] font-body"
          style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid #ef4444', padding: '8px 14px' }}
        >
          ✕ Exit
        </button>
      </div>

      {/* Game area */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={<GameLoading />}>
          <GameComp key={gameKey} paused={paused} onResult={handleResult} />
        </Suspense>

        {/* Pause overlay */}
        {paused && !result && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10"
            style={{ background: 'rgba(0,0,0,0.72)' }}
          >
            <div className="text-[40px]">⏸</div>
            <div className="text-white text-[28px] font-extrabold">PAUSED</div>
            <button
              onClick={() => setPaused(false)}
              className="bg-violet-600 border-0 rounded-[14px] text-white text-[18px] font-bold cursor-pointer min-h-[56px] font-body"
              style={{ padding: '14px 44px' }}
            >
              ▶ Resume
            </button>
          </div>
        )}

        {/* Result overlay */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center z-20"
              style={{ background: 'rgba(0,0,0,0.85)' }}
            >
              <div
                className="rounded-[20px] text-center max-w-[88vw]"
                style={{
                  background: 'rgba(15,10,30,0.97)',
                  border: `2px solid ${result.win ? '#22c55e' : '#ef4444'}`,
                  padding: '28px 36px',
                }}
              >
                <div className="text-[54px]">{result.win ? '🏆' : '💀'}</div>
                <div
                  className="text-[26px] font-extrabold mt-2"
                  style={{ color: result.win ? '#22c55e' : '#ef4444' }}
                >
                  {result.win ? 'You Win!' : 'Game Over'}
                </div>
                <div className="text-yellow-400 text-xl mt-[10px] font-bold">
                  {result.win ? `+${result.coins} coins earned!` : 'Better luck next time!'}
                </div>
                <div className="flex gap-3 mt-6 justify-center flex-wrap">
                  <button
                    onClick={playAgain}
                    className="bg-violet-600 border-0 rounded-xl text-white font-bold text-base cursor-pointer min-h-[52px] font-body"
                    style={{ padding: '13px 30px' }}
                  >
                    🔄 Play Again
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-xl text-slate-400 text-base cursor-pointer min-h-[52px] font-body border-0"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', padding: '13px 30px' }}
                  >
                    Exit
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
