import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { onGameUpdate, getLeaderboard, GAME_IDS, GAME_NAMES, GAME_EMOJIS } from '@/lib/gameState'

// Building position
export const GAME_AREA_POS = [22, 0, -10]
export const GAME_AREA_ID  = 'gamearea'

// Neon flicker helper
function useBillboardData() {
  const [gameIdx, setGameIdx] = useState(0)
  const [entries, setEntries] = useState([])
  const [, forceUpdate]       = useState(0)

  useEffect(() => {
    const unsub = onGameUpdate(() => forceUpdate(n => n + 1))
    return unsub
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setGameIdx(i => (i + 1) % GAME_IDS.length)
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const gameId = GAME_IDS[gameIdx]
  const lb     = getLeaderboard(gameId).slice(0, 5)

  return { gameId, gameIdx, lb }
}

// ── Billboard display (3D) ────────────────────────────────────────────────────
function ArcadeBillboard({ position }) {
  const { gameId, lb } = useBillboardData()
  const glowRef = useRef()
  const poleRef = useRef()

  useFrame(({ clock }) => {
    // Neon pulse glow
    if (glowRef.current) {
      const t = clock.elapsedTime
      glowRef.current.material.opacity = 0.55 + Math.sin(t * 2.4) * 0.18
    }
  })

  const [px, py, pz] = position

  return (
    <group position={[px, 0, pz]}>
      {/* Pole */}
      <mesh ref={poleRef} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 8, 8]} />
        <meshToonMaterial color="#334155" />
      </mesh>

      {/* Screen back */}
      <mesh position={[0, 9, 0]}>
        <boxGeometry args={[5.5, 3.5, 0.2]} />
        <meshToonMaterial color="#0f172a" />
      </mesh>

      {/* Neon border glow */}
      <mesh ref={glowRef} position={[0, 9, 0.12]}>
        <planeGeometry args={[5.8, 3.8]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* Screen face */}
      <mesh position={[0, 9, 0.14]}>
        <planeGeometry args={[5.2, 3.2]} />
        <meshBasicMaterial color="#0a0a1a" />
      </mesh>

      {/* Billboard text */}
      <Billboard position={[0, 9, 0.25]}>
        {/* Title */}
        <Text fontSize={0.28} color="#facc15" fontWeight="bold" anchorX="center" anchorY="top" position={[0, 1.4, 0]}>
          {`${GAME_EMOJIS[gameId]} ${GAME_NAMES[gameId]} Top 5`}
        </Text>
        {/* Scores */}
        {lb.length === 0 && (
          <Text fontSize={0.18} color="#475569" anchorX="center" anchorY="middle" position={[0, 0.2, 0]}>
            No scores yet — play now!
          </Text>
        )}
        {lb.map((entry, i) => (
          <Text key={i} fontSize={0.19} color={i === 0 ? '#facc15' : '#e2e8f0'} anchorX="left" anchorY="middle"
            position={[-2.3, 0.7 - i * 0.42, 0]}
          >
            {`${i === 0 ? '👑' : `${i + 1}.`} ${entry.player_name.slice(0, 14).padEnd(14)}  ${entry.score}`}
          </Text>
        ))}
        {/* Rotating indicator */}
        <Text fontSize={0.14} color="#475569" anchorX="center" anchorY="bottom" position={[0, -1.36, 0]}>
          Changes every 5s · Live
        </Text>
      </Billboard>

      {/* Top sign */}
      <mesh position={[0, 11.1, 0]}>
        <boxGeometry args={[4.5, 0.7, 0.3]} />
        <meshToonMaterial color="#7c3aed" />
      </mesh>
      <Billboard position={[0, 11.1, 0.25]}>
        <Text fontSize={0.26} color="#fff" fontWeight="bold" anchorX="center" anchorY="middle">
          LIVE LEADERBOARD
        </Text>
      </Billboard>
    </group>
  )
}

// ── Arcade building (3D) ──────────────────────────────────────────────────────
function ArcadeBuilding({ position }) {
  const [px, , pz] = position
  const neonRef1   = useRef()
  const neonRef2   = useRef()
  const signRef    = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (neonRef1.current) neonRef1.current.material.color.setHSL(0.75, 1, 0.5 + Math.sin(t * 1.8) * 0.15)
    if (neonRef2.current) neonRef2.current.material.color.setHSL(0.92, 1, 0.5 + Math.sin(t * 2.2 + 1) * 0.15)
    if (signRef.current) {
      signRef.current.material.opacity = 0.75 + Math.sin(t * 3) * 0.18
    }
  })

  return (
    <group position={[px, 0, pz]}>
      {/* Main building body */}
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[9, 7, 7]} />
        <meshToonMaterial color="#1e1b4b" />
      </mesh>

      {/* Facade darker stripe */}
      <mesh position={[0, 3.5, 3.51]}>
        <planeGeometry args={[9, 7]} />
        <meshToonMaterial color="#0f0a2e" />
      </mesh>

      {/* Roof layer */}
      <mesh position={[0, 7.2, 0]}>
        <boxGeometry args={[9.4, 0.5, 7.4]} />
        <meshToonMaterial color="#312e81" />
      </mesh>

      {/* Rooftop decorations */}
      <mesh position={[-2.5, 8, 0]}>
        <boxGeometry args={[2, 1.5, 0.3]} />
        <meshToonMaterial color="#7c3aed" />
      </mesh>
      <mesh position={[2.5, 8, 0]}>
        <boxGeometry args={[2, 1.5, 0.3]} />
        <meshToonMaterial color="#ec4899" />
      </mesh>

      {/* GAME ZONE sign on facade */}
      <mesh ref={signRef} position={[0, 5.6, 3.6]}>
        <planeGeometry args={[5.5, 0.9]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.8} />
      </mesh>
      <Billboard position={[0, 5.6, 3.75]}>
        <Text fontSize={0.4} color="#fff" fontWeight="bold" anchorX="center" anchorY="middle">
          🎮 GAME ZONE
        </Text>
      </Billboard>

      {/* Neon strips left */}
      <mesh ref={neonRef1} position={[-4, 3.5, 3.52]}>
        <planeGeometry args={[0.22, 6.5]} />
        <meshBasicMaterial color="#a78bfa" />
      </mesh>
      {/* Neon strips right */}
      <mesh ref={neonRef2} position={[4, 3.5, 3.52]}>
        <planeGeometry args={[0.22, 6.5]} />
        <meshBasicMaterial color="#ec4899" />
      </mesh>
      {/* Neon strip bottom */}
      <mesh position={[0, 0.2, 3.52]}>
        <planeGeometry args={[8.4, 0.18]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.1, 3.52]}>
        <planeGeometry args={[1.4, 2.2]} />
        <meshBasicMaterial color="#0a0a1a" />
      </mesh>

      {/* Windows */}
      {[-3, -1, 1, 3].map(x => (
        <mesh key={x} position={[x, 4.2, 3.52]}>
          <planeGeometry args={[1.1, 1.3]} />
          <meshBasicMaterial color="#1e1b4b" />
        </mesh>
      ))}

      {/* Arcade machine hints visible through windows — colored rectangles */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={x} position={[x, 4.2, 3.53]}>
          <planeGeometry args={[0.7, 0.8]} />
          <meshBasicMaterial color={['#7c3aed','#ec4899','#f59e0b','#10b981'][i]} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Enter hint sign */}
      <Billboard position={[0, 8.5, 0]}>
        <Text fontSize={0.18} color="#4ade80" anchorX="center" anchorY="middle">
          Press E to Enter
        </Text>
      </Billboard>
    </group>
  )
}

// ── Combined export ───────────────────────────────────────────────────────────
export default function GameAreaScene() {
  return (
    <>
      <ArcadeBuilding position={GAME_AREA_POS} />
      <ArcadeBillboard position={[GAME_AREA_POS[0] - 8, 0, GAME_AREA_POS[2] + 4]} />
    </>
  )
}
