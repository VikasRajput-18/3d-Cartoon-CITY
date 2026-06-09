// Job system (Phase 1 — core loop): find a job, pass a Groq AI interview, clock in
// at the job's building, earn salary per minute, track performance. Persists the
// player's employment in Supabase `player_jobs` (+ localStorage fallback) and logs
// pay to `salary_history`. Business/leaves/bonus/tax/promotions come in later phases.

import { supabase } from './supabase'
import { addCoins } from './economyState'
import { minimapState } from './minimapState'

// ── The 8 jobs (mirrors the seeded `jobs` table; coords are client-side, matched
//    to the building positions in PLACES / CityMap). ───────────────────────────
export const JOBS = [
  { id: 'chef',     title: 'Cafe Chef',        dept: 'Food & Beverage', rate: 8,  max: 3, skills: ['cooking', 'creativity'],   building: 'Cafe',        x: -14, z: -14, emoji: '👨‍🍳', desc: 'Prepare food and serve customers at the city cafe.' },
  { id: 'dj',       title: 'Club DJ',          dept: 'Entertainment',   rate: 12, max: 2, skills: ['music', 'energy'],         building: 'Music Room',  x:  14, z:  14, emoji: '🎧', desc: 'Play music and keep the vibe alive at the music room.' },
  { id: 'security', title: 'Security Guard',   dept: 'Public Safety',   rate: 7,  max: 4, skills: ['strength', 'discipline'],  building: 'Arcade',      x:  14, z: -14, emoji: '💂', desc: 'Keep order and protect the arcade from troublemakers.' },
  { id: 'teacher',  title: 'City Teacher',     dept: 'Education',        rate: 9,  max: 2, skills: ['knowledge', 'patience'],   building: 'Park',        x:   0, z:  16, emoji: '👩‍🏫', desc: 'Teach skills to new players at the park.' },
  { id: 'mechanic', title: 'Vehicle Mechanic', dept: 'Automotive',      rate: 10, max: 2, skills: ['technical', 'vehicles'],   building: 'Gas Station', x: -16, z:  22, emoji: '🔧', desc: 'Fix and upgrade vehicles for other players.' },
  { id: 'banker',   title: 'City Banker',      dept: 'Finance',         rate: 15, max: 1, skills: ['math', 'trust'],           building: 'City Hall',   x:   0, z: -24, emoji: '🏦', desc: 'Manage city finances and approve business loans.' },
  { id: 'reporter', title: 'News Reporter',    dept: 'Media',           rate: 8,  max: 2, skills: ['writing', 'communication'],building: 'City Hall',   x:   0, z: -24, emoji: '📰', desc: 'Report on city events and player activities.' },
  { id: 'doctor',   title: 'City Doctor',      dept: 'Healthcare',      rate: 14, max: 2, skills: ['care', 'knowledge'],       building: 'Hospital',    x:  32, z: -24, emoji: '⚕️', desc: 'Heal players and manage city health.' },
]
const _jobById = Object.fromEntries(JOBS.map(j => [j.id, j]))
export function getJobDef(id) { return _jobById[id] || null }

const CLOCK_RADIUS = 8   // must be within this many units of the building to clock in / earn

// ── Module state ───────────────────────────────────────────────────────────────
const _s = {
  uid: null, name: null,
  job: null,            // { id, salary, level, performance, totalHours, ...def } or null
  clockedIn: false,
  shiftStart: 0,
  nearJob: false,
  sessionEarnings: 0,   // coins earned this shift (float, display)
  accrued: 0,           // sub-coin accumulator awaiting whole-coin payout
  slots: {},            // jobId → count employed (best-effort)
  listeners: new Set(),
  tick: null,
  inited: false,
}

function emit() { const st = getJobState(); _s.listeners.forEach(fn => fn(st)) }
export function onJobUpdate(fn) { _s.listeners.add(fn); return () => _s.listeners.delete(fn) }

export function getJobState() {
  return {
    job: _s.job ? { ..._s.job } : null,
    clockedIn: _s.clockedIn,
    nearJob: _s.nearJob,
    sessionEarnings: _s.sessionEarnings,
    rate: _s.job ? _s.job.salary : 0,
    perMinute: _s.job ? +(_s.job.salary / 60).toFixed(2) : 0,
    performance: _s.job?.performance ?? 100,
  }
}

const _lsKey = () => `job_${_s.uid}`
function _saveLocal() {
  if (!_s.uid || !_s.job) { try { localStorage.removeItem(_lsKey()) } catch {}; return }
  try { localStorage.setItem(_lsKey(), JSON.stringify({ id: _s.job.id, salary: _s.job.salary, level: _s.job.level, performance: _s.job.performance, totalHours: _s.job.totalHours })) } catch {}
}

function _mergeJob(row) {
  if (!row) return null
  const def = _jobById[row.job_id || row.id]
  if (!def) return null
  return {
    ...def,
    id: def.id,
    salary: row.salary ?? def.rate,
    level: row.level ?? 1,
    performance: row.performance_score ?? row.performance ?? 100,
    totalHours: row.total_hours_worked ?? row.totalHours ?? 0,
    hiredAt: row.hired_at ?? null,
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────
export async function initJobs(uid = null, name = null) {
  if (uid) _s.uid = uid
  if (name) _s.name = name
  if (_s.inited) return
  _s.inited = true

  await fetchMyJob()

  // 1 Hz tick: proximity to the job building, and salary accrual while on shift.
  _s.tick = setInterval(_tick, 1000)

  // Clock in / out with F when standing near your job building (ignored while typing).
  window.addEventListener('keydown', _onKey)
  emit()
}

function _onKey(e) {
  if (e.code !== 'KeyF') return
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (!_s.job || !_s.nearJob) return
  if (_s.clockedIn) clockOut(); else clockIn()
}

function _tick() {
  if (!_s.job) return
  const d = Math.hypot(minimapState.playerX - _s.job.x, minimapState.playerZ - _s.job.z)
  const near = d <= CLOCK_RADIUS
  if (near !== _s.nearJob) { _s.nearJob = near; emit() }

  // Earn only while clocked in AND physically at the building.
  if (_s.clockedIn && near) {
    const perSec = _s.job.salary / 3600
    _s.accrued += perSec
    _s.sessionEarnings += perSec
    if (_s.accrued >= 1) {
      const pay = Math.floor(_s.accrued)
      _s.accrued -= pay
      addCoins(pay)            // non-raw → live-event double-coins also boosts wages
      _logSalary(pay, 'salary', `${_s.job.title} shift`)
      window.dispatchEvent(new CustomEvent('job-salary', { detail: { amount: pay, title: _s.job.title } }))
    }
    emit()
  }
}

// ── Fetch / employment ──────────────────────────────────────────────────────────
export async function fetchMyJob() {
  let row = null
  if (supabase && _s.uid) {
    try {
      const { data } = await supabase.from('player_jobs').select('*').eq('player_id', _s.uid).maybeSingle()
      row = data
    } catch {}
  }
  if (!row) {
    try { const raw = localStorage.getItem(_lsKey()); if (raw) row = JSON.parse(raw) } catch {}
  }
  _s.job = _mergeJob(row)
  _saveLocal()
  emit()
  return _s.job
}

/** Count how many players hold each job (best-effort) so the board can show slots. */
export async function fetchJobSlots() {
  if (supabase) {
    try {
      const { data } = await supabase.from('player_jobs').select('job_id')
      const counts = {}
      ;(data || []).forEach(r => { counts[r.job_id] = (counts[r.job_id] || 0) + 1 })
      _s.slots = counts
    } catch {}
  }
  return _s.slots
}

export function isEmployed() { return !!_s.job }

export function canApply(jobId) {
  if (_s.job) return { ok: false, reason: 'You already have a job. Quit it first.' }
  const def = _jobById[jobId]
  if (!def) return { ok: false, reason: 'Unknown job' }
  const taken = _s.slots[jobId] || 0
  if (taken >= def.max) return { ok: false, reason: 'No slots left for this role' }
  return { ok: true }
}

/** Called when the AI interview decides to hire. Persists employment. */
export async function hireForJob(jobId, salary, score, transcript) {
  const def = _jobById[jobId]
  if (!def) return { ok: false }
  const finalSalary = Math.max(def.rate, Math.round(salary || def.rate))
  _s.job = { ...def, id: def.id, salary: finalSalary, level: 1, performance: 100, totalHours: 0, hiredAt: new Date().toISOString() }
  _saveLocal()

  if (supabase && _s.uid) {
    try {
      await supabase.from('player_jobs').upsert({
        player_id: _s.uid, job_id: jobId, salary: finalSalary, level: 1,
        hired_at: _s.job.hiredAt, performance_score: 100,
      }, { onConflict: 'player_id' })
    } catch {}
    try {
      await supabase.from('job_applications').insert({
        player_id: _s.uid, player_name: _s.name, job_id: jobId,
        status: 'hired', interview_transcript: transcript || null, ai_score: score ?? null,
        reviewed_at: new Date().toISOString(),
      })
    } catch {}
  }
  emit()
  return { ok: true, salary: finalSalary }
}

/** Record a rejected interview (so the spec's "try again later" can be enforced later). */
export async function recordRejection(jobId, score, transcript) {
  if (supabase && _s.uid) {
    try {
      await supabase.from('job_applications').insert({
        player_id: _s.uid, player_name: _s.name, job_id: jobId,
        status: 'rejected', interview_transcript: transcript || null, ai_score: score ?? null,
        reviewed_at: new Date().toISOString(),
      })
    } catch {}
  }
}

export async function quitJob() {
  if (!_s.job) return
  if (_s.clockedIn) clockOut()
  _s.job = null
  _saveLocal()
  if (supabase && _s.uid) {
    try { await supabase.from('player_jobs').delete().eq('player_id', _s.uid) } catch {}
  }
  emit()
}

// ── Shifts ───────────────────────────────────────────────────────────────────────
export function clockIn() {
  if (!_s.job || _s.clockedIn) return { ok: false }
  if (!_s.nearJob) return { ok: false, reason: `Go to the ${_s.job.building} to clock in` }
  _s.clockedIn = true
  _s.shiftStart = Date.now()
  _s.sessionEarnings = 0
  _s.accrued = 0
  window.dispatchEvent(new CustomEvent('job-clock', { detail: { in: true, title: _s.job.title } }))
  emit()
  return { ok: true }
}

export async function clockOut() {
  if (!_s.job || !_s.clockedIn) return { ok: false }
  _s.clockedIn = false
  const mins = Math.max(0, (Date.now() - _s.shiftStart) / 60000)
  _s.job.totalHours = (_s.job.totalHours || 0) + mins / 60
  _saveLocal()
  if (supabase && _s.uid) {
    try {
      await supabase.from('player_jobs').update({
        last_shift: new Date().toISOString(),
        total_hours_worked: Math.round(_s.job.totalHours),
      }).eq('player_id', _s.uid)
    } catch {}
  }
  window.dispatchEvent(new CustomEvent('job-clock', { detail: { in: false, title: _s.job.title, earned: Math.floor(_s.sessionEarnings) } }))
  emit()
  return { ok: true, earned: Math.floor(_s.sessionEarnings) }
}

function _logSalary(amount, type, description) {
  if (supabase && _s.uid) {
    supabase.from('salary_history').insert({ player_id: _s.uid, amount, type, description }).then(() => {}, () => {})
  }
}

/** Full salary history for the (future) payslip / finance tab. */
export async function fetchSalaryHistory(limit = 50) {
  if (!supabase || !_s.uid) return []
  try {
    const { data } = await supabase.from('salary_history')
      .select('*').eq('player_id', _s.uid).order('paid_at', { ascending: false }).limit(limit)
    return data || []
  } catch { return [] }
}
