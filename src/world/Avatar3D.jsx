import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SKIN_MAP = {
  '#FDDBB4': '#FDDBB4', '#F4C08A': '#F4C08A',
  '#D4956A': '#D4956A', '#C68642': '#C68642',
  '#8D5524': '#8D5524', '#4A2C0A': '#4A2C0A',
}
const OUTFIT_COLORS = {
  casual:      '#7C3AED',
  school:      '#1D4ED8',
  party:       '#DB2777',
  traditional: '#D97706',
  winter:      '#0F766E',
  sports:      '#DC2626',
}

export default function Avatar3D({
  skin = '#F4C08A',
  hair = '#2C1810',
  outfit = 'casual',
  position = [0, 0, 0],
  targetPos = null,
  isPlayer = false,
  name = 'Me',
  onClick = null,
  expression = 'happy',
  scale = 1,
  externalControl = false, // when true, parent group owns position/rotation
  walking = false,          // used when externalControl=true
  positionRef = null,       // {x,z} object kept in sync each frame (NPCs only)
}) {
  const group   = useRef()
  const bodyRef = useRef()
  const legLRef = useRef()
  const legRRef = useRef()
  const armLRef = useRef()
  const armRRef = useRef()
  const headRef = useRef()

  const currentPos  = useRef(new THREE.Vector3(...position))
  const movingRef   = useRef(false)
  const walkPhase   = useRef(0)
  const bobPhase    = useRef(Math.random() * Math.PI * 2)
  // pre-allocated to avoid per-frame GC pressure
  const _target     = useRef(new THREE.Vector3())
  const _dir        = useRef(new THREE.Vector3())

  const outfitColor = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual

  useFrame((_, delta) => {
    if (!group.current) return

    // Idle bob (always)
    bobPhase.current += delta * 1.8
    if (headRef.current) {
      headRef.current.position.y = 1.52 + Math.sin(bobPhase.current) * 0.015
    }

    // ── External control (WASD player) ──────────────────────────────────
    if (externalControl) {
      if (walking) walkPhase.current += delta * 8
      const sw   = walking ? Math.sin(walkPhase.current) * 0.35 : 0
      const ease = Math.min(1, delta * 14)
      if (legLRef.current) legLRef.current.rotation.x += (sw        - legLRef.current.rotation.x) * ease
      if (legRRef.current) legRRef.current.rotation.x += (-sw       - legRRef.current.rotation.x) * ease
      if (armLRef.current) armLRef.current.rotation.x += (-sw * 0.6 - armLRef.current.rotation.x) * ease
      if (armRRef.current) armRRef.current.rotation.x += (sw  * 0.6 - armRRef.current.rotation.x) * ease
      return
    }
    // ────────────────────────────────────────────────────────────────────

    // NPC / click-to-move walk animation
    if (targetPos && movingRef.current) {
      _target.current.set(...targetPos)
      const dist = currentPos.current.distanceTo(_target.current)

      if (dist > 0.05) {
        const speed = 2.5
        _dir.current.copy(_target.current).sub(currentPos.current).normalize()
        currentPos.current.addScaledVector(_dir.current, Math.min(speed * delta, dist))
        group.current.position.copy(currentPos.current)

        const angle = Math.atan2(_dir.current.x, _dir.current.z)
        group.current.rotation.y = angle

        walkPhase.current += delta * 8
        const sw = Math.sin(walkPhase.current) * 0.35
        if (legLRef.current) legLRef.current.rotation.x =  sw
        if (legRRef.current) legRRef.current.rotation.x = -sw
        if (armLRef.current) armLRef.current.rotation.x = -sw * 0.6
        if (armRRef.current) armRRef.current.rotation.x =  sw * 0.6
      } else {
        movingRef.current = false
        if (legLRef.current) legLRef.current.rotation.x = 0
        if (legRRef.current) legRRef.current.rotation.x = 0
        if (armLRef.current) armLRef.current.rotation.x = 0
        if (armRRef.current) armRRef.current.rotation.x = 0
      }
    }

    // Sync live position for collision detection (NPCs only)
    if (positionRef) {
      positionRef.x = currentPos.current.x
      positionRef.z = currentPos.current.z
    }
  })

  useEffect(() => {
    if (targetPos) movingRef.current = true
  }, [targetPos])

  useEffect(() => {
    if (group.current) group.current.position.set(...position)
    currentPos.current.set(...position)
  }, [])

  return (
    <group
      ref={group}
      position={position}
      scale={[scale, scale, scale]}
      onClick={onClick}
    >
      {/* Shadow — raised above ground to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1, 0.667, 1]} renderOrder={1}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* Legs */}
      <group position={[-0.1, 0.3, 0]}>
        <mesh ref={legLRef} position={[0, 0, 0]}>
          <capsuleGeometry args={[0.085, 0.38, 4, 8]} />
          <meshToonMaterial color="#1a1a2e" />
        </mesh>
      </group>
      <group position={[0.1, 0.3, 0]}>
        <mesh ref={legRRef} position={[0, 0, 0]}>
          <capsuleGeometry args={[0.085, 0.38, 4, 8]} />
          <meshToonMaterial color="#1a1a2e" />
        </mesh>
      </group>

      {/* Shoes */}
      <mesh position={[-0.1, 0.08, 0.04]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshToonMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.08, 0.04]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshToonMaterial color="#111" />
      </mesh>

      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.78, 0]}>
        <capsuleGeometry args={[0.22, 0.36, 6, 10]} />
        <meshToonMaterial color={outfitColor} />
      </mesh>

      {/* Body outline rim */}
      <mesh position={[0, 0.78, 0]} scale={[1.04, 1.02, 1.04]}>
        <capsuleGeometry args={[0.22, 0.36, 6, 10]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>

      {/* Arms */}
      <group position={[-0.32, 0.82, 0]}>
        <mesh ref={armLRef}>
          <capsuleGeometry args={[0.075, 0.28, 4, 8]} />
          <meshToonMaterial color={skin} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshToonMaterial color={skin} />
        </mesh>
      </group>
      <group position={[0.32, 0.82, 0]}>
        <mesh ref={armRRef}>
          <capsuleGeometry args={[0.075, 0.28, 4, 8]} />
          <meshToonMaterial color={skin} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshToonMaterial color={skin} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 1.16, 0]}>
        <cylinderGeometry args={[0.09, 0.1, 0.14, 8]} />
        <meshToonMaterial color={skin} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 1.52, 0]}>
        {/* Head base */}
        <mesh>
          <sphereGeometry args={[0.26, 16, 14]} />
          <meshToonMaterial color={skin} />
        </mesh>
        {/* Head outline */}
        <mesh scale={1.04}>
          <sphereGeometry args={[0.26, 16, 14]} />
          <meshBasicMaterial color="#000" side={THREE.BackSide} />
        </mesh>

        {/* Hair top */}
        <mesh position={[0, 0.15, -0.02]}>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshToonMaterial color={hair} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.1, 0.04, 0.23]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshToonMaterial color="#fff" />
        </mesh>
        <mesh position={[-0.1, 0.04, 0.26]}>
          <sphereGeometry args={[0.028, 6, 5]} />
          <meshToonMaterial color="#111" />
        </mesh>
        <mesh position={[0.1, 0.04, 0.23]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshToonMaterial color="#fff" />
        </mesh>
        <mesh position={[0.1, 0.04, 0.26]}>
          <sphereGeometry args={[0.028, 6, 5]} />
          <meshToonMaterial color="#111" />
        </mesh>

        {/* Eye shine */}
        <mesh position={[-0.092, 0.055, 0.268]}>
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
        <mesh position={[0.108, 0.055, 0.268]}>
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshBasicMaterial color="#fff" />
        </mesh>

        {/* Rosy cheeks */}
        <mesh position={[-0.18, -0.02, 0.18]} rotation={[0, 0.4, 0]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshToonMaterial color="#FFB6C1" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0.18, -0.02, 0.18]} rotation={[0, -0.4, 0]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshToonMaterial color="#FFB6C1" transparent opacity={0.6} />
        </mesh>

        {/* Smile */}
        <mesh position={[0, -0.07, 0.25]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.07, 0.012, 6, 10, Math.PI]} />
          <meshToonMaterial color="#c0392b" />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.01, 0.26]}>
          <sphereGeometry args={[0.022, 6, 5]} />
          <meshToonMaterial color={skin === '#FDDBB4' ? '#e8a87c' : '#7a4a28'} />
        </mesh>
      </group>

      {/* Name label (billboard via HTML overlay — handled in parent) */}
    </group>
  )
}
