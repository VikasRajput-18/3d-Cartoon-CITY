// Jobs panel — Job Board (browse + apply via AI interview) and My Job (clock in/out,
// performance, earnings). Phase 1 of the economy sim.
import { useState, useEffect } from 'react'
import {
  JOBS, getJobState, onJobUpdate, fetchJobSlots, canApply,
  clockIn, clockOut, quitJob, getJobDef,
} from '@/lib/jobService'
import InterviewPanel from './InterviewPanel'

export default function JobsPanel({ open, onClose, playerName }) {
  const [tab, setTab] = useState('board')
  const [state, setState] = useState(getJobState)
  const [slots, setSlots] = useState({})
  const [interviewing, setInterviewing] = useState(null)

  useEffect(() => onJobUpdate(setState), [])
  useEffect(() => {
    if (!open) return
    fetchJobSlots().then(s => setSlots({ ...s }))
    setTab(getJobState().job ? 'myjob' : 'board')
  }, [open])

  if (!open) return null
  const job = state.job

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}
        onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ width: 'min(95vw, 520px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
          {/* Header + tabs */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>💼</span>
            <div style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 17 }}>City Jobs</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>
            {['board', 'myjob'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? '#fff' : '#64748b', fontWeight: 800, fontSize: 14,
                borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
              }}>
                {t === 'board' ? 'Job Board' : 'My Job'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {/* ── JOB BOARD ── */}
            {tab === 'board' && JOBS.map(j => {
              const taken = slots[j.id] || 0
              const left = Math.max(0, j.max - taken)
              const apply = canApply(j.id)
              return (
                <div key={j.id} style={{ background: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{j.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 900, fontSize: 15 }}>{j.title}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{j.dept} · 🪙 {j.rate}/hr · 📍 {j.building}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: left > 0 ? '#34d399' : '#f87171', fontSize: 12, fontWeight: 800 }}>{left}/{j.max} slots</div>
                    </div>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 12, margin: '8px 0' }}>{j.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {j.skills.map(s => <span key={s} style={{ background: '#0b1220', color: '#7dd3fc', fontSize: 10, padding: '2px 7px', borderRadius: 6 }}>{s}</span>)}
                    </div>
                    <button
                      disabled={!apply.ok}
                      title={apply.ok ? '' : apply.reason}
                      onClick={() => setInterviewing(j)}
                      style={{ background: apply.ok ? '#2563eb' : '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 800, fontSize: 13, cursor: apply.ok ? 'pointer' : 'not-allowed', opacity: apply.ok ? 1 : 0.6, whiteSpace: 'nowrap' }}>
                      Apply
                    </button>
                  </div>
                </div>
              )
            })}

            {/* ── MY JOB ── */}
            {tab === 'myjob' && (
              job ? (
                <div>
                  <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 44 }}>{job.emoji}</div>
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, marginTop: 4 }}>{job.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{job.dept} · 🪙 {job.salary}/hr</div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <Stat label="Performance" value={`${state.performance}%`} color={state.performance >= 70 ? '#34d399' : '#fbbf24'} />
                    <Stat label="Per minute" value={`🪙 ${state.perMinute}`} color="#7dd3fc" />
                    <Stat label="This shift" value={`🪙 ${Math.floor(state.sessionEarnings)}`} color="#facc15" />
                  </div>

                  <div style={{ marginTop: 14, background: '#0b1220', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                    {state.clockedIn ? (
                      <>
                        <div style={{ color: '#34d399', fontWeight: 900, fontSize: 14 }}>● ON SHIFT {state.nearJob ? '' : '(left building — earnings paused)'}</div>
                        <button onClick={() => clockOut()} style={{ marginTop: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 800, cursor: 'pointer' }}>Clock Out</button>
                      </>
                    ) : (
                      <>
                        <div style={{ color: state.nearJob ? '#34d399' : '#94a3b8', fontSize: 13 }}>
                          {state.nearJob ? `You're at the ${job.building} — ready to work!` : `Go to the ${job.building} to start your shift.`}
                        </div>
                        <button onClick={() => clockIn()} disabled={!state.nearJob}
                          style={{ marginTop: 10, background: state.nearJob ? '#22c55e' : '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 800, cursor: state.nearJob ? 'pointer' : 'not-allowed', opacity: state.nearJob ? 1 : 0.6 }}>
                          Clock In
                        </button>
                        <div style={{ color: '#475569', fontSize: 11, marginTop: 8 }}>Tip: press <b>F</b> near the {job.building} to clock in/out.</div>
                      </>
                    )}
                  </div>

                  <button onClick={() => { if (confirm('Quit your job? You can re-apply later.')) quitJob() }}
                    style={{ marginTop: 14, width: '100%', background: 'none', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Quit Job
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 12px' }}>
                  <div style={{ fontSize: 44 }}>📋</div>
                  <div style={{ marginTop: 10, fontWeight: 700 }}>You're unemployed.</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Head to the Job Board and apply for a role.</div>
                  <button onClick={() => setTab('board')} style={{ marginTop: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 800, cursor: 'pointer' }}>Browse Jobs</button>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {interviewing && (
        <InterviewPanel
          job={interviewing}
          playerName={playerName}
          onClose={() => setInterviewing(null)}
          onHired={() => { setInterviewing(null); setTab('myjob') }}
        />
      )}
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: '#0b1220', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ color, fontWeight: 900, fontSize: 15 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function JobsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Jobs"
      className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
      style={{ background: 'rgba(37,99,235,0.85)', border: '1.5px solid rgba(37,99,235,0.5)', boxShadow: '0 2px 12px rgba(37,99,235,0.4)' }}
    >💼</button>
  )
}
