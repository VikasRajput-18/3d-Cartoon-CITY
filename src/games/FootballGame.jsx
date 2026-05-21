import { useRef, useEffect } from 'react'

const W = 600, H = 400
const GOAL_W = 14, GOAL_H = 80
const SCORE_TO_WIN = 3
const isMobileDevice = () => navigator.maxTouchPoints > 0

// Mobile control layout (canvas-logical coords)
const JOY_CX = 75, JOY_CY = H - 80, JOY_R = 52
const KICK_BTN = { x: W - 115, y: H - 120, w: 100, h: 80 }

export default function FootballGame({ paused, onResult }) {
  const canvasRef = useRef()
  const rafRef    = useRef()
  const keysRef   = useRef(new Set())
  const pausedRef = useRef(false)
  const mobile    = isMobileDevice()

  // Mobile joystick + kick button state
  const joyRef  = useRef({ active: false, id: null, dx: 0, dy: 0, sx: 0, sy: 0 })
  const kickRef = useRef({ active: false, id: null })

  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

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

    function onTouchStart(e) {
      e.preventDefault()
      const joy = joyRef.current
      for (const t of e.changedTouches) {
        const { x, y } = scaleToCanvas(t.clientX, t.clientY)
        const distJoy = Math.hypot(x - JOY_CX, y - JOY_CY)
        if (distJoy < JOY_R + 35 && !joy.active) {
          joy.active = true; joy.id = t.identifier
          joy.sx = x; joy.sy = y; joy.dx = 0; joy.dy = 0
        } else if (inRect(x, y, KICK_BTN) && !kickRef.current.active) {
          kickRef.current = { active: true, id: t.identifier }
        }
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
        if (t.identifier === joy.id)  { joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0 }
        if (t.identifier === kickRef.current.id) kickRef.current = { active: false, id: null }
      }
    }

    if (mobile) {
      canvas.addEventListener('touchstart',  onTouchStart,  { passive: false })
      canvas.addEventListener('touchmove',   onTouchMove,   { passive: false })
      canvas.addEventListener('touchend',    onTouchEnd,    { passive: false })
      canvas.addEventListener('touchcancel', onTouchEnd,    { passive: false })
    }

    function resetPositions() {
      return {
        player: { x: 160, y: H / 2, vx: 0, vy: 0, r: 14, color: '#7c3aed' },
        ai:     { x: W - 160, y: H / 2, vx: 0, vy: 0, r: 14, color: '#ef4444' },
        ball:   { x: W / 2, y: H / 2, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 130, r: 10 },
      }
    }

    const init = resetPositions()
    const s = {
      ...init,
      score: [0, 0],
      phase: 'race',
      kickCooldown: 0,
      goalFlash: 0,
      goalScorer: null,
    }

    const onKeyDown = e => keysRef.current.add(e.code)
    const onKeyUp   = e => keysRef.current.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)

    function applyKick(kicker, ball) {
      const dx = ball.x - kicker.x, dy = ball.y - kicker.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < kicker.r + ball.r + 20) {
        const nx = dx / (dist || 1), ny = dy / (dist || 1)
        ball.vx = nx * 400 + kicker.vx * 0.5
        ball.vy = ny * 400 + kicker.vy * 0.5
        return true
      }
      return false
    }

    let last = performance.now()
    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (!pausedRef.current && s.phase === 'race') {
        const keys = keysRef.current
        const joy  = joyRef.current

        // Player movement
        const spd = 185
        let tvx = 0, tvy = 0
        if (keys.has('KeyD') || keys.has('ArrowRight')) tvx =  spd
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  tvx = -spd
        if (keys.has('KeyS') || keys.has('ArrowDown'))  tvy =  spd
        if (keys.has('KeyW') || keys.has('ArrowUp'))    tvy = -spd
        if (mobile && joy.active) {
          const mag = Math.hypot(joy.dx, joy.dy)
          if (mag > 8) { tvx = (joy.dx / JOY_R) * spd; tvy = (joy.dy / JOY_R) * spd }
        }
        s.player.vx += (tvx - s.player.vx) * Math.min(1, dt * 10)
        s.player.vy += (tvy - s.player.vy) * Math.min(1, dt * 10)
        s.player.x   = Math.max(s.player.r, Math.min(W - s.player.r, s.player.x + s.player.vx * dt))
        s.player.y   = Math.max(s.player.r + 30, Math.min(H - s.player.r - 20, s.player.y + s.player.vy * dt))

        // Kick
        s.kickCooldown = Math.max(0, s.kickCooldown - dt)
        const wantsKick = keys.has('Space') || keys.has('KeyF') || kickRef.current.active
        if (wantsKick && s.kickCooldown <= 0) {
          if (applyKick(s.player, s.ball)) s.kickCooldown = 0.35
        }

        // AI: chase ball and try to kick
        const adx = s.ball.x - s.ai.x, ady = s.ball.y - s.ai.y
        const adist = Math.sqrt(adx * adx + ady * ady)
        const aspd = 125
        if (adist > 1) { s.ai.vx = (adx / adist) * aspd; s.ai.vy = (ady / adist) * aspd }
        s.ai.x = Math.max(s.ai.r, Math.min(W - s.ai.r, s.ai.x + s.ai.vx * dt))
        s.ai.y = Math.max(s.ai.r + 30, Math.min(H - s.ai.r - 20, s.ai.y + s.ai.vy * dt))
        applyKick(s.ai, s.ball)

        // Ball physics
        s.ball.vx *= 0.985; s.ball.vy *= 0.985
        s.ball.x  += s.ball.vx * dt
        s.ball.y  += s.ball.vy * dt

        // Wall bounce
        if (s.ball.x < s.ball.r) { s.ball.x = s.ball.r; s.ball.vx = Math.abs(s.ball.vx) * 0.72 }
        if (s.ball.x > W - s.ball.r) { s.ball.x = W - s.ball.r; s.ball.vx = -Math.abs(s.ball.vx) * 0.72 }
        if (s.ball.y < 30 + s.ball.r) { s.ball.y = 30 + s.ball.r; s.ball.vy = Math.abs(s.ball.vy) * 0.72 }
        if (s.ball.y > H - 20 - s.ball.r) { s.ball.y = H - 20 - s.ball.r; s.ball.vy = -Math.abs(s.ball.vy) * 0.72 }

        // Ball-player push
        for (const p of [s.player, s.ai]) {
          const dx = s.ball.x - p.x, dy = s.ball.y - p.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const minD = p.r + s.ball.r
          if (d < minD && d > 0.01) {
            s.ball.x += (dx / d) * (minD - d)
            s.ball.y += (dy / d) * (minD - d)
          }
        }

        // Goal detection
        const goalY1 = H / 2 - GOAL_H / 2, goalY2 = H / 2 + GOAL_H / 2
        if (s.ball.y > goalY1 && s.ball.y < goalY2) {
          if (s.ball.x < GOAL_W + s.ball.r) {
            s.score[1]++; s.goalFlash = 1.5; s.goalScorer = 'ai'
            if (s.score[1] >= SCORE_TO_WIN) { s.phase = 'done'; onResult(false) }
            else { const r = resetPositions(); s.player = r.player; s.ai = r.ai; s.ball = r.ball }
          } else if (s.ball.x > W - GOAL_W - s.ball.r) {
            s.score[0]++; s.goalFlash = 1.5; s.goalScorer = 'player'
            if (s.score[0] >= SCORE_TO_WIN) { s.phase = 'done'; onResult(true) }
            else { const r = resetPositions(); s.player = r.player; s.ai = r.ai; s.ball = r.ball }
          }
        }

        s.goalFlash = Math.max(0, s.goalFlash - dt)
      }

      // ── DRAW ──────────────────────────────────────────────────────────────
      // Pitch
      const pitchGrad = ctx.createLinearGradient(0, 30, 0, H - 20)
      pitchGrad.addColorStop(0, '#16a34a')
      pitchGrad.addColorStop(0.5, '#15803d')
      pitchGrad.addColorStop(1, '#166534')
      ctx.fillStyle = pitchGrad
      ctx.fillRect(0, 30, W, H - 50)

      // Stripes
      ctx.fillStyle = 'rgba(0,0,0,0.05)'
      for (let i = 0; i < 6; i++) ctx.fillRect(i * 100, 30, 50, H - 50)

      // Lines
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 52, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W / 2, 30); ctx.lineTo(W / 2, H - 20); ctx.stroke()
      ctx.strokeRect(0, 30, W, H - 50)

      // Penalty boxes
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.strokeRect(0, H / 2 - 55, 80, 110)
      ctx.strokeRect(W - 80, H / 2 - 55, 80, 110)

      // Goals
      const gy = H / 2 - GOAL_H / 2
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(0, gy, GOAL_W, GOAL_H)
      ctx.fillRect(W - GOAL_W, gy, GOAL_W, GOAL_H)
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2
      ctx.strokeRect(0, gy, GOAL_W, GOAL_H)
      ctx.strokeRect(W - GOAL_W, gy, GOAL_W, GOAL_H)
      // Nets (lines)
      ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(0, gy + i * 16); ctx.lineTo(GOAL_W, gy + i * 16); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(W - GOAL_W, gy + i * 16); ctx.lineTo(W, gy + i * 16); ctx.stroke()
      }

      // Players
      for (const p of [s.player, s.ai]) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r + 2, p.r * 0.85, 5, 0, 0, Math.PI * 2); ctx.fill()
        // Body
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, p.r * 0.4, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke()
        // Label
        const label = p === s.player ? 'YOU' : 'AI'
        ctx.fillStyle = p === s.player ? '#facc15' : '#fca5a5'
        ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(label, p.x, p.y + p.r + 14)
      }

      // Kick range indicator (when near ball)
      const bdx = s.ball.x - s.player.x, bdy = s.ball.y - s.player.y
      const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
      if (bdist < s.player.r + s.ball.r + 22) {
        ctx.strokeStyle = 'rgba(250,204,21,0.5)'; ctx.lineWidth = 1.5
        ctx.setLineDash([3, 4])
        ctx.beginPath(); ctx.arc(s.player.x, s.player.y, s.player.r + s.ball.r + 22, 0, Math.PI * 2); ctx.stroke()
        ctx.setLineDash([])
      }

      // Ball
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5; ctx.stroke()
      // Pentagon marks
      ctx.fillStyle = '#111'
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r * 0.36, 0, Math.PI * 2); ctx.fill()

      // Mobile controls
      if (mobile) {
        // Joystick base
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.beginPath(); ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2); ctx.stroke()
        // Joystick knob
        const joy = joyRef.current
        const kx = JOY_CX + joy.dx * 0.65, ky = JOY_CY + joy.dy * 0.65
        ctx.fillStyle = 'rgba(124,58,237,0.8)'
        ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI * 2); ctx.stroke()

        // Kick button
        const kicking = kickRef.current.active
        ctx.fillStyle = kicking ? 'rgba(250,204,21,0.85)' : 'rgba(239,68,68,0.75)'
        ctx.beginPath(); ctx.roundRect(KICK_BTN.x, KICK_BTN.y, KICK_BTN.w, KICK_BTN.h, 12); ctx.fill()
        ctx.strokeStyle = kicking ? '#fde68a' : '#fca5a5'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.roundRect(KICK_BTN.x, KICK_BTN.y, KICK_BTN.w, KICK_BTN.h, 12); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'
        ctx.fillText('⚽', KICK_BTN.x + KICK_BTN.w / 2, KICK_BTN.y + KICK_BTN.h / 2 - 4)
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText('KICK', KICK_BTN.x + KICK_BTN.w / 2, KICK_BTN.y + KICK_BTN.h - 10)
      }

      // Goal flash
      if (s.goalFlash > 0) {
        const fa = s.goalFlash / 1.5
        const col = s.goalScorer === 'player' ? `rgba(34,197,94,${fa * 0.4})` : `rgba(239,68,68,${fa * 0.4})`
        ctx.fillStyle = col; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = s.goalScorer === 'player' ? '#22c55e' : '#ef4444'
        ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'
        ctx.fillText(s.goalScorer === 'player' ? 'GOAL! ⚽' : 'AI SCORES!', W / 2, H / 2)
      }

      // HUD top bar
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, 30)
      ctx.fillStyle = '#7c3aed'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'
      ctx.fillText(`${s.score[0]}`, W / 2 - 56, 20)
      ctx.fillStyle = '#fff'; ctx.font = '14px monospace'
      ctx.fillText('—', W / 2, 20)
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 18px monospace'
      ctx.fillText(`${s.score[1]}`, W / 2 + 56, 20)
      ctx.fillStyle = '#94a3b8'; ctx.font = '10px monospace'
      ctx.fillText(mobile ? 'Move joystick · KICK button' : 'WASD move  ·  Space / F = kick', W / 2, 11)
      ctx.textAlign = 'left'

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
  }, [])  // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={W} height={H}
      style={{
        display: 'block', width: '100%', height: '100%',
        objectFit: 'contain', touchAction: 'none',
      }}
    />
  )
}
