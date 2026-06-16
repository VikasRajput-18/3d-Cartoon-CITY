// Personal house interior — walkable cozy bedroom + furniture decoration mode.
// First-person WASD + collision, E-to-interact furniture.
// Press the "Decorate" button to enter top-down edit mode: pick from catalog,
// click floor to place, R to rotate, click placed item to select/delete.

import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import { getHouseState, canRest, canSleep, doRest, doSleep } from '@/lib/houseService'
import {
  getDesign, onDesignUpdate,
  addFurnitureItem, removeFurnitureItem,
} from '@/lib/houseDesignService'
import { getCatalogItem, FURNITURE_ITEMS, FURNITURE_CATEGORIES } from '@/lib/furnitureCatalog'
import FurniturePiece from './FurniturePiece'

// ── Room dimensions ───────────────────────────────────────────────────────────
const HW = 6
const HD = 6
const WALL_H = 3.2
const PLAYER_R = 0.45

// ── Static furniture colliders ────────────────────────────────────────────────
const COLLIDERS = [
  { minX: -5.8, maxX: -3.2, minZ: -5.8, maxZ: -3.0 },
  { minX:  1.7, maxX:  4.3, minZ: -5.8, maxZ: -4.5 },
  { minX: -5.9, maxX: -4.6, minZ: -0.8, maxZ:  1.8 },
  { minX:  4.5, maxX:  5.9, minZ: -1.9, maxZ:  1.9 },
  { minX: -4.6, maxX: -1.4, minZ:  4.6, maxZ:  5.8 },
  { minX:  4.7, maxX:  5.8, minZ:  4.7, maxZ:  5.8 },
]

const INTERACTABLES = [
  { id: 'bed',      pos: [-4.5, -3.0], label: 'rest / sleep',  emoji: '🛏️' },
  { id: 'desk',     pos: [ 3.0, -4.3], label: 'check stats',   emoji: '💻' },
  { id: 'wardrobe', pos: [-4.4,  0.5], label: 'open wardrobe', emoji: '👕' },
  { id: 'tv',       pos: [-3.0,  4.3], label: 'watch TV',      emoji: '📺' },
  { id: 'door',     pos: [ 3.6,  4.9], label: 'exit to city',  emoji: '🚪' },
]
const INTERACT_RANGE = 1.7

// Snap placed items to 0.25-unit grid for tidy alignment
const SNAP = 0.25
function snap(v) { return Math.round(v / SNAP) * SNAP }

// ── Primitive helpers (shared) ────────────────────────────────────────────────
function Box({ pos, w = 1, h = 1, d = 1, color = '#334155', rot = 0 }) {
  return (
    <mesh position={[pos[0], pos[1] + h / 2, pos[2]]} rotation={[0, rot, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

// ── Static furniture ──────────────────────────────────────────────────────────
function Bed() {
  return (
    <group position={[-4.5, 0, -4.3]}>
      <Box pos={[0,0,0]} w={2.2} h={0.45} d={2.6} color="#8d6e63" />
      <Box pos={[0,0.45,0]} w={2.0} h={0.22} d={2.4} color="#fef3c7" />
      <Box pos={[0,0.55,0.5]} w={1.9} h={0.14} d={1.4} color="#60a5fa" />
      <Box pos={[0,0.62,-0.85]} w={1.5} h={0.26} d={0.6} color="#f8fafc" />
      <Box pos={[0,0.55,-1.25]} w={2.2} h={1.0} d={0.14} color="#a1887f" />
    </group>
  )
}
function Desk() {
  return (
    <group position={[3.0, 0, -5.1]}>
      <Box pos={[0,0.72,0]} w={2.4} h={0.08} d={1.0} color="#92400e" />
      {[[-1.05,-0.4],[1.05,-0.4],[-1.05,0.4],[1.05,0.4]].map(([x,z],i)=>(
        <Box key={i} pos={[x,0,z]} w={0.1} h={0.72} d={0.1} color="#7c4a1e" />
      ))}
      <Box pos={[-0.05,0.8,-0.25]} w={1.1} h={0.66} d={0.06} color="#1f2937" />
      <mesh position={[-0.05,1.13,-0.21]}><planeGeometry args={[0.95,0.5]} /><meshBasicMaterial color="#38bdf8" /></mesh>
      <Box pos={[-0.05,0.78,-0.05]} w={0.5} h={0.04} d={0.18} color="#0f172a" />
    </group>
  )
}
function Wardrobe() {
  return (
    <group position={[-5.4, 0, 0.5]}>
      <Box pos={[0,0,0]} w={1.1} h={2.4} d={2.4} color="#6d4c2f" />
      <Box pos={[0.55,1.2,-0.55]} w={0.06} h={2.2} d={1.0} color="#5a3d24" />
      <Box pos={[0.55,1.2, 0.55]} w={0.06} h={2.2} d={1.0} color="#5a3d24" />
      <mesh position={[0.58,1.2,-0.55]}><sphereGeometry args={[0.05,8,8]} /><meshToonMaterial color="#fbbf24" /></mesh>
      <mesh position={[0.58,1.2, 0.55]}><sphereGeometry args={[0.05,8,8]} /><meshToonMaterial color="#fbbf24" /></mesh>
    </group>
  )
}
function Couch() {
  return (
    <group position={[5.2,0,0]} rotation={[0,-Math.PI/2,0]}>
      <Box pos={[0,0,0]} w={2.8} h={0.5} d={1.0} color="#7c3aed" />
      <Box pos={[0,0.5,-0.42]} w={2.8} h={0.7} d={0.2} color="#8b5cf6" />
      <Box pos={[-1.3,0.4,0]} w={0.2} h={0.6} d={1.0} color="#8b5cf6" />
      <Box pos={[ 1.3,0.4,0]} w={0.2} h={0.6} d={1.0} color="#8b5cf6" />
    </group>
  )
}
function TVStand() {
  return (
    <group position={[-3.0,0,5.2]}>
      <Box pos={[0,0.25,0]} w={2.8} h={0.5} d={0.7} color="#3f3f46" />
      <Box pos={[0,1.35,-0.1]} w={2.2} h={1.3} d={0.12} color="#0a0a0a" />
      <mesh position={[0,1.35,-0.03]}><planeGeometry args={[2.0,1.1]} /><meshBasicMaterial color="#1e3a8a" /></mesh>
    </group>
  )
}
function Plant({ pos }) {
  return (
    <group position={pos}>
      <mesh position={[0,0.3,0]}><cylinderGeometry args={[0.28,0.22,0.6,10]} /><meshToonMaterial color="#b45309" /></mesh>
      <mesh position={[0,0.95,0]}><sphereGeometry args={[0.5,10,10]} /><meshToonMaterial color="#16a34a" /></mesh>
      <mesh position={[0.2,1.25,0.1]}><sphereGeometry args={[0.32,8,8]} /><meshToonMaterial color="#22c55e" /></mesh>
    </group>
  )
}
function Rug() {
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0.5]}>
      <circleGeometry args={[2.6,28]} />
      <meshToonMaterial color="#dc2626" />
    </mesh>
  )
}
function Door() {
  return (
    <group position={[3.6,0,5.94]}>
      <Box pos={[0,0,0]} w={1.3} h={2.5} d={0.12} color="#92400e" />
      <mesh position={[0.45,1.25,0.1]}><sphereGeometry args={[0.07,10,10]} /><meshToonMaterial color="#fbbf24" /></mesh>
    </group>
  )
}
function WallDecor() {
  return (
    <>
      <group position={[-1.5,2.3,-5.92]}>
        <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.4,0.4,0.08,20]} /><meshToonMaterial color="#f8fafc" /></mesh>
        <mesh position={[0,0,0.05]}><circleGeometry args={[0.36,20]} /><meshBasicMaterial color="#1e293b" /></mesh>
        <Box pos={[0,0,0.06]} w={0.04} h={0.24} d={0.01} color="#f8fafc" />
        <Box pos={[0.1,-0.05,0.06]} w={0.18} h={0.04} d={0.01} color="#fbbf24" />
      </group>
      <mesh position={[5.94,2.0,-3.5]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[1.3,1.7]} /><meshBasicMaterial color="#ec4899" /></mesh>
      <mesh position={[5.94,2.0, 3.5]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[1.3,1.7]} /><meshBasicMaterial color="#0ea5e9" /></mesh>
      <group position={[-5.9,2.2,3.0]}>
        <Box pos={[0,0,0]} w={0.4} h={0.08} d={2.0} color="#7c4a1e" />
        {[-0.7,-0.4,-0.1,0.3,0.7].map((z,i)=>(
          <Box key={i} pos={[0,0.28,z]} w={0.25} h={0.5} d={0.16} color={['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7'][i]} />
        ))}
      </group>
    </>
  )
}

// ── Room shell ────────────────────────────────────────────────────────────────
function RoomShell({ floorColor, wallColor }) {
  return (
    <>
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[HW*2,HD*2]} />
        <meshToonMaterial color={floorColor} />
      </mesh>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,WALL_H,0]}>
        <planeGeometry args={[HW*2,HD*2]} />
        <meshToonMaterial color="#fdf6ec" />
      </mesh>
      <mesh position={[0,WALL_H/2,-HD]}><planeGeometry args={[HW*2,WALL_H]} /><meshToonMaterial color={wallColor} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0,WALL_H/2, HD]} rotation={[0,Math.PI,0]}><planeGeometry args={[HW*2,WALL_H]} /><meshToonMaterial color={wallColor} side={THREE.DoubleSide} /></mesh>
      <mesh position={[-HW,WALL_H/2,0]} rotation={[0, Math.PI/2,0]}><planeGeometry args={[HD*2,WALL_H]} /><meshToonMaterial color={wallColor} side={THREE.DoubleSide} /></mesh>
      <mesh position={[ HW,WALL_H/2,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[HD*2,WALL_H]} /><meshToonMaterial color={wallColor} side={THREE.DoubleSide} /></mesh>
      <group position={[2.0,1.9,-5.93]}>
        <Box pos={[0,0,0]} w={2.6} h={1.9} d={0.1} color="#e2e8f0" />
        <mesh position={[0,0,0.06]}><planeGeometry args={[2.3,1.6]} /><meshBasicMaterial color="#ffd9a0" /></mesh>
        {[[-0.8,0.4,0.5],[-0.3,0.6,0.7],[0.2,0.3,0.4],[0.7,0.55,0.6]].map(([x,w,h],i)=>(
          <mesh key={i} position={[x,-0.8+h/2,0.07]}><planeGeometry args={[w,h]} /><meshBasicMaterial color="#b45f8f" /></mesh>
        ))}
        <mesh position={[-0.7,0.4,0.07]}><circleGeometry args={[0.22,18]} /><meshBasicMaterial color="#fff3c4" /></mesh>
        <Box pos={[0,0,0.08]} w={0.06} h={1.6} d={0.02} color="#cbd5e1" />
        <Box pos={[0,0,0.08]} w={2.3} h={0.06} d={0.02} color="#cbd5e1" />
      </group>
    </>
  )
}

// ── Lighting ──────────────────────────────────────────────────────────────────
function RoomLights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#fff1dd" />
      <pointLight position={[0,WALL_H-0.2,0]} intensity={1.3} distance={20} color="#ffe8c2" />
      <pointLight position={[-3,1.6,-3]} intensity={0.5} distance={9} color="#ffd9a0" />
      <hemisphereLight args={['#fff4e0','#5b4636',0.4]} />
    </>
  )
}

// ── Walker ────────────────────────────────────────────────────────────────────
function collides(px, pz) {
  for (const c of COLLIDERS) {
    if (px > c.minX-PLAYER_R && px < c.maxX+PLAYER_R && pz > c.minZ-PLAYER_R && pz < c.maxZ+PLAYER_R) return true
  }
  return false
}

function Walker({ onNear, locked }) {
  const { camera } = useThree()
  const pos   = useRef({ x: 0, z: 3.2 })
  const yaw   = useRef(0)
  const pitch = useRef(-0.05)
  const keys  = useRef({})
  const nearRef = useRef(null)

  useEffect(() => {
    camera.position.set(pos.current.x, 1.6, pos.current.z)
    camera.fov = 70; camera.near = 0.1; camera.far = 100; camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    const down = (e) => { keys.current[e.code] = true }
    const up   = (e) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!document.pointerLockElement) return
      yaw.current  -= e.movementX * 0.0022
      pitch.current = Math.max(-0.8, Math.min(0.55, pitch.current - e.movementY * 0.0022))
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const speed = 3.4 * dt
    const fX = -Math.sin(yaw.current), fZ = -Math.cos(yaw.current)
    const rX =  Math.cos(yaw.current), rZ = -Math.sin(yaw.current)
    let dx = 0, dz = 0
    const k = keys.current
    if (!locked) {
      if (k['KeyW'] || k['ArrowUp'])    { dx += fX; dz += fZ }
      if (k['KeyS'] || k['ArrowDown'])  { dx -= fX; dz -= fZ }
      if (k['KeyD'] || k['ArrowRight']) { dx += rX; dz += rZ }
      if (k['KeyA'] || k['ArrowLeft'])  { dx -= rX; dz -= rZ }
    }
    const len = Math.hypot(dx, dz)
    if (len > 0) {
      dx = (dx/len)*speed; dz = (dz/len)*speed
      const lim = HW-PLAYER_R-0.15
      const nx = THREE.MathUtils.clamp(pos.current.x+dx,-lim,lim)
      if (!collides(nx, pos.current.z)) pos.current.x = nx
      const nz = THREE.MathUtils.clamp(pos.current.z+dz,-lim,lim)
      if (!collides(pos.current.x, nz)) pos.current.z = nz
    }
    camera.position.set(pos.current.x, 1.6, pos.current.z)
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    let best = null, bestD = INTERACT_RANGE
    for (const it of INTERACTABLES) {
      const d = Math.hypot(it.pos[0]-pos.current.x, it.pos[1]-pos.current.z)
      if (d < bestD) { bestD = d; best = it }
    }
    if ((best?.id||null) !== nearRef.current) {
      nearRef.current = best?.id||null
      onNear(best||null)
    }
  })
  return null
}

// ── Decorate mode: camera + floor hit-plane ───────────────────────────────────
function DecorateCamera() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 14, 0)
    camera.rotation.set(-Math.PI/2, 0, 0, 'YXZ')
    camera.fov = 62
    camera.near = 0.1
    camera.far = 100
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function DecorateFloor({ onMove, onFloorClick }) {
  return (
    <mesh
      rotation={[-Math.PI/2, 0, 0]}
      position={[0, 0.006, 0]}
      onPointerMove={e => { e.stopPropagation(); onMove(snap(e.point.x), snap(e.point.z)) }}
      onClick={e => { e.stopPropagation(); onFloorClick() }}
    >
      <planeGeometry args={[HW*2, HD*2]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}

// ── Status / overlay widgets ──────────────────────────────────────────────────
function StatusBar({ resting, restSec, sleeping, sleepSec, watching, watchSec }) {
  if (!resting && !sleeping && !watching) return null
  const label = sleeping ? '🌙 Sleeping…' : watching ? '📺 Watching TV…' : '😌 Resting…'
  const secs  = sleeping ? sleepSec : watching ? watchSec : restSec
  const color = sleeping ? '#8b5cf6' : watching ? '#0ea5e9' : '#6366f1'
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] text-center pointer-events-none font-body">
      <div className="rounded-2xl text-white font-extrabold text-xl"
        style={{ background:`${color}cc`, padding:'18px 36px', boxShadow:`0 0 40px ${color}66` }}>
        {label}
        <div className="text-[14px] font-normal mt-1 opacity-80">{secs}s remaining</div>
      </div>
    </div>
  )
}

// ── Catalog panel (shown during decorate mode) ────────────────────────────────
function CatalogPanel({ onSelect, selectedCatalogId, placedCount, onDone }) {
  const [cat, setCat] = useState(FURNITURE_CATEGORIES[0])
  const items = FURNITURE_ITEMS.filter(it => it.category === cat)

  return (
    <div className="fixed top-0 right-0 h-full z-[700] flex flex-col font-body"
      style={{ width: 240, background: 'rgba(8,4,20,0.97)', borderLeft: '1px solid rgba(124,58,237,0.3)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-violet-400 font-extrabold text-[14px]">🎨 Decorate Mode</div>
        <div className="text-slate-500 text-[10px] mt-0.5">
          {placedCount} custom item{placedCount !== 1 ? 's' : ''} placed
        </div>
        <div className="text-slate-600 text-[10px] mt-0.5">R = rotate · Del = remove · Esc = cancel</div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {FURNITURE_CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="text-[10px] font-bold rounded-full px-2 py-0.5 cursor-pointer border-0 font-body"
            style={{
              background: cat === c ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)',
              color: cat === c ? '#c4b5fd' : '#64748b',
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {items.map(it => (
          <button key={it.id} onClick={() => onSelect(it)}
            className="w-full flex items-center gap-2 rounded-lg mb-1 text-left cursor-pointer border-0 font-body"
            style={{
              padding: '7px 9px',
              background: selectedCatalogId === it.id
                ? 'rgba(124,58,237,0.35)'
                : 'rgba(255,255,255,0.04)',
              border: selectedCatalogId === it.id
                ? '1px solid rgba(124,58,237,0.6)'
                : '1px solid rgba(255,255,255,0.05)',
            }}>
            <span style={{ fontSize: 18 }}>{it.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 text-[11px] font-semibold truncate">{it.label}</div>
              <div className="text-yellow-500 text-[10px]">🪙 {it.price}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Done */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onDone}
          className="w-full py-[9px] rounded-xl font-bold text-[13px] cursor-pointer border-0 font-body"
          style={{ background: 'rgba(124,58,237,0.7)', color: '#fff' }}>
          Done Decorating ✓
        </button>
      </div>
    </div>
  )
}

// ── Selected item action bar ──────────────────────────────────────────────────
function SelectedItemBar({ item, onDelete, onDeselect }) {
  if (!item) return null
  return (
    <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-[700] pointer-events-auto font-body">
      <div className="flex items-center gap-2 rounded-xl px-4 py-2"
        style={{ background: 'rgba(8,4,20,0.95)', border: '1px solid rgba(251,191,36,0.4)' }}>
        <span style={{ fontSize: 18 }}>{item.emoji}</span>
        <span className="text-slate-200 text-[12px] font-semibold">{item.label}</span>
        <button onClick={onDelete}
          className="rounded-lg text-[11px] font-bold cursor-pointer border-0 font-body"
          style={{ background: 'rgba(239,68,68,0.6)', color: '#fff', padding: '3px 10px' }}>
          Remove
        </button>
        <button onClick={onDeselect}
          className="rounded-lg text-[11px] font-bold cursor-pointer border-0 font-body"
          style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '3px 10px' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HouseInterior({ onExit, initialAction = null }) {
  const hs = getHouseState()
  const { level, levelName } = hs

  // ── walk / activity state ────────────────────────────────────────────────────
  const [resting,  setResting]  = useState(false)
  const [restSec,  setRestSec]  = useState(30)
  const [sleeping, setSleeping] = useState(false)
  const [sleepSec, setSleepSec] = useState(60)
  const [watching, setWatching] = useState(false)
  const [watchSec, setWatchSec] = useState(20)
  const [dimmed,   setDimmed]   = useState(false)
  const [fadeIn,   setFadeIn]   = useState(true)
  const [morning,  setMorning]  = useState(null)
  const [locked,   setLocked]   = useState(false)
  const [near,     setNear]     = useState(null)

  // ── decorate mode state ──────────────────────────────────────────────────────
  const [decorateMode,     setDecorateMode]     = useState(false)
  const [placedItems,      setPlacedItems]      = useState(() => getDesign())
  const [ghostItem,        setGhostItem]        = useState(null)   // catalog item object or null
  const [ghostPos,         setGhostPos]         = useState({ x: 0, z: 0 })
  const [ghostRot,         setGhostRot]         = useState(0)
  const [selectedPlacedId, setSelectedPlacedId] = useState(null)  // id of placed item

  const lockedRef = useRef(false)
  useEffect(() => { lockedRef.current = locked }, [locked])
  const nearRef = useRef(null)
  useEffect(() => { nearRef.current = near }, [near])

  // Keep placed items in sync with service
  useEffect(() => onDesignUpdate(setPlacedItems), [])

  // Floor / wall colors per house level
  const floorColor = ['#b5814f','#a9743f','#9c6a3a','#8d6334','#7e552c','#6f4a26','#5e3e20'][level-1] || '#b5814f'
  const wallColor  = ['#f6e7d2','#f3e3d8','#efe0dc','#f1e6e0','#efe9dc','#ece6dd','#e7e2d8'][level-1] || '#f6e7d2'

  // Take over game controls while room is open
  useEffect(() => {
    const prev = gameControls.enabled
    gameControls.enabled = false
    return () => { gameControls.enabled = prev }
  }, [])

  // Fade in + optional auto-action
  useEffect(() => {
    const t = setTimeout(() => setFadeIn(false), 600)
    if (initialAction === 'rest')  startRest()
    if (initialAction === 'sleep') startSleep()
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Normal mode: E to interact, Esc/Q to exit
  useEffect(() => {
    if (decorateMode) return
    const onKey = (e) => {
      if (lockedRef.current) return
      if (e.code === 'Escape' || e.code === 'KeyQ') { onExit?.(); return }
      if (e.code === 'KeyE') {
        const id = nearRef.current?.id
        if      (id === 'bed')      startSleep()
        else if (id === 'door')     onExit?.()
        else if (id === 'wardrobe') window.dispatchEvent(new CustomEvent('open-wardrobe'))
        else if (id === 'desk')     window.dispatchEvent(new CustomEvent('open-profile'))
        else if (id === 'tv')       startWatch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, decorateMode])

  // Decorate mode: R = rotate ghost, Esc = cancel / exit, Delete = remove selected
  useEffect(() => {
    if (!decorateMode) return
    const onKey = (e) => {
      if (e.code === 'KeyR') {
        setGhostRot(r => r + Math.PI / 2)
      } else if (e.code === 'Escape') {
        if (ghostItem) { setGhostItem(null); return }
        exitDecorateMode()
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedPlacedId) {
          removeFurnitureItem(selectedPlacedId)
          setSelectedPlacedId(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decorateMode, ghostItem, selectedPlacedId])

  function enterDecorateMode() {
    document.exitPointerLock?.()
    setDecorateMode(true)
    setGhostItem(null)
    setSelectedPlacedId(null)
  }

  function exitDecorateMode() {
    setDecorateMode(false)
    setGhostItem(null)
    setSelectedPlacedId(null)
  }

  function handleFloorClick() {
    if (ghostItem) {
      addFurnitureItem(ghostItem.id, ghostPos.x, ghostPos.z, ghostRot)
      // keep ghost active so player can place multiple
    } else {
      setSelectedPlacedId(null)
    }
  }

  // ── Activity helpers ─────────────────────────────────────────────────────────
  function startRest() {
    if (!canRest() || resting || sleeping || watching) return
    setResting(true); setRestSec(30); setLocked(true)
    const iv = setInterval(() => {
      setRestSec(s => {
        if (s <= 1) {
          clearInterval(iv); setResting(false); setLocked(false); doRest()
          window.dispatchEvent(new CustomEvent('stats-boost', { detail: { amount: 20 } }))
          return 30
        }
        return s - 1
      })
    }, 1000)
  }

  function startSleep() {
    if (!canSleep() || resting || sleeping || watching) return
    setSleeping(true); setSleepSec(60); setLocked(true); setDimmed(true)
    const now = new Date()
    setMorning(`Good morning! It's ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
    const iv = setInterval(() => {
      setSleepSec(s => {
        if (s <= 1) {
          clearInterval(iv); setSleeping(false); setLocked(false); setDimmed(false); doSleep()
          window.dispatchEvent(new CustomEvent('stats-boost', { detail: { amount: 100, full: true } }))
          return 60
        }
        return s - 1
      })
    }, 1000)
  }

  function startWatch() {
    if (resting || sleeping || watching) return
    setWatching(true); setWatchSec(20); setLocked(true)
    const iv = setInterval(() => {
      setWatchSec(s => {
        if (s <= 1) {
          clearInterval(iv); setWatching(false); setLocked(false)
          window.dispatchEvent(new CustomEvent('stats-boost', { detail: { amount: 15 } }))
          return 20
        }
        return s - 1
      })
    }, 1000)
  }

  // Selected placed item's catalog info (for action bar)
  const selectedCatalogItem = selectedPlacedId
    ? getCatalogItem(placedItems.find(it => it.id === selectedPlacedId)?.catalogId ?? '')
    : null

  return (
    <div className="fixed inset-0 z-[400]">
      {/* Fade in */}
      {fadeIn && (
        <div className="fixed inset-0 z-[900] bg-black pointer-events-none"
          style={{ opacity: 1, transition: 'opacity 0.6s' }} />
      )}

      {/* Sleep dim */}
      {dimmed && (
        <div className="fixed inset-0 z-[600] bg-black pointer-events-none" style={{ opacity: 0.7 }}>
          {[...Array(20)].map((_,i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width:2, height:2, left:`${5+i*4.5}%`, top:`${10+(i%5)*15}%`,
                opacity: 0.4+Math.sin(i)*0.4, animation:`pulse ${1+i*0.1}s infinite` }} />
          ))}
        </div>
      )}

      {/* Morning message */}
      {morning && !sleeping && (
        <div className="fixed top-[30%] left-1/2 -translate-x-1/2 z-[700] text-center font-body">
          <div className="text-yellow-300 font-extrabold text-2xl" style={{ textShadow:'0 0 20px #fbbf24' }}>
            ☀️ {morning}
          </div>
        </div>
      )}

      <StatusBar resting={resting} restSec={restSec} sleeping={sleeping} sleepSec={sleepSec} watching={watching} watchSec={watchSec} />

      {/* Normal mode: interact prompt */}
      {!decorateMode && near && !locked && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[700] text-center pointer-events-none font-body"
          style={{ bottom: '16%' }}>
          <div className="inline-flex items-center gap-2 rounded-full text-white font-bold text-[15px]"
            style={{ background:'rgba(10,6,24,0.9)', border:'1.5px solid rgba(245,201,76,0.7)', padding:'9px 18px' }}>
            <span style={{ fontSize:20 }}>{near.emoji}</span>
            Press <span className="text-amber-300 font-extrabold">E</span> to {near.label}
          </div>
        </div>
      )}

      {/* Decorate mode: ghost placement hint */}
      {decorateMode && ghostItem && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[700] text-center pointer-events-none font-body"
          style={{ bottom: '16%' }}>
          <div className="inline-flex items-center gap-2 rounded-full text-white font-bold text-[14px]"
            style={{ background:'rgba(10,6,24,0.9)', border:'1.5px solid rgba(124,58,237,0.7)', padding:'8px 16px' }}>
            <span style={{ fontSize:18 }}>{ghostItem.emoji}</span>
            Click to place <span className="text-violet-300 font-extrabold mx-1">·</span>
            <span className="text-amber-300 font-extrabold">R</span> rotate <span className="text-violet-300 font-extrabold mx-1">·</span>
            <span className="text-slate-400 font-extrabold">Esc</span> cancel
          </div>
        </div>
      )}

      {/* Decorate mode: selected item bar */}
      {decorateMode && selectedCatalogItem && (
        <SelectedItemBar
          item={selectedCatalogItem}
          onDelete={() => { removeFurnitureItem(selectedPlacedId); setSelectedPlacedId(null) }}
          onDeselect={() => setSelectedPlacedId(null)}
        />
      )}

      {/* 3D scene */}
      <Canvas
        camera={{ position:[0,1.6,3.2], fov:70, near:0.1, far:100 }}
        gl={{ antialias:true }}
        onClick={e => !decorateMode && e.currentTarget.requestPointerLock?.()}
        style={{ cursor: decorateMode ? (ghostItem ? 'crosshair' : 'default') : 'none' }}
      >
        <RoomLights />
        <RoomShell floorColor={floorColor} wallColor={wallColor} />
        <Rug />
        <Bed />
        <Desk />
        <Wardrobe />
        <Couch />
        <TVStand />
        <Door />
        <Plant pos={[5.25,0,5.25]} />
        <Plant pos={[-5.4,0,-5.4]} />
        <WallDecor />

        {/* Placed custom items */}
        {placedItems.map(it => {
          const def = getCatalogItem(it.catalogId)
          if (!def) return null
          return (
            <FurniturePiece
              key={it.id}
              item={def}
              x={it.x}
              z={it.z}
              rot={it.rot}
              selected={it.id === selectedPlacedId}
              onClick={decorateMode && !ghostItem ? (e) => {
                e.stopPropagation()
                setSelectedPlacedId(prev => prev === it.id ? null : it.id)
              } : undefined}
            />
          )
        })}

        {/* Ghost preview */}
        {decorateMode && ghostItem && (
          <FurniturePiece
            item={ghostItem}
            x={ghostPos.x}
            z={ghostPos.z}
            rot={ghostRot}
            ghost
          />
        )}

        {/* Decorate mode camera + invisible floor for pointer events */}
        {decorateMode ? (
          <>
            <DecorateCamera />
            <DecorateFloor
              onMove={(x, z) => setGhostPos({ x, z })}
              onFloorClick={handleFloorClick}
            />
          </>
        ) : (
          <Walker onNear={setNear} locked={locked} />
        )}
      </Canvas>

      {/* Catalog panel (decorate mode only) */}
      {decorateMode && (
        <CatalogPanel
          selectedCatalogId={ghostItem?.id ?? null}
          placedCount={placedItems.length}
          onSelect={it => { setGhostItem(it); setGhostRot(0); setSelectedPlacedId(null) }}
          onDone={exitDecorateMode}
        />
      )}

      {/* HUD bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[500] flex items-center justify-between font-body"
        style={{
          padding: '0 20px',
          paddingRight: decorateMode ? 260 : 20,
          height: 56,
          background: 'rgba(8,4,20,0.9)',
          borderTop: '1px solid rgba(124,58,237,0.3)',
        }}>
        <div>
          <div className="text-violet-400 font-bold text-[13px]">🏠 {levelName}</div>
          <div className="text-slate-500 text-[10px]">
            {decorateMode ? 'Top-down view — pick from catalog →' : 'WASD walk · click look · E interact · Q/Esc exit'}
          </div>
        </div>
        <div className="flex gap-2">
          {!decorateMode && <>
            <button onClick={startRest} disabled={resting||sleeping||watching||!canRest()}
              className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
              style={{ background:'rgba(99,102,241,0.6)', color:'#fff', padding:'6px 14px' }}>😌 Rest</button>
            <button onClick={startSleep} disabled={resting||sleeping||watching||!canSleep()}
              className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
              style={{ background:'rgba(139,92,246,0.6)', color:'#fff', padding:'6px 14px' }}>🌙 Sleep</button>
          </>}
          <button onClick={decorateMode ? exitDecorateMode : enterDecorateMode}
            disabled={locked}
            className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
            style={{
              background: decorateMode ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.1)',
              color: decorateMode ? '#fff' : '#94a3b8',
              padding: '6px 14px',
            }}>
            {decorateMode ? '✓ Done' : '🎨 Decorate'}
          </button>
          {!decorateMode && (
            <button onClick={() => !locked && onExit?.()} disabled={locked}
              className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
              style={{ background:'rgba(255,255,255,0.1)', color:'#94a3b8', padding:'6px 14px' }}>Exit ↩</button>
          )}
        </div>
      </div>
    </div>
  )
}
