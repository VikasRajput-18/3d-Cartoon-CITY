// Global art-style enforcer — gives the whole scene one consistent cel-shaded look
// without editing 100+ material sites by hand.
//
// What it does, by traversing the live scene:
//   1. Converts any MeshStandardMaterial / MeshPhysicalMaterial → MeshToonMaterial
//      (preserving color, map, emissive, transparency) — Rule 1.
//   2. Applies a shared 3-band gradient map to every MeshToonMaterial for the
//      classic shadow / midtone / highlight cel look — Rule 6.
//   3. Forces NoToneMapping + sRGB for flat, bold toon colors.
//
// Runs once on mount and re-applies on a light interval so streamed chunks and
// lazily-loaded GLB models (trees, characters, vehicles) get styled too.
// Materials are flagged so each is only processed once (cheap re-runs).
import { useEffect, useRef, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Shared 3-tone gradient map (shadow=0, midtone=128, highlight=255).
// Exported so chunk materials can be born WITH it set + the _toon flag, which
// makes ToonStyle skip them (no later gradientMap mutation → no shader recompile
// churn / Programs spike when chunks stream in).
export const gradientMap = new THREE.DataTexture(
  new Uint8Array([0, 128, 255]), 3, 1, THREE.RedFormat
)
gradientMap.minFilter = THREE.NearestFilter
gradientMap.magFilter = THREE.NearestFilter
gradientMap.needsUpdate = true

function toonify(mat) {
  if (!mat || mat.userData?._toon) return mat

  // Already toon → just add the gradient bands
  if (mat.isMeshToonMaterial) {
    mat.gradientMap = gradientMap
    mat.userData._toon = true
    mat.needsUpdate = true
    return mat
  }

  // PBR materials → convert to toon, preserving the important visual properties
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
    const toon = new THREE.MeshToonMaterial({
      color:             mat.color ? mat.color.clone() : new THREE.Color('#ffffff'),
      map:               mat.map || null,
      emissive:          mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
      emissiveIntensity: mat.emissiveIntensity ?? 1,
      emissiveMap:       mat.emissiveMap || null,
      transparent:       mat.transparent,
      opacity:           mat.opacity,
      alphaTest:         mat.alphaTest,
      side:              mat.side,
      depthWrite:        mat.depthWrite,
      vertexColors:      mat.vertexColors,
      gradientMap,
    })
    toon.userData._toon = true
    return toon
  }

  // Leave MeshBasicMaterial (UI planes, stars, outlines), Points, etc. untouched.
  return mat
}

export default function ToonStyle() {
  const { scene, gl } = useThree()

  useEffect(() => {
    // Flat toon rendering — no realistic tone curve (restored after GLTF revert)
    gl.toneMapping = THREE.NoToneMapping
    gl.outputColorSpace = THREE.SRGBColorSpace

    const apply = () => {
      scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        if (o.userData?._keepPBR) return   // real city GLTF assets keep their PBR look
        if (Array.isArray(o.material)) {
          let changed = false
          const next = o.material.map(m => { const t = toonify(m); if (t !== m) changed = true; return t })
          if (changed) o.material = next
        } else {
          const t = toonify(o.material)
          if (t !== o.material) o.material = t
        }
      })
    }

    apply()
    const iv = setInterval(apply, 1500)   // catch streamed chunks / lazy GLBs
    return () => clearInterval(iv)
  }, [scene, gl])

  return null
}

// ── Simple stylized clouds — flat toon discs drifting slowly ──────────────────
export function Clouds() {
  const groupRef = useRef()
  const cloudMat = useMemo(() => new THREE.MeshToonMaterial({
    color: '#ffffff', transparent: true, opacity: 0.9, gradientMap, depthWrite: false,
  }), [])

  const clouds = useMemo(() => {
    const out = []
    for (let i = 0; i < 8; i++) {
      out.push({
        x: (Math.random() - 0.5) * 220,
        y: 42 + Math.random() * 16,
        z: (Math.random() - 0.5) * 220,
        s: 6 + Math.random() * 8,
        speed: 0.4 + Math.random() * 0.5,
      })
    }
    return out
  }, [])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    g.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * delta
      if (c.position.x > 120) c.position.x = -120
    })
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {/* a cloud = a few overlapping flat discs for a bold puffy silhouette */}
          <mesh material={cloudMat} rotation={[-Math.PI / 2.2, 0, 0]}>
            <circleGeometry args={[c.s, 16]} />
          </mesh>
          <mesh material={cloudMat} position={[c.s * 0.6, 0, c.s * 0.3]} rotation={[-Math.PI / 2.2, 0, 0]}>
            <circleGeometry args={[c.s * 0.7, 16]} />
          </mesh>
          <mesh material={cloudMat} position={[-c.s * 0.6, 0, c.s * 0.2]} rotation={[-Math.PI / 2.2, 0, 0]}>
            <circleGeometry args={[c.s * 0.65, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
