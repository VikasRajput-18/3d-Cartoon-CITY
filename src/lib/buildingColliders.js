// Shared building AABB collision registry.
// Written by CityMap (fixed) and ProceduralChunks (dynamic).
// Read by NPC movement every frame to block walk-through.

// Fixed city-centre colliders — registered once at app start, never change.
const _fixed = []

// Procedural chunk colliders — keyed by chunk key (e.g. "2,3"), cleared on unload.
const _chunks = new Map()

// padding (world units) added to each side of every visual box.
const PAD = 1.2

/**
 * Register a fixed city-centre building.
 * cx/cz = world-space centre, hw/hd = visual half-extents.
 */
function registerFixed(cx, cz, hw, hd) {
  _fixed.push({
    minX: cx - hw - PAD, maxX: cx + hw + PAD,
    minZ: cz - hd - PAD, maxZ: cz + hd + PAD,
  })
}

/**
 * Store all buildings for one procedural chunk.
 * boxes: Array<{minX, maxX, minZ, maxZ}>
 */
export function registerChunk(key, boxes) {
  _chunks.set(key, boxes)
}

/** Remove colliders when a chunk streams out. */
export function unregisterChunk(key) {
  _chunks.delete(key)
}

/** Returns true if world-space point (x, z) is inside any registered building. */
export function isBlocked(x, z) {
  for (const b of _fixed) {
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true
  }
  for (const boxes of _chunks.values()) {
    for (const b of boxes) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true
    }
  }
  return false
}

// ── Pre-register fixed city buildings ─────────────────────────────────────────
// SINGLE SOURCE OF TRUTH: derive from playerColliders.boxColliders so the
// NPC/vehicle collision can never desync from player collision again. (The old
// hand-copied list went stale after the GTA-style spread — NPCs collided with
// ghost boxes at the buildings' OLD positions and walked through the new ones.)
import { boxColliders } from './playerColliders'

boxColliders.forEach(({ x, z, hw, hd }) => registerFixed(x, z, hw, hd))
