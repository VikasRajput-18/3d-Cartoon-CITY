// The player's AI companion as a visible character that follows them around the
// city, with a name label, speech bubbles (Groq-generated), and simple idle quips.
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import Avatar3D from './Avatar3D'
import { minimapState } from '@/lib/minimapState'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { getEconomyState } from '@/lib/economyState'
import { getCompanion, onCompanionUpdate, generateLine } from '@/lib/companionService'
import { companionState } from '@/lib/companionState'

const OFFSET_X = -1.5
const OFFSET_Z = 1.5

export default function Companion3D() {
  const groupRef = useRef()
  const [comp, setComp] = useState(getCompanion)
  const [bubble, setBubble] = useState('')
  const lastPos = useRef(new THREE.Vector3())
  const walkingRef = useRef(false)
  const [walking, setWalking] = useState(false)
  const nextTalk = useRef(20 + Math.random() * 30)   // seconds until next spontaneous line
  const talkAcc = useRef(0)
  const bubbleT = useRef(0)
  const inited = useRef(false)
  const hiddenAppliedRef = useRef(false)
  const moodRef = useRef()

  useEffect(() => onCompanionUpdate(setComp), [])

  // Listen for event-driven reactions (mission complete, vehicle enter, level up).
  useEffect(() => {
    const say = (text) => { setBubble(text); bubbleT.current = 4 }
    const onMission = () => say('Waah! Mission clear, tu toh star hai! 🎉')
    const onVehicle = () => say('Arey mujhe bhi le chalo na! 🚗')
    const onLevel   = (e) => say(`Level ${e.detail.level}! Hum dono grow kar rahe hain 💪`)
    const onSay     = (e) => say(e.detail.text)
    window.addEventListener('mission-completed', onMission)
    window.addEventListener('local-entered-vehicle', onVehicle)
    window.addEventListener('companion-levelup', onLevel)
    window.addEventListener('companion-say', onSay)
    return () => {
      window.removeEventListener('mission-completed', onMission)
      window.removeEventListener('local-entered-vehicle', onVehicle)
      window.removeEventListener('companion-levelup', onLevel)
      window.removeEventListener('companion-say', onSay)
    }
  }, [])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g || !comp) return
    const dt = Math.min(delta, 0.05)

    // Target: a challenge override (coin-collect / hide / race) takes priority,
    // otherwise follow the player at an offset rotated by their facing.
    const f = minimapState.playerFacing
    const ov = companionState.targetOverride
    let tx, tz, faceYaw
    if (ov) {
      tx = ov.x; tz = ov.z
      faceYaw = Math.atan2(ov.x - g.position.x, ov.z - g.position.z)
    } else {
      const sin = Math.sin(f), cos = Math.cos(f)
      tx = minimapState.playerX + (OFFSET_X * cos + OFFSET_Z * sin)
      tz = minimapState.playerZ + (-OFFSET_X * sin + OFFSET_Z * cos)
      faceYaw = f
    }

    if (!inited.current) { g.position.set(tx, 0, tz); inited.current = true }
    // Move toward target. Override uses an absolute speed; following uses a smooth lerp.
    if (ov) {
      const dx = tx - g.position.x, dz = tz - g.position.z
      const d = Math.hypot(dx, dz)
      const step = (ov.speed || 6) * dt
      if (d > 0.05) { g.position.x += (dx / d) * Math.min(step, d); g.position.z += (dz / d) * Math.min(step, d) }
    } else {
      const k = Math.min(1, dt * 6)
      g.position.x += (tx - g.position.x) * k
      g.position.z += (tz - g.position.z) * k
    }
    // Publish live position for the challenge system.
    companionState.x = g.position.x
    companionState.z = g.position.z
    // Sit up on the bike during a race.
    g.position.y = companionState.riding ? 0.5 : 0

    // Facing.
    let dy = faceYaw - g.rotation.y
    while (dy > Math.PI) dy -= 2 * Math.PI
    while (dy < -Math.PI) dy += 2 * Math.PI
    g.rotation.y += dy * Math.min(1, dt * 8)

    // Walking when actually moving.
    const moved = g.position.distanceToSquared(lastPos.current) > 0.0004
    lastPos.current.copy(g.position)
    if (moved !== walkingRef.current) { walkingRef.current = moved; setWalking(moved) }

    // ── Visibility enforcement — the SAME bug the player had ─────────────────
    // CityMerger disposes un-flagged opaque meshes 3s after load, which ate the
    // companion's body and left only the eye-shine. Flag every mesh each frame
    // (isCompanion/noMerge/dynamic) and force solid materials fully opaque.
    // Skipped while hide-and-seek has the companion intentionally ghosted.
    g.traverse(c => {
      if (!c.isMesh || !c.material) return
      c.visible = true
      c.userData.isCompanion = true
      c.userData.noMerge  = true   // CityMerger: NEVER merge/dispose
      c.userData.dynamic  = true
      c.userData._keepPBR = true   // ToonStyle: leave these materials alone
      if (!companionState.hidden) {
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => {
          if (m.depthWrite === false) return            // shadow disc / eye shine
          if (m.transparent || m.opacity !== 1) {
            m.transparent = false
            m.opacity = 1
            m.depthWrite = true
            m.needsUpdate = true
          }
        })
      }
    })

    // Hide-and-seek transparency.
    if (companionState.hidden !== hiddenAppliedRef.current) {
      hiddenAppliedRef.current = companionState.hidden
      g.traverse(c => {
        if (!c.isMesh || !c.material) return
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => { m.transparent = companionState.hidden; m.opacity = companionState.hidden ? 0.3 : 1; m.needsUpdate = true })
      })
    }

    // Bubble lifetime.
    if (bubbleT.current > 0) { bubbleT.current -= dt; if (bubbleT.current <= 0) setBubble('') }

    // Mood animation: excited bounces, sleepy sways, others settle to neutral.
    if (moodRef.current) {
      const t = state.clock.elapsedTime
      const mood = comp.mood
      if (mood === 'excited')      { moodRef.current.position.y = Math.abs(Math.sin(t * 5)) * 0.12; moodRef.current.rotation.z = 0 }
      else if (mood === 'sleepy')  { moodRef.current.rotation.z = Math.sin(t * 1.2) * 0.12; moodRef.current.position.y = 0 }
      else if (mood === 'playful') { moodRef.current.rotation.z = Math.sin(t * 4) * 0.08; moodRef.current.position.y = 0 }
      else { moodRef.current.position.y += (0 - moodRef.current.position.y) * Math.min(1, dt * 6); moodRef.current.rotation.z += (0 - moodRef.current.rotation.z) * Math.min(1, dt * 6) }
    }

    // Spontaneous line — frequency depends on mood (excited talks more, sleepy less).
    talkAcc.current += dt
    if (talkAcc.current >= nextTalk.current && bubbleT.current <= 0) {
      talkAcc.current = 0
      const base = comp.mood === 'excited' ? 14 : comp.mood === 'sleepy' ? 50 : comp.mood === 'bored' ? 18 : 30
      nextTalk.current = base + Math.random() * 30
      const ctx = {
        time: timeWeatherState.isNight ? 'night' : 'day',
        weather: timeWeatherState.weather || 'clear',
        coins: getEconomyState().coins,
        location: 'the city',
      }
      generateLine(ctx).then(line => { if (line) { setBubble(line); bubbleT.current = 4 } })
    }
  })

  if (!comp || comp.visible === false) return null

  return (
    <group ref={groupRef}>
      <group ref={moodRef}>
        <Avatar3D
          externalControl
          walking={walking}
          skin={comp.skinColor || '#FDBCB4'}
          outfitColorOverride={comp.outfitColor || '#FF6B6B'}
        />
      </group>
      <Billboard position={[0, 2.3, 0]}>
        <Text fontSize={0.2} color="#f9a8d4" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          {`${comp.moodEmoji || '💗'} ${comp.name}`}
        </Text>
        {bubble && (
          <Text fontSize={0.16} color="#fff" anchorX="center" anchorY="middle" position={[0, 0.42, 0]}
            maxWidth={4} outlineWidth={0.015} outlineColor="#000">
            {`💬 ${bubble}`}
          </Text>
        )}
      </Billboard>
    </group>
  )
}
