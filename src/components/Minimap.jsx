import { useRef, useState, useEffect, useCallback } from 'react'
import { minimapState, npcLivePositions } from '@/lib/minimapState'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { gameControls } from '@/lib/gameControls'
import { navState } from '@/lib/navState'
import { getHouseState, onHouseUpdate } from '@/lib/houseService'
import { raceLive } from '@/lib/raceState'
import { MINIMAP_PATH, START as CIRCUIT_START } from '@/lib/raceCircuit'

const SMALL_SCALE = 1.8   // px per world unit on small map
const EX_RANGE   = 70     // world units shown each side in expanded map
const TRACK_MM_WIDTH = 20 // race circuit track width (world units) for minimap stroke

// Named buildings — used for both small and expanded map drawing + click nav
const NAMED_BUILDINGS = [
  // GTA-style spread — must match CityMap positions + playerColliders
  { x:-18, z:-90,  hw:5.2, hd:3.2, c:'#475569', name:'City Hall',    emoji:'🏛️' },
  { x:-22, z:205,  hw:7.2, hd:4.2, c:'#b45309', name:'Mall',         emoji:'🛍️' },
  { x: 18, z: 90,  hw:5.2, hd:3.8, c:'#334155', name:'Cinema',       emoji:'🎬' },
  { x:-120,z: 16,  hw:6.2, hd:4.2, c:'#14532d', name:'Supermarket',  emoji:'🛒' },
  { x:135, z: 16,  hw:4.2, hd:2.8, c:'#78350f', name:'Bank',         emoji:'🏦' },
  { x:100, z: 16,  hw:4.8, hd:3.2, c:'#0c4a6e', name:'Hospital',     emoji:'🏥' },
  { x:120, z:-16,  hw:2.8, hd:2.8, c:'#1e3a8a', name:'Police',       emoji:'👮' },
  { x: 18, z:-200, hw:3.8, hd:2.8, c:'#7f1d1d', name:'Fire Sta.',    emoji:'🚒' },
  { x:-160,z: 16,  hw:4.8, hd:3.2, c:'#92400e', name:'School',       emoji:'🏫' },
  { x:-130,z:-16,  hw:4.2, hd:2.8, c:'#451a03', name:'Library',      emoji:'📚' },
  { x:-18, z:-140, hw:3.2, hd:3.2, c:'#1a2035', name:'Gym',          emoji:'💪' },
  { x: 18, z: 135, hw:3.8, hd:2.8, c:'#7c2d12', name:'Restaurant',   emoji:'🍕' },
  { x: 65, z: 16,  hw:2.8, hd:2.2, c:'#7f1d1d', name:'Gas Station',  emoji:'⛽' },
  { x:-185,z:-18,  hw:3.2, hd:3.8, c:'#713f12', name:'Temple',       emoji:'⛪' },
  { x: 18, z:-75,  hw:2.8, hd:2.2, c:'#7f1d1d', name:'Post Office',  emoji:'📮' },
  { x:-18, z:-190, hw:2.8, hd:2.2, c:'#1e293b', name:'Apartments',   emoji:'🏢' },
  { x:-80, z:-16,  hw:2.2, hd:2.2, c:'#1e293b', name:'Cafe',         emoji:'☕' },
  { x: 80, z:-16,  hw:2.2, hd:2.2, c:'#1e293b', name:'Arcade',       emoji:'🕹️' },
  { x:170, z:-55,  hw:3.2, hd:2.2, c:'#1e293b', name:'Beach Club',   emoji:'🏖️' },
  { x: 18, z:-115, hw:2.2, hd:2.2, c:'#1e293b', name:'Rooftop Bar',  emoji:'🌙' },
  { x: 18, z:-160, hw:2.2, hd:2.2, c:'#1e293b', name:'Music Room',   emoji:'🎵' },
  { x:-18, z: 170, hw:3.8, hd:2.8, c:'#1e293b', name:'Park',         emoji:'🌳' },
  { x:-80, z: 16,  hw:3.2, hd:2.2, c:'#1e293b', name:'Game Zone',    emoji:'🎮' },
  { x: 40, z: 50,  hw:1.8, hd:1.8, c:'#1d4ed8', name:'Blue House',   emoji:'🏠' },
  { x: 55, z: 50,  hw:1.8, hd:1.8, c:'#a16207', name:'Yellow House',  emoji:'🏠' },
  { x:-18, z: 130, hw:2.8, hd:2.2, c:'#22c55e', name:'Playground',   emoji:'🎠' },
  { x:300, z:-300, hw:15,  hd:9,   c:'#0ea5e9', name:'Swimming Pool', emoji:'🏊' },
  { x:-600,z:-600, hw:30,  hd:20,  c:'#475569', name:'Airport',      emoji:'✈️' },
  { x:185, z:0,    hw:30,  hd:70,  c:'#efd9a7', name:'Sunset Shore', emoji:'🌅' },
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

  // ── Pan/zoom view for the expanded map (GTA style) ────────────────────────
  // {x,z} = world coords at canvas centre. Mutated by drag/wheel, read by the
  // RAF draw loop — no React re-render needed per frame.
  const viewRef  = useRef({ x: 0, z: 0, zoom: 1 })
  const dragRef  = useRef(null)        // { sx, sy, vx, vz } while dragging
  const movedRef = useRef(false)       // true if the pointer moved >5px (suppress click)
  // World bounds with padding — covers airport(-600), pool(300,-300), shore(420)
  const clampView = () => {
    const v = viewRef.current
    v.x = Math.max(-680, Math.min(460, v.x))
    v.z = Math.max(-680, Math.min(330, v.z))
    v.zoom = Math.max(0.3, Math.min(3, v.zoom))
  }
  const [navTarget, setNavTarget] = useState(null)    // mirrors navState.target for render
  const [navDist,   setNavDist]   = useState(null)
  const [homeDist,  setHomeDist]  = useState(null)    // distance to own house

  // Sync navState.target + home distance into React state each interval
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
      // Update home distance
      const hs = getHouseState()
      if (hs.ready && hs.position) {
        const hdx = minimapState.playerX - hs.position.x
        const hdz = minimapState.playerZ - hs.position.z
        setHomeDist(Math.round(Math.sqrt(hdx * hdx + hdz * hdz)))
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

      // Race circuit outline (thick track + cyan centre line)
      ctx.strokeStyle = 'rgba(100,116,139,0.9)'
      ctx.lineWidth = 5 * SMALL_SCALE
      ctx.beginPath()
      MINIMAP_PATH.forEach((p, i) => {
        const X = mx(p.x, playerX), Y = my(p.z, playerZ)
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      })
      ctx.closePath(); ctx.stroke()
      ctx.strokeStyle = 'rgba(34,211,238,0.7)'
      ctx.lineWidth = 1
      ctx.stroke()

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

      // Player's house marker (small map)
      const house = getHouseState()
      if (house.ready && house.position) {
        const hx = mx(house.position.x, playerX)
        const hz = my(house.position.z, playerZ)
        const hc = house.status === 'evicted' ? '#ef4444' : house.status !== 'ok' ? '#f97316' : '#fbbf24'
        ctx.fillStyle = hc
        ctx.shadowColor = hc
        ctx.shadowBlur = 6
        ctx.fillRect(hx - 3, hz, 6, 5)
        ctx.beginPath()
        ctx.moveTo(hx - 4, hz)
        ctx.lineTo(hx, hz - 5)
        ctx.lineTo(hx + 4, hz)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
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

      // Active race checkpoint flag
      if (raceLive.nextCheckpoint) {
        const cx = mx(raceLive.nextCheckpoint.x, playerX)
        const cz = my(raceLive.nextCheckpoint.z, playerZ)
        ctx.fillStyle = '#4ade80'
        ctx.shadowColor = '#4ade80'
        ctx.shadowBlur = 7
        ctx.beginPath()
        ctx.arc(cx, cz, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
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

      // Home arrow — if house is outside the minimap view, draw edge arrow
      const homeState = getHouseState()
      if (homeState.ready && homeState.position) {
        const hmx = mx(homeState.position.x, playerX)
        const hmy = my(homeState.position.z, playerZ)
        const hdist = Math.hypot(hmx, hmy)
        const EDGE_R = RADIUS - 9
        if (hdist > RADIUS - 4) {
          // Outside minimap — draw amber arrow at edge
          const angle = Math.atan2(hmy, hmx)
          const ax = HALF + Math.cos(angle) * EDGE_R
          const ay = HALF + Math.sin(angle) * EDGE_R
          ctx.save()
          ctx.translate(ax, ay)
          ctx.rotate(angle + Math.PI / 2)
          ctx.fillStyle = '#fbbf24'
          ctx.shadowColor = '#fbbf24'
          ctx.shadowBlur = 7
          ctx.beginPath()
          ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.lineTo(4, 4)
          ctx.closePath()
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.restore()
        }
      }

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

  // ── Expanded map RAF draw loop — pannable + zoomable (GTA style) ──────────
  useEffect(() => {
    if (!expanded) return
    const canvas = exCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    let rafId

    // Open centred on the player at default zoom
    viewRef.current = { x: minimapState.playerX, z: minimapState.playerZ, zoom: 1 }

    function draw() {
      rafId = requestAnimationFrame(draw)
      const { playerX, playerZ } = minimapState

      // View-aware world→canvas (shadows the module-level ex/ey — every existing
      // draw call below pans/zooms automatically; extra args are ignored).
      const v = viewRef.current
      const SCALE = (Math.min(W, H) / (EX_RANGE * 2)) * v.zoom
      const ex = (wx) => W / 2 + (wx - v.x) * SCALE
      const ey = (wz) => H / 2 - (wz - v.z) * SCALE

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(8,6,18,0.97)'
      ctx.fillRect(0, 0, W, H)

      // Grid lines — covering the visible world window
      ctx.strokeStyle = 'rgba(51,65,85,0.3)'
      ctx.lineWidth = 0.5
      const halfWorldW = W / 2 / SCALE
      const halfWorldH = H / 2 / SCALE
      const gx0 = Math.floor((v.x - halfWorldW) / 20) * 20
      const gz0 = Math.floor((v.z - halfWorldH) / 20) * 20
      for (let i = gx0; i <= v.x + halfWorldW; i += 20) {
        const xi = ex(i)
        ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi, H); ctx.stroke()
      }
      for (let j = gz0; j <= v.z + halfWorldH; j += 20) {
        const yj = ey(j)
        ctx.beginPath(); ctx.moveTo(0, yj); ctx.lineTo(W, yj); ctx.stroke()
      }
      // Roads — the actual network: E-W highway x −290…150, N-S highway z ±250,
      // secondary roads at z=±50 / x=±50 (each ±150 long)
      ctx.fillStyle = 'rgba(51,65,85,0.8)'
      ctx.fillRect(ex(-290), ey(6), 440 * SCALE, 12 * SCALE)            // E-W main
      ctx.fillRect(ex(-6), ey(250), 12 * SCALE, 500 * SCALE)            // N-S main
      ctx.fillStyle = 'rgba(51,65,85,0.6)'
      for (const sz of [-50, 50]) ctx.fillRect(ex(-150), ey(sz + 4), 300 * SCALE, 8 * SCALE)
      for (const sx of [-50, 50]) ctx.fillRect(ex(sx - 4), ey(150), 8 * SCALE, 300 * SCALE)
      // Sunset Shore water hint
      ctx.fillStyle = 'rgba(46,143,184,0.35)'
      ctx.fillRect(ex(212), ey(160), 200 * SCALE, 320 * SCALE)

      // Race circuit outline (thick track + cyan centre line + 🏁 label)
      ctx.strokeStyle = 'rgba(100,116,139,0.95)'
      ctx.lineWidth = Math.max(3, TRACK_MM_WIDTH * SCALE)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      MINIMAP_PATH.forEach((p, i) => {
        const X = ex(p.x, W, SCALE), Y = ey(p.z, H, SCALE)
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      })
      ctx.closePath(); ctx.stroke()
      ctx.strokeStyle = 'rgba(34,211,238,0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = '#fde047'
      ctx.font = 'bold 11px Nunito, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText('🏁 Racing Circuit', ex(CIRCUIT_START.x, W, SCALE), ey(CIRCUIT_START.z, H, SCALE) - 6)

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

      // Player's house marker (expanded map)
      const house = getHouseState()
      if (house.ready && house.position) {
        const hx = ex(house.position.x, W, SCALE)
        const hz = ey(house.position.z, H, SCALE)
        const hc = house.status === 'evicted' ? '#ef4444' : house.status !== 'ok' ? '#f97316' : '#fbbf24'
        ctx.fillStyle = hc
        ctx.shadowColor = hc
        ctx.shadowBlur = 10
        ctx.fillRect(hx - 5, hz, 10, 8)
        ctx.beginPath()
        ctx.moveTo(hx - 7, hz)
        ctx.lineTo(hx, hz - 9)
        ctx.lineTo(hx + 7, hz)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.font = 'bold 10px Nunito, sans-serif'
        ctx.fillStyle = hc
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(`🏠 ${house.number}`, hx, hz + 11)
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

      // Active race checkpoint flag
      if (raceLive.nextCheckpoint) {
        const cx = ex(raceLive.nextCheckpoint.x, W, SCALE)
        const cz = ey(raceLive.nextCheckpoint.z, H, SCALE)
        ctx.fillStyle = '#4ade80'
        ctx.shadowColor = '#4ade80'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(cx, cz, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.font = 'bold 10px Nunito, sans-serif'
        ctx.fillStyle = '#4ade80'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText('🏁 Checkpoint', cx, cz + 8)
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

  // ── Click on expanded canvas → select building (view-aware) ───────────────
  const onExpandedClick = useCallback((e) => {
    if (movedRef.current) return   // it was a drag, not a click
    const canvas = exCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const W = canvas.width
    const H = canvas.height
    const v = viewRef.current
    const SCALE = (Math.min(W, H) / (EX_RANGE * 2)) * v.zoom
    const ex = (wx) => W / 2 + (wx - v.x) * SCALE
    const ey = (wz) => H / 2 - (wz - v.z) * SCALE

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
      return
    }

    // Also check player's own house icon
    const house = getHouseState()
    if (house.ready && house.position) {
      const hx = ex(house.position.x, W, SCALE)
      const hz = ey(house.position.z, H, SCALE)
      if (Math.hypot(cx - hx, cy - hz) < 18) {
        navState.setTarget({ x: house.position.x, z: house.position.z, name: 'My House' })
        setNavTarget({ x: house.position.x, z: house.position.z, name: 'My House' })
        setExpanded(false)
      }
    }
  }, [])

  // ── Layout ────────────────────────────────────────────────────────────────
  const exSize = Math.min(
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.6) : 500,
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.62) : 500,
    600
  )

  const wrapCls = isMobile
    ? 'absolute top-[72px] right-2 z-50 pointer-events-auto font-body'
    : 'absolute bottom-6 right-6 z-50 pointer-events-auto font-body'

  if (!visible && !expanded) {
    return (
      <div className={wrapCls}>
        <div
          onClick={() => setVisible(true)}
          className="rounded-lg py-1 px-2.5 text-slate-600 text-[11px] tracking-[0.08em] cursor-pointer"
          style={{
            background: 'rgba(8,6,18,0.82)',
            border: '1px solid rgba(124,58,237,0.35)',
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
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: '#080612',
              border: '2px solid rgba(124,58,237,0.6)',
              boxShadow: '0 0 40px rgba(124,58,237,0.3)',
            }}
          >
            {/* Title bar */}
            <div
              className="flex justify-between items-center px-[14px] py-2"
              style={{
                background: 'rgba(124,58,237,0.15)',
                borderBottom: '1px solid rgba(124,58,237,0.3)',
              }}
            >
              <span className="text-violet-400 font-bold text-[13px] tracking-[0.12em]">
                CITY MAP
              </span>
              <span className="text-slate-500 text-[11px]">
                {navState.target
                  ? `→ ${navState.target.name}  [Esc to cancel]`
                  : 'Drag to pan · Scroll to zoom · Click to navigate · Esc closes'}
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="bg-transparent border-0 text-slate-400 text-lg cursor-pointer leading-none px-1"
              >×</button>
            </div>

            {/* Canvas — drag to pan, wheel to zoom, click to navigate */}
            <div className="relative">
              <canvas
                ref={exCanvasRef}
                width={exSize}
                height={exSize}
                onClick={onExpandedClick}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  dragRef.current = { sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vz: viewRef.current.z }
                  movedRef.current = false
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current
                  if (!d) return
                  const dx = e.clientX - d.sx
                  const dy = e.clientY - d.sy
                  if (Math.abs(dx) + Math.abs(dy) > 5) movedRef.current = true
                  const canvas = exCanvasRef.current
                  const SCALE = (Math.min(canvas.width, canvas.height) / (EX_RANGE * 2)) * viewRef.current.zoom
                  viewRef.current.x = d.vx - dx / SCALE
                  viewRef.current.z = d.vz + dy / SCALE
                  clampView()
                }}
                onPointerUp={() => { dragRef.current = null; setTimeout(() => { movedRef.current = false }, 0) }}
                onPointerLeave={() => { dragRef.current = null }}
                onWheel={(e) => {
                  viewRef.current.zoom *= e.deltaY < 0 ? 1.15 : 0.87
                  clampView()
                }}
                className="block touch-none"
                style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
              />
              {/* Map controls — zoom + recenter */}
              <div className="absolute bottom-3 left-3 flex flex-col gap-[6px]">
                {[
                  ['+', () => { viewRef.current.zoom *= 1.25; clampView() }],
                  ['−', () => { viewRef.current.zoom *= 0.8; clampView() }],
                  ['⌖', () => { viewRef.current.x = minimapState.playerX; viewRef.current.z = minimapState.playerZ; viewRef.current.zoom = 1 }],
                ].map(([label, fn]) => (
                  <button
                    key={label}
                    onClick={fn}
                    title={label === '⌖' ? 'Recenter on player' : label === '+' ? 'Zoom in' : 'Zoom out'}
                    className="w-8 h-8 rounded-lg text-[15px] font-bold cursor-pointer"
                    style={{
                      background: 'rgba(8,6,18,0.85)',
                      border: '1px solid rgba(124,58,237,0.5)',
                      color: '#a78bfa',
                      lineHeight: 1,
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div
              className="flex gap-4 px-[14px] py-[6px] text-[10px] text-slate-500"
              style={{
                background: 'rgba(0,0,0,0.4)',
                borderTop: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              <span><span className="text-yellow-400">●</span> You</span>
              <span><span style={{ color: '#00e5ff' }}>●</span> Player</span>
              <span><span className="text-slate-400">●</span> NPC</span>
              {navState.target && (
                <span className="ml-auto" style={{ color: '#00e5ff' }}>
                  Navigating to {navState.target.name}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Small map */}
      <div className={wrapCls} data-tutorial="minimap">
        {/* Home distance badge — always visible when house assigned */}
        {homeDist !== null && !navTarget && (
          <div
            className="rounded-lg text-[10px] font-bold text-center mb-1 whitespace-nowrap cursor-pointer"
            style={{
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fbbf24',
              padding: '3px 8px',
              maxWidth: SIZE,
            }}
            onClick={() => {
              const hs = getHouseState()
              if (hs.position) {
                navState.setTarget({ x: hs.position.x, z: hs.position.z, name: 'My House' })
                setNavTarget({ x: hs.position.x, z: hs.position.z, name: 'My House' })
              }
            }}
          >
            🏠 Home · {homeDist}m
          </div>
        )}
        {/* Nav distance badge */}
        {navTarget && navDist !== null && (
          <div
            className="rounded-lg text-[10px] font-bold text-center mb-1 whitespace-nowrap"
            style={{
              background: 'rgba(0,229,255,0.15)',
              border: '1px solid rgba(0,229,255,0.5)',
              color: '#00e5ff',
              padding: '3px 8px',
              maxWidth: SIZE,
            }}
          >
            → {navTarget.name} · {navDist}m
          </div>
        )}

        {/* Clickable minimap circle */}
        <div
          onClick={() => setExpanded(true)}
          title="Click to open full map"
          className="relative cursor-pointer inline-block"
        >
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="block rounded-full transition-[box-shadow] duration-200"
            style={{ boxShadow: '0 0 0 2px rgba(124,58,237,0.55)' }}
          />
          {/* Expand hint overlay — bottom of circle */}
          <div
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold tracking-[0.08em] whitespace-nowrap pointer-events-none rounded-[4px]"
            style={{ background: 'rgba(124,58,237,0.75)', padding: '1px 7px' }}
          >
            ⤢ EXPAND
          </div>
        </div>

        {/* Cancel nav button */}
        {navTarget && (
          <div
            onClick={() => { navState.clearTarget(); setNavTarget(null); setNavDist(null) }}
            className="mt-1 text-center text-slate-500 text-[9px] cursor-pointer tracking-[0.08em]"
          >
            [Esc] cancel nav
          </div>
        )}
      </div>
    </>
  )
}
