import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { audioSystem } from '@/lib/audioSystem'

// Real-world time drives day/night — no fake clock needed

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

// Ambient light stops [hour, intensity, colour] — night minimum is 0.3 for playability
const AMB_STOPS = [
  [0,    0.30, '#7080b0'],
  [5,    0.32, '#8090a8'],
  [5.5,  0.40, '#ff9060'],
  [6,    0.42, '#ffb080'],
  [7,    0.58, '#fff5e8'],
  [9,    0.65, '#fff8f0'],
  [12,   0.70, '#fff5e0'],
  [17,   0.65, '#ffe8d0'],
  [18,   0.42, '#ff8040'],
  [18.9, 0.35, '#9060c0'],
  [20,   0.30, '#4060c0'],
  [24,   0.30, '#7080b0'],
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

  const bgColor      = useRef(new THREE.Color('#4db8f5'))
  const ambRef       = useRef()
  const sunRef       = useRef()
  const moonRef      = useRef()
  const hemiRef      = useRef()
  const starsMatRef  = useRef()
  const moonSphereRef= useRef()
  const moonHaloRef  = useRef()

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

  useFrame(() => {
    // ── Real-world time — update every frame so sun/moon track smoothly ──
    const now  = new Date()
    const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600

    // ── Shared time state ─────────────────────────────────────────────
    timeWeatherState.timeOfDay = hour
    timeWeatherState.isNight   = hour < 6 || hour >= 20
    timeWeatherState.lampOn    = hour < 7 || hour >= 19

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

    // Hemisphere light — daytime follows sky, night uses deep blue tones
    if (hemiRef.current) {
      const isNight = hour < 6.5 || hour >= 19.5
      hemiRef.current.intensity = isNight ? 0.4 * weatherDim : amb.intensity * 0.55 * weatherDim
      if (isNight) {
        hemiRef.current.color.set('#1a1a3e')
        hemiRef.current.groundColor?.set('#0a0a1e')
      } else {
        hemiRef.current.color.copy(bgColor.current)
      }
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
    const moonVisible = hour < 6.5 || hour >= 19
    const nightFrac   = hour >= 19 ? (hour - 19) / 11 : (hour + 5) / 11
    const mArc        = Math.max(0, Math.min(1, nightFrac)) * Math.PI
    const moonX       = Math.cos(mArc) * -25
    const moonY       = Math.max(3, Math.sin(mArc) * 40)
    const moonZ       = -10
    const moonIntens  = moonVisible ? Math.max(0, 0.4 - timeWeatherState.cloudOpacity * 0.18) : 0

    if (moonRef.current) {
      moonRef.current.visible = moonVisible
      moonRef.current.position.set(moonX, moonY, moonZ)
      moonRef.current.intensity = moonIntens
    }
    if (moonSphereRef.current) {
      moonSphereRef.current.visible = moonVisible
      moonSphereRef.current.position.set(moonX, moonY, moonZ)
    }
    if (moonHaloRef.current) {
      moonHaloRef.current.visible = moonVisible
      moonHaloRef.current.position.set(moonX, moonY, moonZ)
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
      {/* Moonlight — position tracks the moon sphere in useFrame */}
      <directionalLight ref={moonRef} position={[-25, 40, -10]} intensity={0.4} color="#B0C4DE" castShadow={false} />
      <hemisphereLight ref={hemiRef} skyColor="#87ceeb" groundColor="#2d5a1e" intensity={0.35} />
      {/* Visible moon sphere */}
      <mesh ref={moonSphereRef} position={[-25, 40, -10]}>
        <sphereGeometry args={[2, 16, 12]} />
        <meshStandardMaterial color="#f0f4ff" emissive="#d0dcff" emissiveIntensity={1.8} roughness={0.8} metalness={0} />
      </mesh>
      {/* Moon glow halo — slightly larger transparent sphere */}
      <mesh ref={moonHaloRef} position={[-25, 40, -10]}>
        <sphereGeometry args={[3.2, 16, 12]} />
        <meshStandardMaterial color="#b0c4de" transparent opacity={0.12} emissive="#a0b8e0" emissiveIntensity={0.6} depthWrite={false} />
      </mesh>
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
