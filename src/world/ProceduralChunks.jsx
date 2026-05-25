import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { minimapState } from '@/lib/minimapState'

const CHUNK_SIZE = 60
const HALF       = CHUNK_SIZE / 2
const VIEW_R     = 2  // 5×5 = 25 chunks visible

// Skip the 3×3 city-center chunks (city map covers this area)
function isCityChunk(cx, cz) {
  return Math.max(Math.abs(cx), Math.abs(cz)) <= 1
}

// LCG seeded RNG — returns deterministic float [0,1) for a given chunk
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

function addTree(group, x, z, rng) {
  const sc = 0.7 + rng() * 0.6
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 2.5, 6),
    makeMat('#78350f')
  )
  trunk.position.set(x, 1.25 * sc, z)
  trunk.scale.setScalar(sc)
  group.add(trunk)

  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3.2, 7),
    makeMat('#16a34a')
  )
  leaf.position.set(x, (2.5 + 1.6) * sc, z)
  leaf.scale.setScalar(sc)
  group.add(leaf)

  const leaf2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 2.5, 7),
    makeMat('#15803d')
  )
  leaf2.position.set(x, (2.5 + 3.0) * sc, z)
  leaf2.scale.setScalar(sc)
  group.add(leaf2)
}

function addBuilding(group, x, z, rng) {
  const w  = 4 + rng() * 5
  const h  = 4 + rng() * 14
  const d  = 4 + rng() * 5
  const ci = Math.floor(rng() * 6)
  const colors = ['#475569', '#64748b', '#7c3aed', '#1e40af', '#374151', '#52525b']

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMat(colors[ci])
  )
  body.position.set(x, h / 2, z)
  group.add(body)

  // Roof parapet
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5),
    makeMat('#1e293b')
  )
  roof.position.set(x, h + 0.175, z)
  group.add(roof)

  // Windows row (one flat strip per floor, purely visual)
  const floors = Math.max(1, Math.floor(h / 3))
  for (let f = 0; f < floors; f++) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.01, 0.6, 0.05),
      makeMat('#bfdbfe')
    )
    win.position.set(x, 1.5 + f * 3, z + d / 2 + 0.03)
    group.add(win)
  }
}

// ── Chunk mesh factory — returns THREE.Group or null for city area ────────────
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

  if (isNSRoad) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(4, CHUNK_SIZE),
      makeMat('#22252e')
    )
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    // Center line dashes
    const dashCount = 8
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 4),
        makeMat('#facc15')
      )
      dash.rotation.x = -Math.PI / 2
      dash.position.set(0, 0.02, -HALF + (i + 0.5) * (CHUNK_SIZE / dashCount))
      group.add(dash)
    }
  }
  if (isEWRoad) {
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_SIZE, 4),
      makeMat('#22252e')
    )
    road.rotation.x = -Math.PI / 2
    road.position.y  = 0.01
    group.add(road)
    const dashCount = 8
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 0.12),
        makeMat('#facc15')
      )
      dash.rotation.x = -Math.PI / 2
      dash.position.set(-HALF + (i + 0.5) * (CHUNK_SIZE / dashCount), 0.02, 0)
      group.add(dash)
    }
  }

  if (!isNSRoad && !isEWRoad) {
    const type = rng()
    if (type < 0.40) {
      // Building chunk: 1-2 buildings with surrounding trees
      const count = 1 + Math.floor(rng() * 2)
      const usedSpots = []
      for (let i = 0; i < count; i++) {
        let bx, bz, tries = 0
        do {
          bx = (rng() - 0.5) * (CHUNK_SIZE - 24)
          bz = (rng() - 0.5) * (CHUNK_SIZE - 24)
          tries++
        } while (tries < 12 && usedSpots.some(s => Math.hypot(s[0] - bx, s[1] - bz) < 18))
        usedSpots.push([bx, bz])
        addBuilding(group, bx, bz, rng)
      }
      // Sidewalk trees near each building
      for (let i = 0; i < count + 2; i++) {
        addTree(group, (rng() - 0.5) * (CHUNK_SIZE - 6), (rng() - 0.5) * (CHUNK_SIZE - 6), rng)
      }
    } else if (type < 0.70) {
      // Park chunk: dense trees and grassy look
      const ground2 = new THREE.Mesh(
        new THREE.PlaneGeometry(CHUNK_SIZE - 4, CHUNK_SIZE - 4),
        makeMat('#4ade80')
      )
      ground2.rotation.x = -Math.PI / 2
      ground2.position.y  = -0.01
      group.add(ground2)

      const count = 5 + Math.floor(rng() * 8)
      for (let i = 0; i < count; i++) {
        addTree(group, (rng() - 0.5) * (CHUNK_SIZE - 6), (rng() - 0.5) * (CHUNK_SIZE - 6), rng)
      }
    }
    // else: empty (just ground)
  } else {
    // Along road: scattered roadside trees
    const treeCount = 2 + Math.floor(rng() * 4)
    for (let i = 0; i < treeCount; i++) {
      // Keep trees off the road strip
      const side  = rng() > 0.5 ? 1 : -1
      const along = (rng() - 0.5) * CHUNK_SIZE
      const away  = side * (4 + rng() * (HALF - 5))
      if (isNSRoad) addTree(group, away, along, rng)
      else          addTree(group, along, away, rng)
    }
  }

  group.userData.birthTime = -1  // set at placement time
  return group
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProceduralWorld() {
  const worldRef  = useRef()
  const chunksRef = useRef(new Map())   // key → { group, birthTime } | null
  const queueRef  = useRef([])
  const lastChunk = useRef({ x: null, z: null })

  useFrame(() => {
    if (!worldRef.current) return

    const px  = minimapState.playerX || 0
    const pz  = minimapState.playerZ || 0
    const pcx = Math.round(px / CHUNK_SIZE)
    const pcz = Math.round(pz / CHUNK_SIZE)

    // Recompute when player enters a new chunk
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

      // Dispose out-of-range chunks
      for (const [key, entry] of chunksRef.current) {
        if (!needed.has(key)) {
          if (entry) {
            worldRef.current.remove(entry.group)
            entry.group.traverse(child => {
              if (child.isMesh) {
                child.geometry.dispose()
                child.material.dispose()
              }
            })
          }
          chunksRef.current.delete(key)
        }
      }
    }

    // Generate 1 chunk per frame
    while (queueRef.current.length > 0) {
      const { cx, cz, key } = queueRef.current.shift()
      if (chunksRef.current.has(key)) continue  // already done

      const group = buildChunkMesh(cx, cz)
      if (group) {
        const birthTime = performance.now() / 1000
        group.userData.birthTime = birthTime
        worldRef.current.add(group)
        chunksRef.current.set(key, { group, birthTime })
      } else {
        chunksRef.current.set(key, null)  // city area — mark done, no mesh
      }
      break  // one per frame
    }

    // Fade in new chunks
    const now = performance.now() / 1000
    for (const [, entry] of chunksRef.current) {
      if (!entry) continue
      const age = now - entry.birthTime
      if (age >= 0.5) continue
      const op = age / 0.5
      entry.group.traverse(child => {
        if (child.isMesh) child.material.opacity = op
      })
    }
  })

  return <group ref={worldRef} />
}
