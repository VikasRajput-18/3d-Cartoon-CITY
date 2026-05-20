import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// deterministic window-light pattern for apartments
const APT_WIN = [
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b',
]

// ── Ground ──────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshToonMaterial color="#2d5a27" />
      </mesh>
      {/* Sidewalk strips along main E-W road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -2.7]}>
        <planeGeometry args={[120, 0.9]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 2.7]}>
        <planeGeometry args={[120, 0.9]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      {/* Sidewalk strips along main N-S road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.7, 0.005, 0]}>
        <planeGeometry args={[0.9, 120]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.7, 0.005, 0]}>
        <planeGeometry args={[0.9, 120]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
    </>
  )
}

// ── Road Network ─────────────────────────────────────────────────────────────
function Roads() {
  const road = '#22252e'
  const dash = '#facc15'
  const side = '#8b9db5'

  const hRoads = [
    { z: 0,   w: 120, h: 4   },  // Main E-W
    { z: -18, w: 120, h: 3.5 },  // North ring
    { z:  18, w: 120, h: 3.5 },  // South ring
    { z: -34, w: 120, h: 3   },  // Far north
    { z:  34, w: 120, h: 3   },  // Far south
  ]
  const vRoads = [
    { x: 0,   w: 4,   h: 120 },  // Main N-S
    { x: -20, w: 3.5, h: 120 },  // West arterial
    { x:  20, w: 3.5, h: 120 },  // East arterial
    { x: -40, w: 3,   h: 120 },  // Far west
    { x:  40, w: 3,   h: 120 },  // Far east
  ]

  return (
    <group>
      {hRoads.map(({ z, w, h }, i) => (
        <mesh key={`hr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[w, h]} />
          <meshToonMaterial color={road} />
        </mesh>
      ))}
      {vRoads.map(({ x, w, h }, i) => (
        <mesh key={`vr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[w, h]} />
          <meshToonMaterial color={road} />
        </mesh>
      ))}

      {/* Center dashes E-W main */}
      {Array.from({ length: 22 }, (_, i) => i - 11).map(i => (
        <mesh key={`dew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i * 5 + 2.5, 0.02, 0]}>
          <planeGeometry args={[2.5, 0.12]} />
          <meshBasicMaterial color={dash} transparent opacity={0.75} />
        </mesh>
      ))}
      {/* Center dashes N-S main */}
      {Array.from({ length: 22 }, (_, i) => i - 11).map(i => (
        <mesh key={`dns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, i * 5 + 2.5]}>
          <planeGeometry args={[0.12, 2.5]} />
          <meshBasicMaterial color={dash} transparent opacity={0.75} />
        </mesh>
      ))}

      {/* Crosswalk stripes at main intersections */}
      {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((off, i) => (
        <mesh key={`cwew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[2.5 + off * 0.01, 0.03, 3.5]}>
          <planeGeometry args={[0.4, 1.2]} />
          <meshBasicMaterial color="#fff" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ── Reusable Building ──────────────────────────────────────────────────────
function Building({ pos, w = 2, d = 2, h = 4, color = '#334155', roof = '#7C3AED', windows = true }) {
  const winOffsetsX = [-w * 0.28, w * 0.28]
  const winOffsetsY = [h * 0.65, h * 0.35]
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, h / 2, 0]} scale={[1.025, 1.01, 1.025]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.12, 0.3, d + 0.12]} />
        <meshToonMaterial color={roof} />
      </mesh>
      {windows && winOffsetsX.flatMap(wx => winOffsetsY.map(wy => [wx, wy])).map(([wx, wy], i) => (
        <mesh key={i} position={[wx, wy, d / 2 + 0.01]}>
          <planeGeometry args={[0.3, 0.38]} />
          <meshBasicMaterial color="#FEF9C3" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ── House ─────────────────────────────────────────────────────────────────
function House({ pos, color = '#E8D5B7', roofColor = '#C0392B', rotate = 0 }) {
  return (
    <group position={pos} rotation={[0, rotate, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[3, 2.4, 3]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.2, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[3, 2.4, 3]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 2.85, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.2, 1.6, 4]} />
        <meshToonMaterial color={roofColor} />
      </mesh>
      <mesh position={[0, 0.6, 1.52]}>
        <boxGeometry args={[0.6, 1.2, 0.05]} />
        <meshToonMaterial color="#7C4A1E" />
      </mesh>
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 1.52]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[3.3, 0.12, 3.3]} />
        <meshToonMaterial color="#C5B89A" />
      </mesh>
    </group>
  )
}

// ── Instanced Trees — 63 instances → 4 draw calls ────────────────────────
const TREE_DATA = [
  // Inner ring (scale=1)
  [-4,-4,1],[-4,4,1],[4,-4,1],[4,4,1],[-8,8,1],[8,8,1],[-8,-8,1],[8,-8,1],[-12,-2,1],[12,-2,1],
  // E-W road z=-4.5 (scale=0.88)
  [-48,-4.5,.88],[-38,-4.5,.88],[-28,-4.5,.88],[-22,-4.5,.88],[-8,-4.5,.88],
  [8,-4.5,.88],[22,-4.5,.88],[28,-4.5,.88],[38,-4.5,.88],[48,-4.5,.88],
  // E-W road z=+4.5 (scale=0.88)
  [-48,4.5,.88],[-38,4.5,.88],[-28,4.5,.88],[-22,4.5,.88],[-8,4.5,.88],
  [8,4.5,.88],[22,4.5,.88],[28,4.5,.88],[38,4.5,.88],[48,4.5,.88],
  // N/S road x=-4.5 (scale=0.85)
  [-4.5,-45,.85],[-4.5,-35,.85],[-4.5,-24,.85],[-4.5,-14,.85],
  [-4.5,14,.85],[-4.5,24,.85],[-4.5,35,.85],[-4.5,45,.85],
  // Residential (scale=0.8)
  [20,20,.8],[30,20,.8],[40,20,.8],[50,20,.8],[20,30,.8],[30,30,.8],[40,30,.8],[50,30,.8],
  [20,40,.8],[30,40,.8],[40,40,.8],[50,40,.8],[20,50,.8],[30,50,.8],[40,50,.8],[50,50,.8],
  // Church area (scale=0.85)
  [-16,24,.85],[-18,24,.85],[-20,24,.85],[-22,24,.85],[-24,24,.85],
  // North district (scale=0.82)
  [-8,-20,.82],[-5,-20,.82],[5,-20,.82],[8,-20,.82],
]

function InstancedTrees() {
  const trunkRef = useRef(), c1Ref = useRef(), c2Ref = useRef(), c3Ref = useRef()
  const N = TREE_DATA.length

  useEffect(() => {
    const d = new THREE.Object3D()
    ;[
      { ref: trunkRef, yOff: 0.6  },
      { ref: c1Ref,    yOff: 1.8  },
      { ref: c2Ref,    yOff: 2.65 },
      { ref: c3Ref,    yOff: 3.3  },
    ].forEach(({ ref, yOff }) => {
      TREE_DATA.forEach(([x, z, s], i) => {
        d.position.set(x, yOff * s, z); d.scale.setScalar(s); d.updateMatrix()
        ref.current.setMatrixAt(i, d.matrix)
      })
      ref.current.instanceMatrix.needsUpdate = true
    })
  }, [])

  return (
    <>
      <instancedMesh ref={trunkRef} args={[null, null, N]}>
        <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} /><meshToonMaterial color="#7C3F10" />
      </instancedMesh>
      <instancedMesh ref={c1Ref} args={[null, null, N]}>
        <coneGeometry args={[0.72, 1.4, 7]} /><meshToonMaterial color="#15803d" />
      </instancedMesh>
      <instancedMesh ref={c2Ref} args={[null, null, N]}>
        <coneGeometry args={[0.52, 1.1, 7]} /><meshToonMaterial color="#16a34a" />
      </instancedMesh>
      <instancedMesh ref={c3Ref} args={[null, null, N]}>
        <coneGeometry args={[0.32, 0.85, 7]} /><meshToonMaterial color="#22c55e" />
      </instancedMesh>
    </>
  )
}

// ── Instanced Lamps — 45 instances → 3 draw calls ────────────────────────
const LAMP_DATA = [
  [-2,-2],[-2,2],[2,-2],[2,2],[-2,-8],[2,-8],[-2,8],[2,8],
  [-8,-20],[8,-20],[-20,-22],[20,-22],[-8,-30],[8,-30],[-30,-28],[30,-28],
  [22,-8],[22,5],[22,18],[22,27],[36,-2],[36,10],[36,22],
  [-22,-8],[-22,5],[-22,18],[-22,27],[-36,-2],[-36,-16],[-36,10],
  [-8,22],[8,22],[-8,32],[8,32],[-22,32],[22,32],[0,32],
  [23,22],[33,22],[43,22],[23,32],[33,32],[43,32],[23,42],[33,42],
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

  return (
    <>
      <instancedMesh ref={poleRef} args={[null, null, N]}>
        <cylinderGeometry args={[0.05, 0.07, 3, 6]} /><meshToonMaterial color="#475569" />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[null, null, N]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} /><meshToonMaterial color="#475569" />
      </instancedMesh>
      <instancedMesh ref={globeRef} args={[null, null, N]}>
        <sphereGeometry args={[0.14, 8, 6]} /><meshBasicMaterial color="#FEF9C3" />
      </instancedMesh>
    </>
  )
}

// ── Traffic Lights — single useFrame for all 10 lights ───────────────────
const TL_POS = [
  [ 2.5,0,-2.5],[-2.5,0, 2.5],[22,0,-2.5],[-22,0, 2.5],
  [ 2.5,0,-20 ],[-2.5,0, 20 ],[ 2.5,0,-36],[-2.5,0, 36],
  [42,  0, -2 ],[-42, 0,  2 ],
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
            <cylinderGeometry args={[0.06, 0.07, 3.2, 6]} /><meshToonMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 3.4, 0]}>
            <boxGeometry args={[0.32, 0.88, 0.28]} /><meshToonMaterial color="#1e293b" />
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

// ── Fountain (animated) ───────────────────────────────────────────────────
function Fountain({ pos = [0, 0, 0] }) {
  const waterRef = useRef()
  const sprayRef = useRef()
  useFrame(({ clock }) => {
    if (waterRef.current) waterRef.current.rotation.y = clock.elapsedTime * 0.45
    if (sprayRef.current) sprayRef.current.scale.y = 0.7 + Math.sin(clock.elapsedTime * 3.5) * 0.35
  })
  return (
    <group position={pos}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[1.4, 1.65, 0.45, 14]} />
        <meshToonMaterial color="#64748b" />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.47, 0]}>
        <cylinderGeometry args={[1.15, 1.15, 0.07, 14]} />
        <meshToonMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.2, 6]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh ref={sprayRef} position={[0, 1.65, 0]}>
        <coneGeometry args={[0.28, 0.65, 8]} />
        <meshToonMaterial color="#7dd3fc" transparent opacity={0.55} />
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
    <group position={[0, 0, -22]}>
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[10, 8, 6]} />
        <meshToonMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 8, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, 8.6, 0]}>
        <sphereGeometry args={[2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial color="#e2e8f0" />
      </mesh>
      {/* Columns */}
      {[-3.5, -1.2, 1.2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 3.5, 3.1]}>
          <cylinderGeometry args={[0.24, 0.3, 7, 8]} />
          <meshToonMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Steps */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, i * 0.15 + 0.08, 3.1 + i * 0.3]}>
          <boxGeometry args={[9, 0.15, 0.6]} />
          <meshToonMaterial color="#f1f5f9" />
        </mesh>
      ))}
      {/* Windows */}
      {[-3, 0, 3].map((x, j) => [5.5, 2.5].map((y, k) => (
        <mesh key={`${j}${k}`} position={[x, y, 3.06]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      )))}
      {/* Flag pole + flag */}
      <mesh position={[0, 11.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh ref={flagRef} position={[0.85, 12.8, 0]}>
        <planeGeometry args={[1.7, 0.9]} />
        <meshToonMaterial color="#ef4444" side={THREE.DoubleSide} />
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
    <group position={[-16, 0, -28]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[14, 6, 8]} />
        <meshToonMaterial color="#fce7f3" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[14, 6, 8]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.15, 0]}>
        <boxGeometry args={[14.2, 0.3, 8.2]} />
        <meshToonMaterial color="#ec4899" />
      </mesh>
      {/* Skylight dome */}
      <mesh position={[0, 6.6, 0]}>
        <sphereGeometry args={[2.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial color="#e0f2fe" transparent opacity={0.65} />
      </mesh>
      {/* Entrance */}
      <mesh position={[0, 2.6, 4.1]}>
        <boxGeometry args={[5, 5.2, 0.5]} />
        <meshToonMaterial color="#f9a8d4" />
      </mesh>
      <mesh position={[0, 5.3, 4.36]}>
        <torusGeometry args={[2.1, 0.28, 6, 10, Math.PI]} />
        <meshToonMaterial color="#ec4899" />
      </mesh>
      {/* Neon sign */}
      <mesh ref={signRef} position={[0, 5.5, 4.17]}>
        <planeGeometry args={[6, 0.55]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.9} />
      </mesh>
      {/* Storefront windows */}
      {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 4.06]}>
          <planeGeometry args={[1.8, 2.2]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// ── Cinema ────────────────────────────────────────────────────────────────
function Cinema() {
  const marqueeRef = useRef()
  useFrame(({ clock }) => {
    if (marqueeRef.current) {
      marqueeRef.current.material.color.setHSL((clock.elapsedTime * 0.18) % 1, 0.85, 0.5)
    }
  })
  return (
    <group position={[16, 0, -28]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[10, 7, 7]} />
        <meshToonMaterial color="#1c0533" />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 7, 7]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}>
        <boxGeometry args={[10.2, 0.3, 7.2]} />
        <meshToonMaterial color="#4c1d95" />
      </mesh>
      {/* Marquee */}
      <mesh position={[0, 5, 3.6]}>
        <boxGeometry args={[9.2, 2.6, 0.3]} />
        <meshToonMaterial color="#0f0011" />
      </mesh>
      <mesh ref={marqueeRef} position={[0, 5, 3.76]}>
        <planeGeometry args={[8.6, 2.1]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.95} />
      </mesh>
      {/* Star lights on marquee */}
      {[-3.5, -2, -0.5, 0.5, 2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 6.1, 3.77]}>
          <circleGeometry args={[0.1, 5]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      {/* Entrance */}
      <mesh position={[0, 2.5, 3.61]}>
        <boxGeometry args={[4.2, 5, 0.3]} />
        <meshToonMaterial color="#1a0033" />
      </mesh>
      <mesh position={[0, 2.5, 3.77]}>
        <planeGeometry args={[3.8, 4.8]} />
        <meshBasicMaterial color="#6d28d9" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// ── Supermarket ────────────────────────────────────────────────────────────
function Supermarket() {
  return (
    <group position={[-28, 0, -18]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[10, 4, 6]} />
        <meshToonMaterial color="#f0fdf4" />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 4, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[10.2, 0.3, 6.2]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      <mesh position={[0, 3.6, 3.3]}>
        <boxGeometry args={[10, 0.2, 1.2]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {[-3.5, 0, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 1.8, 3.06]}>
          <planeGeometry args={[2.2, 3]} />
          <meshBasicMaterial color="#bfdbfe" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ── Bank ──────────────────────────────────────────────────────────────────
function Bank() {
  return (
    <group position={[28, 0, -18]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[7, 6, 5]} />
        <meshToonMaterial color="#f8f4e8" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[7, 6, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.2, 0]}>
        <boxGeometry args={[7.2, 0.4, 5.2]} />
        <meshToonMaterial color="#b45309" />
      </mesh>
      {[-2.5, -0.8, 0.8, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 3, 2.6]}>
          <cylinderGeometry args={[0.2, 0.25, 6, 8]} />
          <meshToonMaterial color="#fef3c7" />
        </mesh>
      ))}
      {[-2.5, 0, 2.5].map((x, i) => [4.5, 2].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 2.56]}>
          <planeGeometry args={[1.2, 1.6]} />
          <meshBasicMaterial color="#bfdbfe" transparent opacity={0.6} />
        </mesh>
      )))}
    </group>
  )
}

// ── Hospital ─────────────────────────────────────────────────────────────
function Hospital() {
  return (
    <group position={[34, 0, -5]}>
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[7, 8, 6]} />
        <meshToonMaterial color="#f0f9ff" />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[7, 8, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 8.15, 0]}>
        <boxGeometry args={[7.2, 0.3, 6.2]} />
        <meshToonMaterial color="#0ea5e9" />
      </mesh>
      {/* Red cross */}
      <mesh position={[0, 5, 3.06]}>
        <planeGeometry args={[0.5, 1.6]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 5, 3.07]}>
        <planeGeometry args={[1.6, 0.5]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* Windows */}
      {[-2, 0, 2].map((x, i) => [7, 5, 3].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.06]}>
          <planeGeometry args={[0.9, 1.1]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.9} />
        </mesh>
      )))}
      {/* Ambulance bay */}
      <mesh position={[0, 1.5, 3.55]}>
        <boxGeometry args={[3.2, 3, 1.2]} />
        <meshToonMaterial color="#e0f2fe" />
      </mesh>
    </group>
  )
}

// ── Police Station ─────────────────────────────────────────────────────────
function PoliceStation() {
  return (
    <group position={[34, 0, 10]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshToonMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[5.2, 0.3, 5.2]} />
        <meshToonMaterial color="#1d4ed8" />
      </mesh>
      {/* Badge star */}
      <mesh position={[0, 3, 2.56]}>
        <circleGeometry args={[0.65, 5]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, 3, 2.57]}>
        <circleGeometry args={[0.35, 8]} />
        <meshBasicMaterial color="#1e3a5f" />
      </mesh>
      {/* Blue light bar */}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[2, 0.3, 0.5]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      {[-1.2, 1.2].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.56]}>
          <planeGeometry args={[0.9, 1.2]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ── Fire Station ──────────────────────────────────────────────────────────
function FireStation() {
  return (
    <group position={[34, 0, 22]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[7.2, 0.3, 5.2]} />
        <meshToonMaterial color="#991b1b" />
      </mesh>
      {/* 3 garage doors */}
      {[-2.2, 0, 2.2].map((x, i) => (
        <group key={i} position={[x, 0, 2.56]}>
          <mesh position={[0, 1.5, 0]}>
            <planeGeometry args={[1.8, 3]} />
            <meshBasicMaterial color="#b91c1c" />
          </mesh>
          {[0.6, 1.1, 1.6, 2.1, 2.6].map((y, j) => (
            <mesh key={j} position={[0, y, 0.01]}>
              <planeGeometry args={[1.8, 0.06]} />
              <meshBasicMaterial color="#7f1d1d" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ── School ────────────────────────────────────────────────────────────────
function School() {
  return (
    <group position={[-34, 0, -5]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[9, 7, 6]} />
        <meshToonMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[9, 7, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}>
        <boxGeometry args={[9.2, 0.3, 6.2]} />
        <meshToonMaterial color="#f59e0b" />
      </mesh>
      {/* Bell tower */}
      <mesh position={[0, 8, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshToonMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, 9.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 1.6, 4]} />
        <meshToonMaterial color="#d97706" />
      </mesh>
      {[-3, -1, 1, 3].map((x, i) => [5, 2.5].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.06]}>
          <planeGeometry args={[1.3, 1.6]} />
          <meshBasicMaterial color="#FEF9C3" transparent opacity={0.9} />
        </mesh>
      )))}
      {/* Entrance portico */}
      <mesh position={[0, 1.6, 3.15]}>
        <boxGeometry args={[2.8, 3.2, 0.4]} />
        <meshToonMaterial color="#f59e0b" />
      </mesh>
    </group>
  )
}

// ── Library ───────────────────────────────────────────────────────────────
function Library() {
  return (
    <group position={[-34, 0, -20]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshToonMaterial color="#d4b896" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[7.2, 0.3, 5.2]} />
        <meshToonMaterial color="#92400e" />
      </mesh>
      {[-2, 0, 2].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.56]}>
          <planeGeometry args={[1.3, 2.2]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.8} />
        </mesh>
      ))}
      {/* Book stripe decoration */}
      {[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 4.3, 2.56]}>
          <planeGeometry args={[0.7, 0.6]} />
          <meshBasicMaterial color={['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'][i]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Gym ───────────────────────────────────────────────────────────────────
function Gym() {
  return (
    <group position={[-34, 0, 10]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[6, 5, 5]} />
        <meshToonMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[6, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[6.2, 0.3, 5.2]} />
        <meshToonMaterial color="#7c3aed" />
      </mesh>
      {/* Zigzag lightning window */}
      <mesh position={[0, 3, 2.56]}>
        <planeGeometry args={[3, 2]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.85} />
      </mesh>
      {[-1.5, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 2, 2.56]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshBasicMaterial color="#312e81" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ── Restaurant ────────────────────────────────────────────────────────────
function Restaurant() {
  return (
    <group position={[12, 0, 28]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[5, 5, 4]} />
        <meshToonMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 5, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}>
        <boxGeometry args={[5.2, 0.3, 4.2]} />
        <meshToonMaterial color="#f59e0b" />
      </mesh>
      {/* Awning */}
      <mesh position={[0, 3.3, 2.25]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[5.2, 0.12, 1.6]} />
        <meshToonMaterial color="#f97316" />
      </mesh>
      {/* Outdoor tables */}
      {[-1.5, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 3.8]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.07, 8]} />
            <meshToonMaterial color="#fcd34d" />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
            <meshToonMaterial color="#d97706" />
          </mesh>
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
    <group position={[-12, 0, 28]}>
      <mesh position={[0, 1.5, -1.5]}>
        <boxGeometry args={[4, 3, 3]} />
        <meshToonMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 1.5, -1.5]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[4, 3, 3]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 3.5, 0.8]}>
        <boxGeometry args={[9, 0.2, 7]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
      {[-3.5, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 1.75, 0.8]}>
          <cylinderGeometry args={[0.12, 0.15, 3.5, 6]} />
          <meshToonMaterial color="#94a3b8" />
        </mesh>
      ))}
      {/* Fuel pumps */}
      {[-1.5, 0, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 1.8]}>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[0.5, 2, 0.35]} />
            <meshToonMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 1.2, 0.2]}>
            <planeGeometry args={[0.34, 0.22]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>
      ))}
      {/* Blinking price board */}
      <mesh ref={signRef} position={[0, 3, -3.06]}>
        <planeGeometry args={[3.5, 1.2]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={1} />
      </mesh>
    </group>
  )
}

// ── Church / Temple ───────────────────────────────────────────────────────
function Church() {
  return (
    <group position={[-25, 0, 18]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[6, 6, 7]} />
        <meshToonMaterial color="#f5f0e8" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[6, 6, 7]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7, 0]}>
        <boxGeometry args={[2.6, 3, 2.6]} />
        <meshToonMaterial color="#e7dfd0" />
      </mesh>
      <mesh position={[0, 9.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 3.2, 4]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      {/* Cross */}
      <mesh position={[0, 11.4, 0]}>
        <boxGeometry args={[0.15, 1.1, 0.15]} />
        <meshToonMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, 11.7, 0]}>
        <boxGeometry args={[0.65, 0.15, 0.15]} />
        <meshToonMaterial color="#fbbf24" />
      </mesh>
      {/* Rose window */}
      <mesh position={[0, 5, 3.56]}>
        <circleGeometry args={[0.85, 12]} />
        <meshBasicMaterial color="#93c5fd" transparent opacity={0.75} />
      </mesh>
      {/* Entrance */}
      <mesh position={[0, 2, 3.56]}>
        <planeGeometry args={[2.2, 4]} />
        <meshBasicMaterial color="#7c4a1e" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

// ── Post Office ───────────────────────────────────────────────────────────
function PostOffice() {
  return (
    <group position={[12, 0, 18]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5, 4, 4]} />
        <meshToonMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 4, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[5.2, 0.3, 4.2]} />
        <meshToonMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 3.5, 2.06]}>
        <planeGeometry args={[4.5, 0.45]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>
      {[-1.2, 1.2].map((x, i) => (
        <mesh key={i} position={[x, 2, 2.06]}>
          <planeGeometry args={[1.2, 1.6]} />
          <meshBasicMaterial color="#bfdbfe" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// ── Apartment Block ────────────────────────────────────────────────────────
function Apartments() {
  return (
    <group position={[-26, 0, 30]}>
      <mesh position={[0, 6, 0]}>
        <boxGeometry args={[5, 12, 4]} />
        <meshToonMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 6, 0]} scale={[1.02, 1.005, 1.02]}>
        <boxGeometry args={[5, 12, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 12.15, 0]}>
        <boxGeometry args={[5.2, 0.3, 4.2]} />
        <meshToonMaterial color="#475569" />
      </mesh>
      {/* Floor-by-floor windows (deterministic) */}
      {[1, 3, 5, 7, 9, 11].flatMap((y, fi) =>
        [-1.5, 0, 1.5].map((x, ci) => (
          <mesh key={`${fi}-${ci}`} position={[x, y, 2.06]}>
            <planeGeometry args={[0.85, 0.85]} />
            <meshBasicMaterial color={APT_WIN[(fi * 3 + ci) % APT_WIN.length]} transparent opacity={0.9} />
          </mesh>
        ))
      )}
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
    <group position={[0, 0, 38]}>
      {/* Grass patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[16, 12]} />
        <meshToonMaterial color="#86efac" />
      </mesh>
      {/* Fence */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`fp${i}`} position={[-7 + i * 2, 0.5, -5.5]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshToonMaterial color="#92400e" />
        </mesh>
      ))}

      {/* === Swing set === */}
      <group position={[-4.5, 0, -1]}>
        {[-1.2, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 4, 6]} />
            <meshToonMaterial color="#f97316" />
          </mesh>
        ))}
        <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 6]} />
          <meshToonMaterial color="#f97316" />
        </mesh>
        <group ref={swing1} position={[-0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <boxGeometry args={[0.55, 0.1, 0.22]} />
            <meshToonMaterial color="#7c3aed" />
          </mesh>
          <mesh position={[0, -0.75, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 4]} />
            <meshToonMaterial color="#475569" />
          </mesh>
        </group>
        <group ref={swing2} position={[0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <boxGeometry args={[0.55, 0.1, 0.22]} />
            <meshToonMaterial color="#ec4899" />
          </mesh>
          <mesh position={[0, -0.75, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 4]} />
            <meshToonMaterial color="#475569" />
          </mesh>
        </group>
      </group>

      {/* === Slide === */}
      <group position={[2, 0, -1]}>
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 1.25, -1]}>
            <cylinderGeometry args={[0.07, 0.07, 2.5, 6]} />
            <meshToonMaterial color="#15803d" />
          </mesh>
        ))}
        <mesh position={[0, 2.5, -1]}>
          <boxGeometry args={[1.2, 0.14, 1.2]} />
          <meshToonMaterial color="#22c55e" />
        </mesh>
        <mesh position={[0.05, 1.5, 0.3]} rotation={[-0.75, 0, 0]}>
          <boxGeometry args={[1.1, 0.1, 2.8]} />
          <meshToonMaterial color="#facc15" />
        </mesh>
      </group>

      {/* === Seesaw === */}
      <group position={[5, 0, 2]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 1.2, 6]} />
          <meshToonMaterial color="#7c3aed" />
        </mesh>
        <mesh position={[0, 1.25, 0]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[3.2, 0.12, 0.38]} />
          <meshToonMaterial color="#f97316" />
        </mesh>
      </group>

      {/* === Sandbox === */}
      <group position={[-2, 0, 3]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[3.2, 0.4, 2.6]} />
          <meshToonMaterial color="#92400e" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[3.0, 0.04, 2.4]} />
          <meshToonMaterial color="#fde68a" />
        </mesh>
      </group>
    </group>
  )
}

// ── Animated Moving Clouds ────────────────────────────────────────────────
function CloudPuff({ groupRef, startX, y, z, speed, puffs }) {
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x += delta * speed
      if (groupRef.current.position.x > 60) groupRef.current.position.x = -60
    }
  })
  return (
    <group ref={groupRef} position={[startX, y, z]}>
      {puffs.map(([px, py, r], i) => (
        <mesh key={i} position={[px, py, 0]}>
          <sphereGeometry args={[r, 8, 6]} />
          <meshToonMaterial color="#f8fafc" transparent opacity={0.88} />
        </mesh>
      ))}
    </group>
  )
}

function Clouds() {
  const c1 = useRef(), c2 = useRef(), c3 = useRef(), c4 = useRef()
  return (
    <>
      <CloudPuff groupRef={c1} startX={-30} y={14} z={-25} speed={1.0}
        puffs={[[-1,0,1],[0,0.5,1.3],[1,0,1],[0,-0.2,1.1]]} />
      <CloudPuff groupRef={c2} startX={15} y={16} z={-35} speed={0.55}
        puffs={[[-1.5,0,1.2],[0,0.7,1.5],[1.5,0,1.2],[-0.5,-0.3,1],[0.5,-0.3,1]]} />
      <CloudPuff groupRef={c3} startX={40} y={13} z={10} speed={1.3}
        puffs={[[-0.8,0,0.9],[0,0.4,1.1],[0.8,0,0.9]]} />
      <CloudPuff groupRef={c4} startX={-50} y={15} z={30} speed={0.75}
        puffs={[[-1.2,0,1.1],[0,0.6,1.4],[1.2,0,1.1],[0,-0.25,1]]} />
    </>
  )
}

// ── Park Fountain (secondary) ─────────────────────────────────────────────
function ParkArea() {
  return (
    <group position={[0, 0, 18]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[18, 10]} />
        <meshToonMaterial color="#4ade80" />
      </mesh>
      {/* Park benches */}
      {[[-5, 0, 3], [5, 0, 3], [-5, 0, -3], [5, 0, -3]].map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.42]} />
            <meshToonMaterial color="#92400e" />
          </mesh>
          <mesh position={[0, 0.25, -0.16]}>
            <boxGeometry args={[1.4, 0.3, 0.08]} />
            <meshToonMaterial color="#92400e" />
          </mesh>
        </group>
      ))}
      {/* Pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1]}>
        <circleGeometry args={[2.5, 16]} />
        <meshToonMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// ── Main CityMap ──────────────────────────────────────────────────────────
export default function CityMap() {
  return (
    <group>
      <Ground />
      <Roads />
      <Clouds />

      {/* ── Town Centre ── */}
      <Fountain pos={[0, 0, 0]} />
      <CityHall />

      {/* ── Original core buildings (kept) ── */}
      <Building pos={[-10, 0, -6]} w={5} d={4} h={5} color="#7F1D1D" roof="#F59E0B" />
      <Building pos={[10,  0, -6]} w={5} d={4} h={6} color="#1E1B4B" roof="#7C3AED" />
      <Building pos={[0,   0,-14]} w={8} d={4} h={2.5} color="#0C4A6E" roof="#38BDF8" />
      <Building pos={[-14, 0,  4]} w={4} d={4} h={8} color="#312E81" roof="#6366F1" />
      <Building pos={[14,  0,  4]} w={4} d={5} h={5} color="#831843" roof="#EC4899" />
      <Building pos={[0,   0, 14]} w={7} d={5} h={3} color="#14532D" roof="#22C55E" />
      <Building pos={[-6,  0,-10]} w={2} d={2} h={3}   color="#334155" roof="#475569" />
      <Building pos={[6,   0,-10]} w={2} d={2} h={3.5} color="#334155" roof="#7C3AED" />
      <Building pos={[-7,  0, 10]} w={2} d={2} h={2.5} color="#334155" roof="#22C55E" />
      <Building pos={[7,   0, 10]} w={2} d={2} h={2}   color="#334155" roof="#F59E0B" />

      {/* ── North District ── */}
      <Mall />
      <Cinema />
      <Supermarket />
      <Bank />
      <Building pos={[-5,  0,-28]} w={4} d={3} h={4} color="#6d28d9" roof="#a855f7" />
      <Building pos={[5,   0,-28]} w={4} d={3} h={3} color="#0f4c8a" roof="#3b82f6" />

      {/* ── East District (Services) ── */}
      <Hospital />
      <PoliceStation />
      <FireStation />

      {/* ── West District (Education) ── */}
      <School />
      <Library />
      <Gym />

      {/* ── South District ── */}
      <Restaurant />
      <GasStation />
      <Church />
      <PostOffice />
      <Apartments />
      <Playground />
      <ParkArea />

      {/* ── Residential Houses ── */}
      <House pos={[26, 0, 24]} color="#bfdbfe" roofColor="#1d4ed8" />
      <House pos={[36, 0, 24]} color="#fde68a" roofColor="#b45309" rotate={0.08} />
      <House pos={[26, 0, 34]} color="#fce7f3" roofColor="#be185d" rotate={-0.06} />
      <House pos={[36, 0, 34]} color="#d1fae5" roofColor="#065f46" />
      <House pos={[46, 0, 24]} color="#ede9fe" roofColor="#6d28d9" rotate={0.05} />
      <House pos={[46, 0, 34]} color="#fef3c7" roofColor="#92400e" />
      <House pos={[26, 0, 44]} color="#fee2e2" roofColor="#dc2626" rotate={-0.04} />
      <House pos={[36, 0, 44]} color="#ecfdf5" roofColor="#059669" />

      {/* ── Traffic Lights (single useFrame) ── */}
      <TrafficLights />

      {/* ── Trees (instanced — 63 trees, 4 draw calls) ── */}
      <InstancedTrees />

      {/* ── Street Lamps (instanced — 45 lamps, 3 draw calls) ── */}
      <InstancedLamps />

      {/* ── Fountain plaza benches ── */}
      {[[0,-2.6,0],[0,0,2.6,Math.PI/2],[2.6,0,0,Math.PI/2],[-2.6,0,0,Math.PI/2]].map(([x,y,z,ry=0],i)=>(
        <group key={`bench${i}`} position={[x,0,z]} rotation={[0,ry,0]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[1.3, 0.1, 0.42]} />
            <meshToonMaterial color="#92400e" />
          </mesh>
          <mesh position={[0, 0.25, -0.17]}>
            <boxGeometry args={[1.3, 0.3, 0.08]} />
            <meshToonMaterial color="#92400e" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
