// Downtown City MegaKit — verified asset loaders.
//
// Measured native sizes (from glTF accessor bounds):
//   Building_Large_2       20.6 x 28.0 x 16.6
//   Building_Medium_2_001  15.1 x 25.0 x 13.1
//   Building_Small_1       12.5 x 17.0 x 14.5
//
// Buildings are HEIGHT-fit (target height / native height) per the design spec,
// and collision is derived from the *scaled* bounding box so the wall always sits
// exactly where the visual mesh is — no invisible walls.
import { Component, Suspense, useMemo, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const BASE = '/models/city/'

export const CITY_ASSETS = {
  buildingLarge:  BASE + 'Building_Large_2.gltf',
  buildingMedium: BASE + 'Building_Medium_2_001.gltf',
  buildingSmall:  BASE + 'Building_Small_1.gltf',
  street2:        BASE + 'Street_2Lane.gltf',
  asphalt:        BASE + 'Street_Asphalt_6x6.gltf',
  bollard:        BASE + 'Prop_Bollard.gltf',
  manhole:        BASE + 'Prop_ManholeCover.gltf',
}

const BUILDING_PATHS = {
  large:  CITY_ASSETS.buildingLarge,
  medium: CITY_ASSETS.buildingMedium,
  small:  CITY_ASSETS.buildingSmall,
}
// Target heights relative to the 1.8-unit player (Step 3)
const TARGET_HEIGHT = { large: 18, medium: 11, small: 7 }

// ── Error boundary — falls back to a plain box if a GLTF blows up ─────────────
class GLTFErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* GLTF failed — fallback already shown, no log */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// Primitive fallback box (matches the original building look)
function FallbackBox({ position = [0, 0, 0], size = [4, 4, 4], color = '#8B7355' }) {
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  )
}

// ── Core GLTF building — height-fit, base sits on ground (y=0) ────────────────
function GLTFBuilding({ url, position = [0, 0, 0], rotation = [0, 0, 0], targetHeight, scaleMult = 1 }) {
  const { scene } = useGLTF(url)
  const { clone, scale } = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(ch => {
      if (ch.isMesh) {
        ch.frustumCulled = true
        ch.castShadow = false
        ch.receiveShadow = false
        ch.userData._keepPBR = true   // ToonStyle leaves the PBR textures intact
      }
    })
    const box    = new THREE.Box3().setFromObject(c)
    const size   = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const s = (size.y > 1e-6 ? targetHeight / size.y : 1) * scaleMult
    // Recenter the model in NATIVE units so its X/Z footprint is centred on the
    // local origin and its base rests on y=0. The wrapper group then applies the
    // world position/rotation/scale, so collision (centred at pos) always matches
    // the visible mesh — regardless of which side the player approaches from.
    c.position.set(-center.x, -box.min.y, -center.z)
    return { clone: c, scale: s }
  }, [scene, targetHeight, scaleMult])

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <primitive object={clone} />
    </group>
  )
}

// ── Public SafeBuilding — never breaks the city ───────────────────────────────
// scaleMult lets callers shrink/grow a building (e.g. 0.7 for the tight plaza)
// without changing its base height-fit.
export function SafeBuilding({ type = 'large', position = [0, 0, 0], rotation = [0, 0, 0], scaleMult = 1, fallbackSize, fallbackColor = '#8B7355' }) {
  const url = BUILDING_PATHS[type] ?? BUILDING_PATHS.large
  const th  = TARGET_HEIGHT[type] ?? 12
  const fb  = <FallbackBox position={position} size={fallbackSize ?? [6, th, 6]} color={fallbackColor} />
  return (
    <GLTFErrorBoundary fallback={fb}>
      <Suspense fallback={fb}>
        <GLTFBuilding url={url} position={position} rotation={rotation} targetHeight={th} scaleMult={scaleMult} />
      </Suspense>
    </GLTFErrorBoundary>
  )
}

// ── Props (additive, no collision) — INSTANCED for 1 draw call per prop type ──
// Pulls the (single) geometry+material out of the GLTF and renders every instance
// as ONE InstancedMesh. 40 bollards + 7 manholes → 2 draw calls instead of ~47.
function InstancedProp({ url, placements, targetHeight = null, targetWidth = null, y = 0 }) {
  const { scene } = useGLTF(url)
  const meshRef = useRef()

  const { geometry, material, scale } = useMemo(() => {
    let geo = null, mat = null
    scene.traverse(ch => { if (ch.isMesh && !geo) { geo = ch.geometry; mat = ch.material } })
    if (!geo) return { geometry: null, material: null, scale: 1 }
    geo.computeBoundingBox()
    const bb = geo.boundingBox, size = new THREE.Vector3(); bb.getSize(size)
    let s = 1
    if (targetWidth != null && size.x > 1e-6)       s = targetWidth / size.x
    else if (targetHeight != null && size.y > 1e-6) s = targetHeight / size.y
    return { geometry: geo, material: mat, scale: s }
  }, [scene, targetHeight, targetWidth])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !geometry) return
    const dummy = new THREE.Object3D()
    // Lift so the model's base rests on y (geometry min.y * scale below origin)
    const baseLift = -(geometry.boundingBox?.min.y ?? 0) * scale
    placements.forEach(([x, z], i) => {
      dummy.position.set(x, y + baseLift, z)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.count = placements.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }, [geometry, scale, placements, y])

  if (!geometry || !material) return null
  return <instancedMesh ref={meshRef} args={[geometry, material, placements.length]} castShadow={false} receiveShadow={false} />
}

// Bollards along the main-highway footpath edges + manholes on the roads.
// All instanced → 2 draw calls total. No collision (decorative).
export function CityProps() {
  // Footpath edges run at z = ±7.5 (E-W highway) and x = ±7.5 (N-S highway).
  // Bollard sits 0.8u outside the road edge, into the sidewalk → ±8.3.
  const EDGE = 8.3
  const bollards = useMemo(() => {
    const out = []
    for (let d = -45; d <= 45; d += 10) {
      if (Math.abs(d) < 16) continue
      out.push([d, EDGE], [d, -EDGE], [EDGE, d], [-EDGE, d])
    }
    return out.slice(0, 40)
  }, [])

  const manholes = useMemo(() => ([
    [-22, 2.5], [24, -2.5], [-2.5, 28], [3, -36],
    [38, 2.5], [-40, -2.5], [2.5, 44],
  ]), [])

  return (
    <group>
      <GLTFErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <InstancedProp url={CITY_ASSETS.bollard} placements={bollards} targetHeight={1.8} y={0} />
        </Suspense>
      </GLTFErrorBoundary>
      <GLTFErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <InstancedProp url={CITY_ASSETS.manhole} placements={manholes} targetWidth={1.2} y={0.02} />
        </Suspense>
      </GLTFErrorBoundary>
    </group>
  )
}

// Measured native sizes (glTF accessor bounds) → scaled X/Z footprint for a
// building type, used to set a matching collision box (Step 7). Pure function.
const NATIVE_SIZE = {
  large:  { x: 20.64, y: 28.0,  z: 16.64 },
  medium: { x: 15.06, y: 25.01, z: 13.06 },
  small:  { x: 12.46, y: 17.03, z: 14.54 },
}
export function getScaledFootprint(type, scaleMult = 1) {
  const n  = NATIVE_SIZE[type] ?? { x: 12, y: 24, z: 12 }
  const th = TARGET_HEIGHT[type] ?? 12
  const s  = (th / n.y) * scaleMult
  return { w: n.x * s, d: n.z * s }
}

useGLTF.preload(CITY_ASSETS.buildingLarge)
useGLTF.preload(CITY_ASSETS.buildingMedium)
useGLTF.preload(CITY_ASSETS.buildingSmall)
useGLTF.preload(CITY_ASSETS.bollard)
useGLTF.preload(CITY_ASSETS.manhole)
