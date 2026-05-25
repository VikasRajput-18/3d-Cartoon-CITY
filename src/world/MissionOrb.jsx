import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { onMissionUpdate, getMissionStatus } from '@/lib/missionState'

export const ORB_POS = [0, 1.2, 14]

const PARTICLE_COUNT = 22
const _dummy = new THREE.Object3D()

// Pre-compute particle configs to avoid per-frame allocation
const PARTICLE_CFG = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  baseAngle: (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5,
  radius:    0.55 + Math.random() * 0.6,
  speed:     0.3 + Math.random() * 0.6,
  phase:     Math.random() * Math.PI * 2,
  yBase:     Math.random() * 1.8,
}))

export default function MissionOrb() {
  const [active, setActive]       = useState(getMissionStatus('m1_3') === 'active')
  const [collected, setCollected] = useState(getMissionStatus('m1_3') === 'completed')

  const groupRef = useRef()
  const coreRef  = useRef()
  const midRef   = useRef()
  const outerRef = useRef()
  const partRef  = useRef()
  const t = useRef(0)

  useEffect(() => onMissionUpdate(() => {
    const s = getMissionStatus('m1_3')
    setActive(s === 'active')
    if (s === 'completed') setCollected(true)
  }), [])

  useEffect(() => {
    const h = () => setCollected(true)
    window.addEventListener('orb-collected', h)
    return () => window.removeEventListener('orb-collected', h)
  }, [])

  useFrame((_, delta) => {
    if (!active || collected) return
    t.current += delta
    const T = t.current

    // Float up and down
    if (groupRef.current) groupRef.current.position.y = ORB_POS[1] + Math.sin(T * 1.8) * 0.22

    // Pulse core
    if (coreRef.current) coreRef.current.scale.setScalar(1 + Math.sin(T * 3.5) * 0.14)

    // Breathe mid layer
    if (midRef.current) midRef.current.scale.setScalar(1 + Math.sin(T * 2.3 + 1.2) * 0.13)

    // Outer haze opacity flicker
    if (outerRef.current) {
      outerRef.current.scale.setScalar(1 + Math.sin(T * 1.5 + 2.1) * 0.07)
      outerRef.current.material.opacity = 0.09 + Math.sin(T * 2.1) * 0.04
    }

    // Animate particles
    if (partRef.current) {
      PARTICLE_CFG.forEach((p, i) => {
        const a = p.baseAngle + T * p.speed * 0.4
        const y = ((p.yBase + T * p.speed * 0.3) % 2.2) - 0.6
        const r = p.radius * (0.75 + 0.25 * Math.sin(T * 2.5 + p.phase))
        _dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
        _dummy.scale.setScalar(0.04 + 0.02 * Math.sin(T * 4 + p.phase))
        _dummy.updateMatrix()
        partRef.current.setMatrixAt(i, _dummy.matrix)
      })
      partRef.current.instanceMatrix.needsUpdate = true
    }
  })

  if (!active || collected) return null

  return (
    <group ref={groupRef} position={ORB_POS}>
      {/* Outer haze — largest, most transparent */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[1.15, 14, 10]} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.09} depthWrite={false} />
      </mesh>

      {/* Mid glow layer */}
      <mesh ref={midRef}>
        <sphereGeometry args={[0.78, 16, 12]} />
        <meshBasicMaterial color="#ffdd44" transparent opacity={0.24} depthWrite={false} />
      </mesh>

      {/* Core — always fully bright */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.5, 24, 18]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>

      {/* Inner bright highlight */}
      <mesh>
        <sphereGeometry args={[0.32, 12, 8]} />
        <meshBasicMaterial color="#fff8c0" />
      </mesh>

      {/* Floating particles */}
      <instancedMesh ref={partRef} args={[null, null, PARTICLE_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshBasicMaterial color="#ffe566" transparent opacity={0.88} />
      </instancedMesh>

      {/* Strong lights so surroundings glow gold */}
      <pointLight color="#ffd700" intensity={12} distance={18} decay={2} />
      <pointLight color="#ffaa00" intensity={6}  distance={9}  decay={2} position={[0, 0.7, 0]} />

      {/* Hint label */}
      <Billboard position={[0, 1.6, 0]}>
        <Text
          fontSize={0.28}
          color="#ffd700"
          anchorX="center"
          outlineColor="#1a0a00"
          outlineWidth={0.014}
        >
          ❓ Mysterious Object
        </Text>
        <Text
          fontSize={0.17}
          color="#fffde7"
          anchorX="center"
          position={[0, -0.38, 0]}
          outlineColor="#1a0a00"
          outlineWidth={0.008}
        >
          Press F to examine
        </Text>
      </Billboard>
    </group>
  )
}
