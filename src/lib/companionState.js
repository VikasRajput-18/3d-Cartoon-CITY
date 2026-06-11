// Live companion position + AI-override channel, shared between Companion3D (which
// owns the mesh) and companionChallenges (which drives the companion during games).
// Plain mutable object — no React overhead, read/written every frame.
export const companionState = {
  x: 0, z: 0,             // current world position (written by Companion3D each frame)
  targetOverride: null,   // { x, z, speed } — when set, Companion3D moves here instead of following the player
  hidden: false,          // hide-and-seek: render at low opacity
  faceTarget: false,      // face the override target instead of the player
  riding: false,          // race: companion sits on the spawned bike (raise + lean)
}
