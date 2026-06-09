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

  useEffect(() => onCompanionUpdate(setComp), [])

  // Listen for event-driven reactions (mission complete, vehicle enter, level up).
  useEffect(() => {
    const say = (text) => { setBubble(text); bubbleT.current = 4 }
    const onMission = () => say('Waah! Mission clear, tu toh star hai! 🎉')
    const onVehicle = () => say('Arey mujhe bhi le chalo na! 🚗')
    const onLevel   = (e) => say(`Level ${e.detail.level}! Hum dono grow kar rahe hain 💪`)
    window.addEventListener('mission-completed', onMission)
    window.addEventListener('local-entered-vehicle', onVehicle)
    window.addEventListener('companion-levelup', onLevel)
    return () => {
      window.removeEventListener('mission-completed', onMission)
      window.removeEventListener('local-entered-vehicle', onVehicle)
      window.removeEventListener('companion-levelup', onLevel)
    }
  }, [])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g || !comp) return
    const dt = Math.min(delta, 0.05)

    // Target = player position + offset rotated by player facing.
    const f = minimapState.playerFacing
    const sin = Math.sin(f), cos = Math.cos(f)
    const tx = minimapState.playerX + (OFFSET_X * cos + OFFSET_Z * sin)
    const tz = minimapState.playerZ + (-OFFSET_X * sin + OFFSET_Z * cos)

    if (!inited.current) { g.position.set(tx, 0, tz); inited.current = true }
    // Smooth follow (no teleport).
    const k = Math.min(1, dt * 6)
    g.position.x += (tx - g.position.x) * k
    g.position.z += (tz - g.position.z) * k
    // Face the same way as the player.
    let dy = f - g.rotation.y
    while (dy > Math.PI) dy -= 2 * Math.PI
    while (dy < -Math.PI) dy += 2 * Math.PI
    g.rotation.y += dy * Math.min(1, dt * 8)

    // Walking when actually moving.
    const moved = g.position.distanceToSquared(lastPos.current) > 0.0004
    lastPos.current.copy(g.position)
    if (moved !== walkingRef.current) { walkingRef.current = moved; setWalking(moved) }

    // Bubble lifetime.
    if (bubbleT.current > 0) { bubbleT.current -= dt; if (bubbleT.current <= 0) setBubble('') }

    // Spontaneous line every 20-50s (only when not already talking).
    talkAcc.current += dt
    if (talkAcc.current >= nextTalk.current && bubbleT.current <= 0) {
      talkAcc.current = 0
      nextTalk.current = 30 + Math.random() * 30
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
      <Avatar3D
        externalControl
        walking={walking}
        skin={comp.skinColor}
        outfitColorOverride={comp.outfitColor}
      />
      <Billboard position={[0, 2.3, 0]}>
        <Text fontSize={0.2} color="#f9a8d4" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          {`💗 ${comp.name}`}
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
