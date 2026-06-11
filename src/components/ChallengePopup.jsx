// 2D UI for companion challenges: the accept/decline popup, in-game HUDs (coin
// score, trivia panel, hide-and-seek temperature), and the results card.
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCompanion } from '@/lib/companionService'
import { gameControls } from '@/lib/gameControls'
import { capturePhoto, addPhoto, autoCaption } from '@/lib/photoAlbum'
import {
  onChallengeUpdate, getChallengeState,
  acceptChallenge, declineChallenge, answerTrivia, closeResult, playAgain,
  reportDanceResult, reportPhotoDone, photoLocationLabel,
} from '@/lib/companionChallenges'

const ICONS = { coin_collect: '🪙', trivia: '🧠', hide_seek: '🙈', race: '🏍️' }

export default function ChallengePopup({ playerName }) {
  const [st, setSt] = useState(getChallengeState)
  const [, tick] = useState(0)
  useEffect(() => onChallengeUpdate(setSt), [])
  // 1 Hz ticker (trivia has no per-frame tick) — also auto-expires the trivia timer.
  useEffect(() => {
    const iv = setInterval(() => {
      tick(t => t + 1)
      const s = getChallengeState()
      if (s.active && s.type === 'trivia' && s.phase === 'running' && s.question && !s.qResult && s.timeLeft <= 0) {
        answerTrivia(-1)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  if (!st.active) return null
  const comp = getCompanion()
  const cname = comp?.name || 'Buddy'

  // ── Result card ──
  if (st.phase === 'result' && st.result) {
    const r = st.result
    return (
      <Overlay>
        <Card>
          <div style={{ fontSize: 48, textAlign: 'center' }}>{ICONS[r.type]}</div>
          <div style={{ fontSize: 22, fontWeight: 900, textAlign: 'center', color: r.playerWon ? '#34d399' : '#f87171', marginTop: 4 }}>
            {r.playerWon ? 'You Win! 🎉' : `${cname} Wins!`}
          </div>
          {(r.type === 'coin_collect' || r.type === 'trivia') && (
            <div style={{ textAlign: 'center', color: '#cbd5e1', marginTop: 8, fontWeight: 700 }}>
              You {r.playerScore} — {r.compScore} {cname}
            </div>
          )}
          <div style={{ textAlign: 'center', color: '#facc15', fontWeight: 900, marginTop: 8 }}>🪙 +{r.coinsEarned} coins</div>
          {st.line && <div style={{ textAlign: 'center', color: '#f9a8d4', marginTop: 10, fontStyle: 'italic' }}>💬 {st.line}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={playAgain} style={btn('#2563eb')}>Play Again</button>
            <button onClick={closeResult} style={btn('#334155')}>Close</button>
          </div>
        </Card>
      </Overlay>
    )
  }

  // ── Pending popup (slides up) ──
  if (st.phase === 'pending') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 140, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 140, opacity: 0 }}
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9200, fontFamily: 'Nunito, sans-serif' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0f172a', border: '1px solid #334155', borderRadius: 14, padding: 14, maxWidth: 440, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: comp?.outfitColor || '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{ICONS[st.type]} {cname} challenges you!</div>
              <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 2 }}>{st.prompt}</div>
            </div>
            <button onClick={acceptChallenge} style={btn('#22c55e', true)}>Accept</button>
            <button onClick={declineChallenge} style={btn('#475569', true)}>Decline</button>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ── Trivia panel ──
  if (st.type === 'trivia') {
    return (
      <Overlay>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
            <span>Question {Math.min(st.qIndex + 1, 5)}/5</span>
            <span>You {st.playerScore} · {cname} {st.compScore}</span>
            <span>⏳ {st.timeLeft}s</span>
          </div>
          {!st.question ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>{cname} is thinking…</div>
          ) : (
            <>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '12px 0' }}>{st.question}</div>
              {st.options.map((o, i) => {
                const res = st.qResult
                const bg = !res ? '#1e293b'
                  : i === res.correct ? '#16a34a'
                  : i === res.picked ? '#dc2626' : '#1e293b'
                return (
                  <button key={i} disabled={!!res} onClick={() => answerTrivia(i)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 12px', marginBottom: 7, fontSize: 14, fontWeight: 700, cursor: res ? 'default' : 'pointer' }}>
                    {String.fromCharCode(65 + i)}. {o}
                  </button>
                )
              })}
              {st.qResult && (
                <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>
                  {st.qResult.playerRight ? '✅ Sahi! +40' : '❌ Galat (+10)'} · {cname} {st.qResult.compRight ? 'got it right' : 'got it wrong'}.
                </div>
              )}
            </>
          )}
        </Card>
      </Overlay>
    )
  }

  // ── Dance battle ──
  if (st.type === 'dance_battle' && st.phase === 'running') {
    return <DanceBattle cname={cname} persona={comp?.personality} onDone={(p, c) => reportDanceResult(p, c)} />
  }

  // ── Photo challenge ──
  if (st.type === 'photo' && st.phase === 'running') {
    return <PhotoChallenge cname={cname} playerName={playerName} onDone={reportPhotoDone} />
  }

  // ── In-game HUDs (coin collect / hide / race) ──
  return (
    <div style={{ position: 'fixed', top: 150, left: '50%', transform: 'translateX(-50%)', zIndex: 9100, fontFamily: 'Nunito, sans-serif', pointerEvents: 'none' }}>
      <div style={{ background: 'rgba(8,8,16,0.85)', border: '1px solid #334155', borderRadius: 999, padding: '6px 16px', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        {st.type === 'coin_collect' && (
          <>
            <span>🪙 You {st.playerScore} · {cname} {st.compScore}</span>
            <span style={{ color: '#facc15' }}>⏳ {st.timeLeft}s</span>
          </>
        )}
        {st.type === 'hide_seek' && (
          <>
            <span style={{ color: st.tempColor || '#fff', textShadow: st.temp === 'Burning' ? `0 0 10px ${st.tempColor}` : 'none' }}>
              🌡️ {st.temp || 'Freezing'}
            </span>
            <span>Find {cname}!</span>
            <span style={{ color: '#facc15' }}>⏳ {st.timeLeft}s</span>
          </>
        )}
        {st.type === 'race' && (
          <span>{st.countdown > 0 ? `Get ready… ${st.countdown}` : `🏁 Race to the finish! ⏳ ${st.timeLeft}s`}</span>
        )}
      </div>
    </div>
  )
}

// ── small style helpers ──
function Overlay({ children }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>{children}</div>
}
function Card({ children }) {
  return <div style={{ width: 'min(94vw, 420px)', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>{children}</div>
}
function btn(bg, small) {
  return { flex: small ? '0 0 auto' : 1, background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: small ? '8px 14px' : '10px 0', fontWeight: 800, fontSize: 13, cursor: 'pointer' }
}

// ── Dance battle minigame ─────────────────────────────────────────────────────
const MOVES = [
  { name: 'SPIN!',   key: 'KeyQ',  emote: 'dance',     hint: 'Press Q',  color: '#a78bfa' },
  { name: 'JUMP!',   key: 'Space', emote: 'greet',     hint: 'Press SPACE', color: '#34d399' },
  { name: 'WAVE!',   key: 'KeyE',  emote: 'greet',     hint: 'Press E',  color: '#fbbf24' },
  { name: 'POINT!',  key: 'KeyF',  emote: 'handshake', hint: 'Press F',  color: '#f472b6' },
  { name: 'FREEZE!', key: null,    emote: null,        hint: "Don't press anything!", color: '#60a5fa' },
]
const ACC = { chill: 0.5, caring: 0.6, funny: 0.7, competitive: 0.85 }
const ANY = ['KeyQ', 'Space', 'KeyE', 'KeyF']

function DanceBattle({ cname, persona, onDone }) {
  const [idx, setIdx] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [, force] = useState(0)
  const pScore = useRef(0), cScore = useRef(0)
  const pressed = useRef(false)
  const acc = ACC[persona] || 0.6

  useEffect(() => { gameControls.enabled = false; return () => { gameControls.enabled = true } }, [])

  useEffect(() => {
    if (idx >= MOVES.length) { onDone(pScore.current, cScore.current); return }
    const move = MOVES[idx]
    pressed.current = false
    setFeedback('')
    const start = Date.now()
    const onKey = (e) => {
      if (pressed.current) return
      if (move.key === null) {                      // FREEZE — any press fails
        if (ANY.includes(e.code)) { pressed.current = true; setFeedback('❌ Hil gaye!') }
        return
      }
      if (e.code === move.key) {
        e.preventDefault(); pressed.current = true
        const dt = (Date.now() - start) / 1000
        const pts = dt < 0.5 ? 15 : 10
        pScore.current += pts
        setFeedback(dt < 0.5 ? `✨ Perfect! +${pts}` : `✅ +${pts}`)
        if (move.emote) window.dispatchEvent(new CustomEvent('emote-trigger', { detail: { emote: move.emote } }))
      }
    }
    window.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => {
      window.removeEventListener('keydown', onKey, true)
      const ok = move.key === null ? !pressed.current : pressed.current
      if (move.key === null && ok) { pScore.current += 10; setFeedback('✅ Froze! +10') }
      else if (!ok && move.key !== null) setFeedback('❌ Miss!')
      if (Math.random() < acc) cScore.current += (Math.random() < 0.4 ? 15 : 10)   // companion's move
      force(n => n + 1)
      setTimeout(() => setIdx(i => i + 1), 800)
    }, 2000)
    return () => { window.removeEventListener('keydown', onKey, true); clearTimeout(t) }
  }, [idx])

  const move = MOVES[idx] || MOVES[0]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(2,0,12,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'Nunito, sans-serif', overflow: 'hidden' }}>
      {/* drifting music notes */}
      {['🎵', '🎶', '✨', '🎵', '🎶'].map((n, i) => (
        <motion.div key={i} initial={{ y: 200, opacity: 0 }} animate={{ y: -200, opacity: [0, 1, 0] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.8 }}
          style={{ position: 'absolute', left: `${15 + i * 18}%`, fontSize: 28 }}>{n}</motion.div>
      ))}
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>💃 Dance Battle · You {pScore.current} · {cname} {cScore.current}</div>
      <motion.div key={idx} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontSize: 72, fontWeight: 900, color: move.color, textShadow: `0 0 36px ${move.color}` }}>
        {move.name}
      </motion.div>
      <div style={{ color: '#cbd5e1', fontSize: 18, fontWeight: 700 }}>{move.hint}</div>
      <div style={{ color: '#facc15', fontWeight: 900, fontSize: 18, height: 24 }}>{feedback}</div>
    </div>
  )
}

// ── Photo challenge ───────────────────────────────────────────────────────────
function PhotoChallenge({ cname, playerName, onDone }) {
  const [secs, setSecs] = useState(15)
  const [flash, setFlash] = useState(false)
  const [photo, setPhoto] = useState(null)   // { thumb, full, caption, location }
  const captured = useRef(false)

  const take = () => {
    if (captured.current) return
    captured.current = true
    setFlash(true); setTimeout(() => setFlash(false), 260)
    const thumb = capturePhoto()
    let full = thumb
    try { const c = document.querySelector('canvas'); if (c) full = c.toDataURL('image/png') } catch {}
    const location = photoLocationLabel()
    const caption = autoCaption(location)
    if (thumb) addPhoto({ dataUrl: thumb, caption, location, playerName })
    setPhoto({ thumb, full, caption, location })
  }

  useEffect(() => {
    const iv = setInterval(() => setSecs(s => { if (s <= 1 && !captured.current) take(); return Math.max(0, s - 1) }), 1000)
    const onKey = (e) => { if (e.code === 'Space' && !captured.current) { e.preventDefault(); take() } }
    window.addEventListener('keydown', onKey, true)
    return () => { clearInterval(iv); window.removeEventListener('keydown', onKey, true) }
  }, [])

  // Polaroid result
  if (photo) {
    return (
      <Overlay>
        <div style={{ background: '#f8fafc', padding: '14px 14px 0', borderRadius: 4, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', transform: 'rotate(-2deg)' }}>
          {photo.thumb
            ? <img src={photo.thumb} alt="snap" style={{ width: 300, display: 'block', borderRadius: 2 }} />
            : <div style={{ width: 300, height: 200, background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>📷</div>}
          <div style={{ padding: '12px 4px 16px', fontFamily: 'Nunito, sans-serif', color: '#1f2937' }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{photo.caption}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{playerName || 'Player'} · {new Date().toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {photo.full && <a href={photo.full} download={`cartoon-city-${Date.now()}.png`} style={{ ...btn('#2563eb'), textDecoration: 'none', textAlign: 'center' }}>⬇ Download</a>}
          <button onClick={onDone} style={btn('#22c55e')}>Done (+25 🪙)</button>
        </div>
      </Overlay>
    )
  }

  // Camera viewfinder
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, pointerEvents: 'none', fontFamily: 'Nunito, sans-serif' }}>
      {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff' }} />}
      {/* viewfinder border (vintage frame) */}
      <div style={{ position: 'absolute', inset: 24, border: '4px solid rgba(255,255,255,0.75)', borderRadius: 14, boxShadow: 'inset 0 0 120px rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontWeight: 900, background: 'rgba(0,0,0,0.5)', padding: '4px 14px', borderRadius: 999 }}>
        📸 {cname} is posing! · {secs}s
      </div>
      <div style={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontWeight: 800, background: 'rgba(0,0,0,0.55)', padding: '8px 18px', borderRadius: 999 }}>
        Position yourself and press <b>SPACE</b> to take the photo
      </div>
    </div>
  )
}
