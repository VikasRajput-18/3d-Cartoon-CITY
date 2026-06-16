// Dedicated race circuit — a permanent, clearly-marked closed-loop ROAD that
// overlays the open ground north of the city. Dark asphalt surface with white
// edge lines, a yellow dashed centre line and big direction arrows; solid
// red/white striped box barriers on both edges (visible from every angle, sitting
// exactly on the collision boundary). Always present; the active-checkpoint glow
// + light beam only appear during a race.
//
// All materials + geometry are per-instance useMemo so React Three Fiber owns
// their disposal — WorldCanvas unmounts when entering a building, and module-
// level singletons passed via props would be disposed and corrupted on remount.
import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { minimapState } from '@/lib/minimapState'
import { onRaceUpdate, updateRaceFrame, tickAIRacers } from '@/lib/raceState'
import {
  CENTERLINE, CHECKPOINTS, START, GRID, ARROWS,
  TRACK_HALF_WIDTH, BARRIER_OFFSET, BARRIER_HEIGHT, BARRIER_THICK,
} from '@/lib/raceCircuit'

// ── Geometry builders (pure) ───────────────────────────────────────────────
function offsetPts(pts, off) {
  const n = pts.length
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n]
    let tx = next.x - prev.x, tz = next.z - prev.z
    const l = Math.hypot(tx, tz) || 1
    return { x: p.x + (-tz / l) * off, z: p.z + (tx / l) * off }
  })
}

// Flat ribbon along a closed polyline. Winding chosen so normals face UP
// (otherwise the surface is back-face-culled from the overhead camera and the
// green ground shows through — the "green track" bug).
function ribbonGeo(pts, halfW, y) {
  const n = pts.length
  const pos = new Float32Array(n * 2 * 3)
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n]
    let tx = next.x - prev.x, tz = next.z - prev.z
    const l = Math.hypot(tx, tz) || 1
    const px = -tz / l, pz = tx / l
    const L = i * 6, R = L + 3
    pos[L] = pts[i].x + px * halfW; pos[L + 1] = y; pos[L + 2] = pts[i].z + pz * halfW
    pos[R] = pts[i].x - px * halfW; pos[R + 1] = y; pos[R + 2] = pts[i].z - pz * halfW
  }
  const idx = []
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = ((i + 1) % n) * 2, d = c + 1
    idx.push(a, c, b, b, c, d)   // up-facing winding
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

// Dashed line: independent flat quads only for segments where includeFn(i) is true.
function dashedGeo(pts, halfW, y, includeFn) {
  const n = pts.length
  const verts = [], idx = []
  let vi = 0
  for (let i = 0; i < n; i++) {
    if (!includeFn(i)) continue
    const a = pts[i], b = pts[(i + 1) % n]
    let tx = b.x - a.x, tz = b.z - a.z
    const l = Math.hypot(tx, tz) || 1
    const px = -tz / l, pz = tx / l
    verts.push(
      a.x + px * halfW, y, a.z + pz * halfW,
      a.x - px * halfW, y, a.z - pz * halfW,
      b.x + px * halfW, y, b.z + pz * halfW,
      b.x - px * halfW, y, b.z - pz * halfW,
    )
    idx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3)   // up-facing
    vi += 4
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

// Solid 3D box barrier: a thick box per segment (alternating parity → stripes),
// merged into one geometry. Real thickness = visible from every angle.
function barrierGeo(polylines, parity) {
  const boxes = []
  for (const pts of polylines) {
    const n = pts.length
    for (let i = 0; i < n; i++) {
      if (i % 2 !== parity) continue
      const a = pts[i], b = pts[(i + 1) % n]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 1e-4) continue
      const g = new THREE.BoxGeometry(BARRIER_THICK, BARRIER_HEIGHT, len * 1.06)
      const m = new THREE.Matrix4().makeRotationY(Math.atan2(dx, dz))
      m.setPosition((a.x + b.x) / 2, BARRIER_HEIGHT / 2, (a.z + b.z) / 2)
      g.applyMatrix4(m)
      boxes.push(g)
    }
  }
  const merged = mergeGeometries(boxes, false)
  boxes.forEach(g => g.dispose())
  return merged
}

function arrowGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 1.7); s.lineTo(1.3, 0); s.lineTo(0.55, 0); s.lineTo(0.55, -1.6)
  s.lineTo(-0.55, -1.6); s.lineTo(-0.55, 0); s.lineTo(-1.3, 0); s.closePath()
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  return g
}

// ── Active-gate glow + light beam (only during a race) ───────────────────────
function ActiveGateFX({ gate }) {
  const ringRef = useRef()
  const beamRef = useRef()
  const ringGeo = useMemo(() => new THREE.TorusGeometry(TRACK_HALF_WIDTH - 0.5, 0.45, 10, 40), [])
  const beamGeo = useMemo(() => new THREE.CylinderGeometry(0.7, 0.7, 16, 14, 1, true), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.85 }), [])
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.2, side: THREE.DoubleSide }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ringRef.current) ringRef.current.material.opacity = 0.6 + Math.sin(t * 5) * 0.25
    if (beamRef.current) beamRef.current.material.opacity = 0.16 + Math.sin(t * 5) * 0.1
  })

  return (
    <group position={[gate.x, 0, gate.z]} rotation={[0, gate.yaw, 0]} userData={{ noMerge: true }}>
      <mesh ref={ringRef} position={[0, TRACK_HALF_WIDTH - 0.2, 0]} geometry={ringGeo} material={ringMat} />
      <mesh ref={beamRef} position={[0, 8, 0]} geometry={beamGeo} material={beamMat} />
    </group>
  )
}

// ── Gate arch (always visible) ──────────────────────────────────────────────
function GateArch({ gate, number, isStart, postMat, beamMat, startBeamMat }) {
  const halfSpan = TRACK_HALF_WIDTH + 0.9
  return (
    <group position={[gate.x, 0, gate.z]} rotation={[0, gate.yaw, 0]}>
      <mesh position={[ halfSpan, 2.6, 0]} material={postMat}><boxGeometry args={[0.5, 5.2, 0.5]} /></mesh>
      <mesh position={[-halfSpan, 2.6, 0]} material={postMat}><boxGeometry args={[0.5, 5.2, 0.5]} /></mesh>
      <mesh position={[0, 5.1, 0]} material={isStart ? startBeamMat : beamMat}>
        <boxGeometry args={[halfSpan * 2 + 0.5, 0.6, 0.5]} />
      </mesh>
      <Billboard position={[0, 6.0, 0]}>
        <Text fontSize={isStart ? 0.9 : 1.3} color={isStart ? '#fde047' : '#38bdf8'}
          anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#0f172a">
          {isStart ? 'START / FINISH' : String(number)}
        </Text>
      </Billboard>
    </group>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RaceCircuit() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [racing, setRacing]       = useState(false)
  const lastT    = useRef(performance.now())

  useEffect(() => onRaceUpdate(s => {
    const live = s.phase === 'racing' || s.phase === 'countdown'
    setRacing(live)
    setActiveIdx(live ? s.checkpointIndex : 0)
  }), [])

  // Per-instance geometry.
  const surfaceGeo = useMemo(() => ribbonGeo(CENTERLINE, TRACK_HALF_WIDTH, 0.04), [])
  const edgeLGeo   = useMemo(() => ribbonGeo(offsetPts(CENTERLINE,  (TRACK_HALF_WIDTH - 0.5)), 0.22, 0.06), [])
  const edgeRGeo   = useMemo(() => ribbonGeo(offsetPts(CENTERLINE, -(TRACK_HALF_WIDTH - 0.5)), 0.22, 0.06), [])
  const dashGeo    = useMemo(() => dashedGeo(CENTERLINE, 0.35, 0.07, i => Math.floor(i / 2) % 2 === 0), [])
  const barrierRed = useMemo(() => barrierGeo([offsetPts(CENTERLINE, BARRIER_OFFSET), offsetPts(CENTERLINE, -BARRIER_OFFSET)], 0), [])
  const barrierWht = useMemo(() => barrierGeo([offsetPts(CENTERLINE, BARRIER_OFFSET), offsetPts(CENTERLINE, -BARRIER_OFFSET)], 1), [])
  const arrowG     = useMemo(arrowGeo, [])

  // Per-instance materials.
  const mats = useMemo(() => ({
    asphalt:  new THREE.MeshToonMaterial({ color: '#2a2d34' }),
    edge:     new THREE.MeshBasicMaterial({ color: '#f1f5f9' }),
    dash:     new THREE.MeshBasicMaterial({ color: '#fbbf24' }),
    arrow:    new THREE.MeshBasicMaterial({ color: '#fde047' }),
    barrierR: new THREE.MeshToonMaterial({ color: '#ef4444' }),
    barrierW: new THREE.MeshToonMaterial({ color: '#f8fafc' }),
    post:     new THREE.MeshToonMaterial({ color: '#e2e8f0' }),
    beam:     new THREE.MeshToonMaterial({ color: '#7c3aed' }),
    grid:     new THREE.MeshBasicMaterial({ color: '#cbd5e1' }),
    checkW:   new THREE.MeshBasicMaterial({ color: '#f8fafc' }),
    checkB:   new THREE.MeshBasicMaterial({ color: '#0f172a' }),
  }), [])
  useEffect(() => () => { Object.values(mats).forEach(m => m.dispose()) }, [mats])

  useFrame(() => {
    const now = performance.now()
    const dt = Math.min((now - lastT.current) / 1000, 0.1)
    lastT.current = now
    if (racing) {
      updateRaceFrame(minimapState.playerX, minimapState.playerZ, dt)
      tickAIRacers(minimapState.playerX, minimapState.playerZ, dt)
    }
  })

  const activeGate = CHECKPOINTS[activeIdx] || START

  return (
    <group>
      {/* Track surface — dark asphalt (static, merged) */}
      <mesh geometry={surfaceGeo} material={mats.asphalt} />

      {/* White solid edge lines */}
      <mesh geometry={edgeLGeo} material={mats.edge} />
      <mesh geometry={edgeRGeo} material={mats.edge} />

      {/* Yellow dashed centre line */}
      <mesh geometry={dashGeo} material={mats.dash} />

      {/* Direction arrows painted on the surface */}
      {ARROWS.map((a, i) => (
        <mesh key={i} position={[a.x, 0.1, a.z]} rotation={[0, a.yaw, 0]} geometry={arrowG} material={mats.arrow} />
      ))}

      {/* Solid red/white striped barriers on both edges */}
      {barrierRed && <mesh geometry={barrierRed} material={mats.barrierR} />}
      {barrierWht && <mesh geometry={barrierWht} material={mats.barrierW} />}

      {/* Start/finish checkered line */}
      <group position={[START.x, 0.05, START.z]} rotation={[0, START.yaw, 0]}>
        {Array.from({ length: 14 }, (_, i) => {
          const seg = (TRACK_HALF_WIDTH * 2) / 14
          const lx = -TRACK_HALF_WIDTH + (i + 0.5) * seg
          return (
            <mesh key={i} position={[lx, 0, 0]} material={i % 2 === 0 ? mats.checkW : mats.checkB}>
              <boxGeometry args={[seg * 0.96, 0.06, 2.2]} />
            </mesh>
          )
        })}
      </group>

      {/* Starting grid slots */}
      {GRID.map((g, i) => (
        <mesh key={i} position={[g.x, 0.05, g.z]} rotation={[0, g.facing, 0]} material={mats.grid}>
          <boxGeometry args={[2.4, 0.04, 4.4]} />
        </mesh>
      ))}

      {/* Gate arches */}
      {CHECKPOINTS.map((g, i) => (
        <GateArch key={i} gate={g} number={i} isStart={i === 0}
          postMat={mats.post} beamMat={mats.beam} startBeamMat={mats.checkB} />
      ))}

      {/* Active gate glow + beam (only during a race) */}
      {racing && <ActiveGateFX gate={activeGate} />}
    </group>
  )
}
