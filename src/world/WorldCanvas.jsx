import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'
import Avatar3D from './Avatar3D'
import CityMap from './CityMap'
import { Car3D, Bike3D } from './Vehicle3D'

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

// ── Vehicle physics configs ───────────────────────────────────────────────
const CAR_CFG = {
  maxSpeed:   14,   // m/s forward
  maxReverse:  5,
  accel:       7,
  brake:      20,
  friction:    5,   // deceleration m/s when no input
  turnSpeed:   1.6, // rad/s at full speed
  boostMult:   1.7,
  collRadius:  1.3,
  wheelRadius: 0.37,
}
const BIKE_CFG = {
  maxSpeed:   22,
  maxReverse:  4,
  accel:      12,
  brake:      18,
  friction:    6,
  turnSpeed:   2.6,
  boostMult:   2.0,
  leanAngle:   0.38,
  collRadius:  0.65,
  wheelRadius: 0.38,
}

// Live NPC positions — each entry is { x, z }, mutated by Avatar3D each frame
const npcLivePositions = []

// Push-out collision resolution. Handles boxes (buildings) + circles (trees/fountain/NPCs).
// Two iterations resolve corner contacts without jitter.
// r = mover radius (CHAR_R for walking, larger for vehicles)
function resolveCollisions(nx, nz, r = CHAR_R) {
  let x = nx, z = nz

  for (let iter = 0; iter < 2; iter++) {
    // AABB box colliders
    for (let i = 0; i < BOX_COLLIDERS.length; i++) {
      const b  = BOX_COLLIDERS[i]
      const ex = b.hw + r
      const ez = b.hd + r
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
      const min = c.r + r
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
      const min = NPC_R + r
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

// ── Speedometer overlay (DOM, lives outside Canvas) ──────────────────────
function Speedometer({ kmh }) {
  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24,
      width: 80, height: 80, borderRadius: '50%',
      background: 'rgba(0,0,0,0.7)', border: '3px solid #facc15',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 22, fontWeight: 'bold', color: '#facc15', lineHeight: 1 }}>
        {Math.round(kmh)}
      </span>
      <span style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>km/h</span>
    </div>
  )
}

// ── Place marker (clickable zone) ─────────────────────────────────────────
function PlaceMarker({ position, emoji, label, color, onClick }) {
  const badgeRef = useRef()
  const ringRef  = useRef()
  const hovered  = useRef(false)

  useFrame(({ clock }) => {
    if (badgeRef.current) {
      badgeRef.current.position.y = 3.8 + Math.sin(clock.elapsedTime * 2) * 0.12
      const ts = hovered.current ? 1.18 : 1
      badgeRef.current.scale.x += (ts - badgeRef.current.scale.x) * 0.15
      badgeRef.current.scale.y = badgeRef.current.scale.z = badgeRef.current.scale.x
    }
    if (ringRef.current) {
      const to = hovered.current ? 0.55 : 0.28
      ringRef.current.material.opacity += (to - ringRef.current.material.opacity) * 0.12
    }
  })

  return (
    <group position={position}>
      {/* Ground glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.5, 1.9, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>

      {/* Floating badge */}
      <group
        ref={badgeRef}
        position={[0, 3.8, 0]}
        onClick={onClick}
        onPointerOver={() => { hovered.current = true; document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { hovered.current = false; document.body.style.cursor = 'default' }}
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

// Building IDs that have interiors (park/playground are outdoor, no interior)
const INTERIOR_IDS = new Set([
  'beach','cafe','arcade','rooftop','musicroom','cityhall','mall','cinema',
  'supermarket','bank','hospital','police','firestation','school','library',
  'gym','restaurant','gasstation','church','postoffice','apartments','house1','house2',
])

// ── Player controller ─────────────────────────────────────────────────────
// Custom camera: left-click drag = orbit, scroll = zoom, WASD = move character
function PlayerController({ avatar, onNearVehicle, onDrivingChange, onSpeedChange, onNearBuilding, onEnterBuilding }) {
  const { camera, gl } = useThree()
  const setPlayerPos = useStore(s => s.setPlayerPos)

  // Character world position and facing
  const charPos    = useRef(new THREE.Vector3(0, 0, 6))
  const charFacing = useRef(0)

  // Camera spherical coords around character/vehicle
  const camYaw   = useRef(0)
  const camPitch = useRef(0.5)
  const camDist  = useRef(12)

  // Input state
  const keys  = useRef(new Set())
  const mouse = useRef({ down: false, lastX: 0, lastY: 0 })

  // Player group ref
  const playerGroupRef = useRef()

  // Walk state
  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)
  const lastSentPos = useRef(new THREE.Vector3(0, 0, 6))

  // ── Vehicle refs ──────────────────────────────────────────────────────
  const carGroupRef   = useRef()
  const bikeGroupRef  = useRef()
  const carWheels     = useRef([null, null, null, null])
  const bikeWheels    = useRef([null, null])
  const bikeLeanRef   = useRef()
  const carDustRefs   = useRef([null, null])
  const bikeDustRef   = useRef()

  // Vehicle physics state — pos is world Vector3, facing in radians, speed in m/s
  const carState  = useRef({ pos: new THREE.Vector3(8, 0, 20),  facing: 0, speed: 0 })
  const bikeState = useRef({ pos: new THREE.Vector3(-18, 0, 6), facing: 0, speed: 0 })

  const activeVeh      = useRef(null)  // null | 'car' | 'bike'
  const vehLean        = useRef(0)
  const nearVehRef     = useRef(null)
  const nearBldRef     = useRef(null)
  const vehDetectTick  = useRef(0)
  const speedThrottle  = useRef(0)
  const speedKmhRef    = useRef(0)

  // Visibility state (re-renders only on enter/exit)
  const [inVehicle, setInVehicle] = useState(false)

  useEffect(() => {
    const el = gl.domElement

    const onKeyDown = (e) => {
      if (!gameControls.enabled) return
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault()
      keys.current.add(e.code)

      // ── E: enter or exit vehicle ──
      if (e.code === 'KeyE') {
        if (activeVeh.current) {
          // Exit — place player beside vehicle, perpendicular to its facing
          const vst   = activeVeh.current === 'car' ? carState.current : bikeState.current
          const perpX =  Math.cos(vst.facing)
          const perpZ = -Math.sin(vst.facing)
          charPos.current.set(vst.pos.x + perpX * 2.5, 0, vst.pos.z + perpZ * 2.5)
          charFacing.current = vst.facing
          activeVeh.current  = null
          nearVehRef.current = null
          setInVehicle(false)
          onDrivingChange(null)
          onNearVehicle(null)
          onSpeedChange(0)
        } else {
          const ENTER_R = 3.5
          const cDist = charPos.current.distanceTo(carState.current.pos)
          const bDist = charPos.current.distanceTo(bikeState.current.pos)
          if (cDist < ENTER_R && cDist <= bDist) {
            activeVeh.current = 'car'
            // Snap camera behind vehicle
            let snap = carState.current.facing + Math.PI
            camYaw.current = snap
            setInVehicle(true)
            onDrivingChange('car')
            onNearVehicle(null)
          } else if (bDist < ENTER_R) {
            activeVeh.current = 'bike'
            let snap = bikeState.current.facing + Math.PI
            camYaw.current = snap
            vehLean.current = 0
            setInVehicle(true)
            onDrivingChange('bike')
            onNearVehicle(null)
          } else if (nearBldRef.current) {
            onEnterBuilding?.(nearBldRef.current.id)
          }
        }
      }
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
    const BOUNDS = 53

    // ══════════════════════════════════════════════════════════════════════
    // VEHICLE MODE
    // ══════════════════════════════════════════════════════════════════════
    if (activeVeh.current) {
      const isCar  = activeVeh.current === 'car'
      const vst    = isCar ? carState.current : bikeState.current
      const cfg    = isCar ? CAR_CFG : BIKE_CFG
      const vGroup = isCar ? carGroupRef.current : bikeGroupRef.current
      const wRefs  = isCar ? carWheels.current : bikeWheels.current

      const fwd   = keys.current.has('KeyW') || keys.current.has('ArrowUp')
      const bwd   = keys.current.has('KeyS') || keys.current.has('ArrowDown')
      const left  = keys.current.has('KeyA') || keys.current.has('ArrowLeft')
      const right = keys.current.has('KeyD') || keys.current.has('ArrowRight')
      const boost = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
      const maxSpd = cfg.maxSpeed * (boost ? cfg.boostMult : 1)

      // Acceleration / braking / friction
      if (fwd) {
        vst.speed = Math.min(vst.speed + cfg.accel * delta, maxSpd)
      } else if (bwd) {
        if (vst.speed > 0.15) {
          vst.speed = Math.max(vst.speed - cfg.brake * delta, 0)
        } else {
          vst.speed = Math.max(vst.speed - cfg.accel * 0.5 * delta, -cfg.maxReverse)
        }
      } else {
        const fric = cfg.friction * delta
        vst.speed = Math.abs(vst.speed) < fric ? 0 : vst.speed - Math.sign(vst.speed) * fric
      }

      // Steering (speed-weighted — cannot spin in place)
      const absSpd = Math.abs(vst.speed)
      if (absSpd > 0.08) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        vst.facing += steer * cfg.turnSpeed * speedFrac * delta * (vst.speed >= 0 ? 1 : -1)
      }

      // Move along facing direction
      vst.pos.x += Math.sin(vst.facing) * vst.speed * delta
      vst.pos.z += Math.cos(vst.facing) * vst.speed * delta

      // Collision (hard stop on impact)
      const [vx, vz] = resolveCollisions(vst.pos.x, vst.pos.z, cfg.collRadius)
      if (Math.abs(vx - vst.pos.x) > 0.002 || Math.abs(vz - vst.pos.z) > 0.002) vst.speed *= 0.05
      vst.pos.x = THREE.MathUtils.clamp(vx, -BOUNDS, BOUNDS)
      vst.pos.z = THREE.MathUtils.clamp(vz, -BOUNDS, BOUNDS)

      // Update visual group
      if (vGroup) {
        vGroup.position.set(vst.pos.x, 0, vst.pos.z)
        vGroup.rotation.y = vst.facing
      }

      // Wheel spin
      const spin = (vst.speed * delta) / cfg.wheelRadius
      for (let i = 0; i < wRefs.length; i++) {
        if (wRefs[i]) wRefs[i].rotation.x -= spin
      }

      // Bike lean
      if (!isCar && bikeLeanRef.current) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        const target    = -steer * cfg.leanAngle * speedFrac
        vehLean.current += (target - vehLean.current) * Math.min(1, delta * 6)
        bikeLeanRef.current.rotation.z = vehLean.current
      }

      // Dust particles
      const dustOpacity = (fwd && absSpd > 2) ? Math.min(0.6, absSpd * 0.04) : 0
      if (isCar) {
        for (let i = 0; i < carDustRefs.current.length; i++) {
          const dm = carDustRefs.current[i]
          if (dm) {
            dm.material.opacity = dustOpacity > 0
              ? dustOpacity * (0.7 + Math.random() * 0.3)
              : dm.material.opacity * 0.8
            if (dustOpacity > 0) dm.scale.setScalar(0.8 + absSpd * 0.04)
          }
        }
      } else if (bikeDustRef.current) {
        const dm = bikeDustRef.current
        dm.material.opacity = dustOpacity > 0
          ? dustOpacity * (0.7 + Math.random() * 0.3)
          : dm.material.opacity * 0.8
      }

      // Camera auto-follows behind vehicle (smooth, overrideable by drag)
      if (!mouse.current.down) {
        const targetYaw = vst.facing + Math.PI
        let diff = targetYaw - camYaw.current
        while (diff >  Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        camYaw.current += diff * Math.min(1, delta * 2.5)
      }

      const px = vst.pos.x, pz = vst.pos.z
      const d  = camDist.current, p = camPitch.current, y = camYaw.current
      camera.position.set(
        px + d * Math.sin(y) * Math.cos(p),
             d * Math.sin(p),
        pz + d * Math.cos(y) * Math.cos(p),
      )
      camera.lookAt(px, 0.9, pz)

      // Keep charPos synced for exit placement
      charPos.current.copy(vst.pos)

      // Throttle speedometer
      speedThrottle.current += delta
      if (speedThrottle.current > 0.08) {
        speedThrottle.current = 0
        const kmh = absSpd * 3.6
        if (Math.abs(kmh - speedKmhRef.current) > 0.5) {
          speedKmhRef.current = kmh
          onSpeedChange(kmh)
        }
      }

      return  // skip walking logic
    }

    // ══════════════════════════════════════════════════════════════════════
    // WALKING MODE
    // ══════════════════════════════════════════════════════════════════════
    const SPEED = 8
    let moving  = false
    _move.current.set(0, 0, 0)

    if (gameControls.enabled) {
      const sy = Math.sin(camYaw.current)
      const cy = Math.cos(camYaw.current)

      if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { _move.current.x -= sy; _move.current.z -= cy; moving = true }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { _move.current.x += sy; _move.current.z += cy; moving = true }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { _move.current.x -= cy; _move.current.z += sy; moving = true }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { _move.current.x += cy; _move.current.z -= sy; moving = true }
    }

    if (moving) {
      _move.current.normalize()
      charPos.current.addScaledVector(_move.current, SPEED * delta)
      charFacing.current = Math.atan2(_move.current.x, _move.current.z)
    }

    const [cx, cz] = resolveCollisions(charPos.current.x, charPos.current.z)
    charPos.current.x = THREE.MathUtils.clamp(cx, -BOUNDS, BOUNDS)
    charPos.current.z = THREE.MathUtils.clamp(cz, -BOUNDS, BOUNDS)
    charPos.current.y = 0

    if (moving !== isWalkingRef.current) {
      isWalkingRef.current = moving
      setIsWalking(moving)
    }

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(charPos.current.x, 0, charPos.current.z)
      playerGroupRef.current.rotation.y = charFacing.current
    }

    const px = charPos.current.x, pz = charPos.current.z
    const d  = camDist.current,   p  = camPitch.current, y = camYaw.current
    camera.position.set(
      px + d * Math.sin(y) * Math.cos(p),
           d * Math.sin(p),
      pz + d * Math.cos(y) * Math.cos(p),
    )
    camera.lookAt(px, 0.9, pz)

    if (charPos.current.distanceTo(lastSentPos.current) > 0.5) {
      lastSentPos.current.copy(charPos.current)
      setPlayerPos([charPos.current.x, 0, charPos.current.z])
    }

    // Near-vehicle + building detection (throttled)
    vehDetectTick.current += delta
    if (vehDetectTick.current > 0.2) {
      vehDetectTick.current = 0
      const cDist = charPos.current.distanceTo(carState.current.pos)
      const bDist = charPos.current.distanceTo(bikeState.current.pos)
      const near  = cDist < 3.5 ? 'Car' : bDist < 3.5 ? 'Bike' : null
      if (near !== nearVehRef.current) {
        nearVehRef.current = near
        onNearVehicle(near)
      }

      let nearBld = null
      for (const p of PLACES) {
        if (!INTERIOR_IDS.has(p.id)) continue
        const dx = charPos.current.x - p.pos[0]
        const dz = charPos.current.z - p.pos[2]
        if (dx * dx + dz * dz < 30) { nearBld = p; break }
      }
      if (nearBld?.id !== nearBldRef.current?.id) {
        nearBldRef.current = nearBld
        onNearBuilding?.(nearBld)
      }
    }
  })

  return (
    <>
      {/* Player avatar — hidden while in vehicle */}
      <group ref={playerGroupRef} position={[0, 0, 6]} visible={!inVehicle}>
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

      {/* Car — parked near restaurant area */}
      <group ref={carGroupRef} position={[8, 0, 20]}>
        <Car3D wheelRefs={carWheels} dustRefs={carDustRefs} />
        {/* Parked label */}
        {!inVehicle && (
          <Billboard position={[0, 2.2, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🚗 Car</Text>
          </Billboard>
        )}
      </group>

      {/* Bike — parked near the park area */}
      <group ref={bikeGroupRef} position={[-18, 0, 6]}>
        <Bike3D wheelRefs={bikeWheels} leanRef={bikeLeanRef} dustRef={bikeDustRef} />
        {!inVehicle && (
          <Billboard position={[0, 2.0, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🏍 Bike</Text>
          </Billboard>
        )}
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
function WorldScene({ onNPCChat }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[12, 18, 8]} intensity={1.3} color="#FFF8DC" />
      <directionalLight position={[-10, 10, -8]} intensity={0.5} color="#b0c4de" />
      <hemisphereLight skyColor="#87ceeb" groundColor="#2d5a27" intensity={0.4} />

      {/* Sky */}
      <Stars radius={90} depth={50} count={1200} factor={3} fade />

      {/* Full city geometry */}
      <CityMap />

      {/* Interactive place markers — visual only, entry via E key */}
      {PLACES.map(p => (
        <PlaceMarker
          key={p.id}
          position={p.pos}
          emoji={p.emoji}
          label={p.label}
          color={p.color}
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
export default function WorldCanvas({ onNPCChat, onEnterBuilding }) {
  const avatar = useStore(s => s.avatar)

  const [nearVeh,     setNearVeh]     = useState(null)   // 'Car' | 'Bike' | null
  const [drivingType, setDrivingType] = useState(null)   // 'car' | 'bike' | null
  const [speedKmh,    setSpeedKmh]    = useState(0)
  const [nearBuilding, setNearBuilding] = useState(null) // place object | null

  return (
    <div className="canvas-wrap">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 10, 18], fov: 55, near: 0.1, far: 150 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Suspense fallback={null}>
          <WorldScene onNPCChat={onNPCChat} />
          <PlayerController
            avatar={avatar}
            onNearVehicle={setNearVeh}
            onDrivingChange={setDrivingType}
            onSpeedChange={setSpeedKmh}
            onNearBuilding={setNearBuilding}
            onEnterBuilding={onEnterBuilding}
          />
        </Suspense>
      </Canvas>

      {/* Building enter prompt */}
      {nearBuilding && !drivingType && !nearVeh && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#a78bfa', padding: '8px 22px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #7c3aed',
        }}>
          Press <strong>E</strong> to enter {nearBuilding.label}
        </div>
      )}

      {/* Vehicle enter prompt */}
      {nearVeh && !drivingType && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#facc15', padding: '8px 20px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #facc15',
        }}>
          Press <strong>E</strong> to enter {nearVeh}
        </div>
      )}

      {/* E-to-exit hint + speedometer while driving */}
      {drivingType && (
        <>
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '6px 16px',
            borderRadius: 8, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none',
          }}>
            <strong>E</strong> — Exit vehicle &nbsp;|&nbsp;
            <strong>W/S</strong> Accel/Brake &nbsp;|&nbsp;
            <strong>A/D</strong> Steer &nbsp;|&nbsp;
            <strong>Shift</strong> Boost
          </div>
          <Speedometer kmh={speedKmh} />
        </>
      )}
    </div>
  )
}
