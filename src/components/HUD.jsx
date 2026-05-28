import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { AnimatePresence, motion } from 'framer-motion'
import { getEconomyState, onEconomyUpdate } from '@/lib/economyState'

const LOW_COINS_THRESHOLD = 50

export default function HUD({ onOpenShop }) {
  const avatar = useStore(s => s.avatar)
  const toasts = useStore(s => s.toasts)
  const [coins, setCoins] = useState(getEconomyState().coins)

  useEffect(() => onEconomyUpdate(eco => setCoins(eco.coins)), [])

  const lowCoins = coins < LOW_COINS_THRESHOLD

  return (
    <>
      {/* Player name — minimal chip, top-left */}
      <div
        className="fixed top-3 left-3 z-40 rounded-lg py-[5px] px-3 text-slate-200 text-[13px] font-bold font-mono tracking-[0.04em] pointer-events-none select-none"
        style={{
          background: 'rgba(8,6,18,0.78)',
          border: '1px solid rgba(124,58,237,0.28)',
        }}
      >
        {avatar.name}
      </div>

      {/* Low coins warning */}
      <AnimatePresence>
        {lowCoins && (
          <motion.button
            key="low-coins"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={onOpenShop}
            className={`fixed top-[50px] left-3 z-[41] rounded-[7px] py-1 px-2.5 text-white text-xs font-bold font-body flex items-center gap-[5px] select-none ${onOpenShop ? 'cursor-pointer' : 'cursor-default'}`}
            style={{
              background: 'rgba(217,119,6,0.88)',
              border: '1px solid rgba(251,191,36,0.5)',
            }}
          >
            🪙 Low coins! <span className="text-yellow-200">{coins}</span>
            {onOpenShop && <span className="text-[10px] text-white/70">· Buy</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <div className="fixed top-14 left-3 right-3 z-50 max-w-[320px] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -16, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -16 }}
              className="py-[10px] px-4 rounded-[10px] text-[13px] font-bold text-white font-body"
              style={{
                background:
                  t.type === 'success' ? 'rgba(13,148,136,0.92)' :
                  t.type === 'error'   ? 'rgba(220,38,38,0.92)'  :
                  t.type === 'warning' ? 'rgba(217,119,6,0.92)'  :
                                         'rgba(109,40,217,0.92)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
