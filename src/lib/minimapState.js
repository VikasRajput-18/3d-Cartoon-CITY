// Shared mutable state written by PlayerController every frame, read by Minimap RAF loop.
// Plain object — no React, no overhead.
export const minimapState = {
  playerX: 0,
  playerZ: 0,
  playerFacing: 0,
  drivingType: null,   // null | 'car' | 'bike'
}

// Live NPC positions written by Avatar3D each frame.
// Each entry: { x, z, color } — color set once on mount, x/z mutated continuously.
export const npcLivePositions = []
