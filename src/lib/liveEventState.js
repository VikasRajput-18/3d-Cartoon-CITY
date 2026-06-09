// City-wide live events — synchronized across ALL players via Supabase realtime.
// A scheduler (running on whichever client hits the top of the hour first) inserts
// a row into `live_events`; every client is subscribed to that table, so the INSERT
// is delivered to everyone simultaneously and they all activate the same event.
//
// Backwards-compatible API kept for existing consumers:
//   onLiveEventUpdate / getLiveEventState / initLiveEvents / treasureLocationForActive
//
// Multipliers (double-coins, speed-boost) are exposed as getters and wired into
// economyState (coins) and WorldCanvas (movement). Fixed rewards are granted with
// addCoins(..., { raw:true }) so they're never themselves multiplied / re-counted.

import { supabase } from './supabase'
import { addCoins, setCoinMultiplier, setOnCoinsEarned } from './economyState'

// ── The 8 event definitions ───────────────────────────────────────────────────
// `id` mirrors `type` so the existing LiveEvents.jsx visual switch (keyed on id)
// keeps working. duration = minutes. reward = fixed coin grant where applicable.
export const EVENT_TYPES = [
  { type: 'meteor_shower',      id: 'meteor_shower',      name: 'Meteor Shower!',                emoji: '☄️', color: '#a78bfa',
    description: 'A meteor shower is lighting up the sky for 5 minutes!',                         duration: 5,  reward: 25 },
  { type: 'treasure_hunt',      id: 'treasure_hunt',      name: 'Treasure Chest Spotted!',       emoji: '💎', color: '#facc15',
    description: 'A golden chest appeared somewhere in the city. First to find it wins 500 coins!', duration: 10, reward: 500 },
  { type: 'double_coins',       id: 'double_coins',       name: 'Double Coins Hour!',            emoji: '🪙', color: '#fbbf24',
    description: 'All coin earnings are doubled for the next 10 minutes!',                        duration: 10 },
  { type: 'npc_festival',       id: 'npc_festival',       name: 'City Festival!',                emoji: '🎉', color: '#ec4899',
    description: 'The NPCs are throwing a party! Chat with any NPC for bonus coins!',             duration: 8,  reward: 50 },
  { type: 'coin_rain',          id: 'coin_rain',          name: "It's Raining Coins!",           emoji: '💰', color: '#fde047',
    description: 'Coins are falling from the sky! Walk over them to collect!',                    duration: 3 },
  { type: 'mystery_visitor',    id: 'mystery_visitor',    name: 'A Mystery Visitor Has Arrived!', emoji: '🌟', color: '#22d3ee',
    description: 'A golden NPC appeared in the city centre. Talk to them for a rare reward!',     duration: 10, reward: 100 },
  { type: 'speed_boost',        id: 'speed_boost',        name: 'Turbo Mode Activated!',         emoji: '⚡', color: '#38bdf8',
    description: 'Everyone moves at double speed for 5 minutes!',                                 duration: 5 },
  { type: 'community_challenge', id: 'community_challenge', name: 'Community Challenge!',          emoji: '🤝', color: '#34d399',
    description: 'Collect 100 coins together in 5 minutes for a 75-coin bonus!',                  duration: 5,  goal: 100, reward: 75 },
]

const _byType = Object.fromEntries(EVENT_TYPES.map(e => [e.type, e]))
const DEDUPE_MIN   = 90   // don't repeat an event type within this many minutes
const MYSTERY_MAX  = 5    // first N players to talk to the mystery visitor

const TREASURE_SPOTS = [
  { x: -52, z: 26 }, { x: 52, z: 42 }, { x: -30, z: -42 },
  { x: 44, z: -28 }, { x: 0, z: 52 }, { x: -45, z: 50 },
]
const FORTUNES = [
  'Fortune favours the bold — a big win is near.',
  'A new friend will change your path today.',
  'The coins you seek are closer than you think.',
  'Patience now brings a great reward later.',
  'Your kindness will return to you tenfold.',
  'A hidden door opens for the curious.',
]

// ── Module state ───────────────────────────────────────────────────────────────
const _s = {
  uid: null, name: null,
  active: null,            // merged { type,id,name,emoji,color,title,description,startedAt,endsAt,data,goal,reward,rowId }
  community: 0,            // community-challenge running total
  treasureClaimed: false,
  listeners: new Set(),
  channel: null,
  schedTimer: null,
  tickTimer: null,
  endTimer: null,
  inited: false,
  lastEventHour: -1,
  commThrottle: 0,
}

function emit() { const st = getLiveEventState(); _s.listeners.forEach(fn => fn(st)) }

export function onLiveEventUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getLiveEventState() {
  return {
    active:    _s.active ? { ..._s.active } : null,
    community: _s.community,
    goal:      _s.active?.goal ?? 0,
  }
}

// ── Multipliers (read by economyState + WorldCanvas) ──────────────────────────
export function getCoinMultiplier()  { return _s.active?.type === 'double_coins' ? 2 : 1 }
export function getSpeedMultiplier() { return _s.active?.type === 'speed_boost'  ? 2 : 1 }

// ── Reward-once guard (per player, per event row; survives refresh) ───────────
function _rewardKey(tag) { return `liveevt_${_s.uid}_${tag}` }
function _claimedOnce(tag) { try { return localStorage.getItem(_rewardKey(tag)) === '1' } catch { return false } }
function _markClaimed(tag) { try { localStorage.setItem(_rewardKey(tag), '1') } catch {} }

// ── Activation ────────────────────────────────────────────────────────────────
function activateEvent(row) {
  if (!row || row.is_active === false) return
  const def = _byType[row.event_type]
  if (!def) return
  const startedAt = row.started_at ? new Date(row.started_at).getTime() : Date.now()
  const endsAt    = row.ends_at ? new Date(row.ends_at).getTime() : startedAt + def.duration * 60000
  if (endsAt <= Date.now()) return                 // event already finished
  if (_s.active && _s.active.rowId === row.id) return // already active

  _s.active = {
    rowId: row.id, type: def.type, id: def.type, name: def.name, emoji: def.emoji, color: def.color,
    title: row.title || def.name, description: row.description || def.description,
    startedAt, endsAt, data: row.data || {}, goal: def.goal, reward: def.reward,
  }
  _s.treasureClaimed = !!_s.active.data?.winner
  _s.community = _s.active.data?.progress || 0

  // "Everyone online" instant reward — granted once per client per event row.
  if (def.type === 'meteor_shower' && !_claimedOnce(`m${row.id}`)) {
    _markClaimed(`m${row.id}`)
    addCoins(def.reward, { raw: true })
    _fireReward(def.reward, 'Meteor Shower bonus')
  }

  window.dispatchEvent(new CustomEvent('live-event-start', { detail: { ..._s.active } }))
  emit()
  _scheduleEnd()
}

function _scheduleEnd() {
  clearTimeout(_s.endTimer)
  if (!_s.active) return
  _s.endTimer = setTimeout(endEvent, Math.max(0, _s.active.endsAt - Date.now()) + 400)
}

function endEvent() {
  if (!_s.active) return
  const ended = _s.active

  // Community-challenge payout if the goal was met.
  if (ended.type === 'community_challenge'
      && _s.community >= (ended.goal || 100)
      && !_claimedOnce(`c${ended.rowId}`)) {
    _markClaimed(`c${ended.rowId}`)
    addCoins(ended.reward, { raw: true })
    _fireReward(ended.reward, 'Community goal reached!')
  }

  _s.active = null
  window.dispatchEvent(new CustomEvent('live-event-end', { detail: { ...ended } }))
  emit()

  // Best-effort: mark the row inactive so late-joiners don't re-activate it.
  if (supabase && ended.rowId) {
    supabase.from('live_events').update({ is_active: false }).eq('id', ended.rowId).then(() => {}, () => {})
  }
}

function onEventUpdate(row) {
  if (!_s.active || _s.active.rowId !== row.id) return
  if (row.data) _s.active.data = row.data
  if (row.event_type === 'community_challenge') _s.community = Math.max(_s.community, row.data?.progress || 0)
  if (row.data?.winner) _s.treasureClaimed = true
  if (row.is_active === false) { endEvent(); return }
  emit()
}

// ── Init: realtime subscribe + fetch current + scheduler ──────────────────────
export async function initLiveEvents(uid = null, name = null) {
  if (uid)  _s.uid  = uid
  if (name) _s.name = name

  // Wire the coin multiplier + community counter into the economy chokepoint.
  setCoinMultiplier(getCoinMultiplier)
  setOnCoinsEarned(_onCoinsEarned)

  if (_s.inited) return
  _s.inited = true

  if (supabase) {
    try {
      _s.channel = supabase.channel('live_events_rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_events' }, p => activateEvent(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_events' }, p => onEventUpdate(p.new))
        .subscribe()
    } catch {}
    try {
      const { data } = await supabase
        .from('live_events').select('*')
        .eq('is_active', true)
        .gte('ends_at', new Date().toISOString())
        .order('started_at', { ascending: false }).limit(1)
      if (data && data[0]) activateEvent(data[0])
    } catch {}
  }

  // Scheduler — fires triggerHourlyEvent at the top of each hour (first client wins).
  _s.schedTimer = setInterval(_checkForEvent, 30000)
  // 1s tick drives the countdown UI + auto-end safety net.
  _s.tickTimer = setInterval(() => {
    if (_s.active && Date.now() >= _s.active.endsAt) endEvent()
    else emit()
  }, 1000)
}

function _checkForEvent() {
  const now = new Date()
  const hour = now.getHours(), minute = now.getMinutes()
  if (minute >= 0 && minute < 2 && hour !== _s.lastEventHour) {
    _s.lastEventHour = hour
    triggerHourlyEvent()
  }
}

export async function triggerHourlyEvent() {
  if (!supabase) return
  try {
    // Skip if anyone already started an event in the last 5 minutes (de-race).
    const { data: veryRecent } = await supabase
      .from('live_events').select('id')
      .gte('started_at', new Date(Date.now() - 5 * 60000).toISOString()).limit(1)
    if (veryRecent && veryRecent.length) return

    const { data: recent } = await supabase
      .from('live_events').select('event_type')
      .gte('started_at', new Date(Date.now() - DEDUPE_MIN * 60000).toISOString()).limit(8)
    const recentTypes = (recent || []).map(e => e.event_type)
    const pool = EVENT_TYPES.filter(t => !recentTypes.includes(t.type))
    const chosen = (pool.length ? pool : EVENT_TYPES)[Math.floor(Math.random() * (pool.length ? pool.length : EVENT_TYPES.length))]

    const data = chosen.type === 'community_challenge' ? { progress: 0, goal: chosen.goal }
               : chosen.type === 'treasure_hunt'       ? { spot: TREASURE_SPOTS[Math.floor(Math.random() * TREASURE_SPOTS.length)] }
               : chosen.type === 'mystery_visitor'     ? { claimedBy: [] }
               : {}

    await supabase.from('live_events').insert({
      event_type: chosen.type, title: chosen.name, description: chosen.description, data,
      ends_at: new Date(Date.now() + chosen.duration * 60000).toISOString(),
      is_active: true, triggered_by: _s.uid || 'system',
    })
  } catch {}
}

// ── Per-event reward / claim helpers ──────────────────────────────────────────
function _fireReward(amount, reason) {
  window.dispatchEvent(new CustomEvent('live-event-reward', { detail: { amount, reason } }))
}

function _announce(message) {
  window.dispatchEvent(new CustomEvent('live-event-announce', { detail: { message } }))
  if (supabase) supabase.from('game_announcements').insert({ message, type: 'event' }).then(() => {}, () => {})
}

// Treasure hunt — first finder claims (client-claim + DB announce).
export function treasureLocationForActive() {
  if (!_s.active || _s.active.type !== 'treasure_hunt') return null
  if (_s.treasureClaimed) return null
  const sp = _s.active.data?.spot
  return sp && typeof sp.x === 'number' ? sp : TREASURE_SPOTS[2]
}
export function isTreasureClaimed() { return _s.treasureClaimed }

export async function claimTreasure(playerName) {
  if (!_s.active || _s.active.type !== 'treasure_hunt') return { ok: false }
  if (_s.treasureClaimed || _s.active.data?.winner)     return { ok: false, reason: 'Already claimed' }
  _s.treasureClaimed = true
  const reward = _s.active.reward || 500
  addCoins(reward, { raw: true })
  if (supabase && _s.active.rowId) {
    try {
      await supabase.from('live_events')
        .update({ data: { ..._s.active.data, winner: playerName }, is_active: false })
        .eq('id', _s.active.rowId)
    } catch {}
  }
  _announce(`🏆 ${playerName || 'A player'} found the treasure and won ${reward} coins!`)
  _fireReward(reward, 'Treasure found!')
  endEvent()
  return { ok: true, reward }
}

// Mystery visitor — first 5 players each get a reward + a fortune.
export async function talkToMysteryVisitor(playerName) {
  if (!_s.active || _s.active.type !== 'mystery_visitor') return { ok: false }
  if (_claimedOnce(`v${_s.active.rowId}`))                return { ok: false, reason: 'Already rewarded', fortune: _fortune() }
  const claimed = _s.active.data?.claimedBy || []
  if (claimed.length >= MYSTERY_MAX)                      return { ok: false, reason: 'The visitor has left' }
  _markClaimed(`v${_s.active.rowId}`)
  const reward = _s.active.reward || 100
  addCoins(reward, { raw: true })
  if (supabase && _s.active.rowId) {
    try {
      await supabase.from('live_events')
        .update({ data: { ..._s.active.data, claimedBy: [...claimed, playerName] } })
        .eq('id', _s.active.rowId)
    } catch {}
  }
  _fireReward(reward, 'Mystery visitor reward!')
  return { ok: true, reward, fortune: _fortune() }
}

// NPC festival — bonus coins for chatting with any NPC (once per event).
export function recordFestivalNpcTalk() {
  if (!_s.active || _s.active.type !== 'npc_festival') return { ok: false }
  if (_claimedOnce(`f${_s.active.rowId}`))             return { ok: false }
  _markClaimed(`f${_s.active.rowId}`)
  const reward = _s.active.reward || 50
  addCoins(reward, { raw: true })
  _fireReward(reward, 'Festival bonus!')
  return { ok: true, reward }
}

// Coin rain — each coin walked over gives 5–15.
export function collectRainCoin() {
  if (!_s.active || _s.active.type !== 'coin_rain') return 0
  const amt = 5 + Math.floor(Math.random() * 11)
  addCoins(amt, { raw: true })
  return amt
}

// ── Community challenge progress ──────────────────────────────────────────────
function _onCoinsEarned(amount) {
  if (_s.active?.type === 'community_challenge') addCommunityProgress(amount)
}

export function addCommunityProgress(amount) {
  if (!_s.active || _s.active.type !== 'community_challenge' || amount <= 0) return
  _s.community += amount
  emit()
  const now = Date.now()
  if (supabase && _s.active.rowId && now - _s.commThrottle > 3000) {
    _s.commThrottle = now
    supabase.from('live_events')
      .update({ data: { ..._s.active.data, progress: _s.community, goal: _s.active.goal } })
      .eq('id', _s.active.rowId).then(() => {}, () => {})
  }
}

// ── Next-event countdown (top of next hour) ───────────────────────────────────
export function getNextEventInfo() {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(now.getHours() + 1, 0, 0, 0)
  return { msUntil: next.getTime() - now.getTime(), types: EVENT_TYPES }
}

function _fortune() { return FORTUNES[Math.floor(Math.random() * FORTUNES.length)] }
