// 3D elements for companion challenges: floating coins (coin-collect), start/finish
// lines + countdown text + companion bike (race). Also drives the per-frame tick.
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { Bike3D } from './Vehicle3D'
import { companionState } from '@/lib/companionState'
import { getCompanion } from '@/lib/companionService'
import { minimapState } from '@/lib/minimapState'
import { onChallengeUpdate, getChallengeState, tick } from '@/lib/companionChallenges'

// Rotating coloured disco lights around the player during a dance battle.
function DiscoLights() {
  const ref = useRef()
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    g.position.set(minimapState.playerX, 0, minimapState.playerZ)
    g.rotation.y = state.clock.elapsedTime * 2
  })
  const cols = ['#f43f5e', '#3b82f6', '#22d3ee', '#facc15']
  return (
    <group ref={ref}>
      {cols.map((c, i) => {
        const a = (i / cols.length) * Math.PI * 2
        return <pointLight key={i} color={c} intensity={6} distance={14} position={[Math.cos(a) * 5, 4, Math.sin(a) * 5]} />
      })}
    </group>
  )
}

function SpinningCoin({ x, z }) {
  const ref = useRef()
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 1.6 })
  return (
    <group position={[x, 0.5, z]}>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.1, 16]} />
        <meshStandardMaterial color="#fde047" emissive="#a16207" emissiveIntensity={0.6} metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.7, 10, 8]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

// Companion bike fading out (opacity 1→0 over 1s) after a race ends, then removed.
function FadingBike({ x, z, color, onDone }) {
  const ref = useRef()
  const op = useRef(1)
  useFrame((_, delta) => {
    op.current -= delta   // ~1s to fade
    const g = ref.current
    if (g) g.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material]
        mats.forEach(m => { m.transparent = true; m.opacity = Math.max(0, op.current) })
      }
    })
    if (op.current <= 0) onDone()
  })
  return <group ref={ref} position={[x, 0, z]}><Bike3D frameColor={color} leanRef={null} dustRef={null} /></group>
}

export default function ChallengeScene() {
  const [st, setSt] = useState(getChallengeState)
  const [fade, setFade] = useState(null)
  const bikeRef = useRef()
  const prevType = useRef(null)
  useEffect(() => onChallengeUpdate(setSt), [])

  // When a race ends, leave a fading bike behind where the companion finished.
  useEffect(() => {
    const wasRace = prevType.current === 'race'
    const nowRace = st.active && st.type === 'race'
    if (wasRace && !nowRace) {
      const c = getCompanion()
      setFade({ x: companionState.x, z: companionState.z, color: c?.outfitColor || '#7c3aed' })
    }
    prevType.current = st.active ? st.type : null
  }, [st.active, st.type])

  useFrame((_, delta) => {
    tick(Math.min(delta, 0.05))
    if (bikeRef.current) bikeRef.current.position.set(companionState.x, 0, companionState.z)
  })

  if (!st.active && !fade) return null
  const comp = getCompanion()

  return (
    <group userData={{ noMerge: true }}>
      {st.active && st.type === 'coin_collect' && st.coins?.map((c, i) => (
        c.by ? null : <SpinningCoin key={i} x={c.x} z={c.z} />
      ))}

      {st.active && st.type === 'race' && (
        <RaceBits st={st} comp={comp} bikeRef={bikeRef} />
      )}

      {st.active && st.type === 'dance_battle' && st.phase === 'running' && <DiscoLights />}

      {fade && <FadingBike x={fade.x} z={fade.z} color={fade.color} onDone={() => setFade(null)} />}
    </group>
  )
}

function RaceBits({ st, comp, bikeRef }) {
  const r = st.race
  // Lines should span across the road (perpendicular to the race axis).
  const zr = r?.axis === 'x' ? Math.PI / 2 : 0
  return (
    <>
      {r && (
        <>
          {/* start line (white) + finish line (gold), oriented across the road */}
          <mesh position={[r.startX, 0.05, r.startZ]} rotation={[-Math.PI / 2, 0, zr]}>
            <planeGeometry args={[14, 1.2]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          <mesh position={[r.finishX, 0.05, r.finishZ]} rotation={[-Math.PI / 2, 0, zr]}>
            <planeGeometry args={[14, 1.6]} />
            <meshBasicMaterial color="#facc15" transparent opacity={0.85} />
          </mesh>
          <Billboard position={[r.finishX, 3, r.finishZ]}>
            <Text fontSize={0.9} color="#facc15" anchorX="center" anchorY="middle" outlineWidth={0.06} outlineColor="#000">🏁 FINISH</Text>
          </Billboard>
        </>
      )}
      {st.countdown > 0 && (
        <Billboard position={[st.race?.startX || 0, 4, st.race?.startZ || 0]}>
          <Text fontSize={3} color="#facc15" anchorX="center" anchorY="middle" outlineWidth={0.15} outlineColor="#000">
            {String(st.countdown)}
          </Text>
        </Billboard>
      )}
      {/* companion bike rides under the companion during the race */}
      <group ref={bikeRef}>
        <Bike3D frameColor={comp?.outfitColor || '#7c3aed'} leanRef={null} dustRef={null} />
      </group>
    </>
  )
}
