import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { minimapState } from '@/lib/minimapState'
import { registerChunk, unregisterChunk } from '@/lib/buildingColliders'
import { addCollider, removeCollidersWithPrefix } from '@/lib/playerColliders'
import { registerChunkTrees, unregisterChunkTrees } from '@/lib/chunkTreeState'
import { gradientMap } from './ToonStyle'

const CHUNK_SIZE = 80   // larger chunks (was 60) — more world per chunk, fewer regenerations
const HALF       = CHUNK_SIZE / 2
const VIEW_R     = 1  // 3×3 = 9 chunks active — already at the "max 9" target

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
  // Born "complete": gradientMap baked in + _toon flag set, so the global
  // ToonStyle pass skips these materials and never mutates gradientMap later.
  // That mutation was forcing a shader recompile per chunk (the Programs spike).
  // Each chunk still gets its OWN material instance so the per-chunk opacity
  // fade-in keeps working — same shader program, different uniforms.
  const m = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0, gradientMap })
  m.userData._toon = true
  return m
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
  group.userData.dynamic = true   // streaming chunk — never merge (it disposes/reloads)

  // Sunset Shore exclusion — the beach/ocean band east of the city
  // (x > 150, |z| < 100). These chunks get a bare sand ground and NOTHING else,
  // so no procedural buildings/roads/trees ever pop out of the water.
  const inShore = (wx + HALF > 150) && (Math.abs(wz) - HALF < 100)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
    makeMat(inShore ? '#efd9a7' : '#5e9444')   // C.sand / C.grass tokens
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y  = -0.02
  group.add(ground)

  if (inShore) {
    group.userData.birthTime = -1
    return { group, colliders: [], trees: [] }
  }

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

  // Merge a road's lane dashes into ONE mesh. Each dash is a flat plane laid on
  // the ground (rotated -90° on X); we bake that rotation + position into the
  // geometry then merge, so 8 dashes become 1 draw call / 1 geometry per road.
  const ROT_FLAT = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
  function addMergedDashes(orientation) {
    const dashCount = 8
    const geos = []
    for (let i = 0; i < dashCount; i++) {
      const g = orientation === 'ns'
        ? new THREE.PlaneGeometry(0.12, 4)
        : new THREE.PlaneGeometry(4, 0.12)
      g.applyMatrix4(ROT_FLAT)
      const along = -HALF + (i + 0.5) * (CHUNK_SIZE / dashCount)
      if (orientation === 'ns') g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.02, along))
      else                      g.applyMatrix4(new THREE.Matrix4().makeTranslation(along, 0.02, 0))
      geos.push(g)
    }
    const merged = mergeGeometries(geos, false)
    geos.forEach(g => g.dispose())
    if (merged) group.add(new THREE.Mesh(merged, makeMat('#f2c94c')))   // C.laneYellow
  }

  if (isNSRoad) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4, CHUNK_SIZE), makeMat('#3a3f47'))
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    addMergedDashes('ns')   // 8 dash planes → 1 merged mesh
  }
  if (isEWRoad) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, 4), makeMat('#3a3f47'))
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    addMergedDashes('ew')   // 8 dash planes → 1 merged mesh
  }

  // Roadside trees for road chunks — at most 1, only ~5% of chunks, at the road
  // edge (never chunk centre). Keeps the world from looking like a forest.
  if (isNSRoad || isEWRoad) {
    if (rng() < 0.05) {
      const side  = rng() > 0.5 ? 1 : -1
      const along = (rng() - 0.5) * CHUNK_SIZE
      const away  = side * (HALF - 4)   // pinned to the chunk edge near the road
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

  // Highway-corridor exclusion: the spread city's landmarks line the main
  // highway arms (|x|<60 or |z|<60 well beyond the core). Chunks in those
  // corridors stay clear of buildings/trees so nothing crowds the landmarks.
  const inCorridor = Math.abs(wx) < 60 || Math.abs(wz) < 60
  if (inCorridor) {
    group.userData.birthTime = -1
    return { group, colliders: [], trees: [] }
  }

  // ── GRID PLACEMENT: checkerboard — only even (cx+cz) chunks get a building ──
  const eligible = (cx + cz) % 2 === 0

  if (eligible && type < 0.30) {
    // ── Building chunk: ONE building at chunk centre (local 0, 0) ────────────
    // Spawn probability lowered 0.55 → 0.30 to roughly halve the number of
    // chunk buildings on screen (≈ halves chunk-building draw calls). Freed
    // probability falls through to lighter park / empty chunks.
    const w  = 4 + rng() * 4    // width  4-8  (capped for clear spacing)
    const h  = 5 + rng() * 13   // height 5-18
    const d  = 4 + rng() * 4    // depth  4-8
    // Storybook token walls (designTokens.js) — same family as the city centre
    const colors = ['#f2e8d5', '#e3d3b4', '#d9886a', '#7e93a8', '#f7f3ea', '#e3d3b4', '#f2e8d5']
    const ci = Math.floor(rng() * colors.length)

    // Building body at local (0, h/2, 0)
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(colors[ci]))
    body.position.set(0, h / 2, 0)
    group.add(body)

    // Roof parapet — slate token
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), makeMat('#3d4a5c'))
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

    // No sidewalk trees around buildings — keep them clear of structures.

  } else if (type < 0.75) {
    // ── Park chunk: grass + trees ─────────────────────────────────────────────
    const parkGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_SIZE - 4, CHUNK_SIZE - 4),
      makeMat('#4f8f3f')   // C.parkGrass token
    )
    parkGrass.rotation.x = -Math.PI / 2
    parkGrass.position.y  = -0.01
    group.add(parkGrass)
    // Sparse parks (1-2 trees) to reduce overall clutter.
    const count = 1 + Math.floor(rng() * 2)
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
  const lastGenTime = useRef(0)   // throttle: max one chunk generated per interval

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
              if (child.isMesh) {
                child.geometry?.dispose()
                if (Array.isArray(child.material)) child.material.forEach(m => m?.dispose())
                else child.material?.dispose()
              }
            })
            unregisterChunk(key)
            removeCollidersWithPrefix(`chunk:${key}:`)
            unregisterChunkTrees(key)
          }
          chunksRef.current.delete(key)
        }
      }
    }

    // Throttle: generate at most one chunk every 350ms. This spreads the
    // geometry-creation spikes over time so a burst of newly-needed chunks can't
    // add 100+ geometries in a single frame (the VRAM spike that crashed WebGL).
    const nowMs = performance.now()
    if (queueRef.current.length > 0 && nowMs - lastGenTime.current > 350) {
      const { cx, cz, key } = queueRef.current.shift()
      if (!chunksRef.current.has(key)) {
        lastGenTime.current = nowMs
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
      }
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
