// Mutable flag — set false when any chat panel is open, true when closed.
// Read synchronously in keydown handlers and useFrame — no React overhead.
export const gameControls = { enabled: true }
