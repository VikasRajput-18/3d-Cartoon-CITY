import { useRef, useState, useEffect } from 'react'
import { minimapState, npcLivePositions } from '@/lib/minimapState'
import { gameControls } from '@/lib/gameControls'

const SCALE  = 1.8   // pixels per world unit

// Buildings: world center (x,z), half-extents (hw,hd), fill color
const BUILDINGS = [
  { x:0,   z:-22,  hw:5.2, hd:3.2, c:'#475569' },  // City Hall
  { x:-16, z:-28,  hw:7.2, hd:4.2, c:'#9d174d' },  // Mall
  { x:16,  z:-28,  hw:5.2, hd:3.7, c:'#5b21b6' },  // Cinema
  { x:-28, z:-18,  hw:5.2, hd:3.2, c:'#14532d' },  // Supermarket
  { x:28,  z:-18,  hw:3.7, hd:2.7, c:'#78350f' },  // Bank
  { x:34,  z:-5,   hw:3.7, hd:3.2, c:'#0c4a6e' },  // Hospital
  { x:34,  z:10,   hw:2.7, hd:2.7, c:'#1e3a8a' },  // Police
  { x:34,  z:22,   hw:3.7, hd:2.7, c:'#7f1d1d' },  // Fire Station
  { x:-34, z:-5,   hw:4.7, hd:3.2, c:'#92400e' },  // School
  { x:-34, z:-20,  hw:3.7, hd:2.7, c:'#451a03' },  // Library
  { x:-34, z:10,   hw:3.2, hd:2.7, c:'#3b0764' },  // Gym
  { x:12,  z:28,   hw:2.7, hd:2.2, c:'#7c2d12' },  // Restaurant
  { x:-12, z:26.5, hw:2.2, hd:1.7, c:'#7f1d1d' },  // Gas Station
  { x:-25, z:18,   hw:3.2, hd:3.7, c:'#713f12' },  // Church
  { x:12,  z:18,   hw:2.7, hd:2.2, c:'#7f1d1d' },  // Post Office
  { x:-26, z:30,   hw:2.7, hd:2.2, c:'#1e293b' },  // Apartments
  // Generic blocks
  { x:-10, z:-6,   hw:2.7, hd:2.2, c:'#1e293b' },
  { x:10,  z:-6,   hw:2.7, hd:2.2, c:'#1e293b' },
  { x:0,   z:-14,  hw:4.2, hd:2.2, c:'#1e293b' },
  { x:-14, z:4,    hw:2.2, hd:2.2, c:'#1e293b' },
  { x:14,  z:4,    hw:2.2, hd:2.7, c:'#1e293b' },
  { x:0,   z:14,   hw:3.7, hd:2.7, c:'#1e293b' },
  // Houses
  { x:26,  z:24,   hw:1.7, hd:1.7, c:'#1d4ed8' },
  { x:36,  z:24,   hw:1.7, hd:1.7, c:'#a16207' },
  { x:26,  z:34,   hw:1.7, hd:1.7, c:'#374151' },
  { x:36,  z:34,   hw:1.7, hd:1.7, c:'#374151' },
  { x:46,  z:24,   hw:1.7, hd:1.7, c:'#374151' },
  { x:46,  z:34,   hw:1.7, hd:1.7, c:'#374151' },
  { x:26,  z:44,   hw:1.7, hd:1.7, c:'#374151' },
  { x:36,  z:44,   hw:1.7, hd:1.7, c:'#374151' },
]

// Tree positions [x, z] (world space) — kept in sync with CityMap TREE_DATA
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

// Transform world (wx,wz) to minimap canvas coords relative to player
function mx(wx, px) { return (wx - px) * SCALE }
function my(wz, pz) { return -(wz - pz) * SCALE }

export default function Minimap({ isMobile = false }) {
  const SIZE   = isMobile ? 120 : 160
  const HALF   = SIZE / 2
  const RADIUS = HALF - 1

  const canvasRef = useRef()
  const [visible, setVisible] = useState(true)

  // M key toggles visibility (desktop only)
  useEffect(() => {
    if (isMobile) return
    const onKey = (e) => {
      if (e.code === 'KeyM' && gameControls.enabled) setVisible(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile])

  // RAF draw loop — restarts whenever visible flips to true
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId

    function draw() {
      rafId = requestAnimationFrame(draw)
      const { playerX, playerZ, playerFacing, drivingType } = minimapState

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()

      // ── Circular clip ──────────────────────────────────────────────────
      ctx.beginPath()
      ctx.arc(HALF, HALF, RADIUS, 0, Math.PI * 2)
      ctx.clip()

      // Background
      ctx.fillStyle = 'rgba(8,6,18,0.94)'
      ctx.fillRect(0, 0, SIZE, SIZE)

      // ── Rotated world layer ────────────────────────────────────────────
      ctx.translate(HALF, HALF)
      ctx.rotate(-playerFacing)

      // Roads (static world geometry)
      ctx.fillStyle = 'rgba(51,65,85,0.7)'
      // E-W road (world z ≈ 0, width ±4.5)
      ctx.fillRect(-500, my(4.5, playerZ), 1000, 9 * SCALE)
      // N-S road (world x ≈ 0, width ±4.5)
      ctx.fillRect(mx(-4.5, playerX), -500, 9 * SCALE, 1000)

      // Fountain (blue dot at world 0,0)
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
      for (const b of BUILDINGS) {
        const bx = mx(b.x, playerX)
        const by = my(b.z, playerZ)
        const bw = b.hw * 2 * SCALE
        const bh = b.hd * 2 * SCALE
        ctx.fillStyle = b.c
        ctx.fillRect(bx - b.hw * SCALE, by - b.hd * SCALE, bw, bh)
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(bx - b.hw * SCALE, by - b.hd * SCALE, bw, bh)
      }

      // NPCs
      for (const npc of npcLivePositions) {
        const nx = mx(npc.x, playerX)
        const ny = my(npc.z, playerZ)
        ctx.fillStyle = npc.color || '#94a3b8'
        ctx.beginPath()
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      ctx.restore()  // end rotated layer

      // ── Player marker — always at center, never rotated ────────────────
      ctx.save()
      ctx.translate(HALF, HALF)
      if (drivingType) {
        // Small car rectangle with windshield
        ctx.fillStyle = '#facc15'
        ctx.shadowColor = '#facc15'
        ctx.shadowBlur = 8
        ctx.fillRect(-4, -7, 8, 14)
        ctx.shadowBlur = 0
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(-3, -6, 6, 3)   // windshield
        ctx.fillRect(-3,  3, 6, 2)   // rear window
      } else {
        // Arrow pointing up (= facing direction)
        ctx.fillStyle = '#facc15'
        ctx.shadowColor = '#facc15'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(0,  -8)   // tip
        ctx.lineTo(-5,  6)
        ctx.lineTo(0,   2)   // notch
        ctx.lineTo(5,   6)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.restore()

      // ── Border ring ────────────────────────────────────────────────────
      ctx.beginPath()
      ctx.arc(HALF, HALF, RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(124,58,237,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [visible, SIZE])

  const wrap = isMobile
    ? { position: 'absolute', top: 72, right: 8, zIndex: 50, pointerEvents: 'auto', fontFamily: 'monospace' }
    : { position: 'absolute', bottom: 24, right: 24, zIndex: 50, pointerEvents: 'none', fontFamily: 'monospace' }

  if (!visible) {
    return (
      <div style={wrap} onClick={isMobile ? () => setVisible(true) : undefined}>
        <div style={{
          background: 'rgba(8,6,18,0.82)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 8, padding: '4px 10px',
          color: '#475569', fontSize: 11, letterSpacing: '0.08em',
        }}>
          {isMobile ? 'MAP' : '[M] MAP'}
        </div>
      </div>
    )
  }

  return (
    <div style={wrap} onClick={isMobile ? () => setVisible(false) : undefined}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 4px', marginBottom: 4,
      }}>
        <span style={{ color: '#7c3aed', fontSize: isMobile ? 9 : 10, fontWeight: 700, letterSpacing: '0.15em' }}>MAP</span>
        {!isMobile && <span style={{ color: '#334155', fontSize: 9 }}>[M] hide</span>}
      </div>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ display: 'block', borderRadius: '50%' }}
      />
    </div>
  )
}
