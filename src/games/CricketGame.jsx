import { useEffect, useRef } from 'react'
import { useStore } from '@/store'

// Vertical pitch: bowler at top, batsman at bottom, ball travels down toward player.
const W = 360
const H = 500

const HIT_Y      = H - 110          // ideal contact point (batsman's bat)
const PERFECT    = 13               // |ball.y - HIT_Y| windows
const GOOD       = 30
const DECENT     = 52
const EDGE       = 74
const PASS_Y     = HIT_Y + EDGE + 6 // ball considered missed past here
const TOTAL_BALLS = 12              // 2 overs

const LINES = [-70, 0, 70]          // leg / straight / off side x-offsets

export default function CricketGame({ paused, onResult }) {
  const canvasRef  = useRef()
  const pauseRef   = useRef(false)
  const resultSent = useRef(false)
  const avatar     = useStore(s => s.avatar)
  const skinColor  = avatar?.color || '#60a5fa'

  useEffect(() => { pauseRef.current = paused }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const s = {
      ball:       null,     // { x, y, vy, line, type, trail:[] }
      ballNum:    0,        // balls bowled so far
      runs:       0,
      consecMiss: 0,
      sixes:      0,
      consec6:    0,        // consecutive 6-run balls (hat trick)
      firstBoundary: false,
      swung:      false,
      started:    false,
      over:       false,
      outcome:    null,     // { text, color, runs, big }
      outcomeT:   0,
      betweenT:   0,        // delay before next ball
      hit:        null,     // { arc trajectory anim } when ball is hit
    }

    function nextBall() {
      s.ballNum++
      if (s.ballNum > TOTAL_BALLS) { finish(); return }
      const speedBase = 150 + s.ballNum * 11        // px/s, increases each ball
      let type = 'normal', vy = speedBase
      const r = Math.random()
      if (r < 0.18)      { type = 'slow';   vy = speedBase * 0.62 }   // slower ball
      else if (r < 0.34) { type = 'yorker'; vy = speedBase * 1.5 }    // very fast
      s.ball = {
        x: W / 2 + LINES[Math.floor(Math.random() * LINES.length)] * (0.4 + Math.random() * 0.6),
        y: 70, vy, type, line: 0, trail: [],
      }
      s.swung = false
      s.hit   = null
    }

    function registerSwing() {
      if (!s.started) { s.started = true; if (!s.ball && s.betweenT <= 0) nextBall(); return }
      if (s.over || !s.ball || s.swung || s.hit) return
      s.swung = true
      const diff = Math.abs(s.ball.y - HIT_Y)
      let runs = 0, text = '', color = '#fff', big = false
      if (diff <= PERFECT)      { runs = 6; text = 'SIX! 🎉'; color = '#facc15'; big = true }
      else if (diff <= GOOD)    { runs = 4; text = 'FOUR! 🏏'; color = '#4ade80'; big = true }
      else if (diff <= DECENT)  { runs = Math.random() < 0.5 ? 2 : 1; text = `${runs} run${runs>1?'s':''}`; color = '#93c5fd' }
      else if (diff <= EDGE)    { runs = 0; text = 'Edged — no run'; color = '#94a3b8' }
      else                      { runs = -1; text = s.ball.y < HIT_Y ? 'Too early!' : 'Too late!'; color = '#f87171' }

      if (runs >= 0) {
        s.runs += runs
        s.consecMiss = 0
        // boundary visual arc
        s.hit = { t: 0, dur: runs >= 4 ? 0.9 : 0.6, from: { x: s.ball.x, y: s.ball.y }, runs }
        // achievements
        if (runs === 4 && !s.firstBoundary) { s.firstBoundary = true; achv('🏏 First Boundary!') }
        if (runs === 6) {
          s.sixes++
          s.consec6++
          if (s.sixes === 3) achv('💥 Six Machine — 3 sixes!')
          if (s.consec6 === 3) achv('🎩 Cricket Hat Trick — 6s on 3 balls!')
        } else { s.consec6 = 0 }
        bumpCentury(runs)
      } else {
        // miss (strike)
        s.consecMiss++
        s.consec6 = 0
        if (s.consecMiss >= 3) { setOutcome('OUT! 🏏💀', '#ef4444', true); s.over = true; s.ball = null; setTimeout(finish, 1400); return }
      }
      setOutcome(text, color, big)
      // end this ball after a brief beat
      s.ball = null
      s.betweenT = runs >= 4 ? 1.1 : 0.8
    }

    function setOutcome(text, color, big) { s.outcome = { text, color, big }; s.outcomeT = 1.2 }

    function finish() {
      if (resultSent.current) return
      resultSent.current = true
      onResult?.(s.runs)
    }

    // ── achievements (self-contained via window events + localStorage) ──
    function achv(text) {
      window.dispatchEvent(new CustomEvent('achievement', { detail: { text } }))
    }
    function bumpCentury(runs) {
      try {
        const total = (parseInt(localStorage.getItem('cricket_total_runs') || '0', 10) || 0) + runs
        localStorage.setItem('cricket_total_runs', String(total))
        if (total >= 100 && localStorage.getItem('cricket_century') !== 'true') {
          localStorage.setItem('cricket_century', 'true')
          achv('💯 Cricket Century — 100 total runs!')
        }
      } catch {}
    }

    // ── input ──
    const onKey = (e) => {
      if (e.code === 'Space') { e.preventDefault(); registerSwing() }
    }
    const onTap = (e) => { e.preventDefault?.(); registerSwing() }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onTap)

    let last = performance.now()
    let raf

    const loop = (ts) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(ts - last, 50) / 1000
      last = ts

      if (!pauseRef.current && s.started && !s.over) {
        // between-balls delay
        if (!s.ball && s.betweenT > 0) {
          s.betweenT -= dt
          if (s.betweenT <= 0) nextBall()
        }
        // ball travel
        if (s.ball) {
          s.ball.trail.push({ x: s.ball.x, y: s.ball.y })
          if (s.ball.trail.length > 6) s.ball.trail.shift()
          s.ball.y += s.ball.vy * dt
          if (!s.swung && s.ball.y > PASS_Y) {
            // missed by not swinging
            s.consecMiss++
            s.consec6 = 0
            if (s.consecMiss >= 3) { setOutcome('OUT! 🏏💀', '#ef4444', true); s.over = true; s.ball = null; setTimeout(finish, 1400) }
            else { setOutcome('Missed!', '#f87171', false); s.ball = null; s.betweenT = 0.7 }
          }
        }
        // hit arc animation
        if (s.hit) { s.hit.t += dt; if (s.hit.t >= s.hit.dur) s.hit = null }
        if (s.outcomeT > 0) s.outcomeT -= dt
      }
      draw()
    }

    function draw() {
      // Pitch background
      ctx.fillStyle = '#1b6b2e'
      ctx.fillRect(0, 0, W, H)
      // boundary ring
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(W/2, H/2, W/2 - 8, H/2 - 8, 0, 0, Math.PI*2); ctx.stroke()
      // pitch strip
      ctx.fillStyle = '#c2a878'
      ctx.fillRect(W/2 - 34, 50, 68, H - 120)
      // crease lines
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(W/2 - 40, 72);  ctx.lineTo(W/2 + 40, 72);  ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W/2 - 40, HIT_Y + 18); ctx.lineTo(W/2 + 40, HIT_Y + 18); ctx.stroke()

      // hit zone indicator
      const zoneActive = s.ball && Math.abs(s.ball.y - HIT_Y) <= GOOD
      ctx.fillStyle = zoneActive ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.08)'
      ctx.fillRect(W/2 - 40, HIT_Y - GOOD, 80, GOOD * 2)

      // bowler
      ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🎽', W/2, 44)

      // ball trail + ball
      if (s.ball) {
        s.ball.trail.forEach((p, i) => {
          ctx.globalAlpha = (i / s.ball.trail.length) * 0.4
          ctx.fillStyle = '#dc2626'
          ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill()
        })
        ctx.globalAlpha = 1
        ctx.fillStyle = s.ball.type === 'yorker' ? '#ff3b3b' : s.ball.type === 'slow' ? '#fb923c' : '#dc2626'
        ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, 8, 0, Math.PI*2); ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke()
      }

      // hit trajectory arc
      if (s.hit) {
        const p = s.hit.t / s.hit.dur
        const dist = s.hit.runs >= 6 ? 1 : s.hit.runs >= 4 ? 0.8 : 0.4
        const ex = W/2 + (Math.random() < 0.5 ? -1 : 1) * 0 // keep simple
        const tx = W/2 + (s.hit.from.x - W/2) * 3
        const bx = s.hit.from.x + (tx - s.hit.from.x) * p
        const by = s.hit.from.y - Math.sin(p * Math.PI) * 140 * dist - p * 40
        ctx.fillStyle = '#dc2626'
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI*2); ctx.fill()
      }

      // batsman (avatar color)
      ctx.fillStyle = skinColor
      ctx.fillRect(W/2 - 9, HIT_Y - 4, 18, 30)
      ctx.font = '26px serif'
      ctx.fillText('🏏', W/2 + 16, HIT_Y + 6)
      // stumps
      ctx.strokeStyle = s.over ? '#ef4444' : '#f5f5dc'; ctx.lineWidth = 2
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(W/2 + i*5, HIT_Y + 18); ctx.lineTo(W/2 + i*5, HIT_Y + 34); ctx.stroke() }

      // HUD
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Nunito, sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(`Ball ${Math.min(s.ballNum, TOTAL_BALLS)}/${TOTAL_BALLS}`, 12, 12)
      ctx.textAlign = 'right'; ctx.fillStyle = '#facc15'
      ctx.fillText(`${s.runs} runs`, W - 12, 12)
      // misses
      ctx.textAlign = 'left'; ctx.fillStyle = '#f87171'
      ctx.fillText('✗'.repeat(s.consecMiss), 12, 34)

      // outcome banner
      if (s.outcome && s.outcomeT > 0) {
        ctx.globalAlpha = Math.min(1, s.outcomeT * 1.5)
        ctx.fillStyle = s.outcome.color
        ctx.font = `bold ${s.outcome.big ? 34 : 22}px Nunito, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(s.outcome.text, W/2, H/2 - 20)
        ctx.globalAlpha = 1
      }

      // start prompt
      if (!s.started) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Nunito, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('🏏 Cricket', W/2, H/2 - 40)
        ctx.font = '15px Nunito, sans-serif'
        ctx.fillText('Tap / Space to swing the bat', W/2, H/2)
        ctx.fillText('Time it as the ball reaches you!', W/2, H/2 + 26)
        ctx.fillStyle = '#facc15'
        ctx.fillText('Tap to start', W/2, H/2 + 64)
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onTap)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a2e14] select-none">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full object-contain cursor-pointer touch-none" />
    </div>
  )
}
