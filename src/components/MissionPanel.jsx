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
    <div className="h-[6px] overflow-hidden mt-1 rounded-[3px]" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div
        className="h-full transition-[width] duration-[400ms] rounded-[3px]"
        style={{ width: `${Math.round(value * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)' }}
      />
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
    <div
      className="rounded-[10px] py-[10px] px-3 mb-2"
      style={{
        background: isActive ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div className={`flex items-center gap-2 ${isActive ? 'mb-1' : ''}`}>
        <span className="text-base leading-none shrink-0">{si.icon}</span>
        <div className="flex-1">
          <div className="text-[13px] font-bold" style={{ color: isActive ? '#facc15' : si.color }}>
            {mission.title}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 shrink-0">
          {mission.reward_coins}🪙 {mission.reward_xp}XP
        </div>
      </div>
      {isActive && (
        <>
          <div className="text-xs text-slate-300 leading-[1.4] pl-6">
            {mission.description}
          </div>
          <div className="pl-6 mt-2 flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="rounded-[6px] py-1 px-[10px] text-red-400 text-[11px] font-bold cursor-pointer font-body"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              ⏭ Skip (🪙 {COSTS.missionSkip})
            </button>
            {skipMsg && (
              <span className="text-[11px]" style={{ color: skipMsg.includes('Need') ? '#f87171' : '#4ade80' }}>
                {skipMsg}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DailyItem({ daily, completed, resetAt }) {
  return (
    <div
      className="rounded-[10px] py-[10px] px-3 mb-2 flex items-center gap-[10px]"
      style={{
        background: completed ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${completed ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <span className="text-xl">{daily.icon}</span>
      <div className="flex-1">
        <div className="text-[13px] font-bold" style={{ color: completed ? '#4ade80' : '#e2e8f0' }}>
          {daily.title}
        </div>
        <div className="text-[11px] text-slate-400">{daily.description}</div>
      </div>
      <div className="text-right shrink-0">
        {completed
          ? <span className="text-lg">✅</span>
          : <span className="text-xs text-yellow-400">+{daily.reward_coins}🪙</span>
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

  const tabCls = (active) =>
    `flex-1 py-2 border-0 cursor-pointer text-[13px] font-bold font-body transition-all whitespace-nowrap overflow-hidden ${active ? 'text-violet-400' : 'text-slate-500 bg-transparent'}`

  return (
    <div
      className="fixed top-0 left-0 bottom-0 w-[320px] max-w-[90vw] z-[500] flex flex-col font-body overflow-hidden"
      style={{
        background: 'rgba(8,4,20,0.97)',
        border: '1px solid rgba(124,58,237,0.3)',
        borderLeft: 'none',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0"
        style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-[10px]">
          <div>
            <div className="text-base font-extrabold text-violet-400">📜 The Cartoon City Mystery</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Chapter 1: The Shadow Appears</div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-0 text-slate-500 text-xl cursor-pointer px-1"
          >✕</button>
        </div>

        {/* XP Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[11px] text-slate-500 mb-[3px]">
            <span>Level {level}</span>
            <span>{xpInLevel} / {xpToNext} XP</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-[3px]" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full transition-[width] duration-[400ms] rounded-[3px]"
              style={{ width: `${(xpInLevel / xpToNext) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#facc15)' }}
            />
          </div>
        </div>

        {/* Chapter progress */}
        {tab === 'story' && (
          <div>
            <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
              <span>Chapter Progress</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <MsProgress value={progress} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          className={tabCls(tab === 'story')}
          style={{ background: tab === 'story' ? 'rgba(124,58,237,0.25)' : 'transparent', borderBottom: tab === 'story' ? '2px solid #7c3aed' : '2px solid transparent' }}
          onClick={() => setTab('story')}
        >📖 Story</button>
        <button
          className={tabCls(tab === 'daily')}
          style={{ background: tab === 'daily' ? 'rgba(124,58,237,0.25)' : 'transparent', borderBottom: tab === 'daily' ? '2px solid #7c3aed' : '2px solid transparent' }}
          onClick={() => setTab('daily')}
        >📅 Daily</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        {tab === 'story' ? (
          <>
            {!initialized && <div className="text-slate-500 text-[13px] text-center mt-[30px]">Loading missions…</div>}
            {missions.map(m => (
              <MissionItem key={m.id} mission={m} status={getMissionStatus(m.id)} coins={coins} />
            ))}
            {missions.length === 0 && initialized && (
              <div className="text-slate-500 text-[13px] text-center mt-[30px]">No missions yet</div>
            )}
            <div
              className="mt-[10px] rounded-[10px] py-[10px] px-3"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
            >
              <div className="text-[11px] text-amber-500 font-bold">CHAPTER 2 TEASER</div>
              <div className="text-xs text-slate-500 mt-1">Complete all missions to unlock the next chapter...</div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] text-slate-500 mb-[10px]">Resets in {msLeft}h · Earn coins every day</div>
            {DAILY_MISSIONS.map(d => (
              <DailyItem key={d.id} daily={d} completed={!!dailyCompleted[d.id]} resetAt={dailyResetAt} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
