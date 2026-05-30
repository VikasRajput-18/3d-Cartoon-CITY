// One-time "New!" tip tooltip for returning players when a feature is added.
// Usage: <FeatureTip id="game-arena-tournaments" target='[data-tutorial="minimap"]'
//          text="New! Check out the Game Arena for tournaments." />
// Shows once per tip id (tracked in localStorage), then never again after dismiss.
import { useState, useEffect } from 'react'
import { isTipSeen, markTipSeen, getTutorialState } from '@/lib/tutorialState'

export default function FeatureTip({ id, target, text, delayMs = 1500 }) {
  const [show, setShow] = useState(false)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (isTipSeen(id)) return
    // Don't show feature tips while the main tutorial is running
    const t = setTimeout(() => {
      if (getTutorialState().active) return
      setShow(true)
    }, delayMs)
    return () => clearTimeout(t)
  }, [id, delayMs])

  useEffect(() => {
    if (!show || !target) return
    const compute = () => {
      const el = document.querySelector(target)
      if (el) {
        const b = el.getBoundingClientRect()
        setRect({ left: b.left, top: b.top, width: b.width, height: b.height })
      }
    }
    compute()
    const iv = setInterval(compute, 500)
    window.addEventListener('resize', compute)
    return () => { clearInterval(iv); window.removeEventListener('resize', compute) }
  }, [show, target])

  if (!show) return null

  const dismiss = () => { markTipSeen(id); setShow(false) }

  // Position near target, else top-center
  const style = rect
    ? { left: Math.max(12, Math.min(rect.left, window.innerWidth - 280)), top: Math.max(12, rect.top - 92) }
    : { left: '50%', top: 70, transform: 'translateX(-50%)' }

  return (
    <div className="fixed z-[400] font-body" style={{ ...style, width: 260, maxWidth: '90vw' }}>
      <div className="rounded-xl" style={{
        background: 'linear-gradient(135deg,rgba(124,58,237,0.96),rgba(236,72,153,0.92))',
        padding: '11px 14px', boxShadow: '0 8px 28px rgba(124,58,237,0.5)',
        animation: 'tipPop 0.3s ease',
      }}>
        <div className="flex items-start gap-2">
          <span className="text-[15px]">✨</span>
          <div className="flex-1 text-white text-[12px] font-semibold leading-snug">{text}</div>
          <button onClick={dismiss} className="bg-transparent border-0 text-white/70 hover:text-white cursor-pointer text-[14px] leading-none">×</button>
        </div>
        <button onClick={dismiss} className="mt-2 w-full bg-white/20 border-0 rounded-lg text-white text-[11px] font-bold cursor-pointer font-body py-[5px]">
          Got it
        </button>
      </div>
      <style>{`@keyframes tipPop{from{opacity:0;transform:scale(0.9) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  )
}
