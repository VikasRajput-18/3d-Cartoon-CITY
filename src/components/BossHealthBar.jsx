import { useState, useEffect } from 'react'
import { onBossUpdate, getBossState } from '@/lib/bossState'

export default function BossHealthBar() {
  const [boss, setBoss] = useState(getBossState())
  useEffect(() => onBossUpdate(setBoss), [])

  if (!boss.isActive || boss.isDefeated) return null

  const pct = Math.max(0, Math.min(1, boss.hpPercent)) * 100

  return (
    <div style={{
      position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
      width: 360, maxWidth: '90vw',
      background: 'rgba(8,4,20,0.9)',
      border: '1px solid rgba(239,68,68,0.4)',
      borderTop: 'none', borderRadius: '0 0 12px 12px',
      padding: '8px 16px 10px',
      zIndex: 450,
      fontFamily: 'Nunito, sans-serif',
      boxShadow: '0 4px 24px rgba(239,68,68,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>💀 {boss.bossName}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{boss.currentHp} / {boss.maxHp} HP</span>
      </div>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 50 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : pct > 20 ? 'linear-gradient(90deg,#ea580c,#f97316)' : 'linear-gradient(90deg,#7c3aed,#ec4899)',
          borderRadius: 5,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
        Press F near the boss to attack · Community fight
      </div>
    </div>
  )
}
