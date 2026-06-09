// Small persistent HUD badge: shows a "Press F to clock in" prompt when standing at
// your job building, and a live earnings ticker while on shift.
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getJobState, onJobUpdate } from '@/lib/jobService'

export default function JobStatusBadge() {
  const [s, setS] = useState(getJobState)
  useEffect(() => onJobUpdate(setS), [])

  if (!s.job) return null
  const show = s.clockedIn || s.nearJob
  if (!show) return null

  const onShift = s.clockedIn
  const color = onShift ? '#22c55e' : '#3b82f6'

  return (
    <motion.div
      animate={onShift ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 1.6, repeat: Infinity }}
      style={{
        position: 'fixed', top: 120, left: '50%', transform: 'translateX(-50%)',
        zIndex: 8200, pointerEvents: 'none',
        background: 'rgba(8,8,16,0.84)', border: `1.5px solid ${color}`, borderRadius: 999,
        padding: '5px 14px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
        boxShadow: `0 0 14px ${color}55`,
      }}
    >
      <span style={{ fontSize: 15 }}>{s.job.emoji}</span>
      {onShift ? (
        <>
          <span style={{ color }}>On shift · {s.job.title}</span>
          <span style={{ opacity: 0.85 }}>+🪙{s.perMinute}/min · earned {Math.floor(s.sessionEarnings)}</span>
          {!s.nearJob && <span style={{ color: '#fbbf24' }}>· return to building!</span>}
        </>
      ) : (
        <span style={{ color }}>Press <b>F</b> to clock in as {s.job.title}</span>
      )}
    </motion.div>
  )
}
