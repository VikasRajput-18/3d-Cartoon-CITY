import React, { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { vehicleState } from '@/lib/vehicleState'
import { Car3D, Bike3D } from './Vehicle3D'

// Shows a shared vehicle that a REMOTE player is currently driving.
// The local player's own car/bike (in PlayerController) is hidden when occupied,
// and this component takes its place — positioned via lerp from vehicleState.
function RemoteVehicle({ vehicleId, myUserId }) {
  const groupRef       = useRef()
  const bikeLeanRef    = useRef()
  const facingRef      = useRef(0)
  const initRef        = useRef(false)   // snap to position on first visible frame
  const wheelRefs      = useRef([null, null, null, null])
  const bikeDustRef    = useRef()
  const carDustRefs    = useRef([null, null])
  const labelTickRef   = useRef(0)

  // React state only for the name label (updated at most 2 Hz to avoid re-render spam)
  const [label, setLabel] = useState({ driver: '', passenger: '' })

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const vs    = vehicleState[vehicleId]
    if (!groupRef.current) return

    const isOccupied = !!vs.driverId && vs.driverId !== myUserId
    if (!isOccupied) {
      groupRef.current.visible = false
      initRef.current = false
      return
    }

    // Snap on first frame (avoids lerping from world origin)
    if (!initRef.current) {
      groupRef.current.position.set(vs.x, 0, vs.z)
      facingRef.current = vs.facing
      groupRef.current.rotation.y = vs.facing
      groupRef.current.visible = true
      initRef.current = true
    } else {
      groupRef.current.visible = true
      const alpha = Math.min(1, delta * 15)
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, vs.x, alpha)
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, vs.z, alpha)
      let diff = vs.facing - facingRef.current
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      facingRef.current += diff * alpha
      groupRef.current.rotation.y = facingRef.current
    }

    // Wheel spin
    const wheelRadius = vehicleId === 'car' ? 0.37 : 0.38
    const spin = (vs.speed * delta) / wheelRadius
    for (let i = 0; i < wheelRefs.current.length; i++) {
      if (wheelRefs.current[i]) wheelRefs.current[i].rotation.x -= spin
    }

    // Bike lean (proportional to speed + turn rate — visual approximation)
    if (vehicleId === 'bike' && bikeLeanRef.current) {
      const targetLean = THREE.MathUtils.clamp(-vs.speed * 0.015, -0.35, 0.35)
      bikeLeanRef.current.rotation.z = THREE.MathUtils.lerp(bikeLeanRef.current.rotation.z, targetLean, delta * 5)
    }

    // Label update throttled to 2 Hz
    labelTickRef.current += delta
    if (labelTickRef.current > 0.5) {
      labelTickRef.current = 0
      setLabel({ driver: vs.driverName || '', passenger: vs.passengerName || '' })
    }
  })

  const labelY = vehicleId === 'car' ? 2.8 : 2.6

  return (
    <group ref={groupRef} visible={false}>
      {vehicleId === 'car'
        ? <Car3D wheelRefs={wheelRefs} dustRefs={carDustRefs} />
        : <Bike3D wheelRefs={wheelRefs} leanRef={bikeLeanRef} dustRef={bikeDustRef} />
      }

      {/* Floating name labels */}
      <Billboard position={[0, labelY, 0]}>
        {label.driver && (
          <Text fontSize={0.15} color="#60a5fa" anchorX="center" anchorY="middle">
            {label.driver}
          </Text>
        )}
        {label.passenger && (
          <Text fontSize={0.11} color="#4ade80" anchorX="center" anchorY="middle"
            position={[0, -0.22, 0]}>
            👤 {label.passenger}
          </Text>
        )}
        <Text
          fontSize={0.09} color="#facc15" anchorX="center" anchorY="middle"
          position={[0, label.passenger ? -0.44 : -0.22, 0]}
        >
          {vehicleId === 'car' ? '🚗 Driving' : '🏍 Riding'}
        </Text>
      </Billboard>
    </group>
  )
}

export default React.memo(RemoteVehicle)
