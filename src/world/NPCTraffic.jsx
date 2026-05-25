import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Car3D, Bike3D } from './Vehicle3D'
import { minimapState } from '@/lib/minimapState'
import { vehicleState } from '@/lib/vehicleState'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { parkedVehicles } from '@/lib/parkedVehicleState'

// ── Road loop paths (waypoints = road intersections) ──────────────────────────
const PATHS = {
  outer: [[-40,-34],[40,-34],[40,34],[-40,34]],
  inner: [[-20,-18],[20,-18],[20,18],[-20,18]],
  ring:  [[0,-18],[20,-18],[20,0],[20,18],[0,18],[-20,18],[-20,0],[-20,-18]],
}

const NPC_VEHICLES = [
  { type:'car',  path:'outer', offset:0, color:'#3b82f6', speed:3.5 },
  { type:'car',  path:'outer', offset:2, color:'#f8fafc', speed:3.0 },
  { type:'car',  path:'inner', offset:0, color:'#facc15', speed:3.5 },
  { type:'car',  path:'inner', offset:2, color:'#64748b', speed:3.0 },
  { type:'car',  path:'ring',  offset:0, color:'#22c55e', speed:4.0 },
  { type:'car',  path:'ring',  offset:4, color:'#f97316', speed:3.5 },
  { type:'bike', path:'outer', offset:1, color:'#a855f7', speed:5.0 },
  { type:'bike', path:'ring',  offset:2, color:'#ec4899', speed:5.5 },
]
const N = NPC_VEHICLES.length

// ── Shared NPC position registry for mutual avoidance ─────────────────────────
// Each entry: { x, z, facing, pathKey }
const _npcPos = []

// Player spawns near (0,0) — keep NPC spawns at least this far away
const SAFE_SPAWN_DIST = 35

function makeState(cfg) {
  const path = PATHS[cfg.path]
  let idx = cfg.offset % path.length

  // Pick the waypoint furthest from player origin; accept first one >= SAFE_SPAWN_DIST
  let bestIdx = idx
  let bestDist = 0
  for (let i = 0; i < path.length; i++) {
    const ti = (idx + i) % path.length
    const d  = Math.hypot(path[ti][0], path[ti][1])
    if (d > bestDist) { bestDist = d; bestIdx = ti }
    if (d >= SAFE_SPAWN_DIST) break
  }
  idx = bestIdx

  return {
    wpIdx: idx,
    x: path[idx][0], z: path[idx][1],
    facing: 0, speed: 0,
    blocked: false,           // hysteresis flag
    steerBias: 0,             // persistent lateral offset (rad/s)
    posEntry: null,
    stuckTimer: 0, stuckX: path[idx][0], stuckZ: path[idx][1], stuckTravel: 0,
  }
}

export default function NPCTraffic() {
  const states     = useRef(NPC_VEHICLES.map(makeState))
  const groups     = useRef(new Array(N).fill(null))
  const wArrs      = useRef(NPC_VEHICLES.map(() => [null, null, null, null]))
  const wObjs      = useRef(NPC_VEHICLES.map((_, i) => ({ current: wArrs.current[i] })))
  const hls        = useRef(new Array(N).fill(null))
  const frameCount = useRef(0)
  const accumDelta = useRef(0)

  useEffect(() => {
    const entries = states.current.map((s, i) => {
      const e = { x: s.x, z: s.z, facing: s.facing, pathKey: NPC_VEHICLES[i].path }
      s.posEntry = e
      _npcPos.push(e)
      return e
    })
    return () => {
      entries.forEach(e => {
        const i = _npcPos.indexOf(e)
        if (i >= 0) _npcPos.splice(i, 1)
      })
    }
  }, [])

  useFrame((_, rawDelta) => {
    accumDelta.current += Math.min(rawDelta, 0.05)
    frameCount.current++
    if (frameCount.current % 3 !== 0) return   // physics every 3rd frame

    const delta    = accumDelta.current
    accumDelta.current = 0
    const px       = minimapState.playerX || 0
    const pz       = minimapState.playerZ || 0
    const carOn    = !!vehicleState.car.driverId
    const bikeOn   = !!vehicleState.bike.driverId
    const lampOn   = !!(timeWeatherState.lampOn)

    for (let i = 0; i < N; i++) {
      const cfg  = NPC_VEHICLES[i]
      const path = PATHS[cfg.path]
      const s    = states.current[i]

      // ── Waypoint tracking ────────────────────────────────────────────────
      const wp = path[s.wpIdx]
      const dx = wp[0] - s.x, dz = wp[1] - s.z
      const distSq = dx * dx + dz * dz
      if (distSq < 4) {
        s.wpIdx = (s.wpIdx + 1) % path.length
      }

      // Smooth heading toward next waypoint
      const tgtF = Math.atan2(dx, dz)
      let diff = tgtF - s.facing
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      s.facing += diff * Math.min(1, delta * 4)

      // ── Avoidance ────────────────────────────────────────────────────────
      const STOP   = 4.5   // full stop within this distance
      const SLOW   = 8.0   // start slowing within this distance
      const RESUME = 6.0   // hysteresis: don't unblock until this far
      const AHEAD_EXTRA = 2.5 // extra margin for same-path vehicle ahead

      let minD = 9999
      let bx = 0, bz = 0   // nearest blocker position

      const record = (ox, oz) => {
        const d = Math.hypot(s.x - ox, s.z - oz)
        if (d < minD) { minD = d; bx = ox; bz = oz }
      }

      // Player on foot
      record(px, pz)
      // Player vehicles (only when actively driven)
      if (carOn)  record(vehicleState.car.x,  vehicleState.car.z)
      if (bikeOn) record(vehicleState.bike.x, vehicleState.bike.z)

      // Other NPC vehicles
      for (let j = 0; j < _npcPos.length; j++) {
        const p = _npcPos[j]
        if (p === s.posEntry) continue
        const d = Math.hypot(s.x - p.x, s.z - p.z)
        if (d >= minD) continue

        // Give a larger gap to same-path vehicles directly ahead
        const aheadDot = (p.x - s.x) * Math.sin(s.facing) + (p.z - s.z) * Math.cos(s.facing)
        const threshold = (p.pathKey === cfg.path && aheadDot > 0) ? STOP + AHEAD_EXTRA : STOP

        if (d < threshold + (SLOW - STOP)) {
          minD = d; bx = p.x; bz = p.z
        }
      }

      // Parked decorative vehicles (only those not currently driven)
      for (let j = 0; j < parkedVehicles.length; j++) {
        const pv = parkedVehicles[j]
        if (pv.driverId !== null) continue
        record(pv.x, pv.z)
      }

      // ── Hysteresis block/unblock ─────────────────────────────────────────
      if (minD < STOP)   s.blocked = true
      else if (minD > RESUME) s.blocked = false

      // Head-on detection: if facing opposing NPC and very close, yield
      for (let j = 0; j < _npcPos.length; j++) {
        const p = _npcPos[j]
        if (p === s.posEntry) continue
        const d = Math.hypot(s.x - p.x, s.z - p.z)
        if (d < 6) {
          // dot of facing vectors < -0.7 means roughly head-on
          const dot = Math.sin(s.facing) * Math.sin(p.facing) + Math.cos(s.facing) * Math.cos(p.facing)
          if (dot < -0.7 && i > j) {
            // This vehicle (higher index) yields by advancing its waypoint
            s.wpIdx = (s.wpIdx + 1) % path.length
            s.blocked = true
          }
        }
      }

      // ── Steering bias when blocked ───────────────────────────────────────
      if (s.blocked && minD < STOP + 1) {
        // Cross-product sign: which side is the blocker on?
        const toBx = bx - s.x, toBz = bz - s.z
        const cross = toBx * Math.cos(s.facing) - toBz * Math.sin(s.facing)
        const desiredBias = cross > 0 ? -0.4 : 0.4   // steer away
        s.steerBias += (desiredBias - s.steerBias) * Math.min(1, delta * 3)
      } else {
        s.steerBias += (0 - s.steerBias) * Math.min(1, delta * 2)  // decay
      }

      const speedFrac = s.blocked ? 0
        : minD < SLOW ? (minD - STOP) / (SLOW - STOP)
        : 1
      s.speed += (cfg.speed * Math.max(0, speedFrac) - s.speed) * Math.min(1, delta * 4)

      // Apply steering bias only when moving
      if (Math.abs(s.speed) > 0.2) s.facing += s.steerBias * delta

      // ── Move ─────────────────────────────────────────────────────────────
      const step = Math.max(0, s.speed) * delta
      s.x += Math.sin(s.facing) * step
      s.z += Math.cos(s.facing) * step

      // Update shared position entry
      if (s.posEntry) {
        s.posEntry.x = s.x; s.posEntry.z = s.z; s.posEntry.facing = s.facing
      }

      // ── Stuck detection: < 2 units in 4 s → teleport forward ─────────────
      s.stuckTravel += Math.hypot(s.x - s.stuckX, s.z - s.stuckZ)
      s.stuckX = s.x; s.stuckZ = s.z
      s.stuckTimer += delta
      if (s.stuckTimer > 4) {
        if (s.stuckTravel < 2) {
          // Find next waypoint at least SAFE_SPAWN_DIST from current player position
          let nextIdx = (s.wpIdx + 1) % path.length
          for (let t = 0; t < path.length; t++) {
            if (Math.hypot(path[nextIdx][0] - px, path[nextIdx][1] - pz) >= SAFE_SPAWN_DIST) break
            nextIdx = (nextIdx + 1) % path.length
          }
          s.wpIdx = nextIdx
          s.x = path[s.wpIdx][0]; s.z = path[s.wpIdx][1]
          s.speed = 0; s.blocked = false; s.steerBias = 0
        }
        s.stuckTimer = 0; s.stuckTravel = 0
        s.stuckX = s.x; s.stuckZ = s.z
      }

      // ── Apply transform ──────────────────────────────────────────────────
      const grp = groups.current[i]
      if (grp) { grp.position.set(s.x, 0, s.z); grp.rotation.y = s.facing }

      const wR   = cfg.type === 'car' ? 0.37 : 0.38
      const spin = step / wR
      const wrs  = wArrs.current[i]
      for (let w = 0; w < wrs.length; w++) {
        if (wrs[w]) wrs[w].rotation.x -= spin
      }

      if (hls.current[i]) hls.current[i].visible = lampOn
    }
  })

  return (
    <>
      {NPC_VEHICLES.map((cfg, i) => (
        <group key={i} ref={el => { groups.current[i] = el }}>
          {cfg.type === 'car'
            ? <Car3D  bodyColor={cfg.color}  wheelRefs={wObjs.current[i]} />
            : <Bike3D frameColor={cfg.color} wheelRefs={wObjs.current[i]} leanRef={null} dustRef={null} />
          }
          <mesh
            ref={el => { hls.current[i] = el }}
            position={[0, 0.55, cfg.type === 'car' ? 1.95 : 0.95]}
            visible={false}
          >
            <sphereGeometry args={[0.22, 6, 4]} />
            <meshBasicMaterial color="#fffde7" />
          </mesh>
        </group>
      ))}
    </>
  )
}
