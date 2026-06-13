// Primitive-geometry accessories that attach to the standard character rig
// (Avatar3D proportions: head y1.52 r0.26, body capsule y0.78 r0.22, legs ±0.1,
// feet y0.08, neck y1.16). Every piece is <100 triangles, uses SHARED cached
// toon materials (one per colour — many wearers, zero extra programs), and the
// whole group is flagged noMerge/dynamic so CityMerger never touches it.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { gradientMap } from './ToonStyle'

// ── Shared material caches ────────────────────────────────────────────────────
const _matCache = new Map()
export function toonMat(color) {
  let m = _matCache.get(color)
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap })
    m.userData._toon = true
    _matCache.set(color, m)
  }
  return m
}
const _glowCache = new Map()
function glowMat(color) {   // born transparent — opacity is fixed, never toggled
  let m = _glowCache.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
    _glowCache.set(color, m)
  }
  return m
}

// ── Per-slot piece renderers ──────────────────────────────────────────────────
function HeadPiece({ id, color }) {
  const mat = toonMat(color)
  if (id === 'cap') return (
    <group position={[0, 1.72, 0]}>
      <mesh material={mat}><sphereGeometry args={[0.245, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4]} /></mesh>
      <mesh material={mat} position={[0, -0.01, 0.24]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.3, 0.03, 0.22]} /></mesh>
    </group>
  )
  if (id === 'beanie') return (
    <group position={[0, 1.73, 0]}>
      <mesh material={mat}><sphereGeometry args={[0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2]} /></mesh>
      <mesh material={mat} position={[0, -0.04, 0]}><cylinderGeometry args={[0.255, 0.255, 0.07, 12]} /></mesh>
    </group>
  )
  if (id === 'tophat') return (
    <group position={[0, 1.78, 0]}>
      <mesh material={mat}><cylinderGeometry args={[0.32, 0.32, 0.04, 12]} /></mesh>
      <mesh material={mat} position={[0, 0.16, 0]}><cylinderGeometry args={[0.19, 0.21, 0.3, 12]} /></mesh>
    </group>
  )
  if (id === 'crown') return (
    <group position={[0, 1.79, 0]}>
      <mesh material={toonMat('#f2c94c')}><cylinderGeometry args={[0.2, 0.22, 0.12, 8]} /></mesh>
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} material={toonMat('#f2c94c')} position={[Math.cos(i * Math.PI / 2) * 0.19, 0.1, Math.sin(i * Math.PI / 2) * 0.19]}>
          <coneGeometry args={[0.045, 0.1, 4]} />
        </mesh>
      ))}
    </group>
  )
  return null
}

function FacePiece({ id, color }) {
  const mat = toonMat(color)
  if (id === 'glasses') return (
    <group position={[0, 1.56, 0.25]}>
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} material={mat} position={[x, 0, 0]}><torusGeometry args={[0.06, 0.012, 6, 10]} /></mesh>
      ))}
      <mesh material={mat} position={[0, 0, 0]}><boxGeometry args={[0.08, 0.015, 0.015]} /></mesh>
    </group>
  )
  if (id === 'sunglasses') return (
    <group position={[0, 1.56, 0.25]}>
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} material={toonMat('#1a1a2e')} position={[x, 0, 0]}><boxGeometry args={[0.11, 0.075, 0.03]} /></mesh>
      ))}
      <mesh material={toonMat('#1a1a2e')}><boxGeometry args={[0.09, 0.018, 0.02]} /></mesh>
    </group>
  )
  if (id === 'goggles') return (
    <group position={[0, 1.57, 0.24]}>
      <mesh material={toonMat('#3d4a5c')}><boxGeometry args={[0.3, 0.09, 0.05]} /></mesh>
      <mesh material={glowMat(color)} position={[0, 0, 0.03]}><boxGeometry args={[0.26, 0.06, 0.012]} /></mesh>
    </group>
  )
  return null
}

function BeardPiece({ id, color }) {
  const mat = toonMat(color)
  if (id === 'stubble') return (
    <mesh material={mat} position={[0, 1.42, 0.16]} scale={[1, 0.55, 0.7]}><sphereGeometry args={[0.17, 8, 6]} /></mesh>
  )
  if (id === 'fullbeard') return (
    <group>
      <mesh material={mat} position={[0, 1.4, 0.13]} scale={[1, 0.85, 0.78]}><sphereGeometry args={[0.19, 8, 6]} /></mesh>
      <mesh material={mat} position={[0, 1.3, 0.1]} scale={[0.6, 0.7, 0.5]}><sphereGeometry args={[0.14, 8, 6]} /></mesh>
    </group>
  )
  if (id === 'goatee') return (
    <mesh material={mat} position={[0, 1.37, 0.2]} scale={[0.5, 0.8, 0.5]}><sphereGeometry args={[0.09, 8, 6]} /></mesh>
  )
  return null
}

function BodyPiece({ id, color }) {
  const mat = toonMat(color)
  if (id === 'hoodie') return (
    <group>
      <mesh material={mat} position={[0, 0.78, 0]} scale={[1.12, 1.08, 1.12]}><capsuleGeometry args={[0.22, 0.36, 4, 10]} /></mesh>
      <mesh material={mat} position={[0, 1.1, -0.16]} scale={[1, 0.6, 0.7]}><sphereGeometry args={[0.18, 8, 6]} /></mesh>
    </group>
  )
  if (id === 'blazer' || id === 'leather' || id === 'goldjacket') return (
    <group>
      <mesh material={mat} position={[0, 0.78, -0.02]} scale={[1.12, 1.05, 1.05]}><capsuleGeometry args={[0.22, 0.36, 4, 10]} /></mesh>
      <mesh material={toonMat(id === 'goldjacket' ? '#fff3c4' : '#f2e8d5')} position={[0, 0.88, 0.2]}><boxGeometry args={[0.1, 0.22, 0.06]} /></mesh>
    </group>
  )
  return null
}

function LegsPiece({ id, color }) {
  const mat = toonMat(color)
  const h = id === 'shorts' ? 0.26 : 0.46
  const y = id === 'shorts' ? 0.42 : 0.32
  return (
    <group>
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} material={mat} position={[x, y, 0]}><cylinderGeometry args={[0.1, 0.095, h, 8]} /></mesh>
      ))}
    </group>
  )
}

function FeetPiece({ id, color }) {
  const mat = toonMat(color)
  const big = id === 'boots'
  return (
    <group>
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} material={mat} position={[x, big ? 0.11 : 0.08, 0.05]} scale={[1, big ? 1.3 : 0.9, 1.35]}>
          <sphereGeometry args={[0.105, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

function BackPiece({ id, color }) {
  const mat = toonMat(color)
  if (id === 'backpack') return (
    <group position={[0, 0.85, -0.28]}>
      <mesh material={mat}><boxGeometry args={[0.3, 0.36, 0.14]} /></mesh>
      <mesh material={toonMat('#1a1a2e')} position={[0, 0.1, -0.08]}><boxGeometry args={[0.2, 0.1, 0.04]} /></mesh>
    </group>
  )
  if (id === 'cape') return (
    <mesh material={mat} position={[0, 0.72, -0.27]} rotation={[0.12, 0, 0]}>
      <boxGeometry args={[0.42, 0.78, 0.025]} />
    </mesh>
  )
  return null
}

function NeckPiece({ color }) {
  return (
    <mesh material={toonMat(color)} position={[0, 1.1, 0.06]} rotation={[1.25, 0, 0]}>
      <torusGeometry args={[0.15, 0.018, 6, 12]} />
    </mesh>
  )
}

// Aura — born-transparent shared material, animated by scale only (no opacity churn)
function AuraPiece({ id, color }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const s = 1 + Math.sin(t * (id === 'starpulse' ? 4 : 2)) * 0.12
    ref.current.scale.setScalar(s)
    ref.current.rotation.y = t * 0.8
  })
  return (
    <mesh ref={ref} material={glowMat(color)} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.6, 18]} />
    </mesh>
  )
}

const PIECES = {
  head: HeadPiece, face: FacePiece, beard: BeardPiece, body: BodyPiece,
  legs: LegsPiece, feet: FeetPiece, back: BackPiece, neck: NeckPiece, aura: AuraPiece,
}

/** items = { slot: { id, color } } — render all equipped accessory pieces. */
export default function Accessories({ items }) {
  if (!items) return null
  return (
    <group userData={{ noMerge: true, dynamic: true, _keepPBR: true }}>
      {Object.entries(items).map(([slot, it]) => {
        if (!it?.id) return null
        const Piece = PIECES[slot]
        return Piece ? <Piece key={slot} id={it.id} color={it.color} /> : null
      })}
    </group>
  )
}
