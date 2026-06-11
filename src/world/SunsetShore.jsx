// Sunset Shore — the city's beach, on the previously-empty east strip
// (x ≈ 155–250, |z| < 70; ocean continues east into the fog). Built within the
// hard perf rules: ONE animated water ShaderMaterial (compiled once at load —
// Programs count stays stable), instanced palms, static props left for
// CityMerger to batch. ProceduralChunks excludes this band from spawning
// buildings so nothing pops out of the ocean.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { C } from '@/lib/designTokens'

export const SHORE = { sandX0: 155, waterX: 212, z0: -70, z1: 70 }

// ── Animated ocean shader — gentle vertex swell + shore-fade colour mix ───────
// ShaderMaterial has no .color → CityMerger auto-skips it; ToonStyle ignores it.
const waterUniforms = {
  uTime:     { value: 0 },
  uShallow:  { value: new THREE.Color(C.waterShallow) },
  uDeep:     { value: new THREE.Color(C.waterDeep) },
  uFoam:     { value: new THREE.Color(C.foam) },
}
const waterMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  transparent: true,
  vertexShader: `
    uniform float uTime;
    varying float vShore;   // 0 at shoreline → 1 deep
    varying float vWave;
    void main() {
      vec3 p = position;
      // plane is rotated flat; local x runs east, local y runs north(z)
      float w1 = sin(p.x * 0.10 + uTime * 0.9);
      float w2 = sin(p.y * 0.14 - uTime * 0.7);
      vWave = w1 * w2;
      p.z += vWave * 0.18;                       // gentle swell (local z = world up)
      vShore = clamp(p.x / 60.0, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
    uniform float uTime;
    varying float vShore;
    varying float vWave;
    void main() {
      vec3 col = mix(uShallow, uDeep, vShore);
      // banded toon-style sparkle from the wave field
      float band = step(0.82, vWave);
      col = mix(col, uFoam, band * 0.35 * (1.0 - vShore));
      // foam wash at the shoreline, breathing with time
      float wash = smoothstep(0.085, 0.0, vShore + sin(uTime * 0.8) * 0.012);
      col = mix(col, uFoam, wash * 0.85);
      gl_FragColor = vec4(col, 0.92 - vShore * 0.05);
    }
  `,
})

// ── Static geometry built once at module scope ────────────────────────────────
const flat = (g) => { g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2)); return g }
const at = (g, x, y, z) => { g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z)); return g }

// Palm: leaning trunk + 6 drooping fronds, merged → 1 geometry per palm part set
const PALM_GEO = (() => {
  const parts = []
  // trunk = 3 stacked, progressively leaning cylinders
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.CylinderGeometry(0.16 - i * 0.03, 0.2 - i * 0.03, 1.5, 6)
    seg.applyMatrix4(new THREE.Matrix4().makeRotationZ(0.09 * (i + 1)))
    seg.applyMatrix4(new THREE.Matrix4().makeTranslation(0.18 * i + 0.08, 0.7 + i * 1.35, 0))
    parts.push(seg)
  }
  const trunk = mergeGeometries(parts, false)
  parts.forEach(g => g.dispose())
  // fronds = 6 flattened, tilted cones radiating from the crown
  const fparts = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const f = new THREE.ConeGeometry(0.34, 2.3, 4)
    f.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 0.28))
    f.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.55))
    f.applyMatrix4(new THREE.Matrix4().makeRotationY(a))
    f.applyMatrix4(new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.9, 4.45, Math.sin(a) * 0.9))
    fparts.push(f)
  }
  const fronds = mergeGeometries(fparts, false)
  fparts.forEach(g => g.dispose())
  return { trunk, fronds }
})()
const PALM_POS = [
  [168, -42, 1.05], [176, -18, 0.9], [165, 6, 1.1], [178, 30, 0.95], [169, 52, 1.0], [186, -55, 0.9],
]
const palmTrunkMat  = new THREE.MeshToonMaterial({ color: C.trunk })
const palmFrondMat  = new THREE.MeshToonMaterial({ color: C.foliageMid })

export default function SunsetShore() {
  const palmT = useRef()
  const palmF = useRef()

  useFrame((state) => { waterUniforms.uTime.value = state.clock.elapsedTime })

  useEffect(() => {
    const d = new THREE.Object3D()
    PALM_POS.forEach(([x, z, s], i) => {
      d.position.set(x, 0, z); d.scale.setScalar(s)
      d.rotation.set(0, (x * 3 + z) % 6.28, 0)
      d.updateMatrix()
      palmT.current?.setMatrixAt(i, d.matrix)
      palmF.current?.setMatrixAt(i, d.matrix)
    })
    if (palmT.current) palmT.current.instanceMatrix.needsUpdate = true
    if (palmF.current) palmF.current.instanceMatrix.needsUpdate = true
  }, [])

  return (
    <group>
      {/* dry sand apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[185, 0.006, 0]}>
        <planeGeometry args={[62, 144]} />
        <meshStandardMaterial color={C.sand} roughness={0.95} />
      </mesh>
      {/* wet sand strip at the waterline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[209, 0.01, 0]}>
        <planeGeometry args={[10, 144]} />
        <meshStandardMaterial color={C.sandWet} roughness={0.9} />
      </mesh>
      {/* ocean — runs east past the world bound into the fog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SHORE.waterX + 175, 0.05, 0]} material={waterMat} userData={{ noMerge: true }}>
        <planeGeometry args={[350, 360, 32, 16]} />
      </mesh>

      {/* palms (2 instanced draws) */}
      <instancedMesh ref={palmT} args={[PALM_GEO.trunk, palmTrunkMat, PALM_POS.length]} frustumCulled={false} />
      <instancedMesh ref={palmF} args={[PALM_GEO.fronds, palmFrondMat, PALM_POS.length]} frustumCulled={false} />

      {/* umbrellas + loungers */}
      {[[182, -30, C.awningRed], [190, -8, C.awningTeal], [184, 14, C.awningGold], [192, 38, C.awningRed]].map(([x, z, col], i) => (
        <group key={`um${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.05, 0.06, 2.2, 6]} /><meshStandardMaterial color={C.metal} /></mesh>
          <mesh position={[0, 2.15, 0]}><coneGeometry args={[1.5, 0.7, 8]} /><meshStandardMaterial color={col} roughness={0.7} /></mesh>
          <mesh position={[1.6, 0.28, 0.4]} rotation={[0, 0.4, 0]}>
            <boxGeometry args={[0.9, 0.18, 2]} /><meshStandardMaterial color={C.wallCream} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* beach sign */}
      <Billboard position={[170, 5, -60]}>
        <Text fontSize={1.2} color={C.awningGold} anchorX="center" anchorY="middle" outlineWidth={0.09} outlineColor="#000">
          🌅 Sunset Shore
        </Text>
      </Billboard>
    </group>
  )
}
