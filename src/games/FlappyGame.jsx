import { useEffect, useRef } from 'react'

const W       = 360
const H       = 520
const GRAVITY = 0.45
const FLAP    = -8.5
const PIPE_W  = 52
const GAP     = 130
const PIPE_SPEED = 2.8

const OBSTACLES = ['🌳', '🏙️', '🚗', '🌵', '🏗️']

export default function FlappyGame({ paused, onResult }) {
  const canvasRef  = useRef()
  const pauseRef   = useRef(false)
  const resultSent = useRef(false)
  const stateRef   = useRef(null)

  useEffect(() => { pauseRef.current = paused }, [paused])

  function initState() {
    return {
      bird:    { y: H / 2, vy: 0, x: 80 },
      pipes:   [],
      score:   0,
      frame:   0,
      dead:    false,
      started: false,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    stateRef.current = initState()
    const s = stateRef.current

    function spawnPipe() {
      const gapY = 90 + Math.random() * (H - GAP - 140)
      const obs   = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)]
      s.pipes.push({ x: W + 10, gapY, obs })
    }

    function flap() {
      if (s.dead) return
      if (!s.started) s.started = true
      s.bird.vy = FLAP
    }

    const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); flap() } }
    const onClick = () => flap()
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onClick)

    function draw() {
      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#1e1b4b')
      sky.addColorStop(1, '#312e81')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Ground
      ctx.fillStyle = '#16a34a'
      ctx.fillRect(0, H - 40, W, 40)
      ctx.fillStyle = '#15803d'
      ctx.fillRect(0, H - 40, W, 6)

      // Pipes
      s.pipes.forEach(p => {
        // Top pipe
        ctx.fillStyle = '#7c3aed'
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY - GAP / 2)
        // Pipe cap
        ctx.fillStyle = '#6d28d9'
        ctx.fillRect(p.x - 4, p.gapY - GAP / 2 - 14, PIPE_W + 8, 14)
        // Bottom pipe
        ctx.fillStyle = '#7c3aed'
        ctx.fillRect(p.x, p.gapY + GAP / 2, PIPE_W, H - (p.gapY + GAP / 2) - 40)
        // Bottom cap
        ctx.fillStyle = '#6d28d9'
        ctx.fillRect(p.x - 4, p.gapY + GAP / 2, PIPE_W + 8, 14)
        // Obstacle emoji
        ctx.font = '24px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.obs, p.x + PIPE_W / 2, p.gapY)
      })

      // Bird
      const bird = s.bird
      ctx.save()
      ctx.translate(bird.x, bird.y)
      const angle = Math.max(-0.5, Math.min(0.8, bird.vy * 0.05))
      ctx.rotate(angle)
      ctx.font = '28px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐦', 0, 0)
      ctx.restore()

      // Score
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 26px Nunito, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(s.score, W / 2, 20)

      // Start hint
      if (!s.started && !s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 20px Nunito, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Tap / Space to start', W / 2, H / 2)
      }
    }

    let rafId
    let pipeTimer = 0
    const BASE_SPEED = PIPE_SPEED

    const loop = () => {
      rafId = requestAnimationFrame(loop)
      if (s.dead || pauseRef.current) { draw(); return }
      if (!s.started) { draw(); return }

      s.frame++
      const speedMult = 1 + s.score * 0.04

      // Bird physics
      s.bird.vy += GRAVITY
      s.bird.y  += s.bird.vy

      // Ground collision
      if (s.bird.y > H - 58) {
        s.dead = true
        if (!resultSent.current) { resultSent.current = true; onResult?.(s.score) }
        return
      }
      if (s.bird.y < 0) s.bird.y = 0

      // Spawn pipes
      pipeTimer++
      if (pipeTimer >= Math.round(78 / speedMult)) { pipeTimer = 0; spawnPipe() }

      // Move pipes
      for (let i = s.pipes.length - 1; i >= 0; i--) {
        s.pipes[i].x -= BASE_SPEED * speedMult
        if (s.pipes[i].x < -PIPE_W - 10) { s.pipes.splice(i, 1); continue }

        // Score when passed
        if (!s.pipes[i].passed && s.pipes[i].x + PIPE_W < s.bird.x) {
          s.pipes[i].passed = true; s.score++
        }

        // Collision
        const bx = s.bird.x, by = s.bird.y, br = 13
        const px = s.pipes[i].x, gapY = s.pipes[i].gapY
        if (bx + br > px && bx - br < px + PIPE_W) {
          if (by - br < gapY - GAP / 2 || by + br > gapY + GAP / 2) {
            s.dead = true
            if (!resultSent.current) { resultSent.current = true; onResult?.(s.score) }
            return
          }
        }
      }
      draw()
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onClick)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1e1b4b]">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full object-contain cursor-pointer" />
    </div>
  )
}
