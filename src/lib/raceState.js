// Single-player racing session manager (Phase 1: time trial).
//
// Two-tier state, mirroring the minimapState/houseService split used elsewhere:
//  - `_state` (React pub/sub via onRaceUpdate) for discrete, low-frequency events:
//    phase, lap, checkpoint index, countdown ticks, results.
//  - `raceLive` (plain mutable object, read every frame by RaceHUD via rAF —
//    same pattern as minimapState) for the fast-changing numeric readouts:
//    speed, elapsed time, next-checkpoint distance/bearing, wrong-way flag.
//
// Supabase tables (see project SQL): race_tracks, race_results.
import { supabase } from './supabase'
import { addCoins } from './economyState'
import { RACE_TRACKS, COIN_REWARD_BASE, RECORD_BONUS, PERSONAL_BEST_BONUS, CHECKPOINT_RADIUS } from './raceTracks'
import { clampToCircuit, posAtDistance, arcAtPosition, LOOP_LEN } from './raceCircuit'

export const raceLive = {
  speed:        0,      // km/h, vehicle-agnostic (derived from position delta)
  elapsed:      0,
  nextDist:     0,
  nextBearing:  0,      // world-space angle (atan2 convention matching vehicle facing)
  nextCheckpoint: null, // { x, z } — read by Minimap for the flag marker
  wrongWay:     false,
  position:     1,      // live race position (1 = leading)
  totalRacers:  1,
}

let _uid = null, _name = null
let _tracksCache = RACE_TRACKS.map(t => ({ ...t, bestTime: null, bestPlayer: null }))

let _state = {
  phase:        'idle',   // idle | countdown | racing | finished
  trackId:      null,
  track:        null,
  lap:          1,
  checkpointIndex: 0,
  countdown:    0,
  personalBest: null,
  result:       null,
}

const _subs = new Set()
function emit() { _subs.forEach(fn => { try { fn(_state) } catch {} }) }
function set(p) { _state = { ..._state, ...p }; emit() }
export function onRaceUpdate(fn) { _subs.add(fn); fn(_state); return () => _subs.delete(fn) }
export function getRaceState() { return _state }
export function getTracksList() { return _tracksCache }

// ── Init: seed track rows (static fields only — never clobbers best_time) ─────
export async function initRaceState(uid, name) {
  _uid = uid; _name = name
  if (!supabase) return
  try {
    await supabase.from('race_tracks').upsert(
      RACE_TRACKS.map(t => ({ id: t.id, name: t.name, checkpoints: t.checkpoints, laps: t.laps, difficulty: t.difficulty })),
      { onConflict: 'id' }
    )
    const { data } = await supabase.from('race_tracks').select('id,best_time,best_player')
    if (data) {
      const byId = new Map(data.map(r => [r.id, r]))
      _tracksCache = _tracksCache.map(t => ({
        ...t,
        bestTime:   byId.get(t.id)?.best_time   ?? null,
        bestPlayer: byId.get(t.id)?.best_player ?? null,
      }))
    }
  } catch {}
}

async function fetchPersonalBest(trackId) {
  if (!supabase || !_uid) return null
  try {
    const { data } = await supabase.from('race_results')
      .select('time_seconds').eq('player_id', _uid).eq('track_id', trackId)
      .order('time_seconds', { ascending: true }).limit(1)
    return data?.[0]?.time_seconds ?? null
  } catch { return null }
}

// ── Countdown → racing ─────────────────────────────────────────────────────────
let _countdownTimer = null
let _tickTimer       = null
let _startedAt        = 0
let _lastDist          = null
let _awayAccum         = 0
let _lastPos            = null
const WRONG_WAY_WINDOW  = 1.4   // seconds of sustained "getting farther" before flagging

// ── AI racers ──────────────────────────────────────────────────────────────
// Each AI follows the centreline by accumulating distance along the loop and
// reading its world position from posAtDistance(). Speed wobbles a little so the
// pack jostles. Player progress is tracked as monotonic distance-since-GO so the
// live ranking compares everyone on the same scale.
const AI_NAMES  = ['Bolt', 'Vega', 'Nova', 'Riggs', 'Ace']
const AI_COLORS = ['#3b82f6', '#f97316', '#a855f7', '#10b981', '#eab308']
const AI_COUNT  = 4
// Grid stagger (arc distance BEHIND the start line) + lateral lane offset. The AI
// line up AHEAD of the player's grid slot (~18 back) so they never overlap the
// parked grid cars and the player starts last, chasing the pack.
const AI_BACK   = [4, 8, 12, 16]
const AI_LANE   = [-4, 4, -4, 4]

let _ai = []
let _playerDist = 0
let _playerPrevArc = null

function _updateAIPos(a) {
  const p = posAtDistance(a.startArc + a.dist)
  a.x = p.x + (-p.tz) * a.lane
  a.z = p.z + ( p.tx) * a.lane
  a.yaw = p.yaw
}

function _initAI() {
  _ai = []
  _playerDist = 0
  _playerPrevArc = null
  for (let k = 0; k < AI_COUNT; k++) {
    const back = AI_BACK[k] ?? (8 + k * 5)
    const a = {
      id: 'ai' + k,
      name: AI_NAMES[k % AI_NAMES.length],
      color: AI_COLORS[k % AI_COLORS.length],
      type: k % 3 === 1 ? 'bike' : 'car',
      startArc: ((LOOP_LEN - back) % LOOP_LEN + LOOP_LEN) % LOOP_LEN,
      lane: AI_LANE[k] ?? 0,
      dist: 0,
      baseSpeed: 13.5 + Math.random() * 5.5,   // 13.5–19 units/s
      noise: Math.random() * 10,
      lap: 1,
      finished: false,
      finishTime: null,
      x: 0, z: 0, yaw: 0,
    }
    _updateAIPos(a)
    _ai.push(a)
  }
  raceLive.position = AI_COUNT + 1
  raceLive.totalRacers = AI_COUNT + 1
}

function _rank() {
  const entries = [{ id: 'player', dist: _playerDist }, ..._ai.map(a => ({ id: a.id, dist: a.dist }))]
  entries.sort((a, b) => b.dist - a.dist)
  return { entries, position: entries.findIndex(e => e.id === 'player') + 1, total: entries.length }
}

export function getAIRacers() { return _ai }

// Called every frame from RaceCircuit while racing.
export function tickAIRacers(px, pz, dt) {
  if (_state.phase !== 'racing' || !_state.track || dt <= 0) return
  const finishDist = _state.track.laps * LOOP_LEN
  const t = raceLive.elapsed
  for (const a of _ai) {
    if (a.finished) continue
    // Speed wobble — small mistakes + surges, so the pack is dynamic.
    const wobble = Math.sin((t + a.noise) * 1.3) * 1.4 + Math.sin((t + a.noise) * 0.5) * 0.9
    const spd = Math.max(6, a.baseSpeed + wobble)
    a.dist += spd * dt
    if (a.dist >= finishDist) { a.dist = finishDist; a.finished = true; a.finishTime = t }
    a.lap = Math.min(_state.track.laps, Math.floor(a.dist / LOOP_LEN) + 1)
    _updateAIPos(a)
  }
  // Player monotonic distance-since-GO (handles arc wrap at the start line).
  const pArc = arcAtPosition(px, pz)
  if (_playerPrevArc == null) _playerPrevArc = pArc
  let dA = pArc - _playerPrevArc
  if (dA < -LOOP_LEN / 2) dA += LOOP_LEN
  else if (dA > LOOP_LEN / 2) dA -= LOOP_LEN
  _playerDist += dA
  _playerPrevArc = pArc

  const r = _rank()
  raceLive.position = r.position
  raceLive.totalRacers = r.total
}

export async function startRace(trackId) {
  const track = _tracksCache.find(t => t.id === trackId)
  if (!track || _state.phase !== 'idle') return
  const personalBest = await fetchPersonalBest(trackId)
  _lastDist = null; _awayAccum = 0; _lastPos = null
  _initAI()
  Object.assign(raceLive, { speed: 0, elapsed: 0, nextDist: 0, nextBearing: 0, wrongWay: false, nextCheckpoint: track.checkpoints[0] })
  set({ phase: 'countdown', trackId, track, lap: 1, checkpointIndex: 0, countdown: 3, personalBest, result: null })
  clearInterval(_countdownTimer)
  _countdownTimer = setInterval(() => {
    const c = _state.countdown - 1
    if (c <= 0) { clearInterval(_countdownTimer); beginRacing() }
    else set({ countdown: c })
  }, 1000)
}

function beginRacing() {
  _startedAt = Date.now()
  raceLive.elapsed = 0
  // Target the FIRST gate after the start line. The start/finish line (gate 0)
  // becomes the lap boundary — you complete a lap by crossing it again.
  set({ phase: 'racing', countdown: 0, checkpointIndex: 1 })
  clearInterval(_tickTimer)
  _tickTimer = setInterval(() => {
    if (_state.phase === 'racing') raceLive.elapsed = (Date.now() - _startedAt) / 1000
  }, 100)
}

export function cancelRace() {
  clearInterval(_countdownTimer); clearInterval(_tickTimer)
  _ai = []
  Object.assign(raceLive, { speed: 0, elapsed: 0, nextDist: 0, nextBearing: 0, wrongWay: false, nextCheckpoint: null, position: 1, totalRacers: 1 })
  set({ phase: 'idle', trackId: null, track: null, result: null })
}

// ── Per-frame update, called from RaceCircuit.jsx's useFrame ──────────────────
// px/pz = local player or vehicle world position; dt = frame delta seconds.
export function updateRaceFrame(px, pz, dt) {
  if (_state.phase !== 'racing' || !_state.track) return

  if (_lastPos && dt > 0) {
    const d = Math.hypot(px - _lastPos.x, pz - _lastPos.z)
    const kmh = (d / dt) * 3.6
    raceLive.speed = raceLive.speed + (kmh - raceLive.speed) * Math.min(1, dt * 6) // smoothed
  }
  _lastPos = { x: px, z: pz }

  const cp = _state.track.checkpoints[_state.checkpointIndex]
  const dx = cp.x - px, dz = cp.z - pz
  const dist = Math.hypot(dx, dz)

  if (_lastDist != null) {
    if (dist > _lastDist + 0.02) _awayAccum += dt
    else _awayAccum = Math.max(0, _awayAccum - dt * 2)
  }
  _lastDist = dist

  raceLive.nextDist       = dist
  raceLive.nextBearing    = Math.atan2(dx, dz)
  raceLive.nextCheckpoint = cp
  raceLive.wrongWay       = _awayAccum > WRONG_WAY_WINDOW && raceLive.speed > 8

  if (dist < CHECKPOINT_RADIUS) {
    _awayAccum = 0; _lastDist = null
    advanceCheckpoint()
  }
}

function advanceCheckpoint() {
  const track = _state.track
  const N = track.checkpoints.length
  const cur = _state.checkpointIndex

  // Crossing gate 0 (the start/finish line) is the lap boundary.
  if (cur === 0) {
    if (_state.lap >= track.laps) { finishRace(); return }
    const newLap = _state.lap + 1
    set({ lap: newLap, checkpointIndex: 1 })
    window.dispatchEvent(new CustomEvent('race-lap-complete', { detail: { lap: newLap, finalLap: newLap >= track.laps } }))
    return
  }

  // Otherwise advance to the next gate; after the last gate, target the finish line (0).
  const next = (cur + 1) % N
  set({ checkpointIndex: next })
  window.dispatchEvent(new CustomEvent('race-checkpoint-passed'))
}

async function finishRace() {
  clearInterval(_tickTimer)
  const time  = raceLive.elapsed
  const track = _state.track
  const isPersonalBest = _state.personalBest == null || time < _state.personalBest
  const isTrackRecord  = track.bestTime == null || time < track.bestTime

  // Final standings (player vs AI by distance travelled). Winning (P1) pays more.
  const r = _rank()
  const won = r.position === 1

  const baseCoins = COIN_REWARD_BASE[track.difficulty] ?? 30
  const bonus     = (isTrackRecord ? RECORD_BONUS : isPersonalBest ? PERSONAL_BEST_BONUS : 0) + (won ? 40 : 0)
  const coins     = baseCoins + bonus
  addCoins(coins)

  if (supabase && _uid) {
    try {
      await supabase.from('race_results').insert({
        player_id: _uid, player_name: _name, track_id: track.id,
        time_seconds: time, position: r.position, is_multiplayer: false,
      })
      if (isTrackRecord) {
        await supabase.from('race_tracks').update({ best_time: time, best_player: _name }).eq('id', track.id)
        track.bestTime = time; track.bestPlayer = _name
      }
    } catch {}
  }

  raceLive.nextCheckpoint = null
  set({ phase: 'finished', result: { time, isPersonalBest, isTrackRecord, coins, trackName: track.name, position: r.position, totalRacers: r.total } })
}

export function exitResults() {
  _ai = []
  Object.assign(raceLive, { position: 1, totalRacers: 1 })
  set({ phase: 'idle', trackId: null, track: null, result: null })
}

// ── Track containment (called from the vehicle loops in WorldCanvas) ──────────
// Only active during a race (countdown + racing) so normal city driving is never
// affected. Returns null when inactive, else { x, z, hit } from the circuit clamp.
export function applyTrackContainment(x, z) {
  if (_state.phase !== 'racing' && _state.phase !== 'countdown') return null
  return clampToCircuit(x, z)
}
