import { onRaceUpdate, exitResults } from '@/lib/raceState'
import { useEffect, useState } from 'react'

function fmtTime(t) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

export default function RaceResults() {
  const [race, setRace] = useState(null)
  useEffect(() => onRaceUpdate(setRace), [])

  if (!race || race.phase !== 'finished' || !race.result) return null
  const { time, isTrackRecord, isPersonalBest, coins, trackName, position, totalRacers } = race.result
  const ord = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][position] || `${position}th`
  const won = position === 1
  const posColor = won ? '#fde047' : position === 2 ? '#cbd5e1' : position === 3 ? '#d8975a' : '#94a3b8'

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-[360px] max-w-[90vw] rounded-2xl overflow-hidden text-center"
        style={{ background: 'rgba(8,4,20,0.97)', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 12px 56px rgba(0,0,0,0.8)' }}>

        <div className="px-5 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isTrackRecord ? (
            <div className="text-yellow-400 font-extrabold text-[20px] mb-1" style={{ textShadow: '0 0 20px rgba(251,191,36,0.7)' }}>
              🏆 NEW TRACK RECORD!
            </div>
          ) : isPersonalBest ? (
            <div className="text-violet-300 font-extrabold text-[18px] mb-1">⭐ New Personal Best!</div>
          ) : (
            <div className="text-slate-300 font-extrabold text-[18px] mb-1">🏁 Race Complete!</div>
          )}
          <div className="text-slate-500 text-[12px]">{trackName}</div>
        </div>

        <div className="px-5 py-5">
          {position != null && (
            <div className="font-extrabold text-[30px] mb-3" style={{ color: posColor, textShadow: `0 0 18px ${posColor}88` }}>
              {won ? '🏆 ' : ''}{ord} of {totalRacers}
            </div>
          )}
          <div className="text-slate-400 text-[12px] mb-1">Your Time</div>
          <div className="text-white font-extrabold text-[38px] mb-4">{fmtTime(time)}</div>

          <div className="rounded-xl flex items-center justify-center gap-2 py-2.5 mb-1"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <span className="text-yellow-400 font-extrabold text-[16px]">🪙 +{coins} coins</span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={exitResults}
            className="w-full py-[10px] rounded-xl font-bold text-[14px] cursor-pointer border-0 font-body"
            style={{ background: 'rgba(124,58,237,0.7)', color: '#fff' }}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
