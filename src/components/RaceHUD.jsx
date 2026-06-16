import { useEffect, useRef, useState } from 'react'
import { onRaceUpdate, cancelRace, raceLive } from '@/lib/raceState'
import { minimapState } from '@/lib/minimapState'

function fmtTime(t) {
  if (t == null) return '—'
  const m = Math.floor(t / 60), s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

export default function RaceHUD() {
  const [race, setRace] = useState(null)
  const [finalLapBanner, setFinalLapBanner] = useState(false)

  const timerRef = useRef(null)
  const speedRef = useRef(null)
  const distRef  = useRef(null)
  const arrowRef = useRef(null)
  const wrongRef = useRef(null)
  const posRef   = useRef(null)

  useEffect(() => onRaceUpdate(setRace), [])

  useEffect(() => {
    const onLap = (e) => {
      if (e.detail?.finalLap) {
        setFinalLapBanner(true)
        setTimeout(() => setFinalLapBanner(false), 2500)
      }
    }
    window.addEventListener('race-lap-complete', onLap)
    return () => window.removeEventListener('race-lap-complete', onLap)
  }, [])

  // Fast-changing numbers updated via direct DOM writes (no React re-render)
  useEffect(() => {
    if (!race || race.phase !== 'racing') return
    let raf
    const tick = () => {
      if (timerRef.current) timerRef.current.textContent = fmtTime(raceLive.elapsed)
      if (speedRef.current) speedRef.current.textContent = `${Math.round(raceLive.speed)} km/h`
      if (distRef.current)  distRef.current.textContent  = `${Math.round(raceLive.nextDist)}m`
      if (arrowRef.current) {
        const rel = raceLive.nextBearing - minimapState.playerFacing
        arrowRef.current.style.transform = `rotate(${rel}rad)`
      }
      if (wrongRef.current) wrongRef.current.style.display = raceLive.wrongWay ? 'flex' : 'none'
      if (posRef.current)   posRef.current.textContent   = `${raceLive.position}/${raceLive.totalRacers}`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [race?.phase])

  if (!race || race.phase === 'idle') return null

  return (
    <div className="fixed inset-0 z-[480] pointer-events-none font-body">

      {/* Countdown overlay */}
      {race.phase === 'countdown' && (
        <div className="fixed inset-0 flex items-center justify-center z-[490]">
          <div className="text-white font-extrabold" style={{ fontSize: 110, textShadow: '0 0 40px rgba(124,58,237,0.8)' }}>
            {race.countdown > 0 ? race.countdown : 'GO!'}
          </div>
        </div>
      )}

      {race.phase === 'racing' && (
        <>
          {/* Top-center: lap + timer */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 text-center">
            <div className="text-amber-400 font-extrabold text-[15px]">Lap {race.lap}/{race.track.laps}</div>
            <div ref={timerRef} className="text-white font-extrabold text-[28px]" style={{ textShadow: '0 0 12px rgba(0,0,0,0.8)' }}>
              0:00.00
            </div>
          </div>

          {/* Top-left: live position */}
          <div className="fixed top-4 left-4 rounded-xl px-3 py-2 text-center"
            style={{ background: 'rgba(8,4,20,0.75)', border: '1px solid rgba(251,191,36,0.4)' }}>
            <div className="text-slate-400 text-[10px]">Position</div>
            <div className="flex items-baseline gap-1 justify-center">
              <span className="text-amber-400 font-extrabold text-[15px]">P</span>
              <span ref={posRef} className="text-white font-extrabold text-[20px]">1/5</span>
            </div>
          </div>

          {/* Top-right: best times + speed */}
          <div className="fixed top-4 right-4 rounded-xl px-3 py-2 text-right"
            style={{ background: 'rgba(8,4,20,0.75)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="text-slate-400 text-[10px]">Track Record</div>
            <div className="text-yellow-400 font-bold text-[13px] mb-1">{fmtTime(race.track.bestTime)}</div>
            <div className="text-slate-400 text-[10px]">Your Best</div>
            <div className="text-violet-300 font-bold text-[13px] mb-1">{fmtTime(race.personalBest)}</div>
            <div ref={speedRef} className="text-white font-extrabold text-[15px]">0 km/h</div>
          </div>

          {/* Bottom-center: next checkpoint distance + direction arrow */}
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
            <div ref={arrowRef} style={{ fontSize: 30, color: '#4ade80', transition: 'transform 0.1s linear' }}>⬆️</div>
            <div ref={distRef} className="text-slate-200 font-bold text-[13px]" style={{ textShadow: '0 0 8px rgba(0,0,0,0.9)' }}>0m</div>
          </div>

          {/* Wrong way warning */}
          <div ref={wrongRef} className="fixed top-1/3 left-1/2 -translate-x-1/2 items-center gap-2 rounded-xl px-5 py-3"
            style={{ display: 'none', background: 'rgba(239,68,68,0.9)' }}>
            <span className="text-white font-extrabold text-[16px]">⚠️ WRONG WAY</span>
          </div>

          {/* Final lap banner */}
          {finalLapBanner && (
            <div className="fixed top-[18%] left-1/2 -translate-x-1/2 text-red-400 font-extrabold text-[26px]"
              style={{ textShadow: '0 0 24px rgba(239,68,68,0.8)', animation: 'pulse 0.6s infinite' }}>
              🏁 FINAL LAP!
            </div>
          )}

          {/* Quit button */}
          <button onClick={cancelRace}
            className="fixed bottom-4 right-4 pointer-events-auto border-0 rounded-lg text-[11px] font-bold cursor-pointer font-body"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 12px' }}>
            Quit Race
          </button>
        </>
      )}
    </div>
  )
}
