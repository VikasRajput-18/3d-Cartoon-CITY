// 3D renderers for city-wide live events. Mounted once inside WorldScene; only
// the currently-active event renders anything. All particle effects are a SINGLE
// THREE.Points (1 draw call) and only exist while their event runs, so this adds
// near-zero cost when idle — important given the FPS budget.
import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { getLiveEventState, onLiveEventUpdate, treasureLocationForActive, collectRainCoin } from '@/lib/liveEventState'
import { minimapState, npcLivePositions } from '@/lib/minimapState'

// ── Meteor shower — streaks falling diagonally across the sky ─────────────────
function MeteorShower() {
  const COUNT = 60
  const ref = useRef()
  const { positions, vel } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const vel = []
    for (let i = 0; i < COUNT; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 200
      positions[i*3+1] = 40 + Math.random() * 40
      positions[i*3+2] = (Math.random() - 0.5) * 200
      vel.push(0.6 + Math.random() * 0.8)
    }
    return { positions, vel }
  }, [])
  useFrame((_, delta) => {
    const g = ref.current
    if (!g) return
    const p = g.geometry.attributes.position.array
    const dt = Math.min(delta, 0.05) * 60
    for (let i = 0; i < COUNT; i++) {
      p[i*3]   -= vel[i] * dt           // drift in X (diagonal)
      p[i*3+1] -= vel[i] * 1.6 * dt     // fall in Y
      if (p[i*3+1] < 0) {
        p[i*3]   = (Math.random() - 0.5) * 200
        p[i*3+1] = 60 + Math.random() * 30
        p[i*3+2] = (Math.random() - 0.5) * 200
      }
    }
    g.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#dbb4ff" size={1.4} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

// ── Snowfall — gentle drifting flakes over the city ───────────────────────────
function Snowfall() {
  const COUNT = 700
  const ref = useRef()
  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const drift = []
    for (let i = 0; i < COUNT; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 180
      positions[i*3+1] = Math.random() * 50
      positions[i*3+2] = (Math.random() - 0.5) * 180
      drift.push(Math.random() * Math.PI * 2)
    }
    return { positions, drift }
  }, [])
  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    const p = g.geometry.attributes.position.array
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    for (let i = 0; i < COUNT; i++) {
      p[i*3+1] -= 3 * dt
      p[i*3]   += Math.sin(t + drift[i]) * 0.4 * dt
      if (p[i*3+1] < 0) p[i*3+1] = 50
    }
    g.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.5} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  )
}

// ── Flash mob — a ring of pulsing music-note billboards around the plaza ──────
// (NPCs animate via their own emote system; this adds the celebratory visuals.)
function FlashMob() {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.2
      ref.current.scale.setScalar(s)
      ref.current.rotation.y = state.clock.elapsedTime * 0.6
    }
  })
  const notes = ['🎵', '🎶', '🕺', '💃', '🎉', '✨', '🎵', '🎶']
  return (
    <group ref={ref} position={[0, 0, 0]}>
      {notes.map((n, i) => {
        const a = (i / notes.length) * Math.PI * 2
        return (
          <Billboard key={i} position={[Math.cos(a) * 6, 2.5 + Math.sin(i) * 0.5, Math.sin(a) * 6]}>
            <Text fontSize={0.9} anchorX="center" anchorY="middle">{n}</Text>
          </Billboard>
        )
      })}
    </group>
  )
}

// ── Treasure chest — glowing golden chest; first to reach it + press F claims ──
function TreasureChest() {
  const loc = treasureLocationForActive()
  const glowRef = useRef()
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 3) * 0.25
    }
    if (loc) {
      const d = Math.hypot(minimapState.playerX - loc.x, minimapState.playerZ - loc.z)
      const isNear = d < 3
      if (isNear !== nearRef.current) { nearRef.current = isNear; setNear(isNear) }
    }
  })
  // Press F while in range → Game.jsx claims with the player's name.
  useEffect(() => {
    if (!near) return
    const onKey = (e) => { if (e.code === 'KeyF') window.dispatchEvent(new CustomEvent('request-claim-treasure')) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [near])
  if (!loc) return null
  return (
    <group position={[loc.x, 0, loc.z]} userData={{ noMerge: true }}>
      {/* chest body */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.1, 0.7, 0.8]} />
        <meshToonMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.15, 0.25, 0.85]} />
        <meshToonMaterial color="#a0703a" />
      </mesh>
      <mesh position={[0, 0.5, 0.42]}>
        <boxGeometry args={[0.2, 0.25, 0.05]} />
        <meshToonMaterial color="#facc15" />
      </mesh>
      {/* glow column */}
      <mesh ref={glowRef} position={[0, 3, 0]}>
        <cylinderGeometry args={[0.5, 0.9, 6, 8, 1, true]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 2, 0]}>
        <Text fontSize={0.5} anchorX="center" anchorY="middle">💎</Text>
        {near && (
          <Text fontSize={0.32} color="#facc15" anchorX="center" anchorY="middle"
            position={[0, 0.7, 0]} outlineWidth={0.03} outlineColor="#000">
            Press F to claim!
          </Text>
        )}
      </Billboard>
    </group>
  )
}

// ── Coin rain — 30 spinning coins fall, walk over them to collect (5–15 each) ──
function CoinRain() {
  const COUNT = 30
  const meshRefs = useRef([])
  const coins = useMemo(() => Array.from({ length: COUNT }, () => ({
    x: (Math.random() - 0.5) * 80,
    z: (Math.random() - 0.5) * 80,
    y: 22 + Math.random() * 30,
    spin: Math.random() * Math.PI * 2,
    collected: false,
  })), [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i]; const m = meshRefs.current[i]
      if (!m) continue
      if (c.collected) { m.visible = false; continue }
      if (c.y > 0.5) c.y = Math.max(0.5, c.y - 7 * dt)   // descend then rest on ground
      c.spin += dt * 4
      m.position.set(c.x, c.y, c.z)
      m.rotation.y = c.spin
      m.visible = true
      const d = Math.hypot(minimapState.playerX - c.x, minimapState.playerZ - c.z)
      if (c.y <= 0.7 && d < 1.5) {
        c.collected = true; m.visible = false
        const amt = collectRainCoin()
        if (amt > 0) window.dispatchEvent(new CustomEvent('live-event-reward', { detail: { amount: amt, reason: 'Coin collected' } }))
      }
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {coins.map((c, i) => (
        <mesh key={i} ref={el => { meshRefs.current[i] = el }} position={[c.x, c.y, c.z]}>
          <cylinderGeometry args={[0.4, 0.4, 0.08, 16]} />
          <meshStandardMaterial color="#fde047" emissive="#a16207" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// ── Mystery visitor — golden NPC at city centre; press F to talk (first 5 win) ──
function MysteryVisitor() {
  const bobRef = useRef()
  const starRef = useRef()
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (bobRef.current) bobRef.current.position.y = 0.05 + Math.sin(t * 1.5) * 0.06
    if (starRef.current) starRef.current.rotation.y = t * 1.5
    const d = Math.hypot(minimapState.playerX, minimapState.playerZ)   // centre is (0,0)
    const isNear = d < 3.5
    if (isNear !== nearRef.current) { nearRef.current = isNear; setNear(isNear) }
  })
  useEffect(() => {
    if (!near) return
    const onKey = (e) => { if (e.code === 'KeyF') window.dispatchEvent(new CustomEvent('request-talk-visitor')) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [near])
  return (
    <group position={[0, 0, 0]} userData={{ noMerge: true }}>
      <group ref={bobRef}>
        {/* golden robed body */}
        <mesh position={[0, 0.7, 0]}>
          <coneGeometry args={[0.5, 1.4, 10]} />
          <meshStandardMaterial color="#facc15" emissive="#a16207" emissiveIntensity={0.35} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color="#fde68a" emissive="#a16207" emissiveIntensity={0.25} />
        </mesh>
      </group>
      {/* spinning star above */}
      <mesh ref={starRef} position={[0, 2.2, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshBasicMaterial color="#fffbeb" />
      </mesh>
      <Billboard position={[0, 2.7, 0]}>
        <Text fontSize={0.26} color="#fde047" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#000">
          🌟 Mystery Visitor
        </Text>
        {near && (
          <Text fontSize={0.3} color="#22d3ee" anchorX="center" anchorY="middle"
            position={[0, -0.4, 0]} outlineWidth={0.03} outlineColor="#000">
            Press F to talk
          </Text>
        )}
      </Billboard>
    </group>
  )
}

// ── Mystery NPC — a cloaked figure in the plaza with a clue billboard ─────────
function MysteryNPC() {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) ref.current.position.y = 0.05 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05
  })
  return (
    <group position={[3, 0, 8]}>
      <group ref={ref}>
        {/* cloak body */}
        <mesh position={[0, 0.7, 0]}>
          <coneGeometry args={[0.5, 1.4, 8]} />
          <meshToonMaterial color="#1e1b4b" />
        </mesh>
        {/* hood/head */}
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.28, 10, 8]} />
          <meshToonMaterial color="#0f0c29" />
        </mesh>
        {/* glowing eyes */}
        <mesh position={[-0.1, 1.52, 0.24]}><sphereGeometry args={[0.04, 6, 6]} /><meshBasicMaterial color="#22d3ee" /></mesh>
        <mesh position={[0.1, 1.52, 0.24]}><sphereGeometry args={[0.04, 6, 6]} /><meshBasicMaterial color="#22d3ee" /></mesh>
      </group>
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.22} color="#22d3ee" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
          ??? The Stranger
        </Text>
        <Text fontSize={0.14} color="#94a3b8" anchorX="center" anchorY="middle" position={[0, -0.3, 0]}>
          "Seek what glows when the city sleeps…"
        </Text>
      </Billboard>
    </group>
  )
}

// ── Master switch ─────────────────────────────────────────────────────────────
export default function LiveEvents() {
  const [evt, setEvt] = useState(() => getLiveEventState().active)
  useEffect(() => onLiveEventUpdate(s => setEvt(s.active)), [])

  if (!evt) return null
  switch (evt.id) {
    case 'meteor_shower':   return <MeteorShower />
    case 'snowfall':        return <Snowfall />
    case 'flash_mob':
    case 'npc_festival':    return <FlashMob />
    case 'treasure_hunt':   return <TreasureChest />
    case 'mystery_npc':     return <MysteryNPC />
    case 'mystery_visitor': return <MysteryVisitor />
    case 'coin_rain':       return <CoinRain />
    // double_coins / speed_boost / community_challenge are HUD-only (no 3D scene)
    default:                return null
  }
}
