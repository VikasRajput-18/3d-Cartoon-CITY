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
import { parkedVehicles, onParkedVehicleChange, notifyParkedVehicleChange, parkedVehicleMeshes } from '@/lib/parkedVehicleState'
import { navState } from '@/lib/navState'
import { isBlocked } from '@/lib/buildingColliders'
import { boxColliders, circleColliders, logAllColliders } from '@/lib/playerColliders'
import { timeWeatherState } from '@/lib/timeWeatherState'
import EmotePicker from '@/components/EmotePicker'
import BossCharacter from './BossCharacter'
import MissionOrb from './MissionOrb'
import GameAreaScene, { GAME_AREA_POS, GAME_AREA_ID } from './GameAreaBuilding'
import PlayerHouseMarker from './PlayerHouseMarker'
import ChunkTrees from './ChunkTrees'
import PostFX from './PostFX'
import { isMobileDevice, setBloom } from '@/lib/renderQuality'
import { getSpeedMultiplier } from '@/lib/liveEventState'
import { POOL, POOL_DIVE, nearPool } from '@/lib/locations'
import { groundHeightAt } from '@/lib/groundHeight'
import ToonStyle, { Clouds, SkyDome } from './ToonStyle'
import Companion3D from './Companion3D'
import ChallengeScene from './ChallengeScene'
import IntroCameraRig from './IntroCameraRig'
import { introState } from '@/lib/introState'
import LiveEvents from './LiveEvents'
import { bossActiveFlag } from '@/lib/bossState'
import { orbActiveFlag, getMissionStatus, completeMission } from '@/lib/missionState'
import { teleportRequest } from '@/lib/teleportState'
import { spendCoins, getEconomyState, addCoins } from '@/lib/economyState'
import { COSTS } from '@/lib/costs'
import { getHouseState } from '@/lib/houseService'

// Shared empty array for missing parked-vehicle wheel/dust refs (avoids per-frame alloc).
const EMPTY_REFS = []

// ── Fly-mode sparkle trail — 8 fading spheres trailing the player ─────────────
// Shared material born transparent (opacity never toggled at runtime).
const trailMat = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.65, depthWrite: false })
function FlyTrail() {
  const refs = useRef([])
  const pts  = useRef([])
  const acc  = useRef(0)
  useFrame((_, delta) => {
    acc.current += delta
    if (acc.current > 0.05) {
      acc.current = 0
      pts.current.unshift({ x: minimapState.playerX, y: (minimapState.playerY ?? 0) + 0.9, z: minimapState.playerZ })
      if (pts.current.length > 8) pts.current.pop()
    }
    refs.current.forEach((m, i) => {
      if (!m) return
      const p = pts.current[i]
      if (!p) { m.visible = false; return }
      m.visible = true
      m.position.set(p.x, p.y, p.z)
      m.scale.setScalar(Math.max(0.05, 0.22 * (1 - i / 9)))
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} material={trailMat} visible={false}>
          <sphereGeometry args={[1, 6, 5]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Collision system ──────────────────────────────────────────────────────────
const CHAR_R = 0.28
const NPC_R  = 0.32  // kept for reference; NPC-to-player collision is disabled

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
    for (let i = 0; i < boxColliders.length; i++) {
      const b  = boxColliders[i]
      const ex = b.hw + r, ez = b.hd + r
      const dx = x - b.x, dz = z - b.z
      if (Math.abs(dx) < ex && Math.abs(dz) < ez) {
        const px = ex - Math.abs(dx), pz = ez - Math.abs(dz)
        if (px < pz) x += px * (dx >= 0 ? 1 : -1)
        else         z += pz * (dz >= 0 ? 1 : -1)
      }
    }
    for (let i = 0; i < circleColliders.length; i++) {
      const c  = circleColliders[i]
      const dx = x - c.x, dz = z - c.z
      const d2 = dx * dx + dz * dz
      const min = c.r + r
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

// ── Floating building name labels (billboard, distance-faded) ────────────────
// Clear "🏥 Hospital" style tags above the major buildings so players can tell
// what's what. Only shown within range of the player; fades out far away.
const BUILDING_LABELS = [
  { id: 'arcade',    text: '🎮 Arcade Center',  y: 7.5 },
  { id: 'police',    text: '🚓 Police Station',  y: 7.0 },
  { id: 'cafe',      text: '☕ City Cafe',       y: 6.5 },
  { id: 'hospital',  text: '🏥 Hospital',        y: 10.0 },
  { id: 'cityhall',  text: '🏛️ City Hall',       y: 12.0 },
  { id: 'musicroom', text: '🎵 Music Room',      y: 7.5 },
  { id: 'park',      text: '🌳 City Park',       y: 6.0 },
  { id: 'mall',      text: '🛍️ Shopping Mall',   y: 9.0 },
  { id: 'beach',     text: '🌅 Sunset Shore',    y: 6.5 },
  { id: 'gamearea',  text: '🏆 Game Zone',       y: 7.5 },
  { id: 'bank',      text: '🏦 City Bank',       y: 7.5 },
  { id: 'school',    text: '🏫 School',          y: 9.0 },
  { id: 'gym',       text: '💪 Gym',             y: 7.0 },
]

function BuildingLabel({ pos, text }) {
  const grpRef = useRef()
  const bgRef  = useRef()
  const txtRef = useRef()
  const w = text.length * 0.26 + 0.7   // bg sized to the text
  useFrame(() => {
    const g = grpRef.current; if (!g) return
    const dx = pos[0] - minimapState.playerX, dz = pos[2] - minimapState.playerZ
    const d = Math.hypot(dx, dz)
    const op = d > 95 ? 0 : d < 60 ? 1 : 1 - (d - 60) / 35
    g.visible = op > 0.02
    if (!g.visible) return
    if (bgRef.current) bgRef.current.material.opacity = op * 0.7
    if (txtRef.current) { txtRef.current.fillOpacity = op; txtRef.current.outlineOpacity = op }
  })
  return (
    <group ref={grpRef} position={[pos[0], 0, pos[2]]} visible={false}>
      <Billboard position={[0, 0, 0]}>
        <group position={[0, 0, 0]}>
          <mesh ref={bgRef} position={[0, 0, -0.02]}>
            <planeGeometry args={[w, 0.95]} />
            <meshBasicMaterial color="#0a0a16" transparent opacity={0.7} depthWrite={false} />
          </mesh>
          <Text ref={txtRef} fontSize={0.46} color="#ffffff" anchorX="center" anchorY="middle"
            outlineWidth={0.02} outlineColor="#000000">
            {text}
          </Text>
        </group>
      </Billboard>
    </group>
  )
}

function BuildingLabels() {
  return (
    <>
      {BUILDING_LABELS.map(l => {
        const p = PLACES.find(pl => pl.id === l.id)
        if (!p) return null
        return <group key={l.id} position={[0, l.y, 0]}><BuildingLabel pos={p.pos} text={l.text} /></group>
      })}
    </>
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

// ── Scene exposer — puts scene/gl/camera on window for debugging ──────────────
function SceneExposer() {
  const { scene, gl, camera } = useThree()
  useEffect(() => {
    window.__threeScene = scene
    window.__threeGl = gl
    window.__threeCamera = camera
  }, [scene, gl, camera])
  return null
}

// ── City merger — merges STATIC opaque city geometry into one mesh per color ──
// Runs once 3s after mount (after CityMap has settled). Hardened beyond the spec:
//  • walks the full ancestor chain for dynamic/player/NPC/vehicle/noMerge flags
//  • skips transparent OR emissive materials — this protects the animated night
//    windows + lamp globes (DynamicLighting mutates them every frame) and the
//    opacity-fade procedural chunks. Merging those would freeze or ghost them.
//  • skips InstancedMesh (trees/lamps already 1 draw call) and any group flagged
//    userData.dynamic (streaming chunks dispose/reload — never merge them).
const MERGE_SKIP_NAMES = [
  'npc', 'player', 'vehicle', 'car', 'bike', 'character', 'remote', 'orb',
  'billboard', 'fountain', 'merged', 'traffic', 'tree', 'lamp', 'instanced', 'house',
]
function CityMerger() {
  const { scene } = useThree()
  const mergedRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (mergedRef.current) return
      mergedRef.current = true

      const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')

      // True if this object OR any ancestor is flagged dynamic / a known entity.
      function ancestorSkips(obj) {
        let o = obj
        while (o) {
          const ud = o.userData || {}
          if (ud.dynamic || ud.isPlayer || ud.isRemotePlayer || ud.isNPC || ud.isCompanion || ud.isVehicle || ud.noMerge) return true
          const nm = (o.name || '').toLowerCase()
          if (nm && MERGE_SKIP_NAMES.some(s => nm.includes(s))) return true
          o = o.parent
        }
        return false
      }

      function shouldSkip(child) {
        if (ancestorSkips(child)) return true
        if (child.isInstancedMesh) return true
        const mat = Array.isArray(child.material) ? child.material[0] : child.material
        if (!mat || !mat.color) return true
        // Animated/fading materials must keep their own mesh + material instance.
        if (mat.transparent) return true
        if (mat.emissive && (mat.emissive.r || mat.emissive.g || mat.emissive.b)) return true
        if (mat.map || mat.emissiveMap) return true   // textured (e.g. city-kit) — leave alone
        return false
      }

      const geosByColor = new Map()
      const toHide = []
      let skippedProtected = 0

      scene.traverse(child => {
        if (!child.isMesh || child.isInstancedMesh || !child.geometry || !child.material) return
        if (child.name?.startsWith('MergedCity')) return
        if (shouldSkip(child)) {
          // Diagnostic: confirm character/player meshes are being PROTECTED, not eaten.
          let o = child
          while (o) {
            const ud = o.userData || {}
            if (ud.isRemotePlayer || ud.isPlayer || ud.isCompanion) { skippedProtected++; break }
            o = o.parent
          }
          return
        }

        const mat = Array.isArray(child.material) ? child.material[0] : child.material
        const colorKey = mat.color.getHexString()
        if (!geosByColor.has(colorKey)) geosByColor.set(colorKey, { geos: [], mat: mat.clone() })

        try {
          child.updateWorldMatrix(true, false)
          const src = child.geometry
          const posAttr = src.attributes.position
          // Guard (Pattern 4): require a valid, finite position attribute. A geo
          // with no position — or any NaN/Infinity vertex — would poison the whole
          // merged geometry → "Triangles: Infinity". Reject those outright.
          if (!posAttr || !posAttr.array || posAttr.count === 0) return
          let bad = false
          const a = posAttr.array
          for (let i = 0; i < a.length; i++) { if (!Number.isFinite(a[i])) { bad = true; break } }
          if (bad) return

          // Build a NEW geometry carrying ONLY position (+ index). Mixing geos that
          // have different attribute sets (uv/normal/etc.) is the classic
          // mergeGeometries failure; position-only sidesteps it entirely. The
          // merged mesh renders flat opaque color, so no uv/normal is needed.
          const clean = new THREE.BufferGeometry()
          const geoT = src.clone(); geoT.applyMatrix4(child.matrixWorld)
          clean.setAttribute('position', geoT.attributes.position.clone())
          if (geoT.index) clean.setIndex(geoT.index.clone())
          geoT.dispose()
          clean.computeVertexNormals()
          geosByColor.get(colorKey).geos.push(clean)
          toHide.push(child)
        } catch (e) {}
      })

      let mergedCount = 0
      const totalOriginal = toHide.length

      geosByColor.forEach(({ geos: rawGeos, mat }, colorKey) => {
        // Pattern 4 guard: only merge geos with a valid position attribute.
        const geos = rawGeos.filter(g => g && g.attributes && g.attributes.position && g.attributes.position.count > 0)
        if (geos.length === 0) { rawGeos.forEach(g => g?.dispose()); return }
        try {
          const mergedGeo = mergeGeometries(geos, false)
          if (!mergedGeo) { geos.forEach(g => g.dispose()); return }
          // Validate the merged result — if anything went NaN, drop it rather
          // than add an Infinity-triangle mesh to the scene.
          mergedGeo.computeBoundingSphere()
          const bs = mergedGeo.boundingSphere
          if (!bs || !Number.isFinite(bs.radius)) { mergedGeo.dispose(); geos.forEach(g => g.dispose()); return }
          const mesh = new THREE.Mesh(mergedGeo, mat)
          mesh.name = 'MergedCity_' + colorKey
          mesh.userData.noMerge = true
          mesh.frustumCulled = true
          scene.add(mesh)
          geos.forEach(g => g.dispose())   // clones are copied into the merge — free them
          mergedCount++
        } catch (e) {
          geos.forEach(g => g.dispose())
          /* merge failed for this color group — skip silently */
        }
      })

      // Free the originals from GPU VRAM — hiding alone keeps them resident,
      // which is what pushed the GPU to "Context Lost". Their geometry is unique
      // per mesh (safe to dispose); materials may be shared (skip — Three frees
      // them when no mesh references them, and disposing a shared one breaks
      // other meshes). Remove from parent so they're fully unreferenced.
      toHide.forEach(child => {
        child.visible = false
        child.geometry?.dispose()
        if (child.parent) child.parent.remove(child)
      })
      void totalOriginal; void mergedCount   // (merge complete)
      console.log(`[CityMerger] merged ${mergedCount} batches from ${totalOriginal} meshes · protected ${skippedProtected} player/companion meshes (should be >0 if players are in view)`)
    }, 3000)

    return () => clearTimeout(timer)
  }, [scene])

  return null
}

// ── Perf logger — draw calls / triangles / geometries every 5 s ───────────────
// Open the browser console to read these. Use the numbers to guide deeper
// optimization (draw calls > 100 → merge geometry; triangles huge → reduce LOD).
function PerfLogger() {
  useFrame(() => {})
  return null
}

// ── NPC scale (stable, name-based hash) ──────────────────────────────────────
// Per-NPC size variation around 1.0 (Avatar3D is already player-sized; the old
// 0.009-range value was an FBX-only scale and would shrink NPCs to nothing).
function npcScaleFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return 0.92 + (h % 17) / 100   // ≈ 0.92 – 1.08
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
    const px  = minimapState.playerX
    const pz  = minimapState.playerZ
    const pdx = currentPos.current.x - px
    const pdz = currentPos.current.z - pz
    const myDistSq = pdx * pdx + pdz * pdz

    // CHANGE 1: cull beyond 12 units (was 18) → 144 = 12².
    // CHANGE 2: even within range, only the 3 CLOSEST NPCs animate. Count how
    // many other NPCs are both in-range AND closer than this one; if 3 or more
    // are closer, this NPC is culled (mixer stopped) even though it's near.
    const CULL_SQ = 144
    let nearPlayer = myDistSq < CULL_SQ
    if (nearPlayer) {
      let closerCount = 0
      for (let i = 0; i < npcLivePositions.length; i++) {
        const e = npcLivePositions[i]
        if (e === posEntry.current) continue
        const ex = e.x - px, ez = e.z - pz
        const dsq = ex * ex + ez * ez
        if (dsq < CULL_SQ && dsq < myDistSq) closerCount++
        if (closerCount >= 3) { nearPlayer = false; break }   // ranked 4th+ → cull
      }
    }
    // NPCModel handles its own fade-in/out via visibleRef; keep the group rendered
    // briefly while it fades out by not hard-hiding here until fade completes.
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
      const nx   = (dx / len) * step
      const nz   = (dz / len) * step
      // Building collision — try intended direction, then 5 random escape angles
      const tryX = currentPos.current.x + nx
      const tryZ = currentPos.current.z + nz
      if (!isBlocked(tryX, tryZ)) {
        currentPos.current.x = tryX
        currentPos.current.z = tryZ
      } else {
        let escaped = false
        for (let attempt = 0; attempt < 5; attempt++) {
          const ang = Math.random() * Math.PI * 2
          const ax  = currentPos.current.x + Math.cos(ang) * step
          const az  = currentPos.current.z + Math.sin(ang) * step
          if (!isBlocked(ax, az)) {
            currentPos.current.x = ax
            currentPos.current.z = az
            escaped = true
            break
          }
        }
        if (!escaped) {
          // Fully cornered — pick new wander target near spawn and pause briefly
          const ang = Math.random() * Math.PI * 2
          const r   = 4 + Math.random() * 8
          setTarget([startPos[0] + Math.cos(ang) * r, 0, startPos[2] + Math.sin(ang) * r])
        }
      }
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
  onNearParkedVehicle, onVehicleLabel, onFlyChange,
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
  const boostTimeAcc  = useRef(0)   // accumulated boost seconds for coin drain
  const speedKmhRef   = useRef(0)

  // ── Parked vehicle driving ────────────────────────────────────────────────
  // We do NOT spawn a separate "driven" mesh. On entry we grab the registry
  // entry for the parked vehicle (its real group + wheel/dust/lean refs) and
  // move THAT mesh while driving. One mesh per vehicle — no duplicate possible.
  const activeParkedIdx   = useRef(null)  // index into parkedVehicles, or null
  const activeParkedMesh  = useRef(null)  // parkedVehicleMeshes[id] entry, or null
  const parkedDriveState  = useRef(null)  // { pos, facing, speed } while driving
  const nearParkedRef = useRef(null)
  const pvDebugT = useRef(0)              // TEMP: throttle for parked-mesh debug log

  // ── Swimming (pool) ────────────────────────────────────────────────────────
  const swimming   = useRef(false)
  const swimLapEnd = useRef(null)        // 'w' | 'e' | null — last pool end reached
  const swimLaps   = useRef(0)
  const lastDive   = useRef(0)
  const [isSwimming, setIsSwimming] = useState(false)

  // ── Jump + Fly (Issue 5) + height-aware ground (Issue 4) ──────────────────
  const vy        = useRef(0)            // vertical velocity (jump/gravity)
  const groundedR = useRef(true)
  const flyMode   = useRef(false)
  const [isFlying, setIsFlying] = useState(false)
  const jumpReq   = useRef(false)        // set by mobile Jump button
  const toggleFly = useCallback(() => {
    if (activeVeh.current || passengerVeh.current || activeParkedIdx.current !== null) return
    if (swimming.current) { swimming.current = false; setIsSwimming(false) }
    flyMode.current = !flyMode.current
    setIsFlying(flyMode.current)
    onFlyChange?.(flyMode.current)
    if (!flyMode.current) vy.current = 0   // exit → gravity glides you down
  }, [onFlyChange])
  useEffect(() => {
    const onFlyToggle = () => toggleFly()
    const onJump = () => { jumpReq.current = true }
    window.addEventListener('toggle-fly', onFlyToggle)
    window.addEventListener('mobile-jump', onJump)
    return () => {
      window.removeEventListener('toggle-fly', onFlyToggle)
      window.removeEventListener('mobile-jump', onJump)
    }
  }, [toggleFly])

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
        if (e.code === 'KeyG' && gameControls.enabled) { toggleFly(); return }   // fly mode (F is taken by jobs/dive/claims)
        if (e.code === 'Digit1' && !emoteRef.current) { triggerEmote('greet');     return }
        if (e.code === 'Digit2' && !emoteRef.current) { triggerEmote('dance');     return }
        if (e.code === 'Digit3' && !emoteRef.current) { triggerEmote('laughing');  return }
        if (e.code === 'Digit4' && !emoteRef.current) { triggerEmote('handshake'); return }
        if (e.code === 'Escape' && emoteRef.current)  { cancelEmote(); return }
      }

      // ── Pool: dive off the board (F) for a quick reward, on foot only ──
      if (e.code === 'KeyF' && !activeVeh.current && !passengerVeh.current && activeParkedIdx.current === null) {
        // POOL_DIVE.x/z are already world coordinates.
        const dist = Math.hypot(charPos.current.x - POOL_DIVE.x, charPos.current.z - POOL_DIVE.z)
        if (dist < 4 && Date.now() - lastDive.current > 3000) {
          lastDive.current = Date.now()
          addCoins(10)
          swimming.current = true; setIsSwimming(true); swimLapEnd.current = null
          window.dispatchEvent(new CustomEvent('pool-dive', { detail: { coins: 10 } }))
          audioSystem.playEnter()
          return
        }
      }

      if (e.code === 'KeyE') {
        audioSystem.playInteractE()
        // ── 0. Pool: toggle swimming (on foot only) ───────────────────────
        if (!passengerVeh.current && !activeVeh.current && activeParkedIdx.current === null) {
          if (swimming.current) {
            swimming.current = false; setIsSwimming(false)
            audioSystem.playEnter()
            return
          }
          if (nearPool(charPos.current.x, charPos.current.z)) {
            swimming.current = true; setIsSwimming(true); swimLapEnd.current = null
            audioSystem.playEnter()
            return
          }
        }
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
          onVehicleLabel?.(null)
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
          activeParkedMesh.current = null   // mesh stays where it stopped
          parkedDriveState.current = null
          setInVehicle(false)
          onDrivingChange(null)
          onVehicleLabel?.(null)
          onNearVehicle(null)
          onSpeedChange(0)
          audioSystem.stopEngine()
          audioSystem.playEnter()
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
            onVehicleLabel?.('Car')
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
            onVehicleLabel?.('Bike')
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
            // Drive the EXISTING parked mesh — no second mesh is created.
            activeParkedMesh.current = parkedVehicleMeshes[pv.id] || null
            parkedDriveState.current = {
              pos:    new THREE.Vector3(pv.x, 0, pv.z),
              facing: pv.facing,
              speed:  0,
            }
            camYaw.current = pv.facing + Math.PI
            vehLean.current = 0
            if (playerGroupRef.current) playerGroupRef.current.visible = false
            setInVehicle(true)
            onDrivingChange(pv.type)
            onVehicleLabel?.(pv.vehicleLabel || (pv.type === 'car' ? 'Car' : 'Bike'))
            onNearVehicle(null)
            onNearParkedVehicle?.(null)
            audioSystem.startEngine(pv.type)
            audioSystem.playEnter()
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
    const BOUNDS = 800

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
      const hasCoinBoost = getEconomyState().coins > 0
      const boost = (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) && hasCoinBoost

      // Drain COSTS.vehicleBoost coins every 10 seconds of active boost
      if (boost) {
        boostTimeAcc.current += delta
        if (boostTimeAcc.current >= 10) {
          boostTimeAcc.current -= 10
          spendCoins(COSTS.vehicleBoost)
          window.dispatchEvent(new CustomEvent('boost-drain', { detail: { amount: COSTS.vehicleBoost } }))
        }
      } else {
        boostTimeAcc.current = 0
      }

      const maxSpd = cfg.maxSpeed * (boost ? cfg.boostMult : 1) * getSpeedMultiplier()

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

      // Height-aware: vehicles climb the flyover ramps and ride the deck
      const vGroundY = groundHeightAt(vst.pos.x, vst.pos.z, vGroup ? vGroup.position.y : 0)
      if (vGroup) { vGroup.position.set(vst.pos.x, vGroundY, vst.pos.z); vGroup.rotation.y = vst.facing }

      // Pin player character to vehicle seat every frame (deck-height aware)
      if (playerGroupRef.current) {
        const cos = Math.cos(vst.facing), sin = Math.sin(vst.facing)
        if (isCar) {
          playerGroupRef.current.position.set(
            vst.pos.x + sin * 0.1,
            vGroundY - 0.1,
            vst.pos.z + cos * 0.1
          )
        } else {
          playerGroupRef.current.position.set(vst.pos.x, vGroundY + 0.2, vst.pos.z)
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
      camera.position.set(px + d * Math.sin(y) * Math.cos(p), vGroundY + d * Math.sin(p), pz + d * Math.cos(y) * Math.cos(p))
      camera.lookAt(px, vGroundY + 0.9, pz)

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
      // The driven mesh IS the parked mesh (looked up from the registry on entry).
      const reg    = activeParkedMesh.current
      const vGroup = reg && reg.group.current
      const wRefs  = (reg && reg.wheels.current) || EMPTY_REFS

      // TEMP debug — verify the parked mesh ref is actually found (throttled ~1/s)
      pvDebugT.current += delta
      if (pvDebugT.current > 1) {
        pvDebugT.current = 0
        const meshData = parkedVehicleMeshes[pv.id]
        console.log('Driving parked:', pv.id, 'mesh found:', !!meshData?.group?.current,
          'pos:', vst.pos.x.toFixed(1), vst.pos.z.toFixed(1))
      }

      const fwd    = keys.current.has('KeyW') || keys.current.has('ArrowUp')
      const bwd    = keys.current.has('KeyS') || keys.current.has('ArrowDown')
      const left   = keys.current.has('KeyA') || keys.current.has('ArrowLeft')
      const right  = keys.current.has('KeyD') || keys.current.has('ArrowRight')
      const boost  = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
      const maxSpd = cfg.maxSpeed * (boost ? cfg.boostMult : 1) * getSpeedMultiplier()

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
      const BOUNDS = 800
      vst.pos.x = THREE.MathUtils.clamp(vx, -BOUNDS, BOUNDS)
      vst.pos.z = THREE.MathUtils.clamp(vz, -BOUNDS, BOUNDS)

      // Height-aware: vehicles climb the flyover ramps and ride the deck
      const vGroundY = groundHeightAt(vst.pos.x, vst.pos.z, vGroup ? vGroup.position.y : 0)
      if (vGroup) { vGroup.position.set(vst.pos.x, vGroundY, vst.pos.z); vGroup.rotation.y = vst.facing }

      // Pin player character to vehicle seat every frame (deck-height aware)
      if (playerGroupRef.current) {
        const cos = Math.cos(vst.facing), sin = Math.sin(vst.facing)
        if (isCar) {
          playerGroupRef.current.position.set(
            vst.pos.x + sin * 0.1,
            vGroundY - 0.1,
            vst.pos.z + cos * 0.1
          )
        } else {
          playerGroupRef.current.position.set(vst.pos.x, vGroundY + 0.2, vst.pos.z)
        }
        playerGroupRef.current.rotation.y = vst.facing
        playerGroupRef.current.visible = true
      }

      const spin = (vst.speed * delta) / cfg.wheelRadius
      for (let i = 0; i < wRefs.length; i++) { if (wRefs[i]) wRefs[i].rotation.x -= spin }

      const leanG = reg && reg.lean.current
      if (!isCar && leanG) {
        const steer     = left ? 1 : right ? -1 : 0
        const speedFrac = Math.min(absSpd / cfg.maxSpeed, 1)
        const target    = -steer * cfg.leanAngle * speedFrac
        vehLean.current += (target - vehLean.current) * Math.min(1, delta * 6)
        leanG.rotation.z = vehLean.current
      }

      const dustOpacity = (fwd && absSpd > 2) ? Math.min(0.6, absSpd * 0.04) : 0
      const dustArr = (reg && reg.dusts.current) || EMPTY_REFS
      const bdust   = reg && reg.bdust.current
      if (isCar) {
        for (let i = 0; i < dustArr.length; i++) {
          const dm = dustArr[i]
          if (dm) {
            dm.material.opacity = dustOpacity > 0
              ? dustOpacity * (0.7 + Math.random() * 0.3)
              : dm.material.opacity * 0.8
            if (dustOpacity > 0) dm.scale.setScalar(0.8 + absSpd * 0.04)
          }
        }
      } else if (bdust) {
        const dm = bdust
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
      camera.position.set(pvx + pvd * Math.sin(pvy) * Math.cos(pvp), vGroundY + pvd * Math.sin(pvp), pvz + pvd * Math.cos(pvy) * Math.cos(pvp))
      camera.lookAt(pvx, vGroundY + 0.9, pvz)

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

    // Sync shared car/bike groups from vehicleState. Three cases:
    //   • local player is driving it → DON'T touch it here; the driving block
    //     above already owns its position. (Resetting it here every frame left
    //     the car behind at the spawn spot → looked like a duplicate vehicle.)
    //   • a remote player is driving it → hide our static copy.
    //   • nobody driving → show it at the synced vehicleState position.
    const carRemote = vehicleState.car.driverId !== null && vehicleState.car.driverId !== myUserId
    const carMine   = activeVeh.current === 'car'
    if (carGroupRef.current && !carMine) {
      carGroupRef.current.visible = !carRemote
      if (!carRemote) {
        carGroupRef.current.position.set(vehicleState.car.x, 0, vehicleState.car.z)
        carGroupRef.current.rotation.y = vehicleState.car.facing
        carState.current.pos.set(vehicleState.car.x, 0, vehicleState.car.z)
        carState.current.facing = vehicleState.car.facing
      }
    }
    const bikeRemote = vehicleState.bike.driverId !== null && vehicleState.bike.driverId !== myUserId
    const bikeMine   = activeVeh.current === 'bike'
    if (bikeGroupRef.current && !bikeMine) {
      bikeGroupRef.current.visible = !bikeRemote
      if (!bikeRemote) {
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
        if (!introState.active) {   // cinematic intro rig owns the camera
          camera.position.set(px + d * Math.sin(y) * Math.cos(p), d * Math.sin(p), pz + d * Math.cos(y) * Math.cos(p))
          camera.lookAt(px, 0.9, pz)
        }
        return
      }
    }

    const SPEED = 8 * getSpeedMultiplier()   // live-event "Turbo Mode" doubles this
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

    const isRunNow = moving && boost && !swimming.current && !flyMode.current
    const swimFactor = swimming.current ? 0.6 : 1   // swim at 60% speed
    const flyFactor  = flyMode.current ? 3 : 1      // superman speed
    if (moving) {
      _move.current.normalize()
      const step = SPEED * swimFactor * flyFactor * moveSpeed * (isRunNow ? 1.6 : 1) * delta
      charFacing.current = Math.atan2(_move.current.x, _move.current.z)
      const ox = charPos.current.x, oz = charPos.current.z
      if (flyMode.current || charPos.current.y > 2.5) {
        // Airborne (fly mode, or high above ground e.g. on the flyover edge):
        // skip ground collision for the smoothest flight (spec choice)
        charPos.current.x = THREE.MathUtils.clamp(ox + _move.current.x * step, -BOUNDS, BOUNDS)
        charPos.current.z = THREE.MathUtils.clamp(oz + _move.current.z * step, -BOUNDS, BOUNDS)
      } else {
        const [rx] = resolveCollisions(ox + _move.current.x * step, oz)
        charPos.current.x = THREE.MathUtils.clamp(rx, -BOUNDS, BOUNDS)
        const [, rz] = resolveCollisions(charPos.current.x, oz + _move.current.z * step)
        charPos.current.z = THREE.MathUtils.clamp(rz, -BOUNDS, BOUNDS)
      }
    } else if (!flyMode.current && charPos.current.y <= 2.5) {
      const [cx, cz] = resolveCollisions(charPos.current.x, charPos.current.z)
      charPos.current.x = THREE.MathUtils.clamp(cx, -BOUNDS, BOUNDS)
      charPos.current.z = THREE.MathUtils.clamp(cz, -BOUNDS, BOUNDS)
    }

    // ── Swimming: keep the player inside the pool + count laps ──
    if (swimming.current) {
      charPos.current.x = THREE.MathUtils.clamp(charPos.current.x, POOL.cx - POOL.halfW + 0.5, POOL.cx + POOL.halfW - 0.5)
      charPos.current.z = THREE.MathUtils.clamp(charPos.current.z, POOL.cz - POOL.halfD + 0.5, POOL.cz + POOL.halfD - 0.5)
      const end = charPos.current.x <= POOL.cx - POOL.halfW + 3 ? 'w'
                : charPos.current.x >= POOL.cx + POOL.halfW - 3 ? 'e' : null
      if (end && end !== swimLapEnd.current) {
        if (swimLapEnd.current !== null) {   // completed an end-to-end length
          swimLaps.current += 1
          addCoins(5)
          if (swimLaps.current === 10) addCoins(50)
          window.dispatchEvent(new CustomEvent('pool-lap', { detail: { laps: swimLaps.current } }))
        }
        swimLapEnd.current = end
      }
    }
    // ── Vertical: fly mode > jump/gravity > flyover-aware ground (Issue 4+5) ──
    const groundY = swimming.current
      ? POOL.surfaceY
      : groundHeightAt(charPos.current.x, charPos.current.z, charPos.current.y)
    if (flyMode.current) {
      let dy = 0
      if (keys.current.has('Space'))                              dy += 18
      if (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) dy -= 18
      charPos.current.y = THREE.MathUtils.clamp(charPos.current.y + dy * delta, groundY, 120)
      vy.current = 0
      groundedR.current = false
    } else if (!swimming.current) {
      const wantJump = (keys.current.has('Space') && gameControls.enabled) || jumpReq.current
      jumpReq.current = false
      if (wantJump && groundedR.current) {       // v₀ = √(2·g·h) → 3-unit apex
        vy.current = 12
        groundedR.current = false
      }
      vy.current -= 24 * delta                   // gravity
      charPos.current.y += vy.current * delta
      if (charPos.current.y <= groundY + 0.001) {
        charPos.current.y = groundY
        vy.current = 0
        groundedR.current = true
      } else {
        groundedR.current = false
      }
    } else {
      charPos.current.y = POOL.surfaceY
      vy.current = 0
      groundedR.current = true
    }
    minimapState.playerY = charPos.current.y   // read by FlyTrail
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
      playerGroupRef.current.position.set(charPos.current.x, charPos.current.y, charPos.current.z)
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
    for (const c of boxColliders) {
      const ox = Math.max(0, Math.abs(px - c.x) - c.hw)
      const oz = Math.max(0, Math.abs(pz - c.z) - c.hd)
      const wallDist = Math.sqrt(ox * ox + oz * oz)
      if (wallDist < 4) { wallPush = Math.max(wallPush, 1 - wallDist / 4); break }
    }
    const effectiveDist = Math.max(2, d * (1 - wallPush * 0.65))

    const py = charPos.current.y
    if (!introState.active) {   // cinematic intro rig owns the camera
      camera.position.set(px + effectiveDist * Math.sin(y) * Math.cos(p), py + effectiveDist * Math.sin(p), pz + effectiveDist * Math.cos(y) * Math.cos(p))
      camera.lookAt(px, py + 0.9, pz)
    }

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

    // True if obj is the player group or any descendant of it (the avatar's own
    // body meshes). The occlusion fade must never dim the player's own character.
    const isPlayerOwn = (obj) => {
      let o = obj
      while (o) { if (o === playerGroupRef.current) return true; o = o.parent }
      return false
    }
    // Never fade a character (remote players / companions / NPCs) as an "occluder".
    const isCharacter = (obj) => {
      let o = obj
      while (o) {
        const ud = o.userData || {}
        if (ud.isPlayer || ud.isRemotePlayer || ud.isCompanion || ud.isNPC) return true
        o = o.parent
      }
      return false
    }

    const hits = occlusionRay.current.intersectObjects(scene.children, true)
    for (const hit of hits) {
      const mat = hit.object.material
      if (!mat || isPlayerOwn(hit.object) || isCharacter(hit.object)) continue
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
      // Own house proximity (dynamic position, not in PLACES)
      if (!nearBld) {
        const hs = getHouseState()
        if (hs.ready && hs.position) {
          const dx = charPos.current.x - hs.position.x
          const dz = charPos.current.z - hs.position.z
          if (dx * dx + dz * dz < 16) {   // 4-unit radius
            nearBld = { id: 'playerhouse', label: 'Your Home 🏠', emoji: '🏠' }
          }
        }
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
        <PlayerModel walking={isWalking} running={isRunning} sitting={inVehicle} swimming={isSwimming} flying={isFlying} name={avatar.name} outfit={avatar.outfit} skin={avatar.skin} emote={emote} onEmoteEnd={handleEmoteEnd} />
      </group>

      {/* Car — hidden when a remote player is driving it (handled in useFrame) */}
      <group ref={carGroupRef} position={[vehicleState.car.x, 0, vehicleState.car.z]}
        userData={{ noMerge: true, isVehicle: true }}>
        <Car3D wheelRefs={carWheels} dustRefs={carDustRefs} />
        {!inVehicle && !isPassenger && (
          <Billboard position={[0, 2.2, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🚗 Car</Text>
          </Billboard>
        )}
      </group>

      {/* Bike — hidden when a remote player is driving it (handled in useFrame) */}
      <group ref={bikeGroupRef} position={[vehicleState.bike.x, 0, vehicleState.bike.z]}
        userData={{ noMerge: true, isVehicle: true }}>
        <Bike3D wheelRefs={bikeWheels} leanRef={bikeLeanRef} dustRef={bikeDustRef} />
        {!inVehicle && !isPassenger && (
          <Billboard position={[0, 2.0, 0]}>
            <Text fontSize={0.16} color="#facc15" anchorX="center">🏍 Bike</Text>
          </Billboard>
        )}
      </group>

      {/* No separate "driven parked" mesh — the parked vehicle's own mesh is
          driven directly (see ParkedVehicles + the registry in parkedVehicleState). */}

      {/* Fly-mode sparkle trail */}
      {isFlying && <FlyTrail />}
    </>
  )
}

// ── Places ────────────────────────────────────────────────────────────────────
// Positions match CityMap.jsx building positions exactly
// Positions match the GTA-style spread in CityMap.jsx — buildings line the
// highway arms; only the plaza remains at the centre.
const PLACES = [
  { id: 'cafe',        pos: [-80, 0,-16],  emoji: '☕', label: 'Cafe',         color: '#F59E0B' },
  { id: 'arcade',      pos: [ 80, 0,-16],  emoji: '🕹️', label: 'Arcade',       color: '#7C3AED' },
  { id: 'beach',       pos: [170, 0,-55],  emoji: '🏖️', label: 'Beach Club',   color: '#38BDF8' },
  { id: 'rooftop',     pos: [ 18, 0,-115], emoji: '🌙', label: 'Rooftop Bar',  color: '#6366F1' },
  { id: 'musicroom',   pos: [ 18, 0,-160], emoji: '🎵', label: 'Music Room',   color: '#EC4899' },
  { id: 'park',        pos: [-18, 0, 170], emoji: '🌳', label: 'Park',         color: '#22C55E' },
  { id: 'cityhall',    pos: [-18, 0,-90],  emoji: '🏛️', label: 'City Hall',    color: '#94a3b8' },
  { id: 'mall',        pos: [-22, 0, 205], emoji: '🛍️', label: 'Shopping Mall',color: '#b45309' },
  { id: 'cinema',      pos: [ 18, 0, 90],  emoji: '🎬', label: 'Cinema',       color: '#334155' },
  { id: 'supermarket', pos: [-120,0, 16],  emoji: '🛒', label: 'Supermarket',  color: '#4a7c59' },
  { id: 'bank',        pos: [135, 0, 16],  emoji: '🏦', label: 'Bank',         color: '#92400e' },
  { id: 'hospital',    pos: [100, 0, 16],  emoji: '🏥', label: 'Hospital',     color: '#0ea5e9' },
  { id: 'police',      pos: [120, 0,-16],  emoji: '👮', label: 'Police Dept',  color: '#1d4ed8' },
  { id: 'firestation', pos: [ 18, 0,-200], emoji: '🚒', label: 'Fire Station', color: '#dc2626' },
  { id: 'school',      pos: [-160,0, 16],  emoji: '🏫', label: 'School',       color: '#c8b983' },
  { id: 'library',     pos: [-130,0,-16],  emoji: '📚', label: 'Library',      color: '#8b6914' },
  { id: 'gym',         pos: [-18, 0,-140], emoji: '💪', label: 'Gym',          color: '#1a2035' },
  { id: 'restaurant',  pos: [ 18, 0, 135], emoji: '🍕', label: 'Restaurant',   color: '#f97316' },
  { id: 'gasstation',  pos: [ 65, 0, 16],  emoji: '⛽', label: 'Gas Station',  color: '#ef4444' },
  { id: 'church',      pos: [-185,0,-18],  emoji: '⛪', label: 'Temple',       color: '#d4b896' },
  { id: 'postoffice',  pos: [ 18, 0,-75],  emoji: '📮', label: 'Post Office',  color: '#8b6355' },
  { id: 'apartments',  pos: [-18, 0,-190], emoji: '🏢', label: 'Apartments',   color: '#475569' },
  { id: 'playground',  pos: [-18, 0, 130], emoji: '🎠', label: 'Playground',   color: '#22c55e' },
  { id: 'house1',      pos: [ 40, 0, 50],  emoji: '🏠', label: 'Blue House',   color: '#3b82f6' },
  { id: 'house2',      pos: [ 55, 0, 50],  emoji: '🏠', label: 'Yellow House', color: '#eab308' },
  { id: 'gamearea',    pos: [ 20, 0, 180], emoji: '🎮', label: 'Game Zone',    color: '#a78bfa' },
  { id: 'pool',        pos: [300, 0,-300], emoji: '🏊', label: 'Swimming Pool', color: '#38bdf8' },
  { id: 'airport',     pos: [-600,0,-600], emoji: '✈️', label: 'Airport',       color: '#94a3b8' },
]

// One-time collision audit (Issue 2) — logs "<building> has collision: true/false"
if (typeof window !== 'undefined') setTimeout(() => logAllColliders(PLACES), 4000)

const NPCS = [
  // All start on plaza island (r<7) or footpaths — never inside a building
  { name: 'Anaya',  skin: '#D4956A', outfit: 'party',       color: '#F472B6', pos: [-4,  0,  3]  },
  { name: 'Rahul',  skin: '#C68642', outfit: 'casual',      color: '#60A5FA', pos: [ 4,  0,  3]  },
  { name: 'Zoya',   skin: '#F4C08A', outfit: 'school',      color: '#34D399', pos: [ 0,  0, -4]  },
  { name: 'Kabir',  skin: '#8D5524', outfit: 'sports',      color: '#FBBF24', pos: [-3,  0,  5]  },
  { name: 'Meera',  skin: '#FDDBB4', outfit: 'traditional', color: '#F87171', pos: [ 3,  0,  5]  },
  { name: 'Arjun',  skin: '#C68642', outfit: 'casual',      color: '#a78bfa', pos: [-10, 0,  9]  },
  { name: 'Priya',  skin: '#F4C08A', outfit: 'school',      color: '#86efac', pos: [ 10, 0,  9]  },
  { name: 'Dev',    skin: '#8D5524', outfit: 'sports',      color: '#fdba74', pos: [ 9,  0, -10] },
  { name: 'Nisha',  skin: '#FDDBB4', outfit: 'party',       color: '#f9a8d4', pos: [-9,  0, -10] },
  { name: 'Rohan',  skin: '#D4956A', outfit: 'winter',      color: '#67e8f9', pos: [ 0,  0,  2]  },
  { name: 'Sana',   skin: '#F4C08A', outfit: 'traditional', color: '#fcd34d', pos: [-6,  0,  0]  },
  { name: 'Vivek',  skin: '#C68642', outfit: 'casual',      color: '#6ee7b7', pos: [ 6,  0,  0]  },
]

// ── Parked vehicles — enterable; the SAME mesh is driven when entered ─────────
// Each item owns its group + wheel/dust/lean refs and registers them in
// parkedVehicleMeshes so the driving loop can move this exact mesh. There is no
// separate "driven" mesh and no hide-on-drive logic — one mesh per vehicle.
function ParkedVehicleItem({ v }) {
  const groupRef = useRef()
  const wheels   = useRef(v.type === 'car' ? [null, null, null, null] : [null, null])
  const dusts    = useRef([null, null])
  const lean     = useRef(null)
  const bdust    = useRef(null)

  useEffect(() => {
    parkedVehicleMeshes[v.id] = { group: groupRef, wheels, dusts, lean, bdust }
    return () => { delete parkedVehicleMeshes[v.id] }
  }, [v.id])

  return (
    <group ref={groupRef} position={[v.x, 0, v.z]} rotation={[0, v.facing, 0]}
      userData={{ noMerge: true, isVehicle: true }}>
      {v.type === 'car'
        ? <Car3D  bodyColor={v.color} wheelRefs={wheels} dustRefs={dusts} />
        : <Bike3D frameColor={v.color} wheelRefs={wheels} leanRef={lean} dustRef={bdust} />
      }
      {/* Personal vehicle nameplate (owner-owned vehicles parked at home) */}
      {v.owner && (
        <Billboard position={[0, 2.1, 0]}>
          <Text fontSize={0.26} color="#fbbf24" anchorX="center" anchorY="middle"
            outlineWidth={0.03} outlineColor="#000">
            {`${v.ownerName || 'Player'}'s ${v.vehicleLabel || 'Vehicle'}`}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function ParkedVehicles() {
  // Re-renders only when the vehicle SET changes (e.g. home vehicles spawned),
  // never on entry/exit — the driven vehicle is moved in place via its registry ref.
  const [pvList, setPvList] = useState(() => [...parkedVehicles])
  useEffect(() => onParkedVehicleChange(() => setPvList([...parkedVehicles])), [])
  return (
    <>
      {pvList.map(v => <ParkedVehicleItem key={v.id} v={v} />)}
    </>
  )
}

// ── Real-world clock tower — shows actual current time ────────────────────────
// Placed on top of City Hall (world pos -18, 0, -88 — moved with the spread)
function ClockTower() {
  const hourRef = useRef()
  const minRef  = useRef()
  const tickRef = useRef(0)

  useFrame((_, delta) => {
    tickRef.current += delta
    if (tickRef.current < 5) return   // update hands every 5 s
    tickRef.current = 0
    const now  = new Date()
    const h    = (now.getHours() % 12) + now.getMinutes() / 60
    const m    = now.getMinutes() + now.getSeconds() / 60
    if (hourRef.current) hourRef.current.rotation.z = -(h / 12) * Math.PI * 2
    if (minRef.current)  minRef.current.rotation.z  = -(m / 60) * Math.PI * 2
  })

  const lampOn = timeWeatherState.lampOn
  const faceMat = new THREE.MeshToonMaterial({ color: '#fff8f0' })
  const bodyMat = new THREE.MeshToonMaterial({ color: '#64748b' })
  const handMat = new THREE.MeshToonMaterial({ color: '#1e293b' })

  return (
    <group position={[-18, 0, -88]}>
      {/* Tower body rising from City Hall roof */}
      <mesh position={[0, 10, 0]}>
        <boxGeometry args={[2.2, 8, 2.2]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      {/* Spire */}
      <mesh position={[0, 15.5, 0]}>
        <coneGeometry args={[1.3, 3, 4]} />
        <meshToonMaterial color="#475569" />
      </mesh>
      {/* Clock face (front) */}
      <mesh position={[0, 11.5, 1.12]}>
        <circleGeometry args={[0.9, 24]} />
        <primitive object={faceMat} attach="material" />
      </mesh>
      {/* Hour hand */}
      <group ref={hourRef} position={[0, 11.5, 1.13]}>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.07, 0.52, 0.03]} />
          <primitive object={handMat} attach="material" />
        </mesh>
      </group>
      {/* Minute hand */}
      <group ref={minRef} position={[0, 11.5, 1.14]}>
        <mesh position={[0, 0.33, 0]}>
          <boxGeometry args={[0.045, 0.66, 0.03]} />
          <primitive object={handMat} attach="material" />
        </mesh>
      </group>
      {/* Clock face (back) */}
      <mesh position={[0, 11.5, -1.12]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <primitive object={faceMat} attach="material" />
      </mesh>
      {/* Decorative lamp on top of spire */}
      <mesh position={[0, 17.5, 0]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshToonMaterial
          color={lampOn ? '#fef9c3' : '#94a3b8'}
          emissive={lampOn ? new THREE.Color('#ffe566') : new THREE.Color('#000')}
          emissiveIntensity={lampOn ? 1.5 : 0}
        />
      </mesh>
    </group>
  )
}

// ── Navigation trail — glowing cyan dots from player to nav target ────────────
const NAV_DOTS   = 30       // max sphere instances
const DOT_STEP   = 2        // world units between dots
const DOT_RADIUS = 0.18

function NavTrail() {
  const meshRef   = useRef()
  const timerRef  = useRef(0)
  const arrivedRef = useRef(false)
  const dummy     = useMemo(() => new THREE.Object3D(), [])
  const mat       = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00e5ff', toneMapped: false }), [])
  const geo       = useMemo(() => new THREE.SphereGeometry(DOT_RADIUS, 6, 4), [])

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Escape') navState.clearTarget() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    timerRef.current += delta

    const tgt = navState.target
    if (!tgt) {
      mesh.count = 0
      arrivedRef.current = false
      return
    }

    const px = minimapState.playerX
    const pz = minimapState.playerZ
    const dx = tgt.x - px
    const dz = tgt.z - pz
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Arrival check
    if (dist < 5) {
      if (!arrivedRef.current) {
        arrivedRef.current = true
        audioSystem.playSuccess()
        navState.clearTarget()
      }
      mesh.count = 0
      return
    }
    arrivedRef.current = false

    // Update dots every 0.5 s
    if (timerRef.current < 0.5) return
    timerRef.current = 0

    const nx = dx / dist
    const nz = dz / dist
    const steps = Math.min(NAV_DOTS, Math.floor(dist / DOT_STEP))
    const pulse = (Date.now() / 400) % 1   // 0-1 for animated scale

    for (let i = 0; i < steps; i++) {
      const t  = (i + 1) / (steps + 1)
      const sc = 0.6 + 0.4 * Math.sin((t + pulse) * Math.PI * 2) * 0.5 + 0.5
      dummy.position.set(px + nx * (i + 1) * DOT_STEP, 0.3, pz + nz * (i + 1) * DOT_STEP)
      dummy.scale.setScalar(sc)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = steps
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geo, mat, NAV_DOTS]} frustumCulled={false} />
  )
}

// ── World scene (memoized — never re-renders on WorldCanvas state changes) ────
const WorldScene = React.memo(function WorldScene({ onNPCChat, remotePlayerIds = [], onPlayerClick, onPlayerContextMenu, myUserId }) {
  return (
    <>
      <SceneExposer />
      <CityMerger />
      <FpsTracker />
      <PerfLogger />
      <ToonStyle />
      <SkyDome />
      <Clouds />
      <Companion3D />
      <ChallengeScene />
      <DayNightCycle />
      <WeatherSystem />
      <CityMap />
      <ProceduralWorld />
      <ParkedVehicles />
      <NPCTraffic />

      {PLACES.map(p => (
        <PlaceMarker key={p.id} position={p.pos} emoji={p.emoji} label={p.label} color={p.color} />
      ))}

      <BuildingLabels />

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

      {/* Real-world clock tower on City Hall */}
      <ClockTower />

      {/* Navigation trail */}
      <NavTrail />

      {/* Player's personal house in the residential zone */}
      <PlayerHouseMarker />

      {/* GLB trees for all procedural chunks (2 draw calls total) */}
      <ChunkTrees />

      {/* City-wide live events (meteor shower, snow, flash mob, treasure, stranger) */}
      <LiveEvents />
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

  const dismiss = () => {
    if (_wlDone) return
    _wlDone = true
    setOpacity(0)
    setTimeout(() => setRemoved(true), 1000)
    // Signal the rest of the app that the 3D world has finished streaming in.
    try { window.dispatchEvent(new CustomEvent('city-scene-ready')) } catch {}
  }

  useEffect(() => {
    if (_wlDone) return
    if (active) {
      _wlEverActive = true
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      return
    }
    if (!_wlEverActive) return
    timerRef.current = setTimeout(dismiss, 500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [active])

  // Hard fallback: dismiss after 8s no matter what, so the overlay can never get
  // stuck at 100% if drei's `active` flag never cleanly flips to false (e.g. when
  // tracked assets change). Runs once on mount.
  useEffect(() => {
    const id = setTimeout(dismiss, 8000)
    return () => clearTimeout(id)
  }, [])

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
// Pixel ratio locked to 1 — dpr 1.5/2 means 2.25×/4× the pixels to shade.
// This is one of the single biggest FPS wins on hi-DPI screens.
const DPR = 1

export default function WorldCanvas({ onNPCChat, onEnterBuilding, remotePlayerIds = [], onPlayerClick, onPlayerContextMenu, introPlaying = false, onIntroDone }) {
  const avatar  = useStore(s => s.avatar)
  const { user } = useUser()
  const myUserId = user?.id

  const [nearVeh,       setNearVeh]       = useState(null)
  const [drivingType,   setDrivingType]   = useState(null)
  const [drivingLabel,  setDrivingLabel]  = useState(null)  // human label of driven vehicle
  const [flyHud,        setFlyHud]        = useState(false) // fly-mode indicator
  const [isPassenger,   setIsPassenger]   = useState(false)
  const [speedKmh,      setSpeedKmh]      = useState(0)
  const [nearBuilding,  setNearBuilding]  = useState(null)
  const [nearParkedVeh, setNearParkedVeh] = useState(null)
  const [showFps,      setShowFps]      = useState(true)   // FPS counter always on (F3 toggles)
  const [fpsDisplay,   setFpsDisplay]   = useState(0)
  const [boostDrainMsg, setBoostDrainMsg] = useState(null)
  // Post-processing: desktop only. Auto-quality drops bloom if FPS sags.
  // Post-processing OFF by default — it was the main FPS cost. Can be re-enabled
  // later once the scene is consistently above 60 FPS.
  const [postFxOn,     setPostFxOn]     = useState(false)
  const [bloomOn,      setBloomOn]      = useState(false)
  // Freeze the city render loop while a full-screen 3D mini-game is open — it fully
  // covers the screen, so rendering the city behind it just wastes GPU.
  const [cityFrozen,   setCityFrozen]   = useState(false)
  useEffect(() => {
    const onMini = (e) => setCityFrozen(!!e.detail?.active)
    window.addEventListener('minigame-3d', onMini)
    return () => window.removeEventListener('minigame-3d', onMini)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.code === 'F3') { e.preventDefault(); setShowFps(s => !s) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Auto-quality: keep the framerate smooth without losing the cinematic look ──
  // Sustained <45 FPS → drop bloom first; if it's still low, drop the whole FX pass.
  useEffect(() => {
    if (isMobileDevice) return
    let lowStreak = 0
    const id = setInterval(() => {
      const fps = _fps.value
      if (fps <= 0) return
      if (fps < 45) {
        lowStreak++
        if (lowStreak === 2)      { setBloomOn(false); setBloom(false) }
        else if (lowStreak >= 4)  { setPostFxOn(false) }
      } else if (fps >= 55) {
        lowStreak = 0
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let tid = null
    const handler = (e) => {
      setBoostDrainMsg(`-${e.detail.amount} coins`)
      clearTimeout(tid)
      tid = setTimeout(() => setBoostDrainMsg(null), 1500)
    }
    window.addEventListener('boost-drain', handler)
    return () => { window.removeEventListener('boost-drain', handler); clearTimeout(tid) }
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
        frameloop={cityFrozen ? 'never' : 'always'}
        camera={{ position: [0, 10, 18], fov: 55, near: 0.1, far: 600 }}
        gl={{ antialias: !postFxOn, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          // Auto-recover from a GPU context loss instead of leaving a black screen
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            setTimeout(() => window.location.reload(), 2000)
          })
        }}
      >
        <Suspense fallback={null}>
          <WorldScene
            onNPCChat={onNPCChat}
            remotePlayerIds={remotePlayerIds}
            onPlayerClick={onPlayerClick}
            onPlayerContextMenu={onPlayerContextMenu}
            myUserId={myUserId}
          />
          <IntroCameraRig playing={introPlaying} onDone={onIntroDone} />
          {postFxOn && <PostFX bloom={bloomOn} />}
          <PlayerController
            avatar={avatar}
            myUserId={myUserId}
            onNearVehicle={setNearVeh}
            onDrivingChange={setDrivingType}
            onVehicleLabel={setDrivingLabel}
            onFlyChange={setFlyHud}
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
            {drivingLabel && (
              <><span style={{ color: '#facc15', fontWeight: 700 }}>
                {drivingType === 'car' ? '🚗' : '🏍'} {drivingLabel}
              </span> &nbsp;|&nbsp;</>
            )}
            <strong>E</strong> — Exit &nbsp;|&nbsp;
            <strong>W/S</strong> Accel/Brake &nbsp;|&nbsp;
            <strong>A/D</strong> Steer &nbsp;|&nbsp;
            <strong>Shift</strong> Boost (🪙 {COSTS.vehicleBoost}/10s)
          </div>
          {boostDrainMsg && (
            <div style={{
              position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(234,179,8,0.9)', color: '#000', padding: '4px 12px',
              borderRadius: 6, fontFamily: 'Nunito, sans-serif', fontWeight: 800,
              fontSize: 13, pointerEvents: 'none',
            }}>
              ⚡ Boost {boostDrainMsg}
            </div>
          )}
          <Speedometer kmh={speedKmh} />
        </>
      )}

      {/* Fly-mode indicator + toggle button */}
      {flyHud && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(56,189,248,0.85)', color: '#04121f', padding: '6px 16px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none', fontWeight: 700,
        }}>
          ✈ FLY MODE — <strong>Space</strong> up · <strong>Shift</strong> down · <strong>G</strong> to land
        </div>
      )}
      {!drivingType && !isPassenger && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-fly'))}
          title="Toggle fly mode (G)"
          style={{
            position: 'absolute', bottom: 86, right: 16, width: 46, height: 46,
            borderRadius: 14, border: `1.5px solid ${flyHud ? 'rgba(56,189,248,0.9)' : 'rgba(56,189,248,0.4)'}`,
            background: flyHud ? 'rgba(56,189,248,0.85)' : 'rgba(8,8,16,0.7)',
            fontSize: 20, cursor: 'pointer', zIndex: 60,
          }}
        >✈️</button>
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
