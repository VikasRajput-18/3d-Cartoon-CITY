import { motion } from 'framer-motion'
import { GAME_DEFS } from './index'
import { audioSystem } from '@/lib/audioSystem'

export default function GameMenu({ games, buildingName, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 500,
      }}
    >
      <div style={{
        background: 'rgba(15,10,30,0.96)', border: '1.5px solid rgba(124,58,237,0.45)',
        borderRadius: 20, padding: '20px', width: 'min(90vw, 420px)',
        maxHeight: '80vh', overflowY: 'auto',
        fontFamily: 'Nunito, sans-serif',
      }}>
        <div style={{ color: '#a78bfa', fontSize: 13, marginBottom: 4 }}>{buildingName}</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Play a Game</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map(id => {
            const g = GAME_DEFS[id]
            return (
              <button
                key={id}
                onClick={() => { audioSystem.playClick(); onSelect(id) }}
                style={{
                  background: `${g.color}22`, border: `1.5px solid ${g.color}55`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  transition: 'background 0.15s', minHeight: 64, width: '100%',
                  touchAction: 'manipulation',
                }}
                onMouseOver={e => e.currentTarget.style.background = `${g.color}44`}
                onMouseOut={e => e.currentTarget.style.background = `${g.color}22`}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{g.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{g.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{g.desc}</div>
                  <div style={{ color: '#facc15', fontSize: 12, marginTop: 3 }}>Win: +{g.coins} coins</div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 14, width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '13px', color: '#94a3b8', fontSize: 14, cursor: 'pointer',
            minHeight: 48, touchAction: 'manipulation',
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}
