import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { timeWeatherState } from '@/lib/timeWeatherState'

// Shared materials updated dynamically by DynamicLighting (same instance → one GPU call)
const windowMat    = new THREE.MeshStandardMaterial({ color: '#1e293b', transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.2 })
const lampGlobeMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.1, emissive: '#000000' })

// deterministic window-light pattern for apartments
const APT_WIN = [
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b',
]

// ── Tree scale: target 3.5-4.5 units tall (2-2.5x player height) ──────────
const TREE_SCALE = 0.018

// ── Generic instanced GLB renderer for trees ─────────────────────────────
// placements: [[x, z, scale, rotY], ...]
// Auto-aligns model base to y=0 using bounding box.
function InstancedGLBModel({ url, placements, scale: gs = 1 }) {
  const { scene } = useGLTF(url)

  const { meshes, yOffset } = useMemo(() => {
    scene.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(scene)
    const yOff = box.isEmpty() ? 0 : Math.max(0, -box.min.y)
    const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    const meshes = []
    scene.traverse(child => {
      if (!child.isMesh || !child.geometry) return
      const mat = Array.isArray(child.material) ? child.material[0] : child.material
      const localOffset = new THREE.Matrix4().multiplyMatrices(rootInv, child.matrixWorld)
      meshes.push({ geo: child.geometry, mat, localOffset })
    })
    return { meshes, yOffset: yOff }
  }, [scene])

  const refs = useRef([])

  useEffect(() => {
    if (!meshes.length || !placements.length) return
    const dummy = new THREE.Object3D()
    placements.forEach(([x, z, s = 1, ry = 0], idx) => {
      const es = s * gs
      dummy.position.set(x, yOffset * es, z)
      dummy.rotation.set(0, ry, 0)
      dummy.scale.setScalar(es)
      dummy.updateMatrix()
      meshes.forEach(({ localOffset }, mi) => {
        const ref = refs.current[mi]
        if (ref) ref.setMatrixAt(idx, new THREE.Matrix4().multiplyMatrices(dummy.matrix, localOffset))
      })
    })
    meshes.forEach((_, mi) => {
      if (refs.current[mi]) refs.current[mi].instanceMatrix.needsUpdate = true
    })
  }, [meshes, placements, gs, yOffset])

  return (
    <>
      {meshes.map(({ geo, mat }, mi) => (
        <instancedMesh
          key={mi}
          ref={el => refs.current[mi] = el}
          args={[geo, mat, placements.length]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        />
      ))}
    </>
  )
}

// ── Ground ──────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#2d5a1e" roughness={0.9} metalness={0} />
      </mesh>
      {/* Sidewalk strips along main E-W road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -2.7]}>
        <planeGeometry args={[120, 0.9]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 2.7]}>
        <planeGeometry args={[120, 0.9]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
      </mesh>
      {/* Sidewalk strips along main N-S road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.7, 0.005, 0]}>
        <planeGeometry args={[0.9, 120]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.7, 0.005, 0]}>
        <planeGeometry args={[0.9, 120]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
      </mesh>
    </>
  )
}

// ── Road Network ─────────────────────────────────────────────────────────────
function Roads() {
  const road = '#22252e'
  const dash = '#facc15'

  const hRoads = [
    { z: 0,   w: 120, h: 4   },
    { z: -18, w: 120, h: 3.5 },
    { z:  18, w: 120, h: 3.5 },
    { z: -34, w: 120, h: 3   },
    { z:  34, w: 120, h: 3   },
  ]
  const vRoads = [
    { x: 0,   w: 4,   h: 120 },
    { x: -20, w: 3.5, h: 120 },
    { x:  20, w: 3.5, h: 120 },
    { x: -40, w: 3,   h: 120 },
    { x:  40, w: 3,   h: 120 },
  ]

  return (
    <group>
      {hRoads.map(({ z, w, h }, i) => (
        <mesh key={`hr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
        </mesh>
      ))}
      {vRoads.map(({ x, w, h }, i) => (
        <mesh key={`vr${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
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
      {/* Crosswalk stripes */}
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
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, h / 2, 0]} scale={[1.025, 1.01, 1.025]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.12, 0.3, d + 0.12]} />
        <meshStandardMaterial color={roof} roughness={0.4} metalness={0.08} />
      </mesh>
      {windows && winOffsetsX.flatMap(wx => winOffsetsY.map(wy => [wx, wy])).map(([wx, wy], i) => (
        <mesh key={i} position={[wx, wy, d / 2 + 0.01]}>
          <planeGeometry args={[0.3, 0.38]} />
          <primitive object={windowMat} />
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
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
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
        <meshStandardMaterial color="#7C4A1E" />
      </mesh>
      {[-0.9, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 1.5, 1.52]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[3.3, 0.12, 3.3]} />
        <meshStandardMaterial color="#C5B89A" />
      </mesh>
    </group>
  )
}

// ── Tree data — all positions, split 50/50 between tree1 and tree2 GLBs ──
const TREE_DATA = [
  [-4,-4,1],[-4,4,1],[4,-4,1],[4,4,1],[-8,8,1],[8,8,1],[-8,-8,1],[8,-8,1],[-12,-2,1],[12,-2,1],
  [-48,-4.5,.88],[-38,-4.5,.88],[-28,-4.5,.88],[-22,-4.5,.88],[-8,-4.5,.88],
  [8,-4.5,.88],[22,-4.5,.88],[28,-4.5,.88],[38,-4.5,.88],[48,-4.5,.88],
  [-48,4.5,.88],[-38,4.5,.88],[-28,4.5,.88],[-22,4.5,.88],[-8,4.5,.88],
  [8,4.5,.88],[22,4.5,.88],[28,4.5,.88],[38,4.5,.88],[48,4.5,.88],
  [-4.5,-45,.85],[-4.5,-36.5,.85],[-4.5,-24,.85],[-4.5,-14,.85],
  [-4.5,14,.85],[-4.5,24,.85],[-4.5,36.5,.85],[-4.5,45,.85],
  [22,20,.8],[30,20,.8],[37,20,.8],[50,20,.8],[22,30,.8],[30,30,.8],[37,30,.8],[50,30,.8],
  [22,40,.8],[30,40,.8],[37,40,.8],[50,40,.8],[22,50,.8],[30,50,.8],[37,50,.8],[50,50,.8],
  [-16,24,.85],[-17,24,.85],[-22,24,.85],[-24,24,.85],
  [-8,-20,.82],[-5,-20,.82],[5,-20,.82],[8,-20,.82],
]

const MID = Math.ceil(TREE_DATA.length / 2)
const TREE1_PLACEMENTS = TREE_DATA.slice(0, MID).map(([x, z, s]) => [x, z, s, 0])
const TREE2_PLACEMENTS = TREE_DATA.slice(MID).map(([x, z, s]) => [x, z, s, Math.PI])

function GLBTrees() {
  return (
    <>
      <InstancedGLBModel url="/models/tree1.glb" placements={TREE1_PLACEMENTS} scale={TREE_SCALE} />
      <InstancedGLBModel url="/models/tree2.glb" placements={TREE2_PLACEMENTS} scale={TREE_SCALE} />
    </>
  )
}

// ── Instanced Lamps — primitive cylinders + sphere (day/night glow) ───────
const LAMP_DATA = [
  [-2.8,-2.8],[-2.8,2.8],[2.8,-2.8],[2.8,2.8],[-2.8,-8],[2.8,-8],[-2.8,8],[2.8,8],
  [-8,-20],[8,-20],[-22,-22],[22,-22],[-8,-30],[8,-30],[-30,-28],[30,-28],
  [22,-8],[22,5],[22,20],[22,27],[36,-3],[36,10],[36,22],
  [-22,-8],[-22,5],[-22,20],[-22,27],[-36,-3],[-36,-16],[-36,10],
  [-8,22],[8,22],[-8,32],[8,32],[-22,32],[22,32],[2.8,32],
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
      <instancedMesh ref={poleRef} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.07, 3, 6]} /><meshStandardMaterial color="#475569" />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[null, null, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} /><meshStandardMaterial color="#475569" />
      </instancedMesh>
      <instancedMesh ref={globeRef} args={[null, null, N]} frustumCulled={false}>
        <sphereGeometry args={[0.14, 8, 6]} /><primitive object={lampGlobeMat} />
      </instancedMesh>
    </>
  )
}

// ── Traffic Lights ─────────────────────────────────────────────────────────
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
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.47, 0]}>
        <cylinderGeometry args={[1.15, 1.15, 0.07, 14]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.2, 6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
      </mesh>
      <mesh ref={sprayRef} position={[0, 1.65, 0]}>
        <coneGeometry args={[0.28, 0.65, 8]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.55} />
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
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 8, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 8.6, 0]}>
        <sphereGeometry args={[2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {[-3.5, -1.2, 1.2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 3.5, 3.1]}>
          <cylinderGeometry args={[0.24, 0.3, 7, 8]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, i * 0.15 + 0.08, 3.1 + i * 0.3]}>
          <boxGeometry args={[9, 0.15, 0.6]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
      ))}
      {[-3, 0, 3].map((x, j) => [5.5, 2.5].map((y, k) => (
        <mesh key={`${j}${k}`} position={[x, y, 3.06]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshBasicMaterial color="#87CEEB" transparent opacity={0.8} />
        </mesh>
      )))}
      <mesh position={[0, 11.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
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
    <group position={[-16, 0, -28]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[14, 6, 8]} />
        <meshStandardMaterial color="#fce7f3" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[14, 6, 8]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.15, 0]}>
        <boxGeometry args={[14.2, 0.3, 8.2]} />
        <meshStandardMaterial color="#ec4899" />
      </mesh>
      <mesh position={[0, 6.6, 0]}>
        <sphereGeometry args={[2.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 2.6, 4.1]}>
        <boxGeometry args={[5, 5.2, 0.5]} />
        <meshStandardMaterial color="#f9a8d4" />
      </mesh>
      <mesh position={[0, 5.3, 4.36]}>
        <torusGeometry args={[2.1, 0.28, 6, 10, Math.PI]} />
        <meshStandardMaterial color="#ec4899" />
      </mesh>
      <mesh ref={signRef} position={[0, 5.5, 4.17]}>
        <planeGeometry args={[6, 0.55]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.9} />
      </mesh>
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
    if (marqueeRef.current) marqueeRef.current.material.color.setHSL((clock.elapsedTime * 0.18) % 1, 0.85, 0.5)
  })
  return (
    <group position={[16, 0, -28]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[10, 7, 7]} />
        <meshStandardMaterial color="#1c0533" />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 7, 7]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}>
        <boxGeometry args={[10.2, 0.3, 7.2]} />
        <meshStandardMaterial color="#4c1d95" />
      </mesh>
      <mesh position={[0, 5, 3.6]}>
        <boxGeometry args={[9.2, 2.6, 0.3]} />
        <meshStandardMaterial color="#0f0011" />
      </mesh>
      <mesh ref={marqueeRef} position={[0, 5, 3.76]}>
        <planeGeometry args={[8.6, 2.1]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.95} />
      </mesh>
      {[-3.5, -2, -0.5, 0.5, 2, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 6.1, 3.77]}>
          <circleGeometry args={[0.1, 5]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 3.61]}>
        <boxGeometry args={[4.2, 5, 0.3]} />
        <meshStandardMaterial color="#1a0033" />
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
        <meshStandardMaterial color="#f0fdf4" />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[10, 4, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[10.2, 0.3, 6.2]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      <mesh position={[0, 3.6, 3.3]}>
        <boxGeometry args={[10, 0.2, 1.2]} />
        <meshStandardMaterial color="#16a34a" />
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
        <meshStandardMaterial color="#f8f4e8" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[7, 6, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 6.2, 0]}>
        <boxGeometry args={[7.2, 0.4, 5.2]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      {[-2.5, -0.8, 0.8, 2.5].map((x, i) => (
        <mesh key={i} position={[x, 3, 2.6]}>
          <cylinderGeometry args={[0.2, 0.25, 6, 8]} />
          <meshStandardMaterial color="#fef3c7" />
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
        <meshStandardMaterial color="#f0f9ff" />
      </mesh>
      <mesh position={[0, 4, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[7, 8, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 8.15, 0]}>
        <boxGeometry args={[7.2, 0.3, 6.2]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
      <mesh position={[0, 5, 3.06]}><planeGeometry args={[0.5, 1.6]} /><meshBasicMaterial color="#ef4444" /></mesh>
      <mesh position={[0, 5, 3.07]}><planeGeometry args={[1.6, 0.5]} /><meshBasicMaterial color="#ef4444" /></mesh>
      {[-2, 0, 2].map((x, i) => [7, 5, 3].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.06]}>
          <planeGeometry args={[0.9, 1.1]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.9} />
        </mesh>
      )))}
      <mesh position={[0, 1.5, 3.55]}>
        <boxGeometry args={[3.2, 3, 1.2]} />
        <meshStandardMaterial color="#e0f2fe" />
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
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[5.2, 0.3, 5.2]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
      <mesh position={[0, 3, 2.56]}><circleGeometry args={[0.65, 5]} /><meshBasicMaterial color="#fbbf24" /></mesh>
      <mesh position={[0, 3, 2.57]}><circleGeometry args={[0.35, 8]} /><meshBasicMaterial color="#1e3a5f" /></mesh>
      <mesh position={[0, 5.5, 0]}><boxGeometry args={[2, 0.3, 0.5]} /><meshBasicMaterial color="#3b82f6" /></mesh>
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
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[7.2, 0.3, 5.2]} /><meshStandardMaterial color="#991b1b" /></mesh>
      {[-2.2, 0, 2.2].map((x, i) => (
        <group key={i} position={[x, 0, 2.56]}>
          <mesh position={[0, 1.5, 0]}><planeGeometry args={[1.8, 3]} /><meshBasicMaterial color="#b91c1c" /></mesh>
          {[0.6, 1.1, 1.6, 2.1, 2.6].map((y, j) => (
            <mesh key={j} position={[0, y, 0.01]}><planeGeometry args={[1.8, 0.06]} /><meshBasicMaterial color="#7f1d1d" /></mesh>
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
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 3.5, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[9, 7, 6]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7.15, 0]}><boxGeometry args={[9.2, 0.3, 6.2]} /><meshStandardMaterial color="#f59e0b" /></mesh>
      <mesh position={[0, 8, 0]}><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color="#fbbf24" /></mesh>
      <mesh position={[0, 9.2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 1.6, 4]} /><meshStandardMaterial color="#d97706" />
      </mesh>
      {[-3, -1, 1, 3].map((x, i) => [5, 2.5].map((y, j) => (
        <mesh key={`${i}${j}`} position={[x, y, 3.06]}>
          <planeGeometry args={[1.3, 1.6]} />
          <meshBasicMaterial color="#FEF9C3" transparent opacity={0.9} />
        </mesh>
      )))}
      <mesh position={[0, 1.6, 3.15]}><boxGeometry args={[2.8, 3.2, 0.4]} /><meshStandardMaterial color="#f59e0b" /></mesh>
    </group>
  )
}

// ── Library ───────────────────────────────────────────────────────────────
function Library() {
  return (
    <group position={[-34, 0, -20]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshStandardMaterial color="#d4b896" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[7, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[7.2, 0.3, 5.2]} /><meshStandardMaterial color="#92400e" /></mesh>
      {[-2, 0, 2].map((x, i) => (
        <mesh key={i} position={[x, 2.5, 2.56]}>
          <planeGeometry args={[1.3, 2.2]} />
          <meshBasicMaterial color="#93c5fd" transparent opacity={0.8} />
        </mesh>
      ))}
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
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[6, 5, 5]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[6.2, 0.3, 5.2]} /><meshStandardMaterial color="#7c3aed" /></mesh>
      <mesh position={[0, 3, 2.56]}><planeGeometry args={[3, 2]} /><meshBasicMaterial color="#facc15" transparent opacity={0.85} /></mesh>
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
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, 2.5, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 5, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 5.15, 0]}><boxGeometry args={[5.2, 0.3, 4.2]} /><meshStandardMaterial color="#f59e0b" /></mesh>
      <mesh position={[0, 3.3, 2.25]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[5.2, 0.12, 1.6]} /><meshStandardMaterial color="#f97316" />
      </mesh>
      {[-1.5, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 3.8]}>
          <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.38, 0.38, 0.07, 8]} /><meshStandardMaterial color="#fcd34d" /></mesh>
          <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.04, 0.04, 0.8, 6]} /><meshStandardMaterial color="#d97706" /></mesh>
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
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 1.5, -1.5]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[4, 3, 3]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 3.5, 0.8]}><boxGeometry args={[9, 0.2, 7]} /><meshStandardMaterial color="#ef4444" /></mesh>
      {[-3.5, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 1.75, 0.8]}>
          <cylinderGeometry args={[0.12, 0.15, 3.5, 6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.85} metalness={0} />
        </mesh>
      ))}
      {[-1.5, 0, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 1.8]}>
          <mesh position={[0, 1, 0]}><boxGeometry args={[0.5, 2, 0.35]} /><meshStandardMaterial color="#475569" /></mesh>
          <mesh position={[0, 1.2, 0.2]}><planeGeometry args={[0.34, 0.22]} /><meshBasicMaterial color="#fbbf24" /></mesh>
        </group>
      ))}
      <mesh ref={signRef} position={[0, 3, -3.06]}>
        <planeGeometry args={[3.5, 1.2]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={1} />
      </mesh>
    </group>
  )
}

// ── Church ────────────────────────────────────────────────────────────────
function Church() {
  return (
    <group position={[-25, 0, 18]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[6, 6, 7]} />
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      <mesh position={[0, 3, 0]} scale={[1.01, 1.005, 1.01]}>
        <boxGeometry args={[6, 6, 7]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 7, 0]}><boxGeometry args={[2.6, 3, 2.6]} /><meshStandardMaterial color="#e7dfd0" /></mesh>
      <mesh position={[0, 9.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 3.2, 4]} /><meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 11.4, 0]}><boxGeometry args={[0.15, 1.1, 0.15]} /><meshStandardMaterial color="#fbbf24" /></mesh>
      <mesh position={[0, 11.7, 0]}><boxGeometry args={[0.65, 0.15, 0.15]} /><meshStandardMaterial color="#fbbf24" /></mesh>
      <mesh position={[0, 5, 3.56]}><circleGeometry args={[0.85, 12]} /><meshBasicMaterial color="#93c5fd" transparent opacity={0.75} /></mesh>
      <mesh position={[0, 2, 3.56]}><planeGeometry args={[2.2, 4]} /><meshBasicMaterial color="#7c4a1e" transparent opacity={0.85} /></mesh>
    </group>
  )
}

// ── Post Office ───────────────────────────────────────────────────────────
function PostOffice() {
  return (
    <group position={[12, 0, 18]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[5, 4, 4]} />
        <meshStandardMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[0, 2, 0]} scale={[1.02, 1.01, 1.02]}>
        <boxGeometry args={[5, 4, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 4.15, 0]}><boxGeometry args={[5.2, 0.3, 4.2]} /><meshStandardMaterial color="#dc2626" /></mesh>
      <mesh position={[0, 3.5, 2.06]}><planeGeometry args={[4.5, 0.45]} /><meshBasicMaterial color="#1d4ed8" /></mesh>
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
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 6, 0]} scale={[1.02, 1.005, 1.02]}>
        <boxGeometry args={[5, 12, 4]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 12.15, 0]}><boxGeometry args={[5.2, 0.3, 4.2]} /><meshStandardMaterial color="#475569" /></mesh>
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

// ── Park area with benches + pond ─────────────────────────────────────────
function ParkArea() {
  return (
    <group position={[0, 0, 18]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[18, 10]} />
        <meshStandardMaterial color="#4ade80" />
      </mesh>
      {[[-5, 0, 3], [5, 0, 3], [-5, 0, -3], [5, 0, -3]].map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.4, 0.1, 0.42]} /><meshStandardMaterial color="#92400e" /></mesh>
          <mesh position={[0, 0.25, -0.16]}><boxGeometry args={[1.4, 0.3, 0.08]} /><meshStandardMaterial color="#92400e" /></mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1]}>
        <circleGeometry args={[2.5, 16]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// ── Playground (swing animation kept) ────────────────────────────────────
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#86efac" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`fp${i}`} position={[-7 + i * 2, 0.5, -5.5]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
      ))}
      <group position={[-4.5, 0, -1]}>
        {[-1.2, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 2, 0]}><cylinderGeometry args={[0.07, 0.07, 4, 6]} /><meshStandardMaterial color="#f97316" /></mesh>
        ))}
        <mesh position={[0, 4.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 2.6, 6]} /><meshStandardMaterial color="#f97316" />
        </mesh>
        <group ref={swing1} position={[-0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}><boxGeometry args={[0.55, 0.1, 0.22]} /><meshStandardMaterial color="#7c3aed" /></mesh>
          <mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.02, 0.02, 1.5, 4]} /><meshStandardMaterial color="#475569" /></mesh>
        </group>
        <group ref={swing2} position={[0.5, 4.1, 0]}>
          <mesh position={[0, -1.5, 0]}><boxGeometry args={[0.55, 0.1, 0.22]} /><meshStandardMaterial color="#ec4899" /></mesh>
          <mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.02, 0.02, 1.5, 4]} /><meshStandardMaterial color="#475569" /></mesh>
        </group>
      </group>
      <group position={[2, 0, -1]}>
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 1.25, -1]}><cylinderGeometry args={[0.07, 0.07, 2.5, 6]} /><meshStandardMaterial color="#15803d" /></mesh>
        ))}
        <mesh position={[0, 2.5, -1]}><boxGeometry args={[1.2, 0.14, 1.2]} /><meshStandardMaterial color="#22c55e" /></mesh>
        <mesh position={[0.05, 1.5, 0.3]} rotation={[-0.75, 0, 0]}>
          <boxGeometry args={[1.1, 0.1, 2.8]} /><meshStandardMaterial color="#facc15" />
        </mesh>
      </group>
      <group position={[5, 0, 2]}>
        <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.09, 0.11, 1.2, 6]} /><meshStandardMaterial color="#7c3aed" /></mesh>
        <mesh position={[0, 1.25, 0]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[3.2, 0.12, 0.38]} /><meshStandardMaterial color="#f97316" />
        </mesh>
      </group>
      <group position={[-2, 0, 3]}>
        <mesh position={[0, 0.2, 0]}><boxGeometry args={[3.2, 0.4, 2.6]} /><meshStandardMaterial color="#92400e" /></mesh>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[3.0, 0.04, 2.4]} /><meshStandardMaterial color="#fde68a" /></mesh>
      </group>
    </group>
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
    lampGlobeMat.emissiveIntensity = on ? 1.2 : 0
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

      <Fountain pos={[0, 0, 0]} />
      <CityHall />

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

      <Mall />
      <Cinema />
      <Supermarket />
      <Bank />
      <Building pos={[-5,  0,-28]} w={4} d={3} h={4} color="#6d28d9" roof="#a855f7" />
      <Building pos={[5,   0,-28]} w={4} d={3} h={3} color="#0f4c8a" roof="#3b82f6" />

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

      <House pos={[26, 0, 24]} color="#bfdbfe" roofColor="#1d4ed8" />
      <House pos={[36, 0, 24]} color="#fde68a" roofColor="#b45309" rotate={0.08} />
      <House pos={[26, 0, 34]} color="#fce7f3" roofColor="#be185d" rotate={-0.06} />
      <House pos={[36, 0, 34]} color="#d1fae5" roofColor="#065f46" />
      <House pos={[46, 0, 24]} color="#ede9fe" roofColor="#6d28d9" rotate={0.05} />
      <House pos={[46, 0, 34]} color="#fef3c7" roofColor="#92400e" />
      <House pos={[26, 0, 44]} color="#fee2e2" roofColor="#dc2626" rotate={-0.04} />
      <House pos={[36, 0, 44]} color="#ecfdf5" roofColor="#059669" />

      <TrafficLights />

      {/* GLB trees — tree1 + tree2, same positions as original, target 3.5-4.5 units tall */}
      <Suspense fallback={null}>
        <GLBTrees />
      </Suspense>

      <InstancedLamps />

      {/* Fountain plaza benches */}
      {[[0,-2.6,0],[0,0,2.6,Math.PI/2],[2.6,0,0,Math.PI/2],[-2.6,0,0,Math.PI/2]].map(([x,y,z,ry=0],i) => (
        <group key={`bench${i}`} position={[x,0,z]} rotation={[0,ry,0]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.3, 0.1, 0.42]} /><meshStandardMaterial color="#92400e" /></mesh>
          <mesh position={[0, 0.25, -0.17]}><boxGeometry args={[1.3, 0.3, 0.08]} /><meshStandardMaterial color="#92400e" /></mesh>
        </group>
      ))}
    </group>
  )
})

export default CityMap

useGLTF.preload('/models/tree1.glb')
useGLTF.preload('/models/tree2.glb')
