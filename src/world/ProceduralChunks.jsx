import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { minimapState } from '@/lib/minimapState'
import { registerChunk, unregisterChunk } from '@/lib/buildingColliders'
import { addCollider, removeCollidersWithPrefix } from '@/lib/playerColliders'
import { registerChunkTrees, unregisterChunkTrees } from '@/lib/chunkTreeState'

const CHUNK_SIZE = 60
const HALF       = CHUNK_SIZE / 2
const VIEW_R     = 2  // 5×5 = 25 chunks visible

// Skip the 3×3 city-centre chunks (CityMap covers this area)
function isCityChunk(cx, cz) {
  return Math.max(Math.abs(cx), Math.abs(cz)) <= 1
}

// LCG seeded deterministic RNG for consistent chunk generation
function lcg(seed) {
  let s = (seed ^ 0xdeadbeef) | 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 4294967296
  }
}

function makeMat(color) {
  return new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0 })
}

// Returns { group, colliders, playerBox, trees } for this chunk.
// GRID RULE: exactly ONE building per eligible chunk, placed at the chunk centre.
// CHECKERBOARD: only chunks where (cx + cz) is even get buildings — guarantees
// at least one empty chunk (60 world units) between any two buildings.
// Trees are collected as world-space positions and returned for ChunkTrees to render.
function buildChunkMesh(cx, cz) {
  if (isCityChunk(cx, cz)) return null

  const wx  = cx * CHUNK_SIZE
  const wz  = cz * CHUNK_SIZE
  const rng = lcg(cx * 73856093 ^ cz * 19349663)

  const group = new THREE.Group()
  group.position.set(wx, 0, wz)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
    makeMat('#2d5a27')
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y  = -0.02
  group.add(ground)

  const isNSRoad = cx % 3 === 0
  const isEWRoad = cz % 3 === 0

  // Trees for this chunk — world-space positions, consumed by ChunkTrees renderer
  const treeList = []

  // Local addTree records position instead of creating geometry.
  // Consumes exactly one rng() call (for scale) — same as the old primitive version.
  function addTree(localX, localZ) {
    const s  = 0.7 + rng() * 0.6
    // Deterministic yaw variety without extra rng calls
    const ry = treeList.length * 1.61803
    treeList.push({ x: wx + localX, z: wz + localZ, s, ry })
  }

  if (isNSRoad) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4, CHUNK_SIZE), makeMat('#22252e'))
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    const dashCount = 8
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4), makeMat('#facc15'))
      dash.rotation.x = -Math.PI / 2
      dash.position.set(0, 0.02, -HALF + (i + 0.5) * (CHUNK_SIZE / dashCount))
      group.add(dash)
    }
  }
  if (isEWRoad) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, 4), makeMat('#22252e'))
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    const dashCount = 8
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.12), makeMat('#facc15'))
      dash.rotation.x = -Math.PI / 2
      dash.position.set(-HALF + (i + 0.5) * (CHUNK_SIZE / dashCount), 0.02, 0)
      group.add(dash)
    }
  }

  // Roadside trees for road chunks
  if (isNSRoad || isEWRoad) {
    const treeCount = 2 + Math.floor(rng() * 4)
    for (let i = 0; i < treeCount; i++) {
      const side  = rng() > 0.5 ? 1 : -1
      const along = (rng() - 0.5) * CHUNK_SIZE
      const away  = side * (4 + rng() * (HALF - 5))
      if (isNSRoad) addTree(away, along)
      else          addTree(along, away)
    }
    group.userData.birthTime = -1
    return { group, colliders: [], trees: treeList }
  }

  // Non-road chunks — determine content type
  const type = rng()
  const colliders = []
  let playerBox = null

  // ── GRID PLACEMENT: checkerboard — only even (cx+cz) chunks get a building ──
  const eligible = (cx + cz) % 2 === 0

  if (eligible && type < 0.55) {
    // ── Building chunk: ONE building at chunk centre (local 0, 0) ────────────
    const w  = 4 + rng() * 4    // width  4-8  (capped for clear spacing)
    const h  = 5 + rng() * 13   // height 5-18
    const d  = 4 + rng() * 4    // depth  4-8
    const ci = Math.floor(rng() * 6)
    const colors = ['#475569', '#64748b', '#7c3aed', '#1e40af', '#374151', '#52525b']

    // Building body at local (0, h/2, 0)
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(colors[ci]))
    body.position.set(0, h / 2, 0)
    group.add(body)

    // Roof parapet
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), makeMat('#1e293b'))
    roof.position.set(0, h + 0.175, 0)
    group.add(roof)

    // Window strips
    const floors = Math.max(1, Math.floor(h / 3))
    for (let f = 0; f < floors; f++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.6, 0.05), makeMat('#bfdbfe'))
      win.position.set(0, 1.5 + f * 3, d / 2 + 0.03)
      group.add(win)
    }

    // Register AABB in world space — building is at chunk world origin (wx, 0, wz)
    const hw = w / 2, hd = d / 2, PAD = 1.2
    colliders.push({
      minX: wx - hw - PAD, maxX: wx + hw + PAD,
      minZ: wz - hd - PAD, maxZ: wz + hd + PAD,
    })
    playerBox = { x: wx, z: wz, w, d }

    // Sidewalk trees around building
    const treeCount = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < treeCount; i++) {
      const ang  = rng() * Math.PI * 2
      const dist = 6 + rng() * 6
      addTree(Math.cos(ang) * dist, Math.sin(ang) * dist)
    }

  } else if (type < 0.75) {
    // ── Park chunk: grass + trees ─────────────────────────────────────────────
    const parkGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_SIZE - 4, CHUNK_SIZE - 4),
      makeMat('#4ade80')
    )
    parkGrass.rotation.x = -Math.PI / 2
    parkGrass.position.y  = -0.01
    group.add(parkGrass)
    const count = 5 + Math.floor(rng() * 8)
    for (let i = 0; i < count; i++) {
      addTree((rng() - 0.5) * (CHUNK_SIZE - 8), (rng() - 0.5) * (CHUNK_SIZE - 8))
    }
  } else {
    // ── Empty chunk: just a few scattered trees ───────────────────────────────
    const count = 1 + Math.floor(rng() * 3)
    for (let i = 0; i < count; i++) {
      addTree((rng() - 0.5) * (CHUNK_SIZE - 8), (rng() - 0.5) * (CHUNK_SIZE - 8))
    }
  }

  group.userData.birthTime = -1
  return { group, colliders, playerBox, trees: treeList }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProceduralWorld() {
  const worldRef  = useRef()
  // chunksRef stores { group, birthTime, colliders } | null per key
  const chunksRef = useRef(new Map())
  const queueRef  = useRef([])
  const lastChunk = useRef({ x: null, z: null })

  useFrame(() => {
    if (!worldRef.current) return

    const px  = minimapState.playerX || 0
    const pz  = minimapState.playerZ || 0
    const pcx = Math.round(px / CHUNK_SIZE)
    const pcz = Math.round(pz / CHUNK_SIZE)

    if (pcx !== lastChunk.current.x || pcz !== lastChunk.current.z) {
      lastChunk.current = { x: pcx, z: pcz }

      const needed = new Set()
      for (let dx = -VIEW_R; dx <= VIEW_R; dx++) {
        for (let dz = -VIEW_R; dz <= VIEW_R; dz++) {
          const key = `${pcx + dx},${pcz + dz}`
          needed.add(key)
          if (!chunksRef.current.has(key)) {
            queueRef.current.push({ cx: pcx + dx, cz: pcz + dz, key })
          }
        }
      }

      // Dispose out-of-range chunks and unregister their colliders + trees
      for (const [key, entry] of chunksRef.current) {
        if (!needed.has(key)) {
          if (entry) {
            worldRef.current.remove(entry.group)
            entry.group.traverse(child => {
              if (child.isMesh) { child.geometry.dispose(); child.material.dispose() }
            })
            unregisterChunk(key)
            removeCollidersWithPrefix(`chunk:${key}:`)
            unregisterChunkTrees(key)
          }
          chunksRef.current.delete(key)
        }
      }
    }

    // Generate 1 chunk per frame to avoid hitches
    while (queueRef.current.length > 0) {
      const { cx, cz, key } = queueRef.current.shift()
      if (chunksRef.current.has(key)) continue

      const result = buildChunkMesh(cx, cz)
      if (result) {
        const { group, colliders, playerBox, trees } = result
        const birthTime = performance.now() / 1000
        group.userData.birthTime = birthTime
        worldRef.current.add(group)
        chunksRef.current.set(key, { group, birthTime, colliders })
        if (colliders.length > 0) registerChunk(key, colliders)
        if (playerBox) addCollider(playerBox.x, playerBox.z, playerBox.w, playerBox.d, `chunk:${key}:bldg`)
        registerChunkTrees(key, trees || [])
      } else {
        chunksRef.current.set(key, null)  // city area — no mesh
      }
      break
    }

    // Fade in newly added chunks
    const now = performance.now() / 1000
    for (const [, entry] of chunksRef.current) {
      if (!entry) continue
      const age = now - entry.birthTime
      if (age >= 0.6) continue
      const op = age / 0.6
      entry.group.traverse(child => {
        if (child.isMesh) child.material.opacity = op
      })
    }
  })

  return <group ref={worldRef} />
}
