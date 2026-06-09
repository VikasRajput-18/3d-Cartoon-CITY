// Shared constants for the new far-flung locations, used by both the 3D scenery
// (Locations.jsx) and the player controller (swimming logic in WorldCanvas).

// Swimming pool complex — main pool centred at (300,-300), 30 (x) × 15 (z).
export const POOL = {
  cx: 300, cz: -300,
  halfW: 15, halfD: 7.5,   // pool water half-extents
  enterPad: 4,             // how close to the pool edge you must be to press E
  surfaceY: -0.25,         // water surface height (slightly sunken)
}
export const POOL_DIVE = { x: POOL.cx - 13, z: POOL.cz, height: 3 }   // diving board tip

// Airport — terminal/runway complex far from the city.
export const AIRPORT = {
  cx: -600, cz: -600,
  planeSpawn: { x: -560, z: -560 },   // where the flyable plane parks (Phase 2)
}

// True if (x,z) is within `pad` of the pool water rectangle.
export function nearPool(x, z, pad = POOL.enterPad) {
  const dx = Math.max(Math.abs(x - POOL.cx) - POOL.halfW, 0)
  const dz = Math.max(Math.abs(z - POOL.cz) - POOL.halfD, 0)
  return Math.hypot(dx, dz) <= pad
}
