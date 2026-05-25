import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { onMissionUpdate, getMissionStatus } from '@/lib/missionState'

export const ORB_POS = [0, 1.2, 14]

export default function MissionOrb() {
  const [active, setActive] = useState(getMissionStatus('m1_3') === 'active')
  const [collected, setCollected] = useState(false)
  const groupRef = useRef()
  const t = useRef(0)

  useEffect(() => {
    return onMissionUpdate(() => {
      const status = getMissionStatus('m1_3')
      setActive(status === 'active')
      if (status === 'completed') setCollected(true)
    })
  }, [])

  useEffect(() => {
    const handler = () => setCollected(true)
    window.addEventListener('orb-collected', handler)
    return () => window.removeEventListener('orb-collected', handler)
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current || !active || collected) return
    t.current += delta
    groupRef.current.position.y = ORB_POS[1] + Math.sin(t.current * 2) * 0.18
    groupRef.current.rotation.y += delta * 1.2
  })

  if (!active || collected) return null

  return (
    <group ref={groupRef} position={ORB_POS}>
      {/* Core orb */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      {/* Outer glow ring */}
      <mesh>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.18} />
      </mesh>
      {/* Point light */}
      <pointLight color="#ffd700" intensity={3} distance={6} />

      {/* Hint label */}
      <Billboard position={[0, 1.2, 0]}>
        <Text fontSize={0.22} color="#ffd700" anchorX="center">✨ Hidden Note</Text>
        <Text fontSize={0.15} color="#fbbf24" anchorX="center" position={[0, -0.3, 0]}>Press F to investigate</Text>
      </Billboard>
    </group>
  )
}
