import { motion } from 'framer-motion'
import { GAME_DEFS } from './index'
import { audioSystem } from '@/lib/audioSystem'
import { COSTS } from '@/lib/costs'

export default function GameMenu({ games, buildingName, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="fixed inset-0 flex items-center justify-center z-[500] backdrop-blur-[6px]"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="rounded-[20px] overflow-y-auto font-body"
        style={{
          background: 'rgba(15,10,30,0.96)',
          border: '1.5px solid rgba(124,58,237,0.45)',
          padding: '20px',
          width: 'min(90vw, 420px)',
          maxHeight: '80vh',
        }}
      >
        <div className="text-violet-400 text-[13px] mb-1">{buildingName}</div>
        <div className="text-white font-bold text-[18px] mb-4">Play a Game</div>

        <div className="flex flex-col gap-[10px]">
          {games.map(id => {
            const g = GAME_DEFS[id]
            return (
              <button
                key={id}
                onClick={() => { audioSystem.playClick(); onSelect(id) }}
                className="rounded-xl flex items-center gap-3 text-left cursor-pointer min-h-[64px] w-full border-0 transition-[background] duration-150 touch-manipulation font-body"
                style={{
                  background: `${g.color}22`,
                  border: `1.5px solid ${g.color}55`,
                  padding: '14px 16px',
                }}
                onMouseOver={e => e.currentTarget.style.background = `${g.color}44`}
                onMouseOut={e => e.currentTarget.style.background = `${g.color}22`}
              >
                <span className="text-[28px] shrink-0">{g.emoji}</span>
                <div className="min-w-0">
                  <div className="text-white font-bold text-[15px]">{g.label}</div>
                  <div className="text-slate-400 text-[12px] mt-[2px]">{g.desc}</div>
                  <div className="flex gap-[10px] mt-[3px]">
                    <span className="text-yellow-400 text-[12px]">🎟️ {COSTS.playGame} tickets</span>
                    <span className="text-green-400 text-[12px]">Win: +{g.coins} coins</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-[14px] w-full rounded-[10px] text-slate-400 text-[14px] cursor-pointer min-h-[48px] touch-manipulation border-0 font-body"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '13px',
          }}
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}
