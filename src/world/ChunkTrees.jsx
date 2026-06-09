// Renders all procedural-chunk trees as TWO InstancedMeshes (trunk + foliage),
// using primitive geometry. The previous GLB tree models went missing and
// crashed the loader, so trees are now pure primitives — no external assets.
import { useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { getAllChunkTrees, onChunkTreeChange } from '@/lib/chunkTreeState'

// Headroom for the max number of simultaneously-visible chunk trees.
const MAX_TREES = 500

export default function ChunkTrees() {
  const [allTrees, setAllTrees] = useState(() => getAllChunkTrees())
  useEffect(() => onChunkTreeChange(() => setAllTrees([...getAllChunkTrees()])), [])

  const trunkRef = useRef()
  const leafRef  = useRef()
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), [])
  const leafGeo  = useMemo(() => new THREE.ConeGeometry(1.5, 3.4, 7), [])
  const trunkMat = useMemo(() => new THREE.MeshToonMaterial({ color: '#5C3D2E' }), [])
  const leafMat  = useMemo(() => new THREE.MeshToonMaterial({ color: '#3D8B37' }), [])

  useEffect(() => {
    const tm = trunkRef.current, lm = leafRef.current
    if (!tm || !lm) return
    const d = new THREE.Object3D()
    const n = Math.min(allTrees.length, MAX_TREES)
    for (let i = 0; i < n; i++) {
      const t = allTrees[i]
      const s = t.s || 1
      d.rotation.set(0, t.ry || 0, 0)
      d.scale.setScalar(s)
      d.position.set(t.x, 1.2 * s, t.z);          d.updateMatrix(); tm.setMatrixAt(i, d.matrix)
      d.position.set(t.x, (2.4 + 1.4) * s, t.z);  d.updateMatrix(); lm.setMatrixAt(i, d.matrix)
    }
    tm.count = n; lm.count = n
    tm.instanceMatrix.needsUpdate = true
    lm.instanceMatrix.needsUpdate = true
  }, [allTrees])

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, MAX_TREES]} frustumCulled={false} />
      <instancedMesh ref={leafRef}  args={[leafGeo,  leafMat,  MAX_TREES]} frustumCulled={false} />
    </>
  )
}
