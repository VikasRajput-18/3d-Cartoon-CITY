import { useRef, useEffect } from 'react'

const W = 600, H = 400
const WATER_Y = 150
const isMobileDevice = () => navigator.maxTouchPoints > 0

const FISH_TYPES = [
  { name: 'Minnow',    color: '#94a3b8', size: 14, coins: 10, speed: 55  },
  { name: 'Goldfish',  color: '#f59e0b', size: 18, coins: 10, speed: 60  },
  { name: 'Salmon',    color: '#f97316', size: 22, coins: 25, speed: 80  },
  { name: 'Tuna',      color: '#3b82f6', size: 26, coins: 25, speed: 100 },
  { name: 'Rare Koi',  color: '#a855f7', size: 30, coins: 50, speed: 130 },
]

function spawnFish() {
  const t = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)]
  const goRight = Math.random() < 0.5
  return {
    x: goRight ? -40 : W + 40,
    y: WATER_Y + 30 + Math.random() * (H - WATER_Y - 80),
    vx: (goRight ? 1 : -1) * (t.speed + Math.random() * 20),
    ...t,
    id: Math.random(),
  }
}

export default function FishingGame({ paused, onResult }) {
  const canvasRef  = useRef()
  const rafRef     = useRef()
  const pausedRef  = useRef(false)
  const mobile     = isMobileDevice()

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // ── state ──────────────────────────────────────────────────────────────
    const s = {
      // phases: idle | casting | biting | caught | missed | done
      phase:      'idle',
      lineX:      W / 2,
      bobY:       WATER_Y + 12,
      bobVy:      0,
      fishes:     [spawnFish(), spawnFish(), spawnFish(), spawnFish()],
      coins:      0,
      catches:    0,
      casts:      0,
      // bite timer: how long until a fish bites (set on cast)
      biteTimer:  0,
      // catch window: how long player has to press (2.5 desktop, 3 mobile)
      catchWindow: 0,
      catchBar:   0,   // 0→1 moving marker
      nearFish:   null,
      lastCatch:  null,
      flashTimer: 0,
      flashWin:   false,
      totalTime:  60,
      timeLeft:   60,
      started:    false,  // timer only starts after first cast
    }

    // ── helpers ────────────────────────────────────────────────────────────
    function cast() {
      if (s.phase !== 'idle') return
      s.phase     = 'casting'
      s.casts++
      s.started   = true
      s.biteTimer = 3 + Math.random() * 5   // 3-8 seconds
      s.bobY      = WATER_Y + 12
      s.bobVy     = 0
      s.catchBar  = 0
      // pick a random target fish to home toward line X
      s.nearFish  = s.fishes[Math.floor(Math.random() * s.fishes.length)]
    }

    function tryPress() {
      if (s.phase === 'idle')    { cast(); return }
      if (s.phase === 'casting') { /* waiting — ignore */ return }
      if (s.phase === 'biting') {
        const windowDur = mobile ? 3.0 : 2.5
        const inZone    = s.catchBar > 0.25 && s.catchBar < 0.75
        if (inZone) {
          s.catches++
          s.coins += s.nearFish.coins
          s.lastCatch = s.nearFish
          s.fishes    = s.fishes.filter(f => f.id !== s.nearFish.id)
          s.fishes.push(spawnFish())
          s.phase     = 'caught'
        } else {
          s.lastCatch = null
          s.phase     = 'missed'
        }
        s.flashTimer = 1.4
        s.flashWin   = inZone
        setTimeout(() => { s.phase = 'idle'; s.nearFish = null }, 1400)
      }
    }

    // ── input ──────────────────────────────────────────────────────────────
    const onKey = e => {
      if (e.code === 'Space') { e.preventDefault(); tryPress() }
    }
    const onTap = () => tryPress()

    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onTap)

    // ── game loop ──────────────────────────────────────────────────────────
    let last = performance.now()
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!pausedRef.current) {
        // Timer — only after first cast
        if (s.started && s.phase !== 'done') {
          s.timeLeft -= dt
          if (s.timeLeft <= 0) {
            s.timeLeft = 0
            s.phase = 'done'
            onResult(s.catches >= 3)
            return
          }
        }

        // Fish swim
        for (const f of s.fishes) {
          f.x += f.vx * dt
          if (f.x < -60) f.x = W + 60
          if (f.x > W + 60) f.x = -60
        }

        // Bob bobbing (idle animation even when not casting)
        if (s.phase === 'idle') {
          s.bobY = WATER_Y + 12 + Math.sin(now * 0.003) * 2
        }

        // Casting: bob settles into water, then biteTimer counts down
        if (s.phase === 'casting') {
          s.bobVy += 180 * dt
          s.bobY  = Math.min(WATER_Y + 14, s.bobY + s.bobVy * dt)
          if (s.bobY >= WATER_Y + 13) { s.bobY = WATER_Y + 13; s.bobVy = -60 }

          s.biteTimer -= dt
          if (s.biteTimer <= 0) {
            // Fish bites!
            s.phase      = 'biting'
            s.catchBar   = 0
            // position bob near near fish for visual
            if (s.nearFish) s.lineX = Math.max(60, Math.min(W - 20, s.nearFish.x))
          }
        }

        // Biting: catchBar sweeps 0→1 in catchWindowDur seconds
        if (s.phase === 'biting') {
          const catchWindowDur = mobile ? 3.0 : 2.5
          s.catchBar += dt / catchWindowDur
          s.bobY = WATER_Y + 13 + Math.sin(now * 0.014) * 7
          s.bobVy = 0
          if (s.catchBar >= 1) {
            // Ran out of time — auto miss
            s.lastCatch = null
            s.phase     = 'missed'
            s.flashTimer = 1.2
            s.flashWin   = false
            setTimeout(() => { s.phase = 'idle'; s.nearFish = null }, 1200)
          }
        }

        if (s.phase === 'casting' || s.phase === 'idle') {
          // keep lineX stable; reset if idle
          if (s.phase === 'idle') s.lineX = W / 2
        }

        s.flashTimer = Math.max(0, s.flashTimer - dt)
      }

      // ── DRAW ──────────────────────────────────────────────────────────────
      draw(ctx, s, now, mobile)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onTap)
    }
  }, [])   // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={W} height={H}
      className="block w-full h-full object-contain cursor-pointer touch-none"
    />
  )
}

// ── Pure draw function ──────────────────────────────────────────────────────
function draw(ctx, s, now, mobile) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, WATER_Y)
  skyGrad.addColorStop(0, '#0284c7')
  skyGrad.addColorStop(1, '#7dd3fc')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, W, WATER_Y)

  // Water gradient
  const waterGrad = ctx.createLinearGradient(0, WATER_Y, 0, H)
  waterGrad.addColorStop(0, '#0369a1')
  waterGrad.addColorStop(1, '#1e3a5f')
  ctx.fillStyle = waterGrad
  ctx.fillRect(0, WATER_Y, W, H - WATER_Y)

  // Water shimmer lines
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  for (let i = 0; i < 7; i++) {
    const wy = WATER_Y + 18 + i * 28 + Math.sin(now * 0.001 + i * 0.9) * 4
    ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(W, wy); ctx.stroke()
  }

  // Pier / dock platform
  ctx.fillStyle = '#92400e'
  ctx.fillRect(0, 0, 130, WATER_Y + 22)
  ctx.fillStyle = '#a16207'
  ctx.fillRect(0, WATER_Y - 18, 138, 20)
  // Pier planks
  ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 1
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(i * 15, WATER_Y - 18); ctx.lineTo(i * 15, WATER_Y + 4); ctx.stroke()
  }

  // Angler sprite
  const ax = 46, ay = WATER_Y - 18
  // Legs
  ctx.fillStyle = '#1e3a5f'
  ctx.fillRect(ax - 8, ay + 22, 8, 18); ctx.fillRect(ax + 2, ay + 22, 8, 18)
  // Body
  ctx.fillStyle = '#7c3aed'
  ctx.beginPath(); ctx.roundRect(ax - 10, ay, 22, 26, 5); ctx.fill()
  // Head
  ctx.fillStyle = '#fddbb4'
  ctx.beginPath(); ctx.arc(ax + 1, ay - 12, 13, 0, Math.PI * 2); ctx.fill()
  // Hat
  ctx.fillStyle = '#7c2d12'
  ctx.fillRect(ax - 10, ay - 22, 24, 6)
  ctx.fillRect(ax - 6, ay - 30, 16, 10)
  // Rod arm
  ctx.strokeStyle = '#7c4a1e'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(ax + 12, ay + 5); ctx.lineTo(s.lineX, WATER_Y - 14); ctx.stroke()

  // Fishing line (always drawn when casting/biting)
  if (s.phase === 'casting' || s.phase === 'biting' || s.phase === 'caught' || s.phase === 'missed') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(s.lineX, WATER_Y - 14); ctx.lineTo(s.lineX, s.bobY); ctx.stroke()

    // Hook (tiny J below line end)
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(s.lineX, s.bobY)
    ctx.lineTo(s.lineX, s.bobY + 6)
    ctx.arc(s.lineX + 2, s.bobY + 6, 2, Math.PI, 0, false)
    ctx.stroke()
  }

  // Bobber float
  if (s.phase === 'casting' || s.phase === 'biting' || s.phase === 'caught' || s.phase === 'missed') {
    const biting = s.phase === 'biting'
    // Biting: large flashing red bobber
    const bobR   = biting ? (8 + Math.sin(now * 0.025) * 2) : 6
    const bobCol = biting ? '#ef4444' : '#f97316'

    if (biting) {
      // Ripple rings
      ctx.strokeStyle = 'rgba(239,68,68,0.4)'
      ctx.lineWidth = 2
      const rr = 14 + Math.sin(now * 0.015) * 4
      ctx.beginPath(); ctx.arc(s.lineX, s.bobY, rr, 0, Math.PI * 2); ctx.stroke()
    }

    ctx.fillStyle = bobCol
    ctx.beginPath(); ctx.arc(s.lineX, s.bobY, bobR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(s.lineX, s.bobY - bobR * 0.3, bobR * 0.35, 0, Math.PI * 2); ctx.fill()
    // Bottom half
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(s.lineX, s.bobY, bobR * 0.38, 0, Math.PI); ctx.fill()
  }

  // Fish (only visible in water — clip)
  ctx.save()
  ctx.beginPath(); ctx.rect(0, WATER_Y, W, H - WATER_Y); ctx.clip()
  for (const f of s.fishes) {
    const dir = f.vx > 0 ? 1 : -1
    ctx.save()
    ctx.translate(f.x, f.y)
    ctx.scale(dir, 1)
    ctx.fillStyle = f.color
    ctx.globalAlpha = 0.88
    ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.48, 0, 0, Math.PI * 2); ctx.fill()
    // Tail
    ctx.beginPath()
    ctx.moveTo(f.size, 0)
    ctx.lineTo(f.size + 10, -7)
    ctx.lineTo(f.size + 10,  7)
    ctx.closePath(); ctx.fill()
    // Fin
    ctx.beginPath()
    ctx.moveTo(-2, -f.size * 0.38)
    ctx.lineTo(6, -f.size * 0.38 - 6)
    ctx.lineTo(12, -f.size * 0.38)
    ctx.closePath(); ctx.fill()
    // Eye white
    ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(-f.size * 0.42, -2, 3.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath(); ctx.arc(-f.size * 0.42 + 0.8, -2, 2, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // ── CATCH BAR (when biting) ─────────────────────────────────────────────
  if (s.phase === 'biting') {
    const bx = W / 2 - 110, by = H - 70, bw = 220, bh = mobile ? 28 : 22

    // "FISH BITING!" alert
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.beginPath(); ctx.roundRect(W / 2 - 110, by - 36, 220, 30, 8); ctx.fill()
    ctx.fillStyle = '#ef4444'
    const pulse = 0.8 + Math.sin(now * 0.02) * 0.2
    ctx.globalAlpha = pulse
    ctx.font = `bold ${mobile ? 15 : 13}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('🐟 FISH BITING! PRESS NOW!', W / 2, by - 16)
    ctx.globalAlpha = 1

    // Bar background
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6); ctx.fill()

    // Red zones
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(bx, by, bw, bh)

    // Green zone (25%-75%)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(bx + bw * 0.25, by, bw * 0.5, bh)

    // Zone labels
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'center'
    ctx.fillText('TOO EARLY', bx + bw * 0.12, by + bh / 2 + 3)
    ctx.fillText('TOO LATE',  bx + bw * 0.87, by + bh / 2 + 3)

    // Moving marker
    const mx = bx + s.catchBar * bw
    ctx.fillStyle = '#facc15'
    ctx.fillRect(mx - 4, by - 5, 8, bh + 10)

    // Instruction
    ctx.fillStyle = '#fff'; ctx.font = `bold ${mobile ? 13 : 12}px monospace`; ctx.textAlign = 'center'
    ctx.fillText(mobile ? 'TAP to catch!' : 'SPACE to catch!', W / 2, by + bh + 16)
  }

  // ── FLASH FEEDBACK ─────────────────────────────────────────────────────
  if (s.flashTimer > 0) {
    const fa = s.flashTimer / 1.4
    if (s.flashWin && s.lastCatch) {
      ctx.fillStyle = `rgba(34,197,94,${fa * 0.3})`
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#22c55e'
      ctx.font = `bold ${mobile ? 20 : 22}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(`Caught ${s.lastCatch.name}! +${s.lastCatch.coins} coins!`, W / 2, H / 2)
    } else if (!s.flashWin && s.phase !== 'idle') {
      ctx.fillStyle = `rgba(239,68,68,${fa * 0.22})`
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#ef4444'
      ctx.font = `bold ${mobile ? 18 : 20}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText('Got away! Try again…', W / 2, H / 2)
    }
  }

  // ── HUD top bar ─────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, 0, W, 32)
  ctx.font = `bold ${mobile ? 14 : 13}px monospace`
  ctx.textAlign = 'left'
  ctx.fillStyle = '#facc15'
  ctx.fillText(`🪙 ${s.coins}`, 10, 21)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(`🐟 ${s.catches}/3`, 90, 21)
  ctx.fillStyle = s.timeLeft < 15 ? '#ef4444' : '#e2e8f0'
  ctx.textAlign = 'right'
  ctx.fillText(`⏱ ${Math.ceil(Math.max(0, s.timeLeft))}s`, W - 10, 21)

  // Status hint
  ctx.fillStyle = '#64748b'; ctx.font = `11px monospace`; ctx.textAlign = 'center'
  if (s.phase === 'idle') {
    ctx.fillText(mobile ? 'TAP to cast' : 'SPACE to cast', W / 2, 21)
  } else if (s.phase === 'casting') {
    ctx.fillText('Waiting for a bite…', W / 2, 21)
  }
}
