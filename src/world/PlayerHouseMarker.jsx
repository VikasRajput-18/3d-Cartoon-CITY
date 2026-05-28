// Renders the local player's house AND all other players' houses in the 3D world.
import { useEffect, useState, useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getHouseState, onHouseUpdate, fetchAllHouses } from '@/lib/houseService'
import { useStore } from '@/store'

// ── Status → wall color ────────────────────────────────────────────────────────
const WALL_COLORS_BY_LEVEL = [
  '#3b82f6', '#10b981', '#8b5cf6',
  '#ec4899', '#f97316', '#eab308', '#06b6d4',
]
const EVICTED_COLOR = '#4b5563'
const WARN_COLOR    = '#f97316'
const EVWARN_COLOR  = '#ef4444'

function wallColor(level, status) {
  if (status === 'evicted')           return EVICTED_COLOR
  if (status === 'eviction-warning')  return EVWARN_COLOR
  if (status === 'warning')           return WARN_COLOR
  return WALL_COLORS_BY_LEVEL[(level - 1) % 7]
}

// ── Roof color by level ────────────────────────────────────────────────────────
const ROOF_COLORS = ['#1e3a5f','#064e3b','#4c1d95','#831843','#7c2d12','#713f12','#0c4a6e']

// ── House mesh geometry by level ───────────────────────────────────────────────
// Each level returns a group of Three.js meshes added to a parent group
function buildHouseMesh(level, wColor, rColor) {
  const group = new THREE.Group()
  const toon  = c => new THREE.MeshToonMaterial({ color: c })
  const box   = (w, h, d, c, [px,py,pz]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(c))
    m.position.set(px, py, pz)
    group.add(m)
  }

  // Foundation slab
  const [fw, fd] = level <= 3 ? [level*1.5+2, level*1.5+2] : [level*1.2+3, level*1.2+3]
  box(fw+0.8, 0.24, fd+0.8, '#9ca3af', [0, 0.12, 0])

  // Main body dimensions
  const w = [3,4,5,5.5,6.5,8,7][level-1]
  const d = w
  const h = [2.8,3.5,4,4.5,5,6,14][level-1]   // L7 is a tall tower

  box(w, h, d, wColor, [0, h/2, 0])

  // Roof
  const rh = level >= 7 ? 0.5 : h * 0.55
  const rb = level >= 7 ? w * 1.02 : w * 0.78
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(rb * (level >= 7 ? 0.5 : 0.85), rh, level >= 7 ? 4 : 4),
    toon(rColor)
  )
  if (level >= 7) {
    // Flat roof cap for penthouse
    cone.geometry = new THREE.BoxGeometry(w+0.5, 0.35, d+0.5)
    cone.position.set(0, h + 0.175, 0)
  } else {
    cone.position.set(0, h + rh/2, 0)
  }
  group.add(cone)

  // Door
  box(0.65, 1.2, 0.05, '#78350f', [0, 0.7, d/2+0.02])

  // Front windows (count scales with level)
  const winCount = Math.min(level + 1, 4)
  for (let i = 0; i < winCount; i++) {
    const wx = (i - (winCount-1)/2) * (w / (winCount+0.5))
    if (Math.abs(wx) > w*0.3) box(0.55, 0.45, 0.05, '#bfdbfe', [wx, h*0.58, d/2+0.02])
  }

  // Level 2+: window on side
  if (level >= 2) box(0.55, 0.45, 0.05, '#bfdbfe', [w/2+0.02, h*0.58, 0])

  // Level 3+: fence segments
  if (level >= 3) {
    const fenceW = w + 2
    for (let i = -2; i <= 2; i++) {
      box(0.12, 0.8, 0.12, '#d1d5db', [i * (fenceW/4), 0.4, d/2+1.2])
    }
    box(fenceW+0.12, 0.08, 0.08, '#d1d5db', [0, 0.8, d/2+1.2])
  }

  // Level 4+: balcony on second floor
  if (level >= 4) {
    box(w-0.4, 0.12, 1.2, '#e2e8f0', [0, h*0.55, d/2+0.6])
    box(0.08, 0.8, 1.2, '#9ca3af', [-w/2+0.2, h*0.55+0.4, d/2+0.6])
    box(0.08, 0.8, 1.2, '#9ca3af', [ w/2-0.2, h*0.55+0.4, d/2+0.6])
  }

  // Level 5+: garage box
  if (level >= 5) {
    box(3.5, 2.4, 3.0, '#374151', [w/2+2.1, 1.2, 0])
    box(3.2, 2.0, 0.1, '#1e293b', [w/2+2.1, 1.2, 1.5])  // garage door
  }

  // Level 6+: pool rectangle
  if (level >= 6) {
    box(5, 0.3, 3.5, '#0ea5e9', [0, -0.05, d/2+4])   // pool water
    box(5.4, 0.5, 4.0, '#e2e8f0', [0, -0.1, d/2+4])  // pool rim (behind water)
  }

  // Level 7+: rooftop terrace decorations
  if (level >= 7) {
    box(w*0.6, 0.1, d*0.6, '#475569', [0, h+0.35+0.05, 0])   // terrace floor
    // Helipad circle indicator (flat ring using thin cylinder)
    const heli = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16, 1, true),
      toon('#facc15')
    )
    heli.position.set(0, h+0.42, 0)
    group.add(heli)
  }

  return group
}

// ── Single house renderer ──────────────────────────────────────────────────────
function HouseAt({ x, z, level, status, label, labelColor = '#fbbf24', isOwn = false }) {
  const groupRef = useRef()
  const wc = wallColor(level, status)
  const rc = ROOF_COLORS[(level - 1) % 7]
  const mesh = buildHouseMesh(level, wc, rc)
  const h    = [2.8,3.5,4,4.5,5,6,14][level - 1]
  const rh   = [1.6,1.9,2.2,2.5,2.75,3.3,0.5][level - 1]
  const sign_y = h + rh + 0.9

  // Evicted visual — override material colors to grey + add warning sign
  if (status === 'evicted') {
    mesh.traverse(c => {
      if (c.isMesh && c.material) c.material.color.set('#374151')
    })
  }

  return (
    <group position={[x, 0, z]} ref={groupRef}>
      <primitive object={mesh} />

      {/* Warning sign for overdue bills */}
      {(status === 'warning' || status === 'eviction-warning') && (
        <mesh position={[0, 1.5, (([3,4,5,5.5,6.5,8,7][level-1])/2)+0.15]}>
          <planeGeometry args={[1.4, 0.5]} />
          <meshBasicMaterial color={status === 'eviction-warning' ? '#ef4444' : '#eab308'} />
        </mesh>
      )}

      {/* Billboard name tag */}
      <Billboard position={[0, sign_y, 0]}>
        {isOwn && (
          <Text fontSize={0.38} color="#fbbf24" anchorX="center" anchorY="middle"
            outlineWidth={0.05} outlineColor="#000">
            🏠 {label}
          </Text>
        )}
        {!isOwn && (
          <Text fontSize={0.34} color={labelColor} anchorX="center" anchorY="middle"
            outlineWidth={0.04} outlineColor="#000">
            {label}
          </Text>
        )}
        {status !== 'ok' && (
          <Text fontSize={0.26}
            color={status === 'evicted' ? '#ef4444' : status === 'eviction-warning' ? '#f97316' : '#eab308'}
            anchorX="center" anchorY="middle" position={[0, -0.52, 0]}
            outlineWidth={0.03} outlineColor="#000">
            {status === 'evicted' ? '⚠ EVICTED' : status === 'eviction-warning' ? '⚠ OVERDUE' : '⚠ BILLS DUE'}
          </Text>
        )}
      </Billboard>
    </group>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PlayerHouseMarker() {
  const [hs,    setHs]    = useState(getHouseState)
  const [others, setOthers] = useState([])
  const avatar = useStore(s => s.avatar)

  useEffect(() => onHouseUpdate(setHs), [])

  // Fetch other players' houses once on mount
  useEffect(() => {
    fetchAllHouses().then(all => {
      // exclude own house (if any)
      setOthers(all.filter(h => h.playerId !== (hs.ready ? null : undefined)))
    })
    // Re-fetch when our own house ready changes
  }, [hs.ready])

  if (!hs.ready) return null

  const myId = /* will be filtered below */ null

  return (
    <>
      {/* Own house */}
      {hs.position && hs.number && (
        <HouseAt
          x={hs.position.x} z={hs.position.z}
          level={hs.level}
          status={hs.status}
          label={`${hs.number}  ${avatar?.name || ''}`}
          isOwn
        />
      )}

      {/* Other players' houses — only show if they have a different position from own */}
      {others.map(h => {
        if (hs.position && h.x === hs.position.x && h.z === hs.position.z) return null
        const status = h.evicted ? 'evicted' : 'ok'
        return (
          <HouseAt
            key={h.number}
            x={h.x} z={h.z}
            level={h.level}
            status={status}
            label={`${h.playerName ?? h.number}`}
            labelColor="#94a3b8"
          />
        )
      })}
    </>
  )
}
