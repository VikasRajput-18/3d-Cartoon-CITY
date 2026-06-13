// Cinematic intro camera rig — drives the camera through eased keyframe phases:
// high skyline → sweep down → orbit the plaza fountain → glide to behind the
// player. While mounted, introState.active makes PlayerController skip its own
// camera writes. Forces golden hour via timeWeatherState.hourOverride and blends
// back to real time at the end.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { introState } from '@/lib/introState'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { minimapState } from '@/lib/minimapState'

const DUR = 16          // seconds of camera motion
const GOLDEN = 17.8

const ease = (t) => t * t * (3 - 2 * t)                       // smoothstep
const lerp3 = (a, b, t, out) => out.set(
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

export default function IntroCameraRig({ playing, onDone }) {
  const { camera } = useThree()
  const t0 = useRef(null)
  const doneRef = useRef(false)
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const blendOut = useRef(null)   // golden-hour → real-time blend after control returns

  useEffect(() => {
    if (playing) {
      introState.active = true
      timeWeatherState.hourOverride = GOLDEN
      t0.current = null
      doneRef.current = false
    }
    return () => {
      introState.active = false
      if (!blendOut.current) timeWeatherState.hourOverride = null
    }
  }, [playing])

  useFrame((state, delta) => {
    // Post-intro: blend the forced golden hour back to real time over ~3s
    if (blendOut.current !== null) {
      const real = new Date()
      const realHour = real.getHours() + real.getMinutes() / 60
      const cur = timeWeatherState.hourOverride
      if (cur === null || cur === undefined) { blendOut.current = null; return }
      // shortest direction around the 24h clock
      let diff = realHour - cur
      if (diff > 12) diff -= 24
      if (diff < -12) diff += 24
      const next = cur + diff * Math.min(1, delta * 0.8)
      if (Math.abs(diff) < 0.05) { timeWeatherState.hourOverride = null; blendOut.current = null }
      else timeWeatherState.hourOverride = ((next % 24) + 24) % 24
      return
    }
    if (!playing || doneRef.current) return
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - t0.current) / DUR   // 0..1

    const px = minimapState.playerX, pz = minimapState.playerZ
    const behind = [px + Math.sin(Math.PI) * 0, 4.2, pz + 9]   // settle point behind spawn

    if (t < 0.22) {
      // Phase 1: high skyline → sweeping down toward the city
      const k = ease(t / 0.22)
      lerp3([10, 135, 165], [55, 55, 80], k, pos.current)
      lerp3([0, 0, 0], [0, 4, 0], k, look.current)
    } else if (t < 0.62) {
      // Phase 2: gentle orbit around the fountain plaza
      const k = ease((t - 0.22) / 0.4)
      const ang = Math.PI * 0.35 + k * Math.PI * 1.05
      const r = 30 - k * 6
      pos.current.set(Math.cos(ang) * r, 14 - k * 5, Math.sin(ang) * r)
      look.current.set(0, 1.5, 0)
    } else if (t < 0.97) {
      // Phase 3: glide from the plaza out toward the player's spawn
      const k = ease((t - 0.62) / 0.35)
      const orbEnd = [Math.cos(Math.PI * 1.4) * 24, 9, Math.sin(Math.PI * 1.4) * 24]
      lerp3(orbEnd, behind, k, pos.current)
      lerp3([0, 1.5, 0], [px, 1.2, pz], k, look.current)
    } else if (!doneRef.current) {
      doneRef.current = true
      blendOut.current = true      // start blending time back
      onDone?.()
    }

    if (!doneRef.current) {
      camera.position.copy(pos.current)
      camera.lookAt(look.current)
    }
  })

  return null
}
