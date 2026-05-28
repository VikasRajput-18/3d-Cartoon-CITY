// Renders all procedural-chunk trees as two InstancedMesh draw calls.
// Alternates tree1 / tree2 GLBs for variety.
// Falls back to simple green spheres if GLB is unavailable.
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getAllChunkTrees, onChunkTreeChange } from '@/lib/chunkTreeState'

// Same scale factor as CityMap's GLB trees — yields ~3-4 unit tall trees.
const TREE_SCALE = 0.018
// Pre-allocate enough slots for the maximum number of visible chunk trees.
// VIEW_R=2 → 25 chunks, up to ~13 trees each → ~325 max. 500 is safe headroom.
const MAX_PER_MODEL = 500

function extractMeshes(scene) {
  scene.updateWorldMatrix(true, true)
  const box    = new THREE.Box3().setFromObject(scene)
  const yOffset = box.isEmpty() ? 0 : Math.max(0, -box.min.y)
  const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
  const meshes  = []
  scene.traverse(child => {
    if (!child.isMesh || !child.geometry) return
    const mat         = Array.isArray(child.material) ? child.material[0] : child.material
    const localOffset = new THREE.Matrix4().multiplyMatrices(rootInv, child.matrixWorld)
    meshes.push({ geo: child.geometry, mat, localOffset })
  })
  return { meshes, yOffset }
}

// Renders one model's trees as multiple InstancedMeshes (one per sub-mesh in GLB).
function DynamicInstanced({ scene, placements }) {
  const { meshes, yOffset } = useMemo(() => extractMeshes(scene), [scene])
  const iRefs = useRef([])

  useEffect(() => {
    if (!meshes.length || !iRefs.current.length) return
    const dummy = new THREE.Object3D()
    placements.forEach(([x, z, s, ry], idx) => {
      const es = s * TREE_SCALE
      dummy.position.set(x, yOffset * es, z)
      dummy.rotation.set(0, ry, 0)
      dummy.scale.setScalar(es)
      dummy.updateMatrix()
      meshes.forEach(({ localOffset }, mi) => {
        const mesh = iRefs.current[mi]
        if (mesh) {
          mesh.setMatrixAt(idx, new THREE.Matrix4().multiplyMatrices(dummy.matrix, localOffset))
        }
      })
    })
    meshes.forEach((_, mi) => {
      const mesh = iRefs.current[mi]
      if (!mesh) return
      mesh.count = placements.length   // hides slots beyond current tree count
      mesh.instanceMatrix.needsUpdate = true
    })
  }, [meshes, placements, yOffset])

  if (!meshes.length) return null

  return (
    <>
      {meshes.map(({ geo, mat }, mi) => (
        <instancedMesh
          key={mi}
          ref={el => { iRefs.current[mi] = el }}
          args={[geo, mat, MAX_PER_MODEL]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </>
  )
}

// Fallback when GLB unavailable: simple sphere + cylinder per tree.
function FallbackTrees({ placements }) {
  return (
    <>
      {placements.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={[s, s, s]}>
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.15, 0.25, 2.5, 6]} />
            <meshToonMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 4.1, 0]}>
            <sphereGeometry args={[1.2, 7, 7]} />
            <meshToonMaterial color="#16a34a" />
          </mesh>
        </group>
      ))}
    </>
  )
}

function ChunkTreesInner({ allTrees }) {
  const { scene: scene1 } = useGLTF('/models/tree1.glb')
  const { scene: scene2 } = useGLTF('/models/tree2.glb')

  // Split alternately between tree1 and tree2 for variety
  const p1 = useMemo(
    () => allTrees.filter((_, i) => i % 2 === 0).map(t => [t.x, t.z, t.s, t.ry]),
    [allTrees]
  )
  const p2 = useMemo(
    () => allTrees.filter((_, i) => i % 2 !== 0).map(t => [t.x, t.z, t.s, t.ry]),
    [allTrees]
  )

  return (
    <>
      <DynamicInstanced scene={scene1} placements={p1} />
      <DynamicInstanced scene={scene2} placements={p2} />
    </>
  )
}

export default function ChunkTrees() {
  const [allTrees, setAllTrees] = useState(() => getAllChunkTrees())

  useEffect(() => onChunkTreeChange(() => setAllTrees([...getAllChunkTrees()])), [])

  return (
    <Suspense fallback={<FallbackTrees placements={allTrees.map(t => [t.x, t.z, t.s, t.ry])} />}>
      <ChunkTreesInner allTrees={allTrees} />
    </Suspense>
  )
}
