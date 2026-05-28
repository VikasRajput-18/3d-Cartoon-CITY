import { useRef, useEffect } from 'react'

const W = 600, H = 400
const TRACK_CX = W / 2, TRACK_CY = H / 2 + 10
const TRACK_RX = 220, TRACK_RY = 150, TRACK_THICK = 54
const LAPS_TO_WIN = 3
const PLAYER_MAX_SPEED = 196   // +40% vs old 140
const AI_TRACK_SPEED   = 0.70  // rad/s equivalent
const NITRO_DURATION   = 2.0   // seconds
const NITRO_RECHARGE   = 8.0   // seconds

const isMobileDevice = () => navigator.maxTouchPoints > 0

function ellipsePoint(t) {
  return { x: TRACK_CX + TRACK_RX * Math.cos(t), y: TRACK_CY + TRACK_RY * Math.sin(t) }
}
function ellipseTangent(t) {
  const dx = -TRACK_RX * Math.sin(t), dy = TRACK_RY * Math.cos(t)
  const len = Math.sqrt(dx * dx + dy * dy)
  return { x: dx / len, y: dy / len }
}
function onTrack(x, y) {
  const nx = (x - TRACK_CX) / TRACK_RX
  const ny = (y - TRACK_CY) / TRACK_RY
  const r = Math.sqrt(nx * nx + ny * ny)
  const inner = 1 - TRACK_THICK / (2 * Math.min(TRACK_RX, TRACK_RY))
  const outer = 1 + TRACK_THICK / (2 * Math.min(TRACK_RX, TRACK_RY))
  return r >= inner && r <= outer
}
function getAngleOnEllipse(x, y) {
  return Math.atan2((y - TRACK_CY) / TRACK_RY, (x - TRACK_CX) / TRACK_RX)
}
function createCar(t, color, isPlayer) {
  const p = ellipsePoint(t), d = ellipseTangent(t)
  return {
    x: p.x, y: p.y,
    angle: Math.atan2(d.y, d.x),
    speed: 0, t,
    lap: 0, lastT: t,
    color, isPlayer,
    nitroActive: false,
    nitroTimer: 0,
    nitroCooldown: 0,
  }
}

export default function RacingGame({ paused, onResult }) {
  const canvasRef  = useRef()
  const stateRef   = useRef(null)
  const keysRef    = useRef(new Set())
  const rafRef     = useRef()
  const pausedRef  = useRef(false)
  const mobile     = isMobileDevice()

  // Mobile joystick state
  const joyRef     = useRef({ active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 })
  const accelRef   = useRef(false)
  const brakeRef   = useRef(false)
  const nitroRef   = useRef(false)

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // Mobile touch zones (canvas-logical coords)
    const JOY_CX = 80, JOY_CY = H - 80, JOY_R = 55
    const ACCEL_BTN  = { x: W - 130, y: H - 60, w: 60, h: 46 }
    const BRAKE_BTN  = { x: W - 200, y: H - 60, w: 60, h: 46 }
    const NITRO_BTN  = { x: W - 130, y: H - 120, w: 60, h: 46 }

    function scaleToCanvas(clientX, clientY) {
      const r = canvas.getBoundingClientRect()
      return {
        x: (clientX - r.left) * (W / r.width),
        y: (clientY - r.top)  * (H / r.height),
      }
    }

    function inRect(cx, cy, rect) {
      return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h
    }

    // Multi-touch tracking for buttons
    const btnTouches = new Map()  // touchId → 'accel'|'brake'|'nitro'

    function onTouchStart(e) {
      e.preventDefault()
      for (const t of e.changedTouches) {
        const { x, y } = scaleToCanvas(t.clientX, t.clientY)
        const joy = joyRef.current
        // Joystick
        const distJoy = Math.hypot(x - JOY_CX, y - JOY_CY)
        if (distJoy < JOY_R + 30 && !joy.active) {
          joy.active = true; joy.id = t.identifier
          joy.sx = x; joy.sy = y; joy.dx = 0; joy.dy = 0
          continue
        }
        // Buttons
        if (inRect(x, y, ACCEL_BTN))  { accelRef.current = true;  btnTouches.set(t.identifier, 'accel') }
        if (inRect(x, y, BRAKE_BTN))  { brakeRef.current = true;  btnTouches.set(t.identifier, 'brake') }
        if (inRect(x, y, NITRO_BTN))  { nitroRef.current = true;  btnTouches.set(t.identifier, 'nitro') }
      }
    }
    function onTouchMove(e) {
      e.preventDefault()
      const joy = joyRef.current
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          const { x, y } = scaleToCanvas(t.clientX, t.clientY)
          joy.dx = Math.max(-JOY_R, Math.min(JOY_R, x - joy.sx))
          joy.dy = Math.max(-JOY_R, Math.min(JOY_R, y - joy.sy))
        }
      }
    }
    function onTouchEnd(e) {
      e.preventDefault()
      const joy = joyRef.current
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0
        }
        const btn = btnTouches.get(t.identifier)
        if (btn === 'accel')  accelRef.current = false
        if (btn === 'brake')  brakeRef.current = false
        if (btn === 'nitro')  nitroRef.current = false
        btnTouches.delete(t.identifier)
      }
    }

    const cars = [
      createCar(-Math.PI / 2,        '#7c3aed', true),
      createCar(-Math.PI / 2 + 0.28, '#ef4444', false),
      createCar(-Math.PI / 2 + 0.52, '#22c55e', false),
    ]
    stateRef.current = { cars, phase: 'countdown', countdown: 3, timer: 0, done: false }
    const s = stateRef.current

    const onKeyDown = e => keysRef.current.add(e.code)
    const onKeyUp   = e => keysRef.current.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)

    if (mobile) {
      canvas.addEventListener('touchstart',  onTouchStart,  { passive: false })
      canvas.addEventListener('touchmove',   onTouchMove,   { passive: false })
      canvas.addEventListener('touchend',    onTouchEnd,    { passive: false })
      canvas.addEventListener('touchcancel', onTouchEnd,    { passive: false })
    }

    let last = performance.now()
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!pausedRef.current) {
        if (s.phase === 'countdown') {
          s.timer += dt
          if (s.timer >= 1) { s.timer = 0; s.countdown-- }
          if (s.countdown <= 0) s.phase = 'race'
        } else if (s.phase === 'race' && !s.done) {
          const player = s.cars[0]
          const keys   = keysRef.current
          const joy    = joyRef.current

          // Input resolution (keyboard + mobile)
          const accel  = keys.has('KeyW') || keys.has('ArrowUp')    || accelRef.current
          const brake  = keys.has('KeyS') || keys.has('ArrowDown')   || brakeRef.current
          const nitroPressed = keys.has('ShiftLeft') || keys.has('ShiftRight') || nitroRef.current

          // Steering: keyboard L/R or joystick X axis
          let steerL = keys.has('KeyA') || keys.has('ArrowLeft')
          let steerR = keys.has('KeyD') || keys.has('ArrowRight')
          let steerAmt = 0
          if (joy.active && Math.abs(joy.dx) > 8) steerAmt = joy.dx / JOY_R
          if (steerL) steerAmt -= 1
          if (steerR) steerAmt += 1
          steerAmt = Math.max(-1, Math.min(1, steerAmt))

          // Nitro
          if (!player.nitroActive) {
            player.nitroCooldown = Math.max(0, player.nitroCooldown - dt)
          }
          if (nitroPressed && player.nitroCooldown <= 0 && !player.nitroActive) {
            player.nitroActive = true
            player.nitroTimer  = NITRO_DURATION
          }
          if (player.nitroActive) {
            player.nitroTimer -= dt
            if (player.nitroTimer <= 0) {
              player.nitroActive   = false
              player.nitroCooldown = NITRO_RECHARGE
            }
          }

          const nitroMult   = player.nitroActive ? 2.5 : 1.0
          const maxSpeed    = PLAYER_MAX_SPEED * nitroMult
          const accelRate   = 100 * nitroMult

          if (accel || (joy.active && joy.dy < -10))
            player.speed = Math.min(player.speed + accelRate * dt, maxSpeed)
          else if (brake || (joy.active && joy.dy > 10))
            player.speed = Math.max(player.speed - 130 * dt, -35)
          else
            player.speed += (0 - player.speed) * Math.min(1, dt * 2.2)

          if (steerAmt !== 0)
            player.angle += steerAmt * 2.2 * dt * (player.speed / PLAYER_MAX_SPEED)

          const nx = player.x + Math.cos(player.angle) * player.speed * dt
          const ny = player.y + Math.sin(player.angle) * player.speed * dt
          if (onTrack(nx, ny)) { player.x = nx; player.y = ny }
          else player.speed *= 0.55

          // AI cars follow ellipse
          for (let i = 1; i < s.cars.length; i++) {
            const car = s.cars[i]
            const aiMult = [1.04, 0.95][i - 1]
            car.t += AI_TRACK_SPEED * aiMult * dt
            const p = ellipsePoint(car.t), d = ellipseTangent(car.t)
            car.x = p.x; car.y = p.y
            car.angle = Math.atan2(d.y, d.x)
          }

          // Lap counting
          for (const car of s.cars) {
            const curT = getAngleOnEllipse(car.x, car.y)
            if (car.lastT < -Math.PI * 0.6 && curT > Math.PI * 0.6) car.lap++
            if (car.lastT >  Math.PI * 0.6 && curT < -Math.PI * 0.6) car.lap++
            car.lastT = curT
            if (car.lap >= LAPS_TO_WIN && !s.done) {
              s.done = true; s.winner = car; s.phase = 'result'
              onResult(car.isPlayer)
            }
          }
        }
      }

      // ── DRAW ──────────────────────────────────────────────────────────────
      // Background
      ctx.fillStyle = '#1a0a2e'; ctx.fillRect(0, 0, W, H)

      // Outer track
      ctx.beginPath()
      ctx.ellipse(TRACK_CX, TRACK_CY, TRACK_RX + TRACK_THICK / 2, TRACK_RY + TRACK_THICK / 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#374151'; ctx.fill()

      // Infield grass
      ctx.beginPath()
      ctx.ellipse(TRACK_CX, TRACK_CY, TRACK_RX - TRACK_THICK / 2, TRACK_RY - TRACK_THICK / 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#14532d'; ctx.fill()

      // Track dashes
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([18, 22])
      ctx.beginPath()
      ctx.ellipse(TRACK_CX, TRACK_CY, TRACK_RX, TRACK_RY, 0, 0, Math.PI * 2)
      ctx.stroke(); ctx.setLineDash([])

      // Start/finish line
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3
      ctx.setLineDash([5, 4])
      const sl = ellipsePoint(-Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(sl.x, sl.y - TRACK_THICK / 2 - 4)
      ctx.lineTo(sl.x, sl.y + TRACK_THICK / 2 + 4)
      ctx.stroke(); ctx.setLineDash([])

      // Nitro flame trail (player)
      const player = s.cars[0]
      if (player.nitroActive && s.phase === 'race') {
        const behind = { x: player.x - Math.cos(player.angle) * 20, y: player.y - Math.sin(player.angle) * 20 }
        const grad = ctx.createRadialGradient(behind.x, behind.y, 0, behind.x, behind.y, 18)
        grad.addColorStop(0, 'rgba(250,204,21,0.9)')
        grad.addColorStop(0.4, 'rgba(239,68,68,0.6)')
        grad.addColorStop(1,   'rgba(239,68,68,0)')
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(behind.x, behind.y, 18, 0, Math.PI * 2); ctx.fill()
      }

      // Cars
      for (const car of s.cars) {
        ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle)
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath(); ctx.ellipse(2, 4, 12, 6, 0, 0, Math.PI * 2); ctx.fill()
        // Body
        ctx.fillStyle = car.color
        ctx.beginPath(); ctx.roundRect(-13, -7, 26, 14, 4); ctx.fill()
        // Windshield
        ctx.fillStyle = 'rgba(147,210,255,0.6)'
        ctx.beginPath(); ctx.roundRect(-2, -5, 10, 10, 2); ctx.fill()
        // Wheels
        ctx.fillStyle = '#111'
        ;[[-10, -7], [8, -7], [-10, 7], [8, 7]].forEach(([wx, wy]) => {
          ctx.beginPath(); ctx.ellipse(wx, wy, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill()
        })
        if (car.isPlayer) {
          ctx.fillStyle = '#facc15'
          ctx.beginPath(); ctx.arc(10, 0, 3, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
      }

      // ── Mobile controls ──────────────────────────────────────────────────
      if (mobile) {
        // Joystick base
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.beginPath(); ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2); ctx.stroke()
        // Joystick knob
        const joy = joyRef.current
        const kx  = JOY_CX + joy.dx * 0.6, ky = JOY_CY + joy.dy * 0.6
        ctx.fillStyle = 'rgba(124,58,237,0.85)'
        ctx.beginPath(); ctx.arc(kx, ky, 22, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(kx, ky, 22, 0, Math.PI * 2); ctx.stroke()

        // Accel button
        const player_ = s.cars[0]
        drawBtn(ctx, ACCEL_BTN, '▲', accelRef.current ? '#22c55e' : '#166534', '#86efac')
        drawBtn(ctx, BRAKE_BTN, '▼', brakeRef.current ? '#ef4444' : '#7f1d1d', '#fca5a5')
        // Nitro button
        const nitroCd = player_.nitroCooldown > 0
        const nitroFill = nitroCd ? '#44403c' : (nitroRef.current ? '#facc15' : '#713f12')
        drawBtn(ctx, NITRO_BTN, nitroCd ? `${Math.ceil(player_.nitroCooldown)}s` : '⚡', nitroFill, '#fde68a')
      }

      // ── Lap HUD ─────────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.beginPath(); ctx.roundRect(8, 8, 190, 78, 8); ctx.fill()
      ctx.font = `bold ${mobile ? 14 : 13}px monospace`
      s.cars.forEach((car, i) => {
        const label = car.isPlayer ? '🟣 You' : ['🔴 AI 1', '🟢 AI 2'][i - 1]
        ctx.fillStyle = car.color
        ctx.fillText(`${label}: Lap ${Math.min(car.lap + 1, LAPS_TO_WIN)}/${LAPS_TO_WIN}`, 16, 30 + i * 22)
      })

      // ── Nitro bar (desktop) ──────────────────────────────────────────────
      if (!mobile && s.phase === 'race') {
        const p = s.cars[0]
        const bx = W - 130, by = H - 28, bw = 120, bh = 14
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, 5); ctx.fill()
        const fill = p.nitroActive ? 1 : (1 - p.nitroCooldown / NITRO_RECHARGE)
        ctx.fillStyle = fill < 1 ? '#92400e' : '#facc15'
        ctx.fillRect(bx, by, bw * fill, bh)
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'right'
        ctx.fillText(p.nitroActive ? '⚡ NITRO!' : '⚡ Shift', W - 12, by + bh - 1)
        ctx.textAlign = 'left'
      }

      // ── Countdown ───────────────────────────────────────────────────────
      if (s.phase === 'countdown') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#facc15'; ctx.font = 'bold 80px monospace'; ctx.textAlign = 'center'
        ctx.fillText(s.countdown > 0 ? s.countdown : 'GO!', W / 2, H / 2 + 28)
        ctx.textAlign = 'left'
      }

      // ── Controls hint ────────────────────────────────────────────────────
      if (!mobile && s.phase === 'race') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'
        ctx.fillText('WASD / Arrows to drive  •  Shift = Nitro', W / 2, H - 8)
        ctx.textAlign = 'left'
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
      if (mobile) {
        canvas.removeEventListener('touchstart',  onTouchStart)
        canvas.removeEventListener('touchmove',   onTouchMove)
        canvas.removeEventListener('touchend',    onTouchEnd)
        canvas.removeEventListener('touchcancel', onTouchEnd)
      }
    }
  }, [])   // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={W} height={H}
      className="block w-full h-full object-contain touch-none"
    />
  )
}

function drawBtn(ctx, rect, label, bg, fg) {
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8); ctx.fill()
  ctx.strokeStyle = fg; ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8); ctx.stroke()
  ctx.fillStyle = fg; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6)
  ctx.textAlign = 'left'
}
