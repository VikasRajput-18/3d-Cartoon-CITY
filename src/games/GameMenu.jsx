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
        borderRadius: 20, padding: '24px 28px', minWidth: 320, maxWidth: 420,
        fontFamily: 'Nunito, sans-serif',
      }}>
        <div style={{ color: '#a78bfa', fontSize: 12, marginBottom: 4 }}>{buildingName}</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 18 }}>Play a Game</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map(id => {
            const g = GAME_DEFS[id]
            return (
              <button
                key={id}
                onClick={() => { audioSystem.playClick(); onSelect(id) }}
                style={{
                  background: `${g.color}22`, border: `1.5px solid ${g.color}55`,
                  borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = `${g.color}44`}
                onMouseOut={e => e.currentTarget.style.background = `${g.color}22`}
              >
                <span style={{ fontSize: 26 }}>{g.emoji}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{g.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{g.desc}</div>
                  <div style={{ color: '#facc15', fontSize: 11, marginTop: 3 }}>Win: +{g.coins} coins</div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '9px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}
