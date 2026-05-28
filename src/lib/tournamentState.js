// Auto-tournament system — one tournament every 2 hours, per-game rotation.
// Tournaments are created client-side: the first player to open GameHub creates
// the next slot when none exists. Status lifecycle:
//   upcoming → registering (15 min before start) → active (30 min) → completed
import { supabase } from './supabase'
import { spendCoins, addCoins } from './economyState'
import { GAME_IDS } from './gameState'

const TWO_HOURS_MS     = 2 * 60 * 60 * 1000
const REG_WINDOW_MS    = 15 * 60 * 1000    // 15 min before start
const PLAY_WINDOW_MS   = 30 * 60 * 1000    // 30 min of play

const ENTRY_FEE   = 5
const PRIZE_1ST   = 500
const PRIZE_2ND   = 200
const PRIZE_3RD   = 100

// Aligned to even 2-hour UTC slots (00:00, 02:00, ..., 22:00)
function nextTournamentStart() {
  const now  = Date.now()
  const next = Math.ceil(now / TWO_HOURS_MS) * TWO_HOURS_MS
  return new Date(next)
}

function gameForStart(startIso) {
  const slot = Math.floor(new Date(startIso).getTime() / TWO_HOURS_MS)
  return GAME_IDS[slot % GAME_IDS.length]
}

// ── Module state ───────────────────────────────────────────────────────────────
const _t = {
  current:    null,   // 'registering' | 'active' tournament row
  upcoming:   null,   // 'upcoming' tournament row
  liveScores: [],
  myId:       null,
  listeners:  new Set(),
  pollTimer:  null,
}

function emit() { _t.listeners.forEach(fn => fn(getTournamentState())) }

export function onTournamentUpdate(fn) {
  _t.listeners.add(fn)
  return () => _t.listeners.delete(fn)
}

export function getTournamentState() {
  const t = _t.current ?? _t.upcoming
  return {
    current:    _t.current  ? { ..._t.current  } : null,
    upcoming:   _t.upcoming ? { ..._t.upcoming } : null,
    liveScores: [..._t.liveScores],
    isJoined:   isJoined(),
    countdownMs: t ? countdownMs(t) : null,
  }
}

export function isJoined() {
  if (!_t.current || !_t.myId) return false
  const parts = _t.current.participants || []
  return parts.some(p => p.id === _t.myId)
}

function countdownMs(t) {
  const now = Date.now()
  const target = (t.status === 'active')
    ? new Date(t.ends_at).getTime()
    : new Date(t.starts_at).getTime()
  return Math.max(0, target - now)
}

export function fmtCountdown(ms) {
  if (ms == null || ms <= 0) return '00:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Init & polling ─────────────────────────────────────────────────────────────
export async function initTournaments(uid) {
  _t.myId = uid
  await _refresh()
  await _ensureNext()

  if (supabase) {
    supabase.channel('tourn_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => _refresh())
      .subscribe()
    supabase.channel('tourn_scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_scores' }, () => _refreshScores())
      .subscribe()
  }

  // Poll every 15 s to advance status and keep countdown fresh
  if (_t.pollTimer) clearInterval(_t.pollTimer)
  _t.pollTimer = setInterval(() => _tick(), 15000)
}

async function _refresh() {
  if (!supabase) { emit(); return }
  try {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['upcoming', 'registering', 'active'])
      .order('starts_at', { ascending: true })
      .limit(5)

    _t.current  = data?.find(t => t.status === 'registering' || t.status === 'active') ?? null
    _t.upcoming = data?.find(t => t.status === 'upcoming') ?? null
    if (_t.current) await _refreshScores()
    emit()
  } catch { emit() }
}

async function _refreshScores() {
  if (!supabase || !_t.current) return
  try {
    const { data } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', _t.current.id)
      .order('score', { ascending: false })
    _t.liveScores = data || []
    emit()
  } catch {}
}

async function _ensureNext() {
  if (!supabase) return
  try {
    const { data } = await supabase
      .from('tournaments')
      .select('id')
      .in('status', ['upcoming', 'registering'])
      .limit(1)
    if (data && data.length > 0) return

    const startsAt = nextTournamentStart()
    const endsAt   = new Date(startsAt.getTime() + PLAY_WINDOW_MS)
    await supabase.from('tournaments').insert({
      game_id:     gameForStart(startsAt.toISOString()),
      status:      'upcoming',
      starts_at:   startsAt.toISOString(),
      ends_at:     endsAt.toISOString(),
      entry_fee:   ENTRY_FEE,
      prize_1st:   PRIZE_1ST,
      prize_2nd:   PRIZE_2ND,
      prize_3rd:   PRIZE_3RD,
      participants: [],
    })
  } catch {}
}

async function _tick() {
  const now = Date.now()

  // Advance upcoming → registering
  if (_t.upcoming) {
    const ms = new Date(_t.upcoming.starts_at).getTime() - now
    if (ms > 0 && ms <= REG_WINDOW_MS) {
      await _setStatus(_t.upcoming.id, 'registering')
      window.dispatchEvent(new CustomEvent('tournament-registering', { detail: _t.upcoming }))
    }
  }

  // Advance registering → active
  if (_t.current?.status === 'registering') {
    const ms = new Date(_t.current.starts_at).getTime() - now
    if (ms <= 0) {
      await _setStatus(_t.current.id, 'active')
      const joined = isJoined()
      window.dispatchEvent(new CustomEvent('tournament-started', {
        detail: { ..._t.current, notifyPlayer: joined },
      }))
    }
  }

  // End active
  if (_t.current?.status === 'active') {
    if (new Date(_t.current.ends_at).getTime() <= now) {
      await _endTournament(_t.current)
    }
  }

  await _refresh()
}

async function _setStatus(id, status) {
  if (!supabase) return
  try { await supabase.from('tournaments').update({ status }).eq('id', id) } catch {}
}

async function _endTournament(t) {
  if (!supabase) return
  try {
    const { data: scores } = await supabase
      .from('tournament_scores')
      .select('*')
      .eq('tournament_id', t.id)
      .order('score', { ascending: false })

    if (scores?.length) {
      for (let i = 0; i < Math.min(3, scores.length); i++) {
        await supabase.from('tournament_scores')
          .update({ rank: i + 1 })
          .eq('id', scores[i].id)
      }
      // Award prizes to registered participants who are online via Supabase rpc or direct update
      // (actual coin award happens in claimTournamentPrize)
    }
    await supabase.from('tournaments').update({ status: 'completed' }).eq('id', t.id)
    window.dispatchEvent(new CustomEvent('tournament-ended', { detail: { ...t, scores } }))
    await _ensureNext()
  } catch {}
}

// ── Actions ────────────────────────────────────────────────────────────────────
export async function joinTournament(uid, name) {
  if (!_t.current || _t.current.status !== 'registering') return { ok: false, reason: 'Registration not open' }
  if (isJoined()) return { ok: false, reason: 'Already registered' }

  if (!spendCoins(ENTRY_FEE)) return { ok: false, reason: 'Not enough coins' }

  const participants = [...(_t.current.participants || []), { id: uid, name }]
  if (supabase) {
    try {
      await supabase.from('tournaments').update({ participants }).eq('id', _t.current.id)
      _t.current.participants = participants
      emit()
      return { ok: true, gameId: _t.current.game_id }
    } catch {
      addCoins(ENTRY_FEE)
      return { ok: false, reason: 'Failed to join' }
    }
  }
  _t.current.participants = participants
  emit()
  return { ok: true, gameId: _t.current.game_id }
}

export async function submitTournamentScore(uid, name, score) {
  if (!supabase || !_t.current || _t.current.status !== 'active') return
  try {
    await supabase.from('tournament_scores').upsert(
      { tournament_id: _t.current.id, player_id: uid, player_name: name, score, updated_at: new Date().toISOString() },
      { onConflict: 'tournament_id,player_id' }
    )
    window.dispatchEvent(new CustomEvent('ticker-event', {
      detail: { text: `${name} scored ${score} in the ${_t.current.game_id} tournament!` },
    }))
  } catch {}
}

export async function claimTournamentPrize(uid) {
  if (!supabase) return
  try {
    // Find completed tournaments where player ranked top 3 and hasn't claimed
    const { data } = await supabase
      .from('tournament_scores')
      .select('*, tournaments(prize_1st, prize_2nd, prize_3rd, game_id)')
      .eq('player_id', uid)
      .not('rank', 'is', null)
      .is('claimed', null)   // claimed column optional — handled gracefully
    if (!data?.length) return
    let totalPrize = 0
    for (const row of data) {
      const t = row.tournaments
      const prize = row.rank === 1 ? (t?.prize_1st ?? PRIZE_1ST)
                  : row.rank === 2 ? (t?.prize_2nd ?? PRIZE_2ND)
                  : (t?.prize_3rd ?? PRIZE_3RD)
      totalPrize += prize
    }
    if (totalPrize > 0) {
      addCoins(totalPrize)
      window.dispatchEvent(new CustomEvent('achievement', {
        detail: { text: `🏆 Tournament prize claimed: +${totalPrize} coins!` },
      }))
    }
  } catch {}
}

export function getTournamentGameId() {
  return _t.current?.game_id ?? null
}

export { ENTRY_FEE, PRIZE_1ST, PRIZE_2ND, PRIZE_3RD }
