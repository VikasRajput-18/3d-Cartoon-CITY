import { useState, useEffect, useRef, useCallback } from 'react'
import { minimapState } from '@/lib/minimapState'
import {
  getTutorialState, onTutorialUpdate, nextStep, prevStep,
  completeTutorial, skipTutorial, TUTORIAL_STEP_COUNT,
} from '@/lib/tutorialState'

// ── Step definitions ───────────────────────────────────────────────────────────
// complete: 'manual' | 'auto' | 'move' | 'camera' | event-name string
// target:   data-tutorial selector value | 'center' | null
const STEPS = [
  { // 0 — Welcome
    kind: 'modal', title: 'Welcome to Cartoon Life Universe! 🌍',
    text: 'This is your cartoon world. Let us show you around so you feel right at home.',
    complete: 'manual',
  },
  { // 1 — Movement
    title: 'Walk Around', target: 'center', complete: 'move',
    text: 'Use the W A S D keys to walk around the city. Try moving now!',
    mobileText: 'Use the joystick to walk around. Try moving now!',
  },
  { // 2 — Look around
    title: 'Look Around', target: 'center', complete: 'camera',
    text: 'Right-click and drag to rotate the camera. Scroll to zoom in and out.',
    mobileText: 'Swipe the right side of the screen to rotate. Pinch to zoom.',
  },
  { // 3 — Meet an NPC
    title: 'Meet Your First Friend 👋', target: null, complete: 'tutorial-npc-chat',
    text: 'The cartoon people are your city friends! Walk up to one and click them to chat.',
  },
  { // 4 — Enter a building
    title: 'Explore a Building 🏢', target: null, complete: 'tutorial-building-entered',
    text: 'You can enter buildings to do activities! Walk close to an entrance and press E.',
    mobileText: 'You can enter buildings to do activities! Walk close to an entrance and tap E.',
  },
  { // 5 — Do an activity
    title: 'Do an Activity 🎭', target: null, complete: 'tutorial-activity', autoMs: 12000,
    text: 'Choose an activity to do! Each one has a funny AI-generated outcome.',
  },
  { // 6 — Stats
    title: 'Your Life Stats 📊', target: '[data-tutorial="profile"]', complete: 'auto', autoMs: 5000,
    text: 'Open your profile to see your life stats — hunger, sleep, hygiene, social and fun. Keep them healthy by eating, sleeping and socializing!',
  },
  { // 7 — House
    title: 'Your House 🏠', target: '[data-tutorial="minimap"]', complete: 'auto', autoMs: 5000,
    text: 'You have your own house in the city! Check the minimap — your house icon is highlighted in gold.',
  },
  { // 8 — Coins
    title: 'Earn Coins 🪙', target: '[data-tutorial="profile"]', complete: 'auto', autoMs: 4500,
    text: 'You start with 500 coins. Complete missions and play games to earn more. Coins pay your bills and unlock cool stuff!',
  },
  { // 9 — Missions
    title: 'Story Missions 🗺️', target: '[data-tutorial="missions"]', complete: 'tutorial-missions-opened',
    text: 'You have story missions to uncover the mystery of Cartoon City. Tap the map icon to see them!',
  },
  { // 10 — Game Arena
    title: 'The Game Arena 🎮', target: '[data-tutorial="minimap"]', complete: 'auto', autoMs: 4500,
    text: 'The Game Arena has 5 mini-games. Compete in tournaments, challenge friends, and win coins!',
  },
  { // 11 — Done
    kind: 'finale', title: "You're Ready! 🎉", complete: 'manual',
    text: 'Here is a welcome gift to get you started:',
  },
]

const isMobileDevice = () =>
  typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window)

// ── Confetti ────────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 36 })
  const colors = ['#7c3aed', '#ec4899', '#facc15', '#22c55e', '#38bdf8', '#fb923c']
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1001]">
      {pieces.map((_, i) => {
        const left  = Math.random() * 100
        const delay = Math.random() * 0.6
        const dur   = 1.8 + Math.random() * 1.4
        const size  = 6 + Math.random() * 8
        const color = colors[i % colors.length]
        return (
          <div key={i} style={{
            position: 'absolute', top: '-20px', left: `${left}%`,
            width: size, height: size * 0.6, background: color,
            borderRadius: 2, opacity: 0.9,
            animation: `confettiFall ${dur}s ${delay}s linear forwards`,
          }} />
        )
      })}
      <style>{`@keyframes confettiFall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0.3}}`}</style>
    </div>
  )
}

// ── Spotlight cutout (box-shadow hole technique — clicks pass through) ─────────
function Spotlight({ rect, mobile }) {
  if (!rect) return null
  const pad    = mobile ? 18 : 12
  const radius = rect.radiusOverride ?? Math.min(rect.width, rect.height) / 2 + pad
  const isCircle = rect.circle
  const style = isCircle
    ? {
        position: 'fixed',
        left: rect.cx - radius, top: rect.cy - radius,
        width: radius * 2, height: radius * 2, borderRadius: '50%',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        border: '2px solid rgba(167,139,250,0.9)',
        pointerEvents: 'none', zIndex: 1000,
        animation: 'spotPulse 1.6s ease-in-out infinite',
      }
    : {
        position: 'fixed',
        left: rect.left - pad, top: rect.top - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        borderRadius: 14,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        border: '2px solid rgba(251,191,36,0.9)',
        pointerEvents: 'none', zIndex: 1000,
        transition: 'all 0.3s ease',
        animation: 'spotPulse 1.6s ease-in-out infinite',
      }
  return (
    <>
      <div style={style} />
      <style>{`@keyframes spotPulse{0%,100%{box-shadow:0 0 0 9999px rgba(0,0,0,0.62),0 0 14px rgba(167,139,250,0.5)}50%{box-shadow:0 0 0 9999px rgba(0,0,0,0.62),0 0 28px rgba(167,139,250,0.9)}}`}</style>
    </>
  )
}

export default function TutorialOverlay() {
  const [ts,    setTs]    = useState(getTutorialState)
  const [rect,  setRect]  = useState(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [finished, setFinished] = useState(null)  // reward object after complete
  const [graceNext, setGraceNext] = useState(false)  // safety "Next" for action steps
  const mobile = isMobileDevice()

  useEffect(() => onTutorialUpdate(setTs), [])

  // Reveal a safety "Next" on action steps after a grace period so the
  // tutorial can never permanently block (e.g. if the player wanders off).
  useEffect(() => {
    setGraceNext(false)
    const s = STEPS[ts.step]
    if (!s) return
    const isAction = typeof s.complete === 'string'
      && !['auto', 'manual'].includes(s.complete)
    if (!isAction) return
    const t = setTimeout(() => setGraceNext(true), 15000)
    return () => clearTimeout(t)
  }, [ts.step])

  const step  = STEPS[ts.step] ?? null
  const active = ts.active

  // ── Resolve spotlight rect for the current step ────────────────────────────
  useEffect(() => {
    if (!active || !step) { setRect(null); return }

    const compute = () => {
      if (step.target === 'center') {
        const r = Math.min(window.innerWidth, window.innerHeight) * (mobile ? 0.3 : 0.22)
        setRect({ circle: true, cx: window.innerWidth / 2, cy: window.innerHeight / 2, radiusOverride: r })
        return
      }
      if (!step.target) { setRect(null); return }
      const el = document.querySelector(step.target)
      if (el) {
        const b = el.getBoundingClientRect()
        setRect({ left: b.left, top: b.top, width: b.width, height: b.height })
      } else {
        setRect(null)
      }
    }
    compute()
    const iv = setInterval(compute, 400)  // re-resolve in case element mounts later / moves
    window.addEventListener('resize', compute)
    return () => { clearInterval(iv); window.removeEventListener('resize', compute) }
  }, [active, ts.step, mobile, step])

  // ── Completion detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !step) return
    const c = step.complete

    // Manual / modal steps handled by their buttons
    if (c === 'manual') return

    let cleanup = []

    if (c === 'move') {
      const start = { x: minimapState.playerX, z: minimapState.playerZ }
      const iv = setInterval(() => {
        const d = Math.hypot(minimapState.playerX - start.x, minimapState.playerZ - start.z)
        if (d > 3) { nextStep() }
      }, 200)
      cleanup.push(() => clearInterval(iv))
    } else if (c === 'camera') {
      const onMove = (e) => { if (e.buttons && Math.abs(e.movementX) + Math.abs(e.movementY) > 4) { nextStep() } }
      const onWheel = () => nextStep()
      const onTouch = (e) => { if (e.touches?.length >= 1) { /* swipe */ } }
      const onTouchMove = () => nextStep()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('wheel', onWheel, { passive: true })
      if (mobile) window.addEventListener('touchmove', onTouchMove, { passive: true })
      cleanup.push(() => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('wheel', onWheel)
        window.removeEventListener('touchmove', onTouchMove)
      })
    } else if (c === 'auto') {
      const t = setTimeout(() => nextStep(), step.autoMs ?? 4000)
      cleanup.push(() => clearTimeout(t))
    } else {
      // Named window event
      const handler = () => nextStep()
      window.addEventListener(c, handler)
      cleanup.push(() => window.removeEventListener(c, handler))
      // Optional auto fallback so the step can never hard-block
      if (step.autoMs) {
        const t = setTimeout(() => nextStep(), step.autoMs)
        cleanup.push(() => clearTimeout(t))
      }
    }

    return () => cleanup.forEach(fn => fn())
  }, [active, ts.step, mobile, step])

  const handleComplete = useCallback(async () => {
    const reward = await completeTutorial()
    setFinished(reward)
  }, [])

  const handleSkip = useCallback(async () => {
    const reward = await skipTutorial()
    setConfirmSkip(false)
    // brief acknowledgement then close
    setFinished({ ...reward, skipped: true })
    setTimeout(() => setFinished(null), 1800)
  }, [])

  if (!active && !finished) return null

  // ── Finale celebration screen (full reward, after last step) ───────────────
  if (finished && !finished.skipped) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <Confetti />
        <div className="rounded-3xl text-center max-w-[360px] w-[90%]" style={{
          background: 'linear-gradient(135deg, rgba(20,10,40,0.98), rgba(40,20,60,0.98))',
          border: '2px solid rgba(251,191,36,0.5)', padding: '32px 36px',
          boxShadow: '0 0 60px rgba(124,58,237,0.4)',
        }}>
          <div className="text-[56px] mb-2">🎉</div>
          <div className="text-yellow-300 text-2xl font-extrabold mb-2">You're Ready!</div>
          <div className="text-slate-300 text-[14px] mb-5">Here's your welcome gift:</div>
          <div className="flex flex-col gap-2 mb-6">
            <div className="rounded-xl flex items-center justify-between" style={{ background: 'rgba(251,191,36,0.12)', padding: '10px 16px' }}>
              <span className="text-slate-200 text-[14px]">🪙 Coins</span>
              <span className="text-yellow-400 font-bold">+{finished.coins}</span>
            </div>
            <div className="rounded-xl flex items-center justify-between" style={{ background: 'rgba(167,139,250,0.12)', padding: '10px 16px' }}>
              <span className="text-slate-200 text-[14px]">💎 Gems</span>
              <span className="text-violet-300 font-bold">+{finished.gems}</span>
            </div>
            <div className="rounded-xl flex items-center justify-between" style={{ background: 'rgba(34,197,94,0.12)', padding: '10px 16px' }}>
              <span className="text-slate-200 text-[14px]">🏅 Badge</span>
              <span className="text-green-400 font-bold">Newcomer</span>
            </div>
          </div>
          <button onClick={() => setFinished(null)} className="w-full border-0 rounded-2xl text-white font-extrabold text-[16px] cursor-pointer font-body"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', padding: '14px' }}>
            Start Playing! 🚀
          </button>
        </div>
      </div>
    )
  }

  // ── Skip acknowledgement (reduced reward) ──────────────────────────────────
  if (finished?.skipped) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="rounded-2xl text-center" style={{ background: 'rgba(8,4,20,0.98)', border: '1px solid rgba(124,58,237,0.4)', padding: '24px 32px' }}>
          <div className="text-3xl mb-2">👍</div>
          <div className="text-slate-200 text-[15px] font-bold">Tutorial skipped</div>
          <div className="text-yellow-400 text-[13px] mt-1">+{finished.coins} coins to get you started</div>
        </div>
      </div>
    )
  }

  if (!step) return null

  // ── Welcome modal (step 0) ─────────────────────────────────────────────────
  if (step.kind === 'modal') {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.8)' }}>
        <div className="rounded-3xl text-center max-w-[380px] w-[90%]" style={{
          background: 'linear-gradient(135deg, rgba(20,10,40,0.98), rgba(40,20,60,0.98))',
          border: '2px solid rgba(124,58,237,0.5)', padding: '36px 36px 28px',
          boxShadow: '0 0 60px rgba(124,58,237,0.4)',
        }}>
          <div className="text-[52px] mb-3">🌍</div>
          <div className="text-violet-300 text-[22px] font-extrabold mb-3">{step.title}</div>
          <div className="text-slate-300 text-[14px] leading-relaxed mb-7">{step.text}</div>
          <button onClick={nextStep} className="w-full border-0 rounded-2xl text-white font-extrabold text-[16px] cursor-pointer font-body mb-3"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', padding: '14px' }}>
            Start Tour ✨
          </button>
          <button onClick={() => setConfirmSkip(true)} className="bg-transparent border-0 text-slate-500 text-[12px] cursor-pointer font-body">
            Skip tutorial
          </button>
        </div>
        {confirmSkip && <SkipConfirm onSkip={handleSkip} onCancel={() => setConfirmSkip(false)} />}
      </div>
    )
  }

  // ── Finale step (step 11) — show Claim button which grants full reward ──────
  if (step.kind === 'finale') {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.8)' }}>
        <div className="rounded-3xl text-center max-w-[360px] w-[90%]" style={{
          background: 'linear-gradient(135deg, rgba(20,10,40,0.98), rgba(40,20,60,0.98))',
          border: '2px solid rgba(251,191,36,0.5)', padding: '32px 36px',
        }}>
          <div className="text-[52px] mb-2">🏆</div>
          <div className="text-yellow-300 text-[22px] font-extrabold mb-2">{step.title}</div>
          <div className="text-slate-300 text-[14px] mb-2">{step.text}</div>
          <div className="text-slate-400 text-[13px] mb-6">🪙 200 coins · 💎 5 gems · 🏅 Newcomer badge</div>
          <button onClick={handleComplete} className="w-full border-0 rounded-2xl text-white font-extrabold text-[16px] cursor-pointer font-body"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#1a0a00', padding: '14px' }}>
            Claim & Start Playing! 🚀
          </button>
        </div>
      </div>
    )
  }

  // ── Standard guided step: spotlight + tooltip ──────────────────────────────
  const text = (mobile && step.mobileText) ? step.mobileText : step.text

  // Position tooltip: below the spotlight if room, else centered-bottom
  let tipStyle = { left: '50%', bottom: mobile ? 96 : 40, transform: 'translateX(-50%)' }
  if (rect && !rect.circle) {
    const belowY = rect.top + rect.height + 28
    if (belowY < window.innerHeight - 160) {
      tipStyle = { left: Math.max(12, Math.min(rect.left, window.innerWidth - (mobile ? 300 : 340) - 12)), top: belowY }
    } else {
      tipStyle = { left: Math.max(12, Math.min(rect.left, window.innerWidth - (mobile ? 300 : 340) - 12)), top: Math.max(12, rect.top - 150) }
    }
  }

  return (
    <>
      {/* Dim background even when no spotlight target */}
      {!rect && <div className="fixed inset-0 z-[999] pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }} />}

      <Spotlight rect={rect} mobile={mobile} />

      {/* Tooltip panel */}
      <div className="fixed z-[1002] font-body" style={{ ...tipStyle, width: mobile ? 300 : 340, maxWidth: '92vw' }}>
        <div className="rounded-2xl" style={{
          background: 'rgba(12,8,26,0.98)', border: '1.5px solid rgba(124,58,237,0.5)',
          padding: mobile ? '16px 18px' : '16px 20px', boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-violet-300 font-extrabold" style={{ fontSize: mobile ? 16 : 15 }}>{step.title}</div>
            <div className="text-slate-500 text-[11px] font-bold">{ts.step + 1} of {TUTORIAL_STEP_COUNT}</div>
          </div>
          <div className="text-slate-300 leading-relaxed mb-3" style={{ fontSize: mobile ? 14 : 13 }}>{text}</div>

          {/* Progress dots */}
          <div className="flex gap-1 justify-center mb-3">
            {Array.from({ length: TUTORIAL_STEP_COUNT }).map((_, i) => (
              <div key={i} style={{
                width: i === ts.step ? 18 : 6, height: 6, borderRadius: 3,
                background: i === ts.step ? '#a78bfa' : i < ts.step ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {ts.step > 0 && (
              <button onClick={prevStep} className="rounded-lg text-slate-400 text-[12px] font-bold cursor-pointer font-body border-0"
                style={{ background: 'rgba(255,255,255,0.06)', padding: '7px 12px' }}>
                ← Back
              </button>
            )}
            <div className="flex-1" />
            {/* Auto / informational steps get a Next; action steps wait for the action */}
            {step.complete === 'auto' && (
              <button onClick={nextStep} className="rounded-lg text-white text-[12px] font-bold cursor-pointer font-body border-0"
                style={{ background: 'rgba(124,58,237,0.7)', padding: '7px 16px' }}>
                Next →
              </button>
            )}
            {['move','camera'].includes(step.complete) && !graceNext && (
              <span className="text-violet-400 text-[11px] font-bold">Try it…</span>
            )}
            {typeof step.complete === 'string' && !['auto','move','camera','manual'].includes(step.complete) && !graceNext && (
              <span className="text-violet-400 text-[11px] font-bold">Do the action ✦</span>
            )}
            {graceNext && (
              <button onClick={nextStep} className="rounded-lg text-white text-[12px] font-bold cursor-pointer font-body border-0"
                style={{ background: 'rgba(124,58,237,0.7)', padding: '7px 16px' }}>
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Skip button (always visible) */}
        <div className="flex justify-end mt-2">
          <button onClick={() => setConfirmSkip(true)} className="bg-transparent border-0 text-slate-500 text-[11px] cursor-pointer font-body underline">
            Skip tutorial
          </button>
        </div>
      </div>

      {confirmSkip && <SkipConfirm onSkip={handleSkip} onCancel={() => setConfirmSkip(false)} />}
    </>
  )
}

// ── Skip confirmation dialog ──────────────────────────────────────────────────
function SkipConfirm({ onSkip, onCancel }) {
  return (
    <div className="fixed inset-0 z-[1003] flex items-center justify-center font-body" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-2xl text-center max-w-[320px] w-[90%]" style={{
        background: 'rgba(12,8,26,0.99)', border: '1.5px solid rgba(239,68,68,0.4)', padding: '24px 28px',
      }}>
        <div className="text-[36px] mb-2">🤔</div>
        <div className="text-slate-200 font-bold text-[15px] mb-2">Skip the tutorial?</div>
        <div className="text-slate-400 text-[13px] mb-5">You'll miss the full welcome reward (200 coins + 5 gems). You'll still get 100 coins.</div>
        <div className="flex flex-col gap-2">
          <button onClick={onCancel} className="w-full border-0 rounded-xl text-white font-bold text-[14px] cursor-pointer font-body"
            style={{ background: 'rgba(124,58,237,0.7)', padding: '11px' }}>
            Continue Tutorial
          </button>
          <button onClick={onSkip} className="w-full rounded-xl text-red-400 font-bold text-[13px] cursor-pointer font-body border-0"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px' }}>
            Skip Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
