import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { SwimmingPool, Airport } from './Locations'
import SunsetShore from './SunsetShore'
import { C } from '@/lib/designTokens'

const windowMat    = new THREE.MeshStandardMaterial({ color: '#1e293b', transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.2 })
const lampGlobeMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.1, emissive: '#000000' })
// Fake lamp light-pools: warm discs under each lamp, opacity-animated by
// DynamicLighting (0 by day → 0.32 at night). transparent:true from birth —
// never toggled at runtime (shader-recompile rule). Zero real point lights.
const lampPoolMat  = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0, depthWrite: false })

const APT_WIN = [
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b',
]


// ── Ground ──────────────────────────────────────────────────────────────────
// Storybook flat-tone grass: solid token base + two merged "tonal patch" meshes
// (light + shaded) for hand-painted variation. The photo texture fought the toon
// banding (muddy) and depended on an external URL — gouache patches read better
// and cost 2 static draw calls that CityMerger folds in anyway.
const GRASS_PATCHES = (() => {
  // Deterministic scatter, kept OUT of road corridors (|x|<8, |z|<8 strips,
  // z=±50 / x=±50 secondaries) and the plaza (|x|,|z|<22).
  const light = [], dark = []
  let s = 12345
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296 }
  for (let i = 0; i < 64; i++) {
    const x = (rnd() - 0.5) * 460
    const z = (rnd() - 0.5) * 460
    const r = 4 + rnd() * 9
    const nearRoad = Math.abs(x) < 9 || Math.abs(z) < 9 ||
      Math.abs(Math.abs(x) - 50) < 6 || Math.abs(Math.abs(z) - 50) < 6
    const inPlaza = Math.abs(x) < 23 && Math.abs(z) < 23
    if (nearRoad || inPlaza) continue
    ;(i % 2 ? light : dark).push([x, z, r])
  }
  const make = (list) => {
    const geos = list.map(([x, z, r]) => {
      const g = new THREE.CircleGeometry(r, 10)
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0.004, z))
      return g
    })
    if (!geos.length) return null
    const merged = mergeGeometries(geos, false)
    geos.forEach(g => g.dispose())
    return merged
  }
  return { light: make(light), dark: make(dark) }
})()

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color={C.grass} roughness={0.95} metalness={0} />
      </mesh>
      {GRASS_PATCHES.light && (
        <mesh geometry={GRASS_PATCHES.light}>
          <meshStandardMaterial color={C.grassLight} roughness={0.95} />
        </mesh>
      )}
      {GRASS_PATCHES.dark && (
        <mesh geometry={GRASS_PATCHES.dark}>
          <meshStandardMaterial color={C.grassDark} roughness={0.95} />
        </mesh>
      )}
    </group>
  )
}

// ── Road Network — 12-unit main highways, roundabout, secondary roads ────
// GTA-style spread: E-W highway runs x −290…150 (it dead-ends at Sunset Shore),
// N-S highway runs z ±250. Landmarks line these arms.
//
// ALL lane dashes are merged into ONE opaque geometry at module scope — the old
// version was 160 individual transparent meshes = 160 draw calls CityMerger
// could never batch. This is the single biggest draw-call win of the perf pass.
const ROAD_DASHES = (() => {
  const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
  const geos = []
  // E-W lanes (z = ±3), x −280 … 145
  for (let x = -280; x <= 145; x += 7) {
    for (const z of [-3, 3]) {
      const g = new THREE.PlaneGeometry(4, 0.15)
      g.applyMatrix4(flat)
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0.022, z))
      geos.push(g)
    }
  }
  // N-S lanes (x = ±3), z −245 … 245
  for (let z = -245; z <= 245; z += 7) {
    for (const x of [-3, 3]) {
      const g = new THREE.PlaneGeometry(0.15, 4)
      g.applyMatrix4(flat)
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0.022, z))
      geos.push(g)
    }
  }
  const merged = mergeGeometries(geos, false)
  geos.forEach(g => g.dispose())
  return merged
})()

// Roundabout lane marks — was 12 transparent meshes, now 1 merged opaque mesh
const RB_MARKS = (() => {
  const geos = []
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2
    const g = new THREE.PlaneGeometry(0.2, 1.5)
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(-ang))
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(Math.cos(ang) * 11, 0.025, Math.sin(ang) * 11))
    geos.push(g)
  }
  const merged = mergeGeometries(geos, false)
  geos.forEach(g => g.dispose())
  return merged
})()

function Roads() {
  const road    = C.asphalt
  const roadSec = C.asphaltSec
  const divider = C.lanePaint
  const path    = C.sidewalk

  return (
    <group>
      {/* Main E-W highway — x −290…150, dead-ends at the beach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-70, 0.01, 0]}>
        <planeGeometry args={[440, 12]} />
        <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Main N-S highway — z ±250 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[12, 500]} />
        <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Center dividers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-70, 0.025, 0]}>
        <planeGeometry args={[440, 0.25]} />
        <meshStandardMaterial color={divider} roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[0.25, 500]} />
        <meshStandardMaterial color={divider} roughness={0.7} />
      </mesh>

      {/* ALL lane dashes — one merged opaque mesh (was 160 transparent meshes) */}
      <mesh geometry={ROAD_DASHES}>
        <meshStandardMaterial color={C.laneYellow} roughness={0.75} />
      </mesh>

      {/* Secondary E-W roads — 8 wide */}
      {[-50, 50].map((z, i) => (
        <mesh key={`sec_ew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[300, 8]} />
          <meshStandardMaterial color={roadSec} roughness={0.92} />
        </mesh>
      ))}
      {/* Secondary N-S roads — 8 wide */}
      {[-50, 50].map((x, i) => (
        <mesh key={`sec_ns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[8, 300]} />
          <meshStandardMaterial color={roadSec} roughness={0.92} />
        </mesh>
      ))}

      {/* Roundabout at center — ring road platform (filled circle then inner circle mask) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[8, 14, 36]} />
        <meshStandardMaterial color={road} roughness={0.88} />
      </mesh>
      {/* Roundabout island (lush green heart of the plaza) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[7.5, 36]} />
        <meshStandardMaterial color={C.parkGrass} roughness={0.9} />
      </mesh>
      {/* Roundabout lane markings — one merged opaque mesh (was 12 transparent) */}
      <mesh geometry={RB_MARKS}>
        <meshStandardMaterial color={C.lanePaint} roughness={0.75} />
      </mesh>

      {/* Footpaths — warm concrete, 3 wide, beside main highways */}
      {[-7.5, 7.5].map((z, i) => (
        <mesh key={`fpew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-70, 0.012, z]}>
          <planeGeometry args={[440, 3]} />
          <meshStandardMaterial color={path} roughness={0.85} />
        </mesh>
      ))}
      {[-7.5, 7.5].map((x, i) => (
        <mesh key={`fpns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, 0]}>
          <planeGeometry args={[3, 500]} />
          <meshStandardMaterial color={path} roughness={0.85} />
        </mesh>
      ))}

      {/* Zebra crosswalks at the four roundabout exits — 6 warm-white stripes each */}
      {[
        { cx:  17, cz: 0, axis: 'x' },   // east exit
        { cx: -17, cz: 0, axis: 'x' },   // west exit
        { cx: 0, cz:  17, axis: 'z' },   // south exit
        { cx: 0, cz: -17, axis: 'z' },   // north exit
      ].flatMap(({ cx, cz, axis }, ci) =>
        [-4.2, -2.5, -0.85, 0.85, 2.5, 4.2].map((off, si) => (
          <mesh key={`zw${ci}_${si}`} rotation={[-Math.PI / 2, 0, 0]}
            position={axis === 'x' ? [cx, 0.028, cz + off] : [cx + off, 0.028, cz]}>
            <planeGeometry args={axis === 'x' ? [2.4, 1.0] : [1.0, 2.4]} />
            <meshStandardMaterial color={C.lanePaint} roughness={0.8} />
          </mesh>
        ))
      )}

      {/* Curbs lining the main highways — segments stop at the roundabout */}
      {[-6.3, 6.3].flatMap((z, i) => [[-148, 264], [80.5, 129]].map(([cx, len], j) => (
        <mesh key={`cbew${i}_${j}`} position={[cx, 0.06, z]}>
          <boxGeometry args={[len, 0.12, 0.35]} />
          <meshStandardMaterial color={C.curb} roughness={0.8} />
        </mesh>
      )))}
      {[-6.3, 6.3].flatMap((x, i) => [[-130.5, 229], [130.5, 229]].map(([cz, len], j) => (
        <mesh key={`cbns${i}_${j}`} position={[x, 0.06, cz]}>
          <boxGeometry args={[0.35, 0.12, len]} />
          <meshStandardMaterial color={C.curb} roughness={0.8} />
        </mesh>
      )))}
    </group>
  )
}

// ── Flyover — elevated at y=6, x≈20, runs z=-45 to z=45 ─────────────────
function Flyover() {
  const DECK_Y  = 6
  const DECK_W  = 8
  const railMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.6 })
  const deckMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 })
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.75 })

  const pillarZs = [-30, -15, 0, 15, 30]
  const FLY_X = 20

  return (
    <group>
      {/* Ramp south (z=30 to z=45, rises from y=0 to y=6) */}
      <mesh rotation={[-Math.PI / 2 + 0.39, 0, 0]} position={[FLY_X, 2.8, 38]}>
        <boxGeometry args={[DECK_W, 16.5, 0.35]} />
        <primitive object={deckMat} />
      </mesh>
      {/* Main deck z=-30 to z=30 */}
      <mesh position={[FLY_X, DECK_Y + 0.175, 0]}>
        <boxGeometry args={[DECK_W, 0.35, 60]} />
        <primitive object={deckMat} />
      </mesh>
      {/* Ramp north (z=-45 to z=-30) */}
      <mesh rotation={[Math.PI / 2 - 0.39, 0, 0]} position={[FLY_X, 2.8, -38]}>
        <boxGeometry args={[DECK_W, 16.5, 0.35]} />
        <primitive object={deckMat} />
      </mesh>

      {/* Concrete pillars */}
      {pillarZs.map((z, i) => (
        <group key={i} position={[FLY_X, 0, z]}>
          <mesh position={[0, DECK_Y / 2, 0]}>
            <boxGeometry args={[1.2, DECK_Y, 1.2]} />
            <primitive object={pillarMat} />
          </mesh>
          {/* Footing */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[2.2, 0.4, 2.2]} />
            <primitive object={pillarMat} />
          </mesh>
        </group>
      ))}

      {/* Safety railings — left side */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`rl${i}`} position={[FLY_X - DECK_W / 2 + 0.15, DECK_Y + 0.6, -28 + i * 3]}>
          <boxGeometry args={[0.12, 0.8, 0.12]} />
          <primitive object={railMat} />
        </mesh>
      ))}
      {/* Railing top bar left */}
      <mesh position={[FLY_X - DECK_W / 2 + 0.15, DECK_Y + 1.05, 0]}>
        <boxGeometry args={[0.08, 0.1, 60]} />
        <primitive object={railMat} />
      </mesh>
      {/* Safety railings — right side */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`rr${i}`} position={[FLY_X + DECK_W / 2 - 0.15, DECK_Y + 0.6, -28 + i * 3]}>
          <boxGeometry args={[0.12, 0.8, 0.12]} />
          <primitive object={railMat} />
        </mesh>
      ))}
      <mesh position={[FLY_X + DECK_W / 2 - 0.15, DECK_Y + 1.05, 0]}>
        <boxGeometry args={[0.08, 0.1, 60]} />
        <primitive object={railMat} />
      </mesh>
    </group>
  )
}

// ── City Center Plaza — 40×40 paved area ─────────────────────────────────
// ── City Plaza — the hero shot every player sees first ────────────────────
// Radial two-tone paving around the fountain, flower planters, warm lamps with
// night light-pools, storybook benches. All static parts are opaque + unflagged
// so CityMerger batches them by token colour.
function CityPlaza() {
  return (
    <group>
      {/* Paving base square */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[44, 44]} />
        <meshStandardMaterial color={C.plazaPave} roughness={0.88} />
      </mesh>
      {/* Radial paving rings — alternating warm tones drawing the eye to the fountain */}
      {[[8.2, 11, C.plazaPaveDark], [11, 14.2, C.plazaPave], [14.2, 17, C.plazaPaveDark], [17, 19.6, C.plazaPave]].map(([r0, r1, col], i) => (
        <mesh key={`ring${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012 + i * 0.0005, 0]}>
          <ringGeometry args={[r0, r1, 48]} />
          <meshStandardMaterial color={col} roughness={0.9} />
        </mesh>
      ))}
      {/* Compass accent ring just outside the roundabout island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[7.7, 8.1, 48]} />
        <meshStandardMaterial color={C.awningGold} roughness={0.7} />
      </mesh>

      {/* Flower planters at the inner ring — terracotta box, foliage, 3 blooms */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8
        const px = Math.cos(a) * 12.6, pz = Math.sin(a) * 12.6
        return (
          <group key={`plnt${i}`} position={[px, 0, pz]}>
            <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.5, 0.6, 1.5]} /><meshStandardMaterial color={C.wallTerracotta} roughness={0.8} /></mesh>
            <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.62, 8, 6]} /><meshStandardMaterial color={C.foliageMid} roughness={0.9} /></mesh>
            <mesh position={[-0.3, 0.92, 0.15]}><sphereGeometry args={[0.16, 6, 5]} /><meshStandardMaterial color={C.flowerRed} roughness={0.7} /></mesh>
            <mesh position={[0.28, 0.88, -0.1]}><sphereGeometry args={[0.15, 6, 5]} /><meshStandardMaterial color={C.flowerYellow} roughness={0.7} /></mesh>
            <mesh position={[0.05, 0.95, 0.32]}><sphereGeometry args={[0.14, 6, 5]} /><meshStandardMaterial color={C.flowerPink} roughness={0.7} /></mesh>
          </group>
        )
      })}

      {/* Plaza benches — storybook wood */}
      {[[0, -15.6, 0], [0, 15.6, Math.PI], [15.6, 0, -Math.PI / 2], [-15.6, 0, Math.PI / 2]].map(([x, z, ry], i) => (
        <group key={`pb${i}`} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.2, 0.1, 0.5]} /><meshStandardMaterial color={C.trim} roughness={0.7} /></mesh>
          <mesh position={[0, 0.25, -0.2]}><boxGeometry args={[2.2, 0.3, 0.1]} /><meshStandardMaterial color={C.trim} roughness={0.7} /></mesh>
          {[-0.9, 0.9].map((bx, j) => (
            <mesh key={j} position={[bx, 0.2, 0]}><boxGeometry args={[0.1, 0.4, 0.45]} /><meshStandardMaterial color={C.trimDark} /></mesh>
          ))}
        </group>
      ))}

      {/* Street lamps around plaza */}
      {[[-14, -14], [14, -14], [-14, 14], [14, 14], [0, -18], [0, 18], [-18, 0], [18, 0]].map(([x, z], i) => (
        <group key={`pl${i}`} position={[x, 0, z]}>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.07, 0.1, 4, 6]} /><meshStandardMaterial color={C.metal} /></mesh>
          <mesh position={[0.3, 4.1, 0]}><cylinderGeometry args={[0.04, 0.04, 0.7, 6]} rotation={[0, 0, Math.PI / 2]} /><meshStandardMaterial color={C.metal} /></mesh>
          <mesh position={[0.3, 4.4, 0]}><sphereGeometry args={[0.16, 8, 6]} /><primitive object={lampGlobeMat} /></mesh>
        </group>
      ))}

      {/* Bollards at plaza edges */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`boll${i}`} position={[-17.5 + i * 5, 0.35, -19.8]}>
          <cylinderGeometry args={[0.12, 0.14, 0.7, 8]} />
          <meshStandardMaterial color={C.metal} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// ── Reusable Building ─────────────────────────────────────────────────────
// Original primitive building — kept as the Suspense fallback so the city never
// breaks if a GLTF fails to load.
// Building "characters" give the city designed variety from one component:
//   shop      → awning over the door, gold trim band, parapet roof
//   office    → cool slate, flat roof + AC unit, no awning
//   apartment → warm walls, clay roof slab, water tank
//   civic     → cream, stepped roof cap
// The character + accent colours derive deterministically from position so the
// same city generates every load. All parts opaque + static → CityMerger batches.
const AWNING_COLORS = [C.awningRed, C.awningTeal, C.awningGold]

function BuildingPrimitive({ pos, w = 2, d = 2, h = 4, color = C.wallCream, roof = C.roofClay, character = null }) {
  const seed = Math.abs(Math.round(pos[0] * 7 + pos[2] * 13))
  const kind = character || ['shop', 'apartment', 'office', 'shop'][seed % 4]
  const awningCol = AWNING_COLORS[seed % 3]
  const doorW = Math.min(1.1, w * 0.28)

  // Window grid (shared windowMat → warm glow at night via DynamicLighting)
  const cols = Math.max(2, Math.round(w / 1.4))
  const rows = Math.max(1, Math.round((h - 1.2) / 1.4))
  const wins = []
  for (let r = 0; r < rows; r++) {
    const wy = 1.4 + r * 1.4
    if (wy > h - 0.5) break
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + (c + 1) * (w / (cols + 1))
      wins.push([wx, wy])
    }
  }
  const winW = (w / (cols + 1)) * 0.62

  return (
    <group position={pos}>
      {/* body */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
      </mesh>
      {/* toon outline */}
      <mesh position={[0, h / 2, 0]} scale={[1.025, 1.01, 1.025]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>

      {/* ground-floor trim band (shop/civic) */}
      {(kind === 'shop' || kind === 'civic') && (
        <mesh position={[0, 1.95, 0]}>
          <boxGeometry args={[w + 0.08, 0.22, d + 0.08]} />
          <meshStandardMaterial color={kind === 'shop' ? awningCol : C.trim} roughness={0.6} />
        </mesh>
      )}

      {/* roofline by character */}
      {kind === 'office' ? (
        <>
          {/* flat roof + parapet rim + AC unit */}
          <mesh position={[0, h + 0.1, 0]}>
            <boxGeometry args={[w + 0.12, 0.2, d + 0.12]} />
            <meshStandardMaterial color={C.roofSlate} roughness={0.6} />
          </mesh>
          <mesh position={[0, h + 0.32, 0]}>
            <boxGeometry args={[w + 0.18, 0.24, d + 0.18]} />
            <meshStandardMaterial color={C.curb} roughness={0.7} />
          </mesh>
          <mesh position={[w * 0.22, h + 0.55, -d * 0.15]}>
            <boxGeometry args={[0.8, 0.5, 0.6]} />
            <meshStandardMaterial color={C.rooftopUnit} roughness={0.6} />
          </mesh>
        </>
      ) : kind === 'apartment' ? (
        <>
          <mesh position={[0, h + 0.15, 0]}>
            <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
            <meshStandardMaterial color={roof} roughness={0.55} />
          </mesh>
          {/* rooftop water tank */}
          <mesh position={[-w * 0.22, h + 0.75, d * 0.12]}>
            <cylinderGeometry args={[0.38, 0.38, 0.9, 8]} />
            <meshStandardMaterial color={C.rooftopUnit} roughness={0.6} />
          </mesh>
        </>
      ) : (
        <>
          {/* shop/civic: roof slab + stepped cap */}
          <mesh position={[0, h + 0.15, 0]}>
            <boxGeometry args={[w + 0.15, 0.3, d + 0.15]} />
            <meshStandardMaterial color={roof} roughness={0.5} />
          </mesh>
          <mesh position={[0, h + 0.38, 0]}>
            <boxGeometry args={[w * 0.55, 0.22, d * 0.55]} />
            <meshStandardMaterial color={roof} roughness={0.6} />
          </mesh>
        </>
      )}

      {/* door */}
      <mesh position={[0, 0.7, d / 2 + 0.04]}>
        <boxGeometry args={[doorW, 1.4, 0.08]} />
        <meshStandardMaterial color={C.trimDark} roughness={0.7} />
      </mesh>
      {/* shop awning over the door */}
      {kind === 'shop' && (
        <mesh position={[0, 1.62, d / 2 + 0.38]} rotation={[0.42, 0, 0]}>
          <boxGeometry args={[doorW + 0.9, 0.07, 0.95]} />
          <meshStandardMaterial color={awningCol} roughness={0.65} />
        </mesh>
      )}

      {/* windows on front (+z) and back (−z) */}
      {wins.map(([wx, wy], i) => (
        <group key={i}>
          <mesh position={[wx, wy, d / 2 + 0.03]} material={windowMat}>
            <planeGeometry args={[winW, 0.6]} />
          </mesh>
          <mesh position={[wx, wy, -d / 2 - 0.03]} rotation={[0, Math.PI, 0]} material={windowMat}>
            <planeGeometry args={[winW, 0.6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// REVERTED: render the original primitive building. The GLTF swap produced
// red untextured blocks at wrong scale, so we are back to the working version
// until assets are measured and verified (see MeasureAsset debug component).
function Building(props) {
  return <BuildingPrimitive {...props} />
}

// ── House ─────────────────────────────────────────────────────────────────
function House({ pos, color = '#e8d5b7', roofColor = '#8b3a2a', rotate = 0 }) {
  return (
    <group position={pos} rotation={[0, rotate, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[3, 2.4, 3]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.03} />
      </mesh>
      <mesh position={[0, 1.2, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[3, 2.4, 3]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.2, 1.6, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      <mesh position={[0, 0.6, 1.52]}>
        <boxGeometry args={[0.6, 1.2, 0.05]} />
        <meshStandardMaterial color="#6b4226" />
      </mesh>
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 1.52]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[3.3, 0.12, 3.3]} />
        <meshStandardMaterial color="#b8a88a" />
      </mesh>
    </group>
  )
}

// ── GLB Trees ─────────────────────────────────────────────────────────────
// Tree placements: [x, z, scale, variant] — variant 0 = round deciduous,
// 1 = pine. MUST stay in sync with the tree collision circles in
// playerColliders.js (tree-0 … tree-17, same order, same positions).
const TREE_DATA = [
  // E-W highway south footpath (z=-9) — alternating shapes
  [-36,-9,.85,0],[-12,-9,.85,1],[12,-9,.85,0],[36,-9,.85,1],
  // E-W highway north footpath (z=9)
  [-24, 9,.85,1],[24, 9,.85,0],
  // N-S highway west footpath (x=-9)
  [-9,-36,.85,0],[-9,12,.85,1],
  // N-S highway east footpath (x=9)
  [ 9,-24,.85,1],[ 9,36,.85,0],
  // SE residential edge
  [44,38,.8,0],[28,48,.8,1],
  // Park cluster (collision: tree-12 … tree-15) — park at (-18, 170)
  [-25,169.5,1.0,0],[-11,169.5,.9,0],[-24.5,176.5,.95,1],[-11.5,176.5,1.05,0],
  // Playground corners (tree-16, tree-17) — playground at (-18, 130)
  [-28.5,124,.9,0],[-7.5,136,.9,1],
]

// Canopy geometries built ONCE at module scope and merged — a deciduous canopy
// is 3 blended spheres, a pine is 2 stacked cones, yet each variant renders as
// ONE InstancedMesh. 3 instanced draws total for every tree in the city.
const TREE_GEO = (() => {
  const t = (g, x, y, z) => { g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z)); return g }
  const decid = mergeGeometries([
    t(new THREE.SphereGeometry(1.45, 9, 7), 0, 3.6, 0),
    t(new THREE.SphereGeometry(1.05, 8, 6), 0.95, 3.0, 0.35),
    t(new THREE.SphereGeometry(0.95, 8, 6), -0.85, 3.1, -0.3),
  ], false)
  const pine = mergeGeometries([
    t(new THREE.ConeGeometry(1.5, 2.4, 8), 0, 3.0, 0),
    t(new THREE.ConeGeometry(1.1, 1.9, 8), 0, 4.6, 0),
  ], false)
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6)
  return { decid, pine, trunk }
})()
const TREE_MATS = {
  trunk: new THREE.MeshToonMaterial({ color: C.trunk }),
  decid: new THREE.MeshToonMaterial({ color: C.foliageMid }),
  pine:  new THREE.MeshToonMaterial({ color: C.foliageDark }),
}

function VarietyTrees({ placements }) {
  const trunkRef = useRef()
  const decidRef = useRef()
  const pineRef  = useRef()
  const decids = useMemo(() => placements.filter(p => (p[3] ?? 0) === 0), [placements])
  const pines  = useMemo(() => placements.filter(p => (p[3] ?? 0) === 1), [placements])

  useEffect(() => {
    const d = new THREE.Object3D()
    placements.forEach(([x, z, s = 1], i) => {
      d.position.set(x, 1.3 * s, z); d.scale.setScalar(s)
      d.rotation.set(0, (x * 13 + z * 7) % 6.28, 0)
      d.updateMatrix(); trunkRef.current?.setMatrixAt(i, d.matrix)
    })
    const place = (ref, list) => {
      list.forEach(([x, z, s = 1], i) => {
        d.position.set(x, 0, z); d.scale.setScalar(s)
        d.rotation.set(0, (x * 13 + z * 7) % 6.28, 0)
        d.updateMatrix(); ref.current?.setMatrixAt(i, d.matrix)
      })
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true
    }
    place(decidRef, decids); place(pineRef, pines)
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true
  }, [placements, decids, pines])

  return (
    <>
      <instancedMesh ref={trunkRef} args={[TREE_GEO.trunk, TREE_MATS.trunk, placements.length]} frustumCulled={false} />
      <instancedMesh ref={decidRef} args={[TREE_GEO.decid, TREE_MATS.decid, Math.max(1, decids.length)]} frustumCulled={false} />
      <instancedMesh ref={pineRef}  args={[TREE_GEO.pine,  TREE_MATS.pine,  Math.max(1, pines.length)]} frustumCulled={false} />
    </>
  )
}

function GLBTrees() {
  return <VarietyTrees placements={TREE_DATA} />
}

// ── Instanced Lamps ───────────────────────────────────────────────────────
const LAMP_DATA = [
  // Plaza
  [-14,-14],[14,-14],[-14,14],[14,14],[0,-18],[0,18],[-18,0],[18,0],
  // Along main highways
  [-40,-9],[-24,-9],[-12,-9],[12,-9],[24,-9],[40,-9],
  [-40, 9],[-24, 9],[-12, 9],[12, 9],[24, 9],[40, 9],
  [-9,-40],[-9,-24],[-9,-12],[-9,12],[-9,24],[-9,40],
  [ 9,-40],[ 9,-24],[ 9,-12],[ 9,12],[ 9,24],[ 9,40],
  // SE district
  [24,24],[36,24],[48,24],[24,36],[36,36],[48,36],[24,46],[36,46],[48,46],
  // NW district
  [-24,24],[-36,24],[-24,36],[-36,36],
]

function InstancedLamps() {
  const poleRef = useRef(), armRef = useRef(), globeRef = useRef()
  const N = LAMP_DATA.length

  useEffect(() => {
    const d = new THREE.Object3D()
    LAMP_DATA.forEach(([x, z], i) => {
      d.position.set(x,      1.5, z); d.updateMatrix(); poleRef.current.setMatrixAt(i, d.matrix)
      d.position.set(x + .3, 3.1, z); d.updateMatrix(); armRef.current.setMatrixAt(i, d.matrix)
      d.position.set(x + .3, 3.4, z); d.updateMatrix(); globeRef.current.setMatrixAt(i, d.matrix)
    })
    poleRef.current.instanceMatrix.needsUpdate  = true
    armRef.current.instanceMatrix.needsUpdate   = true
    globeRef.current.instanceMatrix.needsUpdate = true
  }, [])

  // All lamp light-pools merged into ONE geometry / ONE draw call. Shared
  // lampPoolMat opacity is driven by DynamicLighting (0 day → 0.32 night).
  const poolGeo = useMemo(() => {
    const geos = LAMP_DATA.map(([x, z]) => {
      const g = new THREE.CircleGeometry(2.1, 12)
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(x + 0.3, 0.018, z))
      return g
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach(g => g.dispose())
    return merged
  }, [])

  return (
    <>
      <instancedMesh ref={poleRef} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.07, 3, 6]} /><meshStandardMaterial color={C.metal} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} /><meshStandardMaterial color={C.metal} />
      </instancedMesh>
      <instancedMesh ref={globeRef} args={[null, null, N]} frustumCulled={false}>
        <sphereGeometry args={[0.14, 8, 6]} /><primitive object={lampGlobeMat} />
      </instancedMesh>
      <mesh geometry={poolGeo} material={lampPoolMat} userData={{ noMerge: true }} />
    </>
  )
}

// ── Traffic Lights ─────────────────────────────────────────────────────────
const TL_POS = [
  [ 7, 0,-7],[-7, 0, 7],[ 7, 0, 7],[-7, 0,-7],
  [ 55,0,-7],[-55,0, 7],[7, 0,-55],[-7,0, 55],
]
const TL_ON  = ['#ef4444','#facc15','#22c55e']
const TL_OFF = ['#3a0000','#3a2e00','#003a0f']
const TL_DUR = [3, 0.6, 3]

function TrafficLights() {
  const lRefs  = useRef([])
  const phases = useRef(TL_POS.map(() => 0))
  const timers = useRef(TL_POS.map(() => Math.random() * 3))

  useFrame((_, delta) => {
    for (let li = 0; li < TL_POS.length; li++) {
      timers.current[li] += delta
      if (timers.current[li] >= TL_DUR[phases.current[li]]) {
        timers.current[li] = 0
        phases.current[li] = (phases.current[li] + 1) % 3
        const p = phases.current[li]
        for (let ci = 0; ci < 3; ci++) {
          const m = lRefs.current[li * 3 + ci]
          if (m) m.material.color.set(ci === p ? TL_ON[ci] : TL_OFF[ci])
        }
      }
    }
  })

  return (
    <>
      {TL_POS.map((pos, li) => (
        <group key={li} position={pos}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 3.2, 6]} /><meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 3.4, 0]}>
            <boxGeometry args={[0.32, 0.88, 0.28]} /><meshStandardMaterial color="#1e293b" />
          </mesh>
          {[3.7, 3.4, 3.1].map((y, ci) => (
            <mesh key={ci} ref={el => { lRefs.current[li * 3 + ci] = el }} position={[0, y, 0.15]}>
              <circleGeometry args={[0.09, 8]} /><meshBasicMaterial color={ci === 0 ? TL_ON[0] : TL_OFF[ci]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

// ── Fountain ─────────────────────────────────────────────────────────────
// ── Grand fountain — 3 stone tiers, animated spray + expanding foam ripples ──
// Water/foam materials are born transparent (opacity-only animation, never a
// runtime transparent toggle). Collision circle updated in playerColliders.js.
function Fountain({ pos = [0, 0, 0] }) {
  const sprayRef  = useRef()
  const ripple1   = useRef()
  const ripple2   = useRef()
  const topWater  = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (sprayRef.current) {
      sprayRef.current.scale.y = 0.75 + Math.sin(t * 3.5) * 0.3
      sprayRef.current.scale.x = sprayRef.current.scale.z = 1 + Math.sin(t * 7) * 0.08
    }
    // Expanding foam rings sell the water motion (uniform discs rotating show nothing)
    const phase1 = (t * 0.5) % 1, phase2 = ((t * 0.5) + 0.5) % 1
    if (ripple1.current) {
      ripple1.current.scale.setScalar(1 + phase1 * 0.65)
      ripple1.current.material.opacity = 0.5 * (1 - phase1)
    }
    if (ripple2.current) {
      ripple2.current.scale.setScalar(1 + phase2 * 0.65)
      ripple2.current.material.opacity = 0.5 * (1 - phase2)
    }
    if (topWater.current) topWater.current.position.y = 2.62 + Math.sin(t * 2.2) * 0.03
  })
  return (
    <group position={pos}>
      {/* wide stone basin */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[3.4, 3.8, 0.62, 20]} />
        <meshStandardMaterial color={C.plazaPaveDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[3.55, 3.55, 0.14, 20]} />
        <meshStandardMaterial color={C.plazaPave} roughness={0.8} />
      </mesh>
      {/* basin water */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[3.25, 3.25, 0.08, 20]} />
        <meshStandardMaterial color={C.waterShallow} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      {/* foam ripples (animated scale + opacity) */}
      <mesh ref={ripple1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.64, 0]}>
        <ringGeometry args={[1.7, 1.85, 24]} />
        <meshBasicMaterial color={C.foam} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh ref={ripple2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.64, 0]}>
        <ringGeometry args={[1.7, 1.85, 24]} />
        <meshBasicMaterial color={C.foam} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {/* mid tier */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.5, 0.7, 0.9, 12]} />
        <meshStandardMaterial color={C.plazaPaveDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[1.7, 1.45, 0.35, 16]} />
        <meshStandardMaterial color={C.plazaPave} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.74, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.07, 16]} />
        <meshStandardMaterial color={C.waterShallow} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      {/* top tier */}
      <mesh position={[0, 2.12, 0]}>
        <cylinderGeometry args={[0.28, 0.4, 0.55, 10]} />
        <meshStandardMaterial color={C.plazaPaveDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.52, 0]}>
        <cylinderGeometry args={[0.85, 0.72, 0.28, 14]} />
        <meshStandardMaterial color={C.plazaPave} roughness={0.8} />
      </mesh>
      <mesh ref={topWater} position={[0, 2.62, 0]}>
        <cylinderGeometry args={[0.74, 0.74, 0.06, 14]} />
        <meshStandardMaterial color={C.waterShallow} transparent opacity={0.85} roughness={0.15} />
      </mesh>
      {/* spray */}
      <mesh ref={sprayRef} position={[0, 3.15, 0]}>
        <coneGeometry args={[0.3, 0.85, 8]} />
        <meshStandardMaterial color={C.foam} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ── City Hall ─────────────────────────────────────────────────────────────
function CityHall() {
  const flagRef = useRef()
  useFrame(({ clock }) => {
    if (flagRef.current) flagRef.current.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.18
  })
  return (
    <group position={[-18, 0, -90]}>
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[10.4, 8, 6.4]} />
        <meshStandardMaterial color="#f5f2ec" roughness={0.5} />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10.4, 8, 6.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 8.6, 0]}>
        <sphereGeometry args={[2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.5} />
      </mesh>
      {[-3.5, -1.2, 1.2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 3.5, 3.3]}>
          <cylinderGeometry args={[0.24, 0.3, 7, 8]} />
          <meshStandardMaterial color="#ede9e0" roughness={0.55} />
        </mesh>
      ))}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, i * 0.15 + 0.08, 3.3 + i * 0.3]}>
          <boxGeometry args={[9.5, 0.15, 0.6]} />
          <meshStandardMaterial color="#e2ddd5" />
        </mesh>
      ))}
      {[-3, 0, 3].map((x, j) => [5.5, 2.5].map((y, k) => (
        <mesh key={`${j}${k}`} position={[x, y, 3.26]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      )))}
      <mesh position={[0, 11.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} />
      </mesh>
      <mesh ref={flagRef} position={[0.85, 12.8, 0]}>
        <planeGeometry args={[1.7, 0.9]} />
        <meshStandardMaterial color="#ef4444" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ── Shopping Mall ─────────────────────────────────────────────────────────
function Mall() {
  const signRef = useRef()
  useFrame(({ clock }) => {
    if (signRef.current) signRef.current.material.opacity = 0.65 + Math.sin(clock.elapsedTime * 4) * 0.35
  })
  return (
    <group position={[-22, 0, 205]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[14.4, 6, 8.4]} />
        <meshStandardMaterial color="#e8ddd0" roughness={0.55} />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[14.4, 6, 8.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.15, 0]}>
        <boxGeometry args={[14.6, 0.3, 8.6]} />
        <meshStandardMaterial color="#8a7560" roughness={0.6} />
      </mesh>
      <mesh position={[0, 6.6, 0]}>
        <sphereGeometry args={[2.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ddd8d0" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 2.6, 4.3]}>
        <boxGeometry args={[5.2, 5.2, 0.5]} />
        <meshStandardMaterial color="#c8bfb0" roughness={0.6} />
      </mesh>
      <mesh ref={signRef} position={[0, 5.5, 4.6]}>
        <planeGeometry args={[6.5, 0.6]} />
        <meshBasicMaterial color="#b45309" transparent opacity={0.9} />
      </mesh>
      {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 4.26]}>
          <planeGeometry args={[1.8, 2.4]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ── Cinema ────────────────────────────────────────────────────────────────
function Cinema() {
  const marqueeRef = useRef()
  useFrame(({ clock }) => {
    if (marqueeRef.current) marqueeRef.current.material.color.setHSL((clock.elapsedTime * 0.18) % 1, 0.6, 0.35)
  })
  return (
    <group position={[18, 0, 90]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[10.4, 7, 7.6]} />
        <meshStandardMaterial color="#2c2c38" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10.4, 7, 7.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}>
        <boxGeometry args={[10.6, 0.3, 7.8]} />
        <meshStandardMaterial color="#3a3a4a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5, 3.9]}>
        <boxGeometry args={[9.6, 2.6, 0.3]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.7} />
      </mesh>
      <mesh ref={marqueeRef} position={[0, 5, 4.06]}>
        <planeGeometry args={[9, 2.2]} />
        <meshBasicMaterial color="#5c4a30" transparent opacity={0.95} />
      </mesh>
      {[-3.5, -2, -0.5, 0.5, 2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 6.3, 4.07]}>
          <circleGeometry args={[0.1, 5]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 3.91]}>
        <boxGeometry args={[4.4, 5, 0.3]} />
        <meshStandardMaterial color="#111118" roughness={0.8} />
      </mesh>
    </group>
  )
}

// ── Supermarket ────────────────────────────────────────────────────────────
function Supermarket() {
  return (
    <group position={[-120, 0, 16]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[12.4, 4, 8.4]} />
        <meshStandardMaterial color="#eae4d8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[12.4, 4, 8.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[12.6, 0.3, 8.6]} />
        <meshStandardMaterial color="#5a7a50" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.6, 4.3]}>
        <boxGeometry args={[12.4, 0.2, 1.4]} />
        <meshStandardMaterial color="#4a6a40" roughness={0.7} />
      </mesh>
      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, 1.8, 4.26]}>
          <planeGeometry args={[2.6, 3.2]} />
          <meshBasicMaterial color="#c8e4f8" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ── Bank ──────────────────────────────────────────────────────────────────
function Bank() {
  return (
    <group position={[135, 0, 16]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[8.4, 6, 5.6]} />
        <meshStandardMaterial color="#f0e8d5" roughness={0.55} />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[8.4, 6, 5.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.2, 0]}>
        <boxGeometry args={[8.6, 0.4, 5.8]} />
        <meshStandardMaterial color="#8a6a3a" roughness={0.6} />
      </mesh>
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={i} position={[x, 3, 2.9]}>
          <cylinderGeometry args={[0.22, 0.27, 6, 8]} />
          <meshStandardMaterial color="#e8dccc" roughness={0.6} />
        </mesh>
      ))}
      {[-2.5, 0, 2.5].map((x, i) => [4.5, 2].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 2.86]}>
          <planeGeometry args={[1.3, 1.7]} />
          <meshBasicMaterial color="#bfdbfe" transparent opacity={0.6} />
        </mesh>
      )))}
    </group>
  )
}

// ── Hospital ─────────────────────────────────────────────────────────────
function Hospital() {
  return (
    <group position={[100, 0, 16]}>
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[9.6, 8, 6.4]} />
        <meshStandardMaterial color="#f0f8ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[9.6, 8, 6.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 8.15, 0]}>
        <boxGeometry args={[9.8, 0.3, 6.6]} />
        <meshStandardMaterial color="#6a9ec0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5, 3.26]}><planeGeometry args={[0.55, 1.7]} /><meshBasicMaterial color="#ef4444" /></mesh>
      <mesh position={[0, 5, 3.27]}><planeGeometry args={[1.7, 0.55]} /><meshBasicMaterial color="#ef4444" /></mesh>
      {[-2, 0, 2].map((x, i) => [7, 5, 3].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.26]}>
          <planeGeometry args={[1, 1.2]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.9} />
        </mesh>
      )))}
      <mesh position={[0, 1.5, 3.75]}>
        <boxGeometry args={[3.5, 3, 1.4]} />
        <meshStandardMaterial color="#e0f2fe" roughness={0.5} />
      </mesh>
    </group>
  )
}

// ── Police Station ─────────────────────────────────────────────────────────
function PoliceStation() {
  return (
    <group position={[120, 0, -16]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[5.6, 5, 5.6]} />
        <meshStandardMaterial color="#2a3a5a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5.6, 5, 5.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[5.8, 0.3, 5.8]} /><meshStandardMaterial color="#364870" /></mesh>
      <mesh position={[0, 3, 2.86]}><circleGeometry args={[0.7, 5]} /><meshBasicMaterial color="#c8a820" /></mesh>
      <mesh position={[0, 3, 2.87]}><circleGeometry args={[0.4, 8]} /><meshBasicMaterial color="#2a3a5a" /></mesh>
      {[-1.4, 1.4].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.86]}>
          <planeGeometry args={[1, 1.3]} />
          <meshBasicMaterial color="#7a9ab8" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  )
}

// ── Fire Station ──────────────────────────────────────────────────────────
function FireStation() {
  return (
    <group position={[18, 0, -200]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshStandardMaterial color="#8a2020" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[7.8, 0.3, 5.8]} /><meshStandardMaterial color="#6e1818" /></mesh>
      {[-2.4, 0, 2.4].map((x, i) => (
        <group key={i} position={[x, 0, 2.86]}>
          <mesh position={[0, 1.5, 0]}><planeGeometry args={[1.9, 3.2]} /><meshBasicMaterial color="#7a1818" /></mesh>
          {[0.6, 1.1, 1.6, 2.1, 2.6].map((y, j) => (
            <mesh key={j} position={[0, y, 0.01]}><planeGeometry args={[1.9, 0.07]} /><meshBasicMaterial color="#5a1010" /></mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ── School ────────────────────────────────────────────────────────────────
function School() {
  return (
    <group position={[-160, 0, 16]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[9.6, 7, 6.4]} />
        <meshStandardMaterial color="#d4c88a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[9.6, 7, 6.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}><boxGeometry args={[9.8, 0.3, 6.6]} /><meshStandardMaterial color="#b0965a" /></mesh>
      <mesh position={[0, 8, 0]}><boxGeometry args={[2.2, 2, 2.2]} /><meshStandardMaterial color="#c8b870" /></mesh>
      <mesh position={[0, 9.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.6, 1.8, 4]} /><meshStandardMaterial color="#a07840" />
      </mesh>
      {[-3, -1, 1, 3].map((x, i) => [5, 2.5].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.26]}>
          <planeGeometry args={[1.4, 1.7]} />
          <meshBasicMaterial color="#d4e8c4" transparent opacity={0.85} />
        </mesh>
      )))}
      <mesh position={[0, 1.6, 3.35]}><boxGeometry args={[3, 3.2, 0.4]} /><meshStandardMaterial color="#b09550" /></mesh>
    </group>
  )
}

// ── Library ───────────────────────────────────────────────────────────────
function Library() {
  return (
    <group position={[-130, 0, -16]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[8.4, 5, 5.6]} />
        <meshStandardMaterial color="#c8b896" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[8.4, 5, 5.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[8.6, 0.3, 5.8]} /><meshStandardMaterial color="#8a6840" /></mesh>
      {[-2.5, 0, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.86]}>
          <planeGeometry args={[1.5, 2.4]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  )
}

// ── Gym ───────────────────────────────────────────────────────────────────
function Gym() {
  return (
    <group position={[-18, 0, -140]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[6.4, 5, 6.4]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[6.4, 5, 6.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[6.6, 0.3, 6.6]} /><meshStandardMaterial color="#3a3a50" /></mesh>
      <mesh position={[0, 3, 3.26]}><planeGeometry args={[3.5, 2.2]} /><meshBasicMaterial color="#d4a820" transparent opacity={0.85} /></mesh>
    </group>
  )
}

// ── Restaurant ────────────────────────────────────────────────────────────
function Restaurant() {
  return (
    <group position={[18, 0, 135]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshStandardMaterial color="#f0e8d4" roughness={0.55} />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[7.8, 0.3, 5.8]} /><meshStandardMaterial color="#8a6030" /></mesh>
      <mesh position={[0, 3.4, 2.86]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[7.8, 0.12, 1.8]} /><meshStandardMaterial color="#6a4820" />
      </mesh>
      {[-2, 0, 2].map((x, i) => (
        <group key={i} position={[x, 0, 4.2]}>
          <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.38, 0.38, 0.07, 8]} /><meshStandardMaterial color="#d4a870" /></mesh>
          <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.04, 0.04, 0.8, 6]} /><meshStandardMaterial color="#8a6840" /></mesh>
        </group>
      ))}
    </group>
  )
}

// ── Gas Station ───────────────────────────────────────────────────────────
function GasStation() {
  const signRef = useRef()
  useFrame(({ clock }) => {
    if (signRef.current) signRef.current.material.opacity = clock.elapsedTime % 1.2 < 0.6 ? 1 : 0.35
  })
  return (
    <group position={[65, 0, 16]}>
      <mesh position={[0, 1.5, -1.5]}>
        <boxGeometry args={[4.2, 3, 3.2]} />
        <meshStandardMaterial color="#f0ece4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.5, -1.5]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[4.2, 3, 3.2]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 3.5, 0.8]}><boxGeometry args={[9.5, 0.2, 7.2]} /><meshStandardMaterial color="#d0502a" /></mesh>
      {[-3.8, 3.8].map((x, i) => (
        <mesh key={i} position={[x, 1.75, 0.8]}>
          <cylinderGeometry args={[0.13, 0.16, 3.5, 6]} />
          <meshStandardMaterial color="#7a8090" roughness={0.8} />
        </mesh>
      ))}
      {[-1.5, 0, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 1.8]}>
          <mesh position={[0, 1, 0]}><boxGeometry args={[0.5, 2, 0.35]} /><meshStandardMaterial color="#475569" /></mesh>
          <mesh position={[0, 1.2, 0.2]}><planeGeometry args={[0.34, 0.22]} /><meshBasicMaterial color="#fbbf24" /></mesh>
        </group>
      ))}
      <mesh ref={signRef} position={[0, 3, -3.26]}>
        <planeGeometry args={[3.8, 1.3]} />
        <meshBasicMaterial color="#c04820" transparent opacity={1} />
      </mesh>
    </group>
  )
}

// ── Church ────────────────────────────────────────────────────────────────
function Church() {
  return (
    <group position={[-185, 0, -18]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[6.4, 6, 7.6]} />
        <meshStandardMaterial color="#ede8e0" roughness={0.55} />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[6.4, 6, 7.6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7, 0]}><boxGeometry args={[2.8, 3, 2.8]} /><meshStandardMaterial color="#ddd8d0" /></mesh>
      <mesh position={[0, 9.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.6, 3.4, 4]} /><meshStandardMaterial color="#8a8a98" />
      </mesh>
      <mesh position={[0, 11.4, 0]}><boxGeometry args={[0.15, 1.1, 0.15]} /><meshStandardMaterial color="#c8a030" /></mesh>
      <mesh position={[0, 11.7, 0]}><boxGeometry args={[0.65, 0.15, 0.15]} /><meshStandardMaterial color="#c8a030" /></mesh>
      <mesh position={[0, 5, 3.86]}><circleGeometry args={[0.9, 12]} /><meshBasicMaterial color="#93c5fd" transparent opacity={0.7} /></mesh>
      <mesh position={[0, 2, 3.86]}><planeGeometry args={[2.4, 4]} /><meshBasicMaterial color="#6b4226" transparent opacity={0.85} /></mesh>
    </group>
  )
}

// ── Post Office ───────────────────────────────────────────────────────────
function PostOffice() {
  return (
    <group position={[18, 0, -75]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5.6, 4, 4.4]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5.6, 4, 4.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}><boxGeometry args={[5.8, 0.3, 4.6]} /><meshStandardMaterial color="#7a3020" /></mesh>
      <mesh position={[0, 3.5, 2.26]}><planeGeometry args={[5, 0.45]} /><meshBasicMaterial color="#1a3a7a" /></mesh>
      {[-1.4, 1.4].map((x, i) => (
        <mesh key={i} position={[x, 2, 2.26]}>
          <planeGeometry args={[1.3, 1.7]} />
          <meshBasicMaterial color="#bfdbfe" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// ── Apartment Block ────────────────────────────────────────────────────────
function Apartments() {
  return (
    <group position={[-18, 0, -190]}>
      <mesh position={[0, 6, 0]}>
        <boxGeometry args={[5.6, 12, 4.4]} />
        <meshStandardMaterial color="#3a4458" roughness={0.6} />
      </mesh>
      <mesh position={[0, 6, 0]} scale={[1.02, 1.005, 1.02]}>
        <boxGeometry args={[5.6, 12, 4.4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 12.15, 0]}><boxGeometry args={[5.8, 0.3, 4.6]} /><meshStandardMaterial color="#4a5468" /></mesh>
      {[1, 3, 5, 7, 9, 11].flatMap((y, fi) =>
        [-1.5, 0, 1.5].map((x, ci) => (
          <mesh key={`${fi}-${ci}`} position={[x, y, 2.26]}>
            <planeGeometry args={[0.85, 0.85]} />
            <meshBasicMaterial color={APT_WIN[(fi * 3 + ci) % APT_WIN.length]} transparent opacity={0.9} />
          </mesh>
        ))
      )}
    </group>
  )
}

// ── Park Area ─────────────────────────────────────────────────────────────
function ParkArea() {
  return (
    <group position={[-18, 0, 170]}>
      {/* lush lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color={C.parkGrass} roughness={0.85} />
      </mesh>
      {/* gravel path crossing the park */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 1.5]}>
        <planeGeometry args={[20, 1.6]} />
        <meshStandardMaterial color={C.path} roughness={0.9} />
      </mesh>
      {/* benches */}
      {[[-6, 0, 3.5], [6, 0, 3.5], [-6, 0, -3.5], [6, 0, -3.5]].map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.5, 0.1, 0.45]} /><meshStandardMaterial color={C.trim} /></mesh>
          <mesh position={[0, 0.25, -0.18]}><boxGeometry args={[1.5, 0.3, 0.08]} /><meshStandardMaterial color={C.trim} /></mesh>
        </group>
      ))}
      {/* pond with sandy rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, -1]}>
        <circleGeometry args={[3.5, 20]} />
        <meshStandardMaterial color={C.sandWet} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.034, -1]}>
        <circleGeometry args={[3, 20]} />
        <meshStandardMaterial color={C.waterShallow} transparent opacity={0.85} roughness={0.2} />
      </mesh>
      {/* bushes along the south edge */}
      {[-8.5, -5, 5, 8.5].map((x, i) => (
        <mesh key={`bush${i}`} position={[x, 0.45, -5.2]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.85, 8, 6]} />
          <meshStandardMaterial color={i % 2 ? C.foliageMid : C.foliageDark} roughness={0.9} />
        </mesh>
      ))}
      {/* flower bed beside the path */}
      <group position={[-3.5, 0, 0.2]}>
        <mesh position={[0, 0.12, 0]} scale={[1, 0.3, 0.6]}><sphereGeometry args={[1.4, 8, 6]} /><meshStandardMaterial color={C.foliageMid} roughness={0.9} /></mesh>
        {[[-0.8, C.flowerRed], [-0.2, C.flowerYellow], [0.4, C.flowerPink], [0.95, C.flowerRed]].map(([fx, col], i) => (
          <mesh key={i} position={[fx, 0.42, (i % 2 ? 0.25 : -0.2)]}>
            <sphereGeometry args={[0.15, 6, 5]} /><meshStandardMaterial color={col} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <group position={[3.5, 0, 0.2]}>
        <mesh position={[0, 0.12, 0]} scale={[1, 0.3, 0.6]}><sphereGeometry args={[1.4, 8, 6]} /><meshStandardMaterial color={C.foliageMid} roughness={0.9} /></mesh>
        {[[-0.9, C.flowerPink], [-0.3, C.flowerRed], [0.35, C.flowerYellow], [0.9, C.flowerPink]].map(([fx, col], i) => (
          <mesh key={i} position={[fx, 0.42, (i % 2 ? -0.25 : 0.2)]}>
            <sphereGeometry args={[0.15, 6, 5]} /><meshStandardMaterial color={col} roughness={0.7} />
          </mesh>
        ))}
      </group>
      {/* park pavilion */}
      <mesh position={[0, 2.5, 4.2]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshStandardMaterial color={C.wallSand} roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.15, 4.2]}><boxGeometry args={[7.8, 0.3, 5.8]} /><meshStandardMaterial color={C.roofTeal} /></mesh>
    </group>
  )
}

// ── Playground ────────────────────────────────────────────────────────────
function Playground() {
  const swing1 = useRef()
  const swing2 = useRef()
  useFrame(({ clock }) => {
    const s = Math.sin(clock.elapsedTime * 1.6) * 0.42
    if (swing1.current) swing1.current.rotation.x = s
    if (swing2.current) swing2.current.rotation.x = -s + 0.15
  })
  return (
    <group position={[-18, 0, 130]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#86efac" roughness={0.85} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`fp${i}`} position={[-8 + i * 2, 0.5, -6]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color="#6b4226" />
        </mesh>
      ))}
      <group position={[-4.5, 0, -1]}>
        {[-1.2, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 2, 0]}><cylinderGeometry args={[0.07, 0.07, 4, 6]} /><meshStandardMaterial color="#8a6030" /></mesh>
        ))}
        <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 6]} /><meshStandardMaterial color="#8a6030" />
        </mesh>
        <group ref={swing1} position={[-0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}><boxGeometry args={[0.55, 0.1, 0.22]} /><meshStandardMaterial color="#5a3a8a" /></mesh>
          <mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.02, 0.02, 1.5, 4]} /><meshStandardMaterial color="#475569" /></mesh>
        </group>
        <group ref={swing2} position={[0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}><boxGeometry args={[0.55, 0.1, 0.22]} /><meshStandardMaterial color="#6a3850" /></mesh>
          <mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.02, 0.02, 1.5, 4]} /><meshStandardMaterial color="#475569" /></mesh>
        </group>
      </group>
      <group position={[2, 0, -1]}>
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 1.25, -1]}><cylinderGeometry args={[0.07, 0.07, 2.5, 6]} /><meshStandardMaterial color="#3a6030" /></mesh>
        ))}
        <mesh position={[0, 2.5, -1]}><boxGeometry args={[1.2, 0.14, 1.2]} /><meshStandardMaterial color="#4a8040" /></mesh>
        <mesh position={[0.05, 1.5, 0.3]} rotation={[-0.75, 0, 0]}>
          <boxGeometry args={[1.1, 0.1, 2.8]} /><meshStandardMaterial color="#c8a820" />
        </mesh>
      </group>
    </group>
  )
}

// ── Center interactive buildings (Cafe, Arcade, Beach Club, etc.) ─────────
// Swapped to real GLTF assets at their EXACT original positions. Type chosen by
// the original height (≥5 large, 3–5 medium, <3 small). Collision boxes in
// playerColliders.js were updated to the scaled footprints. Each SafeBuilding
// falls back to the original primitive box if its GLTF fails to load.
// REVERTED from GLTF — the City Kit building models were 12-13 materials each
// (1500+ draw calls, 2.5M triangles → 10-17 FPS). Back to the lightweight
// primitive boxes (3 draw calls each). Collision boxes restored to match.
function CenterBuildings() {
  return (
    <>
      {/* Cafe — west arm, north side */}
      <Building pos={[-80, 0, -16]} w={4.4} d={4.4} h={3.5} color={C.wallCream} roof={C.roofClay} character="shop" />
      {/* Arcade — east arm, north side */}
      <Building pos={[80, 0, -16]}  w={4.4} d={4.4} h={4}   color={C.wallSlate} roof={C.roofTeal} character="shop" />
      {/* Beach Club — ON the sand at Sunset Shore */}
      <Building pos={[170, 0, -55]} w={6.4} d={4.4} h={3}   color={C.wallSand} roof={C.roofTeal} character="shop" />
      {/* Rooftop Bar — north arm, east side */}
      <Building pos={[18, 0, -115]} w={4.4} d={4.4} h={5}   color={C.wallTerracotta} roof={C.roofSlate} character="apartment" />
      {/* Music Room — north arm, east side */}
      <Building pos={[18, 0, -160]} w={4.4} d={4.4} h={4.5} color={C.wallSlate} roof={C.roofSlate} character="office" />
      {/* Game Zone — west arm, south side */}
      <Building pos={[-80, 0, 16]}  w={6.4} d={4.4} h={3.5} color={C.wallSand} roof={C.roofClay} character="shop" />
    </>
  )
}

// ── Dynamic window + lamp lighting ────────────────────────────────────────
function DynamicLighting() {
  useFrame(() => {
    const on = timeWeatherState.lampOn
    windowMat.color.setStyle(on ? '#FEF9C3' : '#1e293b')
    windowMat.emissive.setStyle(on ? '#FEF3A0' : '#000000')
    windowMat.emissiveIntensity = on ? 0.6 : 0
    windowMat.opacity = on ? 0.95 : 0.55
    lampGlobeMat.color.setStyle(on ? '#FEF9C3' : '#1e293b')
    lampGlobeMat.emissive.setStyle(on ? '#FFE566' : '#000000')
    lampGlobeMat.emissiveIntensity = on ? 2.2 : 0
    // Lamp light-pools fade in at night (opacity-only animation — no recompile)
    lampPoolMat.opacity += ((on ? 0.32 : 0) - lampPoolMat.opacity) * 0.08
  })
  return null
}

// ── Main CityMap ──────────────────────────────────────────────────────────
const CityMap = React.memo(function CityMap() {
  return (
    <group>
      <DynamicLighting />
      <Ground />
      <Roads />
      <Flyover />
      <CityPlaza />

      <Fountain pos={[0, 0.01, 0]} />
      <CityHall />

      <Mall />
      <Cinema />
      <Supermarket />
      <Bank />
      <Hospital />
      <PoliceStation />
      <FireStation />
      <School />
      <Library />
      <Gym />
      <Restaurant />
      <GasStation />
      <Church />
      <PostOffice />
      <Apartments />
      <Playground />
      <ParkArea />

      <CenterBuildings />

      {/* New far-flung locations */}
      <SwimmingPool />
      <Airport />
      <SunsetShore />

      {/* SE Residential houses */}
      <House pos={[40, 0, 50]} color="#c8d8f0" roofColor="#2a4a80" />
      <House pos={[55, 0, 50]} color="#f0e8c0" roofColor="#8a6820" rotate={0.08} />
      <House pos={[40, 0, 60]} color="#e0c8d0" roofColor="#7a2848" rotate={-0.06} />
      <House pos={[55, 0, 60]} color="#c8d8c8" roofColor="#286840" />
      <House pos={[25, 0, 50]} color="#e8e0d0" roofColor="#6a5030" rotate={0.05} />
      <House pos={[25, 0, 60]} color="#d8c8c0" roofColor="#7a3820" />

      <TrafficLights />

      <Suspense fallback={null}>
        <GLBTrees />
      </Suspense>

      <InstancedLamps />

      {/* Plaza fountain benches */}
      {[[0,-2.8,0],[0,0,2.8,Math.PI/2],[2.8,0,0,Math.PI/2],[-2.8,0,0,Math.PI/2]].map(([x,y,z,ry=0],i) => (
        <group key={`bench${i}`} position={[x,0,z]} rotation={[0,ry,0]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.4, 0.1, 0.45]} /><meshStandardMaterial color="#7c5c3e" roughness={0.7} /></mesh>
          <mesh position={[0, 0.25, -0.18]}><boxGeometry args={[1.4, 0.3, 0.09]} /><meshStandardMaterial color="#7c5c3e" roughness={0.7} /></mesh>
        </group>
      ))}
    </group>
  )
})

export default CityMap

// Trees are primitive geometry now — no GLB to preload.
