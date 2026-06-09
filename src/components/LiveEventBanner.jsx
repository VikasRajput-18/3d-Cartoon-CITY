// Live-event UI: a dramatic full-width banner on start, a persistent pulsing HUD
// badge while active (with countdown + community progress bar), reward/end toasts,
// and a "Next Event" countdown pill that expands to list possible events.
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onLiveEventUpdate, getLiveEventState, getNextEventInfo, EVENT_TYPES } from '@/lib/liveEventState'

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}
function fmtMins(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 1 ? `${m} min` : '<1 min'
}

export default function LiveEventBanner() {
  const [state, setState]       = useState(getLiveEventState)
  const [banner, setBanner]     = useState(null)   // full event object while the big banner is up
  const [endMsg, setEndMsg]     = useState(null)
  const [reward, setReward]     = useState(null)
  const [showTypes, setShowTypes] = useState(false)
  const [, forceTick]           = useState(0)      // re-render every second for countdowns
  const bannerTimer = useRef(null)

  useEffect(() => onLiveEventUpdate(setState), [])

  useEffect(() => {
    const onStart = (e) => {
      setBanner(e.detail)
      clearTimeout(bannerTimer.current)
      bannerTimer.current = setTimeout(() => setBanner(null), 5000)   // auto-dismiss after 5s
    }
    const onEnd    = (e) => { setEndMsg(`${e.detail.name} has ended`); setTimeout(() => setEndMsg(null), 3500) }
    const onReward = (e) => { setReward(e.detail);                      setTimeout(() => setReward(null), 3500) }
    window.addEventListener('live-event-start',  onStart)
    window.addEventListener('live-event-end',    onEnd)
    window.addEventListener('live-event-reward', onReward)
    return () => {
      window.removeEventListener('live-event-start',  onStart)
      window.removeEventListener('live-event-end',    onEnd)
      window.removeEventListener('live-event-reward', onReward)
      clearTimeout(bannerTimer.current)
    }
  }, [])

  // 1 Hz ticker for the live countdowns.
  useEffect(() => {
    const iv = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const active     = state.active
  const remaining  = active ? active.endsAt - Date.now() : 0
  const nextMs     = getNextEventInfo().msUntil
  const isCommunity = active?.type === 'community_challenge'
  const progressPct = isCommunity ? Math.min(100, (state.community / (state.goal || 100)) * 100) : 0

  return (
    <>
      {/* ── Dramatic full-width banner (slides down, stays 5s, slides up) ── */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.rowId}
            initial={{ y: -140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -140, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
              display: 'flex', justifyContent: 'center', pointerEvents: 'none',
            }}
          >
            <div style={{
              marginTop: 14, maxWidth: 620, width: '92%',
              background: 'linear-gradient(135deg, rgba(10,10,20,0.96), rgba(30,20,50,0.96))',
              border: `2px solid ${banner.color}`, borderRadius: 16,
              boxShadow: `0 8px 40px ${banner.color}66`,
              padding: '14px 22px', color: '#fff',
              display: 'flex', alignItems: 'center', gap: 16,
              fontFamily: 'Nunito, sans-serif',
            }}>
              <div style={{ fontSize: 44, lineHeight: 1 }}>{banner.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: banner.color, letterSpacing: 0.3 }}>
                  {banner.title}
                </div>
                <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{banner.description}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  ⏳ {fmt(banner.endsAt - Date.now())} remaining
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Persistent pulsing HUD badge while an event runs ── */}
      {active && (
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{
            position: 'fixed', top: banner ? 96 : 14, left: '50%', transform: 'translateX(-50%)',
            zIndex: 8500, pointerEvents: 'none',
            background: 'rgba(8,8,16,0.82)', border: `1.5px solid ${active.color}`,
            borderRadius: 999, padding: '5px 14px', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
            boxShadow: `0 0 16px ${active.color}55`,
          }}
        >
          <span style={{ fontSize: 16 }}>{active.emoji}</span>
          <span style={{ color: active.color }}>{active.name.replace('!', '')}</span>
          <span style={{ opacity: 0.85 }}>· {fmt(remaining)}</span>
          {isCommunity && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <span style={{ width: 70, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${progressPct}%`, background: active.color, transition: 'width 0.4s' }} />
              </span>
              <span style={{ fontSize: 11, opacity: 0.9 }}>{state.community}/{state.goal || 100}</span>
            </span>
          )}
        </motion.div>
      )}

      {/* ── Reward toast ── */}
      <AnimatePresence>
        {reward && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)', zIndex: 8600,
              background: 'rgba(234,179,8,0.95)', color: '#000', padding: '8px 18px', borderRadius: 10,
              fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, pointerEvents: 'none',
              boxShadow: '0 6px 24px rgba(234,179,8,0.5)',
            }}
          >
            🪙 +{reward.amount} coins — {reward.reason}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── End notification ── */}
      <AnimatePresence>
        {endMsg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 8400,
              background: 'rgba(8,8,16,0.85)', color: '#cbd5e1', padding: '6px 14px', borderRadius: 8,
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, pointerEvents: 'none',
            }}
          >
            {endMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Next-event countdown pill (tap to see possible events) ── */}
      {!active && (
        <div style={{ position: 'fixed', top: 12, right: 60, zIndex: 8300, fontFamily: 'Nunito, sans-serif' }}>
          <button
            onClick={() => setShowTypes(s => !s)}
            style={{
              background: 'rgba(8,8,16,0.8)', border: '1px solid #475569', color: '#e2e8f0',
              borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ✨ Next Event: {fmtMins(nextMs)}
          </button>
          <AnimatePresence>
            {showTypes && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{
                  marginTop: 8, width: 220, background: 'rgba(8,8,16,0.92)', border: '1px solid #334155',
                  borderRadius: 12, padding: 10, color: '#e2e8f0',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, opacity: 0.8 }}>Possible events</div>
                {EVENT_TYPES.map(t => (
                  <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12 }}>
                    <span>{t.emoji}</span>
                    <span style={{ color: t.color, fontWeight: 700 }}>{t.name.replace('!', '')}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}
