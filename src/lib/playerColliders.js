// Player-only AABB + circle collision registry.
// Distinct from buildingColliders.js which serves NPC navigation.
// hw/hd are visual half-extents matched to the actual mesh geometry.
// Positions are world-space X/Z centres (accounting for group + local offsets).

export const boxColliders = [
  // ── City buildings — GTA-style spread along the highway arms ───────────────
  // Positions MUST match the bespoke group positions in CityMap.jsx.
  { x: -18, z: -90, hw: 5.2, hd: 3.2, label: 'city-hall' },
  { x: -120, z: 16, hw: 6.2, hd: 4.2, label: 'supermarket' },
  { x: -130, z: -16, hw: 4.2, hd: 2.8, label: 'library' },
  { x: -160, z: 16, hw: 4.8, hd: 3.2, label: 'school' },
  { x: 100, z: 16, hw: 4.8, hd: 3.2, label: 'hospital' },
  { x: 120, z: -16, hw: 2.8, hd: 2.8, label: 'police' },
  { x: 135, z: 16, hw: 4.2, hd: 2.8, label: 'bank' },
  { x: 18, z: -200, hw: 3.8, hd: 2.8, label: 'fire-station' },
  { x: -185, z: -18, hw: 3.2, hd: 3.8, label: 'church' },
  { x: -18, z: -140, hw: 3.2, hd: 3.2, label: 'gym' },
  // GasStation: group(65,16), mesh local z offset −1.5 → world (65, 14.5)
  { x: 65, z: 14.5, hw: 2.2, hd: 1.7, label: 'gas-station' },
  { x: -18, z: -190, hw: 2.8, hd: 2.2, label: 'apartments' },
  { x: 18, z: 90, hw: 5.2, hd: 3.8, label: 'cinema' },
  { x: -22, z: 205, hw: 7.2, hd: 4.2, label: 'mall' },
  { x: 18, z: 135, hw: 3.8, hd: 2.8, label: 'restaurant' },
  { x: 18, z: -75, hw: 2.8, hd: 2.2, label: 'post-office' },

  // ── Interactive destination buildings (CenterBuildings — now spread out) ───
  { x: -80, z: -16, hw: 2.2, hd: 2.2, label: 'cafe' },
  { x:  80, z: -16, hw: 2.2, hd: 2.2, label: 'arcade-shop' },
  { x: 170, z: -55, hw: 3.2, hd: 2.2, label: 'beach-club' },
  { x:  18, z: -115, hw: 2.2, hd: 2.2, label: 'rooftop-bar' },
  { x:  18, z: -160, hw: 2.2, hd: 2.2, label: 'music-room' },
  { x: -80, z:  16, hw: 3.2, hd: 2.2, label: 'game-zone' },

  // ── ParkArea building ───────────────────────────────────────────────────────
  // ParkArea group=(-18,0,170), building mesh local=(0,2.5,4.2)
  { x: -18, z: 174.2, hw: 3.8, hd: 2.8, label: 'park-building' },

  // ── SE Residential houses (House component, main body [3,2.4,3] + slab [3.3]) ──
  { x:  40, z:  50, hw: 1.65, hd: 1.65, label: 'house-1' },
  { x:  55, z:  50, hw: 1.65, hd: 1.65, label: 'house-2' },
  { x:  40, z:  60, hw: 1.65, hd: 1.65, label: 'house-3' },
  { x:  55, z:  60, hw: 1.65, hd: 1.65, label: 'house-4' },
  { x:  25, z:  50, hw: 1.65, hd: 1.65, label: 'house-5' },
  { x:  25, z:  60, hw: 1.65, hd: 1.65, label: 'house-6' },

  // ── Game Area building (GameAreaBuilding.jsx, GAME_AREA_POS=[20,0,180]) ─────
  // Main mesh (0,3.5,0) args=[9,7,7]
  { x:  20, z: 180, hw: 4.5, hd: 3.5, label: 'game-area' },

  // ── Swimming pool complex (Locations.jsx, centre 300,-300) ──────────────────
  // Changing rooms: local (±17.5, 9.5) [4,2.4,3]
  { x: 282.5, z: -290.5, hw: 2.0, hd: 1.5, label: 'pool-changing-1' },
  { x: 317.5, z: -290.5, hw: 2.0, hd: 1.5, label: 'pool-changing-2' },
  // Lifeguard tower: local (14, 6.5)
  { x: 314, z: -293.5, hw: 1.1, hd: 1.1, label: 'pool-lifeguard' },
  // Diving board pillar: local (-13, 0)
  { x: 287, z: -300, hw: 0.6, hd: 0.6, label: 'pool-diveboard' },

  // ── Airport (Locations.jsx, centre -600,-600) ───────────────────────────────
  // Terminal: local (0, 50) [60,8,20]
  { x: -600, z: -550, hw: 30, hd: 10, label: 'airport-terminal' },
  // Control tower: local (34, 44) [5,25,5]
  { x: -566, z: -556, hw: 2.6, hd: 2.6, label: 'airport-tower' },
  // Hangar: local (-40, 10) [40,12,30]
  { x: -640, z: -590, hw: 20, hd: 15, label: 'airport-hangar' },
]

export const circleColliders = [
  // Grand fountain at plaza centre — outer basin radius 3.8 (CityMap Fountain rebuild)
  { x:   0, z:   0, r: 4.0, label: 'fountain' },

  // ── City trees — 18 total, must match TREE_DATA in CityMap.jsx exactly ──────
  // E-W highway south footpath (z=-9)
  { x: -36, z:  -9, r: 0.4, label: 'tree-0' },
  { x: -12, z:  -9, r: 0.4, label: 'tree-1' },
  { x:  12, z:  -9, r: 0.4, label: 'tree-2' },
  { x:  36, z:  -9, r: 0.4, label: 'tree-3' },
  // E-W highway north footpath (z=9)
  { x: -24, z:   9, r: 0.4, label: 'tree-4' },
  { x:  24, z:   9, r: 0.4, label: 'tree-5' },
  // N-S highway west footpath (x=-9)
  { x:  -9, z: -36, r: 0.4, label: 'tree-6' },
  { x:  -9, z:  12, r: 0.4, label: 'tree-7' },
  // N-S highway east footpath (x=9)
  { x:   9, z: -24, r: 0.4, label: 'tree-8' },
  { x:   9, z:  36, r: 0.4, label: 'tree-9' },
  // SE residential edge
  { x:  44, z:  38, r: 0.4, label: 'tree-10' },
  { x:  28, z:  48, r: 0.4, label: 'tree-11' },
  // Park cluster (park at -18,170)
  { x: -25,   z: 169.5, r: 0.4, label: 'tree-12' },
  { x: -11,   z: 169.5, r: 0.4, label: 'tree-13' },
  { x: -24.5, z: 176.5, r: 0.4, label: 'tree-14' },
  { x: -11.5, z: 176.5, r: 0.4, label: 'tree-15' },
  // Playground corners (playground at -18,130)
  { x: -28.5, z: 124, r: 0.4, label: 'tree-16' },
  { x:  -7.5, z: 136, r: 0.4, label: 'tree-17' },
  // Sunset Shore palms (PALM_POS in SunsetShore.jsx)
  { x: 168, z: -42, r: 0.35, label: 'palm-0' },
  { x: 176, z: -18, r: 0.35, label: 'palm-1' },
  { x: 165, z:   6, r: 0.35, label: 'palm-2' },
  { x: 178, z:  30, r: 0.35, label: 'palm-3' },
  { x: 169, z:  52, r: 0.35, label: 'palm-4' },
  { x: 186, z: -55, r: 0.35, label: 'palm-5' },
]

/** Dynamically add a box collider (used by procedural chunks). */
export function addCollider(x, z, width, depth, label) {
  boxColliders.push({ x, z, hw: width / 2, hd: depth / 2, label })
}

/** Remove all box colliders whose label starts with prefix (chunk cleanup). */
export function removeCollidersWithPrefix(prefix) {
  for (let i = boxColliders.length - 1; i >= 0; i--) {
    if (boxColliders[i].label.startsWith(prefix)) boxColliders.splice(i, 1)
  }
}

/**
 * Collision audit: for each named place, log whether a collision box exists
 * near its position. Run once at startup from WorldCanvas.
 */
export function logAllColliders(places = []) {
  for (const p of places) {
    const px = p.pos?.[0] ?? p.x, pz = p.pos?.[2] ?? p.z
    if (px === undefined) continue
    const hasCollision = boxColliders.some(b =>
      Math.abs(b.x - px) < b.hw + 45 && Math.abs(b.z - pz) < b.hd + 45)
    console.log(p.label || p.id, 'has collision:', hasCollision)
  }
}
