// Renders a single catalog furniture item as Three.js primitives.
// Props: item (catalog object), x, z (floor position), rot (Y-axis radians),
//        ghost (semi-transparent preview), selected (yellow wireframe ring),
//        onClick (pointer event handler).

import * as THREE from 'three'

const WALL_H = 3.2  // must match HouseInterior

// ── Primitive helpers ─────────────────────────────────────────────────────────
function B({ p, w = 1, h = 1, d = 1, color }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]}>
      <boxGeometry args={[w, h, d]} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

function Cyl({ p, r, h, color }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]}>
      <cylinderGeometry args={[r, r, h, 12]} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

function Sph({ p, r, color }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[r, 10, 10]} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

function darker(hex) {
  const c = new THREE.Color(hex)
  return c.multiplyScalar(0.65).getStyle()
}

// ── Per-type renderers ────────────────────────────────────────────────────────
function renderType(type, color, w, h, d) {
  const dk = darker(color)

  switch (type) {

    case 'armchair': return <>
      <B p={[0,0,0]} w={w} h={h*0.44} d={d} color={color} />
      <B p={[0,h*0.44,-d*0.42]} w={w} h={h*0.56} d={d*0.14} color={color} />
      <B p={[-w*0.42,h*0.28, 0]} w={w*0.12} h={h*0.3} d={d*0.72} color={dk} />
      <B p={[ w*0.42,h*0.28, 0]} w={w*0.12} h={h*0.3} d={d*0.72} color={dk} />
    </>

    case 'bean_bag': return (
      <mesh position={[0, h*0.46, 0]}>
        <sphereGeometry args={[h*0.48, 12, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
    )

    case 'bar_stool': return <>
      <Cyl p={[0,0,0]} r={w*0.46} h={h*0.08} color={color} />
      <Cyl p={[0,0,0]} r={0.04} h={h*0.92} color={dk} />
    </>

    case 'rocking_chair': return <>
      <B p={[0,h*0.38,0]} w={w*0.9} h={h*0.1} d={d} color={color} />
      <B p={[0,h*0.38,-d*0.44]} w={w*0.9} h={h*0.55} d={d*0.12} color={color} />
      <B p={[-w*0.38,h*0.15,0]} w={w*0.08} h={h*0.32} d={d*0.9} color={dk} />
      <B p={[ w*0.38,h*0.15,0]} w={w*0.08} h={h*0.32} d={d*0.9} color={dk} />
      {/* Rocker arcs approximated as flat boxes on the ground */}
      <B p={[0,0.04,-d*0.25]} w={w*0.85} h={0.06} d={d*0.55} color={dk} />
    </>

    case 'sofa': return <>
      <B p={[0,0,0]} w={w} h={h*0.45} d={d} color={color} />
      <B p={[0,h*0.45,-d*0.42]} w={w} h={h*0.55} d={d*0.14} color={color} />
      <B p={[-w*0.47,h*0.34,0]} w={w*0.08} h={h*0.48} d={d} color={dk} />
      <B p={[ w*0.47,h*0.34,0]} w={w*0.08} h={h*0.48} d={d} color={dk} />
    </>

    case 'table_low': return <>
      <B p={[0,h-0.07,0]} w={w} h={0.07} d={d} color={color} />
      {[[-w/2+0.07, d/2-0.07],[w/2-0.07, d/2-0.07],[-w/2+0.07,-d/2+0.07],[w/2-0.07,-d/2+0.07]].map(([lx,lz],i)=>
        <B key={i} p={[lx,0,lz]} w={0.07} h={h-0.07} d={0.07} color={dk} />
      )}
    </>

    case 'table_mid': return <>
      <B p={[0,h-0.08,0]} w={w} h={0.08} d={d} color={color} />
      {[[-w/2+0.08, d/2-0.08],[w/2-0.08, d/2-0.08],[-w/2+0.08,-d/2+0.08],[w/2-0.08,-d/2+0.08]].map(([lx,lz],i)=>
        <B key={i} p={[lx,0,lz]} w={0.08} h={h-0.08} d={0.08} color={dk} />
      )}
    </>

    case 'table_round': return <>
      <mesh position={[0, h-0.06, 0]}>
        <cylinderGeometry args={[w*0.5, w*0.5, 0.08, 18]} />
        <meshToonMaterial color={color} />
      </mesh>
      <Cyl p={[0,0,0]} r={0.07} h={h-0.06} color={dk} />
    </>

    case 'chest': return <>
      <B p={[0,0,0]} w={w} h={h*0.84} d={d} color={color} />
      <B p={[0,h*0.84,0]} w={w*1.02} h={h*0.16} d={d*1.02} color={dk} />
    </>

    case 'bookshelf': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color={color} />
      {[0.28, 0.52, 0.72, 0.88].map((frac,i)=>
        <B key={i} p={[w*0.1,h*frac,0]} w={w*0.06} h={0.04} d={d*0.94} color={dk} />
      )}
      {[0,1,2,3,4].map(i=>{
        const bookColors = ['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7']
        const shelfFrac = [0.14,0.39,0.59,0.78][Math.floor(i/2)] ?? 0.14
        return (
          <B key={i+10} p={[w*0.12, h*(shelfFrac+0.07), (i-2)*d*0.18]}
            w={0.05} h={h*0.13} d={0.09} color={bookColors[i % 5]} />
        )
      })}
    </>

    case 'cabinet': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color={color} />
      {/* Door line */}
      <B p={[w*0.51,h*0.5, d*0.01]} w={0.03} h={h*0.84} d={d*0.48} color={dk} />
      <B p={[w*0.51,h*0.5,-d*0.01]} w={0.03} h={h*0.84} d={d*0.48} color={dk} />
      {/* Handle dots */}
      <Sph p={[w*0.54, h*0.5, d*0.3]} r={0.035} color="#fbbf24" />
      <Sph p={[w*0.54, h*0.5,-d*0.3]} r={0.035} color="#fbbf24" />
    </>

    case 'dresser': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color={color} />
      {[0.18, 0.44, 0.7].map((frac,i)=>
        <B key={i} p={[w*0.52, h*frac, 0]} w={0.03} h={h*0.2} d={d*0.84} color={dk} />
      )}
      {[0.18,0.44,0.7].map((frac,i)=>
        <Sph key={i+10} p={[w*0.55, h*frac, 0]} r={0.03} color="#fbbf24" />
      )}
    </>

    case 'lamp_floor': return <>
      <Cyl p={[0,0,0]} r={0.04} h={h*0.88} color={dk} />
      <mesh position={[0, h*0.88, 0]}>
        <coneGeometry args={[0.26, 0.28, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, h*0.88, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#fffde7" />
      </mesh>
    </>

    case 'lamp_desk': return <>
      <Cyl p={[0,0,0]} r={0.035} h={h*0.84} color={dk} />
      <mesh position={[0, h*0.84, 0]}>
        <coneGeometry args={[0.18, 0.2, 10]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, h*0.84, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fffde7" />
      </mesh>
    </>

    case 'chandelier': return <>
      {/* Drop chain */}
      <Cyl p={[0, WALL_H-0.5, 0]} r={0.03} h={0.5} color={dk} />
      {/* Body */}
      <B p={[0,WALL_H-0.85,0]} w={w} h={0.1} d={d} color={color} />
      {[[-w*0.35,0,0],[w*0.35,0,0],[0,0,-d*0.35],[0,0,d*0.35]].map(([cx,,cz],i)=>
        <mesh key={i} position={[cx, WALL_H-0.95, cz]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
      )}
    </>

    case 'neon': return (
      <mesh position={[0, h/2+0.8, 0]}>
        <boxGeometry args={[w, h, 0.06]} />
        <meshBasicMaterial color={color} />
      </mesh>
    )

    case 'painting': return <>
      {/* Frame stands on floor, tilted forward slightly against a wall */}
      <B p={[0,0,0]} w={w} h={h} d={d} color="#7c4a1e" />
      <mesh position={[w*0.55, h*0.5, 0]}>
        <planeGeometry args={[d*0.84, h*0.82]} />
        <meshBasicMaterial color={color} side={THREE.FrontSide} />
      </mesh>
    </>

    case 'rug_circle': return (
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[w/2, 26]} />
        <meshToonMaterial color={color} />
      </mesh>
    )

    case 'rug_rect': return (
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[w, d]} />
        <meshToonMaterial color={color} />
      </mesh>
    )

    case 'mirror': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color="#6d4c2f" />
      <mesh position={[w*0.55, h*0.5, 0]}>
        <planeGeometry args={[d*0.84, h*0.84]} />
        <meshBasicMaterial color="#cfe8ff" />
      </mesh>
    </>

    case 'vase': return <>
      <Cyl p={[0,0,0]} r={w*0.38} h={h*0.68} color={color} />
      <Cyl p={[0,h*0.68,0]} r={w*0.22} h={h*0.32} color={dk} />
    </>

    case 'globe': return <>
      <Cyl p={[0,0,0]} r={0.04} h={h*0.35} color={dk} />
      <Sph p={[0, h*0.68, 0]} r={w*0.4} color={color} />
      {/* Meridian ring */}
      <mesh position={[0, h*0.68, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[w*0.4, 0.02, 6, 20]} />
        <meshToonMaterial color={dk} />
      </mesh>
    </>

    case 'plant_tall': return <>
      <Cyl p={[0,0,0]} r={0.09} h={h*0.6} color={color} />
      <mesh position={[0, h*0.6, 0]}>
        <coneGeometry args={[w*0.44, h*0.5, 10]} />
        <meshToonMaterial color={color} />
      </mesh>
      <Sph p={[0.12, h*0.82, 0.08]} r={0.18} color="#22c55e" />
    </>

    case 'plant': return <>
      <Cyl p={[0,0,0]} r={w*0.32} h={h*0.38} color="#b45309" />
      <Sph p={[0, h*0.62, 0]} r={w*0.46} color={color} />
      <Sph p={[w*0.2, h*0.78, 0.08]} r={w*0.28} color="#22c55e" />
    </>

    case 'fish_tank': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color="#334155" />
      <mesh position={[w*0.54, h*0.5, 0]}>
        <boxGeometry args={[0.02, h*0.84, d*0.9]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.65} />
      </mesh>
    </>

    case 'trophy_shelf': return <>
      <B p={[0,0,0]} w={w} h={h*0.14} d={d} color={dk} />
      <B p={[0,h*0.3,0]} w={w*1.02} h={0.04} d={d*1.02} color={dk} />
      {/* Cup */}
      <Cyl p={[0, h*0.32, 0]} r={d*0.14} h={h*0.3} color={color} />
      <mesh position={[0, h*0.75, 0]}>
        <sphereGeometry args={[d*0.18, 8, 8]} />
        <meshToonMaterial color={color} />
      </mesh>
    </>

    case 'gaming_pc': return <>
      <B p={[0,0,0]} w={w} h={h*0.75} d={d} color={color} />
      {/* Screen on top */}
      <B p={[0,h,0]} w={w*0.9} h={h*0.5} d={0.06} color="#0f172a" />
      <mesh position={[0, h, 0.04]}>
        <planeGeometry args={[w*0.78, h*0.4]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </>

    case 'speakers': return <>
      <B p={[-w*0.28,0,0]} w={w*0.38} h={h} d={d} color={color} />
      <B p={[ w*0.28,0,0]} w={w*0.38} h={h} d={d} color={color} />
      <Sph p={[-w*0.28, h*0.5, d*0.55]} r={d*0.22} color="#334155" />
      <Sph p={[ w*0.28, h*0.5, d*0.55]} r={d*0.22} color="#334155" />
    </>

    case 'mini_fridge': return <>
      <B p={[0,0,0]} w={w} h={h} d={d} color={color} />
      <B p={[w*0.52,h*0.5,0]} w={0.03} h={h*0.84} d={d*0.5} color="#94a3b8" />
      <Sph p={[w*0.55, h*0.5, 0]} r={0.032} color="#fbbf24" />
    </>

    case 'treadmill': return <>
      <B p={[0,0,0]} w={w} h={h*0.14} d={d} color={color} />
      <mesh position={[0, h*0.14, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[w*0.9, d*0.85]} />
        <meshToonMaterial color="#1f2937" />
      </mesh>
      {/* Handlebar uprights */}
      <B p={[-w*0.32, h*0.14, -d*0.42]} w={0.06} h={h*0.86} d={0.06} color="#6b7280" />
      <B p={[ w*0.32, h*0.14, -d*0.42]} w={0.06} h={h*0.86} d={0.06} color="#6b7280" />
      <B p={[0, h, -d*0.42]} w={w*0.72} h={0.06} d={0.06} color="#6b7280" />
    </>

    case 'dumbbell_rack': return <>
      <B p={[0,0,0]} w={w} h={h*0.1} d={d} color={dk} />
      {[0.28, 0.54, 0.78].map((frac,i)=> (
        <group key={i} position={[0, h*frac, 0]}>
          <Cyl p={[0,0,0]} r={0.042} h={0.04} color="#6b7280" />
          <Sph p={[-d*0.28, 0.02, 0]} r={0.09 - i*0.018} color={color} />
          <Sph p={[ d*0.28, 0.02, 0]} r={0.09 - i*0.018} color={color} />
        </group>
      ))}
    </>

    default: return <B p={[0,0,0]} w={w} h={h} d={d} color={color} />
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FurniturePiece({ item, x, z, rot = 0, ghost = false, selected = false, onClick }) {
  const { type, color, w, h, d } = item

  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} onClick={onClick}>
      {ghost ? (
        /* Ghost: simple bounding-box silhouette */
        <mesh position={[0, h/2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial color={color} transparent opacity={0.32} />
        </mesh>
      ) : (
        renderType(type, color, w, h, d)
      )}

      {selected && (
        <mesh position={[0, h/2, 0]}>
          <boxGeometry args={[w + 0.12, h + 0.12, d + 0.12]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.22} wireframe />
        </mesh>
      )}
    </group>
  )
}
