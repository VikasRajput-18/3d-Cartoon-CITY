import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { audioSystem } from '@/lib/audioSystem'

const DAY_SECS = 600  // 10 real minutes = 1 full game day

// Sky background colour stops [hour, hex]
const SKY_STOPS = [
  [0,    '#000d1a'],
  [4,    '#05081a'],
  [5.5,  '#8b3a10'],
  [6,    '#e06820'],
  [6.8,  '#7aadda'],
  [9,    '#4db8f5'],
  [12,   '#38aef0'],
  [17,   '#5ab4e8'],
  [18,   '#e05820'],
  [18.9, '#7a2050'],
  [20,   '#100820'],
  [21,   '#000d1a'],
  [24,   '#000d1a'],
]

// Ambient light stops [hour, intensity, colour]
const AMB_STOPS = [
  [0,    0.04, '#506090'],
  [5,    0.05, '#708090'],
  [5.5,  0.18, '#ff9060'],
  [6,    0.32, '#ffb080'],
  [7,    0.56, '#fff5e8'],
  [9,    0.65, '#fff8f0'],
  [12,   0.70, '#fff5e0'],
  [17,   0.65, '#ffe8d0'],
  [18,   0.38, '#ff8040'],
  [18.9, 0.15, '#8040a0'],
  [20,   0.05, '#2040a0'],
  [24,   0.04, '#506090'],
]

// Reusable colour temporaries — avoids per-frame allocation
const _ca = new THREE.Color()
const _cb = new THREE.Color()
const _cc = new THREE.Color()
const _cd = new THREE.Color()

function lerpStops(stops, hour, getColor) {
  for (let i = 0; i < stops.length - 1; i++) {
    if (hour >= stops[i][0] && hour < stops[i + 1][0]) {
      const t = (hour - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
      if (getColor) {
        _cc.set(stops[i][2]).lerp(_cd.set(stops[i + 1][2]), t)
        const intens = stops[i][1] + (stops[i + 1][1] - stops[i][1]) * t
        return { intensity: intens, color: _cc }
      } else {
        _ca.set(stops[i][1]).lerp(_cb.set(stops[i + 1][1]), t)
        return _ca
      }
    }
  }
  return getColor
    ? { intensity: stops[0][1], color: _cc.set(stops[0][2]) }
    : _ca.set(stops[0][1])
}

export default function DayNightCycle() {
  const { scene } = useThree()

  const clockRef    = useRef(DAY_SECS * 0.5)  // start at noon (12:00)
  const bgColor     = useRef(new THREE.Color('#4db8f5'))
  const ambRef      = useRef()
  const sunRef      = useRef()
  const moonRef     = useRef()
  const hemiRef     = useRef()
  const starsMatRef = useRef()

  // Star positions — upper hemisphere, fixed for the session
  const starPositions = useMemo(() => {
    const pos = new Float32Array(1400 * 3)
    for (let i = 0; i < 1400; i++) {
      const theta = Math.random() * Math.PI * 2
      const cosv  = Math.random()
      const sinv  = Math.sqrt(1 - cosv * cosv)
      const r     = 80 + Math.random() * 10
      pos[i * 3]     = r * sinv * Math.cos(theta)
      pos[i * 3 + 1] = r * cosv + 5   // all y > 5
      pos[i * 3 + 2] = r * sinv * Math.sin(theta)
    }
    return pos
  }, [])

  // Point scene.background at our managed colour so we only update in-place
  // and add persistent FogExp2 for atmosphere
  useEffect(() => {
    scene.background = bgColor.current
    scene.fog = new THREE.FogExp2('#87ceeb', 0.006)
    return () => { scene.fog = null }
  }, [scene])

  useFrame((_, delta) => {
    clockRef.current = (clockRef.current + delta) % DAY_SECS
    const hour = (clockRef.current / DAY_SECS) * 24

    // ── Shared time state ─────────────────────────────────────────────
    timeWeatherState.timeOfDay = hour
    timeWeatherState.isNight   = hour < 6 || hour >= 20
    timeWeatherState.lampOn    = hour < 6.5 || hour >= 19.5

    // ── Sky background ────────────────────────────────────────────────
    lerpStops(SKY_STOPS, hour, false)   // result in _ca
    bgColor.current.copy(_ca)
    // Darken for weather (cloudy/rainy)
    const gloomy = Math.max(
      timeWeatherState.cloudOpacity * 0.3,
      timeWeatherState.rainIntensity * 0.45,
    )
    bgColor.current.multiplyScalar(1 - gloomy * 0.55)

    // Sync fog color to sky so distant objects blend into the horizon
    if (scene.fog) {
      scene.fog.color.copy(bgColor.current)
      scene.fog.density = timeWeatherState.isNight ? 0.009 : 0.005
    }

    // ── Ambient light ─────────────────────────────────────────────────
    const amb = lerpStops(AMB_STOPS, hour, true)
    const weatherDim = 1 - Math.max(
      timeWeatherState.cloudOpacity * 0.28,
      timeWeatherState.rainIntensity * 0.48,
    )
    if (ambRef.current) {
      ambRef.current.intensity = amb.intensity * weatherDim
      ambRef.current.color.copy(amb.color)
    }

    // Hemisphere light follows ambient intensity (sky-fill light)
    if (hemiRef.current) {
      hemiRef.current.intensity = amb.intensity * 0.55 * weatherDim
      hemiRef.current.color.copy(bgColor.current)
    }

    // ── Sun: arc east→west during 5-20 ───────────────────────────────
    if (sunRef.current) {
      const dayFrac = Math.max(0, Math.min(1, (hour - 5) / 15))
      const arc     = dayFrac * Math.PI
      const sunH    = Math.sin(arc) * 28
      sunRef.current.position.set(Math.cos(arc) * -35, Math.max(0.1, sunH), -8)
      sunRef.current.visible = hour >= 5 && hour < 20
      const edge   = hour < 8 || hour > 17   // golden hour bands
      const intens = Math.max(0, sunH / 28) * 1.4 * (1 - timeWeatherState.rainIntensity * 0.65)
      sunRef.current.intensity = intens
      sunRef.current.color.setRGB(1.0, edge ? 0.72 : 0.97, edge ? 0.42 : 0.88)
    }

    // ── Moon: arc during 19-6 ────────────────────────────────────────
    if (moonRef.current) {
      const nightFrac = hour >= 19 ? (hour - 19) / 11 : (hour + 5) / 11
      const mArc = Math.max(0, Math.min(1, nightFrac)) * Math.PI
      moonRef.current.visible = hour < 6.5 || hour >= 19
      moonRef.current.position.set(
        Math.cos(mArc) * -25, Math.max(0.1, Math.sin(mArc) * 20), -10,
      )
      moonRef.current.intensity = moonRef.current.visible
        ? 0.22 - timeWeatherState.cloudOpacity * 0.14
        : 0
    }

    // ── Ambience (birds / crickets / city hum / synth music) ─────────────
    audioSystem.updateAmbience(
      timeWeatherState.isNight,
      timeWeatherState.rainIntensity,
      false,
      hour,
    )

    // ── Stars opacity ─────────────────────────────────────────────────
    if (starsMatRef.current) {
      let op = 0
      if      (hour < 5.5)   op = 1
      else if (hour < 7)     op = 1 - (hour - 5.5) / 1.5
      else if (hour >= 19.5) op = (hour - 19.5) / 1
      op = Math.max(0, Math.min(1, op)) * (1 - timeWeatherState.cloudOpacity * 0.85)
      starsMatRef.current.opacity = op
    }
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.65} color="#fff8f0" />
      <directionalLight ref={sunRef} position={[-35, 28, -8]} intensity={1.3} color="#fff8dc" />
      <directionalLight ref={moonRef} position={[10, 18, -10]} intensity={0.22} color="#8090c0" />
      <hemisphereLight ref={hemiRef} skyColor="#87ceeb" groundColor="#2d5a1e" intensity={0.35} />
      {/* Night stars — opacity-controlled Points */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={starsMatRef}
          color="#ffffff"
          size={0.45}
          transparent
          opacity={0}
          sizeAttenuation={false}
          depthWrite={false}
        />
      </points>
    </>
  )
}
