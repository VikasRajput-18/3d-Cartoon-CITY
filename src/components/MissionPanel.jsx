import { useState, useEffect } from 'react'
import { onMissionUpdate, getMissionState, DAILY_MISSIONS, getActiveMission, getMissionStatus, getChapterProgress, calcLevel, skipMission } from '@/lib/missionState'
import { spendCoins, getEconomyState, onEconomyUpdate } from '@/lib/economyState'
import { COSTS } from '@/lib/costs'

const STATUS_ICON = {
  locked:    { icon: '🔒', color: '#475569' },
  active:    { icon: '⚡', color: '#facc15' },
  completed: { icon: '✅', color: '#4ade80' },
}

function MsProgress({ value }) {
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${Math.round(value * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)', borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

function MissionItem({ mission, status, coins }) {
  const si = STATUS_ICON[status] || STATUS_ICON.locked
  const isActive = status === 'active'
  const [skipMsg, setSkipMsg] = useState('')

  const handleSkip = () => {
    if (coins < COSTS.missionSkip) {
      setSkipMsg(`Need ${COSTS.missionSkip} coins`)
      setTimeout(() => setSkipMsg(''), 2000)
      return
    }
    spendCoins(COSTS.missionSkip)
    skipMission(mission.id)
    setSkipMsg('Skipped!')
  }

  return (
    <div style={{
      background: isActive ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isActive ? 4 : 0 }}>
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{si.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#facc15' : si.color }}>
            {mission.title}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
          {mission.reward_coins}🪙 {mission.reward_xp}XP
        </div>
      </div>
      {isActive && (
        <>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, paddingLeft: 24 }}>
            {mission.description}
          </div>
          <div style={{ paddingLeft: 24, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6, padding: '4px 10px', color: '#f87171',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
              }}
            >
              ⏭ Skip (🪙 {COSTS.missionSkip})
            </button>
            {skipMsg && <span style={{ fontSize: 11, color: skipMsg.includes('Need') ? '#f87171' : '#4ade80' }}>{skipMsg}</span>}
          </div>
        </>
      )}
    </div>
  )
}

function DailyItem({ daily, completed, resetAt }) {
  return (
    <div style={{
      background: completed ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${completed ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>{daily.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: completed ? '#4ade80' : '#e2e8f0' }}>{daily.title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{daily.description}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {completed
          ? <span style={{ fontSize: 18 }}>✅</span>
          : <span style={{ fontSize: 12, color: '#facc15' }}>+{daily.reward_coins}🪙</span>
        }
      </div>
    </div>
  )
}

export default function MissionPanel({ open, onClose }) {
  const [tab, setTab] = useState('story')
  const [ms, setMs]   = useState(getMissionState())
  const [coins, setCoins] = useState(getEconomyState().coins)

  useEffect(() => onMissionUpdate(setMs), [])
  useEffect(() => onEconomyUpdate(eco => setCoins(eco.coins)), [])

  if (!open) return null

  const { missions, playerMissions, xp, level, dailyCompleted, dailyResetAt, initialized } = ms
  const { xpInLevel, xpToNext } = calcLevel(xp)
  const progress = getChapterProgress()

  const msLeft = Math.max(0, Math.ceil((dailyResetAt - Date.now()) / 3600000))

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.25)' : 'transparent',
    color: active ? '#a78bfa' : '#64748b',
    fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
    borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  })

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: 320, maxWidth: '90vw',
      background: 'rgba(8,4,20,0.97)',
      border: '1px solid rgba(124,58,237,0.3)',
      borderLeft: 'none',
      zIndex: 500,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Nunito, sans-serif',
      boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
      overflowY: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>📜 The Cartoon City Mystery</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Chapter 1: The Shadow Appears</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* XP Bar */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
            <span>Level {level}</span>
            <span>{xpInLevel} / {xpToNext} XP</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(xpInLevel / xpToNext) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#facc15)', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Chapter progress */}
        {tab === 'story' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
              <span>Chapter Progress</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <MsProgress value={progress} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button style={tabStyle(tab === 'story')} onClick={() => setTab('story')}>📖 Story</button>
        <button style={tabStyle(tab === 'daily')} onClick={() => setTab('daily')}>📅 Daily</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {tab === 'story' ? (
          <>
            {!initialized && <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 30 }}>Loading missions…</div>}
            {missions.map(m => (
              <MissionItem key={m.id} mission={m} status={getMissionStatus(m.id)} coins={coins} />
            ))}
            {missions.length === 0 && initialized && (
              <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 30 }}>No missions yet</div>
            )}
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>CHAPTER 2 TEASER</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Complete all missions to unlock the next chapter...</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Resets in {msLeft}h · Earn coins every day</div>
            {DAILY_MISSIONS.map(d => (
              <DailyItem key={d.id} daily={d} completed={!!dailyCompleted[d.id]} resetAt={dailyResetAt} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
