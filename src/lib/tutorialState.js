// First-time-player onboarding tutorial state.
// Requires: ALTER TABLE players ADD COLUMN IF NOT EXISTS tutorial_completed boolean DEFAULT false;
//
// Persistence model:
//  - localStorage `clu_tutorial_done_<uid>`  → never reshow once true (source of truth for gating)
//  - localStorage `clu_tutorial_step`        → resume mid-tutorial
//  - Supabase players.tutorial_completed     → cross-device flag (best-effort)
import { supabase } from './supabase'
import { addCoins, addGems } from './economyState'

export const TUTORIAL_STEP_COUNT = 12

const FULL_REWARD    = { coins: 200, gems: 5, badge: 'newcomer' }
const SKIP_REWARD    = { coins: 100, gems: 0, badge: null }

const _s = {
  uid:       null,
  active:    false,
  step:      0,        // 0-based index
  completed: false,
  listeners: new Set(),
}

function emit() { _s.listeners.forEach(fn => fn(getTutorialState())) }

export function onTutorialUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getTutorialState() {
  return { active: _s.active, step: _s.step, completed: _s.completed, total: TUTORIAL_STEP_COUNT }
}

// ── localStorage keys ────────────────────────────────────────────────────────
const doneKey = (uid) => `clu_tutorial_done_${uid}`
const STEP_KEY = 'clu_tutorial_step'

function _saveStep() { try { localStorage.setItem(STEP_KEY, String(_s.step)) } catch {} }
function _loadStep() {
  try { const v = parseInt(localStorage.getItem(STEP_KEY) ?? '0', 10); return isNaN(v) ? 0 : v } catch { return 0 }
}

// ── Init on login ────────────────────────────────────────────────────────────
export async function initTutorial(uid) {
  if (!uid) return
  _s.uid = uid

  // localStorage gate first (instant, offline-safe)
  let doneLocal = false
  try { doneLocal = localStorage.getItem(doneKey(uid)) === 'true' } catch {}
  if (doneLocal) { _s.completed = true; _s.active = false; emit(); return }

  // Check Supabase
  let doneRemote = false
  if (supabase) {
    try {
      const { data } = await supabase.from('players').select('tutorial_completed').eq('id', uid).maybeSingle()
      doneRemote = data?.tutorial_completed === true
    } catch {}
  }

  if (doneRemote) {
    _s.completed = true; _s.active = false
    try { localStorage.setItem(doneKey(uid), 'true') } catch {}
    emit(); return
  }

  // Not completed → start / resume
  _s.completed = false
  _s.step      = Math.min(_loadStep(), TUTORIAL_STEP_COUNT - 1)
  _s.active    = true
  emit()
}

// ── Navigation ───────────────────────────────────────────────────────────────
export function nextStep() {
  if (_s.step < TUTORIAL_STEP_COUNT - 1) {
    _s.step++
    _saveStep(); emit()
  }
}

export function prevStep() {
  if (_s.step > 0) {
    _s.step--
    _saveStep(); emit()
  }
}

export function goToStep(n) {
  _s.step = Math.max(0, Math.min(n, TUTORIAL_STEP_COUNT - 1))
  _saveStep(); emit()
}

// ── Finish ───────────────────────────────────────────────────────────────────
async function _persistComplete() {
  if (_s.uid) { try { localStorage.setItem(doneKey(_s.uid), 'true') } catch {} }
  try { localStorage.removeItem(STEP_KEY) } catch {}
  if (supabase && _s.uid) {
    try {
      await supabase.from('players')
        .upsert({ id: _s.uid, tutorial_completed: true }, { onConflict: 'id' })
    } catch {}
  }
}

/** Finish the tutorial normally — grants the full welcome reward. */
export async function completeTutorial() {
  _s.active = false
  _s.completed = true
  emit()
  const r = FULL_REWARD
  if (r.coins) addCoins(r.coins)
  if (r.gems)  addGems(r.gems)
  if (r.badge) _grantBadge(r.badge)
  await _persistComplete()
  return r
}

/** Skip the tutorial — grants a reduced reward but still never reshows. */
export async function skipTutorial() {
  _s.active = false
  _s.completed = true
  emit()
  const r = SKIP_REWARD
  if (r.coins) addCoins(r.coins)
  await _persistComplete()
  return r
}

/** Replay from the start (does not reset the completed flag until finished again). */
export function replayTutorial() {
  _s.step = 0
  _s.active = true
  _saveStep(); emit()
}

function _grantBadge(badge) {
  try {
    const raw = localStorage.getItem('clu_badges')
    const badges = raw ? JSON.parse(raw) : []
    if (!badges.includes(badge)) {
      badges.push(badge)
      localStorage.setItem('clu_badges', JSON.stringify(badges))
    }
  } catch {}
}

export function getBadges() {
  try { return JSON.parse(localStorage.getItem('clu_badges') || '[]') } catch { return [] }
}

// ── Returning-player feature tips ────────────────────────────────────────────
export function isTipSeen(id) {
  try { return localStorage.getItem(`clu_tip_${id}`) === 'true' } catch { return true }
}
export function markTipSeen(id) {
  try { localStorage.setItem(`clu_tip_${id}`, 'true') } catch {}
}
