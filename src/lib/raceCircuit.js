// Dedicated race circuit — ONE closed-loop rounded-rectangle track in an open
// area north of the city. Pure geometry data + containment math (no THREE here;
// the renderer in RaceCircuit.jsx builds meshes from this data).
//
// The circuit is impossible to get lost on: a continuous loop, a glowing guide
// line down the middle, big arrows, numbered gates, and barriers that physically
// keep the car on the track (see clampToCircuit, applied during a race).

// ── Track placement + shape ────────────────────────────────────────────────────
export const TRACK_CENTER = { x: 0, z: 430 }   // far north of the city, open ground
const AX = 130, AZ = 95, CR = 38               // half-extents (x,z) + corner radius

export const TRACK_WIDTH      = 20
export const TRACK_HALF_WIDTH = TRACK_WIDTH / 2          // 10
export const BARRIER_OFFSET   = TRACK_HALF_WIDTH + 0.2   // barrier wall centre-offset (at the asphalt edge)
export const BARRIER_HEIGHT   = 1.6
export const BARRIER_THICK    = 0.7                       // solid box thickness → visible from all angles
// Car centre kept inside this. Tuned so a clamped car's body just meets the
// barrier's inner face (BARRIER_OFFSET - BARRIER_THICK/2 ≈ 9.85) → the visible
// wall is exactly where the collision is.
const CONTAIN_HALF            = 8.7

const PTS_STRAIGHT = 24   // points along each long straight (half that on the split bottom)
const PTS_CORNER   = 12   // points per quarter-circle corner

// Build the centreline as an ordered loop of world-space points, travelling
// COUNTER-CLOCKWISE starting at the bottom-middle (the start/finish line),
// heading +x (east) first.
function buildCenterline() {
  const p = []
  const push = (x, z) => p.push({ x: TRACK_CENTER.x + x, z: TRACK_CENTER.z + z })
  const sx = AX - CR, sz = AZ - CR
  // 1) bottom-middle → bottom-right corner entry (z = -AZ, x: 0 → sx)
  for (let i = 0; i < PTS_STRAIGHT / 2; i++) push((i / (PTS_STRAIGHT / 2)) * sx, -AZ)
  // 2) bottom-right corner, centre (sx,-sz), angle -90° → 0°
  for (let i = 0; i <= PTS_CORNER; i++) { const a = -Math.PI / 2 + (i / PTS_CORNER) * (Math.PI / 2); push(sx + CR * Math.cos(a), -sz + CR * Math.sin(a)) }
  // 3) right straight (x = AX, z: -sz → sz)
  for (let i = 1; i <= PTS_STRAIGHT; i++) push(AX, -sz + (i / PTS_STRAIGHT) * (2 * sz))
  // 4) top-right corner, centre (sx,sz), 0° → 90°
  for (let i = 1; i <= PTS_CORNER; i++) { const a = (i / PTS_CORNER) * (Math.PI / 2); push(sx + CR * Math.cos(a), sz + CR * Math.sin(a)) }
  // 5) top straight (z = AZ, x: sx → -sx)
  for (let i = 1; i <= PTS_STRAIGHT; i++) push(sx - (i / PTS_STRAIGHT) * (2 * sx), AZ)
  // 6) top-left corner, centre (-sx,sz), 90° → 180°
  for (let i = 1; i <= PTS_CORNER; i++) { const a = Math.PI / 2 + (i / PTS_CORNER) * (Math.PI / 2); push(-sx + CR * Math.cos(a), sz + CR * Math.sin(a)) }
  // 7) left straight (x = -AX, z: sz → -sz)
  for (let i = 1; i <= PTS_STRAIGHT; i++) push(-AX, sz - (i / PTS_STRAIGHT) * (2 * sz))
  // 8) bottom-left corner, centre (-sx,-sz), 180° → 270°
  for (let i = 1; i <= PTS_CORNER; i++) { const a = Math.PI + (i / PTS_CORNER) * (Math.PI / 2); push(-sx + CR * Math.cos(a), -sz + CR * Math.sin(a)) }
  // 9) bottom straight back toward start (x: -sx → 0, exclusive of the start dup)
  for (let i = 1; i < PTS_STRAIGHT / 2; i++) push(-sx + (i / (PTS_STRAIGHT / 2)) * sx, -AZ)
  return p
}

export const CENTERLINE = buildCenterline()
const N = CENTERLINE.length

// Cumulative arc length around the loop (ARC[i] = distance from point 0 to i).
const SEG_LEN = new Array(N)
const ARC     = new Array(N)
let _acc = 0
for (let i = 0; i < N; i++) {
  ARC[i] = _acc
  const a = CENTERLINE[i], b = CENTERLINE[(i + 1) % N]
  SEG_LEN[i] = Math.hypot(b.x - a.x, b.z - a.z)
  _acc += SEG_LEN[i]
}
export const LOOP_LEN = _acc

// World position + travel direction at an arc distance `d` (wraps around the loop).
export function posAtDistance(d) {
  let dd = ((d % LOOP_LEN) + LOOP_LEN) % LOOP_LEN
  let i = 0
  while (i < N - 1 && ARC[i + 1] <= dd) i++
  const t = SEG_LEN[i] > 0 ? (dd - ARC[i]) / SEG_LEN[i] : 0
  const a = CENTERLINE[i], b = CENTERLINE[(i + 1) % N]
  let tx = b.x - a.x, tz = b.z - a.z
  const l = Math.hypot(tx, tz) || 1
  return { x: a.x + tx * t, z: a.z + tz * t, yaw: Math.atan2(tx / l, tz / l), tx: tx / l, tz: tz / l }
}

// Unit tangent (direction of travel) at a centreline index.
export function tangentAt(i) {
  const prev = CENTERLINE[(i - 1 + N) % N]
  const next = CENTERLINE[(i + 1) % N]
  let tx = next.x - prev.x, tz = next.z - prev.z
  const l = Math.hypot(tx, tz) || 1
  return { x: tx / l, z: tz / l }
}

// ── Checkpoint gates — 6 evenly spaced around the loop (gate 0 = start/finish) ──
export const NUM_GATES = 6
export const CHECKPOINTS = Array.from({ length: NUM_GATES }, (_, g) => {
  const idx = Math.round((g / NUM_GATES) * N) % N
  const t = tangentAt(idx)
  return { x: CENTERLINE[idx].x, z: CENTERLINE[idx].z, idx, yaw: Math.atan2(t.x, t.z) }
})

export const START = CHECKPOINTS[0]

// Starting grid — staggered slots just behind the start line (west, travel +x).
export const GRID = [
  { x: START.x - 12, z: START.z - 3 },
  { x: START.x - 12, z: START.z + 3 },
  { x: START.x - 20, z: START.z - 3 },
  { x: START.x - 20, z: START.z + 3 },
].map(s => ({ ...s, facing: Math.PI / 2 }))

// Arrow placements — every 12th centreline point.
export const ARROWS = []
for (let i = 6; i < N; i += 12) {
  const t = tangentAt(i)
  ARROWS.push({ x: CENTERLINE[i].x, z: CENTERLINE[i].z, yaw: Math.atan2(t.x, t.z) })
}

export const BBOX = {
  minX: TRACK_CENTER.x - (AX + BARRIER_OFFSET + 3),
  maxX: TRACK_CENTER.x + (AX + BARRIER_OFFSET + 3),
  minZ: TRACK_CENTER.z - (AZ + BARRIER_OFFSET + 3),
  maxZ: TRACK_CENTER.z + (AZ + BARRIER_OFFSET + 3),
}

// Down-sampled outline for the minimap (every 3rd point).
export const MINIMAP_PATH = CENTERLINE.filter((_, i) => i % 3 === 0)

// ── Containment ────────────────────────────────────────────────────────────────
// Nearest point on the centreline + perpendicular distance + arc distance.
function projectToTrack(x, z) {
  let best = Infinity, bx = x, bz = z, bi = 0, bt = 0
  for (let i = 0; i < N; i++) {
    const a = CENTERLINE[i], b = CENTERLINE[(i + 1) % N]
    const abx = b.x - a.x, abz = b.z - a.z
    const len2 = abx * abx + abz * abz || 1
    let t = ((x - a.x) * abx + (z - a.z) * abz) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = a.x + abx * t, pz = a.z + abz * t
    const d = (x - px) ** 2 + (z - pz) ** 2
    if (d < best) { best = d; bx = px; bz = pz; bi = i; bt = t }
  }
  return { x: bx, z: bz, dist: Math.sqrt(best), arc: ARC[bi] + bt * SEG_LEN[bi] }
}

// Arc distance (0..LOOP_LEN) of the centreline point nearest (x,z).
export function arcAtPosition(x, z) { return projectToTrack(x, z).arc }

// Clamp a position to the track corridor. hit=true means a barrier was touched.
export function clampToCircuit(x, z) {
  const c = projectToTrack(x, z)
  if (c.dist <= CONTAIN_HALF) return { x, z, hit: false }
  const nx = (x - c.x) / (c.dist || 1)
  const nz = (z - c.z) / (c.dist || 1)
  return { x: c.x + nx * CONTAIN_HALF, z: c.z + nz * CONTAIN_HALF, hit: true }
}

// True if (x,z) is within the circuit area (used to gate "Start Race").
export function nearCircuit(x, z, pad = 60) {
  const dx = Math.hypot(x - START.x, z - START.z)
  return dx < pad
}
