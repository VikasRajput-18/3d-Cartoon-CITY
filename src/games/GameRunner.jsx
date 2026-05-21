import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import { GAME_DEFS } from './index'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import RacingGame   from './RacingGame'
import ShootingGame from './ShootingGame'
import RunnerGame   from './RunnerGame'
import FootballGame from './FootballGame'
import FishingGame  from './FishingGame'

const COMPONENTS = { racing: RacingGame, shooting: ShootingGame, runner: RunnerGame, football: FootballGame, fishing: FishingGame }

export default function GameRunner({ gameId, onClose }) {
  const addCoins = useStore(s => s.addCoins)
  const def      = GAME_DEFS[gameId]
  const GameComp = COMPONENTS[gameId]

  const [result,  setResult]  = useState(null)
  const [paused,  setPaused]  = useState(false)
  const [gameKey, setGameKey] = useState(0)

  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Escape = toggle pause (desktop)
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: '#000', display: 'flex', flexDirection: 'column',
      fontFamily: 'Nunito, sans-serif',
    }}>
      {/* Header — always visible */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '6px 12px', background: 'rgba(0,0,0,0.95)',
        gap: 10, minHeight: 50, borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ fontSize: 20 }}>{def.emoji}</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{def.label}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setPaused(p => !p)}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
            padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            minWidth: 80, minHeight: 40,
          }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(239,68,68,0.18)', border: '1px solid #ef4444', borderRadius: 8,
            padding: '8px 14px', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            minHeight: 40,
          }}
        >
          ✕ Exit
        </button>
      </div>

      {/* Game area fills remaining screen */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <GameComp key={gameKey} paused={paused} onResult={handleResult} />

        {/* Pause overlay */}
        {paused && !result && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
            zIndex: 10,
          }}>
            <div style={{ fontSize: 40 }}>⏸</div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 800 }}>PAUSED</div>
            <button
              onClick={() => setPaused(false)}
              style={{
                background: '#7c3aed', border: 'none', borderRadius: 14,
                padding: '14px 44px', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', minHeight: 56,
              }}
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
              style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
              }}
            >
              <div style={{
                background: 'rgba(15,10,30,0.97)',
                border: `2px solid ${result.win ? '#22c55e' : '#ef4444'}`,
                borderRadius: 20, padding: '28px 36px', textAlign: 'center', maxWidth: '88vw',
              }}>
                <div style={{ fontSize: 54 }}>{result.win ? '🏆' : '💀'}</div>
                <div style={{ color: result.win ? '#22c55e' : '#ef4444', fontSize: 26, fontWeight: 800, marginTop: 8 }}>
                  {result.win ? 'You Win!' : 'Game Over'}
                </div>
                <div style={{ color: '#facc15', fontSize: 20, marginTop: 10, fontWeight: 700 }}>
                  {result.win ? `+${result.coins} coins earned!` : 'Better luck next time!'}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={playAgain}
                    style={{
                      background: '#7c3aed', border: 'none', borderRadius: 12,
                      padding: '13px 30px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', minHeight: 52,
                    }}
                  >
                    🔄 Play Again
                  </button>
                  <button
                    onClick={onClose}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 12, padding: '13px 30px', color: '#94a3b8', fontSize: 16, cursor: 'pointer', minHeight: 52,
                    }}
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
