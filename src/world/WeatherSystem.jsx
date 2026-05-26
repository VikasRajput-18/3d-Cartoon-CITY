import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { minimapState } from '@/lib/minimapState'
import { audioSystem } from '@/lib/audioSystem'

const RAIN_COUNT   = 2500
const WEATHER_LIST = ['clear', 'cloudy', 'rainy', 'foggy']

// Target values each weather interpolates toward
const WEATHER_PROPS = {
  clear:  { rain: 0, fog: 0,      cloud: 0,   ambMod: 1.0, fogHex: '#c0d0e0' },
  cloudy: { rain: 0, fog: 0.003,  cloud: 0.7, ambMod: 0.75, fogHex: '#a0b0b8' },
  rainy:  { rain: 1, fog: 0.010,  cloud: 0.9, ambMod: 0.5,  fogHex: '#607080' },
  foggy:  { rain: 0, fog: 0.038,  cloud: 0.3, ambMod: 0.6,  fogHex: '#c8d4d8' },
}

const MIN_SECS = 180   // min seconds before weather changes
const MAX_SECS = 300   // max seconds
const TRANS_T  = 12    // transition duration seconds

function pickNext(cur) {
  const opts = WEATHER_LIST.filter(w => w !== cur)
  return opts[Math.floor(Math.random() * opts.length)]
}

// Cloud layout — generated once at module level for stability
const CLOUD_DATA = Array.from({ length: 14 }, () => ({
  x:     (Math.random() - 0.5) * 90,
  y:     16 + Math.random() * 8,
  z:     (Math.random() - 0.5) * 90,
  sx:    9  + Math.random() * 7,
  sy:    2  + Math.random() * 2,
  sz:    6  + Math.random() * 4,
  speed: (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5),
}))

export default function WeatherSystem() {
  const { scene } = useThree()

  // Rain geometry ref (BufferAttribute for needsUpdate)
  const rainAttrRef = useRef()
  const rainMatRef  = useRef()
  const cloudRefs   = useRef([])
  const skyOverRef  = useRef()   // dark overlay for clouds/rain

  // Rain position array — mutable every frame
  const rainPos = useMemo(() => {
    const pos = new Float32Array(RAIN_COUNT * 3)
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 60
      pos[i * 3 + 1] = Math.random() * 40
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60
    }
    return pos
  }, [])

  // Weather state machine refs
  const curWeather  = useRef('clear')
  const nextWeather = useRef(null)
  const transT      = useRef(1)
  const timer       = useRef(0)
  const nextChange  = useRef(MIN_SECS + Math.random() * (MAX_SECS - MIN_SECS))

  // Thunder timer — fires every 30-90 s during heavy rain
  const thunderTimer = useRef(30 + Math.random() * 60)

  // Start shared rain + wind audio sources once
  useEffect(() => {
    audioSystem.startRain()
    return () => { /* rain source keeps running; volume set to 0 via setRainVolume */ }
  }, [])

  const _fogColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    // ── Real-world weather override (from Open-Meteo API) ─────────────
    if (timeWeatherState.forcedWeather && curWeather.current !== timeWeatherState.forcedWeather) {
      nextWeather.current = timeWeatherState.forcedWeather
      transT.current      = 0
      timer.current       = 0
      timeWeatherState.forcedWeather = null
    }

    // ── Weather state machine ─────────────────────────────────────────
    timer.current += delta

    if (nextWeather.current) {
      transT.current = Math.min(1, transT.current + delta / TRANS_T)
      if (transT.current >= 1) {
        curWeather.current  = nextWeather.current
        nextWeather.current = null
        transT.current      = 1
        timer.current       = 0
        nextChange.current  = MIN_SECS + Math.random() * (MAX_SECS - MIN_SECS)
      }
    } else if (timer.current >= nextChange.current) {
      nextWeather.current = pickNext(curWeather.current)
      transT.current      = 0
    }

    const t    = transT.current
    const from = WEATHER_PROPS[curWeather.current]
    const to   = WEATHER_PROPS[nextWeather.current ?? curWeather.current]
    const lerp = (a, b) => a + (b - a) * t

    const rainI  = lerp(from.rain,  to.rain)
    const fogD   = lerp(from.fog,   to.fog)
    const cloudO = lerp(from.cloud, to.cloud)

    // Write to shared state
    timeWeatherState.weather       = nextWeather.current ?? curWeather.current
    timeWeatherState.rainIntensity = rainI
    timeWeatherState.fogDensity    = fogD
    timeWeatherState.cloudOpacity  = cloudO
    timeWeatherState.rainSpeedMult = 1 + rainI * 0.9   // rain → NPCs hurry

    // ── Scene fog ─────────────────────────────────────────────────────
    if (fogD > 0.0005) {
      if (!scene.fog) scene.fog = new THREE.FogExp2('#c0d0e0', fogD)
      scene.fog.density = fogD
      _fogColor.set(from.fogHex).lerp(new THREE.Color(to.fogHex), t)
      scene.fog.color.copy(_fogColor)
    } else {
      scene.fog = null
    }

    // ── Rain particles ────────────────────────────────────────────────
    if (rainMatRef.current) {
      rainMatRef.current.opacity = rainI * 0.62
    }
    if (rainAttrRef.current && rainI > 0.01) {
      const px = minimapState.playerX, pz = minimapState.playerZ
      const pos = rainPos
      for (let i = 0; i < RAIN_COUNT; i++) {
        pos[i * 3 + 1] -= delta * 22
        if (pos[i * 3 + 1] < -4) {
          pos[i * 3]     = px + (Math.random() - 0.5) * 60
          pos[i * 3 + 1] = 36 + Math.random() * 5
          pos[i * 3 + 2] = pz + (Math.random() - 0.5) * 60
        }
      }
      rainAttrRef.current.needsUpdate = true
    }

    // ── Sky overlay (darkens sky for clouds/rain) ─────────────────────
    if (skyOverRef.current) {
      const target = Math.max(cloudO * 0.35, rainI * 0.52)
      skyOverRef.current.opacity +=
        (target - skyOverRef.current.opacity) * Math.min(1, delta * 1.8)
    }

    // ── Cloud drift + opacity ─────────────────────────────────────────
    cloudRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      mesh.position.x += CLOUD_DATA[i].speed * delta
      if (mesh.position.x >  60) mesh.position.x = -60
      if (mesh.position.x < -60) mesh.position.x =  60
      mesh.material.opacity = cloudO * 0.5
    })

    // ── Rain audio ────────────────────────────────────────────────────
    audioSystem.setRainVolume(rainI)

    // ── Thunder (heavy rain only) ─────────────────────────────────────
    if (rainI > 0.75) {
      thunderTimer.current -= delta
      if (thunderTimer.current <= 0) {
        audioSystem.playThunder()
        thunderTimer.current = 30 + Math.random() * 60
      }
    } else {
      // Reset timer so thunder fires relatively soon once rain intensifies
      if (thunderTimer.current > 15) thunderTimer.current = 10 + Math.random() * 20
    }

    // ── Wind (foggy weather) ─────────────────────────────────────────
    const windV = fogD > 0.005 ? Math.min(1, fogD / 0.038) : 0
    if (windV > 0.05) {
      audioSystem.startWind()
      audioSystem.setWindVolume(windV)
    } else {
      audioSystem.stopWind()
    }
  })

  return (
    <>
      {/* Sky darkening overlay for clouds / rain */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[84, 16, 10]} />
        <meshBasicMaterial
          ref={skyOverRef}
          color="#303040"
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Rain particles */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            ref={rainAttrRef}
            attach="attributes-position"
            array={rainPos}
            itemSize={3}
            count={RAIN_COUNT}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={rainMatRef}
          color="#8ab4d0"
          size={0.09}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Cloud meshes */}
      {CLOUD_DATA.map((c, i) => (
        <mesh
          key={i}
          ref={el => { cloudRefs.current[i] = el }}
          position={[c.x, c.y, c.z]}
          scale={[c.sx, c.sy, c.sz]}
          frustumCulled={false}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#c8d0da" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}
