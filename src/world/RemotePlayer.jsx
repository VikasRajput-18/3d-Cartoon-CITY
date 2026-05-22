import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import NPCModel from './NPCModel'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'

const VIS_DIST_SQ = 1600  // 40 units²

// Simple inline car geometry for remote players in vehicles
function RemoteCar({ name }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.5, 0.55, 3.0]} />
        <meshToonMaterial color="#1e40af" />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.05, -0.1]}>
        <boxGeometry args={[1.25, 0.55, 1.6]} />
        <meshToonMaterial color="#1e3a8a" />
      </mesh>
      {/* Wheels */}
      {[[-0.75, 0.35, -0.9], [0.75, 0.35, -0.9], [-0.75, 0.35, 0.9], [0.75, 0.35, 0.9]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.22, 10]} />
          <meshToonMaterial color="#111827" />
        </mesh>
      ))}
      {/* Windshield */}
      <mesh position={[0, 1.1, -0.95]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[1.1, 0.45]} />
        <meshBasicMaterial color="#bfdbfe" transparent opacity={0.5} />
      </mesh>
      <Billboard position={[0, 2.6, 0]}>
        <Text fontSize={0.15} color="#60a5fa" anchorX="center" anchorY="middle">{name}</Text>
        <Text fontSize={0.09} color="#4ade80" anchorX="center" anchorY="middle" position={[0, -0.2, 0]}>🚗 Driving</Text>
      </Billboard>
    </group>
  )
}

// Simple inline bike geometry for remote players in vehicles
function RemoteBike({ name }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.5, 0.35, 1.4]} />
        <meshToonMaterial color="#374151" />
      </mesh>
      {/* Front wheel */}
      <mesh position={[0, 0.38, -0.65]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.16, 10]} />
        <meshToonMaterial color="#1a1a1a" />
      </mesh>
      {/* Rear wheel */}
      <mesh position={[0, 0.38, 0.65]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.16, 10]} />
        <meshToonMaterial color="#1a1a1a" />
      </mesh>
      {/* Handlebar */}
      <mesh position={[0, 0.9, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <meshToonMaterial color="#6b7280" />
      </mesh>
      <Billboard position={[0, 2.5, 0]}>
        <Text fontSize={0.15} color="#60a5fa" anchorX="center" anchorY="middle">{name}</Text>
        <Text fontSize={0.09} color="#4ade80" anchorX="center" anchorY="middle" position={[0, -0.18, 0]}>🏍 Riding</Text>
      </Billboard>
    </group>
  )
}

function RemotePlayer({ uid, onPlayerClick }) {
  const groupRef     = useRef()
  const visRef       = useRef(false)

  // Walking animation
  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)

  // Visual properties (name / outfit / skin)
  const displayRef = useRef({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })
  const [display, setDisplay] = useState({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })

  // Vehicle state
  const vehicleRef = useRef({ isInVehicle: false, vehicleType: '' })
  const [vehicle, setVehicle] = useState({ isInVehicle: false, vehicleType: '' })

  // Hover UX
  const hoveredRef   = useRef(false)
  const hoverRingRef = useRef()

  // Click bounce animation (duration counter in seconds)
  const bounceRef = useRef(0)

  // Name popup before opening DM chat
  const [showPopup, setShowPopup] = useState(false)
  const popupTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
      document.body.style.cursor = 'default'
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const data  = remotePlayersRef.current.get(uid)

    if (!groupRef.current) return

    if (!data) {
      groupRef.current.visible = false
      return
    }

    // ── Distance culling ────────────────────────────────────────────────────
    const dToPx  = data.x - minimapState.playerX
    const dToPz  = data.z - minimapState.playerZ
    const distSq = dToPx * dToPx + dToPz * dToPz
    const inView = distSq < VIS_DIST_SQ
    groupRef.current.visible = inView
    visRef.current = inView
    if (!inView) return

    // ── Position buffer → smooth lerp ──────────────────────────────────────
    const lerpAlpha = Math.min(1, delta * 12)
    if (data.posBuffer && data.posBuffer.length > 0) {
      const tgt = data.posBuffer[0]
      data.x = THREE.MathUtils.lerp(data.x, tgt.x, lerpAlpha)
      data.z = THREE.MathUtils.lerp(data.z, tgt.z, lerpAlpha)
      let diff = tgt.facing - data.facing
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      data.facing += diff * lerpAlpha
      const rx = tgt.x - data.x, rz = tgt.z - data.z
      if (rx * rx + rz * rz < 0.01) data.posBuffer.shift()
    }

    groupRef.current.position.set(data.x, 0, data.z)
    groupRef.current.rotation.y = data.facing

    // ── Animation ───────────────────────────────────────────────────────────
    const nowWalking = !!data.is_moving
    if (nowWalking !== isWalkingRef.current) {
      isWalkingRef.current = nowWalking
      setIsWalking(nowWalking)
    }

    // ── Visual properties ────────────────────────────────────────────────────
    if (data.name && (
      data.name   !== displayRef.current.name   ||
      data.outfit !== displayRef.current.outfit ||
      data.skin   !== displayRef.current.skin
    )) {
      const next = { name: data.name, outfit: data.outfit, skin: data.skin }
      displayRef.current = next
      setDisplay(next)
    }

    // ── Vehicle state ────────────────────────────────────────────────────────
    const nowInVehicle  = !!data.is_in_vehicle
    const nowVehicleType = data.vehicle_type || ''
    if (nowInVehicle !== vehicleRef.current.isInVehicle || nowVehicleType !== vehicleRef.current.vehicleType) {
      vehicleRef.current = { isInVehicle: nowInVehicle, vehicleType: nowVehicleType }
      setVehicle({ isInVehicle: nowInVehicle, vehicleType: nowVehicleType })
    }

    // ── Hover ring ───────────────────────────────────────────────────────────
    if (hoverRingRef.current) {
      const targetOpacity = hoveredRef.current ? 0.65 : 0
      hoverRingRef.current.material.opacity = THREE.MathUtils.lerp(
        hoverRingRef.current.material.opacity, targetOpacity, delta * 10
      )
    }

    // ── Bounce animation on click ────────────────────────────────────────────
    if (bounceRef.current > 0) {
      bounceRef.current -= delta
      const t = 1 - Math.max(0, bounceRef.current / 0.5)
      const s = 1 + Math.sin(t * Math.PI * 2.5) * 0.18
      groupRef.current.scale.setScalar(s)
    } else if (groupRef.current.scale.x !== 1) {
      groupRef.current.scale.setScalar(1)
    }
  })

  const handlePointerOver = (e) => {
    e.stopPropagation()
    hoveredRef.current = true
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (e) => {
    e.stopPropagation()
    hoveredRef.current = false
    document.body.style.cursor = 'default'
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (!onPlayerClick) return
    bounceRef.current = 0.5
    setShowPopup(true)
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    popupTimerRef.current = setTimeout(() => {
      setShowPopup(false)
      onPlayerClick(uid, display.name)
    }, 900)
  }

  return (
    <group ref={groupRef} visible={false}>
      {/* Large invisible hitbox — easier to click/tap than the character mesh */}
      <mesh
        position={[0, 1.2, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[1.4, 2.6, 1.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Hover glow ring at feet */}
      <mesh ref={hoverRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.82, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* Name popup for 900ms after click, before DM opens */}
      {showPopup && (
        <Billboard position={[0, 3.4, 0]}>
          <Text
            fontSize={0.22}
            color="#ffffff"
            outlineWidth={0.012}
            outlineColor="#7c3aed"
            anchorX="center"
            anchorY="middle"
          >
            {display.name}
          </Text>
        </Billboard>
      )}

      {/* Vehicle or walking character */}
      {vehicle.isInVehicle ? (
        vehicle.vehicleType === 'bike'
          ? <RemoteBike name={display.name} />
          : <RemoteCar  name={display.name} />
      ) : (
        <NPCModel
          outfit={display.outfit}
          skin={display.skin}
          walking={isWalking}
          name={display.name}
          labelColor="#60a5fa"
          sublabel="• Player"
          sublabelColor="#4ade80"
          npcScale={0.01}
          visibleRef={visRef}
        />
      )}
    </group>
  )
}

export default React.memo(RemotePlayer)
