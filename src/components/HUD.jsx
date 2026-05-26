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
      <div style={{
        position: 'fixed', top: 12, left: 12, zIndex: 40,
        background: 'rgba(8,6,18,0.78)',
        border: '1px solid rgba(124,58,237,0.28)',
        borderRadius: 8, padding: '5px 12px',
        color: '#e2e8f0', fontSize: 13, fontWeight: 700,
        fontFamily: 'monospace', letterSpacing: '0.04em',
        pointerEvents: 'none', userSelect: 'none',
      }}>
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
            style={{
              position: 'fixed', top: 50, left: 12, zIndex: 41,
              background: 'rgba(217,119,6,0.88)',
              border: '1px solid rgba(251,191,36,0.5)',
              borderRadius: 7, padding: '4px 10px',
              color: '#fff', fontSize: 12, fontWeight: 700,
              fontFamily: 'Nunito, sans-serif',
              cursor: onOpenShop ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 5,
              userSelect: 'none',
            }}
          >
            🪙 Low coins! <span style={{ color: '#fde68a' }}>{coins}</span>
            {onOpenShop && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>· Buy</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <div style={{
        position: 'fixed', top: 56, left: 12, right: 12,
        zIndex: 50, maxWidth: 320,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -16, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -16 }}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13,
                fontWeight: 700, color: '#fff',
                background:
                  t.type === 'success' ? 'rgba(13,148,136,0.92)' :
                  t.type === 'error'   ? 'rgba(220,38,38,0.92)'  :
                  t.type === 'warning' ? 'rgba(217,119,6,0.92)'  :
                                         'rgba(109,40,217,0.92)',
                border: '1px solid rgba(255,255,255,0.10)',
                fontFamily: 'Nunito, sans-serif',
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
