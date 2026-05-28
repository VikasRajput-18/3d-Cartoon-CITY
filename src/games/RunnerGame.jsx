import { useRef, useEffect } from 'react'

const W = 600, H = 400
const GROUND_Y = H - 80
const PLAYER_X = 100
const HS_KEY = 'runner_highscore'
const isMobileDevice = () => navigator.maxTouchPoints > 0

export default function RunnerGame({ paused, onResult }) {
  const canvasRef = useRef()
  const rafRef    = useRef()
  const pausedRef = useRef(false)
  const mobile    = isMobileDevice()

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const prevHS = parseInt(localStorage.getItem(HS_KEY) || '0', 10)
    let highScore = prevHS

    const s = {
      phase:    'race',
      score:    0,
      dist:     0,
      speed:    200,
      player:   { y: GROUND_Y, vy: 0, jumping: false, doubleUsed: false, dead: false },
      obstacles: [],
      spawnTimer: 0,
      bgX:      0,
      clouds: [
        { x: 100, y: 55, w: 80 }, { x: 350, y: 38, w: 60 }, { x: 520, y: 75, w: 100 },
        { x: 230, y: 90, w: 50 },
      ],
      stars: Array.from({ length: 20 }, () => ({
        x: Math.random() * W, y: Math.random() * (GROUND_Y - 100), r: 1 + Math.random() * 1.5,
      })),
      lastTap: 0,
    }

    function jump() {
      if (s.player.dead) return
      if (!s.player.jumping) {
        s.player.vy = -530; s.player.jumping = true; s.player.doubleUsed = false
      } else if (!s.player.doubleUsed) {
        s.player.vy = -440; s.player.doubleUsed = true
      }
    }

    const onKey = e => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault(); jump()
      }
    }

    // Mobile: single tap = jump, double-tap = double jump (handled via normal jump logic)
    const onTap = () => jump()

    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onTap)

    function spawnObstacle() {
      // More spacing on mobile (fewer obstacles, slower ramp-up)
      const type = Math.random() < 0.38 ? 'tall' : Math.random() < 0.5 ? 'wide' : 'small'
      const configs = {
        tall:  { w: 22, h: 62, color: '#ef4444' },
        wide:  { w: 52, h: 32, color: '#f97316' },
        small: { w: 20, h: 26, color: '#a855f7' },
      }
      const c = configs[type]
      s.obstacles.push({ x: W + 30, w: c.w, h: c.h, color: c.color })
    }

    let last = performance.now()
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!pausedRef.current && s.phase === 'race' && !s.player.dead) {
        s.dist   += s.speed * dt
        s.score   = Math.floor(s.dist / 100)
        // Mobile: gentler speed ramp-up
        s.speed   = 200 + s.score * (mobile ? 1.0 : 1.5)

        // Player physics
        s.player.vy += 1380 * dt
        s.player.y  += s.player.vy * dt
        if (s.player.y >= GROUND_Y) {
          s.player.y = GROUND_Y; s.player.vy = 0
          s.player.jumping = false; s.player.doubleUsed = false
        }

        // Spawn obstacles
        s.spawnTimer -= dt
        if (s.spawnTimer <= 0) {
          spawnObstacle()
          // More gap on mobile to compensate for smaller screen precision
          const baseGap = mobile ? 1.4 : 0.8
          const rampDown = mobile ? 0.001 : 0.002
          s.spawnTimer = baseGap + Math.random() * 1.0 - s.score * rampDown
          s.spawnTimer = Math.max(s.spawnTimer, mobile ? 0.9 : 0.55)
        }
        for (const o of s.obstacles) o.x -= s.speed * dt
        s.obstacles = s.obstacles.filter(o => o.x > -90)

        // Collision (tight box)
        const px = PLAYER_X + 4, py = s.player.y + 4, pw = 20, ph = 36
        for (const o of s.obstacles) {
          const oy = GROUND_Y + 44 - o.h
          if (px + pw > o.x + 3 && px < o.x + o.w - 3 && py + ph > oy + 4 && py < oy + o.h) {
            s.player.dead = true
            highScore = Math.max(highScore, s.score)
            localStorage.setItem(HS_KEY, highScore)
            setTimeout(() => { s.phase = 'done'; onResult(s.score >= 30) }, 900)
          }
        }

        // Clouds scroll
        for (const c of s.clouds) c.x -= 28 * dt
        for (const c of s.clouds) if (c.x < -c.w) c.x = W + c.w

        // Parallax stars scroll
        for (const st of s.stars) { st.x -= 12 * dt; if (st.x < 0) st.x = W }
      }

      // ── Draw ─────────────────────────────────────────────────────────────
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#0c0a20')
      sky.addColorStop(0.6, '#1e3a5f')
      sky.addColorStop(1, '#0ea5e9')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (const st of s.stars) {
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill()
      }

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      for (const c of s.clouds) {
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w / 2, 16, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(c.x - 20, c.y + 9, c.w / 3, 12, 0, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(c.x + 20, c.y + 9, c.w / 3, 12, 0, 0, Math.PI * 2); ctx.fill()
      }

      // Ground layers
      ctx.fillStyle = '#166534'
      ctx.fillRect(0, GROUND_Y + 44, W, H - GROUND_Y - 44)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(0, GROUND_Y + 44, W, 10)
      ctx.fillStyle = '#374151'
      ctx.fillRect(0, GROUND_Y + 54, W, 26)

      // Road dashes
      ctx.fillStyle = '#facc15'
      const dashSpacing = 80
      const dashOffset = (s.dist * 0.8) % dashSpacing
      for (let x = -dashOffset; x < W; x += dashSpacing) {
        ctx.fillRect(x, GROUND_Y + 64, 40, 4)
      }

      // Obstacles
      for (const o of s.obstacles) {
        const oy = GROUND_Y + 44 - o.h
        const grad = ctx.createLinearGradient(o.x, oy, o.x + o.w, oy + o.h)
        grad.addColorStop(0, o.color)
        grad.addColorStop(1, o.color + 'aa')
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.roundRect(o.x, oy, o.w, o.h, 4); ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(o.x, oy, o.w, 6)
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, GROUND_Y + 46, o.w / 2, 5, 0, 0, Math.PI * 2); ctx.fill()
      }

      // Player
      const px = PLAYER_X, py = s.player.y
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath(); ctx.ellipse(px + 14, GROUND_Y + 46, 12, 4, 0, 0, Math.PI * 2); ctx.fill()
      // Body
      ctx.fillStyle = s.player.dead ? '#94a3b8' : '#7c3aed'
      ctx.beginPath(); ctx.roundRect(px, py, 28, 44, 6); ctx.fill()
      // Shirt stripe
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px + 4, py + 14, 20, 4)
      // Face
      ctx.fillStyle = '#fddbb4'
      ctx.beginPath(); ctx.arc(px + 14, py + 10, 10, 0, Math.PI * 2); ctx.fill()
      // Eyes
      ctx.fillStyle = s.player.dead ? '#ef4444' : '#1a1a1a'
      ctx.beginPath(); ctx.arc(px + 10, py + 9, 2.2, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(px + 18, py + 9, 2.2, 0, Math.PI * 2); ctx.fill()
      if (s.player.dead) {
        // X eyes
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(px + 8, py + 7); ctx.lineTo(px + 12, py + 11); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px + 12, py + 7); ctx.lineTo(px + 8, py + 11); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px + 16, py + 7); ctx.lineTo(px + 20, py + 11); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px + 20, py + 7); ctx.lineTo(px + 16, py + 11); ctx.stroke()
      }
      // Legs (animated)
      const legAnim = s.player.jumping ? 0 : Math.sin(s.dist * 0.08) * 6
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(px + 3, py + 38, 9, 12 + legAnim); ctx.fillRect(px + 16, py + 38, 9, 12 - legAnim)

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, 38)
      ctx.fillStyle = '#facc15'; ctx.font = `bold ${mobile ? 16 : 15}px monospace`
      ctx.fillText(`Score: ${s.score}`, 16, 24)
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'right'
      ctx.fillText(`Best: ${highScore}`, W - 12, 24)
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${mobile ? 12 : 11}px monospace`
      ctx.fillText(mobile ? 'TAP to jump' : 'Space/W/↑ to jump · double for double jump', W / 2, 24)
      ctx.textAlign = 'left'

      // Double jump indicator
      if (s.player.jumping) {
        ctx.fillStyle = s.player.doubleUsed ? '#94a3b8' : '#a78bfa'
        ctx.font = '11px monospace'
        ctx.fillText(s.player.doubleUsed ? '— used —' : '⬆ double jump!', px - 10, py - 8)
      }

      // Death flash
      if (s.player.dead) {
        ctx.fillStyle = 'rgba(239,68,68,0.28)'; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'
        ctx.fillText(`Score: ${s.score} — ${s.score >= 30 ? 'You Win!' : 'Game Over!'}`, W / 2, H / 2)
        ctx.textAlign = 'left'
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onTap)
    }
  }, [])  // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={W} height={H}
      className="block w-full h-full object-contain cursor-pointer touch-none"
    />
  )
}
