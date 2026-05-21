import { useRef, useEffect, useState } from 'react'
import { timeWeatherState } from '@/lib/timeWeatherState'

const WEATHER_ICON = { clear: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️' }

function fmtTime(h) {
  const hr  = Math.floor(h) % 24
  const min = Math.floor((h % 1) * 60)
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default function TimeWeatherHUD() {
  const [state, setState] = useState({ time: '08:00', isNight: false, weather: 'clear' })
  const rafRef = useRef()

  useEffect(() => {
    const tick = () => {
      setState({
        time:    fmtTime(timeWeatherState.timeOfDay),
        isNight: timeWeatherState.isNight,
        weather: timeWeatherState.weather,
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const chip = {
    background: 'rgba(8,6,18,0.82)',
    border: '1px solid rgba(124,58,237,0.30)',
    borderRadius: 8,
    padding: '4px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'monospace',
  }

  return (
    <div style={{
      position: 'fixed', top: 68, left: 12, zIndex: 40,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none',
    }}>
      <div style={{ ...chip, color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
        <span>{state.isNight ? '🌙' : '☀️'}</span>
        <span>{state.time}</span>
      </div>
      <div style={{ ...chip, color: '#94a3b8', fontSize: 11 }}>
        <span>{WEATHER_ICON[state.weather] ?? '☀️'}</span>
        <span style={{ textTransform: 'capitalize' }}>{state.weather}</span>
      </div>
    </div>
  )
}
