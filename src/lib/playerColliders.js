// Player-only AABB + circle collision registry.
// Distinct from buildingColliders.js which serves NPC navigation.
// hw/hd are visual half-extents matched to the actual mesh geometry.
// Positions are world-space X/Z centres (accounting for group + local offsets).

export const boxColliders = [
  // ── City buildings ──────────────────────────────────────────────────────────
  // CityHall:      group (0,-24)  mesh (0,4,0)    [10.4,8,6.4]
  { x:   0, z: -24, hw: 5.2, hd: 3.2, label: 'city-hall' },
  // Supermarket:   group(-32,-24) mesh (0,2,0)    [12.4,4,8.4]
  { x: -32, z: -24, hw: 6.2, hd: 4.2, label: 'supermarket' },
  // Library:       group(-52,-24) mesh (0,2.5,0)  [8.4,5,5.6]
  { x: -52, z: -24, hw: 4.2, hd: 2.8, label: 'library' },
  // School:        group(-52,-42) mesh (0,3.5,0)  [9.6,7,6.4]
  { x: -52, z: -42, hw: 4.8, hd: 3.2, label: 'school' },
  // Hospital:      group (32,-24) mesh (0,4,0)    [9.6,8,6.4]
  { x:  32, z: -24, hw: 4.8, hd: 3.2, label: 'hospital' },
  // PoliceStation: group (52,-24) mesh (0,2.5,0)  [5.6,5,5.6]
  { x:  52, z: -24, hw: 2.8, hd: 2.8, label: 'police' },
  // Bank:          group (32,-42) mesh (0,3,0)    [8.4,6,5.6]
  { x:  32, z: -42, hw: 4.2, hd: 2.8, label: 'bank' },
  // FireStation:   group (52,-42) mesh (0,2.5,0)  [7.6,5,5.6]
  { x:  52, z: -42, hw: 3.8, hd: 2.8, label: 'fire-station' },
  // Church:        group(-30, 26) mesh (0,3,0)    [6.4,6,7.6]
  { x: -30, z:  26, hw: 3.2, hd: 3.8, label: 'church' },
  // Gym:           group(-50, 26) mesh (0,2.5,0)  [6.4,5,6.4]
  { x: -50, z:  26, hw: 3.2, hd: 3.2, label: 'gym' },
  // GasStation:    group(-16, 22) mesh (0,1.5,-1.5) [4.2,3,3.2]
  // World center = (-16, *, 22-1.5 = 20.5)
  { x: -16, z: 20.5, hw: 2.2, hd: 1.7, label: 'gas-station' },
  // Apartments:    group(-30, 46) mesh (0,6,0)    [5.6,12,4.4]
  { x: -30, z:  46, hw: 2.8, hd: 2.2, label: 'apartments' },
  // Cinema:        group (30, 26) mesh (0,3.5,0)  [10.4,7,7.6]
  { x:  30, z:  26, hw: 5.2, hd: 3.8, label: 'cinema' },
  // Mall:          group (30, 46) mesh (0,3,0)    [14.4,6,8.4]
  { x:  30, z:  46, hw: 7.2, hd: 4.2, label: 'mall' },
  // Restaurant:    group (50, 26) mesh (0,2.5,0)  [7.6,5,5.6]
  { x:  50, z:  26, hw: 3.8, hd: 2.8, label: 'restaurant' },
  // PostOffice:    group (16, 22) mesh (0,2,0)    [5.6,4,4.4]
  { x:  16, z:  22, hw: 2.8, hd: 2.2, label: 'post-office' },

  // ── Centre interactive buildings (Building component — mesh at group pos) ──
  // Cafe:       pos=[-14,-14] w=4.4 d=4.4
  { x: -14, z: -14, hw: 2.2, hd: 2.2, label: 'cafe' },
  // Arcade:     pos=[ 14,-14] w=4.4 d=4.4
  { x:  14, z: -14, hw: 2.2, hd: 2.2, label: 'arcade-shop' },
  // Beach Club: pos=[0,-32]  w=6.4 d=4.4
  { x:   0, z: -32, hw: 3.2, hd: 2.2, label: 'beach-club' },
  // Rooftop Bar:pos=[-14,14] w=4.4 d=4.4
  { x: -14, z:  14, hw: 2.2, hd: 2.2, label: 'rooftop-bar' },
  // Music Room: pos=[14,14]  w=4.4 d=4.4
  { x:  14, z:  14, hw: 2.2, hd: 2.2, label: 'music-room' },
  // Game Zone:  pos=[0,-40]  w=6.4 d=4.4
  { x:   0, z: -40, hw: 3.2, hd: 2.2, label: 'game-zone' },

  // ── ParkArea building ───────────────────────────────────────────────────────
  // ParkArea group=(0,0,16), building mesh local=(0,2.5,4.2) [7.6,5,5.6]
  // World centre = (0, *, 16+4.2 = 20.2)
  { x:   0, z: 20.2, hw: 3.8, hd: 2.8, label: 'park-building' },

  // ── SE Residential houses (House component, main body [3,2.4,3] + slab [3.3]) ──
  { x:  40, z:  50, hw: 1.65, hd: 1.65, label: 'house-1' },
  { x:  55, z:  50, hw: 1.65, hd: 1.65, label: 'house-2' },
  { x:  40, z:  60, hw: 1.65, hd: 1.65, label: 'house-3' },
  { x:  55, z:  60, hw: 1.65, hd: 1.65, label: 'house-4' },
  { x:  25, z:  50, hw: 1.65, hd: 1.65, label: 'house-5' },
  { x:  25, z:  60, hw: 1.65, hd: 1.65, label: 'house-6' },

  // ── Game Area building (GameAreaBuilding.jsx, GAME_AREA_POS=[22,0,-10]) ──────
  // Main mesh (0,3.5,0) args=[9,7,7]
  { x:  22, z: -10, hw: 4.5, hd: 3.5, label: 'game-area' },
]

export const circleColliders = [
  // Fountain basin at roundabout centre — outer radius 2.1 (cylinderGeometry args=[1.8,2.1,0.5])
  { x:   0, z:   0, r: 2.1, label: 'fountain' },

  // ── Roundabout island trees (match TREE_DATA exactly) ──────────────────────
  { x:  -4, z:  -4, r: 0.4, label: 'tree-rab-0' },
  { x:  -4, z:   4, r: 0.4, label: 'tree-rab-1' },
  { x:   4, z:  -4, r: 0.4, label: 'tree-rab-2' },
  { x:   4, z:   4, r: 0.4, label: 'tree-rab-3' },
  { x:  -6, z:   0, r: 0.4, label: 'tree-rab-4' },
  { x:   6, z:   0, r: 0.4, label: 'tree-rab-5' },
  { x:   0, z:  -6, r: 0.4, label: 'tree-rab-6' },
  { x:   0, z:   6, r: 0.4, label: 'tree-rab-7' },

  // ── E-W highway south footpath trees (z = -9) ─────────────────────────────
  { x: -48, z:  -9, r: 0.4, label: 'tree-ew-s-0' },
  { x: -36, z:  -9, r: 0.4, label: 'tree-ew-s-1' },
  { x: -24, z:  -9, r: 0.4, label: 'tree-ew-s-2' },
  { x: -12, z:  -9, r: 0.4, label: 'tree-ew-s-3' },
  { x:  12, z:  -9, r: 0.4, label: 'tree-ew-s-4' },
  { x:  24, z:  -9, r: 0.4, label: 'tree-ew-s-5' },
  { x:  36, z:  -9, r: 0.4, label: 'tree-ew-s-6' },
  { x:  48, z:  -9, r: 0.4, label: 'tree-ew-s-7' },

  // ── E-W highway north footpath trees (z = +9) ─────────────────────────────
  { x: -48, z:   9, r: 0.4, label: 'tree-ew-n-0' },
  { x: -36, z:   9, r: 0.4, label: 'tree-ew-n-1' },
  { x: -24, z:   9, r: 0.4, label: 'tree-ew-n-2' },
  { x: -12, z:   9, r: 0.4, label: 'tree-ew-n-3' },
  { x:  12, z:   9, r: 0.4, label: 'tree-ew-n-4' },
  { x:  24, z:   9, r: 0.4, label: 'tree-ew-n-5' },
  { x:  36, z:   9, r: 0.4, label: 'tree-ew-n-6' },
  { x:  48, z:   9, r: 0.4, label: 'tree-ew-n-7' },

  // ── N-S highway west footpath trees (x = -9) ──────────────────────────────
  { x:  -9, z: -48, r: 0.4, label: 'tree-ns-w-0' },
  { x:  -9, z: -36, r: 0.4, label: 'tree-ns-w-1' },
  { x:  -9, z: -24, r: 0.4, label: 'tree-ns-w-2' },
  { x:  -9, z: -12, r: 0.4, label: 'tree-ns-w-3' },
  { x:  -9, z:  12, r: 0.4, label: 'tree-ns-w-4' },
  { x:  -9, z:  24, r: 0.4, label: 'tree-ns-w-5' },
  { x:  -9, z:  36, r: 0.4, label: 'tree-ns-w-6' },
  { x:  -9, z:  48, r: 0.4, label: 'tree-ns-w-7' },

  // ── N-S highway east footpath trees (x = +9) ──────────────────────────────
  { x:   9, z: -48, r: 0.4, label: 'tree-ns-e-0' },
  { x:   9, z: -36, r: 0.4, label: 'tree-ns-e-1' },
  { x:   9, z: -24, r: 0.4, label: 'tree-ns-e-2' },
  { x:   9, z: -12, r: 0.4, label: 'tree-ns-e-3' },
  { x:   9, z:  12, r: 0.4, label: 'tree-ns-e-4' },
  { x:   9, z:  24, r: 0.4, label: 'tree-ns-e-5' },
  { x:   9, z:  36, r: 0.4, label: 'tree-ns-e-6' },
  { x:   9, z:  48, r: 0.4, label: 'tree-ns-e-7' },

  // ── SE residential zone trees ──────────────────────────────────────────────
  { x:  22, z:  28, r: 0.4, label: 'tree-se-0' },
  { x:  28, z:  28, r: 0.4, label: 'tree-se-1' },
  { x:  35, z:  28, r: 0.4, label: 'tree-se-2' },
  { x:  44, z:  28, r: 0.4, label: 'tree-se-3' },
  { x:  22, z:  38, r: 0.4, label: 'tree-se-4' },
  { x:  28, z:  38, r: 0.4, label: 'tree-se-5' },
  { x:  35, z:  38, r: 0.4, label: 'tree-se-6' },
  { x:  44, z:  38, r: 0.4, label: 'tree-se-7' },
  { x:  22, z:  48, r: 0.4, label: 'tree-se-8' },
  { x:  28, z:  48, r: 0.4, label: 'tree-se-9' },
  { x:  35, z:  48, r: 0.4, label: 'tree-se-10' },
  { x:  44, z:  48, r: 0.4, label: 'tree-se-11' },

  // ── NW zone trees ──────────────────────────────────────────────────────────
  { x: -18, z:  24, r: 0.4, label: 'tree-nw-0' },
  { x: -22, z:  24, r: 0.4, label: 'tree-nw-1' },
  { x: -26, z:  34, r: 0.4, label: 'tree-nw-2' },
  { x: -36, z:  34, r: 0.4, label: 'tree-nw-3' },

  // ── NE park zone trees ─────────────────────────────────────────────────────
  { x:  -8, z: -20, r: 0.4, label: 'tree-ne-0' },
  { x:  -5, z: -20, r: 0.4, label: 'tree-ne-1' },
  { x:   5, z: -20, r: 0.4, label: 'tree-ne-2' },
  { x:   8, z: -20, r: 0.4, label: 'tree-ne-3' },
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

export function logAllColliders() {
  console.log('Collision boxes:', boxColliders.length, boxColliders)
  console.log('Collision circles:', circleColliders.length, circleColliders)
}

logAllColliders()
