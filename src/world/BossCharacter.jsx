import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { onBossUpdate, getBossState } from '@/lib/bossState'

const BOSS_POS = [3, 0, 3]

function BossMesh({ flashRef, scaleRef }) {
  const bodyColor = '#1a0a2e'
  const accentColor = '#7c0000'

  return (
    <group>
      {/* Body */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[1.4, 2.2, 0.9]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 3.3, 0]}>
        <boxGeometry args={[1.1, 1.1, 1.0]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      {/* Eyes — glowing red */}
      {[[-0.22, 3.38, 0.51], [0.22, 3.38, 0.51]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.12, 6, 4]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
      {/* Cape / shoulders */}
      <mesh position={[0, 2.6, -0.1]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[2.0, 1.5, 0.12]} />
        <meshToonMaterial color={accentColor} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.9, 2.0, 0]}>
        <boxGeometry args={[0.5, 1.6, 0.5]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0.9, 2.0, 0]}>
        <boxGeometry args={[0.5, 1.6, 0.5]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.34, 0.6, 0]}>
        <boxGeometry args={[0.52, 1.2, 0.52]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0.34, 0.6, 0]}>
        <boxGeometry args={[0.52, 1.2, 0.52]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      {/* Red aura point light */}
      <pointLight color="#ff2200" intensity={2.5} distance={8} />
    </group>
  )
}

export default function BossCharacter() {
  const [boss, setBoss]   = useState(getBossState())
  const [taunt, setTaunt] = useState('')
  const [dead,  setDead]  = useState(false)

  const groupRef  = useRef()
  const flashRef  = useRef(false)
  const scaleRef  = useRef(1)
  const tauntTimer = useRef(0)

  useEffect(() => {
    return onBossUpdate((b) => {
      setBoss(b)
      if (b.isDefeated && !dead) setDead(true)
    })
  }, [])

  // Random taunts via localStorage (avoid calling Groq from within R3F)
  useEffect(() => {
    if (!boss.isActive) return
    const TAUNTS = [
      'Tum sab mere liye kuch nahi ho!',
      'Cartoon City mera hai ab!',
      'Koi nahi jeet sakta mujhse!',
      'Ha ha ha... bahut cute lagta hai tumhara try!',
      'Main Shadow Vendor hoon, main kabhi nahi harunga!',
    ]
    const id = setInterval(() => {
      setTaunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)])
      setTimeout(() => setTaunt(''), 5000)
    }, 20000)
    // First taunt after 5s
    const t0 = setTimeout(() => setTaunt(TAUNTS[0]), 5000)
    return () => { clearInterval(id); clearTimeout(t0) }
  }, [boss.isActive])

  // Listen for flash-on-attack
  useEffect(() => {
    const handler = () => {
      flashRef.current = true
      setTimeout(() => { flashRef.current = false }, 200)
    }
    window.addEventListener('boss-hit', handler)
    return () => window.removeEventListener('boss-hit', handler)
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (dead) {
      // Death animation: spin and shrink
      scaleRef.current = Math.max(0, scaleRef.current - delta * 0.8)
      groupRef.current.rotation.y += delta * 4
      groupRef.current.scale.setScalar(scaleRef.current)
      return
    }

    if (!boss.isActive) return

    // Idle rotation + pulse
    tauntTimer.current += delta
    groupRef.current.rotation.y += delta * 0.6
    const pulse = 1 + Math.sin(tauntTimer.current * 2) * 0.04
    groupRef.current.scale.setScalar(pulse)
  })

  if (!boss.isActive && !dead) return null

  return (
    <group ref={groupRef} position={BOSS_POS}>
      <BossMesh flashRef={flashRef} scaleRef={scaleRef} />

      {/* Name billboard */}
      <Billboard position={[0, 5.2, 0]}>
        <Text fontSize={0.28} color="#ef4444" anchorX="center" fontWeight={800}>
          💀 {boss.bossName}
        </Text>
        <Text fontSize={0.18} color="#f97316" anchorX="center" position={[0, -0.38, 0]}>
          Week 1 Boss
        </Text>
      </Billboard>

      {/* Taunt bubble */}
      {taunt && (
        <Billboard position={[0, 4.6, 0]}>
          <Text fontSize={0.18} color="#fca5a5" anchorX="center" maxWidth={4} textAlign="center">
            "{taunt}"
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export { BOSS_POS }
