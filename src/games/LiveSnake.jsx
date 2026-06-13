// Lightweight 2D Snake for the live split-screen arena. One component, three modes:
//   mode='play'   — you control it (WASD/arrows/swipe), broadcasts state via onState
//   mode='ai'     — AI plays it (NPC opponent), reports score via onScore
//   mode='mirror' — read-only render of the opponent's broadcast `state`
// 2D keeps two boards side-by-side comfortably at 60 FPS.
import { useEffect, useRef } from 'react'

const COLS = 15, ROWS = 15, RES = 300
const CELL = RES / COLS
const DIRS = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
}

function randFood(snake) {
  let p
  do { p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 } }
  while (snake.some(s => s.x === p.x && s.y === p.y))
  return p
}

export default function LiveSnake({ mode = 'play', paused, running, state, onState, onScore, color = '#7c3aed', accent = '#a78bfa' }) {
  const canvasRef = useRef()
  const pauseRef = useRef(false)
  const runRef = useRef(false)
  const stateRef = useRef(state)   // for mirror
  useEffect(() => { pauseRef.current = paused }, [paused])
  useEffect(() => { runRef.current = running }, [running])
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const interactive = mode === 'play' || mode === 'ai'

    const sim = {
      snake: [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }],
      dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
      food: { x: 11, y: 7 }, score: 0, speed: 150, acc: 0, deadFlash: 0,
    }
    // smoothed render positions (both for own sim and mirror)
    let vis = sim.snake.map(s => ({ x: s.x, y: s.y }))

    // ── input (play only) ──
    const onKey = (e) => {
      const d = DIRS[e.code]; if (!d) return
      if (d.x === -sim.dir.x && d.y === -sim.dir.y) return
      sim.nextDir = d; e.preventDefault()
    }
    let tx = 0, ty = 0
    const onTS = (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    const onTE = (e) => {
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return
      const d = Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 }
      if (!(d.x === -sim.dir.x && d.y === -sim.dir.y)) sim.nextDir = d
    }
    if (mode === 'play') {
      window.addEventListener('keydown', onKey)
      canvas.addEventListener('touchstart', onTS, { passive: true })
      canvas.addEventListener('touchend', onTE)
    }

    // ── AI: greedy step toward food, avoiding immediate death ──
    function aiChoose() {
      const head = sim.snake[0]
      const opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
        .filter(d => !(d.x === -sim.dir.x && d.y === -sim.dir.y))
      const safe = opts.filter(d => {
        const nx = head.x + d.x, ny = head.y + d.y
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false
        return !sim.snake.slice(0, -1).some(s => s.x === nx && s.y === ny)
      })
      const pool = safe.length ? safe : opts
      // 80% chase food, 20% random for believable imperfection
      if (Math.random() < 0.8) {
        pool.sort((a, b) => {
          const da = Math.abs(head.x + a.x - sim.food.x) + Math.abs(head.y + a.y - sim.food.y)
          const db = Math.abs(head.x + b.x - sim.food.x) + Math.abs(head.y + b.y - sim.food.y)
          return da - db
        })
        sim.nextDir = pool[0]
      } else {
        sim.nextDir = pool[(Math.random() * pool.length) | 0]
      }
    }

    function step() {
      if (mode === 'ai') aiChoose()
      sim.dir = { ...sim.nextDir }
      const head = { x: sim.snake[0].x + sim.dir.x, y: sim.snake[0].y + sim.dir.y }
      const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS
      const hitSelf = sim.snake.some(s => s.x === head.x && s.y === head.y)
      if (hitWall || hitSelf) {
        // respawn (keep score) so the 60s race never dead-stops
        sim.snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]
        sim.dir = { x: 1, y: 0 }; sim.nextDir = { x: 1, y: 0 }
        sim.speed = 150; sim.deadFlash = 0.4
        vis = sim.snake.map(s => ({ x: s.x, y: s.y }))
        return
      }
      sim.snake.unshift(head)
      if (head.x === sim.food.x && head.y === sim.food.y) {
        sim.score++
        sim.food = randFood(sim.snake)
        sim.speed = Math.max(70, 150 - sim.score * 4)
        onScore?.(sim.score)
      } else {
        sim.snake.pop()
        vis.pop()
      }
      vis.unshift({ ...vis[0] })  // keep vis length aligned
      while (vis.length > sim.snake.length) vis.pop()
    }

    let raf, last = performance.now(), bcast = 0
    const loop = (ts) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(ts - last, 50); last = ts

      if (interactive && runRef.current && !pauseRef.current) {
        sim.acc += dt
        let guard = 0
        while (sim.acc >= sim.speed && guard++ < 4) { sim.acc -= sim.speed; step() }
        if (sim.deadFlash > 0) sim.deadFlash -= dt / 1000
        // smooth follow
        const a = Math.min(1, dt / 120)
        for (let i = 0; i < vis.length; i++) {
          vis[i].x += (sim.snake[i].x - vis[i].x) * a
          vis[i].y += (sim.snake[i].y - vis[i].y) * a
        }
        // broadcast ~4×/s
        bcast += dt
        if (mode === 'play' && bcast >= 250) {
          bcast = 0
          onState?.({ snake: sim.snake.map(s => [s.x, s.y]), food: [sim.food.x, sim.food.y], score: sim.score })
        }
        drawSim()
      } else if (mode === 'mirror') {
        drawMirror(dt)
      } else {
        drawSim()
      }
    }

    function cell(p, c, pad = 1) {
      ctx.fillStyle = c
      const r = CELL - pad * 2
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(p.x * CELL + pad, p.y * CELL + pad, r, r, 4)
      else ctx.rect(p.x * CELL + pad, p.y * CELL + pad, r, r)
      ctx.fill()
    }
    function bg() {
      ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, RES, RES)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, RES); ctx.stroke() }
      for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(RES, i * CELL); ctx.stroke() }
    }
    function drawSnake(segs, foodPos) {
      ctx.font = `${CELL - 6}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🍎', foodPos.x * CELL + CELL / 2, foodPos.y * CELL + CELL / 2)
      segs.forEach((s, i) => cell(s, i === 0 ? accent : color, i === 0 ? 1 : 2))
    }
    function drawSim() {
      bg()
      drawSnake(vis, sim.food)
      if (sim.deadFlash > 0) { ctx.fillStyle = `rgba(239,68,68,${sim.deadFlash})`; ctx.fillRect(0, 0, RES, RES) }
    }

    // mirror: render from opponent broadcast, lerp toward latest
    let mvis = null
    function drawMirror(dt) {
      bg()
      const st = stateRef.current
      if (!st || !st.snake) {
        ctx.fillStyle = '#475569'; ctx.font = '13px Nunito, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('waiting…', RES / 2, RES / 2)
        return
      }
      const target = st.snake.map(p => ({ x: p[0], y: p[1] }))
      if (!mvis || mvis.length !== target.length) mvis = target.map(p => ({ ...p }))
      const a = Math.min(1, dt / 130)
      for (let i = 0; i < target.length; i++) {
        mvis[i].x += (target[i].x - mvis[i].x) * a
        mvis[i].y += (target[i].y - mvis[i].y) * a
      }
      drawSnake(mvis, { x: st.food[0], y: st.food[1] })
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      if (mode === 'play') {
        window.removeEventListener('keydown', onKey)
        canvas.removeEventListener('touchstart', onTS)
        canvas.removeEventListener('touchend', onTE)
      }
    }
  }, [mode])

  return (
    <canvas ref={canvasRef} width={RES} height={RES}
      className="w-full h-full object-contain touch-none" style={{ imageRendering: 'auto' }} />
  )
}
