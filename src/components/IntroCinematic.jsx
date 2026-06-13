// Cinematic intro overlay — title card, letterbox bars, timed story text,
// Skip button, and the final "today's mystery" call-to-action. The camera motion
// itself lives in world/IntroCameraRig (inside the Canvas).
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DAILY_MISSIONS, getMissionState } from '@/lib/missionState'

const LINES = [
  { at: 4,    text: 'A living city, always awake.' },
  { at: 8,    text: 'Make friends. Build a life. Solve its mysteries.' },
  { at: 12,   text: 'Your story starts now.' },
]
const FONT = "'Nunito', sans-serif"

export default function IntroCinematic({ playerName, settled, onSkip, onStart }) {
  const [t, setT] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const iv = setInterval(() => setT((Date.now() - startRef.current) / 1000), 100)
    return () => clearInterval(iv)
  }, [])

  // Today's mystery = first incomplete daily mission (the "main thing to do")
  const ms = getMissionState()
  const mystery = DAILY_MISSIONS.find(m => !ms?.dailyCompleted?.[m.id]) || DAILY_MISSIONS[0]

  const titleVisible = t < 3.4
  const line = LINES.slice().reverse().find(l => t >= l.at && t < l.at + 3.4)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9700, pointerEvents: 'none', fontFamily: FONT }}>
      {/* Black opening that fades out as the city is revealed */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: t > 2.6 ? 0 : 1 }}
        transition={{ duration: 1.4 }}
        style={{ position: 'absolute', inset: 0, background: '#000' }}
      />

      {/* Letterbox bars — retract when control is given */}
      <motion.div animate={{ height: settled ? 0 : '9vh' }} transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#000' }} />
      <motion.div animate={{ height: settled ? 0 : '9vh' }} transition={{ duration: 0.8, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#000' }} />

      {/* Title card */}
      <AnimatePresence>
        {titleVisible && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1 } }}
            transition={{ duration: 1.6, delay: 0.4 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ color: '#ffd98a', fontSize: 'clamp(28px, 6vw, 58px)', fontWeight: 900, letterSpacing: 2, textShadow: '0 0 40px rgba(255,179,107,0.55)' }}>
              Cartoon Life Universe
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }}
              style={{ color: '#e2e8f0', fontSize: 'clamp(14px, 2.4vw, 22px)', marginTop: 14, fontWeight: 600 }}>
              Welcome, {playerName || 'friend'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story lines */}
      <AnimatePresence mode="wait">
        {!settled && line && (
          <motion.div
            key={line.at}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.9 }}
            style={{ position: 'absolute', bottom: '16vh', left: 0, right: 0, textAlign: 'center',
              color: '#fff', fontSize: 'clamp(16px, 3vw, 28px)', fontWeight: 700,
              textShadow: '0 2px 18px rgba(0,0,0,0.8)', letterSpacing: 0.5 }}
          >
            {line.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip */}
      {!settled && t > 1 && (
        <button onClick={onSkip}
          style={{ position: 'absolute', top: '11vh', right: 18, pointerEvents: 'auto',
            background: 'rgba(8,8,16,0.6)', border: '1px solid rgba(255,255,255,0.25)', color: '#cbd5e1',
            borderRadius: 999, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          Skip ▸
        </button>
      )}

      {/* CTA card once the camera settles */}
      <AnimatePresence>
        {settled && (
          <motion.div
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' }}
          >
            <div style={{ background: 'rgba(10,10,22,0.95)', border: '1.5px solid #f2c94c', borderRadius: 16,
              padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}>
              <span style={{ fontSize: 34 }}>{mystery.icon}</span>
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>TODAY'S MYSTERY</div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>{mystery.title}</div>
                <div style={{ color: '#cbd5e1', fontSize: 12 }}>{mystery.description} · 🪙 {mystery.reward_coins}</div>
              </div>
              <button onClick={onStart}
                style={{ background: '#f2c94c', color: '#1a1206', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                Start Exploring →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
