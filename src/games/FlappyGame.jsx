// Flappy 3D — same rules & scoring as the original (flap up, gravity pulls down,
// score one per pipe passed, speed ramps with score) rendered as a side-view 3D
// flyer: a primitive toon bird, colourful 3D pipes with gaps, parallax clouds and
// distant buildings, a flap wing animation, and a tumble on death.
import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioSystem } from '@/lib/audioSystem'
import MiniGame3D from './MiniGame3D'

const BIRD_X   = -3.5
const CEIL_Y   = 6
const FLOOR_Y  = -4.4
const GRAVITY  = 17       // units / s²
const FLAP_V   = 6.6      // upward velocity on flap
const GAP      = 3.2
const PIPE_HW  = 0.65     // pipe half-width
const SPAWN_X  = 9
const DESPAWN_X = -9.5
const SPACING  = 4.9      // horizontal distance between pipes
const BASE_SPEED = 4.6    // units / s
const BIRD_R   = 0.42
const POOL     = 7        // max pipes on screen
const PIPE_COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#ec4899', '#a855f7', '#ef4444']

function FlappyScene({ pausedRef, onResult, onScore, flapSignal }) {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(-1.5, 0, 0) }, [camera])

  const sim = useRef({
    bird: { y: 0.5, vy: 0 },
    pipes: [],            // { x, gapY, passed, colorIdx }
    score: 0, started: false, dead: false, deadT: 0, nextColor: 0,
  })
  const birdRef = useRef()
  const wingRef = useRef()
  const pipeRefs = useRef([])      // pool of group refs
  const cloudRefs = useRef([])
  const bldgRefs  = useRef([])
  const resultSent = useRef(false)

  const mats = useMemo(() => ({
    pipe: PIPE_COLORS.map(c => new THREE.MeshToonMaterial({ color: c })),
    cap:  new THREE.MeshToonMaterial({ color: '#0f172a' }),
    body: new THREE.MeshToonMaterial({ color: '#fbbf24' }),
    belly: new THREE.MeshToonMaterial({ color: '#fde68a' }),
    wing: new THREE.MeshToonMaterial({ color: '#f59e0b' }),
    beak: new THREE.MeshToonMaterial({ color: '#fb923c' }),
    eyeW: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    eyeP: new THREE.MeshBasicMaterial({ color: '#0b0b14' }),
    cloud: new THREE.MeshToonMaterial({ color: '#c7d2fe' }),
    bldg: new THREE.MeshToonMaterial({ color: '#4c3a82' }),
    ground: new THREE.MeshToonMaterial({ color: '#16a34a' }),
  }), [])
  const geos = useMemo(() => ({
    pipe: new THREE.BoxGeometry(PIPE_HW * 2, 1, PIPE_HW * 2),
    cap:  new THREE.BoxGeometry(PIPE_HW * 2 + 0.25, 0.4, PIPE_HW * 2 + 0.25),
    bird: new THREE.SphereGeometry(BIRD_R, 18, 18),
    wing: new THREE.BoxGeometry(0.5, 0.12, 0.34),
    beak: new THREE.ConeGeometry(0.14, 0.34, 10),
    eye:  new THREE.SphereGeometry(0.09, 8, 8),
    cloud: new THREE.SphereGeometry(0.7, 10, 10),
  }), [])
  useEffect(() => () => {
    mats.pipe.forEach(m => m.dispose())
    Object.values(mats).forEach(m => { if (!Array.isArray(m)) m.dispose() })
    Object.values(geos).forEach(g => g.dispose())
  }, [mats, geos])

  function flap() {
    const s = sim.current
    if (s.dead) return
    s.started = true
    s.bird.vy = FLAP_V
    audioSystem.playClick?.()
  }
  // flapSignal is a ref whose .current increments when the parent requests a flap
  // (all input — pointer + keyboard — is funnelled through the parent so the start
  // overlay and the sim stay in sync).
  const lastFlap = useRef(0)
  useFrame(() => { if (flapSignal.current !== lastFlap.current) { lastFlap.current = flapSignal.current; flap() } })

  function spawnPipe() {
    const s = sim.current
    const gapY = -1.6 + Math.random() * 3.4
    s.pipes.push({ x: SPAWN_X, gapY, passed: false, colorIdx: s.nextColor })
    s.nextColor = (s.nextColor + 1) % PIPE_COLORS.length
  }

  useFrame((state, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    // Parallax background (always animates)
    cloudRefs.current.forEach((c, i) => {
      if (!c) return
      c.position.x -= dt * (0.5 + i * 0.12)
      if (c.position.x < -12) c.position.x = 12
    })
    bldgRefs.current.forEach((b, i) => {
      if (!b) return
      b.position.x -= dt * (1.1 + i * 0.05)
      if (b.position.x < -13) b.position.x = 13
    })

    if (pausedRef.current) return

    if (s.dead) {
      // Tumble
      s.bird.vy -= GRAVITY * dt
      s.bird.y += s.bird.vy * dt
      if (birdRef.current) {
        birdRef.current.position.y = Math.max(FLOOR_Y + BIRD_R, s.bird.y)
        birdRef.current.rotation.z -= dt * 9
      }
      s.deadT += dt
      if (s.deadT > 0.7 && !resultSent.current) { resultSent.current = true; onResult?.(s.score) }
      return
    }

    if (!s.started) {
      // Idle bob before first flap
      if (birdRef.current) {
        birdRef.current.position.y = 0.5 + Math.sin(t * 2.5) * 0.25
        birdRef.current.rotation.z = Math.sin(t * 2.5) * 0.12
      }
      if (wingRef.current) wingRef.current.rotation.x = Math.sin(t * 8) * 0.5
      return
    }

    const speedMult = 1 + s.score * 0.04
    const speed = BASE_SPEED * speedMult

    // Bird physics
    s.bird.vy -= GRAVITY * dt
    s.bird.y += s.bird.vy * dt

    // Ground / ceiling
    if (s.bird.y < FLOOR_Y + BIRD_R) {
      s.bird.y = FLOOR_Y + BIRD_R; s.dead = true; audioSystem.playError?.(); return
    }
    if (s.bird.y > CEIL_Y - BIRD_R) { s.bird.y = CEIL_Y - BIRD_R; s.bird.vy = 0 }

    // Spawn
    const lastX = s.pipes.length ? s.pipes[s.pipes.length - 1].x : -Infinity
    if (lastX < SPAWN_X - SPACING) spawnPipe()

    // Move + score + collide
    for (let i = s.pipes.length - 1; i >= 0; i--) {
      const p = s.pipes[i]
      p.x -= speed * dt
      if (p.x < DESPAWN_X) { s.pipes.splice(i, 1); continue }
      if (!p.passed && p.x + PIPE_HW < BIRD_X) {
        p.passed = true; s.score++; onScore(s.score); audioSystem.playChime?.()
      }
      if (Math.abs(BIRD_X - p.x) < PIPE_HW + BIRD_R) {
        if (s.bird.y + BIRD_R > p.gapY + GAP / 2 || s.bird.y - BIRD_R < p.gapY - GAP / 2) {
          s.dead = true; audioSystem.playError?.(); return
        }
      }
    }

    // Render bird
    if (birdRef.current) {
      birdRef.current.position.y = s.bird.y
      birdRef.current.rotation.z = THREE.MathUtils.clamp(s.bird.vy * 0.09, -0.6, 0.5)
    }
    if (wingRef.current) {
      const flapPhase = s.bird.vy > 0 ? t * 26 : t * 9
      wingRef.current.rotation.x = Math.sin(flapPhase) * (s.bird.vy > 0 ? 0.9 : 0.4)
    }

    // Render pipes via pool
    for (let i = 0; i < POOL; i++) {
      const g = pipeRefs.current[i]
      if (!g) continue
      const p = s.pipes[i]
      if (!p) { g.visible = false; continue }
      g.visible = true
      g.position.x = p.x
      const topMesh = g.children[0], topCap = g.children[1], botMesh = g.children[2], botCap = g.children[3]
      const gapTop = p.gapY + GAP / 2, gapBot = p.gapY - GAP / 2
      const topH = CEIL_Y - gapTop, botH = gapBot - FLOOR_Y
      topMesh.scale.y = Math.max(0.1, topH); topMesh.position.y = gapTop + topH / 2
      botMesh.scale.y = Math.max(0.1, botH); botMesh.position.y = FLOOR_Y + botH / 2
      topCap.position.y = gapTop + 0.2
      botCap.position.y = gapBot - 0.2
      const m = mats.pipe[p.colorIdx]
      topMesh.material = m; botMesh.material = m
    }
  })

  return (
    <group>
      {/* Background parallax */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`c${i}`} ref={el => (cloudRefs.current[i] = el)} geometry={geos.cloud} material={mats.cloud}
          position={[-10 + i * 5, 2.5 + (i % 3), -7]} scale={[1.6, 1, 1]} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`b${i}`} ref={el => (bldgRefs.current[i] = el)} geometry={undefined} material={mats.bldg}
          position={[-12 + i * 4.5, -2.2, -5]}>
          <boxGeometry args={[1.8, 3 + (i % 3) * 1.6, 1.2]} />
        </mesh>
      ))}

      {/* Ground */}
      <mesh material={mats.ground} position={[0, FLOOR_Y - 0.6, 0]}>
        <boxGeometry args={[34, 1.2, 4]} />
      </mesh>

      {/* Pipe pool */}
      {Array.from({ length: POOL }).map((_, i) => (
        <group key={i} ref={el => (pipeRefs.current[i] = el)} visible={false}>
          <mesh geometry={geos.pipe} material={mats.pipe[0]} />
          <mesh geometry={geos.cap}  material={mats.cap} />
          <mesh geometry={geos.pipe} material={mats.pipe[0]} />
          <mesh geometry={geos.cap}  material={mats.cap} />
        </group>
      ))}

      {/* Bird */}
      <group ref={birdRef} position={[BIRD_X, 0.5, 0]}>
        <mesh geometry={geos.bird} material={mats.body} />
        <mesh geometry={geos.bird} material={mats.belly} position={[0, -0.12, 0.16]} scale={0.6} />
        <group ref={wingRef} position={[-0.05, 0.05, -0.18]}>
          <mesh geometry={geos.wing} material={mats.wing} position={[0, 0, -0.15]} />
        </group>
        <mesh geometry={geos.beak} material={mats.beak} position={[0.42, -0.02, 0]} rotation={[0, 0, -Math.PI / 2]} />
        <mesh geometry={geos.eye} material={mats.eyeW} position={[0.18, 0.16, 0.3]} />
        <mesh geometry={geos.eye} material={mats.eyeP} position={[0.22, 0.16, 0.36]} scale={0.6} />
      </group>
    </group>
  )
}

export default function FlappyGame({ paused, onResult }) {
  const pausedRef = useRef(false)
  const flapSignal = useRef(0)
  const [score, setScore] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => { pausedRef.current = paused }, [paused])

  const doFlap = () => { if (pausedRef.current) return; flapSignal.current++; setStarted(true) }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); doFlap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <MiniGame3D
      camera={{ position: [-1, 1, 11.5], fov: 55, near: 0.1, far: 200 }}
      background="linear-gradient(180deg, #1e3a8a 0%, #5b21b6 100%)"
      onPointerDown={doFlap}
      hud={
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none font-body">
            <div className="text-white text-[34px] font-black drop-shadow-lg" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>{score}</div>
          </div>
          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none font-body">
              <div className="text-white text-[22px] font-extrabold" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>🐦 Tap / Space to fly</div>
              <div className="text-slate-200 text-[13px] mt-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>Pass through the pipes</div>
            </div>
          )}
        </>
      }
    >
      <FlappyScene pausedRef={pausedRef} onResult={onResult} onScore={setScore} flapSignal={flapSignal} />
    </MiniGame3D>
  )
}
