import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { useUser } from '@clerk/clerk-react'
import DayNightCycle from './DayNightCycle'
import WeatherSystem from './WeatherSystem'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'
import { mobileInput } from '@/lib/mobileInput'
import { audioSystem, isOnRoad } from '@/lib/audioSystem'
import { minimapState, npcLivePositions, chatState } from '@/lib/minimapState'
import { vehicleState } from '@/lib/vehicleState'
import { remotePlayersRef } from '@/lib/multiplayerState'
import PlayerModel from './PlayerModel'
import NPCModel from './NPCModel'
import CityMap from './CityMap'
import { Car3D, Bike3D } from './Vehicle3D'
import RemotePlayer from './RemotePlayer'
import RemoteVehicle from './RemoteVehicle'
import ProceduralWorld from './ProceduralChunks'
import NPCTraffic from './NPCTraffic'
import { parkedVehicles, onParkedVehicleChange, notifyParkedVehicleChange } from '@/lib/parkedVehicleState'
import EmotePicker from '@/components/EmotePicker'
import BossCharacter from './BossCharacter'
import MissionOrb from './MissionOrb'
import GameAreaScene, { GAME_AREA_POS, GAME_AREA_ID } from './GameAreaBuilding'
import { bossActiveFlag } from '@/lib/bossState'
import { orbActiveFlag, getMissionStatus, completeMission } from '@/lib/missionState'
import { teleportRequest } from '@/lib/teleportState'

// ── Collision system ──────────────────────────────────────────────────────────
const CHAR_R = 0.28
const NPC_R  = 0.32

const BOX_COLLIDERS = [
  { x:   0, z: -22, hw: 5.0, hd: 3.0 },
  { x: -16, z: -28, hw: 7.0, hd: 4.0 },
  { x:  16, z: -28, hw: 5.0, hd: 3.5 },
  { x: -28, z: -18, hw: 5.0, hd: 3.0 },
  { x:  28, z: -18, hw: 3.5, hd: 2.5 },
  { x:  34, z:  -5, hw: 3.5, hd: 3.0 },
  { x:  34, z:  10, hw: 2.5, hd: 2.5 },
  { x:  34, z:  22, hw: 3.5, hd: 2.5 },
  { x: -34, z:  -5, hw: 4.5, hd: 3.0 },
  { x: -34, z: -20, hw: 3.5, hd: 2.5 },
  { x: -34, z:  10, hw: 3.0, hd: 2.5 },
  { x:  12, z:  28, hw: 2.5, hd: 2.0 },
  { x: -12, z:26.5, hw: 2.0, hd: 1.5 },
  { x: -25, z:  18, hw: 3.0, hd: 3.5 },
  { x:  12, z:  18, hw: 2.5, hd: 2.0 },
  { x: -26, z:  30, hw: 2.5, hd: 2.0 },
  { x: -10, z:  -6, hw: 2.5, hd: 2.0 },
  { x:  10, z:  -6, hw: 2.5, hd: 2.0 },
  { x:   0, z: -14, hw: 4.0, hd: 2.0 },
  { x: -14, z:   4, hw: 2.0, hd: 2.0 },
  { x:  14, z:   4, hw: 2.0, hd: 2.5 },
  { x:   0, z:  14, hw: 3.5, hd: 2.5 },
  { x:  -6, z: -10, hw: 1.0, hd: 1.0 },
  { x:   6, z: -10, hw: 1.0, hd: 1.0 },
  { x:  -7, z:  10, hw: 1.0, hd: 1.0 },
  { x:   7, z:  10, hw: 1.0, hd: 1.0 },
  { x:  -5, z: -28, hw: 2.0, hd: 1.5 },
  { x:   5, z: -28, hw: 2.0, hd: 1.5 },
  { x: 26, z: 24, hw: 1.5, hd: 1.5 },
  { x: 36, z: 24, hw: 1.5, hd: 1.5 },
  { x: 26, z: 34, hw: 1.5, hd: 1.5 },
  { x: 36, z: 34, hw: 1.5, hd: 1.5 },
  { x: 46, z: 24, hw: 1.5, hd: 1.5 },
  { x: 46, z: 34, hw: 1.5, hd: 1.5 },
  { x: 26, z: 44, hw: 1.5, hd: 1.5 },
  { x: 36, z: 44, hw: 1.5, hd: 1.5 },
  // Game Area / Cartoon Arcade
  { x: 22, z: -10, hw: 4.5, hd: 3.5 },
]

const CIRCLE_COLLIDERS = [
  { x:  0,    z:    0, r: 1.55 },
  { x: -4,   z:  -4,  r: 0.38 }, { x: -4,   z:   4,  r: 0.38 },
  { x:  4,   z:  -4,  r: 0.38 }, { x:  4,   z:   4,  r: 0.38 },
  { x: -8,   z:   8,  r: 0.38 }, { x:  8,   z:   8,  r: 0.38 },
  { x: -8,   z:  -8,  r: 0.38 }, { x:  8,   z:  -8,  r: 0.38 },
  { x:-12,   z:  -2,  r: 0.38 }, { x: 12,   z:  -2,  r: 0.38 },
  { x:-48, z:-4.5, r:0.33 }, { x:-38, z:-4.5, r:0.33 }, { x:-28, z:-4.5, r:0.33 },
  { x:-22, z:-4.5, r:0.33 }, { x: -8, z:-4.5, r:0.33 }, { x:  8, z:-4.5, r:0.33 },
  { x: 22, z:-4.5, r:0.33 }, { x: 28, z:-4.5, r:0.33 }, { x: 38, z:-4.5, r:0.33 },
  { x: 48, z:-4.5, r:0.33 },
  { x:-48, z: 4.5, r:0.33 }, { x:-38, z: 4.5, r:0.33 }, { x:-28, z: 4.5, r:0.33 },
  { x:-22, z: 4.5, r:0.33 }, { x: -8, z: 4.5, r:0.33 }, { x:  8, z: 4.5, r:0.33 },
  { x: 22, z: 4.5, r:0.33 }, { x: 28, z: 4.5, r:0.33 }, { x: 38, z: 4.5, r:0.33 },
  { x: 48, z: 4.5, r:0.33 },
  { x:-4.5, z:-45,   r:0.32 }, { x:-4.5, z:-36.5, r:0.32 }, { x:-4.5, z:-24, r:0.32 },
  { x:-4.5, z:-14,   r:0.32 }, { x:-4.5, z:  14,  r:0.32 }, { x:-4.5, z: 24, r:0.32 },
  { x:-4.5, z: 36.5, r:0.32 }, { x:-4.5, z: 45,   r:0.32 },
  { x:22, z:20, r:0.30 }, { x:30, z:20, r:0.30 }, { x:37, z:20, r:0.30 }, { x:50, z:20, r:0.30 },
  { x:22, z:30, r:0.30 }, { x:30, z:30, r:0.30 }, { x:37, z:30, r:0.30 }, { x:50, z:30, r:0.30 },
  { x:22, z:40, r:0.30 }, { x:30, z:40, r:0.30 }, { x:37, z:40, r:0.30 }, { x:50, z:40, r:0.30 },
  { x:22, z:50, r:0.30 }, { x:30, z:50, r:0.30 }, { x:37, z:50, r:0.30 }, { x:50, z:50, r:0.30 },
  { x:-16, z:24, r:0.32 }, { x:-17, z:24, r:0.32 },
  { x:-22, z:24, r:0.32 }, { x:-24, z:24, r:0.32 },
  { x: -8, z:-20, r:0.31 }, { x:  8, z:-20, r:0.31 },
]

const CAR_CFG = {
  maxSpeed:   14,
  maxReverse:  5,
  accel:       7,
  brake:      20,
  friction:    5,
  turnSpeed:   1.6,
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

function resolveCollisions(nx, nz, r = CHAR_R) {
  let x = nx, z = nz
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < BOX_COLLIDERS.length; i++) {
      const b  = BOX_COLLIDERS[i]
      const ex = b.hw + r, ez = b.hd + r
      const dx = x - b.x, dz = z - b.z
      if (Math.abs(dx) < ex && Math.abs(dz) < ez) {
        const px = ex - Math.abs(dx), pz = ez - Math.abs(dz)
        if (px < pz) x += px * (dx >= 0 ? 1 : -1)
        else         z += pz * (dz >= 0 ? 1 : -1)
      }
    }
    for (let i = 0; i < CIRCLE_COLLIDERS.length; i++) {
      const c  = CIRCLE_COLLIDERS[i]
      const dx = x - c.x, dz = z - c.z
      const d2 = dx * dx + dz * dz
      const min = c.r + r
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (min - d) / d
        x += dx * push; z += dz * push
      }
    }
    for (let i = 0; i < npcLivePositions.length; i++) {
      const c  = npcLivePositions[i]
      const dx = x - c.x, dz = z - c.z
      const d2 = dx * dx + dz * dz
      const min = NPC_R + r
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (min - d) / d
        x += dx * push; z += dz * push
      }
    }
  }
  return [x, z]
}

// ── Speedometer ──────────────────────────────────────────────────────────────
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

// ── Place marker ─────────────────────────────────────────────────────────────
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
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.5, 1.9, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>
      <group
        ref={badgeRef}
        position={[0, 3.8, 0]}
        onClick={onClick}
        onPointerOver={() => { hovered.current = true;  document.body.style.cursor = 'pointer' }}
        onPointerOut={() =>  { hovered.current = false; document.body.style.cursor = 'default' }}
      >
        <mesh>
          <capsuleGeometry args={[0.35, 0.55, 4, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
        <Billboard>
          <Text fontSize={0.28} anchorX="center" anchorY="middle" position={[0, 0.08, 0.38]}>{emoji}</Text>
          <Text fontSize={0.12} color="white" anchorX="center" anchorY="middle" position={[0, -0.3, 0.38]}>{label}</Text>
        </Billboard>
      </group>
    </group>
  )
}

// ── FPS tracker ──────────────────────────────────────────────────────────────
const _fps = { value: 0 }
function FpsTracker() {
  const frameCount = useRef(0)
  const lastTime   = useRef(performance.now())
  useFrame(() => {
    frameCount.current++
    const now = performance.now()
    if (now - lastTime.current >= 500) {
      _fps.value = Math.round(frameCount.current * 1000 / (now - lastTime.current))
      frameCount.current = 0; lastTime.current = now
    }
  })
  return null
}

// ── NPC scale (stable, name-based hash) ──────────────────────────────────────
function npcScaleFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return 0.009 + (h % 21) / 10000
}

// ── NPC wanderer ─────────────────────────────────────────────────────────────
const NPC = React.memo(function NPC({ startPos, skin, outfit, name, color, onChat }) {
  const [target, setTarget] = useState(startPos)
  const groupRef            = useRef()
  const currentPos          = useRef(new THREE.Vector3(...startPos))
  const targetVec           = useRef(new THREE.Vector3(...startPos))
  const isWalkingRef        = useRef(false)
  const [isWalking, setIsWalking] = useState(false)
  const npcVisRef           = useRef(true)
  const posEntry            = useRef({ x: startPos[0], z: startPos[2], color })
  const autoCloseRef        = useRef(false)

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
      const r     = 2 + Math.random() * 5
      setTarget([startPos[0] + Math.cos(angle) * r, 0, startPos[2] + Math.sin(angle) * r])
    }
    wander()
    const id = setInterval(wander, 4000 + Math.random() * 3000)
    return () => clearInterval(id)
  }, [])

  const npcTimer = useRef(0)
  useFrame((_, delta) => {
    npcTimer.current += Math.min(delta, 0.05)
    if (npcTimer.current < 0.033) return
    const dt = npcTimer.current; npcTimer.current = 0

    if (!groupRef.current) return
    const pdx = currentPos.current.x - minimapState.playerX
    const pdz = currentPos.current.z - minimapState.playerZ
    const nearPlayer = (pdx * pdx + pdz * pdz) < 1225
    groupRef.current.visible = nearPlayer
    npcVisRef.current = nearPlayer
    if (!nearPlayer) return

    const isChatting = chatState.activeNpcName === name
    if (isChatting) {
      const distSq = pdx * pdx + pdz * pdz
      if (!autoCloseRef.current && distSq > 64) {
        autoCloseRef.current = true
        window.dispatchEvent(new CustomEvent('npc-auto-close'))
      }
      if (isWalkingRef.current) { isWalkingRef.current = false; setIsWalking(false) }
      return
    }
    autoCloseRef.current = false

    targetVec.current.set(target[0], 0, target[2])
    const dist   = currentPos.current.distanceTo(targetVec.current)
    const moving = dist > 0.15
    if (moving !== isWalkingRef.current) { isWalkingRef.current = moving; setIsWalking(moving) }

    if (moving) {
      const dx   = targetVec.current.x - currentPos.current.x
      const dz   = targetVec.current.z - currentPos.current.z
      const len  = Math.sqrt(dx * dx + dz * dz)
      const step = Math.min(2.5 * dt, dist)
      currentPos.current.x += (dx / len) * step
      currentPos.current.z += (dz / len) * step
      groupRef.current.position.set(currentPos.current.x, 0, currentPos.current.z)
      groupRef.current.rotation.y = Math.atan2(dx, dz)
    }
    posEntry.current.x = currentPos.current.x
    posEntry.current.z = currentPos.current.z
  })

  const npcScale = useMemo(() => npcScaleFor(name), [name])

  return (
    <group ref={groupRef} position={startPos}>
      <NPCModel
        outfit={outfit} skin={skin} walking={isWalking}
        name={name} labelColor={color} npcScale={npcScale}
        sublabel="• NPC" sublabelColor="#f59e0b"
        visibleRef={npcVisRef}
        onClick={onChat ? (e) => { e.stopPropagation(); onChat(e) } : null}
      />
    </group>
  )
})

const INTERIOR_IDS = new Set([
  'beach','cafe','arcade','rooftop','musicroom','cityhall','mall','cinema',
  'supermarket','bank','hospital','police','firestation','school','library',
  'gym','restaurant','gasstation','church','postoffice','apartments','house1','house2',
  'gamearea',
])

// ── Player controller ─────────────────────────────────────────────────────────
function PlayerController({
  avatar, myUserId,
  onNearVehicle, onDrivingChange, onSpeedChange,
  onNearBuilding, onEnterBuilding, onPassengerChange,
  onNearParkedVehicle,
}) {
  const { camera, gl, scene } = useThree()
  const setPlayerPos = useStore(s => s.setPlayerPos)

  const charPos    = useRef(new THREE.Vector3(0, 0, 6))
  const charFacing = useRef(0)
  const camYaw     = useRef(0)
  const camPitch   = useRef(0.5)
  const camDist    = useRef(12)

  // Building occlusion: raycaster + set of currently faded materials
  const occlusionRay      = useRef(new THREE.Raycaster())
  const occludedMaterials = useRef(new Set())
  const keys       = useRef(new Set())
  const mouse      = useRef({ down: false, lastX: 0, lastY: 0, pointerId: -1 })
  const lastPinch    = useRef(0)
  const pinchActive  = useRef(false)
  const lastMouseTime = useRef(0)
  const playerGroupRef = useRef()

  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)
  const isRunningRef = useRef(false)
  const [isRunning,  setIsRunning]  = useState(false)
  const lastSentPos  = useRef(new THREE.Vector3(0, 0, 6))

  const carGroupRef  = useRef()
  const bikeGroupRef = useRef()
  const carWheels    = useRef([null, null, null, null])
  const bikeWheels   = useRef([null, null])
  const bikeLeanRef  = useRef()
  const carDustRefs  = useRef([null, null])
  const bikeDustRef  = useRef()

  const carState   = useRef({ pos: new THREE.Vector3(vehicleState.car.x,  0, vehicleState.car.z),  facing: vehicleState.car.facing,  speed: 0 })
  const bikeState  = useRef({ pos: new THREE.Vector3(vehicleState.bike.x, 0, vehicleState.bike.z), facing: vehicleState.bike.facing, speed: 0 })

  const activeVeh     = useRef(null)   // null | 'car' | 'bike'  (I am driver)
  const passengerVeh  = useRef(null)   // null | 'car' | 'bike'  (I am passenger)
  const vehLean       = useRef(0)
  const nearVehRef    = useRef(null)
  const nearBldRef    = useRef(null)
  const coopTimerRef  = useRef(0)   // seconds near 2+ players while m1_4 active
  const vehDetectTick = useRef(0)
  const speedThrottle = useRef(0)
  const speedKmhRef   = useRef(0)

  // ── Parked vehicle driving ────────────────────────────────────────────────
  const activeParkedIdx   = useRef(null)  // index into parkedVehicles, or null
  const parkedDriveState  = useRef(null)  // { pos, facing, speed } while driving
  const parkedGroupRef    = useRef()
  const parkedWheels      = useRef([null, null, null, null])
  const parkedDusts       = useRef([null, null])
  const parkedLean        = useRef(null)
  const parkedBDust       = useRef(null)
  // Stable prop-wrapper objects that Car3D / Bike3D write into via ref callbacks
  const pvWheelRef  = useRef({ current: null })
  const pvDustRef   = useRef({ current: null })
  pvWheelRef.current.current = parkedWheels.current
  pvDustRef.current.current  = parkedDusts.current
  const nearParkedRef = useRef(null)
  const [drivingParked, setDrivingParked] = useState(null) // null | {type,color}

  const [inVehicle,   setInVehicle]   = useState(false)
  const [isPassenger, setIsPassenger] = useState(false)

  // Emote state
  const emoteRef = useRef('')
  const [emote, setEmote] = useState('')
  const triggerEmote = useCallback((name) => {
    emoteRef.current = name
    setEmote(name)
    minimapState.currentEmote = name
  }, [])
  const cancelEmote = useCallback(() => {
    emoteRef.current = ''
    setEmote('')
    minimapState.currentEmote = ''
  }, [])
  const handleEmoteEnd = useCallback(() => {
    emoteRef.current = ''
    setEmote('')
    minimapState.currentEmote = ''
  }, [])

  useEffect(() => {
    const el = gl.domElement

    const onKeyDown = (e) => {
      audioSystem.unlock()
      if (!gameControls.enabled) return
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault()
      keys.current.add(e.code)
      if (e.code === 'KeyF') {
        audioSystem.playInteract()
        window.dispatchEvent(new CustomEvent('player-interact', {
          detail: { nearBoss: minimapState.nearBoss, nearOrb: minimapState.nearOrb },
        }))
      }

      // ── H key: vehicle horn ───────────────────────────────────────────
      if (e.code === 'KeyH') {
        const inVeh = activeVeh.current || activeParkedIdx.current !== null
        if (inVeh) {
          const vType = activeVeh.current ||
            (activeParkedIdx.current !== null ? parkedVehicles[activeParkedIdx.current]?.type : null)
          audioSystem.playHorn(vType || 'car')
        }
      }

      // ── Emote shortcuts (1-4) ─────────────────────────────────────────
      if (!activeVeh.current && !passengerVeh.current && activeParkedIdx.current === null) {
        if (e.code === 'Digit1' && !emoteRef.current) { triggerEmote('greet');     return }
        if (e.code === 'Digit2' && !emoteRef.current) { triggerEmote('dance');     return }
        if (e.code === 'Digit3' && !emoteRef.current) { triggerEmote('laughing');  return }
        if (e.code === 'Digit4' && !emoteRef.current) { triggerEmote('handshake'); return }
        if (e.code === 'Escape' && emoteRef.current)  { cancelEmote(); return }
      }

      if (e.code === 'KeyE') {
        audioSystem.playInteractE()
        // ── 1. Exit passenger mode ────────────────────────────────────────
        if (passengerVeh.current) {
          const vType = passengerVeh.current
          const vs    = vehicleState[vType]
          const px    = vs.x + Math.cos(vs.facing + Math.PI / 2) * 2.2
          const pz    = vs.z + Math.sin(vs.facing + Math.PI / 2) * 2.2
          charPos.current.set(px, 0, pz)
          charFacing.current = vs.facing
          if (playerGroupRef.current) playerGroupRef.current.visible = true
          passengerVeh.current = null
          minimapState.passengerOf = null
          setIsPassenger(false)
          onPassengerChange?.(false)
          window.dispatchEvent(new CustomEvent('passenger-exit', { detail: { vType } }))
          audioSystem.playEnter()
          return
        }

        // ── 2. Exit driver mode ───────────────────────────────────────────
        if (activeVeh.current) {
          const vType = activeVeh.current
          const vst   = vType === 'car' ? carState.current : bikeState.current
          const px    = vst.pos.x + Math.cos(vst.facing + Math.PI / 2) * 2.5
          const pz    = vst.pos.z + Math.sin(vst.facing + Math.PI / 2) * 2.5
          charPos.current.set(px, 0, pz)
          charFacing.current = vst.facing
          if (playerGroupRef.current) playerGroupRef.current.visible = true
          window.dispatchEvent(new CustomEvent('vehicle-released', {
            detail: { vType, x: vst.pos.x, z: vst.pos.z, facing: vst.facing },
          }))
          activeVeh.current  = null
          nearVehRef.current = null
          setInVehicle(false)
          onDrivingChange(null)
          onNearVehicle(null)
          onSpeedChange(0)
          audioSystem.stopEngine()
          audioSystem.playEnter()
          return
        }

        // ── 2b. Exit parked vehicle ───────────────────────────────────────
        if (activeParkedIdx.current !== null) {
          const pvIdx = activeParkedIdx.current
          const pv    = parkedVehicles[pvIdx]
          const vst   = parkedDriveState.current
          const ex    = vst.pos.x + Math.cos(vst.facing + Math.PI / 2) * 2.5
          const ez    = vst.pos.z + Math.sin(vst.facing + Math.PI / 2) * 2.5
          charPos.current.set(ex, 0, ez)
          charFacing.current = vst.facing
          if (playerGroupRef.current) playerGroupRef.current.visible = true
          pv.x = vst.pos.x; pv.z = vst.pos.z; pv.facing = vst.facing; pv.driverId = null
          activeParkedIdx.current = null
          parkedDriveState.current = null
          setInVehicle(false)
          setDrivingParked(null)
          onDrivingChange(null)
          onNearVehicle(null)
          onSpeedChange(0)
          audioSystem.stopEngine()
          audioSystem.playEnter()
          notifyParkedVehicleChange()
          return
        }

        // ── 3. Try to enter a vehicle ─────────────────────────────────────
        const ENTER_R = 3.5
        const cDist = charPos.current.distanceTo(carState.current.pos)
        const bDist = charPos.current.distanceTo(bikeState.current.pos)

        if (cDist < ENTER_R && cDist <= bDist) {
          const carDriverId = vehicleState.car.driverId
          if (!carDriverId || carDriverId === myUserId) {
            // Enter as driver
            if (emoteRef.current) cancelEmote()
            vehicleState.car.driverId     = myUserId
            vehicleState.car.driverName   = avatar.name
            vehicleState.car.driverOutfit = avatar.outfit
            vehicleState.car.driverSkin   = avatar.skin
            activeVeh.current = 'car'
            camYaw.current    = carState.current.facing + Math.PI
            if (playerGroupRef.current) playerGroupRef.current.visible = false
            setInVehicle(true)
            onDrivingChange('car')
            onNearVehicle(null)
            audioSystem.startEngine('car')
            audioSystem.playEnter()
          } else if (!vehicleState.car.passengerId) {
            // Enter as passenger
            if (emoteRef.current) cancelEmote()
            vehicleState.car.passengerId     = myUserId
            vehicleState.car.passengerName   = avatar.name
            vehicleState.car.passengerOutfit = avatar.outfit
            vehicleState.car.passengerSkin   = avatar.skin
            passengerVeh.current = 'car'
            minimapState.passengerOf = 'car'
            setIsPassenger(true)
            onPassengerChange?.(true)
            window.dispatchEvent(new CustomEvent('passenger-join', { detail: {
              vType: 'car', passengerId: myUserId,
              passengerName: avatar.name, passengerOutfit: avatar.outfit, passengerSkin: avatar.skin,
            }}))
            audioSystem.playEnter()
          }
          return
        }

        if (bDist < ENTER_R) {
          const bikeDriverId = vehicleState.bike.driverId
          if (!bikeDriverId || bikeDriverId === myUserId) {
            if (emoteRef.current) cancelEmote()
            vehicleState.bike.driverId     = myUserId
            vehicleState.bike.driverName   = avatar.name
            vehicleState.bike.driverOutfit = avatar.outfit
            vehicleState.bike.driverSkin   = avatar.skin
            activeVeh.current = 'bike'
            camYaw.current    = bikeState.current.facing + Math.PI
            vehLean.current   = 0
            if (playerGroupRef.current) playerGroupRef.current.visible = false
            setInVehicle(true)
            onDrivingChange('bike')
            onNearVehicle(null)
            audioSystem.startEngine('bike')
            audioSystem.playEnter()
          } else if (!vehicleState.bike.passengerId) {
            if (emoteRef.current) cancelEmote()
            vehicleState.bike.passengerId     = myUserId
            vehicleState.bike.passengerName   = avatar.name
            vehicleState.bike.passengerOutfit = avatar.outfit
            vehicleState.bike.passengerSkin   = avatar.skin
            passengerVeh.current = 'bike'
            minimapState.passengerOf = 'bike'
            setIsPassenger(true)
            onPassengerChange?.(true)
            window.dispatchEvent(new CustomEvent('passenger-join', { detail: {
              vType: 'bike', passengerId: myUserId,
              passengerName: avatar.name, passengerOutfit: avatar.outfit, passengerSkin: avatar.skin,
            }}))
            audioSystem.playEnter()
          }
          return
        }

        // ── 4. Try to enter a parked vehicle ─────────────────────────────
        {
          let bestDist = ENTER_R, bestIdx = -1
          for (let vi = 0; vi < parkedVehicles.length; vi++) {
            const pv = parkedVehicles[vi]
            if (pv.driverId !== null && pv.driverId !== myUserId) continue
            const d = Math.hypot(charPos.current.x - pv.x, charPos.current.z - pv.z)
            if (d < bestDist) { bestDist = d; bestIdx = vi }
          }
          if (bestIdx >= 0) {
            const pv = parkedVehicles[bestIdx]
            if (emoteRef.current) cancelEmote()
            pv.driverId = myUserId
            activeParkedIdx.current = bestIdx
            parkedDriveState.current = {
              pos:    new THREE.Vector3(pv.x, 0, pv.z),
              facing: pv.facing,
              speed:  0,
            }
            camYaw.current = pv.facing + Math.PI
            vehLean.current = 0
            if (playerGroupRef.current) playerGroupRef.current.visible = false
            setInVehicle(true)
            setDrivingParked({ type: pv.type, color: pv.color })
            onDrivingChange(pv.type)
            onNearVehicle(null)
            onNearParkedVehicle?.(null)
            audioSystem.startEngine(pv.type)
            audioSystem.playEnter()
            notifyParkedVehicleChange()
            return
          }
        }

        if (nearBldRef.current) onEnterBuilding?.(nearBldRef.current.id)
      }
    }
    const onKeyUp = (e) => keys.current.delete(e.code)

    const onPointerDown = (e) => {
      audioSystem.unlock()
      if (e.button === 0 && mouse.current.pointerId === -1) {
        mouse.current.down      = true
        mouse.current.lastX     = e.clientX
        mouse.current.lastY     = e.clientY
        mouse.current.pointerId = e.pointerId
      }
    }
    const onPointerMove = (e) => {
      if (!mouse.current.down || e.pointerId !== mouse.current.pointerId) return
      const dx = e.clientX - mouse.current.lastX
      const dy = e.clientY - mouse.current.lastY
      mouse.current.lastX = e.clientX; mouse.current.lastY = e.clientY
      camYaw.current  -= dx * 0.005
      camPitch.current = THREE.MathUtils.clamp(camPitch.current + dy * 0.004, 0.1, 1.25)
      lastMouseTime.current = Date.now()
    }
    const onPointerUp = (e) => {
      if (e.pointerId === mouse.current.pointerId) { mouse.current.down = false; mouse.current.pointerId = -1 }
    }
    const onWheel = (e) => {
      camDist.current = THREE.MathUtils.clamp(camDist.current + e.deltaY * 0.025, 3, 45)
    }

    window.addEventListener('keydown',     onKeyDown)
    window.addEventListener('keyup',       onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
    el.addEventListener('wheel',           onWheel, { passive: true })

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinch.current = Math.sqrt(dx * dx + dy * dy); pinchActive.current = true
        mouse.current.down = false; mouse.current.pointerId = -1
      }
    }
    const onTouchMove = (e) => {
      if (!pinchActive.current || e.touches.length !== 2) return
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      camDist.current = THREE.MathUtils.clamp(camDist.current + (lastPinch.current - dist) * 0.05, 3, 45)
      lastPinch.current = dist
    }
    const onTouchEnd = () => { pinchActive.current = false }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd)

    // ── Emote DOM events ──────────────────────────────────────────────────
    const onEmoteTrigger = ({ detail }) => {
      if (!detail?.emote) return
      if (activeVeh.current || passengerVeh.current || activeParkedIdx.current !== null) return
      if (detail.emote === 'handshake') {
        // Check for nearby real player and optionally face them
        const myX = charPos.current.x
        const myZ = charPos.current.z
        let nearestUid = null
        let nearestDist = 3.1
        for (const [uid, data] of remotePlayersRef.current) {
          if (!data || data.is_in_vehicle) continue
          const dx = data.x - myX
          const dz = data.z - myZ
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < nearestDist) { nearestDist = dist; nearestUid = uid }
        }
        if (nearestUid) {
          const data = remotePlayersRef.current.get(nearestUid)
          charFacing.current = Math.atan2(data.x - myX, data.z - myZ)
          window.dispatchEvent(new CustomEvent('handshake-trigger', { detail: { targetUid: nearestUid } }))
        }
      }
      if (!emoteRef.current) triggerEmote(detail.emote)
    }

    const onHandshakeReceived = ({ detail }) => {
      if (activeVeh.current || passengerVeh.current || activeParkedIdx.current !== null) return
      if (detail?.initiatorUid) {
        const data = remotePlayersRef.current.get(detail.initiatorUid)
        if (data) {
          charFacing.current = Math.atan2(data.x - charPos.current.x, data.z - charPos.current.z)
        }
      }
      if (!emoteRef.current) triggerEmote('handshake')
    }

    window.addEventListener('emote-trigger',      onEmoteTrigger)
    window.addEventListener('handshake-received', onHandshakeReceived)

    return () => {
      window.removeEventListener('keydown',           onKeyDown)
      window.removeEventListener('keyup',             onKeyUp)
      window.removeEventListener('pointerdown',       onPointerDown)
      window.removeEventListener('pointermove',       onPointerMove)
      window.removeEventListener('pointerup',         onPointerUp)
      el.removeEventListener('wheel',                 onWheel)
      window.removeEventListener('touchstart',        onTouchStart)
      window.removeEventListener('touchmove',         onTouchMove)
      window.removeEventListener('touchend',          onTouchEnd)
      window.removeEventListener('emote-trigger',     onEmoteTrigger)
      window.removeEventListener('handshake-received',onHandshakeReceived)
    }
  }, [gl, myUserId, avatar])

  const _move = useRef(new THREE.Vector3())

  useFrame((_, rawDelta) => {
    const delta  = Math.min(rawDelta, 0.05)
    const BOUNDS = 500

    // ══════════════════════════════════════════════════════════════════════
    // VEHICLE MODE (I am the driver)
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

      if (fwd) {
        vst.speed = Math.min(vst.speed + cfg.accel * delta, maxSpd)
      } else if (bwd) {
        if (vst.speed > 0.15) {
          vst.speed = Math.max(vst.speed - cfg.brake * delta, 0)
          if (vst.speed > 4) audioSystem.playBrake()
        } else {
          vst.speed = Math.max(vst.speed - cfg.accel * 0.5 * delta, -cfg.maxReverse)
        }
      } else {
        const fric = cfg.friction * delta
        vst.speed = Math.abs(vst.speed) < fric ? 0 : vst.speed - Math.sign(vst.speed) * fric
      }

      const absSpd = Math.abs(vst.speed)
      if (absSpd > 0.08) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        vst.facing += steer * cfg.turnSpeed * speedFrac * delta * (vst.speed >= 0 ? 1 : -1)
      }

      vst.pos.x += Math.sin(vst.facing) * vst.speed * delta
      vst.pos.z += Math.cos(vst.facing) * vst.speed * delta

      const [vx, vz] = resolveCollisions(vst.pos.x, vst.pos.z, cfg.collRadius)
      if (Math.abs(vx - vst.pos.x) > 0.002 || Math.abs(vz - vst.pos.z) > 0.002) vst.speed *= 0.05
      vst.pos.x = THREE.MathUtils.clamp(vx, -BOUNDS, BOUNDS)
      vst.pos.z = THREE.MathUtils.clamp(vz, -BOUNDS, BOUNDS)

      if (vGroup) { vGroup.position.set(vst.pos.x, 0, vst.pos.z); vGroup.rotation.y = vst.facing }

      // Pin player character to vehicle seat every frame
      if (playerGroupRef.current) {
        const cos = Math.cos(vst.facing), sin = Math.sin(vst.facing)
        if (isCar) {
          playerGroupRef.current.position.set(
            vst.pos.x + sin * 0.1,
            -0.1,
            vst.pos.z + cos * 0.1
          )
        } else {
          playerGroupRef.current.position.set(vst.pos.x, 0.2, vst.pos.z)
        }
        playerGroupRef.current.rotation.y = vst.facing
        playerGroupRef.current.visible = true
      }

      const spin = (vst.speed * delta) / cfg.wheelRadius
      for (let i = 0; i < wRefs.length; i++) { if (wRefs[i]) wRefs[i].rotation.x -= spin }

      if (!isCar && bikeLeanRef.current) {
        const steer = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        const target = -steer * cfg.leanAngle * speedFrac
        vehLean.current += (target - vehLean.current) * Math.min(1, delta * 6)
        bikeLeanRef.current.rotation.z = vehLean.current
      }

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

      // Write vehicle state for multiplayer broadcast
      const vType = activeVeh.current
      vehicleState[vType].x      = vst.pos.x
      vehicleState[vType].z      = vst.pos.z
      vehicleState[vType].facing = vst.facing
      vehicleState[vType].speed  = vst.speed

      // Camera lazily drifts behind vehicle
      const vehMouseIdle = !mouse.current.down && (Date.now() - lastMouseTime.current) > 2000
      if (vehMouseIdle && absSpd > 0.3) {
        const targetYaw = vst.facing + Math.PI
        let diff = targetYaw - camYaw.current
        while (diff >  Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        if (Math.abs(diff) > 0.524) camYaw.current += diff * Math.min(1, delta * 2)
      }

      const px = vst.pos.x, pz = vst.pos.z
      const d  = camDist.current, p = camPitch.current, y = camYaw.current
      camera.position.set(px + d * Math.sin(y) * Math.cos(p), d * Math.sin(p), pz + d * Math.cos(y) * Math.cos(p))
      camera.lookAt(px, 0.9, pz)

      charPos.current.copy(vst.pos)
      minimapState.playerX      = vst.pos.x
      minimapState.playerZ      = vst.pos.z
      minimapState.playerFacing = vst.facing
      minimapState.drivingType  = activeVeh.current
      minimapState.passengerOf  = null
      minimapState.isMoving     = absSpd > 0.3
      minimapState.currentEmote = ''

      audioSystem.updateEngine(vst.speed, cfg.maxSpeed)

      speedThrottle.current += delta
      if (speedThrottle.current > 0.08) {
        speedThrottle.current = 0
        const kmh = absSpd * 3.6
        if (Math.abs(kmh - speedKmhRef.current) > 0.5) { speedKmhRef.current = kmh; onSpeedChange(kmh) }
      }
      return
    }

    // ══════════════════════════════════════════════════════════════════════
    // PARKED VEHICLE MODE (driving a city parked vehicle)
    // ══════════════════════════════════════════════════════════════════════
    if (activeParkedIdx.current !== null && parkedDriveState.current) {
      const pvIdx  = activeParkedIdx.current
      const pv     = parkedVehicles[pvIdx]
      const isCar  = pv.type === 'car'
      const vst    = parkedDriveState.current
      const cfg    = isCar ? CAR_CFG : BIKE_CFG
      const vGroup = parkedGroupRef.current
      const wRefs  = parkedWheels.current

      const fwd    = keys.current.has('KeyW') || keys.current.has('ArrowUp')
      const bwd    = keys.current.has('KeyS') || keys.current.has('ArrowDown')
      const left   = keys.current.has('KeyA') || keys.current.has('ArrowLeft')
      const right  = keys.current.has('KeyD') || keys.current.has('ArrowRight')
      const boost  = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
      const maxSpd = cfg.maxSpeed * (boost ? cfg.boostMult : 1)

      if (fwd) {
        vst.speed = Math.min(vst.speed + cfg.accel * delta, maxSpd)
      } else if (bwd) {
        if (vst.speed > 0.15) {
          vst.speed = Math.max(vst.speed - cfg.brake * delta, 0)
          if (vst.speed > 4) audioSystem.playBrake()
        } else {
          vst.speed = Math.max(vst.speed - cfg.accel * 0.5 * delta, -cfg.maxReverse)
        }
      } else {
        const fric = cfg.friction * delta
        vst.speed = Math.abs(vst.speed) < fric ? 0 : vst.speed - Math.sign(vst.speed) * fric
      }

      const absSpd = Math.abs(vst.speed)
      if (absSpd > 0.08) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        vst.facing += steer * cfg.turnSpeed * speedFrac * delta * (vst.speed >= 0 ? 1 : -1)
      }

      vst.pos.x += Math.sin(vst.facing) * vst.speed * delta
      vst.pos.z += Math.cos(vst.facing) * vst.speed * delta

      const [vx, vz] = resolveCollisions(vst.pos.x, vst.pos.z, cfg.collRadius)
      if (Math.abs(vx - vst.pos.x) > 0.002 || Math.abs(vz - vst.pos.z) > 0.002) vst.speed *= 0.05
      const BOUNDS = 500
      vst.pos.x = THREE.MathUtils.clamp(vx, -BOUNDS, BOUNDS)
      vst.pos.z = THREE.MathUtils.clamp(vz, -BOUNDS, BOUNDS)

      if (vGroup) { vGroup.position.set(vst.pos.x, 0, vst.pos.z); vGroup.rotation.y = vst.facing }

      // Pin player character to vehicle seat every frame
      if (playerGroupRef.current) {
        const cos = Math.cos(vst.facing), sin = Math.sin(vst.facing)
        if (isCar) {
          playerGroupRef.current.position.set(
            vst.pos.x + sin * 0.1,
            -0.1,
            vst.pos.z + cos * 0.1
          )
        } else {
          playerGroupRef.current.position.set(vst.pos.x, 0.2, vst.pos.z)
        }
        playerGroupRef.current.rotation.y = vst.facing
        playerGroupRef.current.visible = true
      }

      const spin = (vst.speed * delta) / cfg.wheelRadius
      for (let i = 0; i < wRefs.length; i++) { if (wRefs[i]) wRefs[i].rotation.x -= spin }

      if (!isCar && parkedLean.current) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        const target    = -steer * cfg.leanAngle * speedFrac
        vehLean.current += (target - vehLean.current) * Math.min(1, delta * 6)
        parkedLean.current.rotation.z = vehLean.current
      }

      const dustOpacity = (fwd && absSpd > 2) ? Math.min(0.6, absSpd * 0.04) : 0
      if (isCar) {
        for (let i = 0; i < parkedDusts.current.length; i++) {
          const dm = parkedDusts.current[i]
          if (dm) {
            dm.material.opacity = dustOpacity > 0
              ? dustOpacity * (0.7 + Math.random() * 0.3)
              : dm.material.opacity * 0.8
            if (dustOpacity > 0) dm.scale.setScalar(0.8 + absSpd * 0.04)
          }
        }
      } else if (parkedBDust.current) {
        const dm = parkedBDust.current
        dm.material.opacity = dustOpacity > 0
          ? dustOpacity * (0.7 + Math.random() * 0.3)
          : dm.material.opacity * 0.8
      }

      // Keep parked vehicle's position current for exit persistence
      pv.x = vst.pos.x; pv.z = vst.pos.z; pv.facing = vst.facing

      // Camera drifts behind
      const pvMouseIdle = !mouse.current.down && (Date.now() - lastMouseTime.current) > 2000
      if (pvMouseIdle && absSpd > 0.3) {
        const targetYaw = vst.facing + Math.PI
        let diff = targetYaw - camYaw.current
        while (diff >  Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        if (Math.abs(diff) > 0.524) camYaw.current += diff * Math.min(1, delta * 2)
      }

      const pvx = vst.pos.x, pvz = vst.pos.z
      const pvd = camDist.current, pvp = camPitch.current, pvy = camYaw.current
      camera.position.set(pvx + pvd * Math.sin(pvy) * Math.cos(pvp), pvd * Math.sin(pvp), pvz + pvd * Math.cos(pvy) * Math.cos(pvp))
      camera.lookAt(pvx, 0.9, pvz)

      charPos.current.copy(vst.pos)
      minimapState.playerX      = vst.pos.x
      minimapState.playerZ      = vst.pos.z
      minimapState.playerFacing = vst.facing
      minimapState.drivingType  = pv.type
      minimapState.passengerOf  = null
      minimapState.isMoving     = absSpd > 0.3
      minimapState.currentEmote = ''

      audioSystem.updateEngine(vst.speed, cfg.maxSpeed)

      speedThrottle.current += delta
      if (speedThrottle.current > 0.08) {
        speedThrottle.current = 0
        const kmh = absSpd * 3.6
        if (Math.abs(kmh - speedKmhRef.current) > 0.5) { speedKmhRef.current = kmh; onSpeedChange(kmh) }
      }
      return
    }

    // ══════════════════════════════════════════════════════════════════════
    // PASSENGER MODE (I am a passenger in someone else's vehicle)
    // ══════════════════════════════════════════════════════════════════════
    if (passengerVeh.current) {
      const vs     = vehicleState[passengerVeh.current]
      // Sit at the right-side seat (car) or rear seat (bike)
      const seatX  = passengerVeh.current === 'car' ? 0.5 : 0
      const seatZ  = passengerVeh.current === 'car' ? 0.18 : -0.45
      const cos = Math.cos(vs.facing), sin = Math.sin(vs.facing)
      const wx  = vs.x + cos * seatX - sin * seatZ
      const wz  = vs.z + sin * seatX + cos * seatZ
      charPos.current.set(wx, 0, wz)
      charFacing.current = vs.facing
      if (playerGroupRef.current) {
        playerGroupRef.current.position.set(wx, 0, wz)
        playerGroupRef.current.rotation.y = vs.facing
        playerGroupRef.current.visible    = false  // hidden — inside vehicle
      }
      minimapState.playerX      = wx
      minimapState.playerZ      = wz
      minimapState.playerFacing = vs.facing
      minimapState.drivingType  = null
      minimapState.passengerOf  = passengerVeh.current
      minimapState.isMoving     = false
      minimapState.currentEmote = ''

      // Camera follows vehicle, lazily drifts behind when idle
      const vehMouseIdle = !mouse.current.down && (Date.now() - lastMouseTime.current) > 2000
      if (vehMouseIdle) {
        const targetYaw = vs.facing + Math.PI
        let diff = targetYaw - camYaw.current
        while (diff >  Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        if (Math.abs(diff) > 0.524) camYaw.current += diff * Math.min(1, delta * 2)
      }
      const px = vs.x, pz = vs.z
      const d  = camDist.current, p = camPitch.current
      camera.position.set(px + d * Math.sin(camYaw.current) * Math.cos(p), d * Math.sin(p), pz + d * Math.cos(camYaw.current) * Math.cos(p))
      camera.lookAt(px, 0.9, pz)
      return
    }

    // ══════════════════════════════════════════════════════════════════════
    // WALKING MODE
    // ══════════════════════════════════════════════════════════════════════
    minimapState.drivingType = null
    minimapState.passengerOf = null

    // Apply fast-travel teleport if requested
    if (teleportRequest.pending) {
      charPos.current.set(teleportRequest.x, 0, teleportRequest.z)
      teleportRequest.pending = false
    }

    // Sync parked vehicle groups from vehicleState (handles remote driver parking)
    const carOccupied = vehicleState.car.driverId !== null && vehicleState.car.driverId !== myUserId
    if (carGroupRef.current) {
      carGroupRef.current.visible = !carOccupied
      if (!carOccupied) {
        carGroupRef.current.position.set(vehicleState.car.x, 0, vehicleState.car.z)
        carGroupRef.current.rotation.y = vehicleState.car.facing
        carState.current.pos.set(vehicleState.car.x, 0, vehicleState.car.z)
        carState.current.facing = vehicleState.car.facing
      }
    }
    const bikeOccupied = vehicleState.bike.driverId !== null && vehicleState.bike.driverId !== myUserId
    if (bikeGroupRef.current) {
      bikeGroupRef.current.visible = !bikeOccupied
      if (!bikeOccupied) {
        bikeGroupRef.current.position.set(vehicleState.bike.x, 0, vehicleState.bike.z)
        bikeGroupRef.current.rotation.y = vehicleState.bike.facing
        bikeState.current.pos.set(vehicleState.bike.x, 0, vehicleState.bike.z)
        bikeState.current.facing = vehicleState.bike.facing
      }
    }

    minimapState.currentEmote = emoteRef.current
    if (emoteRef.current) {
      // WASD cancels dance (looping emote); other emotes play through naturally
      if (emoteRef.current === 'dance') {
        const anyMove = keys.current.has('KeyW') || keys.current.has('KeyA') ||
                        keys.current.has('KeyS') || keys.current.has('KeyD') ||
                        keys.current.has('ArrowUp') || keys.current.has('ArrowDown') ||
                        keys.current.has('ArrowLeft') || keys.current.has('ArrowRight')
        if (anyMove || mobileInput.forward || mobileInput.backward || mobileInput.left || mobileInput.right) {
          cancelEmote()
          // Fall through to walking
        }
      }
      if (emoteRef.current) {
        minimapState.playerX      = charPos.current.x
        minimapState.playerZ      = charPos.current.z
        minimapState.playerFacing = charFacing.current
        minimapState.isMoving     = false
        if (playerGroupRef.current) {
          playerGroupRef.current.position.set(charPos.current.x, 0, charPos.current.z)
          playerGroupRef.current.rotation.y = charFacing.current
          playerGroupRef.current.visible    = true
        }
        const px = charPos.current.x, pz = charPos.current.z
        const d  = camDist.current, p = camPitch.current, y = camYaw.current
        camera.position.set(px + d * Math.sin(y) * Math.cos(p), d * Math.sin(p), pz + d * Math.cos(y) * Math.cos(p))
        camera.lookAt(px, 0.9, pz)
        return
      }
    }

    const SPEED = 8
    let moving = false, moveSpeed = 1
    _move.current.set(0, 0, 0)
    const sy = Math.sin(camYaw.current), cy = Math.cos(camYaw.current)
    const boost = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')

    if (gameControls.enabled) {
      if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { _move.current.x -= sy; _move.current.z -= cy; moving = true }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { _move.current.x += sy; _move.current.z += cy; moving = true }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { _move.current.x -= cy; _move.current.z += sy; moving = true }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { _move.current.x += cy; _move.current.z -= sy; moving = true }
    }

    if (mobileInput.joyActive) {
      const jx = mobileInput.joyX, jy = mobileInput.joyY
      const mag = Math.sqrt(jx * jx + jy * jy)
      if (mag > 0.1) {
        _move.current.x += (-jy) * (-sy) + jx * cy
        _move.current.z += (-jy) * (-cy) + jx * (-sy)
        moveSpeed = mag; moving = true
      }
    }

    const isRunNow = moving && boost
    if (moving) {
      _move.current.normalize()
      const step = SPEED * moveSpeed * (isRunNow ? 1.6 : 1) * delta
      charFacing.current = Math.atan2(_move.current.x, _move.current.z)
      const ox = charPos.current.x, oz = charPos.current.z
      const [rx] = resolveCollisions(ox + _move.current.x * step, oz)
      charPos.current.x = THREE.MathUtils.clamp(rx, -BOUNDS, BOUNDS)
      const [, rz] = resolveCollisions(charPos.current.x, oz + _move.current.z * step)
      charPos.current.z = THREE.MathUtils.clamp(rz, -BOUNDS, BOUNDS)
    } else {
      const [cx, cz] = resolveCollisions(charPos.current.x, charPos.current.z)
      charPos.current.x = THREE.MathUtils.clamp(cx, -BOUNDS, BOUNDS)
      charPos.current.z = THREE.MathUtils.clamp(cz, -BOUNDS, BOUNDS)
    }
    charPos.current.y = 0
    minimapState.playerX     = charPos.current.x
    minimapState.playerZ     = charPos.current.z
    minimapState.playerFacing = charFacing.current
    minimapState.isMoving    = moving

    if (moving) audioSystem.playFootstep(isOnRoad(charPos.current.x, charPos.current.z))
    if (moving    !== isWalkingRef.current) { isWalkingRef.current = moving;    setIsWalking(moving) }
    if (isRunNow  !== isRunningRef.current) { isRunningRef.current = isRunNow;  setIsRunning(isRunNow) }

    // Update spatial audio position every frame
    audioSystem.updateLocation(charPos.current.x, charPos.current.z, false)

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(charPos.current.x, 0, charPos.current.z)
      playerGroupRef.current.rotation.y = charFacing.current
      playerGroupRef.current.visible    = true
    }

    const walkMouseIdle = !mouse.current.down && (Date.now() - lastMouseTime.current) > 2000
    if (moving && walkMouseIdle) {
      const targetYaw = charFacing.current + Math.PI
      let diff = targetYaw - camYaw.current
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      if (Math.abs(diff) > 0.611) camYaw.current += diff * Math.min(1, delta * 1.5)
    }

    const px = charPos.current.x, pz = charPos.current.z
    const d  = camDist.current, p = camPitch.current, y = camYaw.current
    minimapState.camYaw = y

    // ── Near-wall camera compression ─────────────────────────────────────
    // When player is within 4 units of a box collider wall, pull camera in
    let wallPush = 0
    for (const c of BOX_COLLIDERS) {
      const ox = Math.max(0, Math.abs(px - c.x) - c.hw)
      const oz = Math.max(0, Math.abs(pz - c.z) - c.hd)
      const wallDist = Math.sqrt(ox * ox + oz * oz)
      if (wallDist < 4) { wallPush = Math.max(wallPush, 1 - wallDist / 4); break }
    }
    const effectiveDist = Math.max(2, d * (1 - wallPush * 0.65))

    camera.position.set(px + effectiveDist * Math.sin(y) * Math.cos(p), effectiveDist * Math.sin(p), pz + effectiveDist * Math.cos(y) * Math.cos(p))
    camera.lookAt(px, 0.9, pz)

    // ── Building occlusion transparency ──────────────────────────────────
    // Restore all previously faded materials first
    occludedMaterials.current.forEach(mat => {
      mat.transparent = mat._wasTransparent || false
      mat.opacity     = mat._origOpacity    ?? 1
    })
    occludedMaterials.current.clear()

    // Ray from camera toward player
    const playerWorldPos = new THREE.Vector3(px, 0.9, pz)
    const camToPlayer    = playerWorldPos.clone().sub(camera.position)
    const camDist2       = camToPlayer.length()
    occlusionRay.current.set(camera.position, camToPlayer.normalize())
    occlusionRay.current.far = camDist2 - 0.5

    const hits = occlusionRay.current.intersectObjects(scene.children, true)
    for (const hit of hits) {
      const mat = hit.object.material
      if (!mat || hit.object === playerGroupRef.current) continue
      // Only fade building-like meshes (boxes with significant size)
      const geom = hit.object.geometry
      if (!geom?.boundingBox) geom?.computeBoundingBox()
      const size = geom?.boundingBox ? new THREE.Vector3() : null
      if (size) geom.boundingBox.getSize(size)
      if (!size || (size.x < 1 && size.z < 1)) continue  // skip tiny meshes

      if (Array.isArray(mat)) {
        mat.forEach(m => {
          if (!occludedMaterials.current.has(m)) {
            m._origOpacity = m.opacity; m._wasTransparent = m.transparent
            m.transparent = true; m.opacity = 0.28
            occludedMaterials.current.add(m)
          }
        })
      } else if (!occludedMaterials.current.has(mat)) {
        mat._origOpacity = mat.opacity; mat._wasTransparent = mat.transparent
        mat.transparent = true; mat.opacity = 0.28
        occludedMaterials.current.add(mat)
      }
    }

    if (charPos.current.distanceTo(lastSentPos.current) > 0.5) {
      lastSentPos.current.copy(charPos.current)
      setPlayerPos([charPos.current.x, 0, charPos.current.z])
    }

    // Near-vehicle + building detection (throttled every 200 ms)
    vehDetectTick.current += delta
    if (vehDetectTick.current > 0.2) {
      vehDetectTick.current = 0
      const cDist = charPos.current.distanceTo(carState.current.pos)
      const bDist = charPos.current.distanceTo(bikeState.current.pos)
      const near  = cDist < 3.5 ? 'Car' : bDist < 3.5 ? 'Bike' : null
      if (near !== nearVehRef.current) { nearVehRef.current = near; onNearVehicle(near) }

      // Parked vehicle proximity
      let nearPV = null
      for (let vi = 0; vi < parkedVehicles.length; vi++) {
        const pv = parkedVehicles[vi]
        if (pv.driverId !== null && pv.driverId !== myUserId) continue
        const d = Math.hypot(charPos.current.x - pv.x, charPos.current.z - pv.z)
        if (d < 3.5 && (!nearPV || d < nearPV.dist)) nearPV = { idx: vi, dist: d, type: pv.type }
      }
      const nearPVid = nearPV?.idx ?? null
      if (nearPVid !== nearParkedRef.current) {
        nearParkedRef.current = nearPVid
        onNearParkedVehicle?.(nearPV)
      }

      let nearBld = null
      for (const p of PLACES) {
        if (!INTERIOR_IDS.has(p.id)) continue
        const dx = charPos.current.x - p.pos[0]
        const dz = charPos.current.z - p.pos[2]
        if (dx * dx + dz * dz < 30) { nearBld = p; break }
      }
      if (nearBld?.id !== nearBldRef.current?.id) { nearBldRef.current = nearBld; onNearBuilding?.(nearBld) }

      // Boss and orb proximity (used by F-key handler)
      const BOSS_POS_X = 3, BOSS_POS_Z = 3
      const ORB_POS_X  = 0, ORB_POS_Z  = 14
      minimapState.nearBoss = bossActiveFlag.value &&
        Math.hypot(charPos.current.x - BOSS_POS_X, charPos.current.z - BOSS_POS_Z) < 5
      minimapState.nearOrb  = orbActiveFlag.value  &&
        Math.hypot(charPos.current.x - ORB_POS_X,  charPos.current.z - ORB_POS_Z)  < 3

      // m1_4 coop check — complete when 2+ remote players within 8 units for 5 s
      if (getMissionStatus('m1_4') === 'active') {
        let nearbyCount = 0
        remotePlayersRef.current.forEach(p => {
          if (Math.hypot((p.x ?? 0) - charPos.current.x, (p.z ?? 0) - charPos.current.z) < 8) nearbyCount++
        })
        if (nearbyCount >= 2) {
          coopTimerRef.current += delta
          if (coopTimerRef.current >= 5) completeMission('m1_4')
        } else {
          coopTimerRef.current = 0
        }
      }

      // NPC ambient sounds — occasional very quiet sounds from nearby NPCs
      if (Math.random() < 0.01) {  // ~once per 3-4 seconds at 60fps throttled calls
        for (const entry of npcLivePositions) {
          const dx = entry.x - charPos.current.x
          const dz = entry.z - charPos.current.z
          if (dx * dx + dz * dz < 100) {  // within 10 units
            audioSystem.playNpcAmbient(entry.x, entry.z)
            break
          }
        }
      }
    }
  })

  return (
    <>
      {/* Player avatar — hidden while driving or in passenger seat */}
      <group ref={playerGroupRef} position={[0, 0, 6]}>
        <PlayerModel walking={isWalking} running={isRunning} sitting={inVehicle} name={avatar.name} outfit={avatar.outfit} skin={avatar.skin} emote={emote} onEmoteEnd={handleEmoteEnd} />
      </group>

      {/* Car — hidden when a remote player is driving it (handled in useFrame) */}
      <group ref={carGroupRef} position={[vehicleState.car.x, 0, vehicleState.car.z]}>
        <Car3D wheelRefs={carWheels} dustRefs={carDustRefs} />
        {!inVehicle && !isPassenger && (
          <Billboard position={[0, 2.2, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🚗 Car</Text>
          </Billboard>
        )}
      </group>

      {/* Bike — hidden when a remote player is driving it (handled in useFrame) */}
      <group ref={bikeGroupRef} position={[vehicleState.bike.x, 0, vehicleState.bike.z]}>
        <Bike3D wheelRefs={bikeWheels} leanRef={bikeLeanRef} dustRef={bikeDustRef} />
        {!inVehicle && !isPassenger && (
          <Billboard position={[0, 2.0, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🏍 Bike</Text>
          </Billboard>
        )}
      </group>

      {/* Parked vehicle being driven by local player */}
      {drivingParked && (
        <group ref={parkedGroupRef}>
          {drivingParked.type === 'car'
            ? <Car3D  bodyColor={drivingParked.color} wheelRefs={pvWheelRef.current} dustRefs={pvDustRef.current} />
            : <Bike3D frameColor={drivingParked.color} wheelRefs={pvWheelRef.current} leanRef={parkedLean} dustRef={parkedBDust} />
          }
        </group>
      )}
    </>
  )
}

// ── Places ────────────────────────────────────────────────────────────────────
const PLACES = [
  { id: 'cafe',        pos: [-10, 0, -6],  emoji: '☕', label: 'Cafe',         color: '#F59E0B' },
  { id: 'arcade',      pos: [10,  0, -6],  emoji: '🕹️', label: 'Arcade',       color: '#7C3AED' },
  { id: 'beach',       pos: [0,   0,-14],  emoji: '🏖️', label: 'Beach Club',   color: '#38BDF8' },
  { id: 'rooftop',     pos: [-14, 0,  4],  emoji: '🌙', label: 'Rooftop Bar',  color: '#6366F1' },
  { id: 'musicroom',   pos: [14,  0,  4],  emoji: '🎵', label: 'Music Room',   color: '#EC4899' },
  { id: 'park',        pos: [0,   0, 14],  emoji: '🌳', label: 'Park',         color: '#22C55E' },
  { id: 'cityhall',    pos: [0,   0,-22],  emoji: '🏛️', label: 'City Hall',    color: '#94a3b8' },
  { id: 'mall',        pos: [-16, 0,-28],  emoji: '🛍️', label: 'Shopping Mall',color: '#ec4899' },
  { id: 'cinema',      pos: [16,  0,-28],  emoji: '🎬', label: 'Cinema',       color: '#7c3aed' },
  { id: 'supermarket', pos: [-28, 0,-18],  emoji: '🛒', label: 'Supermarket',  color: '#16a34a' },
  { id: 'bank',        pos: [28,  0,-18],  emoji: '🏦', label: 'Bank',         color: '#b45309' },
  { id: 'hospital',    pos: [34,  0, -5],  emoji: '🏥', label: 'Hospital',     color: '#0ea5e9' },
  { id: 'police',      pos: [34,  0, 10],  emoji: '👮', label: 'Police Dept',  color: '#1d4ed8' },
  { id: 'firestation', pos: [34,  0, 22],  emoji: '🚒', label: 'Fire Station', color: '#dc2626' },
  { id: 'school',      pos: [-34, 0, -5],  emoji: '🏫', label: 'School',       color: '#f59e0b' },
  { id: 'library',     pos: [-34, 0,-20],  emoji: '📚', label: 'Library',      color: '#92400e' },
  { id: 'gym',         pos: [-34, 0, 10],  emoji: '💪', label: 'Gym',          color: '#7c3aed' },
  { id: 'restaurant',  pos: [12,  0, 28],  emoji: '🍕', label: 'Restaurant',   color: '#f97316' },
  { id: 'gasstation',  pos: [-12, 0, 28],  emoji: '⛽', label: 'Gas Station',  color: '#ef4444' },
  { id: 'church',      pos: [-25, 0, 18],  emoji: '⛪', label: 'Temple',       color: '#fbbf24' },
  { id: 'postoffice',  pos: [12,  0, 18],  emoji: '📮', label: 'Post Office',  color: '#dc2626' },
  { id: 'apartments',  pos: [-26, 0, 30],  emoji: '🏢', label: 'Apartments',   color: '#475569' },
  { id: 'playground',  pos: [0,   0, 38],  emoji: '🎠', label: 'Playground',   color: '#22c55e' },
  { id: 'house1',      pos: [26,  0, 29],  emoji: '🏠', label: 'Blue House',   color: '#3b82f6' },
  { id: 'house2',      pos: [36,  0, 29],  emoji: '🏠', label: 'Yellow House', color: '#eab308' },
  { id: 'gamearea',    pos: [22,  0,-10],  emoji: '🎮', label: 'Game Zone',    color: '#a78bfa' },
]

const NPCS = [
  { name: 'Anaya',  skin: '#D4956A', outfit: 'party',       color: '#F472B6', pos: [-8,  0,  2]  },
  { name: 'Rahul',  skin: '#C68642', outfit: 'casual',      color: '#60A5FA', pos: [8,   0,  2]  },
  { name: 'Zoya',   skin: '#F4C08A', outfit: 'school',      color: '#34D399', pos: [0,   0, -4]  },
  { name: 'Kabir',  skin: '#8D5524', outfit: 'sports',      color: '#FBBF24', pos: [-5,  0,  8]  },
  { name: 'Meera',  skin: '#FDDBB4', outfit: 'traditional', color: '#F87171', pos: [5,   0,  8]  },
  { name: 'Arjun',  skin: '#C68642', outfit: 'casual',      color: '#a78bfa', pos: [-18, 0,-26]  },
  { name: 'Priya',  skin: '#F4C08A', outfit: 'school',      color: '#86efac', pos: [18,  0,-26]  },
  { name: 'Dev',    skin: '#8D5524', outfit: 'sports',      color: '#fdba74', pos: [34,  0, 2]   },
  { name: 'Nisha',  skin: '#FDDBB4', outfit: 'party',       color: '#f9a8d4', pos: [-34, 0, 2]   },
  { name: 'Rohan',  skin: '#D4956A', outfit: 'winter',      color: '#67e8f9', pos: [12,  0, 30]  },
  { name: 'Sana',   skin: '#F4C08A', outfit: 'traditional', color: '#fcd34d', pos: [-12, 0, 30]  },
  { name: 'Vivek',  skin: '#C68642', outfit: 'casual',      color: '#6ee7b7', pos: [30,  0, 28]  },
]

// ── Parked vehicles — enterable; re-renders when any vehicle is entered/exited ─
function ParkedVehicles() {
  const [pvList, setPvList] = useState(() => [...parkedVehicles])
  useEffect(() => onParkedVehicleChange(() => setPvList([...parkedVehicles])), [])
  return (
    <>
      {pvList.map(v => {
        if (v.driverId !== null) return null  // hidden while driven
        return (
          <group key={v.id} position={[v.x, 0, v.z]} rotation={[0, v.facing, 0]}>
            {v.type === 'car'
              ? <Car3D bodyColor={v.color} />
              : <Bike3D frameColor={v.color} leanRef={null} dustRef={null} />
            }
          </group>
        )
      })}
    </>
  )
}

// ── World scene (memoized — never re-renders on WorldCanvas state changes) ────
const WorldScene = React.memo(function WorldScene({ onNPCChat, remotePlayerIds = [], onPlayerClick, onPlayerContextMenu, myUserId }) {
  return (
    <>
      <FpsTracker />
      <DayNightCycle />
      <WeatherSystem />
      <CityMap />
      <ProceduralWorld />
      <ParkedVehicles />
      <NPCTraffic />

      {PLACES.map(p => (
        <PlaceMarker key={p.id} position={p.pos} emoji={p.emoji} label={p.label} color={p.color} />
      ))}

      {NPCS.map(npc => (
        <NPC
          key={npc.name}
          startPos={npc.pos} skin={npc.skin} outfit={npc.outfit}
          name={npc.name} color={npc.color}
          onChat={() => onNPCChat(npc)}
        />
      ))}

      {/* Remote players */}
      {remotePlayerIds.map(uid => (
        <RemotePlayer key={uid} uid={uid} onPlayerClick={onPlayerClick} onPlayerContextMenu={onPlayerContextMenu} />
      ))}

      {/* Shared vehicles driven by remote players */}
      <RemoteVehicle vehicleId="car"  myUserId={myUserId} />
      <RemoteVehicle vehicleId="bike" myUserId={myUserId} />

      {/* Mission system — boss and orb */}
      <BossCharacter />
      <MissionOrb />

      {/* Game Zone arcade building + billboard */}
      <GameAreaScene />
    </>
  )
})

// ── Vehicle prompt helper ─────────────────────────────────────────────────────
function vehiclePrompt(veh, myUserId) {
  const vType = veh.toLowerCase()
  const vs    = vehicleState[vType]
  if (!vs) return `Press E to enter ${veh}`
  const hasRemoteDriver = vs.driverId && vs.driverId !== myUserId
  if (hasRemoteDriver && !vs.passengerId)  return `Press E to ride ${veh} as passenger (${vs.driverName || 'someone'} driving)`
  if (hasRemoteDriver && vs.passengerId)   return `${veh} is full`
  return `Press E to enter ${veh}`
}

// ── Loading overlay (shown while GLBs stream in via Suspense) ─────────────────
// Module-level flags survive React remounts (WorldCanvas unmounts on building enter/exit)
let _wlEverActive = false
let _wlDone       = false

function WorldLoadingOverlay() {
  const { progress, active } = useProgress()
  const timerRef      = useRef(null)
  // Initialise from module flags so a remounted component starts already-done
  const [opacity, setOpacity] = useState(_wlDone ? 0 : 1)
  const [removed, setRemoved] = useState(_wlDone)

  useEffect(() => {
    if (_wlDone) return
    if (active) {
      _wlEverActive = true
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      return
    }
    if (!_wlEverActive) return
    timerRef.current = setTimeout(() => {
      if (_wlDone) return
      _wlDone = true
      setOpacity(0)
      setTimeout(() => setRemoved(true), 1000)
    }, 500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active])

  if (removed) return null

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#080414',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 900, fontFamily: 'Nunito, sans-serif',
      pointerEvents: 'none',
      opacity,
      transition: 'opacity 1s ease',
    }}>
      <div style={{ color: '#a78bfa', fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
        Loading City...
      </div>
      <div style={{
        width: 280, height: 8,
        background: 'rgba(124,58,237,0.2)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg,#7c3aed,#ec4899)',
          borderRadius: 4,
          transition: 'width 0.18s',
        }} />
      </div>
      <div style={{ color: '#64748b', fontSize: 14, marginTop: 10 }}>
        {Math.round(progress)}%
      </div>
    </div>
  )
}

// ── Canvas wrapper ────────────────────────────────────────────────────────────
const DPR = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 ? [1, 1] : [1, 1.5]

export default function WorldCanvas({ onNPCChat, onEnterBuilding, remotePlayerIds = [], onPlayerClick, onPlayerContextMenu }) {
  const avatar  = useStore(s => s.avatar)
  const { user } = useUser()
  const myUserId = user?.id

  const [nearVeh,       setNearVeh]       = useState(null)
  const [drivingType,   setDrivingType]   = useState(null)
  const [isPassenger,   setIsPassenger]   = useState(false)
  const [speedKmh,      setSpeedKmh]      = useState(0)
  const [nearBuilding,  setNearBuilding]  = useState(null)
  const [nearParkedVeh, setNearParkedVeh] = useState(null)
  const [showFps,      setShowFps]      = useState(false)
  const [fpsDisplay,   setFpsDisplay]   = useState(0)

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'F3') { e.preventDefault(); setShowFps(s => !s) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!showFps) return
    const id = setInterval(() => setFpsDisplay(_fps.value), 500)
    return () => clearInterval(id)
  }, [showFps])

  return (
    <div className="canvas-wrap" onContextMenu={e => e.preventDefault()}>
      <WorldLoadingOverlay />
      <Canvas
        dpr={DPR}
        camera={{ position: [0, 10, 18], fov: 55, near: 0.1, far: 600 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <WorldScene
            onNPCChat={onNPCChat}
            remotePlayerIds={remotePlayerIds}
            onPlayerClick={onPlayerClick}
            onPlayerContextMenu={onPlayerContextMenu}
            myUserId={myUserId}
          />
          <PlayerController
            avatar={avatar}
            myUserId={myUserId}
            onNearVehicle={setNearVeh}
            onDrivingChange={setDrivingType}
            onSpeedChange={setSpeedKmh}
            onNearBuilding={setNearBuilding}
            onEnterBuilding={onEnterBuilding}
            onPassengerChange={setIsPassenger}
            onNearParkedVehicle={setNearParkedVeh}
          />
        </Suspense>
      </Canvas>

      {/* Building enter prompt */}
      {nearBuilding && !drivingType && !isPassenger && !nearVeh && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#a78bfa', padding: '8px 22px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #7c3aed',
        }}>
          Press <strong>E</strong> to enter {nearBuilding.label}
        </div>
      )}

      {/* Parked vehicle enter prompt */}
      {nearParkedVeh && !drivingType && !nearVeh && !isPassenger && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#facc15', padding: '8px 20px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #facc15',
        }}>
          Press <strong>E</strong> to enter parked {nearParkedVeh.type === 'car' ? '🚗 Car' : '🏍 Bike'}
        </div>
      )}

      {/* Vehicle enter / passenger prompt */}
      {nearVeh && !drivingType && !isPassenger && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#facc15', padding: '8px 20px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #facc15',
        }}>
          {vehiclePrompt(nearVeh, myUserId)}
        </div>
      )}

      {/* Driving HUD */}
      {drivingType && (
        <>
          <div style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '6px 16px',
            borderRadius: 8, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none',
          }}>
            <strong>E</strong> — Exit &nbsp;|&nbsp;
            <strong>W/S</strong> Accel/Brake &nbsp;|&nbsp;
            <strong>A/D</strong> Steer &nbsp;|&nbsp;
            <strong>Shift</strong> Boost
          </div>
          <Speedometer kmh={speedKmh} />
        </>
      )}

      {/* Passenger HUD */}
      {isPassenger && !drivingType && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: '#4ade80', padding: '6px 16px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none',
          border: '1px solid #4ade80',
        }}>
          👤 Passenger — Press <strong>E</strong> to exit
        </div>
      )}

      {/* Emote picker — hidden while driving or in passenger seat */}
      {!drivingType && !isPassenger && <EmotePicker />}

      {/* FPS counter */}
      {showFps && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(0,0,0,0.75)',
          color: fpsDisplay < 30 ? '#f87171' : fpsDisplay < 50 ? '#fbbf24' : '#4ade80',
          fontFamily: 'monospace', fontSize: 12, padding: '2px 8px',
          borderRadius: 4, pointerEvents: 'none', userSelect: 'none', zIndex: 200,
        }}>
          {fpsDisplay} FPS &nbsp;<span style={{ color: '#64748b' }}>F3</span>
        </div>
      )}
    </div>
  )
}
