import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/store'
import Avatar3D from './Avatar3D'
import CityMap from './CityMap'

// ── Collision system ──────────────────────────────────────────────────────────
// Character and NPC radii in world units
const CHAR_R = 0.45
const NPC_R  = 0.50

// AABB box colliders for all buildings: { x, z, hw (half-width X), hd (half-depth Z) }
const BOX_COLLIDERS = [
  // Major buildings
  { x:   0, z: -22, hw: 5.2, hd: 3.2 }, // City Hall      (10×6)
  { x: -16, z: -28, hw: 7.2, hd: 4.2 }, // Mall           (14×8)
  { x:  16, z: -28, hw: 5.2, hd: 3.7 }, // Cinema         (10×7)
  { x: -28, z: -18, hw: 5.2, hd: 3.2 }, // Supermarket    (10×6)
  { x:  28, z: -18, hw: 3.7, hd: 2.7 }, // Bank           (7×5)
  { x:  34, z:  -5, hw: 3.7, hd: 3.2 }, // Hospital       (7×6)
  { x:  34, z:  10, hw: 2.7, hd: 2.7 }, // Police Station (5×5)
  { x:  34, z:  22, hw: 3.7, hd: 2.7 }, // Fire Station   (7×5)
  { x: -34, z:  -5, hw: 4.7, hd: 3.2 }, // School         (9×6)
  { x: -34, z: -20, hw: 3.7, hd: 2.7 }, // Library        (7×5)
  { x: -34, z:  10, hw: 3.2, hd: 2.7 }, // Gym            (6×5)
  { x:  12, z:  28, hw: 2.7, hd: 2.2 }, // Restaurant     (5×4)
  { x: -12, z:26.5, hw: 2.2, hd: 1.7 }, // Gas Station    (4×3)
  { x: -25, z:  18, hw: 3.2, hd: 3.7 }, // Church         (6×7)
  { x:  12, z:  18, hw: 2.7, hd: 2.2 }, // Post Office    (5×4)
  { x: -26, z:  30, hw: 2.7, hd: 2.2 }, // Apartments     (5×4)
  // Generic Building() instances
  { x: -10, z:  -6, hw: 2.7, hd: 2.2 }, // (5×4)
  { x:  10, z:  -6, hw: 2.7, hd: 2.2 }, // (5×4)
  { x:   0, z: -14, hw: 4.2, hd: 2.2 }, // (8×4)
  { x: -14, z:   4, hw: 2.2, hd: 2.2 }, // (4×4)
  { x:  14, z:   4, hw: 2.2, hd: 2.7 }, // (4×5)
  { x:   0, z:  14, hw: 3.7, hd: 2.7 }, // (7×5)
  { x:  -6, z: -10, hw: 1.2, hd: 1.2 }, // (2×2)
  { x:   6, z: -10, hw: 1.2, hd: 1.2 }, // (2×2)
  { x:  -7, z:  10, hw: 1.2, hd: 1.2 }, // (2×2)
  { x:   7, z:  10, hw: 1.2, hd: 1.2 }, // (2×2)
  { x:  -5, z: -28, hw: 2.2, hd: 1.7 }, // (4×3)
  { x:   5, z: -28, hw: 2.2, hd: 1.7 }, // (4×3)
  // Houses (3×3 each)
  { x: 26, z: 24, hw: 1.7, hd: 1.7 },
  { x: 36, z: 24, hw: 1.7, hd: 1.7 },
  { x: 26, z: 34, hw: 1.7, hd: 1.7 },
  { x: 36, z: 34, hw: 1.7, hd: 1.7 },
  { x: 46, z: 24, hw: 1.7, hd: 1.7 },
  { x: 46, z: 34, hw: 1.7, hd: 1.7 },
  { x: 26, z: 44, hw: 1.7, hd: 1.7 },
  { x: 36, z: 44, hw: 1.7, hd: 1.7 },
]

// Circle colliders for trees and fountain: { x, z, r }
const CIRCLE_COLLIDERS = [
  { x:  0,    z:    0, r: 1.8  }, // Fountain
  // Inner ring trees (scale=1)
  { x: -4,   z:  -4,  r: 0.65 }, { x: -4,   z:   4,  r: 0.65 },
  { x:  4,   z:  -4,  r: 0.65 }, { x:  4,   z:   4,  r: 0.65 },
  { x: -8,   z:   8,  r: 0.65 }, { x:  8,   z:   8,  r: 0.65 },
  { x: -8,   z:  -8,  r: 0.65 }, { x:  8,   z:  -8,  r: 0.65 },
  { x:-12,   z:  -2,  r: 0.65 }, { x: 12,   z:  -2,  r: 0.65 },
  // E-W road side trees z=-4.5 (scale=0.88)
  { x:-48, z:-4.5, r:0.58 }, { x:-38, z:-4.5, r:0.58 }, { x:-28, z:-4.5, r:0.58 },
  { x:-22, z:-4.5, r:0.58 }, { x: -8, z:-4.5, r:0.58 }, { x:  8, z:-4.5, r:0.58 },
  { x: 22, z:-4.5, r:0.58 }, { x: 28, z:-4.5, r:0.58 }, { x: 38, z:-4.5, r:0.58 },
  { x: 48, z:-4.5, r:0.58 },
  // E-W road side trees z=+4.5 (scale=0.88)
  { x:-48, z: 4.5, r:0.58 }, { x:-38, z: 4.5, r:0.58 }, { x:-28, z: 4.5, r:0.58 },
  { x:-22, z: 4.5, r:0.58 }, { x: -8, z: 4.5, r:0.58 }, { x:  8, z: 4.5, r:0.58 },
  { x: 22, z: 4.5, r:0.58 }, { x: 28, z: 4.5, r:0.58 }, { x: 38, z: 4.5, r:0.58 },
  { x: 48, z: 4.5, r:0.58 },
  // N-S road side trees x=-4.5 (scale=0.85)
  { x:-4.5, z:-45, r:0.56 }, { x:-4.5, z:-35, r:0.56 }, { x:-4.5, z:-24, r:0.56 },
  { x:-4.5, z:-14, r:0.56 }, { x:-4.5, z: 14, r:0.56 }, { x:-4.5, z: 24, r:0.56 },
  { x:-4.5, z: 35, r:0.56 }, { x:-4.5, z: 45, r:0.56 },
  // Residential trees (scale=0.8)
  { x:20, z:20, r:0.52 }, { x:30, z:20, r:0.52 }, { x:40, z:20, r:0.52 }, { x:50, z:20, r:0.52 },
  { x:20, z:30, r:0.52 }, { x:30, z:30, r:0.52 }, { x:40, z:30, r:0.52 }, { x:50, z:30, r:0.52 },
  { x:20, z:40, r:0.52 }, { x:30, z:40, r:0.52 }, { x:40, z:40, r:0.52 }, { x:50, z:40, r:0.52 },
  { x:20, z:50, r:0.52 }, { x:30, z:50, r:0.52 }, { x:40, z:50, r:0.52 }, { x:50, z:50, r:0.52 },
  // Church area trees (scale=0.85)
  { x:-16, z:24, r:0.56 }, { x:-18, z:24, r:0.56 }, { x:-20, z:24, r:0.56 },
  { x:-22, z:24, r:0.56 }, { x:-24, z:24, r:0.56 },
  // North district trees — only outer ones (inner overlap City Hall)
  { x: -8, z:-20, r:0.54 }, { x:  8, z:-20, r:0.54 },
]

// Live NPC positions — each entry is { x, z }, mutated by Avatar3D each frame
const npcLivePositions = []

// Push-out collision resolution. Handles boxes (buildings) + circles (trees/fountain/NPCs).
// Two iterations resolve corner contacts without jitter.
function resolveCollisions(nx, nz) {
  let x = nx, z = nz

  for (let iter = 0; iter < 2; iter++) {
    // AABB box colliders
    for (let i = 0; i < BOX_COLLIDERS.length; i++) {
      const b  = BOX_COLLIDERS[i]
      const ex = b.hw + CHAR_R
      const ez = b.hd + CHAR_R
      const dx = x - b.x
      const dz = z - b.z
      if (Math.abs(dx) < ex && Math.abs(dz) < ez) {
        const px = ex - Math.abs(dx)
        const pz = ez - Math.abs(dz)
        // Push out on the axis with smaller penetration (= the side we entered from)
        if (px < pz) x += px * (dx >= 0 ? 1 : -1)
        else         z += pz * (dz >= 0 ? 1 : -1)
      }
    }

    // Circle colliders (trees, fountain)
    for (let i = 0; i < CIRCLE_COLLIDERS.length; i++) {
      const c   = CIRCLE_COLLIDERS[i]
      const dx  = x - c.x
      const dz  = z - c.z
      const d2  = dx * dx + dz * dz
      const min = c.r + CHAR_R
      if (d2 < min * min && d2 > 1e-6) {
        const d    = Math.sqrt(d2)
        const push = (min - d) / d
        x += dx * push
        z += dz * push
      }
    }

    // NPC circle colliders (dynamic — updated every frame by Avatar3D)
    for (let i = 0; i < npcLivePositions.length; i++) {
      const c   = npcLivePositions[i]
      const dx  = x - c.x
      const dz  = z - c.z
      const d2  = dx * dx + dz * dz
      const min = NPC_R + CHAR_R
      if (d2 < min * min && d2 > 1e-6) {
        const d    = Math.sqrt(d2)
        const push = (min - d) / d
        x += dx * push
        z += dz * push
      }
    }
  }

  return [x, z]
}

// ── Place marker (clickable zone) ─────────────────────────────────────────
function PlaceMarker({ position, emoji, label, color, onClick }) {
  const mesh = useRef()
  const [hovered, setHovered] = useState(false)

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.y = position[1] + 3.8 + Math.sin(clock.elapsedTime * 2) * 0.12
      mesh.current.scale.setScalar(hovered ? 1.18 : 1)
    }
  })

  return (
    <group position={position}>
      {/* Ground glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.5, 1.9, 24]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.55 : 0.28} />
      </mesh>

      {/* Floating badge */}
      <group
        ref={mesh}
        position={[0, 3.8, 0]}
        onClick={onClick}
        onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default' }}
      >
        <mesh>
          <capsuleGeometry args={[0.35, 0.55, 4, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
        <Billboard>
          <Text fontSize={0.28} anchorX="center" anchorY="middle" position={[0, 0.08, 0.38]}>
            {emoji}
          </Text>
          <Text fontSize={0.12} color="white" anchorX="center" anchorY="middle" position={[0, -0.3, 0.38]}>
            {label}
          </Text>
        </Billboard>
      </group>
    </group>
  )
}

// ── NPC character wandering around ────────────────────────────────────────
function NPC({ startPos, skin, hair, outfit, name, color, onChat }) {
  const [target, setTarget] = useState(startPos)

  // Shared position object written by Avatar3D each frame, read by resolveCollisions
  const posEntry = useRef({ x: startPos[0], z: startPos[2] })

  useEffect(() => {
    npcLivePositions.push(posEntry.current)
    return () => {
      const idx = npcLivePositions.indexOf(posEntry.current)
      if (idx !== -1) npcLivePositions.splice(idx, 1)
    }
  }, [])

  useEffect(() => {
    const wander = () => {
      const angle = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 5
      setTarget([
        startPos[0] + Math.cos(angle) * r,
        0,
        startPos[2] + Math.sin(angle) * r,
      ])
    }
    wander()
    const id = setInterval(wander, 4000 + Math.random() * 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <group>
      <Avatar3D
        skin={skin} hair={hair} outfit={outfit}
        position={startPos} targetPos={target}
        name={name} expression="happy"
        onClick={onChat}
        scale={0.85}
        positionRef={posEntry.current}
      />
      <Billboard position={[startPos[0], 2.5, startPos[2]]}>
        <Text fontSize={0.18} color={color} anchorX="center">
          {name}
        </Text>
      </Billboard>
    </group>
  )
}

// ── Player controller ─────────────────────────────────────────────────────
// Custom camera: right-click drag = orbit, scroll = zoom, WASD = move character
function PlayerController({ avatar }) {
  const { camera, gl } = useThree()
  const setPlayerPos = useStore(s => s.setPlayerPos)

  // Character world position and facing
  const charPos    = useRef(new THREE.Vector3(0, 0, 6))
  const charFacing = useRef(0)

  // Camera spherical coords around character
  const camYaw   = useRef(0)    // horizontal angle (radians); 0 = camera behind char at +Z
  const camPitch = useRef(0.5)  // vertical angle (radians); clamped [0.08, 1.3]
  const camDist  = useRef(12)   // distance from character; clamped [3, 45]

  // Input state — all in refs so useFrame reads without closures
  const keys  = useRef(new Set())
  const mouse = useRef({ down: false, lastX: 0, lastY: 0 })

  // Player group ref — position/rotation set imperatively each frame
  const playerGroupRef = useRef()

  // Walk state — only triggers re-render on walk/idle transition, never every frame
  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)
  // throttle store updates — only when position moves > 0.5 units
  const lastSentPos = useRef(new THREE.Vector3(0, 0, 6))

  useEffect(() => {
    const el = gl.domElement

    const onKeyDown = (e) => {
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault()
      keys.current.add(e.code)
    }
    const onKeyUp = (e) => keys.current.delete(e.code)

    // Use pointerdown on WINDOW so R3F canvas interception can't block it
    const onPointerDown = (e) => {
      if (e.button === 0) {
        mouse.current.down  = true
        mouse.current.lastX = e.clientX
        mouse.current.lastY = e.clientY
      }
    }
    const onPointerMove = (e) => {
      if (!mouse.current.down) return
      const dx = e.clientX - mouse.current.lastX
      const dy = e.clientY - mouse.current.lastY
      mouse.current.lastX = e.clientX
      mouse.current.lastY = e.clientY
      camYaw.current  -= dx * 0.005
      camPitch.current = THREE.MathUtils.clamp(camPitch.current + dy * 0.004, 0.1, 1.25)
    }
    const onPointerUp   = (e) => { if (e.button === 0) mouse.current.down = false }
    const onWheel       = (e) => {
      camDist.current = THREE.MathUtils.clamp(camDist.current + e.deltaY * 0.025, 3, 45)
    }

    window.addEventListener('keydown',      onKeyDown)
    window.addEventListener('keyup',        onKeyUp)
    window.addEventListener('pointerdown',  onPointerDown)
    window.addEventListener('pointermove',  onPointerMove)
    window.addEventListener('pointerup',    onPointerUp)
    el.addEventListener('wheel',            onWheel, { passive: true })

    return () => {
      window.removeEventListener('keydown',     onKeyDown)
      window.removeEventListener('keyup',       onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup',   onPointerUp)
      el.removeEventListener('wheel',           onWheel)
    }
  }, [gl])

  const _move = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const SPEED  = 8
    const BOUNDS = 53          // half of 120-unit map minus a small margin
    let moving = false
    _move.current.set(0, 0, 0)

    // Camera yaw trig — computed once per frame
    const sy = Math.sin(camYaw.current)
    const cy = Math.cos(camYaw.current)

    // WASD: forward/back/left/right in camera-relative XZ space
    if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { _move.current.x -= sy; _move.current.z -= cy; moving = true }
    if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { _move.current.x += sy; _move.current.z += cy; moving = true }
    if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { _move.current.x -= cy; _move.current.z += sy; moving = true }
    if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { _move.current.x += cy; _move.current.z -= sy; moving = true }

    if (moving) {
      _move.current.normalize()
      charPos.current.addScaledVector(_move.current, SPEED * delta)
      charFacing.current = Math.atan2(_move.current.x, _move.current.z)
    }

    // ── Collision resolution (buildings, trees, NPCs) ────────────────────
    const [cx, cz] = resolveCollisions(charPos.current.x, charPos.current.z)
    charPos.current.x = cx
    charPos.current.z = cz

    // ── Clamp to map bounds (invisible walls) ────────────────────────────
    charPos.current.x = THREE.MathUtils.clamp(charPos.current.x, -BOUNDS, BOUNDS)
    charPos.current.z = THREE.MathUtils.clamp(charPos.current.z, -BOUNDS, BOUNDS)
    charPos.current.y = 0  // never float off ground

    // Walk animation state — re-renders only on walk ↔ idle transition
    if (moving !== isWalkingRef.current) {
      isWalkingRef.current = moving
      setIsWalking(moving)
    }

    // Move player group imperatively — zero React state, zero re-renders
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(charPos.current.x, 0, charPos.current.z)
      playerGroupRef.current.rotation.y = charFacing.current
    }

    // ── Camera orbit around character ────────────────────────────────────
    const px = charPos.current.x
    const pz = charPos.current.z
    const d  = camDist.current
    const p  = camPitch.current
    const y  = camYaw.current

    camera.position.set(
      px + d * Math.sin(y) * Math.cos(p),
           d * Math.sin(p),              // camera height (character is always y=0)
      pz + d * Math.cos(y) * Math.cos(p),
    )
    camera.lookAt(px, 0.9, pz)           // look at roughly avatar chest height
    // ─────────────────────────────────────────────────────────────────────

    // Throttle store update — only when moved > 0.5 units to cut re-renders
    if (charPos.current.distanceTo(lastSentPos.current) > 0.5) {
      lastSentPos.current.copy(charPos.current)
      setPlayerPos([charPos.current.x, 0, charPos.current.z])
    }
  })

  return (
    <>
      {/* Player avatar — position/rotation driven imperatively via playerGroupRef */}
      <group ref={playerGroupRef} position={[0, 0, 6]}>
        <Avatar3D
          skin={avatar.skin} hair={avatar.hair}
          outfit={avatar.outfit} expression={avatar.expression}
          position={[0, 0, 0]} isPlayer name={avatar.name} scale={1}
          externalControl walking={isWalking}
        />
        <Billboard position={[0, 2.8, 0]}>
          <Text fontSize={0.2} color="#facc15" anchorX="center">
            ★ {avatar.name}
          </Text>
        </Billboard>
      </group>

    </>
  )
}

// ── All interactive places across the city ────────────────────────────────
const PLACES = [
  // ── Core ──
  { id: 'cafe',        pos: [-10, 0, -6],  emoji: '☕', label: 'Cafe',         color: '#F59E0B' },
  { id: 'arcade',      pos: [10,  0, -6],  emoji: '🕹️', label: 'Arcade',       color: '#7C3AED' },
  { id: 'beach',       pos: [0,   0,-14],  emoji: '🏖️', label: 'Beach Club',   color: '#38BDF8' },
  { id: 'rooftop',     pos: [-14, 0,  4],  emoji: '🌙', label: 'Rooftop Bar',  color: '#6366F1' },
  { id: 'musicroom',   pos: [14,  0,  4],  emoji: '🎵', label: 'Music Room',   color: '#EC4899' },
  { id: 'park',        pos: [0,   0, 14],  emoji: '🌳', label: 'Park',         color: '#22C55E' },
  // ── Central ──
  { id: 'cityhall',    pos: [0,   0,-22],  emoji: '🏛️', label: 'City Hall',    color: '#94a3b8' },
  // ── North District ──
  { id: 'mall',        pos: [-16, 0,-28],  emoji: '🛍️', label: 'Shopping Mall',color: '#ec4899' },
  { id: 'cinema',      pos: [16,  0,-28],  emoji: '🎬', label: 'Cinema',       color: '#7c3aed' },
  { id: 'supermarket', pos: [-28, 0,-18],  emoji: '🛒', label: 'Supermarket',  color: '#16a34a' },
  { id: 'bank',        pos: [28,  0,-18],  emoji: '🏦', label: 'Bank',         color: '#b45309' },
  // ── East District ──
  { id: 'hospital',    pos: [34,  0, -5],  emoji: '🏥', label: 'Hospital',     color: '#0ea5e9' },
  { id: 'police',      pos: [34,  0, 10],  emoji: '👮', label: 'Police Dept',  color: '#1d4ed8' },
  { id: 'firestation', pos: [34,  0, 22],  emoji: '🚒', label: 'Fire Station', color: '#dc2626' },
  // ── West District ──
  { id: 'school',      pos: [-34, 0, -5],  emoji: '🏫', label: 'School',       color: '#f59e0b' },
  { id: 'library',     pos: [-34, 0,-20],  emoji: '📚', label: 'Library',      color: '#92400e' },
  { id: 'gym',         pos: [-34, 0, 10],  emoji: '💪', label: 'Gym',          color: '#7c3aed' },
  // ── South District ──
  { id: 'restaurant',  pos: [12,  0, 28],  emoji: '🍕', label: 'Restaurant',   color: '#f97316' },
  { id: 'gasstation',  pos: [-12, 0, 28],  emoji: '⛽', label: 'Gas Station',  color: '#ef4444' },
  { id: 'church',      pos: [-25, 0, 18],  emoji: '⛪', label: 'Temple',       color: '#fbbf24' },
  { id: 'postoffice',  pos: [12,  0, 18],  emoji: '📮', label: 'Post Office',  color: '#dc2626' },
  { id: 'apartments',  pos: [-26, 0, 30],  emoji: '🏢', label: 'Apartments',   color: '#475569' },
  { id: 'playground',  pos: [0,   0, 38],  emoji: '🎠', label: 'Playground',   color: '#22c55e' },
  // ── Residential ──
  { id: 'house1',      pos: [26,  0, 29],  emoji: '🏠', label: 'Blue House',   color: '#3b82f6' },
  { id: 'house2',      pos: [36,  0, 29],  emoji: '🏠', label: 'Yellow House', color: '#eab308' },
]

// ── NPCs spread around the city ───────────────────────────────────────────
const NPCS = [
  { name: 'Anaya',  skin: '#D4956A', hair: '#2C1810', outfit: 'party',       color: '#F472B6', pos: [-8,  0,  2]  },
  { name: 'Rahul',  skin: '#C68642', hair: '#1B1B3A', outfit: 'casual',      color: '#60A5FA', pos: [8,   0,  2]  },
  { name: 'Zoya',   skin: '#F4C08A', hair: '#FF6B6B', outfit: 'school',      color: '#34D399', pos: [0,   0, -4]  },
  { name: 'Kabir',  skin: '#8D5524', hair: '#2C1810', outfit: 'sports',      color: '#FBBF24', pos: [-5,  0,  8]  },
  { name: 'Meera',  skin: '#FDDBB4', hair: '#6B48FF', outfit: 'traditional', color: '#F87171', pos: [5,   0,  8]  },
  { name: 'Arjun',  skin: '#C68642', hair: '#1a1a1a', outfit: 'casual',      color: '#a78bfa', pos: [-18, 0,-26]  },
  { name: 'Priya',  skin: '#F4C08A', hair: '#8B4513', outfit: 'school',      color: '#86efac', pos: [18,  0,-26]  },
  { name: 'Dev',    skin: '#8D5524', hair: '#222222', outfit: 'sports',      color: '#fdba74', pos: [34,  0, 2]   },
  { name: 'Nisha',  skin: '#FDDBB4', hair: '#4B0082', outfit: 'party',       color: '#f9a8d4', pos: [-34, 0, 2]   },
  { name: 'Rohan',  skin: '#D4956A', hair: '#2C1810', outfit: 'winter',      color: '#67e8f9', pos: [12,  0, 30]  },
  { name: 'Sana',   skin: '#F4C08A', hair: '#c0392b', outfit: 'traditional', color: '#fcd34d', pos: [-12, 0, 30]  },
  { name: 'Vivek',  skin: '#C68642', hair: '#1a1a1a', outfit: 'casual',      color: '#6ee7b7', pos: [30,  0, 28]  },
]

// ── Full world scene ──────────────────────────────────────────────────────
function WorldScene({ onPlaceClick, onNPCChat }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[12, 18, 8]} intensity={1.3} castShadow color="#FFF8DC" />
      <directionalLight position={[-10, 10, -8]} intensity={0.5} color="#b0c4de" />
      <hemisphereLight skyColor="#87ceeb" groundColor="#2d5a27" intensity={0.4} />

      {/* Sky */}
      <Stars radius={90} depth={50} count={1200} factor={3} fade />

      {/* Full city geometry */}
      <CityMap />

      {/* Interactive place markers */}
      {PLACES.map(p => (
        <PlaceMarker
          key={p.id}
          position={p.pos}
          emoji={p.emoji}
          label={p.label}
          color={p.color}
          onClick={(e) => { e.stopPropagation(); onPlaceClick(p) }}
        />
      ))}

      {/* NPCs */}
      {NPCS.map(npc => (
        <NPC
          key={npc.name}
          startPos={npc.pos}
          skin={npc.skin} hair={npc.hair} outfit={npc.outfit}
          name={npc.name} color={npc.color}
          onChat={(e) => { e.stopPropagation(); onNPCChat(npc) }}
        />
      ))}
    </>
  )
}

// ── Canvas wrapper ────────────────────────────────────────────────────────
export default function WorldCanvas({ onPlaceClick, onNPCChat }) {
  const avatar = useStore(s => s.avatar)

  return (
    <div className="canvas-wrap">
      <Canvas
        shadows
        camera={{ position: [0, 10, 18], fov: 55, near: 0.1, far: 300 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <WorldScene onPlaceClick={onPlaceClick} onNPCChat={onNPCChat} />
          <PlayerController avatar={avatar} />
        </Suspense>
      </Canvas>
    </div>
  )
}
