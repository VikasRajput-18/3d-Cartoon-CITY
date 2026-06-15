// Hangman 3D — guess the hidden word before the figure is complete (6 wrong = out).
// Contract matches the other Game Zone games: { paused, onResult } → onResult(score)
// once. Score = 500 + remainingLives×100 + wordLen×20 − seconds×5 (0 on a loss).
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { audioSystem } from '@/lib/audioSystem'
import MiniGame3D from './MiniGame3D'

const MAX_WRONG = 6
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Indian + global word bank by category
const WORD_BANK = [
  ['Animal',  ['TIGER', 'ELEPHANT', 'DOLPHIN', 'PENGUIN', 'GIRAFFE', 'PEACOCK', 'MONKEY']],
  ['Country',  ['INDIA', 'BRAZIL', 'JAPAN', 'FRANCE', 'EGYPT', 'CANADA', 'NEPAL']],
  ['Food',     ['PIZZA', 'BURGER', 'SAMOSA', 'BIRYANI', 'NOODLES', 'PANEER', 'DOSA']],
  ['Movies',   ['SHOLAY', 'DANGAL', 'KRRISH', 'BAHUBALI', 'KGF']],
  ['Cricket',  ['BATSMAN', 'BOWLER', 'WICKET', 'BOUNDARY', 'STADIUM', 'CAPTAIN']],
  ['City',     ['COMPANION', 'MYSTERY', 'FOUNTAIN', 'ARCADE', 'SCOOTER', 'MARKET']],
]
function pickWord() {
  const [category, list] = WORD_BANK[(Math.random() * WORD_BANK.length) | 0]
  return { category, word: list[(Math.random() * list.length) | 0] }
}
const calcScore = (wrong, len, secs) => Math.max(0, 500 + (MAX_WRONG - wrong) * 100 + len * 20 - secs * 5)

// ── drop-in wrapper for each hangman body part ───────────────────────────────
function Part({ pos, children }) {
  const ref = useRef()
  const t = useRef(0)
  useFrame((_, d) => {
    const g = ref.current; if (!g) return
    if (t.current < 1) {
      t.current = Math.min(1, t.current + d * 3.2)
      const e = 1 - (1 - t.current) ** 2
      g.position.set(pos[0], pos[1] + (1 - e) * 1.6, pos[2])
      g.scale.setScalar(e)
    }
  })
  return <group ref={ref} position={[pos[0], pos[1] + 1.6, pos[2]]} scale={0.001}>{children}</group>
}

// ── one word tile ─────────────────────────────────────────────────────────────
function Tile({ char, revealed, missed, x, mats }) {
  const popRef = useRef()
  const t = useRef(0)
  const wasRevealed = useRef(false)
  useFrame((_, d) => {
    if (revealed && !wasRevealed.current) { wasRevealed.current = true; t.current = 0 }
    if (!revealed) wasRevealed.current = false
    const g = popRef.current; if (!g) return
    if (revealed && t.current < 1) { t.current = Math.min(1, t.current + d * 4); g.scale.setScalar(0.4 + t.current * 0.6) }
    else if (!revealed) g.scale.setScalar(1)
  })
  return (
    <group position={[x, 0.7, 2.4]}>
      <mesh material={revealed ? (missed ? mats.tileMiss : mats.tileGood) : mats.tileBlank}>
        <boxGeometry args={[0.72, 0.92, 0.12]} />
      </mesh>
      <mesh position={[0, -0.52, 0.05]} material={mats.underline}><boxGeometry args={[0.64, 0.08, 0.04]} /></mesh>
      {revealed && (
        <group ref={popRef} position={[0, 0, 0.1]}>
          <Text fontSize={0.52} color={missed ? '#fca5a5' : '#86efac'} anchorX="center" anchorY="middle"
            outlineWidth={0.02} outlineColor="#04060c">{char}</Text>
        </group>
      )}
    </group>
  )
}

// ── win confetti (one instanced mesh) ────────────────────────────────────────
function Confetti({ active }) {
  const N = 40
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => new THREE.BoxGeometry(0.16, 0.16, 0.02), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: false, color: '#fff' }), [])
  const parts = useMemo(() => Array.from({ length: N }, () => ({
    x: (Math.random() - 0.5) * 8, y: 6 + Math.random() * 3, z: 1 + Math.random() * 3,
    vy: -(1.5 + Math.random() * 2), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
    c: new THREE.Color(['#f472b6', '#facc15', '#22d3ee', '#a3e635', '#fb923c'][(Math.random() * 5) | 0]),
  })), [])
  useEffect(() => {
    const m = mesh.current; if (!m) return
    parts.forEach((p, i) => m.setColorAt(i, p.c))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [parts])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame((_, d) => {
    const m = mesh.current; if (!m) return
    m.visible = active
    if (!active) return
    parts.forEach((p, i) => {
      p.y += p.vy * d; p.rot += p.vr * d
      if (p.y < 0) p.y = 6 + Math.random() * 2
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rot, p.rot * 0.7, 0)
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, N]} visible={false} frustumCulled={false} />
}

function HangmanScene({ word, guessed, wrong, status }) {
  const { camera } = useThree()
  useEffect(() => { camera.lookAt(-0.5, 2.4, 0) }, [camera])

  const mats = useMemo(() => ({
    wood: new THREE.MeshToonMaterial({ color: '#8a5a2b' }),
    woodDark: new THREE.MeshToonMaterial({ color: '#6b4420' }),
    rope: new THREE.MeshToonMaterial({ color: '#d8c08a' }),
    fig: new THREE.MeshToonMaterial({ color: status === 'lost' ? '#94a3b8' : '#f4c08a' }),
    figBody: new THREE.MeshToonMaterial({ color: status === 'lost' ? '#475569' : '#3b82f6' }),
    ground: new THREE.MeshToonMaterial({ color: '#2f6b46' }),
    tileBlank: new THREE.MeshToonMaterial({ color: '#1f2433' }),
    tileGood: new THREE.MeshToonMaterial({ color: '#15402e' }),
    tileMiss: new THREE.MeshToonMaterial({ color: '#5b1d1d' }),
    underline: new THREE.MeshBasicMaterial({ color: '#a78bfa' }),
  }), [status])
  useEffect(() => () => Object.values(mats).forEach(m => m.dispose()), [mats])

  // word tile layout (centred, scales spacing to length)
  const letters = word.split('')
  const sp = Math.min(0.92, 6.8 / letters.length)
  const startX = 1 - (letters.length * sp) / 2 + sp / 2

  // figure parts at the rope point (gallows group local x≈1.6)
  const FX = 1.6
  const won = status === 'won'

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mats.ground}><planeGeometry args={[26, 22]} /></mesh>

      {/* Gallows */}
      <group position={[-5, 0, -1]}>
        <mesh position={[0.4, 0.18, 0]} material={mats.woodDark}><boxGeometry args={[3.2, 0.36, 1.1]} /></mesh>
        <mesh position={[-0.8, 3.1, 0]} material={mats.wood}><boxGeometry args={[0.34, 6.2, 0.34]} /></mesh>
        <mesh position={[0.45, 6.05, 0]} material={mats.wood}><boxGeometry args={[2.8, 0.34, 0.34]} /></mesh>
        <mesh position={[-0.35, 5.45, 0]} rotation={[0, 0, Math.PI / 4]} material={mats.woodDark}><boxGeometry args={[0.9, 0.2, 0.2]} /></mesh>
        <mesh position={[FX, 5.6, 0]} material={mats.rope}><cylinderGeometry args={[0.05, 0.05, 0.85, 6]} /></mesh>

        {/* Figure builds with wrong guesses */}
        {wrong >= 1 && <Part pos={[FX, 4.8, 0]}><mesh material={mats.fig}><sphereGeometry args={[0.36, 16, 16]} /></mesh></Part>}
        {wrong >= 2 && <Part pos={[FX, 3.85, 0]}><mesh material={mats.figBody}><capsuleGeometry args={[0.22, 0.9, 4, 8]} /></mesh></Part>}
        {wrong >= 3 && <Part pos={[FX - 0.05, 4.05, 0]}><mesh rotation={[0, 0, 0.9]} material={mats.figBody}><capsuleGeometry args={[0.09, 0.7, 4, 6]} /></mesh></Part>}
        {wrong >= 4 && <Part pos={[FX + 0.05, 4.05, 0]}><mesh rotation={[0, 0, -0.9]} material={mats.figBody}><capsuleGeometry args={[0.09, 0.7, 4, 6]} /></mesh></Part>}
        {wrong >= 5 && <Part pos={[FX - 0.12, 3.05, 0]}><mesh rotation={[0, 0, 0.18]} material={mats.figBody}><capsuleGeometry args={[0.1, 0.85, 4, 6]} /></mesh></Part>}
        {wrong >= 6 && <Part pos={[FX + 0.12, 3.05, 0]}><mesh rotation={[0, 0, -0.18]} material={mats.figBody}><capsuleGeometry args={[0.1, 0.85, 4, 6]} /></mesh></Part>}
      </group>

      {/* Word tiles */}
      {letters.map((ch, i) => {
        const revealed = guessed.includes(ch) || status === 'lost'
        const missed = status === 'lost' && !guessed.includes(ch)
        return <Tile key={i} char={ch} revealed={revealed} missed={missed} x={startX + i * sp} mats={mats} />
      })}

      <Confetti active={won} />
    </group>
  )
}

export default function HangmanGame({ paused, onResult }) {
  const [game] = useState(pickWord)
  const [guessed, setGuessed] = useState([])
  const [wrong, setWrong] = useState(0)
  const [status, setStatus] = useState('playing')   // playing|won|lost
  const [elapsed, setElapsed] = useState(0)

  const pauseRef = useRef(false)
  const resultSent = useRef(false)
  const guessedRef = useRef([])
  const wrongRef = useRef(0)
  const statusRef = useRef('playing')
  const elapsedRef = useRef(0)

  useEffect(() => { pauseRef.current = paused }, [paused])

  useEffect(() => {
    const id = setInterval(() => {
      if (pauseRef.current || statusRef.current !== 'playing') return
      elapsedRef.current++; setElapsed(t => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const finish = useCallback((score) => {
    if (resultSent.current) return
    resultSent.current = true
    onResult?.(score)
  }, [onResult])

  const guess = useCallback((L) => {
    if (statusRef.current !== 'playing' || pauseRef.current) return
    L = (L || '').toUpperCase()
    if (!/^[A-Z]$/.test(L) || guessedRef.current.includes(L)) return
    const ng = [...guessedRef.current, L]; guessedRef.current = ng; setGuessed(ng)

    if (game.word.includes(L)) {
      audioSystem.playChime?.()
      const allRevealed = [...new Set(game.word.split(''))].every(c => ng.includes(c))
      if (allRevealed) {
        statusRef.current = 'won'; setStatus('won'); audioSystem.playLevelUp?.()
        const sc = calcScore(wrongRef.current, game.word.length, elapsedRef.current)
        setTimeout(() => finish(sc), 1900)
      }
    } else {
      audioSystem.playError?.()
      const w = wrongRef.current + 1; wrongRef.current = w; setWrong(w)
      if (w >= MAX_WRONG) {
        statusRef.current = 'lost'; setStatus('lost')
        setTimeout(() => finish(0), 2200)
      }
    }
  }, [game.word, finish])

  // physical keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key && /^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); guess(e.key) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guess])

  const lives = MAX_WRONG - wrong
  const lastLife = lives === 1 && status === 'playing'

  return (
    <MiniGame3D
      camera={{ position: [0, 3.4, 10.5], fov: 52, near: 0.1, far: 100 }}
      background="radial-gradient(circle at 50% 25%, #243056 0%, #07060f 72%)"
      hud={
        <>
          {/* near-miss red vignette */}
          {lastLife && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 120px 30px rgba(239,68,68,0.5)', animation: 'hmpulse 1s ease-in-out infinite' }} />}
          <style>{`@keyframes hmpulse{0%,100%{opacity:0.35}50%{opacity:0.85}}`}</style>

          {/* Top HUD */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 font-body pointer-events-none">
            <div className="rounded-lg px-4 py-1" style={{ background: 'rgba(8,12,28,0.85)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <span className="text-violet-300 text-[13px] font-bold">Category: </span>
              <span className="text-white text-[14px] font-extrabold">{game.category}</span>
            </div>
            <div className="flex gap-4 text-[13px] font-bold">
              <span style={{ color: lives <= 2 ? '#f87171' : '#4ade80' }}>{'❤️'.repeat(lives)}{'🖤'.repeat(wrong)} {lives}/{MAX_WRONG}</span>
              <span className="text-amber-300">⏱ {elapsed}s</span>
            </div>
          </div>

          {/* Win / lose banner */}
          {status === 'won' && (
            <div className="absolute top-[34%] left-1/2 -translate-x-1/2 text-center pointer-events-none font-body">
              <div className="text-green-300 font-black text-[40px]" style={{ textShadow: '0 4px 24px rgba(74,222,128,0.8)' }}>You saved him! 🎉</div>
            </div>
          )}
          {status === 'lost' && (
            <div className="absolute top-[34%] left-1/2 -translate-x-1/2 text-center pointer-events-none font-body">
              <div className="text-red-400 font-black text-[36px]" style={{ textShadow: '0 4px 18px rgba(0,0,0,0.8)' }}>Game Over</div>
              <div className="text-slate-200 text-[15px] mt-1">The word was <b className="text-white">{game.word}</b></div>
            </div>
          )}

          {/* Alphabet keyboard */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full max-w-[520px] px-2 pointer-events-auto">
            <div className="flex flex-wrap justify-center gap-[5px]">
              {ALPHABET.map(L => {
                const used = guessed.includes(L)
                const correct = used && game.word.includes(L)
                const dis = used || status !== 'playing'
                return (
                  <button key={L} onClick={() => guess(L)} disabled={dis}
                    className="rounded-md text-[13px] font-extrabold font-body border-0 cursor-pointer"
                    style={{
                      width: 30, height: 34,
                      background: used ? (correct ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.45)') : 'rgba(124,58,237,0.35)',
                      color: used ? (correct ? '#dcfce7' : '#fecaca') : '#ede9fe',
                      opacity: dis && !used ? 0.4 : 1,
                    }}>
                    {L}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      }
    >
      <HangmanScene word={game.word} guessed={guessed} wrong={wrong} status={status} />
    </MiniGame3D>
  )
}
