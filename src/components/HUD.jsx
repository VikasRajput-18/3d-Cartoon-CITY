import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import { Settings, Map } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const STATS_CFG = [
  { key: 'hunger',  emoji: '🍔', color: '#F59E0B' },
  { key: 'sleep',   emoji: '😴', color: '#818CF8' },
  { key: 'hygiene', emoji: '🚿', color: '#22D3EE' },
  { key: 'social',  emoji: '💬', color: '#F472B6' },
  { key: 'fun',     emoji: '🎮', color: '#4ADE80' },
]

export default function HUD() {
  const avatar  = useStore(s => s.avatar)
  const stats   = useStore(s => s.stats)
  const wallet  = useStore(s => s.wallet)
  const toasts  = useStore(s => s.toasts)
  const navigate = useNavigate()

  return (
    <>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-lg mx-auto px-3 pt-3 flex items-start justify-between">

          {/* Avatar chip */}
          <div className="glass-dark px-3 py-2 flex items-center gap-2 pointer-events-auto rounded-2xl">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold border border-white/20">
              {avatar.name?.[0] || '?'}
            </div>
            <div>
              <p className="text-white text-xs font-bold leading-none">{avatar.name}</p>
              <p className="text-white/40 text-[10px]">Cartoon City</p>
            </div>
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="glass-dark px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="text-xs">🪙</span>
              <span className="text-amber-300 text-xs font-bold">{wallet.coins.toLocaleString()}</span>
            </div>
            <div className="glass-dark px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="text-xs">💎</span>
              <span className="text-purple-300 text-xs font-bold">{wallet.gems}</span>
            </div>
            <div className="glass-dark px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="text-xs">🎟️</span>
              <span className="text-pink-300 text-xs font-bold">{wallet.tickets}</span>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="glass-dark p-1.5 rounded-xl pointer-events-auto hover:bg-white/10 transition-all"
            >
              <Settings size={16} className="text-white/50" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats panel - right side */}
      <div className="fixed top-16 right-3 z-40 glass-dark p-2.5 rounded-2xl space-y-2 w-28">
        {STATS_CFG.map(({ key, emoji, color }) => {
          const val = Math.round(stats[key] || 0)
          const isLow = val < 30
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`text-xs ${isLow ? 'animate-bounce' : ''}`}>{emoji}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${val}%`, background: isLow ? '#ef4444' : color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Toasts */}
      <div className="fixed top-24 left-3 right-3 z-50 max-w-xs mx-auto space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold shadow-cartoon border text-white
                ${t.type === 'success' ? 'bg-teal-600/90 border-teal-400/30' :
                  t.type === 'error'   ? 'bg-red-600/90 border-red-400/30' :
                  t.type === 'warning' ? 'bg-amber-600/90 border-amber-400/30' :
                                         'bg-purple-700/90 border-purple-400/30'}`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Live event banner */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-dark border border-orange-400/30 bg-orange-500/10 px-4 py-1.5 rounded-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
          <span className="text-orange-300 text-xs font-bold">Festival Chaos — 2x Fun rewards!</span>
        </div>
      </div>
    </>
  )
}
