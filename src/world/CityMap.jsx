import React, { useRef, useEffect, useMemo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { timeWeatherState } from '@/lib/timeWeatherState'

const windowMat    = new THREE.MeshStandardMaterial({ color: '#1e293b', transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.2 })
const lampGlobeMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.1, emissive: '#000000' })

const APT_WIN = [
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b','#FEF9C3',
  '#FEF9C3','#FEF9C3','#1e293b','#FEF9C3','#FEF9C3','#1e293b',
]

const TREE_SCALE = 0.018

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
        <instancedMesh key={mi} ref={el => refs.current[mi] = el} args={[geo, mat, placements.length]}
          castShadow={false} receiveShadow={false} frustumCulled={false} />
      ))}
    </>
  )
}

// ── Ground ──────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#3a6b27" roughness={0.9} metalness={0} />
    </mesh>
  )
}

// ── Road Network — 12-unit main highways, roundabout, secondary roads ────
function Roads() {
  const road    = '#1e2229'
  const roadSec = '#252b34'
  const divider = '#e2e8f0'
  const dash    = '#facc15'
  const path    = '#c8c8c8'

  return (
    <group>
      {/* Main E-W highway (z=0), 12 wide */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[300, 12]} />
        <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
      </mesh>
      {/* Main N-S highway (x=0), 12 wide */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[12, 300]} />
        <meshStandardMaterial color={road} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Center dividers — E-W */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[300, 0.25]} />
        <meshStandardMaterial color={divider} roughness={0.7} />
      </mesh>
      {/* Center dividers — N-S */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[0.25, 300]} />
        <meshStandardMaterial color={divider} roughness={0.7} />
      </mesh>

      {/* Lane dashes E-W — left lane */}
      {Array.from({ length: 40 }, (_, i) => i - 20).map(i => (
        <mesh key={`dlew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i * 7 + 3.5, 0.022, -3]}>
          <planeGeometry args={[4, 0.15]} />
          <meshBasicMaterial color={dash} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Lane dashes E-W — right lane */}
      {Array.from({ length: 40 }, (_, i) => i - 20).map(i => (
        <mesh key={`drew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i * 7 + 3.5, 0.022, 3]}>
          <planeGeometry args={[4, 0.15]} />
          <meshBasicMaterial color={dash} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Lane dashes N-S */}
      {Array.from({ length: 40 }, (_, i) => i - 20).map(i => (
        <mesh key={`dlns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0.022, i * 7 + 3.5]}>
          <planeGeometry args={[0.15, 4]} />
          <meshBasicMaterial color={dash} transparent opacity={0.7} />
        </mesh>
      ))}
      {Array.from({ length: 40 }, (_, i) => i - 20).map(i => (
        <mesh key={`drns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[3, 0.022, i * 7 + 3.5]}>
          <planeGeometry args={[0.15, 4]} />
          <meshBasicMaterial color={dash} transparent opacity={0.7} />
        </mesh>
      ))}

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
      {/* Roundabout island (green) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[7.5, 36]} />
        <meshStandardMaterial color="#3a6b27" roughness={0.9} />
      </mesh>
      {/* Roundabout white lane markings */}
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2
        return (
          <mesh key={`rm${i}`} rotation={[-Math.PI / 2, 0, ang]} position={[Math.cos(ang) * 11, 0.025, Math.sin(ang) * 11]}>
            <planeGeometry args={[0.2, 1.5]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
          </mesh>
        )
      })}

      {/* Footpaths — light gray, 3 wide, beside main highways */}
      {[[-7.5, 0, 300, 3], [7.5, 0, 300, 3]].map(([z, , w, d], i) => (
        <mesh key={`fpew${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, z]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={path} roughness={0.85} />
        </mesh>
      ))}
      {[[-7.5, 3, 300], [7.5, 3, 300]].map(([x, , h], i) => (
        <mesh key={`fpns${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, 0]}>
          <planeGeometry args={[3, h]} />
          <meshStandardMaterial color={path} roughness={0.85} />
        </mesh>
      ))}

      {/* Crosswalks at main intersections */}
      {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((off, i) => (
        <React.Fragment key={`cw${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[17 + off * 0.2, 0.03, 7]}>
            <planeGeometry args={[0.5, 1.4]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.45} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-17 + off * 0.2, 0.03, 7]}>
            <planeGeometry args={[0.5, 1.4]} />
            <meshBasicMaterial color="#fff" transparent opacity={0.45} />
          </mesh>
        </React.Fragment>
      ))}
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
function CityPlaza() {
  return (
    <group>
      {/* Paving base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#b8bec8" roughness={0.88} />
      </mesh>
      {/* Paving tiles — alternating pattern */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => {
          if ((row + col) % 2 === 0) return null
          return (
            <mesh key={`pt${row}${col}`} rotation={[-Math.PI / 2, 0, 0]}
              position={[-17 + col * 5, 0.009, -17 + row * 5]}>
              <planeGeometry args={[4.5, 4.5]} />
              <meshStandardMaterial color="#c8cdd6" roughness={0.9} />
            </mesh>
          )
        })
      )}
      {/* Plaza benches */}
      {[[0, -12, 0], [0, 12, Math.PI], [12, 0, -Math.PI / 2], [-12, 0, Math.PI / 2]].map(([x, z, ry], i) => (
        <group key={`pb${i}`} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.2, 0.1, 0.5]} /><meshStandardMaterial color="#7c5c3e" roughness={0.7} /></mesh>
          <mesh position={[0, 0.25, -0.2]}><boxGeometry args={[2.2, 0.3, 0.1]} /><meshStandardMaterial color="#7c5c3e" roughness={0.7} /></mesh>
          {[-0.9, 0.9].map((bx, j) => (
            <mesh key={j} position={[bx, 0.2, 0]}><boxGeometry args={[0.1, 0.4, 0.45]} /><meshStandardMaterial color="#5a3e28" /></mesh>
          ))}
        </group>
      ))}
      {/* Street lamps around plaza */}
      {[[-14, -14], [14, -14], [-14, 14], [14, 14], [0, -18], [0, 18], [-18, 0], [18, 0]].map(([x, z], i) => (
        <group key={`pl${i}`} position={[x, 0, z]}>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.07, 0.1, 4, 6]} /><meshStandardMaterial color="#64748b" /></mesh>
          <mesh position={[0.3, 4.1, 0]}><cylinderGeometry args={[0.04, 0.04, 0.7, 6]} rotation={[0, 0, Math.PI / 2]} /><meshStandardMaterial color="#64748b" /></mesh>
          <mesh position={[0.3, 4.4, 0]}><sphereGeometry args={[0.16, 8, 6]} /><primitive object={lampGlobeMat} /></mesh>
        </group>
      ))}
      {/* Bollards at plaza edges */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`boll${i}`} position={[-17.5 + i * 5, 0.35, -19.8]}>
          <cylinderGeometry args={[0.12, 0.14, 0.7, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// ── Reusable Building ─────────────────────────────────────────────────────
function Building({ pos, w = 2, d = 2, h = 4, color = '#d4c5a9', roof = '#8a7560' }) {
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
      </mesh>
      <mesh position={[0, h / 2, 0]} scale={[1.025, 1.01, 1.025]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.15, 0.3, d + 0.15]} />
        <meshStandardMaterial color={roof} roughness={0.5} />
      </mesh>
    </group>
  )
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
const TREE_DATA = [
  // Roundabout island
  [-4,-4,1],[-4,4,1],[4,-4,1],[4,4,1],[-6,0,0.9],[6,0,0.9],[0,-6,0.9],[0,6,0.9],
  // Along E-W highway footpaths
  [-48,-9,.85],[-36,-9,.85],[-24,-9,.85],[-12,-9,.85],[12,-9,.85],[24,-9,.85],[36,-9,.85],[48,-9,.85],
  [-48, 9,.85],[-36, 9,.85],[-24, 9,.85],[-12, 9,.85],[12, 9,.85],[24, 9,.85],[36, 9,.85],[48, 9,.85],
  // Along N-S highway footpaths
  [-9,-48,.85],[-9,-36,.85],[-9,-24,.85],[-9,-12,.85],[-9,12,.85],[-9,24,.85],[-9,36,.85],[-9,48,.85],
  [ 9,-48,.85],[ 9,-36,.85],[ 9,-24,.85],[ 9,-12,.85],[ 9,12,.85],[ 9,24,.85],[ 9,36,.85],[ 9,48,.85],
  // SE residential zone trees
  [22,28,.8],[28,28,.8],[35,28,.8],[44,28,.8],
  [22,38,.8],[28,38,.8],[35,38,.8],[44,38,.8],
  [22,48,.8],[28,48,.8],[35,48,.8],[44,48,.8],
  // NW zone
  [-18,24,.8],[-22,24,.8],[-26,34,.8],[-36,34,.8],
  // NE park zone
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
        <cylinderGeometry args={[1.8, 2.1, 0.5, 16]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.08, 16]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.85} />
      </mesh>
      <mesh ref={sprayRef} position={[0, 1.85, 0]}>
        <coneGeometry args={[0.32, 0.7, 8]} />
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
    <group position={[0, 0, -24]}>
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
    <group position={[30, 0, 46]}>
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
    <group position={[30, 0, 26]}>
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
    <group position={[-32, 0, -24]}>
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
    <group position={[32, 0, -42]}>
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
    <group position={[32, 0, -24]}>
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
    <group position={[52, 0, -24]}>
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
    <group position={[52, 0, -42]}>
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
    <group position={[-52, 0, -42]}>
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
    <group position={[-52, 0, -24]}>
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
    <group position={[-50, 0, 26]}>
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
    <group position={[50, 0, 26]}>
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
    <group position={[-16, 0, 22]}>
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
    <group position={[-30, 0, 26]}>
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
    <group position={[16, 0, 22]}>
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
    <group position={[-30, 0, 46]}>
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
    <group position={[0, 0, 16]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#4ade80" roughness={0.85} />
      </mesh>
      {[[-6, 0, 3.5], [6, 0, 3.5], [-6, 0, -3.5], [6, 0, -3.5]].map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]}><boxGeometry args={[1.5, 0.1, 0.45]} /><meshStandardMaterial color="#6b4a2a" /></mesh>
          <mesh position={[0, 0.25, -0.18]}><boxGeometry args={[1.5, 0.3, 0.08]} /><meshStandardMaterial color="#6b4a2a" /></mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1]}>
        <circleGeometry args={[3, 16]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>
      {/* building */}
      <mesh position={[0, 2.5, 4.2]}>
        <boxGeometry args={[7.6, 5, 5.6]} />
        <meshStandardMaterial color="#3a5a3a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.15, 4.2]}><boxGeometry args={[7.8, 0.3, 5.8]} /><meshStandardMaterial color="#2a4a2a" /></mesh>
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
    <group position={[0, 0, 52]}>
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
function CenterBuildings() {
  return (
    <>
      {/* Cafe */}
      <Building pos={[-14, 0, -14]} w={4.4} d={4.4} h={3.5} color="#e8dcc8" roof="#8a6840" />
      {/* Arcade */}
      <Building pos={[14, 0, -14]}  w={4.4} d={4.4} h={4}   color="#2c2c40" roof="#3a3a58" />
      {/* Beach Club */}
      <Building pos={[0, 0, -32]}   w={6.4} d={4.4} h={3}   color="#c8d8e8" roof="#5a7a90" />
      {/* Rooftop Bar */}
      <Building pos={[-14, 0, 14]}  w={4.4} d={4.4} h={5}   color="#3a3040" roof="#4a4060" />
      {/* Music Room */}
      <Building pos={[14, 0, 14]}   w={4.4} d={4.4} h={4.5} color="#30283a" roof="#503860" />
      {/* Game Zone */}
      <Building pos={[0, 0, -40]}   w={6.4} d={4.4} h={3.5} color="#2a2a38" roof="#3a3a50" />
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

useGLTF.preload('/models/tree1.glb')
useGLTF.preload('/models/tree2.glb')
