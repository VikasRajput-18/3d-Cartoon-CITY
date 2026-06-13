// Cricket 3D — a full batting + running-between-wickets experience.
// Keeps the original contract: onResult(totalRuns) once at the end, fires
// 'achievement' window events and the cricket-century localStorage milestone.
// Everything else (gameplay + rendering) is now a real 3D scene.
//
// Pitch runs along Z. Batsman/striker end is at +Z (near the camera); the ball is
// bowled from the bowler end at -Z toward the player. X is left/right.
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioSystem } from '@/lib/audioSystem'
import { useStore } from '@/store'
import MiniGame3D from './MiniGame3D'

// ── Field / pitch geometry ────────────────────────────────────────────────────
// Large proper cricket oval — the boundary is far from the pitch so fours/sixes
// feel earned. The pitch strip stays the same size.
const FIELD_RX = 30, FIELD_RZ = 36       // boundary ellipse radii
const STUMP_Z  = 9.4                     // |z| of each set of stumps
const BAT_Z    = 8.7                     // batsman stance z
const CONTACT_Z = 8.0                    // ideal contact point (ball.z)
const BAT_REACH = 1.7                    // crease half-width — batsman can't move past this
const BALL_R   = 0.17
const WICKETS_MAX = 3
const BALLS_TOTAL = 18                   // 3 overs (6 balls each)
const OVERS_TOTAL = BALLS_TOTAL / 6

// Controlled batsman movement — slow with smooth acceleration/deceleration
const BAT_ACCEL   = 7                     // units/s² ramp-up
const BAT_MAX_SPD = 2.4                   // units/s top speed (was ~6 effective)
const BAT_FRICTION = 9                    // units/s² ramp-down when no input

const ROLL_DECEL  = 6                     // ground roll deceleration (units/s²)
const RUN_SPEED   = 12                    // batsman units/s between ends
const FIELDER_SPEED = 13                  // bigger ground → fielders cover more
const THROW_SPEED = 34
const RUN_DECISION_T = 1.6                // seconds the RUN prompt stays before a dot ball

const LINES = [-1.1, 0, 1.1]            // bowling line x-offsets

// Eight fielders around the ground (not too near the batsman)
const FIELDERS = (() => {
  const out = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.35
    out.push([Math.sin(a) * FIELD_RX * 0.66, 0, Math.cos(a) * FIELD_RZ * 0.66])
  }
  return out
})()

const endZ = (sign) => sign * BAT_Z      // +1 striker end, -1 bowler end

// ── Stumps (3 poles + 2 bails) with a shatter animation on `out` ──────────────
function Stumps({ position, out, mat, bailMat }) {
  const bail1 = useRef(), bail2 = useRef()
  const poles = useRef([])
  const v = useRef(null)
  useFrame((_, delta) => {
    if (!out) return
    const dt = Math.min(delta, 0.05)
    if (!v.current) {
      v.current = [
        { x: (Math.random() - 0.5) * 4, y: 4 + Math.random() * 2, z: -2 - Math.random() * 2, rx: 8, rz: 6 },
        { x: (Math.random() - 0.5) * 4, y: 4 + Math.random() * 2, z: -2 - Math.random() * 2, rx: -7, rz: 5 },
      ]
    }
    ;[bail1, bail2].forEach((b, i) => {
      const m = b.current; if (!m) return
      const vel = v.current[i]
      vel.y -= 22 * dt
      m.position.x += vel.x * dt; m.position.y += vel.y * dt; m.position.z += vel.z * dt
      m.rotation.x += vel.rx * dt; m.rotation.z += vel.rz * dt
    })
    poles.current.forEach((p, i) => { if (p) p.rotation.x = THREE.MathUtils.lerp(p.rotation.x, (i - 1) * 0.4 - 0.5, dt * 5) })
  })
  return (
    <group position={position}>
      {[-0.16, 0, 0.16].map((x, i) => (
        <mesh key={i} ref={el => (poles.current[i] = el)} position={[x, 0.45, 0]} material={mat}>
          <cylinderGeometry args={[0.035, 0.035, 0.9, 6]} />
        </mesh>
      ))}
      <mesh ref={bail1} position={[-0.08, 0.92, 0]} material={bailMat}><boxGeometry args={[0.18, 0.04, 0.04]} /></mesh>
      <mesh ref={bail2} position={[0.08, 0.92, 0]} material={bailMat}><boxGeometry args={[0.18, 0.04, 0.04]} /></mesh>
    </group>
  )
}

// ── Particle burst pool (sixes, stump shatter sparkle) ────────────────────────
const Particles = forwardRef(function Particles(_, ref) {
  const N = 26
  const mesh = useRef()
  const parts = useRef(Array.from({ length: N }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 })))
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 1 }), [])
  const geo = useMemo(() => new THREE.SphereGeometry(0.16, 6, 6), [])
  useEffect(() => () => { mat.dispose(); geo.dispose() }, [mat, geo])
  useImperativeHandle(ref, () => ({
    burst(pos, color = '#fde68a') {
      mat.color.set(color)
      parts.current.forEach(p => {
        p.life = 1
        const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7
        p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 4 + Math.random() * 7
        p.x = pos[0]; p.y = pos[1]; p.z = pos[2]
      })
    },
  }), [mat])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const m = mesh.current; if (!m) return
    let any = false
    parts.current.forEach((p, i) => {
      if (p.life > 0) {
        any = true
        p.life -= dt * 1.1
        p.vy -= 20 * dt
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
        dummy.position.set(p.x, Math.max(0, p.y), p.z)
        dummy.scale.setScalar(Math.max(0.01, p.life))
        dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.scale.setScalar(0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
      }
    })
    m.instanceMatrix.needsUpdate = true
    mat.opacity = any ? 0.95 : 0
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
})

// ── Crowd: hundreds of colourful people in tiered rings (one InstancedMesh) ────
const Crowd = forwardRef(function Crowd(_, ref) {
  const RINGS = 6, PER = 90, N = RINGS * PER
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => new THREE.BoxGeometry(0.55, 0.75, 0.55), [])
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffffff' }), [])
  const people = useMemo(() => {
    const palette = ['#ef4444', '#f59e0b', '#fde047', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f8fafc', '#06b6d4', '#fb923c', '#e2e8f0']
    const arr = []
    for (let t = 0; t < RINGS; t++) {
      for (let i = 0; i < PER; i++) {
        const a = (i / PER) * Math.PI * 2 + (t % 2) * (Math.PI / PER)
        const rx = (FIELD_RX + 7) + t * 1.7, rz = (FIELD_RZ + 7) + t * 1.7
        arr.push({ x: Math.sin(a) * rx, z: Math.cos(a) * rz, y: 1.6 + t * 0.9, phase: Math.random() * 6.28, col: palette[(Math.random() * palette.length) | 0] })
      }
    }
    return arr
  }, [])
  const cheerT = useRef(0)
  useImperativeHandle(ref, () => ({ cheer() { cheerT.current = 1.3 } }), [])
  useEffect(() => {
    const m = mesh.current; if (!m) return
    const c = new THREE.Color()
    people.forEach((p, i) => { c.set(p.col); m.setColorAt(i, c) })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [people])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame((state, delta) => {
    const m = mesh.current; if (!m) return
    const t = state.clock.elapsedTime
    if (cheerT.current > 0) cheerT.current -= Math.min(delta, 0.05)
    const cheer = cheerT.current > 0
    const amp = cheer ? 0.5 : 0.07, spd = cheer ? 10 : 1.8, sc = cheer ? 1.18 : 1
    people.forEach((p, i) => {
      const bob = Math.abs(Math.sin(t * spd + p.phase)) * amp
      dummy.position.set(p.x, p.y + bob, p.z)
      dummy.scale.setScalar(sc)
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
})

const CricketScene = forwardRef(function CricketScene({ pausedRef, onResult, hud, onStart, skinColor }, apiRef) {
  const { camera } = useThree()
  const partsRef = useRef()
  const crowdRef = useRef()

  const sim = useRef({
    phase: 'ready',        // ready|bowling|flying|running|between|over
    runs: 0, wickets: 0, ballNum: 0,
    ball: { x: 0, y: 1.6, z: -STUMP_Z, vx: 0, vy: 0, vz: 0, bounced: false, live: false },
    batX: 0, batVel: 0, moveBtn: 0,
    swingT: -1,            // bat swing animation timer
    betweenT: 0,
    bannerT: 0,
    // running
    run: { active: false, from: 1, to: -1, progress: 0 },
    targetRuns: 0, lengthsDone: 0, batsmanZ: BAT_Z, batsmanX: 0.7, safe: true,
    fielder: { idx: 0, state: 'idle', dist0: 1 }, // idle|toBall|hasBall|throwing
    throwTargetZ: 0,
    outAtEnd: 0,           // which end's stumps shatter (0 none, +1/-1)
    consecMiss: 0, consec6: 0, sixes: 0, firstBoundary: false,
    keys: {},
  })
  const resultSent = useRef(false)

  // ── mowing-stripe grass texture (alternating greens, like a maintained ground) ──
  const grassTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256
    const g = c.getContext('2d')
    const stripes = 12
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 === 0 ? '#4a9c3f' : '#56ab4a'
      g.fillRect(0, Math.floor((i / stripes) * 256), 64, Math.ceil(256 / stripes) + 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 9)   // tile the stripes across the big outfield
    return t
  }, [])
  useEffect(() => () => grassTex.dispose(), [grassTex])

  // ── shared materials / geometry ──
  const mats = useMemo(() => ({
    grass: new THREE.MeshToonMaterial({ color: '#ffffff', map: grassTex }),
    grass2: new THREE.MeshToonMaterial({ color: '#3f8a37' }),
    pitch: new THREE.MeshToonMaterial({ color: '#cbb27e' }),
    crease: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    stump: new THREE.MeshToonMaterial({ color: '#f5f0dc' }),
    stumpOut: new THREE.MeshToonMaterial({ color: '#ef4444' }),
    bail: new THREE.MeshToonMaterial({ color: '#e7c873' }),
    ball: new THREE.MeshToonMaterial({ color: '#c0271f', emissive: '#7f1d1d', emissiveIntensity: 0.3 }),
    skin: new THREE.MeshToonMaterial({ color: skinColor }),
    body: new THREE.MeshToonMaterial({ color: '#1e3a8a' }),
    bat: new THREE.MeshToonMaterial({ color: '#caa472' }),
    fielder: new THREE.MeshToonMaterial({ color: '#dc2626' }),
    fhead: new THREE.MeshToonMaterial({ color: '#f1c5a0' }),
    rope: new THREE.MeshBasicMaterial({ color: '#f8fafc' }),
    stand: new THREE.MeshToonMaterial({ color: '#3b2f63', side: THREE.DoubleSide }),
    standTop: new THREE.MeshToonMaterial({ color: '#241d44', side: THREE.DoubleSide }),
  }), [skinColor, grassTex])
  const geos = useMemo(() => ({
    ball: new THREE.SphereGeometry(BALL_R, 16, 16),
    fbody: new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8),
    fhead: new THREE.SphereGeometry(0.26, 10, 10),
  }), [])
  useEffect(() => () => {
    Object.values(mats).forEach(m => m.dispose())
    Object.values(geos).forEach(g => g.dispose())
  }, [mats, geos])

  const ballRef = useRef()
  const batsmanRef = useRef()   // the running/striking batsman group
  const batRef = useRef()       // the bat (child) for swing animation
  const fielderRefs = useRef([])
  const [outEnds, setOutEnds] = useState({ p: false, n: false }) // stumps shatter flags

  // ── HUD writers (direct DOM, no React churn) ──
  function writeHud() {
    const s = sim.current
    const b = Math.min(s.ballNum, BALLS_TOTAL)
    const over = Math.floor(b / 6), ball = b % 6
    if (hud.score?.current) hud.score.current.textContent = `${s.runs}/${s.wickets}`
    if (hud.overs?.current) hud.overs.current.textContent = `${over}.${ball} / ${OVERS_TOTAL}.0`
    // Controls hint fades once the player has had half an over to learn
    if (hud.controls?.current) hud.controls.current.style.opacity = s.ballNum >= 3 ? '0' : '0.92'
  }
  function banner(text, color = '#ffffff') {
    const s = sim.current; s.bannerT = 1.4
    if (hud.banner?.current) { hud.banner.current.textContent = text; hud.banner.current.style.color = color }
  }
  function showRunPrompt(on) { if (hud.prompt?.current) hud.prompt.current.style.display = on ? 'flex' : 'none' }

  function achv(text) { window.dispatchEvent(new CustomEvent('achievement', { detail: { text } })) }
  function bumpCentury(runs) {
    try {
      const total = (parseInt(localStorage.getItem('cricket_total_runs') || '0', 10) || 0) + runs
      localStorage.setItem('cricket_total_runs', String(total))
      if (total >= 100 && localStorage.getItem('cricket_century') !== 'true') {
        localStorage.setItem('cricket_century', 'true'); achv('💯 Cricket Century — 100 total runs!')
      }
    } catch {}
  }

  function finish() { if (resultSent.current) return; resultSent.current = true; onResult?.(sim.current.runs) }

  function loseWicket(reason, endSign) {
    const s = sim.current
    s.wickets++
    s.outAtEnd = endSign
    setOutEnds(endSign > 0 ? { p: true, n: false } : { p: false, n: true })
    banner(reason, '#ef4444')
    audioSystem.playError?.()
    showRunPrompt(false)
    s.ball.live = false; s.run.active = false
    writeHud()
    if (s.wickets >= WICKETS_MAX) { s.phase = 'between'; s.betweenT = 2.0; s.ending = true }
    else { s.phase = 'between'; s.betweenT = 1.8 }
  }

  function nextBall() {
    const s = sim.current
    if (s.ending) { s.phase = 'over'; finish(); return }
    s.ballNum++
    if (s.ballNum > BALLS_TOTAL) { s.phase = 'over'; finish(); return }
    // reset batsman to striker end
    s.batsmanZ = BAT_Z; s.batsmanX = 0.7; s.run = { active: false, from: 1, to: -1, progress: 0 }; s.safe = true
    s.targetRuns = 0; s.lengthsDone = 0; s.outAtEnd = 0; s.dangerVal = 0
    setOutEnds({ p: false, n: false })
    s.fielder = { idx: -1, state: 'idle', x: null, z: null }
    const speed = 13 + s.ballNum * 0.45
    let vz = speed
    const r = Math.random()
    if (r < 0.18) vz = speed * 0.7        // slower ball
    else if (r < 0.34) vz = speed * 1.35  // quick ball
    s.ball = {
      x: LINES[(Math.random() * LINES.length) | 0] * (0.5 + Math.random() * 0.6),
      y: 1.7, z: -STUMP_Z, vx: 0, vy: -1.5, vz, bounced: false, live: true,
    }
    s.swingT = -1
    s.phase = 'bowling'
    writeHud()
  }

  // ── imperative API for on-screen buttons + parent ──
  useImperativeHandle(apiRef, () => ({
    swing: doSwing,
    run: doRun,
    move: (dir) => { sim.current.moveBtn = dir === 'L' ? -1 : dir === 'R' ? 1 : 0 },
    moveStop: () => { sim.current.moveBtn = 0 },
  }))

  function doSwing() {
    const s = sim.current
    if (s.phase === 'ready') { onStart?.(); nextBall(); return }
    if (s.phase !== 'bowling' || s.swingT >= 0 || !s.ball.live) return
    s.swingT = 0  // start swing animation
    const ball = s.ball
    const zDiff = ball.z - CONTACT_Z              // <0 early, >0 late
    const xDiff = Math.abs(ball.x - s.batX)
    // Must be reachable in space and time
    if (ball.z < 5.0 || ball.z > 9.2 || xDiff > BAT_REACH) {
      // whiff — ball plays on; bowled handled when it passes the stumps
      return
    }
    const at = Math.abs(zDiff)
    let speed, vy, ang
    if (at <= 0.7)      { speed = 32; vy = 15; ang = (Math.random() - 0.5) * 0.3 }            // perfect → clears the rope (six)
    else if (at <= 1.5) { speed = 24; vy = 6 + Math.random() * 4; ang = (zDiff < 0 ? -1 : 1) * (0.5 + Math.random() * 0.3) } // good leg/off → four
    else if (at <= 2.6) { speed = 15; vy = 4 + Math.random() * 3; ang = (zDiff < 0 ? -1 : 1) * (0.7 + Math.random() * 0.4) } // decent push → run it
    else { // mistimed dribble
      speed = 7 + Math.random() * 4; vy = 3 + Math.random() * 3; ang = (Math.random() - 0.5) * 1.6
    }
    // launch the hit — the run window opens IMMEDIATELY and the fielder starts
    // chasing the live ball; running and fielding now race concurrently.
    ball.vx = Math.sin(ang) * speed
    ball.vz = -Math.cos(ang) * speed
    ball.vy = vy
    ball.bounced = false
    s.phase = 'live'
    s.consecMiss = 0
    s.runsAtBall = s.runs
    s.run = { active: false, from: 1, to: -1, progress: 0 }
    s.targetRuns = 0; s.lengthsDone = 0; s.safe = true
    s.fielder = { idx: -1, state: 'chase', x: null, z: null, dist0: 1 }
    s.dangerVal = 0
    showRunPrompt(true)
    banner('RUN?', '#fde68a')
    audioSystem.playSuccess?.()
  }

  function doRun() {
    const s = sim.current
    if (s.phase !== 'live') return   // window is open the instant the ball is hit
    if (!s.run.active) {
      s.run.active = true; s.run.from = 1; s.run.to = -1; s.run.progress = 0
      s.targetRuns = 1; s.safe = false
      showRunPrompt(false)
    } else {
      s.targetRuns++   // greedy: attempt another length
    }
  }

  // keyboard
  useEffect(() => {
    const down = (e) => {
      const s = sim.current
      s.keys[e.code] = true
      if (e.code === 'Space') { e.preventDefault(); doSwing() }
      else if (e.code === 'KeyR') { e.preventDefault(); doRun() }
    }
    const up = (e) => { sim.current.keys[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // camera lerp helper
  const camTarget = useRef(new THREE.Vector3(0, 4.2, 14.5))
  const camLook = useRef(new THREE.Vector3(0, 1.2, 0))
  const tmpLook = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 0.05)

    // banner fade
    if (s.bannerT > 0) { s.bannerT -= dt; if (hud.banner?.current) hud.banner.current.style.opacity = Math.min(1, s.bannerT * 2) }

    if (!pausedRef.current && s.phase !== 'ready' && s.phase !== 'over') {
      // batsman lateral movement — controlled velocity with smooth accel/decel
      if (s.phase === 'bowling') {
        const left  = s.keys['KeyA'] || s.keys['ArrowLeft']  || s.moveBtn < 0
        const right = s.keys['KeyD'] || s.keys['ArrowRight'] || s.moveBtn > 0
        let v = s.batVel || 0
        if (left && !right)      v -= BAT_ACCEL * dt
        else if (right && !left) v += BAT_ACCEL * dt
        else if (v > 0)          v = Math.max(0, v - BAT_FRICTION * dt)
        else                     v = Math.min(0, v + BAT_FRICTION * dt)
        v = THREE.MathUtils.clamp(v, -BAT_MAX_SPD, BAT_MAX_SPD)
        s.batX += v * dt
        if (s.batX <= -BAT_REACH) { s.batX = -BAT_REACH; v = 0 }
        if (s.batX >=  BAT_REACH) { s.batX =  BAT_REACH; v = 0 }
        s.batVel = v
        s.batsmanX = s.batX
        s.batsmanZ = BAT_Z
      }

      // swing animation
      if (s.swingT >= 0) { s.swingT += dt; if (s.swingT > 0.35) s.swingT = -1 }

      // between-balls delay
      if (s.phase === 'between') {
        s.betweenT -= dt
        if (s.betweenT <= 0) nextBall()
      }

      // ── bowling: ball travels with bounce ──
      if (s.phase === 'bowling' && s.ball.live) {
        const b = s.ball
        b.vy -= 20 * dt
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt
        if (b.y <= BALL_R && b.vy < 0 && !b.bounced) { b.y = BALL_R; b.vy = -b.vy * 0.62; b.bounced = true }
        if (b.y < BALL_R) b.y = BALL_R
        // passed the batsman without contact?
        if (b.z > BAT_Z + 0.4) {
          const bowled = Math.abs(b.x) < 0.3 && b.y < 0.95
          b.live = false
          if (bowled) { loseWicket('BOWLED! 🎯', 1) }
          else {
            s.consecMiss++
            banner('Missed!', '#f87171')
            s.phase = 'between'; s.betweenT = 0.9
          }
        }
      }

      // ── live: ball in play — ball physics, running, and fielding all run
      // CONCURRENTLY. The run window is open from the instant of the hit. ──
      if (s.phase === 'live') {
        const b = s.ball, f = s.fielder

        if (f.state === 'chase') {
          // free ball flight + ground roll
          b.vy -= 20 * dt
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt
          if (b.y <= BALL_R) {
            b.y = BALL_R; b.vy = 0
            const sp = Math.hypot(b.vx, b.vz)
            if (sp > 0) { const nsp = Math.max(0, sp - ROLL_DECEL * dt); b.vx *= nsp / sp; b.vz *= nsp / sp }
          }
          const ellipse = (b.x / FIELD_RX) ** 2 + (b.z / FIELD_RZ) ** 2
          let caught = false
          if (b.y > 0.6 && b.y < 3 && b.vy < 0 && ellipse < 0.95) {
            for (const fp of FIELDERS) {
              if ((fp[0] - b.x) ** 2 + (fp[2] - b.z) ** 2 < 1.3 * 1.3) { caught = true; break }
            }
          }
          if (caught) { b.live = false; s.runs = s.runsAtBall; writeHud(); loseWicket('CAUGHT! 🙌', 1) }
          else if (ellipse >= 1) { if (b.y > 0.5) scoreBoundary(6); else scoreBoundary(4); b.live = false }
          else {
            // fielder chases the ball; picks it up only once it has settled
            if (f.idx < 0) {
              let best = 0, bd = Infinity
              FIELDERS.forEach((fp, i) => { const d = (fp[0] - b.x) ** 2 + (fp[2] - b.z) ** 2; if (d < bd) { bd = d; best = i } })
              f.idx = best; f.x = FIELDERS[best][0]; f.z = FIELDERS[best][2]; f.dist0 = Math.max(1, Math.sqrt(bd))
            }
            const dx = b.x - f.x, dz = b.z - f.z, d = Math.hypot(dx, dz)
            const rested = Math.hypot(b.vx, b.vz) < 1.2 && b.y <= BALL_R + 0.02
            s.dangerVal = Math.max(s.dangerVal, 0.45 * (1 - Math.min(1, d / f.dist0)))
            if (d < 0.6 && rested) {
              f.state = 'hasBall'; f.holdT = 0.16
              s.throwTargetZ = endZ(s.run.active ? s.run.to : 1)
            } else {
              const m = (FIELDER_SPEED * dt) / Math.max(0.0001, d); f.x += dx * m; f.z += dz * m
            }
          }
        } else if (f.state === 'hasBall') {
          b.x = f.x; b.z = f.z; b.y = 0.7; s.dangerVal = 0.5
          f.holdT -= dt
          if (f.holdT <= 0) {
            if (s.run.active || s.targetRuns > 0) {
              f.state = 'throwing'
              s.throwTargetZ = endZ(s.run.active ? s.run.to : 1)
              f.throwLen = Math.max(1, Math.hypot(0 - f.x, s.throwTargetZ - f.z))
              audioSystem.playClick?.()
            } else { banner('No run', '#94a3b8'); endBall() }   // batsman never ran → dot ball
          }
        } else if (f.state === 'throwing') {
          const dx = 0 - b.x, dz = s.throwTargetZ - b.z, d = Math.hypot(dx, dz)
          s.dangerVal = 0.5 + 0.5 * (1 - Math.min(1, d / f.throwLen))
          b.y = 0.6 + Math.sin((1 - d / f.throwLen) * Math.PI) * 1.6
          if (d < 0.5) {
            const vulnerable = s.run.active && s.run.progress > 0.06 && s.run.progress < 0.94
            f.state = 'done'
            if (vulnerable) loseWicket('RUN OUT! 🏃💥', s.run.to)
            else { banner(`${s.lengthsDone} run${s.lengthsDone !== 1 ? 's' : ''}`, '#93c5fd'); endBall() }
          } else { const m = (THROW_SPEED * dt) / d; b.x += dx * m; b.z += dz * m }
        }

        // running between wickets — counts on crease crossing, independent of fielder
        if (s.run.active) {
          s.run.progress += (RUN_SPEED / (2 * BAT_Z)) * dt
          if (s.run.progress >= 1) {
            s.run.progress = 0
            s.lengthsDone++; s.runs++; audioSystem.playChime?.(); writeHud(); bumpCentury(1)
            const sw = s.run.from; s.run.from = s.run.to; s.run.to = sw
            if (s.lengthsDone >= s.targetRuns) { s.run.active = false; s.safe = true }
            milestoneCheck()
          }
          s.batsmanZ = THREE.MathUtils.lerp(endZ(s.run.from), endZ(s.run.to), s.run.progress)
        }
      }
    }

    // ── apply transforms ──
    if (ballRef.current) ballRef.current.position.set(s.ball.x, s.ball.y, s.ball.z)
    if (batsmanRef.current) {
      batsmanRef.current.position.set(s.batsmanX, 0, s.batsmanZ)
      // face down the pitch normally; face running direction while running
      if (s.run.active) batsmanRef.current.rotation.y = s.run.to < 0 ? Math.PI : 0
      else batsmanRef.current.rotation.y = Math.PI
      // running bob
      if (s.run.active) batsmanRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.12
      else batsmanRef.current.position.y = 0
    }
    if (batRef.current) {
      const sw = s.swingT
      batRef.current.rotation.x = sw >= 0 ? -2.2 + (sw / 0.35) * 3.0 : -0.4
    }
    // active fielder position (the chaser/thrower); the rest stay at their spots
    const fActive = s.fielder.idx
    const fMoving = s.fielder.state === 'chase' || s.fielder.state === 'hasBall' || s.fielder.state === 'throwing'
    fielderRefs.current.forEach((fr, i) => {
      if (!fr) return
      if (i === fActive && fMoving && s.fielder.x != null) fr.position.set(s.fielder.x, 0, s.fielder.z)
      else fr.position.set(FIELDERS[i][0], 0, FIELDERS[i][2])
    })

    // ── meter (run vs throw danger) ──
    if (hud.runFill?.current) hud.runFill.current.style.width = `${Math.round((s.run.active ? s.run.progress : (s.safe ? 1 : 0)) * 100)}%`
    if (hud.throwFill?.current) hud.throwFill.current.style.width = `${Math.round((s.dangerVal || 0) * 100)}%`
    if (hud.meter?.current) hud.meter.current.style.display = s.phase === 'live' && s.run.active ? 'block' : 'none'

    // ── camera per phase ──
    const ct = camTarget.current, cl = camLook.current
    if (s.phase === 'live' && s.run.active) {
      ct.set(15, 11, 2); cl.set(0, 2, 0)                                   // side view while running
    } else if (s.phase === 'live') {
      ct.set(s.ball.x * 0.4, 6 + s.ball.y * 0.3, s.ball.z + 11)            // follow the struck ball
      cl.set(s.ball.x, s.ball.y, s.ball.z)
    } else {
      ct.set(0, 4.4, 15); cl.set(0, 1.4, -2)                              // behind the batsman
    }
    camera.position.lerp(ct, Math.min(1, dt * 3))
    tmpLook.current.lerp(cl, Math.min(1, dt * 3))
    camera.lookAt(tmpLook.current)
  })

  function milestoneCheck() {
    const s = sim.current
    if (s.runs === 50) banner('HALF CENTURY! 🎉', '#fde68a')
    if (s.runs === 100) banner('CENTURY! 💯', '#facc15')
  }

  function scoreBoundary(n) {
    const s = sim.current
    // boundary supersedes any runs taken this ball
    s.runs = s.runsAtBall + n; s.consecMiss = 0; writeHud(); bumpCentury(n)
    crowdRef.current?.cheer()
    if (n === 6) {
      s.sixes++; s.consec6++
      partsRef.current?.burst([s.ball.x, 2.5, s.ball.z], '#fde68a')
      banner('SIX! 🎆', '#facc15')
      if (s.sixes === 3) achv('💥 Six Machine — 3 sixes!')
      if (s.consec6 === 3) achv('🎩 Cricket Hat Trick — 6s on 3 balls!')
    } else {
      s.consec6 = 0
      banner('FOUR! 🏏', '#4ade80')
      if (!s.firstBoundary) { s.firstBoundary = true; achv('🏏 First Boundary!') }
    }
    audioSystem.playCoinsEarned?.()
    milestoneCheck()
    endBall(n)
  }

  function endBall() {
    const s = sim.current
    showRunPrompt(false)
    s.run.active = false; s.fielder.state = 'idle'; s.dangerVal = 0
    if (s.wickets >= WICKETS_MAX || s.ballNum >= BALLS_TOTAL) {
      if (s.ballNum >= BALLS_TOTAL) { s.ending = true }
    }
    s.phase = 'between'; s.betweenT = 1.0
  }

  // initial camera
  useEffect(() => { camera.position.set(0, 4.4, 15); tmpLook.current.set(0, 1.4, -2); camera.lookAt(tmpLook.current) }, [camera])

  // ── render ──
  // circleGeometry lies in its local XY plane → scale [x, y(→world z), 1].
  // Big enough to fill the view to the horizon (no dark void).
  const GRASS_R = 175
  return (
    <group>
      {/* Field — large green outfield with mowing stripes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} scale={[GRASS_R, GRASS_R, 1]} material={mats.grass}>
        <circleGeometry args={[1, 64]} />
      </mesh>
      {/* Pitch strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={mats.pitch}>
        <planeGeometry args={[2.6, STUMP_Z * 2 + 1]} />
      </mesh>
      {/* Crease lines */}
      {[BAT_Z - 0.6, -BAT_Z + 0.6].map((z, i) => (
        <mesh key={i} position={[0, 0.02, z]} material={mats.crease}><boxGeometry args={[2.4, 0.02, 0.05]} /></mesh>
      ))}
      {/* Boundary rope (ring is in local XY → scale [x, z, 1]) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} scale={[FIELD_RX, FIELD_RZ, 1]} material={mats.rope}>
        <ringGeometry args={[0.985, 1.0, 96]} />
      </mesh>
      {/* Stands ring behind the crowd (cylinder axis is Y → scale [x,1,z]) */}
      <mesh position={[0, 1.6, 0]} scale={[FIELD_RX + 6, 1, FIELD_RZ + 6]} material={mats.stand}>
        <cylinderGeometry args={[1, 1, 3.2, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 3.3, 0]} scale={[FIELD_RX + 6.5, 1, FIELD_RZ + 6.5]} material={mats.standTop}>
        <cylinderGeometry args={[1, 1, 0.6, 48, 1, true]} />
      </mesh>

      {/* Crowd */}
      <Crowd ref={crowdRef} />

      {/* Stumps both ends */}
      <Stumps position={[0, 0, BAT_Z + 0.55]} out={outEnds.p} mat={outEnds.p ? mats.stumpOut : mats.stump} bailMat={mats.bail} />
      <Stumps position={[0, 0, -BAT_Z - 0.55]} out={outEnds.n} mat={outEnds.n ? mats.stumpOut : mats.stump} bailMat={mats.bail} />

      {/* Ball */}
      <mesh ref={ballRef} geometry={geos.ball} material={mats.ball} position={[0, 1.6, -STUMP_Z]} />

      {/* Batsman + bat */}
      <group ref={batsmanRef} position={[0.7, 0, BAT_Z]}>
        <mesh position={[0, 0.55, 0]} material={mats.body}><cylinderGeometry args={[0.26, 0.32, 0.95, 8]} /></mesh>
        <mesh position={[0, 1.2, 0]} geometry={geos.fhead} material={mats.skin} />
        {/* helmet hint */}
        <mesh position={[0, 1.32, 0]} material={mats.body}><sphereGeometry args={[0.28, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        {/* bat pivots from hands */}
        <group ref={batRef} position={[0.26, 0.7, 0.18]} rotation={[-0.4, 0, 0]}>
          <mesh position={[0, -0.5, 0]} material={mats.bat}><boxGeometry args={[0.16, 0.95, 0.07]} /></mesh>
          <mesh position={[0, 0.08, 0]} material={mats.bat}><cylinderGeometry args={[0.04, 0.04, 0.4, 6]} /></mesh>
        </group>
      </group>

      {/* Fielders */}
      {FIELDERS.map((f, i) => (
        <group key={i} ref={el => (fielderRefs.current[i] = el)} position={f}>
          <mesh position={[0, 0.45, 0]} geometry={geos.fbody} material={mats.fielder} />
          <mesh position={[0, 1.05, 0]} geometry={geos.fhead} material={mats.fhead} />
        </group>
      ))}

      <Particles ref={partsRef} />
    </group>
  )
})

export default function CricketGame({ paused, onResult }) {
  const pausedRef = useRef(false)
  const avatar = useStore(s => s.avatar)
  const skinColor = avatar?.color || '#60a5fa'
  const [started, setStarted] = useState(false)
  useEffect(() => { pausedRef.current = paused }, [paused])

  const apiRef = useRef()
  const hud = {
    score: useRef(), overs: useRef(), banner: useRef(), prompt: useRef(),
    meter: useRef(), runFill: useRef(), throwFill: useRef(), controls: useRef(),
  }

  const swing = () => apiRef.current?.swing()
  const run   = () => apiRef.current?.run()

  return (
    <MiniGame3D
      camera={{ position: [0, 4.4, 15], fov: 55, near: 0.1, far: 300 }}
      background="linear-gradient(180deg,#1e293b 0%,#0b1220 100%)"
      onPointerDown={() => { if (!started) setStarted(true); swing() }}
      hud={
        <div className="absolute inset-0 pointer-events-none font-body">
          {/* Broadcast-style scoreboard */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl overflow-hidden"
            style={{ background: 'rgba(8,12,28,0.88)', border: '1px solid rgba(148,163,184,0.28)', minWidth: 180 }}>
            <div className="flex items-center justify-between gap-4 px-4 py-[5px]" style={{ borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
              <span className="text-slate-400 text-[10px] font-extrabold tracking-[1.5px]">SCORE</span>
              <span ref={hud.score} className="text-white text-[22px] font-black tabular-nums leading-none">0/0</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-[5px]">
              <span className="text-slate-400 text-[10px] font-extrabold tracking-[1.5px]">OVERS</span>
              <span ref={hud.overs} className="text-amber-300 text-[15px] font-black tabular-nums leading-none">0.0 / {OVERS_TOTAL}.0</span>
            </div>
          </div>

          {/* Controls hint (top centre, fades after the first few balls) */}
          <div ref={hud.controls} className="absolute top-[88px] left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg px-3 py-[5px] whitespace-nowrap"
            style={{ background: 'rgba(8,12,28,0.6)', border: '1px solid rgba(148,163,184,0.18)', opacity: 0.92, transition: 'opacity 0.8s' }}>
            <span className="text-slate-300 text-[11px] font-semibold hidden md:inline"><b className="text-white">A/D</b> Move</span>
            <span className="text-slate-300 text-[11px] font-semibold hidden md:inline"><b className="text-white">SPACE</b> Hit</span>
            <span className="text-slate-300 text-[11px] font-semibold hidden md:inline"><b className="text-white">R</b> Run</span>
            <span className="text-slate-300 text-[11px] font-semibold md:hidden"><b className="text-white">◀▶</b> Move · <b className="text-white">🏏</b> Hit · <b className="text-white">RUN</b> Run</span>
          </div>

          {/* Big banner (FOUR/SIX/OUT/milestones) */}
          <div ref={hud.banner} className="absolute top-[34%] left-1/2 -translate-x-1/2 text-[40px] font-black text-center"
            style={{ color: '#fff', opacity: 0, textShadow: '0 3px 18px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }} />

          {/* Run prompt */}
          <div ref={hud.prompt} className="absolute bottom-[120px] left-1/2 -translate-x-1/2 flex-col items-center gap-1"
            style={{ display: 'none' }}>
            <div className="text-amber-300 text-[20px] font-black animate-pulse">RUN!</div>
            <div className="text-slate-300 text-[12px]">Press R / tap RUN — risk a 2nd or 3rd</div>
          </div>

          {/* Safety meter (run vs throw) */}
          <div ref={hud.meter} className="absolute bottom-[92px] left-1/2 -translate-x-1/2 w-[230px]" style={{ display: 'none' }}>
            <div className="text-[10px] text-slate-300 mb-[2px] flex justify-between"><span>🏃 You</span><span>Throw 🎯</span></div>
            <div className="h-[7px] rounded-full overflow-hidden mb-[3px]" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div ref={hud.runFill} className="h-full" style={{ width: '0%', background: '#4ade80' }} />
            </div>
            <div className="h-[7px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div ref={hud.throwFill} className="h-full" style={{ width: '0%', background: '#ef4444' }} />
            </div>
          </div>

          {/* Start overlay */}
          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
              <div className="text-white text-[26px] font-black">🏏 Cricket</div>
              <div className="text-slate-200 text-[14px] mt-2">A/D move · Space swing · R to run</div>
              <div className="text-amber-300 text-[14px] mt-1 font-bold">Tap / Space to start</div>
            </div>
          )}

          {/* Mobile controls */}
          <div className="absolute bottom-4 left-3 flex gap-2 pointer-events-auto md:hidden">
            <button onPointerDown={() => apiRef.current?.move('L')} onPointerUp={() => apiRef.current?.moveStop()} onPointerLeave={() => apiRef.current?.moveStop()}
              className="w-[56px] h-[56px] rounded-full text-white text-[22px] font-black border-0" style={{ background: 'rgba(255,255,255,0.14)' }}>◀</button>
            <button onPointerDown={() => apiRef.current?.move('R')} onPointerUp={() => apiRef.current?.moveStop()} onPointerLeave={() => apiRef.current?.moveStop()}
              className="w-[56px] h-[56px] rounded-full text-white text-[22px] font-black border-0" style={{ background: 'rgba(255,255,255,0.14)' }}>▶</button>
          </div>
          <div className="absolute bottom-4 right-3 flex gap-2 pointer-events-auto md:hidden">
            <button onPointerDown={(e) => { e.preventDefault(); run() }}
              className="w-[64px] h-[64px] rounded-full text-white text-[15px] font-black border-0" style={{ background: 'rgba(74,222,128,0.5)' }}>RUN</button>
            <button onPointerDown={(e) => { e.preventDefault(); if (!started) setStarted(true); swing() }}
              className="w-[64px] h-[64px] rounded-full text-white text-[22px] font-black border-0" style={{ background: 'rgba(124,58,237,0.6)' }}>🏏</button>
          </div>
        </div>
      }
    >
      <CricketScene ref={apiRef} pausedRef={pausedRef} onResult={onResult} skinColor={skinColor}
        hud={hud} onStart={() => setStarted(true)} />
    </MiniGame3D>
  )
}
