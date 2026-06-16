import { useState, useEffect } from 'react'
import { getTracksList, startRace, onRaceUpdate } from '@/lib/raceState'
import { minimapState } from '@/lib/minimapState'
import { nearCircuit } from '@/lib/raceCircuit'

const DIFF_COLOR = { easy: '#4ade80', medium: '#facc15', hard: '#ef4444' }
const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function fmtTime(t) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

export default function RaceMenu({ open, onClose }) {
  const [tracks, setTracks] = useState(() => getTracksList())
  const [driving, setDriving] = useState(!!minimapState.drivingType)
  const [atCircuit, setAtCircuit] = useState(false)

  useEffect(() => onRaceUpdate(() => setTracks(getTracksList())), [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => {
      setDriving(!!minimapState.drivingType)
      setAtCircuit(nearCircuit(minimapState.playerX, minimapState.playerZ))
    }, 300)
    return () => clearInterval(id)
  }, [open])

  if (!open) return null

  const ready = driving && atCircuit

  function handleStart(trackId) {
    if (!ready) return
    startRace(trackId)
    onClose()
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[550] flex items-center justify-center font-body"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div onClick={e => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(8,4,20,0.97)', border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>

        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="text-amber-400 font-extrabold text-[16px]">🏁 Racing Championship</div>
            <div className="text-slate-500 text-[11px] mt-0.5">Select a track to start a time trial</div>
          </div>
          <button onClick={onClose} className="bg-transparent border-0 text-slate-500 text-lg cursor-pointer">✕</button>
        </div>

        {!atCircuit && (
          <div className="px-4 py-2 text-[12px] font-semibold text-center"
            style={{ background: 'rgba(124,58,237,0.14)', color: '#c4b5fd', borderBottom: '1px solid rgba(124,58,237,0.2)' }}>
            🏁 Fast-travel to the <b>Racing Circuit</b> first — that's where the track is.
          </div>
        )}
        {atCircuit && !driving && (
          <div className="px-4 py-2 text-[12px] font-semibold text-center"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            🚗 Hop into one of the race cars on the starting grid (press E).
          </div>
        )}

        <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {tracks.map(t => (
            <div key={t.id} className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-slate-100 font-bold text-[14px]">{t.name}</div>
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                  style={{ background: `${DIFF_COLOR[t.difficulty]}22`, color: DIFF_COLOR[t.difficulty] }}>
                  {DIFF_LABEL[t.difficulty]}
                </span>
              </div>
              <div className="text-slate-500 text-[11px] mb-2">
                {t.checkpoints.length} checkpoints · {t.laps} lap{t.laps > 1 ? 's' : ''}
              </div>
              <div className="flex items-center justify-between text-[11px] mb-2.5">
                <span className="text-slate-400">🏆 Record: <span className="text-yellow-400 font-semibold">{fmtTime(t.bestTime)}</span></span>
                {t.bestPlayer && <span className="text-slate-500 truncate max-w-[120px]">by {t.bestPlayer}</span>}
              </div>
              <button onClick={() => handleStart(t.id)} disabled={!ready}
                className="w-full py-[8px] rounded-lg font-bold text-[13px] cursor-pointer border-0 font-body disabled:opacity-35"
                style={{ background: 'rgba(124,58,237,0.7)', color: '#fff' }}>
                Start Race
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
