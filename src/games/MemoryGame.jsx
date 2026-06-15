// Memory Match 3D — same logic & scoring as the 2D version (4×3 grid, 6 pairs,
// score = 1000 − overMoves×50 − seconds×10, onResult once all matched). Only the
// rendering is now 3D: cards lie on a tilted table and physically flip on click.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { audioSystem } from '@/lib/audioSystem'
import MiniGame3D from './MiniGame3D'

const EMOJIS = ['🎮', '🎯', '🏆', '🎪', '🎨', '🎭']
const COLS = 4, ROWS = 3, SP = 1.95

function makeCards() {
  const pairs = [...EMOJIS, ...EMOJIS]
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs.map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }))
}

// Procedural face/back texture (emoji on a bordered tile)
function makeTex(char, bg, border) {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128)
  g.strokeStyle = border; g.lineWidth = 9; g.strokeRect(7, 7, 114, 114)
  g.font = '74px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(char, 64, 72)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

// ── One 3D card ────────────────────────────────────────────────────────────────
function Card({ card, idx, base, onClick, faceTex, backMat, bodyMat, geo, won, wrongFlash }) {
  const ref = useRef()
  const hovered = useRef(false)
  const lift = useRef(0)
  const pop = useRef(0)
  const wasMatched = useRef(false)
  const faceMat = useMemo(() => new THREE.MeshToonMaterial({ map: faceTex }), [faceTex])
  useEffect(() => () => faceMat.dispose(), [faceMat])

  useFrame((state, delta) => {
    const g = ref.current; if (!g) return
    const dt = Math.min(delta, 0.05), t = state.clock.elapsedTime
    // flip: rotate to π when face-up (flipped or matched)
    const target = (card.flipped || card.matched) ? Math.PI : 0
    g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 10)
    // hover lift
    const wantLift = (hovered.current && !card.matched && !card.flipped) ? 0.35 : 0
    lift.current += (wantLift - lift.current) * Math.min(1, dt * 12)
    // wrong shake + win wave
    const wrong = wrongFlash.includes(idx)
    const jx = wrong ? Math.sin(t * 45) * 0.06 : 0
    const wb = won ? Math.sin(t * 4 - idx * 0.4) * 0.25 : 0
    g.position.set(base[0] + jx, base[1], lift.current + wb)
    // match pop
    if (card.matched && !wasMatched.current) { wasMatched.current = true; pop.current = 1 }
    if (!card.matched) wasMatched.current = false
    if (pop.current > 0) pop.current = Math.max(0, pop.current - dt * 3)
    g.scale.setScalar(1 + pop.current * 0.18)
    // feedback tint on the face
    if (card.matched) { faceMat.emissive.set('#22c55e'); faceMat.emissiveIntensity = 0.35 + Math.sin(t * 4) * 0.2 }
    else if (wrong)   { faceMat.emissive.set('#ef4444'); faceMat.emissiveIntensity = 0.5 }
    else faceMat.emissiveIntensity = 0
  })

  return (
    <group ref={ref} position={[base[0], base[1], 0]}
      onPointerOver={e => { e.stopPropagation(); if (!card.matched) { hovered.current = true; document.body.style.cursor = 'pointer' } }}
      onPointerOut={e => { e.stopPropagation(); hovered.current = false; document.body.style.cursor = 'default' }}
      onClick={e => { e.stopPropagation(); onClick(idx) }}>
      <mesh geometry={geo.card} material={bodyMat} />
      {/* back face (toward camera when face-down) */}
      <mesh geometry={geo.face} material={backMat} position={[0, 0, 0.07]} />
      {/* front face (rotated π so it reads correctly after the card flips) */}
      <mesh geometry={geo.face} material={faceMat} position={[0, 0, -0.07]} rotation={[0, Math.PI, 0]} />
    </group>
  )
}

function MemoryScene({ cards, onCardClick, won, wrongFlash }) {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(0, 0.4, -0.3) }, [camera])

  const backTex = useMemo(() => makeTex('❓', '#1e1b4b', '#7c3aed'), [])
  const faceTexMap = useMemo(() => {
    const m = {}; EMOJIS.forEach(e => { m[e] = makeTex(e, '#0f172a', '#a78bfa') }); return m
  }, [])
  const mats = useMemo(() => ({
    back: new THREE.MeshToonMaterial({ map: backTex }),
    body: new THREE.MeshToonMaterial({ color: '#ece6da' }),
    table: new THREE.MeshToonMaterial({ color: '#2f6b46' }),
    rim: new THREE.MeshToonMaterial({ color: '#5b3a22' }),
  }), [backTex])
  const geo = useMemo(() => ({
    card: new THREE.BoxGeometry(1.6, 1.6, 0.12),
    face: new THREE.PlaneGeometry(1.42, 1.42),
  }), [])
  useEffect(() => () => {
    backTex.dispose(); Object.values(faceTexMap).forEach(t => t.dispose())
    Object.values(mats).forEach(m => m.dispose()); Object.values(geo).forEach(g => g.dispose())
  }, [backTex, faceTexMap, mats, geo])

  return (
    <group rotation={[-0.95, 0, 0]}>
      {/* Table (felt top + wood rim) */}
      <mesh position={[0, 0, -0.22]} material={mats.table}><planeGeometry args={[9, 7]} /></mesh>
      <mesh position={[0, 0, -0.32]} material={mats.rim}><boxGeometry args={[9.6, 7.6, 0.3]} /></mesh>
      {cards.map((c, idx) => {
        const col = idx % COLS, row = (idx / COLS) | 0
        const bx = (col - (COLS - 1) / 2) * SP
        const by = ((ROWS - 1) / 2 - row) * SP
        return (
          <Card key={c.id} card={c} idx={idx} base={[bx, by]} onClick={onCardClick}
            faceTex={faceTexMap[c.emoji]} backMat={mats.back} bodyMat={mats.body} geo={geo}
            won={won} wrongFlash={wrongFlash} />
        )
      })}
    </group>
  )
}

export default function MemoryGame({ paused, onResult }) {
  const [cards,   setCards]   = useState(makeCards)
  const [moves,   setMoves]   = useState(0)
  const [pairs,   setPairs]   = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [won,     setWon]     = useState(false)
  const [wrongFlash, setWrongFlash] = useState([])

  const lockRef    = useRef(false)
  const resultSent = useRef(false)
  const pauseRef   = useRef(false)
  const selRef     = useRef([])
  const movesRef   = useRef(0)
  const elapsedRef = useRef(0)

  useEffect(() => { pauseRef.current = paused }, [paused])

  // Count-up timer (unchanged)
  useEffect(() => {
    const id = setInterval(() => {
      if (pauseRef.current || resultSent.current) return
      elapsedRef.current++
      setElapsed(t => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function endGame() {
    if (resultSent.current) return
    resultSent.current = true
    const score = Math.max(0, 1000 - Math.max(0, movesRef.current - 6) * 50 - elapsedRef.current * 10)
    onResult?.(score)
  }

  const handleClick = useCallback((idx) => {
    if (lockRef.current || resultSent.current || pauseRef.current) return

    setCards(prev => {
      const card = prev[idx]
      if (card.flipped || card.matched) return prev
      if (selRef.current.includes(idx)) return prev

      audioSystem.playClick?.()
      const newCards = prev.map((c, i) => i === idx ? { ...c, flipped: true } : c)

      if (selRef.current.length === 0) {
        selRef.current = [idx]
        return newCards
      }

      const firstIdx = selRef.current[0]
      movesRef.current++
      setMoves(m => m + 1)
      lockRef.current = true
      selRef.current = []

      if (newCards[firstIdx].emoji === newCards[idx].emoji) {
        // Match
        audioSystem.playCoinsEarned?.()
        setTimeout(() => {
          setCards(cc => cc.map((c, i) =>
            (i === firstIdx || i === idx) ? { ...c, matched: true, flipped: true } : c
          ))
          setPairs(p => {
            const np = p + 1
            if (np >= 6) { setWon(true); audioSystem.playLevelUp?.(); setTimeout(endGame, 1300) }
            return np
          })
          lockRef.current = false
        }, 500)
      } else {
        // No match — brief red flash + shake, then flip back
        audioSystem.playError?.()
        setWrongFlash([firstIdx, idx])
        setTimeout(() => {
          setCards(cc => cc.map((c, i) =>
            (i === firstIdx || i === idx) ? { ...c, flipped: false } : c
          ))
          setWrongFlash([])
          lockRef.current = false
        }, 1000)
      }

      return newCards
    })
  }, [])

  return (
    <MiniGame3D
      camera={{ position: [0, 6, 7.6], fov: 50, near: 0.1, far: 100 }}
      background="radial-gradient(circle at 50% 30%, #20305a 0%, #07060f 72%)"
      hud={
        <>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-6 text-[14px] font-bold font-body pointer-events-none">
            <span style={{ color: '#a78bfa' }}>🃏 {pairs}/6 pairs</span>
            <span style={{ color: '#4ade80' }}>⏱ {elapsed}s</span>
            <span style={{ color: '#facc15' }}>🎯 {moves} moves</span>
          </div>
          {won && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none font-body">
              <div className="text-white font-black text-[44px]" style={{ textShadow: '0 4px 24px rgba(74,222,128,0.8)' }}>You Win! 🎉</div>
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-slate-500 text-[12px] font-body pointer-events-none">
            Tap cards to flip · match all 6 pairs · fewer moves = higher score
          </div>
        </>
      }
    >
      <MemoryScene cards={cards} onCardClick={handleClick} won={won} wrongFlash={wrongFlash} />
    </MiniGame3D>
  )
}
