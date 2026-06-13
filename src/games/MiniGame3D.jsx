// Reusable 3D mini-game shell: a clean lightweight Three.js canvas with toon
// lighting, a camera, and an HTML HUD overlay slot. Each Game Arena game renders
// its 3D scene as children and its score/timer/lives as `hud`.
//
// While any 3D mini-game is mounted it broadcasts `minigame-3d {active}` so the
// main city canvas can freeze its render loop (WorldCanvas listens) — the mini-game
// fully covers the screen, so the city behind it would otherwise burn GPU for nothing.
import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'

export function MiniLights() {
  return (
    <>
      <ambientLight intensity={0.72} color="#ffffff" />
      <directionalLight position={[6, 13, 8]} intensity={1.05} color="#fff3e0" />
      <directionalLight position={[-7, 6, -4]} intensity={0.32} color="#a5b4fc" />
      <hemisphereLight args={['#dbeafe', '#1e1b4b', 0.35]} />
    </>
  )
}

export default function MiniGame3D({
  children,
  hud,
  camera = { position: [0, 16, 12], fov: 55, near: 0.1, far: 200 },
  background = 'radial-gradient(circle at 50% 32%, #211a4d 0%, #0a0716 70%)',
  dpr = 1,
  onPointerDown,
}) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('minigame-3d', { detail: { active: true } }))
    return () => window.dispatchEvent(new CustomEvent('minigame-3d', { detail: { active: false } }))
  }, [])

  return (
    <div className="w-full h-full relative select-none overflow-hidden" style={{ background }} onPointerDown={onPointerDown}>
      <Canvas
        dpr={dpr}
        camera={camera}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <MiniLights />
        {children}
      </Canvas>
      {hud}
    </div>
  )
}
