import { useRef, useEffect } from 'react'

const W = 600, H = 400
const GAME_DURATION = 30
const HS_KEY = 'shooting_highscore'
const isMobileDevice = () => navigator.maxTouchPoints > 0

function newTarget(id, mobile) {
  const base = mobile ? 26 : 20
  const size = base + Math.random() * (mobile ? 24 : 28)
  return {
    id,
    x: size + 20 + Math.random() * (W - size * 2 - 40),
    y: size + 20 + Math.random() * (H - 100 - size * 2),
    size,
    points: Math.max(5, Math.round(50 - size)),
    hp: size > (mobile ? 44 : 38) ? 2 : 1,
    hit: false,
    born: performance.now(),
    life: 1600 + Math.random() * 2200,
    vx: (Math.random() - 0.5) * 55,
    vy: (Math.random() - 0.5) * 40,
  }
}

export default function ShootingGame({ paused, onResult }) {
  const canvasRef = useRef()
  const rafRef    = useRef()
  const pausedRef = useRef(false)
  const mouseRef  = useRef({ x: W / 2, y: H / 2 })
  const idRef     = useRef(0)
  const mobile    = isMobileDevice()

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const prevHS = parseInt(localStorage.getItem(HS_KEY) || '0', 10)

    const s = {
      targets: [newTarget(idRef.current++, mobile), newTarget(idRef.current++, mobile)],
      score:   0,
      time:    GAME_DURATION,
      shots:   0,
      hits:    0,
      phase:   'race',
      flashes: [],
      highScore: prevHS,
      ripples:   [],  // tap ripple effects on mobile
    }

    function scaleCoords(clientX, clientY) {
      const r = canvas.getBoundingClientRect()
      return {
        x: (clientX - r.left) * (W / r.width),
        y: (clientY - r.top)  * (H / r.height),
      }
    }

    const onMouseMove = e => {
      if (mobile) return
      mouseRef.current = scaleCoords(e.clientX, e.clientY)
    }

    function handleShot(cx, cy) {
      if (s.phase !== 'race') return
      s.shots++
      let hit = false
      for (const t of s.targets) {
        if (t.hit) continue
        const dx = cx - t.x, dy = cy - t.y
        if (dx * dx + dy * dy < t.size * t.size) {
          t.hp--
          if (t.hp <= 0) {
            t.hit = true; s.score += t.points; s.hits++
            s.flashes.push({ x: t.x, y: t.y, pts: t.points, born: performance.now(), color: '#facc15' })
          } else {
            s.flashes.push({ x: t.x, y: t.y, pts: '!', born: performance.now(), color: '#f97316' })
          }
          hit = true; break
        }
      }
      if (!hit) s.flashes.push({ x: cx, y: cy, pts: '✕', born: performance.now(), color: '#ef4444' })
      if (mobile) s.ripples.push({ x: cx, y: cy, born: performance.now() })
    }

    const onClick = e => {
      const { x, y } = scaleCoords(e.clientX, e.clientY)
      handleShot(x, y)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('pointerdown', onClick)

    let last = performance.now()
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!pausedRef.current && s.phase === 'race') {
        s.time -= dt
        if (s.time <= 0) {
          s.time = 0; s.phase = 'done'
          const newHS = Math.max(s.highScore, s.score)
          localStorage.setItem(HS_KEY, newHS)
          s.highScore = newHS
          onResult(s.score >= 150)
        }

        // Spawn
        const alive = s.targets.filter(t => !t.hit && now - t.born < t.life)
        s.targets = alive
        if (s.targets.length < (mobile ? 3 : 4) && Math.random() < 0.05)
          s.targets.push(newTarget(idRef.current++, mobile))

        // Move
        for (const t of s.targets) {
          t.x += t.vx * dt; t.y += t.vy * dt
          if (t.x < t.size || t.x > W - t.size) t.vx *= -1
          if (t.y < t.size || t.y > H - 50 - t.size) t.vy *= -1
          t.x = Math.max(t.size, Math.min(W - t.size, t.x))
          t.y = Math.max(t.size, Math.min(H - 50 - t.size, t.y))
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────────
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H)

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

      // Scan lines (aesthetic)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2)

      // Targets
      for (const t of s.targets) {
        const age = (now - t.born) / t.life
        const fade = age > 0.8 ? 1 - (age - 0.8) / 0.2 : 1
        const rings = t.hp > 1 ? 3 : 2
        // Outer glow
        const glow = ctx.createRadialGradient(t.x, t.y, t.size * 0.7, t.x, t.y, t.size * 1.3)
        glow.addColorStop(0, `rgba(239,68,68,${0.3 * fade})`)
        glow.addColorStop(1, 'rgba(239,68,68,0)')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(t.x, t.y, t.size * 1.3, 0, Math.PI * 2); ctx.fill()

        for (let r = rings; r >= 0; r--) {
          ctx.beginPath(); ctx.arc(t.x, t.y, t.size * (r / rings), 0, Math.PI * 2)
          ctx.fillStyle = r % 2 === 0 ? `rgba(239,68,68,${0.9 * fade})` : `rgba(255,255,255,${0.95 * fade})`
          ctx.fill()
        }
        ctx.fillStyle = `rgba(255,204,20,${fade})`
        ctx.font = `bold ${Math.round(t.size * 0.45)}px monospace`; ctx.textAlign = 'center'
        ctx.fillText(t.points, t.x, t.y + t.size * 0.18)

        // Life bar
        const lifeLeft = 1 - (now - t.born) / t.life
        if (lifeLeft < 0.5) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.fillRect(t.x - t.size, t.y + t.size + 4, t.size * 2, 4)
          ctx.fillStyle = lifeLeft < 0.25 ? '#ef4444' : '#facc15'
          ctx.fillRect(t.x - t.size, t.y + t.size + 4, t.size * 2 * lifeLeft, 4)
        }
      }

      // Score flashes
      s.flashes = s.flashes.filter(f => now - f.born < 700)
      for (const f of s.flashes) {
        const a = 1 - (now - f.born) / 700
        ctx.fillStyle = f.color
        ctx.globalAlpha = a
        ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'
        ctx.fillText(typeof f.pts === 'number' ? `+${f.pts}` : f.pts, f.x, f.y - (now - f.born) * 0.045)
        ctx.globalAlpha = 1
      }

      // Mobile tap ripples
      if (mobile) {
        s.ripples = s.ripples.filter(r => now - r.born < 400)
        for (const r of s.ripples) {
          const age = (now - r.born) / 400
          ctx.strokeStyle = `rgba(250,204,21,${1 - age})`
          ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(r.x, r.y, age * 30, 0, Math.PI * 2); ctx.stroke()
        }
      }

      // Desktop crosshair (hidden on mobile)
      if (!mobile) {
        const mx = mouseRef.current.x, my = mouseRef.current.y
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.lineTo(mx + 14, my); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(mx, my - 14); ctx.lineTo(mx, my + 14); ctx.stroke()
        ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.stroke()
      }

      ctx.textAlign = 'left'

      // HUD bar
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, H - 46, W, 46)
      ctx.fillStyle = '#facc15'; ctx.font = `bold ${mobile ? 16 : 15}px monospace`
      ctx.fillText(`Score: ${s.score}`, 16, H - 20)
      ctx.fillStyle = s.time < 10 ? '#ef4444' : '#e2e8f0'
      ctx.textAlign = 'center'
      ctx.fillText(`⏱ ${Math.ceil(s.time)}s`, W / 2, H - 20)
      ctx.fillStyle = '#94a3b8'; ctx.font = `${mobile ? 12 : 11}px monospace`
      ctx.textAlign = 'right'
      ctx.fillText(`Best: ${s.highScore}`, W - 12, H - 30)
      ctx.fillStyle = '#64748b'
      ctx.fillText(`Acc: ${s.shots > 0 ? Math.round(s.hits / s.shots * 100) : 0}%`, W - 12, H - 12)
      ctx.textAlign = 'left'

      if (mobile) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '11px monospace'; ctx.textAlign = 'center'
        ctx.fillText('TAP targets to shoot!', W / 2, H - 54)
        ctx.textAlign = 'left'
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('pointerdown', onClick)
    }
  }, [])  // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={W} height={H}
      style={{
        display: 'block', width: '100%', height: '100%',
        objectFit: 'contain', cursor: mobile ? 'default' : 'none', touchAction: 'none',
      }}
    />
  )
}
