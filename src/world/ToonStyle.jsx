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

// ── Puffy volumetric-ish clouds — clusters of overlapping spheres, drifting ────
export function Clouds() {
  const groupRef = useRef()
  const cloudMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff', transparent: true, opacity: 0.9, roughness: 1, metalness: 0, depthWrite: false,
  }), [])

  const clouds = useMemo(() => {
    const out = []
    for (let i = 0; i < 12; i++) {
      const puffN = 3 + Math.floor(Math.random() * 3)
      out.push({
        x: (Math.random() - 0.5) * 380,
        y: 38 + Math.random() * 26,
        z: (Math.random() - 0.5) * 380,
        s: 3 + Math.random() * 5,                       // overall cloud scale (3 small … 8 large)
        speed: 0.3 + Math.random() * 0.5,
        puffs: Array.from({ length: puffN }, () => [
          (Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.8,
          0.6 + Math.random() * 0.6,
        ]),
      })
    }
    return out
  }, [])

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return
    g.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * delta
      if (c.position.x > 220) c.position.x = -220     // wrap around
    })
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s} userData={{ noMerge: true }}>
          {c.puffs.map((p, j) => (
            <mesh key={j} material={cloudMat} position={[p[0], p[1], p[2]]} scale={p[3]}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ── Sky dome — vertical gradient that tracks the day/night background colour ───
// DayNightCycle keeps scene.background as a live Color (changes with time). The
// dome reads it each frame for the horizon colour and darkens it toward the zenith,
// so the gradient stays in sync with day/night instead of fighting it. It follows
// the camera so the player is always inside it.
export function SkyDome() {
  const { scene, camera } = useThree()
  const meshRef = useRef()
  const uniforms = useMemo(() => ({
    topColor:    { value: new THREE.Color('#1a6fa8') },
    bottomColor: { value: new THREE.Color('#87CEEB') },
    offset:      { value: 20 },
    exponent:    { value: 0.4 },
  }), [])

  useFrame(() => {
    if (meshRef.current) meshRef.current.position.copy(camera.position)
    const bg = scene.background
    if (bg && bg.isColor) {
      uniforms.bottomColor.value.copy(bg)
      uniforms.topColor.value.copy(bg).multiplyScalar(0.5)   // deeper blue overhead
    }
  })

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[500, 16, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          }
        `}
      />
    </mesh>
  )
}
