import { useRef, useState, useEffect, useCallback } from 'react'
import { minimapState, npcLivePositions } from '@/lib/minimapState'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { gameControls } from '@/lib/gameControls'
import { navState } from '@/lib/navState'

const SMALL_SCALE = 1.8   // px per world unit on small map
const EX_RANGE   = 70     // world units shown each side in expanded map

// Named buildings — used for both small and expanded map drawing + click nav
const NAMED_BUILDINGS = [
  { x:  0, z:-24,  hw:5.2, hd:3.2, c:'#475569', name:'City Hall',    emoji:'🏛️' },
  { x: 30, z: 46,  hw:7.2, hd:4.2, c:'#b45309', name:'Mall',         emoji:'🛍️' },
  { x: 30, z: 26,  hw:5.2, hd:3.8, c:'#334155', name:'Cinema',       emoji:'🎬' },
  { x:-32, z:-24,  hw:6.2, hd:4.2, c:'#14532d', name:'Supermarket',  emoji:'🛒' },
  { x: 32, z:-42,  hw:4.2, hd:2.8, c:'#78350f', name:'Bank',         emoji:'🏦' },
  { x: 32, z:-24,  hw:4.8, hd:3.2, c:'#0c4a6e', name:'Hospital',     emoji:'🏥' },
  { x: 52, z:-24,  hw:2.8, hd:2.8, c:'#1e3a8a', name:'Police',       emoji:'👮' },
  { x: 52, z:-42,  hw:3.8, hd:2.8, c:'#7f1d1d', name:'Fire Sta.',    emoji:'🚒' },
  { x:-52, z:-42,  hw:4.8, hd:3.2, c:'#92400e', name:'School',       emoji:'🏫' },
  { x:-52, z:-24,  hw:4.2, hd:2.8, c:'#451a03', name:'Library',      emoji:'📚' },
  { x:-50, z: 26,  hw:3.2, hd:3.2, c:'#1a2035', name:'Gym',          emoji:'💪' },
  { x: 50, z: 26,  hw:3.8, hd:2.8, c:'#7c2d12', name:'Restaurant',   emoji:'🍕' },
  { x:-16, z: 22,  hw:2.8, hd:2.2, c:'#7f1d1d', name:'Gas Station',  emoji:'⛽' },
  { x:-30, z: 26,  hw:3.2, hd:3.8, c:'#713f12', name:'Temple',       emoji:'⛪' },
  { x: 16, z: 22,  hw:2.8, hd:2.2, c:'#7f1d1d', name:'Post Office',  emoji:'📮' },
  { x:-30, z: 46,  hw:2.8, hd:2.2, c:'#1e293b', name:'Apartments',   emoji:'🏢' },
  { x:-14, z:-14,  hw:2.2, hd:2.2, c:'#1e293b', name:'Cafe',         emoji:'☕' },
  { x: 14, z:-14,  hw:2.2, hd:2.2, c:'#1e293b', name:'Arcade',       emoji:'🕹️' },
  { x:  0, z:-32,  hw:3.2, hd:2.2, c:'#1e293b', name:'Beach Club',   emoji:'🏖️' },
  { x:-14, z: 14,  hw:2.2, hd:2.2, c:'#1e293b', name:'Rooftop Bar',  emoji:'🌙' },
  { x: 14, z: 14,  hw:2.2, hd:2.2, c:'#1e293b', name:'Music Room',   emoji:'🎵' },
  { x:  0, z: 16,  hw:3.8, hd:2.8, c:'#1e293b', name:'Park',         emoji:'🌳' },
  { x:  0, z:-40,  hw:3.2, hd:2.2, c:'#1e293b', name:'Game Zone',    emoji:'🎮' },
  { x: 40, z: 50,  hw:1.8, hd:1.8, c:'#1d4ed8', name:'Blue House',   emoji:'🏠' },
  { x: 55, z: 50,  hw:1.8, hd:1.8, c:'#a16207', name:'Yellow House',  emoji:'🏠' },
  { x:  0, z: 52,  hw:2.8, hd:2.2, c:'#22c55e', name:'Playground',   emoji:'🎠' },
]

const TREES = [
  [-4,-4],[4,-4],[-4,4],[4,4],[-8,-8],[8,-8],[-8,8],[8,8],[-12,-2],[12,-2],
  [-48,-4.5],[-38,-4.5],[-28,-4.5],[-22,-4.5],[-8,-4.5],[8,-4.5],
  [22,-4.5],[28,-4.5],[38,-4.5],[48,-4.5],
  [-48,4.5],[-38,4.5],[-28,4.5],[-22,4.5],[-8,4.5],[8,4.5],
  [22,4.5],[28,4.5],[38,4.5],[48,4.5],
  [-4.5,-45],[-4.5,-36.5],[-4.5,-24],[-4.5,-14],[-4.5,14],[-4.5,24],[-4.5,36.5],[-4.5,45],
  [22,20],[30,20],[37,20],[50,20],[22,30],[30,30],[37,30],[50,30],
  [22,40],[30,40],[37,40],[50,40],[22,50],[30,50],[37,50],[50,50],
  [-16,24],[-17,24],[-22,24],[-24,24],
  [-8,-20],[8,-20],
]

// Small map helpers
function mx(wx, px) { return (wx - px) * SMALL_SCALE }
function my(wz, pz) { return -(wz - pz) * SMALL_SCALE }

// Expanded map helpers
function ex(wx, canvasW, scale) { return canvasW / 2 + wx * scale }
function ey(wz, canvasH, scale) { return canvasH / 2 - wz * scale }

export default function Minimap({ isMobile = false }) {
  const SIZE   = isMobile ? 120 : 160
  const HALF   = SIZE / 2
  const RADIUS = HALF - 1

  const canvasRef  = useRef()
  const exCanvasRef = useRef()
  const [visible,  setVisible]  = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [navTarget, setNavTarget] = useState(null)    // mirrors navState.target for render
  const [navDist,   setNavDist]   = useState(null)

  // Sync navState.target into React state each interval
  useEffect(() => {
    const id = setInterval(() => {
      const t = navState.target
      setNavTarget(t ? { ...t } : null)
      if (t) {
        const dx = minimapState.playerX - t.x
        const dz = minimapState.playerZ - t.z
        setNavDist(Math.round(Math.sqrt(dx * dx + dz * dz)))
      } else {
        setNavDist(null)
      }
    }, 300)
    return () => clearInterval(id)
  }, [])

  // M key toggles visibility; Escape clears nav or closes expanded
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyM' && gameControls.enabled && !expanded) {
        setVisible(v => !v)
      }
      if (e.code === 'Escape') {
        if (navState.target) {
          navState.clearTarget()
          setNavTarget(null)
          setNavDist(null)
        } else if (expanded) {
          setExpanded(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  // ── Small map RAF draw loop ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible || expanded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function draw() {
      rafId = requestAnimationFrame(draw)
      const { playerX, playerZ, playerFacing, drivingType } = minimapState

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()

      ctx.beginPath()
      ctx.arc(HALF, HALF, RADIUS, 0, Math.PI * 2)
      ctx.clip()

      ctx.fillStyle = 'rgba(8,6,18,0.94)'
      ctx.fillRect(0, 0, SIZE, SIZE)

      ctx.translate(HALF, HALF)
      ctx.rotate(-playerFacing)

      // Roads
      ctx.fillStyle = 'rgba(51,65,85,0.7)'
      ctx.fillRect(-500, my(4.5, playerZ), 1000, 9 * SMALL_SCALE)
      ctx.fillRect(mx(-4.5, playerX), -500, 9 * SMALL_SCALE, 1000)

      // Fountain
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(mx(0, playerX), my(0, playerZ), 3, 0, Math.PI * 2)
      ctx.fill()

      // Trees
      ctx.fillStyle = '#15803d'
      for (const [tx, tz] of TREES) {
        ctx.beginPath()
        ctx.arc(mx(tx, playerX), my(tz, playerZ), 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Buildings
      for (const b of NAMED_BUILDINGS) {
        const bx = mx(b.x, playerX)
        const by = my(b.z, playerZ)
        ctx.fillStyle = b.c
        ctx.fillRect(bx - b.hw * SMALL_SCALE, by - b.hd * SMALL_SCALE, b.hw * 2 * SMALL_SCALE, b.hd * 2 * SMALL_SCALE)
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(bx - b.hw * SMALL_SCALE, by - b.hd * SMALL_SCALE, b.hw * 2 * SMALL_SCALE, b.hd * 2 * SMALL_SCALE)
      }

      // Nav target dot
      const tgt = navState.target
      if (tgt) {
        const tx = mx(tgt.x, playerX)
        const tz = my(tgt.z, playerZ)
        ctx.fillStyle = '#00e5ff'
        ctx.shadowColor = '#00e5ff'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(tx, tz, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // Direction line from center to target
        ctx.strokeStyle = 'rgba(0,229,255,0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(tx, tz)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // NPCs
      for (const npc of npcLivePositions) {
        ctx.fillStyle = npc.color || '#94a3b8'
        ctx.beginPath()
        ctx.arc(mx(npc.x, playerX), my(npc.z, playerZ), 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Remote players
      const rp = remotePlayersRef?.current
      if (rp) {
        rp.forEach((data) => {
          ctx.fillStyle = '#00e5ff'
          ctx.beginPath()
          ctx.arc(mx(data.x ?? 0, playerX), my(data.z ?? 0, playerZ), 3, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      ctx.restore()

      // Player marker
      ctx.save()
      ctx.translate(HALF, HALF)
      if (drivingType) {
        ctx.fillStyle = '#facc15'
        ctx.shadowColor = '#facc15'
        ctx.shadowBlur = 8
        ctx.fillRect(-4, -7, 8, 14)
        ctx.shadowBlur = 0
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(-3, -6, 6, 3)
        ctx.fillRect(-3,  3, 6, 2)
      } else {
        ctx.fillStyle = '#facc15'
        ctx.shadowColor = '#facc15'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(0, -8)
        ctx.lineTo(-5, 6)
        ctx.lineTo(0,  2)
        ctx.lineTo(5,  6)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.restore()

      // Border ring
      ctx.beginPath()
      ctx.arc(HALF, HALF, RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(124,58,237,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [visible, expanded, SIZE])

  // ── Expanded map RAF draw loop ────────────────────────────────────────────
  useEffect(() => {
    if (!expanded) return
    const canvas = exCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const SCALE = Math.min(W, H) / (EX_RANGE * 2)
    let rafId

    function draw() {
      rafId = requestAnimationFrame(draw)
      const { playerX, playerZ } = minimapState

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(8,6,18,0.97)'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = 'rgba(51,65,85,0.3)'
      ctx.lineWidth = 0.5
      for (let i = -EX_RANGE; i <= EX_RANGE; i += 20) {
        const xi = ex(i, W, SCALE)
        const yi = ey(i, H, SCALE)
        ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi, H); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, yi); ctx.lineTo(W, yi); ctx.stroke()
      }

      // Roads (main city roads near origin)
      ctx.fillStyle = 'rgba(51,65,85,0.8)'
      ctx.fillRect(0, ey(4.5, H, SCALE), W, 9 * SCALE)          // E-W
      ctx.fillRect(ex(-4.5, W, SCALE), 0, 9 * SCALE, H)         // N-S

      // Trees
      ctx.fillStyle = '#15803d'
      for (const [tx, tz] of TREES) {
        ctx.beginPath()
        ctx.arc(ex(tx, W, SCALE), ey(tz, H, SCALE), 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Buildings
      for (const b of NAMED_BUILDINGS) {
        const bx = ex(b.x, W, SCALE)
        const by = ey(b.z, H, SCALE)
        const bw = b.hw * 2 * SCALE
        const bh = b.hd * 2 * SCALE
        const isNav = navState.target?.name === b.name
        ctx.fillStyle = b.c
        ctx.shadowColor = isNav ? '#00e5ff' : 'transparent'
        ctx.shadowBlur  = isNav ? 12 : 0
        ctx.fillRect(bx - b.hw * SCALE, by - b.hd * SCALE, bw, bh)
        ctx.shadowBlur = 0
        ctx.strokeStyle = isNav ? '#00e5ff' : 'rgba(255,255,255,0.25)'
        ctx.lineWidth = isNav ? 1.5 : 0.5
        ctx.strokeRect(bx - b.hw * SCALE, by - b.hd * SCALE, bw, bh)
        // Name label
        ctx.font = `bold ${Math.max(8, SCALE * 1.8)}px Nunito, sans-serif`
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.name, bx, by)
      }

      // Nav target line
      const tgt = navState.target
      if (tgt) {
        const px2 = ex(playerX, W, SCALE)
        const pz2 = ey(playerZ, H, SCALE)
        const tx2 = ex(tgt.x, W, SCALE)
        const tz2 = ey(tgt.z, H, SCALE)
        ctx.strokeStyle = 'rgba(0,229,255,0.6)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(px2, pz2)
        ctx.lineTo(tx2, tz2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // NPCs
      for (const npc of npcLivePositions) {
        ctx.fillStyle = npc.color || '#94a3b8'
        ctx.beginPath()
        ctx.arc(ex(npc.x, W, SCALE), ey(npc.z, H, SCALE), 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Remote players
      const rp = remotePlayersRef?.current
      if (rp) {
        rp.forEach((data) => {
          const rx = ex(data.x ?? 0, W, SCALE)
          const rz = ey(data.z ?? 0, H, SCALE)
          ctx.fillStyle = '#00e5ff'
          ctx.shadowColor = '#00e5ff'
          ctx.shadowBlur = 6
          ctx.beginPath()
          ctx.arc(rx, rz, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
          if (data.name) {
            ctx.font = '10px Nunito, sans-serif'
            ctx.fillStyle = '#00e5ff'
            ctx.textAlign = 'center'
            ctx.fillText(data.name, rx, rz - 9)
          }
        })
      }

      // Player marker
      const px2 = ex(playerX, W, SCALE)
      const pz2 = ey(playerZ, H, SCALE)
      ctx.fillStyle = '#facc15'
      ctx.shadowColor = '#facc15'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(px2, pz2, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Compass labels
      ctx.font = 'bold 11px Nunito, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('N', W / 2, 4)
      ctx.textBaseline = 'bottom'
      ctx.fillText('S', W / 2, H - 4)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('W', 4, H / 2)
      ctx.textAlign = 'right'
      ctx.fillText('E', W - 4, H / 2)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [expanded])

  // ── Click on expanded canvas → select building ────────────────────────────
  const onExpandedClick = useCallback((e) => {
    const canvas = exCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const W = canvas.width
    const H = canvas.height
    const SCALE = Math.min(W, H) / (EX_RANGE * 2)

    // Find building that was clicked
    let hit = null
    let bestDist = Infinity
    for (const b of NAMED_BUILDINGS) {
      const bx = ex(b.x, W, SCALE)
      const by = ey(b.z, H, SCALE)
      const bw = b.hw * SCALE
      const bh = b.hd * SCALE
      // padded hit area
      if (cx >= bx - bw - 6 && cx <= bx + bw + 6 && cy >= by - bh - 6 && cy <= by + bh + 6) {
        const dist = Math.hypot(cx - bx, cy - by)
        if (dist < bestDist) { bestDist = dist; hit = b }
      }
    }

    if (hit) {
      navState.setTarget({ x: hit.x, z: hit.z, name: hit.name })
      setNavTarget({ x: hit.x, z: hit.z, name: hit.name })
      setExpanded(false)
    }
  }, [])

  // ── Layout ────────────────────────────────────────────────────────────────
  const exSize = Math.min(
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.6) : 500,
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.62) : 500,
    600
  )

  const wrap = isMobile
    ? { position: 'absolute', top: 72, right: 8, zIndex: 50, pointerEvents: 'auto', fontFamily: 'Nunito, monospace' }
    : { position: 'absolute', bottom: 24, right: 24, zIndex: 50, pointerEvents: 'auto', fontFamily: 'Nunito, monospace' }

  if (!visible && !expanded) {
    return (
      <div style={wrap}>
        <div
          onClick={() => setVisible(true)}
          style={{
            background: 'rgba(8,6,18,0.82)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 8, padding: '4px 10px',
            color: '#475569', fontSize: 11, letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          {isMobile ? 'MAP' : '[M] MAP'}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Expanded map overlay */}
      {expanded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{
            position: 'relative',
            background: '#080612',
            borderRadius: 16,
            border: '2px solid rgba(124,58,237,0.6)',
            boxShadow: '0 0 40px rgba(124,58,237,0.3)',
            padding: 0,
            overflow: 'hidden',
          }}>
            {/* Title bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px',
              background: 'rgba(124,58,237,0.15)',
              borderBottom: '1px solid rgba(124,58,237,0.3)',
            }}>
              <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em' }}>
                CITY MAP
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {navState.target
                  ? `→ ${navState.target.name}  [Esc to cancel]`
                  : 'Click a building to navigate · Esc to close'}
              </span>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
                }}
              >×</button>
            </div>

            {/* Canvas */}
            <canvas
              ref={exCanvasRef}
              width={exSize}
              height={exSize}
              onClick={onExpandedClick}
              style={{ display: 'block', cursor: 'crosshair' }}
            />

            {/* Legend */}
            <div style={{
              display: 'flex', gap: 16, padding: '6px 14px',
              background: 'rgba(0,0,0,0.4)',
              borderTop: '1px solid rgba(124,58,237,0.2)',
              fontSize: 10, color: '#64748b',
            }}>
              <span><span style={{ color: '#facc15' }}>●</span> You</span>
              <span><span style={{ color: '#00e5ff' }}>●</span> Player</span>
              <span><span style={{ color: '#94a3b8' }}>●</span> NPC</span>
              {navState.target && (
                <span style={{ color: '#00e5ff', marginLeft: 'auto' }}>
                  Navigating to {navState.target.name}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Small map */}
      <div style={wrap}>
        {/* Nav distance badge */}
        {navTarget && navDist !== null && (
          <div style={{
            background: 'rgba(0,229,255,0.15)',
            border: '1px solid rgba(0,229,255,0.5)',
            borderRadius: 8, padding: '3px 8px',
            color: '#00e5ff', fontSize: 10, fontWeight: 700,
            textAlign: 'center', marginBottom: 4,
            whiteSpace: 'nowrap', maxWidth: SIZE,
          }}>
            → {navTarget.name} · {navDist}m
          </div>
        )}

        {/* Clickable minimap circle */}
        <div
          onClick={() => setExpanded(true)}
          title="Click to open full map"
          style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
        >
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{
              display: 'block', borderRadius: '50%',
              boxShadow: '0 0 0 2px rgba(124,58,237,0.55)',
              transition: 'box-shadow 0.2s',
            }}
          />
          {/* Expand hint overlay — bottom of circle */}
          <div style={{
            position: 'absolute', bottom: 6, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(124,58,237,0.75)',
            borderRadius: 4, padding: '1px 7px',
            color: '#fff', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            ⤢ EXPAND
          </div>
        </div>

        {/* Cancel nav button */}
        {navTarget && (
          <div
            onClick={() => { navState.clearTarget(); setNavTarget(null); setNavDist(null) }}
            style={{
              marginTop: 4, textAlign: 'center',
              color: '#64748b', fontSize: 9, cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            [Esc] cancel nav
          </div>
        )}
      </div>
    </>
  )
}
