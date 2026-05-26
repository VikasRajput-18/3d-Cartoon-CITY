import { useEffect, useState, useRef } from 'react'
import { timeWeatherState } from '@/lib/timeWeatherState'

// ── Weather code → game weather mapping (Open-Meteo WMO codes) ────────────────
function mapWeatherCode(code) {
  if (code <= 1)  return 'clear'
  if (code <= 3)  return 'cloudy'
  if (code >= 51 && code <= 67) return 'rainy'
  if (code >= 80 && code <= 82) return 'rainy'
  if (code >= 85 && code <= 86) return 'rainy'
  if (code >= 95) return 'rainy'   // thunderstorm
  if (code === 45 || code === 48) return 'foggy'
  return 'clear'
}

const WEATHER_ICON  = { clear: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️' }
const WEATHER_LABEL = { clear: 'Clear', cloudy: 'Cloudy', rainy: 'Rain', foggy: 'Foggy' }

// ── Indian festival dates [month (1-based), day] ─────────────────────────────
const FESTIVALS = [
  { month: 1,  day: 1,  name: 'Happy New Year! 🎆' },
  { month: 1,  day: 26, name: 'Republic Day 🇮🇳' },
  { month: 3,  day: 14, name: 'Happy Holi! 🌈' },
  { month: 8,  day: 15, name: 'Independence Day 🇮🇳' },
  { month: 10, day: 20, name: 'Happy Diwali! 🪔' },
  { month: 12, day: 25, name: 'Merry Christmas! 🎄' },
]

function getTodayFestival() {
  const now = new Date()
  const m   = now.getMonth() + 1
  const d   = now.getDate()
  return FESTIVALS.find(f => f.month === m && f.day === d) ?? null
}

function isWeekend() {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

function getRealTimeLabel() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getTimeContext(h) {
  if (h >= 6  && h < 8)  return 'sunrise'
  if (h >= 8  && h < 18) return 'day'
  if (h >= 18 && h < 20) return 'sunset'
  if (h >= 20 && h < 22) return 'earlynight'
  return 'night'
}

export default function TimeWeatherHUD() {
  const [time,       setTime]       = useState(getRealTimeLabel())
  const [weather,    setWeather]    = useState('clear')
  const [realWeather, setRealWeather] = useState(null)   // from API
  const [festival,   setFestival]   = useState(null)
  const [weekend,    setWeekend]    = useState(false)
  const [isNight,    setIsNight]    = useState(false)
  const weatherFetched = useRef(false)

  // ── Tick: update time + weather display every 10 s ────────────────────────
  useEffect(() => {
    const tick = () => {
      setTime(getRealTimeLabel())
      setWeather(timeWeatherState.weather)
      const h = new Date().getHours()
      setIsNight(h < 6 || h >= 20)
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])

  // ── Festival + weekend (check once per minute) ────────────────────────────
  useEffect(() => {
    const check = () => {
      setFestival(getTodayFestival())
      setWeekend(isWeekend())
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [])

  // ── Fetch real weather from Open-Meteo (no API key required) ─────────────
  useEffect(() => {
    if (weatherFetched.current) return
    weatherFetched.current = true

    const fetchWeather = () => {
      fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current=weathercode,precipitation&timezone=auto'
      )
        .then(r => r.json())
        .then(data => {
          const code = data.current?.weathercode ?? 0
          const mapped = mapWeatherCode(code)
          setRealWeather(mapped)
          // Force game weather to match real world
          timeWeatherState.forcedWeather = mapped
        })
        .catch(() => { /* no-op — fallback to random game weather */ })
    }

    fetchWeather()
    // Refresh every 30 minutes
    const id = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const chip = {
    background: 'rgba(8,6,18,0.82)',
    border: '1px solid rgba(124,58,237,0.30)',
    borderRadius: 8,
    padding: '4px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Nunito, monospace',
    pointerEvents: 'none',
  }

  const hour = new Date().getHours()
  const ctx  = getTimeContext(hour)

  const timeColor =
    ctx === 'sunrise'   ? '#fb923c' :
    ctx === 'sunset'    ? '#f97316' :
    ctx === 'earlynight'? '#818cf8' :
    ctx === 'night'     ? '#c4b5fd' : '#e2e8f0'

  return (
    <div style={{
      position: 'fixed', top: 46, left: 12, zIndex: 40,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none',
    }}>
      {/* Real time chip */}
      <div style={{ ...chip, color: timeColor, fontSize: 14, fontWeight: 800 }}>
        <span>{isNight ? '🌙' : ctx === 'sunrise' ? '🌅' : ctx === 'sunset' ? '🌇' : '☀️'}</span>
        <span>{time}</span>
      </div>

      {/* Weather chip — real-world weather takes priority */}
      <div style={{ ...chip, color: '#94a3b8', fontSize: 11 }}>
        <span>{WEATHER_ICON[realWeather ?? weather] ?? '☀️'}</span>
        <span>{WEATHER_LABEL[realWeather ?? weather]}</span>
        {realWeather && (
          <span style={{ color: '#475569', fontSize: 9 }}>live</span>
        )}
      </div>

      {/* Weekend banner */}
      {weekend && (
        <div style={{
          ...chip,
          color: '#fbbf24', fontSize: 10, fontWeight: 700,
          border: '1px solid rgba(251,191,36,0.35)',
        }}>
          🎉 Weekend Vibes!
        </div>
      )}

      {/* Festival banner */}
      {festival && (
        <div style={{
          ...chip,
          color: '#f472b6', fontSize: 11, fontWeight: 800,
          border: '1px solid rgba(244,114,182,0.45)',
          background: 'rgba(244,114,182,0.12)',
          animation: 'twHudPulse 2s ease-in-out infinite',
        }}>
          {festival.name}
        </div>
      )}

      {/* Late-night quiet hours indicator */}
      {(hour >= 23 || hour < 4) && (
        <div style={{ ...chip, color: '#64748b', fontSize: 10 }}>
          🌃 Quiet Hours
        </div>
      )}

      <style>{`
        @keyframes twHudPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.65; }
        }
      `}</style>
    </div>
  )
}
