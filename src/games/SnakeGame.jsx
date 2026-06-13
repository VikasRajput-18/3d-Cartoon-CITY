// Snake 3D — same grid logic & scoring as the original 2D version (19×15 board,
// speed ramps with score, wall/self collision ends the run) rendered on a raised
// 3D platform: cube segments that smoothly follow the head, a bobbing glowing
// food orb, glowing edge walls, an eat burst, and a floating 3D score.
import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { audioSystem } from '@/lib/audioSystem'
import MiniGame3D from './MiniGame3D'

const COLS = 19
const ROWS = 15
// grid (col,row) → world (x,z), board centred on origin
const gx = (col) => col - (COLS - 1) / 2
const gz = (row) => row - (ROWS - 1) / 2

function placeFood(snake) {
  let p
  do { p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 } }
  while (snake.some(s => s.x === p.x && s.y === p.y))
  return p
}

// Cell-aligned grid lines (thin boxes, one shared material).
function GridLines({ material }) {
  const hw = COLS / 2, hd = ROWS / 2
  const lines = []
  for (let k = 0; k <= COLS; k++) lines.push({ pos: [-hw + k, 0, 0], size: [0.03, 0.02, ROWS] })
  for (let k = 0; k <= ROWS; k++) lines.push({ pos: [0, 0, -hd + k], size: [COLS, 0.02, 0.03] })
  return (
    <group position={[0, -0.01, 0]}>
      {lines.map((l, i) => (
        <mesh key={i} position={l.pos} material={material}>
          <boxGeometry args={l.size} />
        </mesh>
      ))}
    </group>
  )
}

function SnakeScene({ pausedRef, onResult, onScore }) {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(0, 0, 0) }, [camera])

  const sim = useRef({
    snake: [{ x: 9, y: 7 }],
    dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: { x: 14, y: 7 },
    score: 0, dead: false, speed: 140, acc: 0,
  })
  const vis  = useRef([{ x: 9, y: 7 }])     // smoothed visual positions (fractional grid coords)
  const [segCount, setSegCount] = useState(1)
  const headRef = useRef()
  const bodyRefs = useRef([])
  const foodRef = useRef()
  const burst = useRef({ t: 1, x: 0, y: 0 })
  const burstRef = useRef()
  const resultSent = useRef(false)

  const mats = useMemo(() => ({
    head: new THREE.MeshToonMaterial({ color: '#c4b5fd' }),
    body: new THREE.MeshToonMaterial({ color: '#7c3aed' }),
    food: new THREE.MeshToonMaterial({ color: '#fb7185', emissive: '#ec4899', emissiveIntensity: 0.7 }),
    eyeW: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    eyeP: new THREE.MeshBasicMaterial({ color: '#0b0b14' }),
    wall: new THREE.MeshToonMaterial({ color: '#5b21b6', emissive: '#7c3aed', emissiveIntensity: 0.5 }),
    grid: new THREE.MeshBasicMaterial({ color: '#4c1d95', transparent: true, opacity: 0.45 }),
    burst: new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0 }),
  }), [])
  const geos = useMemo(() => ({
    seg:  new THREE.BoxGeometry(0.82, 0.82, 0.82),
    head: new THREE.BoxGeometry(0.92, 0.92, 0.92),
    eye:  new THREE.SphereGeometry(0.1, 8, 8),
    food: new THREE.SphereGeometry(0.42, 18, 18),
    burst: new THREE.SphereGeometry(0.5, 16, 16),
  }), [])
  useEffect(() => () => {
    Object.values(mats).forEach(m => m.dispose())
    Object.values(geos).forEach(g => g.dispose())
  }, [mats, geos])

  // Input
  useEffect(() => {
    const DIR = {
      ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
    }
    const onKey = (e) => {
      const d = DIR[e.code]; if (!d) return
      const s = sim.current
      if (d.x === -s.dir.x && d.y === -s.dir.y) return
      s.nextDir = d; e.preventDefault()
    }
    let tx = 0, ty = 0
    const onTS = (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    const onTE = (e) => {
      const s = sim.current
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      const d = Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 }
      if (!(d.x === -s.dir.x && d.y === -s.dir.y)) s.nextDir = d
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTS, { passive: true })
    window.addEventListener('touchend', onTE)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTS)
      window.removeEventListener('touchend', onTE)
    }
  }, [])

  function step() {
    const s = sim.current
    s.dir = { ...s.nextDir }
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y }
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        s.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      s.dead = true
      audioSystem.playError?.()
      if (!resultSent.current) { resultSent.current = true; onResult?.(s.score) }
      return
    }
    s.snake.unshift(head)
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score++
      onScore(s.score)
      audioSystem.playCoinsEarned?.()
      burst.current = { t: 0, x: s.food.x, y: s.food.y }
      s.food = placeFood(s.snake)
      s.speed = Math.max(55, 140 - s.score * 6)
      vis.current.push({ ...vis.current[vis.current.length - 1] })
      setSegCount(s.snake.length)
    } else {
      s.snake.pop()
    }
  }

  useFrame((state, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 0.05)

    // Eat burst animation always runs (independent of pause)
    if (burst.current.t < 1) {
      burst.current.t = Math.min(1, burst.current.t + dt * 3)
      const b = burst.current, k = b.t
      if (burstRef.current) {
        const sc = 0.4 + k * 2.4
        burstRef.current.position.set(gx(b.x), 0.5, gz(b.y))
        burstRef.current.scale.setScalar(sc)
        mats.burst.opacity = (1 - k) * 0.8
      }
    } else if (burstRef.current) {
      mats.burst.opacity = 0
    }

    if (pausedRef.current || s.dead) return

    s.acc += dt * 1000
    let guard = 0
    while (s.acc >= s.speed && !s.dead && guard++ < 4) { s.acc -= s.speed; step() }

    // Smooth-follow: each visual segment eases toward its logical cell
    const a = Math.min(1, dt * 13)
    for (let i = 0; i < vis.current.length; i++) {
      const tgt = s.snake[i] || s.snake[s.snake.length - 1]
      vis.current[i].x += (tgt.x - vis.current[i].x) * a
      vis.current[i].y += (tgt.y - vis.current[i].y) * a
    }
    if (headRef.current && vis.current[0]) {
      headRef.current.position.set(gx(vis.current[0].x), 0.3, gz(vis.current[0].y))
      const targetYaw = Math.atan2(s.dir.x, s.dir.y)
      let cur = headRef.current.rotation.y
      let diff = targetYaw - cur
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      headRef.current.rotation.y = cur + diff * Math.min(1, dt * 12)
    }
    for (let i = 1; i < vis.current.length; i++) {
      const m = bodyRefs.current[i - 1]
      if (m && vis.current[i]) m.position.set(gx(vis.current[i].x), 0.3, gz(vis.current[i].y))
    }
    if (foodRef.current) {
      foodRef.current.position.set(gx(s.food.x), 0.55 + Math.sin(state.clock.elapsedTime * 3) * 0.14, gz(s.food.y))
      foodRef.current.rotation.y += dt * 1.6
    }
  })

  const bw = COLS, bd = ROWS
  return (
    <group>
      {/* Platform */}
      <mesh position={[0, -0.35, 0]} receiveShadow>
        <boxGeometry args={[bw + 1.4, 0.6, bd + 1.4]} />
        <meshToonMaterial color="#1b1640" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[bw, bd]} />
        <meshToonMaterial color="#241a52" />
      </mesh>
      {/* Grid lines */}
      <GridLines material={mats.grid} />

      {/* Glowing edge walls */}
      {[
        { p: [0, 0.15, -bd / 2 - 0.35], s: [bw + 1.4, 0.5, 0.3] },
        { p: [0, 0.15,  bd / 2 + 0.35], s: [bw + 1.4, 0.5, 0.3] },
        { p: [-bw / 2 - 0.35, 0.15, 0], s: [0.3, 0.5, bd + 1.4] },
        { p: [ bw / 2 + 0.35, 0.15, 0], s: [0.3, 0.5, bd + 1.4] },
      ].map((w, i) => (
        <mesh key={i} position={w.p} geometry={undefined} material={mats.wall}>
          <boxGeometry args={w.s} />
        </mesh>
      ))}

      {/* Food */}
      <mesh ref={foodRef} geometry={geos.food} material={mats.food} position={[gx(14), 0.55, gz(7)]} />

      {/* Snake head with eyes */}
      <group ref={headRef} position={[gx(9), 0.3, gz(7)]}>
        <mesh geometry={geos.head} material={mats.head} />
        <mesh geometry={geos.eye} material={mats.eyeW} position={[-0.22, 0.2, 0.42]} />
        <mesh geometry={geos.eye} material={mats.eyeW} position={[0.22, 0.2, 0.42]} />
        <mesh geometry={geos.eye} material={mats.eyeP} position={[-0.22, 0.2, 0.5]} scale={0.6} />
        <mesh geometry={geos.eye} material={mats.eyeP} position={[0.22, 0.2, 0.5]} scale={0.6} />
      </group>

      {/* Snake body */}
      {Array.from({ length: Math.max(0, segCount - 1) }).map((_, i) => (
        <mesh key={i} ref={el => (bodyRefs.current[i] = el)} geometry={geos.seg} material={mats.body} position={[gx(9), 0.3, gz(7)]} />
      ))}

      {/* Eat burst */}
      <mesh ref={burstRef} geometry={geos.burst} material={mats.burst} />

      {/* Floating score */}
      <Text position={[0, 3.6, -bd / 2 - 0.5]} fontSize={1.5} color="#fde68a" anchorX="center" anchorY="middle"
        outlineWidth={0.07} outlineColor="#1a1340">
        🐍 {sim.current.score}
      </Text>
    </group>
  )
}

export default function SnakeGame({ paused, onResult }) {
  const pausedRef = useRef(false)
  const [score, setScore] = useState(0)
  useEffect(() => { pausedRef.current = paused }, [paused])

  return (
    <MiniGame3D
      camera={{ position: [0, 16.5, 11], fov: 56, near: 0.1, far: 200 }}
      background="radial-gradient(circle at 50% 30%, #2a1d5e 0%, #08060f 72%)"
      hud={
        <div className="absolute top-3 left-4 pointer-events-none font-body">
          <div className="text-violet-300 text-[15px] font-extrabold drop-shadow">🐍 Score {score}</div>
          <div className="text-slate-400 text-[11px] mt-[2px]">WASD / Arrows / Swipe</div>
        </div>
      }
    >
      <SnakeScene pausedRef={pausedRef} onResult={onResult} onScore={setScore} />
    </MiniGame3D>
  )
}
