import { useEffect, useRef } from 'react'

const CELL = 22
const COLS = 19
const ROWS = 15
const FOODS = ['🍕', '🍔', '🍦', '🍓', '🌮', '🍩', '🍪', '🍉', '🥑', '🍟']

function placeFood(snake) {
  let pos
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  pos.emoji = FOODS[Math.floor(Math.random() * FOODS.length)]
  return pos
}

export default function SnakeGame({ paused, onResult }) {
  const canvasRef = useRef()
  const stateRef  = useRef({
    snake:   [{ x: 9, y: 7 }],
    dir:     { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food:    { x: 14, y: 7, emoji: '🍕' },
    score:   0,
    dead:    false,
    speed:   140,
  })
  const pauseRef  = useRef(false)
  const lastTick  = useRef(0)
  const resultSent = useRef(false)

  useEffect(() => { pauseRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s   = stateRef.current
    const W   = COLS * CELL
    const H   = ROWS * CELL

    function draw() {
      ctx.fillStyle = '#0a0a1a'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = 'rgba(124,58,237,0.09)'
      ctx.lineWidth = 1
      for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke() }
      for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke() }

      // Food
      ctx.font = `${CELL - 3}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.food.emoji, s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2)

      // Snake body
      s.snake.forEach((seg, i) => {
        const isHead = i === 0
        const t      = 1 - i / s.snake.length
        ctx.fillStyle = isHead ? '#a78bfa' : `rgba(124,58,237,${0.35 + t * 0.55})`
        const pad = isHead ? 1 : 4
        const r   = CELL - pad * 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, r, r, isHead ? 5 : 8)
        else ctx.rect(seg.x * CELL + pad, seg.y * CELL + pad, r, r)
        ctx.fill()
        if (isHead) {
          ctx.fillStyle = '#fff'
          const ex = seg.x * CELL + CELL / 2 + s.dir.x * 4
          const ey = seg.y * CELL + CELL / 2 + s.dir.y * 4
          ctx.beginPath(); ctx.arc(ex - s.dir.y * 3, ey + s.dir.x * 3, 2, 0, Math.PI * 2); ctx.fill()
          ctx.beginPath(); ctx.arc(ex + s.dir.y * 3, ey - s.dir.x * 3, 2, 0, Math.PI * 2); ctx.fill()
        }
      })

      // HUD
      ctx.fillStyle = '#a78bfa'
      ctx.font = 'bold 15px Nunito, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`🐍 Score: ${s.score}`, 8, 6)
      ctx.fillStyle = '#64748b'
      ctx.font = '12px Nunito, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('WASD / Arrows / Swipe', W - 8, 6)
    }

    // Key handler
    const DIR_MAP = {
      ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
    }
    const onKey = (e) => {
      const d = DIR_MAP[e.code]
      if (!d) return
      if (d.x === -s.dir.x && d.y === -s.dir.y) return
      s.nextDir = d; e.preventDefault()
    }
    window.addEventListener('keydown', onKey)

    // Swipe
    let tx = 0, ty = 0
    const onTouchStart = (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY }
    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - tx
      const dy = e.changedTouches[0].clientY - ty
      if (Math.abs(dx) > Math.abs(dy)) {
        const d = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 }
        if (!(d.x === -s.dir.x)) s.nextDir = d
      } else {
        const d = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }
        if (!(d.y === -s.dir.y)) s.nextDir = d
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    let rafId
    const loop = (ts) => {
      rafId = requestAnimationFrame(loop)
      if (s.dead) { draw(); return }
      if (pauseRef.current) { draw(); return }
      if (ts - lastTick.current < s.speed) { draw(); return }
      lastTick.current = ts

      s.dir = { ...s.nextDir }
      const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y }

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        s.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        s.dead = true
        // Cancel next RAF immediately — score is saved exactly once here, not in the render loop
        cancelAnimationFrame(rafId)
        draw()
        if (!resultSent.current) { resultSent.current = true; onResult?.(s.score) }
        return
      }

      s.snake.unshift(head)
      if (head.x === s.food.x && head.y === s.food.y) {
        s.score++
        s.food  = placeFood(s.snake)
        s.speed = Math.max(55, 140 - s.score * 6)
      } else {
        s.snake.pop()
      }
      draw()
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a1a]">
      <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL} className="max-w-full max-h-full object-contain" />
    </div>
  )
}
