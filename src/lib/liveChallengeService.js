// Live 1v1 challenge system.
//
// Lifecycle (pending → active → finished) is stored in the `live_challenges`
// Supabase table so the opponent gets a realtime notification and can accept.
// The fast per-tick game state during a live match is sent over a Supabase
// *broadcast* channel (not DB writes) so it stays cheap and smooth — the DB row
// only records the final scores + winner for the record.
//
// NPC challenges run fully locally (no Supabase opponent); the right-hand side is
// an AI sim and its score is fed in via setLiveOpponentScore.
import { supabase } from './supabase'
import { getEconomyState, addCoins, spendCoins } from './economyState'

const ACCEPT_WINDOW = 60   // seconds to accept
const WIN_REWARD    = 25
const CONSOLATION   = 5

let _my = { id: null, name: null }
let _role = null            // 'challenger' | 'opponent'
let _npc = false
let _gameCh = null          // per-match broadcast channel
let _lobbyCh = null         // lifecycle channel
let _expiry = null          // accept-window timer
let _watch = null           // disconnect watchdog
let _lastOpp = 0
let _myFinal = null, _oppFinal = null
let _resolved = false

let _state = {
  phase: 'idle',            // idle|outgoing|incoming|npc-accepting|active|result|declined
  challenge: null,
  stake: 0,
  endsAt: 0,
  myScore: 0,
  opponentScore: 0,
  opponentState: null,
  result: null,
}
const _subs = new Set()
function emit() { _subs.forEach(cb => { try { cb(_state) } catch {} }) }
function set(p) { _state = { ..._state, ...p }; emit() }
export function onLiveUpdate(cb) { _subs.add(cb); cb(_state); return () => _subs.delete(cb) }
export function getLiveState() { return _state }

// ── init: subscribe to the lobby for incoming + lifecycle updates ─────────────
export function initLiveChallenges(myId, myName) {
  _my = { id: myId, name: myName }
  if (!supabase || _lobbyCh) return
  _lobbyCh = supabase
    .channel('live-lobby-' + myId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_challenges', filter: `opponent_id=eq.${myId}` },
      ({ new: row }) => { if (row.status === 'pending') onIncoming(row) })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_challenges', filter: `opponent_id=eq.${myId}` },
      ({ new: row }) => onRowUpdate(row))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_challenges', filter: `challenger_id=eq.${myId}` },
      ({ new: row }) => onRowUpdate(row))
    .subscribe()
}

function onIncoming(row) {
  if (_state.phase !== 'idle') return   // one at a time — silently ignore
  set({ phase: 'incoming', challenge: row, stake: row.challenger_state?.stake || 0 })
  clearTimeout(_expiry)
  _expiry = setTimeout(() => { if (_state.phase === 'incoming') reset() }, ACCEPT_WINDOW * 1000)
}

function onRowUpdate(row) {
  const cur = _state.challenge
  if (!cur || row.id !== cur.id) return
  if (_role === 'challenger' && _state.phase === 'outgoing') {
    if (row.status === 'active') startActive(row, 'challenger')
    else if (row.status === 'declined') { set({ phase: 'declined' }); setTimeout(reset, 1800) }
  } else if (_state.phase === 'incoming') {
    if (row.status !== 'pending') reset()   // challenger cancelled/expired
  }
}

// ── send (real opponent) ──────────────────────────────────────────────────────
export async function sendLiveChallenge({ opponentId, opponentName, gameId, stake = 0 }) {
  if (!supabase) return { ok: false, reason: 'Multiplayer not configured' }
  if (stake > 0 && getEconomyState().coins < stake) return { ok: false, reason: 'Not enough coins for that stake' }
  const { data, error } = await supabase.from('live_challenges').insert({
    challenger_id: _my.id, challenger_name: _my.name,
    opponent_id: opponentId, opponent_name: opponentName,
    game_id: gameId, status: 'pending', duration_seconds: 60,
    challenger_state: { stake },
  }).select().single()
  if (error || !data) return { ok: false, reason: 'Could not send challenge' }
  _role = 'challenger'; _npc = false
  set({ phase: 'outgoing', challenge: data, stake })
  clearTimeout(_expiry)
  _expiry = setTimeout(() => cancelOutgoing('expired'), ACCEPT_WINDOW * 1000)
  return { ok: true }
}

// ── send (NPC opponent — fully local) ─────────────────────────────────────────
export function sendNpcChallenge({ opponentName, gameId, stake = 0 }) {
  if (stake > 0 && getEconomyState().coins < stake) return { ok: false, reason: 'Not enough coins for that stake' }
  _role = 'challenger'; _npc = true
  const fake = {
    id: 'npc-' + Date.now(), challenger_id: _my.id, challenger_name: _my.name,
    opponent_id: 'npc', opponent_name: opponentName, game_id: gameId, duration_seconds: 60,
  }
  set({ phase: 'npc-accepting', challenge: fake, stake })
  setTimeout(() => {
    if (_state.phase !== 'npc-accepting') return
    startActive({ ...fake, ends_at: new Date(Date.now() + 60000).toISOString() }, 'challenger')
  }, 1600)
  return { ok: true }
}

export async function acceptChallenge() {
  const row = _state.challenge
  if (!row) return
  clearTimeout(_expiry)
  const now = Date.now(), ends = now + (row.duration_seconds || 60) * 1000
  if (supabase) {
    await supabase.from('live_challenges').update({
      status: 'active', opponent_ready: true,
      started_at: new Date(now).toISOString(), ends_at: new Date(ends).toISOString(),
    }).eq('id', row.id)
  }
  startActive({ ...row, status: 'active', ends_at: new Date(ends).toISOString() }, 'opponent')
}

export async function declineChallenge() {
  const row = _state.challenge
  if (row && supabase && !_npc) await supabase.from('live_challenges').update({ status: 'declined' }).eq('id', row.id)
  reset()
}

export function cancelOutgoing(reason = 'cancelled') {
  const row = _state.challenge
  if (row && supabase && !_npc) supabase.from('live_challenges').update({ status: reason }).eq('id', row.id)
  reset()
}

// ── active match ──────────────────────────────────────────────────────────────
function startActive(row, role) {
  clearTimeout(_expiry)
  _role = role
  _myFinal = _oppFinal = null
  _resolved = false
  _lastOpp = Date.now()
  const ends = row.ends_at ? new Date(row.ends_at).getTime() : Date.now() + 60000
  const stake = row.challenger_state?.stake ?? _state.stake ?? 0
  // your opponent is the OTHER party in the row, depending on which side you are
  const oppName = role === 'challenger' ? row.opponent_name : row.challenger_name
  set({ phase: 'active', challenge: row, endsAt: ends, myScore: 0, opponentScore: 0, opponentState: null, stake, oppName })
  if (!_npc && supabase) {
    _gameCh = supabase.channel('live-game-' + row.id)
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (payload.from === _my.id) return
        _lastOpp = Date.now()
        set({ opponentState: payload.state, opponentScore: payload.score ?? _state.opponentScore })
      })
      .on('broadcast', { event: 'final' }, ({ payload }) => {
        if (payload.from === _my.id) return
        _oppFinal = payload.score; maybeResolve()
      })
      .subscribe()
    // disconnect watchdog — no opponent state for 7s during the match → win by default
    _watch = setInterval(() => {
      if (_state.phase === 'active' && Date.now() - _lastOpp > 7000) opponentLeft()
    }, 1500)
  }
}

// broadcast my live state (called ~3–4×/s by the game). Cheap broadcast, no DB.
export function broadcastLiveState(state, score) {
  if (_state.myScore !== score) set({ myScore: score })
  if (_npc || !_gameCh) return
  _gameCh.send({ type: 'broadcast', event: 'state', payload: { from: _my.id, state, score } })
}

// NPC right-side AI feeds its score here
export function setLiveOpponentScore(score) {
  if (_state.opponentScore !== score) set({ opponentScore: score })
}

export function finishLive(score) {
  _myFinal = score
  set({ myScore: score })
  if (_npc) { _oppFinal = _state.opponentScore; maybeResolve(); return }
  if (_gameCh) _gameCh.send({ type: 'broadcast', event: 'final', payload: { from: _my.id, score } })
  if (supabase && _state.challenge) {
    const col = _role === 'challenger' ? 'challenger_score' : 'opponent_score'
    supabase.from('live_challenges').update({ [col]: score }).eq('id', _state.challenge.id)
  }
  maybeResolve()
  // if the opponent's final never arrives, resolve anyway after a grace window
  setTimeout(() => { if (!_resolved) { _oppFinal = _oppFinal ?? _state.opponentScore; maybeResolve() } }, 4000)
}

function opponentLeft() {
  if (_resolved) return
  _myFinal = _state.myScore
  _oppFinal = -1   // forfeit
  maybeResolve(true)
}

function maybeResolve(forfeit = false) {
  if (_resolved) return
  if (_myFinal == null || _oppFinal == null) return
  _resolved = true
  const tie = !forfeit && _myFinal === _oppFinal
  const iWon = forfeit || _myFinal > _oppFinal
  const stake = _state.stake || 0
  let delta = 0
  if (tie) delta = 0
  else if (iWon) { delta = stake + WIN_REWARD; addCoins(delta) }
  else {
    if (stake > 0) spendCoins(Math.min(stake, getEconomyState().coins))
    addCoins(CONSOLATION)
    delta = CONSOLATION - stake
  }
  if (_role === 'challenger' && !_npc && supabase && _state.challenge) {
    const winId = tie ? null : (iWon ? _my.id : _state.challenge.opponent_id)
    supabase.from('live_challenges').update({ status: 'finished', winner_id: winId }).eq('id', _state.challenge.id)
  }
  set({ phase: 'result', result: { iWon, tie, forfeit, myScore: _myFinal, oppScore: Math.max(0, _oppFinal), delta } })
  cleanupGame()
}

export function dismissResult() { reset() }

function cleanupGame() {
  if (_gameCh && supabase) supabase.removeChannel(_gameCh)
  _gameCh = null
  clearInterval(_watch); _watch = null
}

function reset() {
  clearTimeout(_expiry); cleanupGame()
  _role = null; _npc = false; _myFinal = _oppFinal = null; _resolved = false
  set({ phase: 'idle', challenge: null, stake: 0, endsAt: 0, myScore: 0, opponentScore: 0, opponentState: null, result: null })
}
