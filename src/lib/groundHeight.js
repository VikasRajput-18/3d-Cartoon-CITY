// Height-aware ground resolution. Returns the walkable surface height at (x,z)
// given the mover's current height — so the flyover deck only "captures" you if
// you approached via a ramp (roads still pass underneath at y=0).
//
// Flyover (CityMap): x 16…24, deck top y≈6.35 over z −30…30,
// ramps z ±30…±45 sloping 6.35 → 0.

const FLY_X0 = 16, FLY_X1 = 24
const DECK_TOP = 6.35
const STEP = 1.6   // max step-up a mover can climb in one frame

export function groundHeightAt(x, z, currentY = 0) {
  let h = 0
  if (x > FLY_X0 && x < FLY_X1) {
    let deckH = null
    const az = Math.abs(z)
    if (az <= 30)           deckH = DECK_TOP
    else if (az < 45)       deckH = DECK_TOP * (45 - az) / 15   // ramp slope
    // Only stand on the deck if we're already at/near its height (came up a ramp).
    // Otherwise we're walking UNDER it at street level.
    if (deckH !== null && currentY > deckH - STEP) h = Math.max(h, deckH)
  }
  return h
}
