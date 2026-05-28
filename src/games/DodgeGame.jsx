import { useEffect, useRef } from 'react'

const W        = 340
const H        = 480
const PLAYER_W = 32
const PLAYER_H = 32
const OBJ_EMOJIS = ['💣', '🪨', '🚗', '⚡', '💥', '🔴']

export default function DodgeGame({ paused, onResult }) {
  const canvasRef  = useRef()
  const pauseRef   = useRef(false)
  const resultSent = useRef(false)
  const stateRef   = useRef(null)

  useEffect(() => { pauseRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const s = {
      player:  { x: W / 2, y: H - 60, speed: 5 },
      objects: [],
      score:   0,
      elapsed: 0,
      dead:    false,
      started: false,
      left:    false,
      right:   false,
      spawnTimer: 0,
    }
    stateRef.current = s

    // Keyboard
    const onKey = (e) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { s.left  = e.type === 'keydown'; e.preventDefault() }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { s.right = e.type === 'keydown'; e.preventDefault() }
      if ((e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') && e.type === 'keydown') s.started = true
    }
    window.addEventListener('keydown',  onKey)
    window.addEventListener('keyup',    onKey)

    // Touch
    const onTouch = (e) => {
      s.started = true
      const x = e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? W / 2
      const rect = canvas.getBoundingClientRect()
      const relX = (x - rect.left) / rect.width * W
      s.left  = relX < W / 2
      s.right = relX >= W / 2
    }
    const onTouchEnd = () => { s.left = false; s.right = false }
    canvas.addEventListener('touchstart', onTouch,    { passive: true })
    canvas.addEventListener('touchmove',  onTouch,    { passive: true })
    canvas.addEventListener('touchend',   onTouchEnd, { passive: true })

    // Click side to move
    const onClick = (e) => {
      s.started = true
      const rect = canvas.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width * W
      s.player.x = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, relX))
    }
    canvas.addEventListener('click', onClick)

    let last = performance.now()
    let rafId

    function spawnObj(speedMult) {
      s.objects.push({
        x:     Math.random() * (W - 28) + 14,
        y:     -20,
        emoji: OBJ_EMOJIS[Math.floor(Math.random() * OBJ_EMOJIS.length)],
        speed: (2.2 + Math.random() * 2.5) * speedMult,
        size:  24 + Math.random() * 12,
      })
    }

    const loop = (ts) => {
      rafId = requestAnimationFrame(loop)
      const dt = Math.min(ts - last, 50) / 1000
      last = ts

      if (s.dead || pauseRef.current || !s.started) {
        // Draw static frame
        drawFrame(0)
        return
      }

      s.elapsed += dt
      const speedMult = 1 + s.elapsed * 0.06
      s.score = Math.floor(s.elapsed * 10)

      // Move player
      const pspeed = s.player.speed * speedMult
      if (s.left)  s.player.x = Math.max(PLAYER_W / 2,     s.player.x - pspeed * 60 * dt)
      if (s.right) s.player.x = Math.min(W - PLAYER_W / 2, s.player.x + pspeed * 60 * dt)

      // Spawn objects
      s.spawnTimer += dt
      const spawnInterval = Math.max(0.25, 0.9 - s.elapsed * 0.012)
      if (s.spawnTimer >= spawnInterval) { s.spawnTimer = 0; spawnObj(speedMult) }

      // Move & collide objects
      for (let i = s.objects.length - 1; i >= 0; i--) {
        const o = s.objects[i]
        o.y += o.speed * 60 * dt
        if (o.y > H + 30) { s.objects.splice(i, 1); continue }

        // AABB collision
        const dx = Math.abs(o.x - s.player.x)
        const dy = Math.abs(o.y - (s.player.y + 0))
        if (dx < (PLAYER_W / 2 + o.size / 2 - 6) && dy < (PLAYER_H / 2 + o.size / 2 - 6)) {
          s.dead = true
          if (!resultSent.current) { resultSent.current = true; onResult?.(s.score) }
          return
        }
      }
      drawFrame(speedMult)
    }

    function drawFrame(speedMult) {
      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#0f0a2e')
      grad.addColorStop(1, '#1e1b4b')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Falling objects
      ctx.font = '28px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      s.objects.forEach(o => { ctx.font = `${o.size}px serif`; ctx.fillText(o.emoji, o.x, o.y) })

      // Player
      ctx.font = '28px serif'
      ctx.fillText('🏃', s.player.x, s.player.y)

      // HUD
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 18px Nunito, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(`⏱ ${(s.elapsed).toFixed(1)}s`, 10, 10)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#facc15'
      ctx.fillText(`Score: ${s.score}`, W - 10, 10)

      if (!s.started) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 18px Nunito, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('← → Keys or Tap sides to move', W / 2, H / 2)
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown',   onKey)
      window.removeEventListener('keyup',     onKey)
      canvas.removeEventListener('touchstart', onTouch)
      canvas.removeEventListener('touchmove',  onTouch)
      canvas.removeEventListener('touchend',   onTouchEnd)
      canvas.removeEventListener('click',      onClick)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0f0a2e]">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full object-contain cursor-pointer" />
    </div>
  )
}
