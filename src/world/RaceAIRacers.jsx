// AI race opponents — renders the AI racers simulated in raceState.js using the
// existing Car3D / Bike3D meshes in each racer's colour, with a floating name
// label. Positions are read live each frame from getAIRacers() and lerped for
// smoothness. Mounted once in WorldScene; renders nothing outside a race.
//
// Flagged noMerge + isVehicle so the CityMerger never bakes these moving meshes.
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { onRaceUpdate, getAIRacers } from '@/lib/raceState'
import { Car3D, Bike3D } from './Vehicle3D'

function AIRacer({ index, info }) {
  const groupRef = useRef()
  const facing   = useRef(0)
  const init     = useRef(false)

  useFrame((_, rawDelta) => {
    const g = groupRef.current
    if (!g) return
    const d = getAIRacers()[index]
    if (!d) { g.visible = false; return }
    g.visible = true
    const delta = Math.min(rawDelta, 0.05)
    if (!init.current) {
      g.position.set(d.x, 0, d.z)
      facing.current = d.yaw
      init.current = true
    } else {
      const alpha = Math.min(1, delta * 14)
      g.position.x = THREE.MathUtils.lerp(g.position.x, d.x, alpha)
      g.position.z = THREE.MathUtils.lerp(g.position.z, d.z, alpha)
      let diff = d.yaw - facing.current
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      facing.current += diff * alpha
    }
    g.rotation.y = facing.current
  })

  return (
    <group ref={groupRef} userData={{ noMerge: true, isVehicle: true }}>
      {info.type === 'bike'
        ? <Bike3D frameColor={info.color} />
        : <Car3D bodyColor={info.color} />}
      <Billboard position={[0, info.type === 'bike' ? 2.4 : 2.7, 0]}>
        <Text fontSize={0.42} color={info.color} anchorX="center" anchorY="middle"
          outlineWidth={0.04} outlineColor="#0f172a">
          {info.name}
        </Text>
      </Billboard>
    </group>
  )
}

export default function RaceAIRacers() {
  const [racers, setRacers] = useState([])

  useEffect(() => onRaceUpdate(s => {
    if (s.phase === 'countdown' || s.phase === 'racing' || s.phase === 'finished') {
      // Snapshot static info (id/name/colour/type); positions stay live via getAIRacers().
      setRacers(getAIRacers().map(a => ({ id: a.id, name: a.name, color: a.color, type: a.type })))
    } else {
      setRacers([])
    }
  }), [])

  if (!racers.length) return null
  return (
    <group>
      {racers.map((r, i) => <AIRacer key={r.id} index={i} info={r} />)}
    </group>
  )
}
