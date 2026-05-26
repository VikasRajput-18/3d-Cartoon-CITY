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
export function registerFixed(cx, cz, hw, hd) {
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

// ── Pre-register fixed city buildings (mirrors CityMap.jsx positions) ────────
const CITY_BUILDINGS = [
  { cx: 0,   cz:-24,  hw:5.2, hd:3.2 }, // City Hall
  { cx:-32,  cz:-24,  hw:6.2, hd:4.2 }, // Supermarket
  { cx:-52,  cz:-24,  hw:4.2, hd:2.8 }, // Library
  { cx:-52,  cz:-42,  hw:4.8, hd:3.2 }, // School
  { cx: 32,  cz:-24,  hw:4.8, hd:3.2 }, // Hospital
  { cx: 52,  cz:-24,  hw:2.8, hd:2.8 }, // Police
  { cx: 32,  cz:-42,  hw:4.2, hd:2.8 }, // Bank
  { cx: 52,  cz:-42,  hw:3.8, hd:2.8 }, // Fire Station
  { cx:-30,  cz: 26,  hw:3.2, hd:3.8 }, // Church
  { cx:-50,  cz: 26,  hw:3.2, hd:3.2 }, // Gym
  { cx:-16,  cz: 22,  hw:2.8, hd:2.2 }, // Gas Station
  { cx:-30,  cz: 46,  hw:2.8, hd:2.2 }, // Apartments
  { cx: 30,  cz: 26,  hw:5.2, hd:3.8 }, // Cinema
  { cx: 30,  cz: 46,  hw:7.2, hd:4.2 }, // Mall
  { cx: 50,  cz: 26,  hw:3.8, hd:2.8 }, // Restaurant
  { cx: 16,  cz: 22,  hw:2.8, hd:2.2 }, // Post Office
  { cx:-14,  cz:-14,  hw:2.2, hd:2.2 }, // Cafe
  { cx: 14,  cz:-14,  hw:2.2, hd:2.2 }, // Arcade
  { cx: 0,   cz:-32,  hw:3.2, hd:2.2 }, // Beach Club
  { cx:-14,  cz: 14,  hw:2.2, hd:2.2 }, // Rooftop Bar
  { cx: 14,  cz: 14,  hw:2.2, hd:2.2 }, // Music Room
  { cx: 0,   cz: 16,  hw:3.8, hd:2.8 }, // Park building
  { cx: 0,   cz:-40,  hw:3.2, hd:2.2 }, // Game Zone
  { cx: 40,  cz: 50,  hw:1.8, hd:1.8 }, // House 1
  { cx: 55,  cz: 50,  hw:1.8, hd:1.8 }, // House 2
]

CITY_BUILDINGS.forEach(({ cx, cz, hw, hd }) => registerFixed(cx, cz, hw, hd))
