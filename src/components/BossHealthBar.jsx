import { useState, useEffect } from 'react'
import { onBossUpdate, getBossState } from '@/lib/bossState'

export default function BossHealthBar() {
  const [boss, setBoss] = useState(getBossState())
  useEffect(() => onBossUpdate(setBoss), [])

  if (!boss.isActive || boss.isDefeated) return null

  const pct = Math.max(0, Math.min(1, boss.hpPercent)) * 100

  return (
    <div
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[450] font-body"
      style={{
        width: 360, maxWidth: '90vw',
        background: 'rgba(8,4,20,0.9)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderTop: 'none', borderRadius: '0 0 12px 12px',
        padding: '8px 16px 10px',
        boxShadow: '0 4px 24px rgba(239,68,68,0.25)',
      }}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: 5 }}>
        <span className="font-extrabold text-red-500" style={{ fontSize: 13 }}>💀 {boss.bossName}</span>
        <span className="text-slate-400" style={{ fontSize: 12 }}>{boss.currentHp} / {boss.maxHp} HP</span>
      </div>
      <div className="overflow-hidden" style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5 }}>
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            background: pct > 50 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : pct > 20 ? 'linear-gradient(90deg,#ea580c,#f97316)' : 'linear-gradient(90deg,#7c3aed,#ec4899)',
            borderRadius: 5,
          }}
        />
      </div>
      <div className="text-center text-slate-500 mt-1" style={{ fontSize: 10 }}>
        Press F near the boss to attack · Community fight
      </div>
    </div>
  )
}
