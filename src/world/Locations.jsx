// 3D scenery for the two new far-flung locations: the City Aquatic Center (pool
// complex) and the Airport. Each carries its own ground patch (the main city
// ground is only ±250). Groups are flagged noMerge so CityMerger never disposes
// the animated parts (water pulse, windsock, radar dish). Swimming/flying logic
// lives elsewhere — these are the buildings only.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { POOL, POOL_DIVE, AIRPORT } from '@/lib/locations'
import { C } from '@/lib/designTokens'

// ── Swimming pool complex ─────────────────────────────────────────────────────
export function SwimmingPool() {
  const waterRef = useRef()
  useFrame((state) => {
    if (waterRef.current) waterRef.current.material.opacity = 0.8 + Math.sin(state.clock.elapsedTime * 1.2) * 0.1
  })
  const { cx, cz, halfW, halfD, surfaceY } = POOL
  return (
    <group position={[cx, 0, cz]} userData={{ noMerge: true }}>
      {/* grass ground patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[halfW * 2 + 40, halfD * 2 + 40]} />
        <meshStandardMaterial color={C.grass} roughness={0.95} />
      </mesh>
      {/* warm concrete deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[halfW * 2 + 8, halfD * 2 + 8]} />
        <meshStandardMaterial color={C.sidewalk} roughness={0.8} />
      </mesh>
      {/* sunken basin */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[halfW * 2, 1, halfD * 2]} />
        <meshStandardMaterial color="#2a4a6a" roughness={0.4} />
      </mesh>
      {/* animated water */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, surfaceY, 0]}>
        <planeGeometry args={[halfW * 2 - 0.4, halfD * 2 - 0.4]} />
        <meshStandardMaterial color="#4FC3F7" transparent opacity={0.8} roughness={0} metalness={0.1} depthWrite={false} />
      </mesh>

      {/* diving board */}
      <group position={[-13, 0, 0]}>
        <mesh position={[0, POOL_DIVE.height / 2, 0]}><boxGeometry args={[1, POOL_DIVE.height, 1]} /><meshStandardMaterial color="#94a3b8" /></mesh>
        <mesh position={[1.8, POOL_DIVE.height, 0]}><boxGeometry args={[3.4, 0.16, 0.9]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      </group>

      {/* lifeguard tower */}
      <group position={[halfW - 1, 0, halfD - 1]}>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[0.5, 3.2, 0.5]} /><meshStandardMaterial color="#b45309" /></mesh>
        <mesh position={[0, 3.4, 0]}><boxGeometry args={[2, 0.3, 2]} /><meshStandardMaterial color="#dc2626" /></mesh>
      </group>

      {/* two changing rooms */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (halfW + 2.5), 1.2, halfD + 2]}>
          <boxGeometry args={[4, 2.4, 3]} /><meshStandardMaterial color="#a78bfa" roughness={0.7} />
        </mesh>
      ))}

      {/* sun loungers + umbrellas */}
      {[-1, 1].flatMap(s => [-6, -2, 2, 6].map(z => (
        <group key={`${s}_${z}`} position={[s * (halfW + 4), 0, z]}>
          <mesh position={[0, 0.25, 0]}><boxGeometry args={[1, 0.2, 2]} /><meshStandardMaterial color="#f8fafc" /></mesh>
          <mesh position={[0, 1.6, -0.3]}><coneGeometry args={[1.4, 1, 8]} /><meshStandardMaterial color={z % 4 === 0 ? '#f43f5e' : '#22d3ee'} /></mesh>
        </group>
      )))}

      {/* entrance sign */}
      <Billboard position={[0, 5, -halfD - 4]}>
        <Text fontSize={1.1} color="#0ea5e9" anchorX="center" anchorY="middle" outlineWidth={0.08} outlineColor="#000">
          🏊 City Aquatic Center
        </Text>
      </Billboard>
    </group>
  )
}

// ── Airport ───────────────────────────────────────────────────────────────────
export function Airport() {
  const sockRef = useRef()
  const radarRef = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (sockRef.current)  sockRef.current.rotation.y = Math.sin(t * 0.5) * 0.6
    if (radarRef.current) radarRef.current.rotation.y = t * 0.8
  })
  const { cx, cz } = AIRPORT
  return (
    <group position={[cx, 0, cz]} userData={{ noMerge: true }}>
      {/* tarmac ground patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[260, 160]} />
        <meshStandardMaterial color="#3f4651" roughness={0.95} />
      </mesh>

      {/* terminal building (glass front) */}
      <group position={[0, 0, 50]}>
        <mesh position={[0, 4, 0]}><boxGeometry args={[60, 8, 20]} /><meshStandardMaterial color="#475569" roughness={0.6} /></mesh>
        <mesh position={[0, 4, 10.1]}><boxGeometry args={[58, 7, 0.3]} /><meshStandardMaterial color="#7dd3fc" transparent opacity={0.6} metalness={0.3} roughness={0.1} /></mesh>
        <Billboard position={[0, 10, 0]}>
          <Text fontSize={1.6} color="#38bdf8" anchorX="center" anchorY="middle" outlineWidth={0.1} outlineColor="#000">✈️ City Airport</Text>
        </Billboard>
      </group>

      {/* control tower + radar */}
      <group position={[34, 0, 44]}>
        <mesh position={[0, 12.5, 0]}><boxGeometry args={[5, 25, 5]} /><meshStandardMaterial color="#64748b" /></mesh>
        <mesh position={[0, 26, 0]}><boxGeometry args={[10, 3, 10]} /><meshStandardMaterial color="#1e293b" metalness={0.2} /></mesh>
        <mesh ref={radarRef} position={[0, 28.2, 0]}><cylinderGeometry args={[2, 2, 0.3, 12]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      </group>

      {/* runway + dashed centre line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -40]}>
        <planeGeometry args={[20, 200]} />
        <meshStandardMaterial color="#111418" roughness={1} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -40 - 90 + i * 16]}>
          <planeGeometry args={[0.6, 6]} /><meshStandardMaterial color="#e2e8f0" />
        </mesh>
      ))}

      {/* hangar */}
      <mesh position={[-40, 6, 10]}><boxGeometry args={[40, 12, 30]} /><meshStandardMaterial color="#52606d" roughness={0.7} /></mesh>

      {/* windsock */}
      <group position={[16, 0, -20]}>
        <mesh position={[0, 3, 0]}><cylinderGeometry args={[0.1, 0.1, 6, 6]} /><meshStandardMaterial color="#9ca3af" /></mesh>
        <mesh ref={sockRef} position={[0, 5.5, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.5, 2, 8, 1, true]} /><meshStandardMaterial color="#f97316" side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  )
}
