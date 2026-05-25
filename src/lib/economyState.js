import { supabase } from './supabase'

const TICKET_MAX        = 5
const TICKET_REFILL_MS  = 2 * 60 * 60 * 1000   // 2 hours
const PASSIVE_COINS     = 5
const PASSIVE_MS        = 60 * 1000              // 60 seconds
const DAILY_COINS       = 50
const DAILY_TICKETS     = 1
const STREAK_GEM_BONUS  = 20                     // gems every 7-day streak

const _s = {
  uid:              null,
  coins:            500,
  gems:             10,
  tickets:          3,
  ticketsLastRefill: null,
  ownedOutfits:     ['casual'],
  lastDailyBonus:   null,
  loginStreak:      0,
  listeners:        new Set(),
  initialized:      false,
}

// ── Pub / sub ─────────────────────────────────────────────────────────────────
function emit() { _s.listeners.forEach(fn => fn(getEconomyState())) }

export function onEconomyUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getEconomyState() {
  return {
    coins:            _s.coins,
    gems:             _s.gems,
    tickets:          _s.tickets,
    ticketsLastRefill: _s.ticketsLastRefill,
    ownedOutfits:     [..._s.ownedOutfits],
    lastDailyBonus:   _s.lastDailyBonus,
    loginStreak:      _s.loginStreak,
    initialized:      _s.initialized,
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────
function _lsKey() { return `eco_${_s.uid}` }

function _saveLocal() {
  if (!_s.uid) return
  try {
    localStorage.setItem(_lsKey(), JSON.stringify({
      coins: _s.coins, gems: _s.gems, tickets: _s.tickets,
      ticketsLastRefill: _s.ticketsLastRefill,
      ownedOutfits: _s.ownedOutfits,
      lastDailyBonus: _s.lastDailyBonus,
      loginStreak: _s.loginStreak,
    }))
  } catch {}
}

async function _syncSupabase() {
  if (!supabase || !_s.uid) return
  try {
    await supabase.from('players').upsert({
      uid:                _s.uid,
      coins:              _s.coins,
      gems:               _s.gems,
      tickets:            _s.tickets,
      tickets_last_refill: _s.ticketsLastRefill,
      owned_outfits:      _s.ownedOutfits,
      last_daily_bonus:   _s.lastDailyBonus,
      login_streak:       _s.loginStreak,
    }, { onConflict: 'uid' })
  } catch {}
}

function _persist() { _saveLocal(); _syncSupabase() }

// ── Ticket refill ─────────────────────────────────────────────────────────────
function _refillTickets() {
  if (_s.tickets >= TICKET_MAX) return
  if (!_s.ticketsLastRefill) {
    _s.ticketsLastRefill = new Date().toISOString()
    return
  }
  const last    = new Date(_s.ticketsLastRefill).getTime()
  const periods = Math.floor((Date.now() - last) / TICKET_REFILL_MS)
  if (periods > 0) {
    _s.tickets            = Math.min(TICKET_MAX, _s.tickets + periods)
    _s.ticketsLastRefill  = new Date(last + periods * TICKET_REFILL_MS).toISOString()
  }
}

/** ms remaining until next ticket refill (0 if full) */
export function msUntilNextTicket() {
  if (_s.tickets >= TICKET_MAX) return 0
  if (!_s.ticketsLastRefill) return TICKET_REFILL_MS
  const last = new Date(_s.ticketsLastRefill).getTime()
  return Math.max(0, last + TICKET_REFILL_MS - Date.now())
}

// ── Daily login bonus ─────────────────────────────────────────────────────────
function _checkDailyBonus() {
  const todayStr = new Date().toDateString()

  if (!_s.lastDailyBonus) {
    // First ever login
    _s.lastDailyBonus = todayStr
    _s.loginStreak    = 1
    _s.coins         += DAILY_COINS
    _s.tickets        = Math.min(TICKET_MAX, _s.tickets + DAILY_TICKETS)
    return { given: true, coins: DAILY_COINS, tickets: DAILY_TICKETS, streak: 1, streakBonus: false }
  }

  if (_s.lastDailyBonus === todayStr) return { given: false }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const isConsecutive = _s.lastDailyBonus === yesterday.toDateString()

  _s.lastDailyBonus = todayStr
  _s.loginStreak    = isConsecutive ? _s.loginStreak + 1 : 1
  _s.coins         += DAILY_COINS
  _s.tickets        = Math.min(TICKET_MAX, _s.tickets + DAILY_TICKETS)

  const streakBonus = _s.loginStreak % 7 === 0
  if (streakBonus) _s.gems += STREAK_GEM_BONUS

  return { given: true, coins: DAILY_COINS, tickets: DAILY_TICKETS, streak: _s.loginStreak, streakBonus, bonusGems: streakBonus ? STREAK_GEM_BONUS : 0 }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initEconomy(uid) {
  if (!uid) return null
  _s.uid = uid

  if (supabase) {
    try {
      const { data } = await supabase
        .from('players')
        .select('coins,gems,tickets,tickets_last_refill,owned_outfits,last_daily_bonus,login_streak')
        .eq('uid', uid)
        .maybeSingle()
      if (data) {
        _s.coins            = data.coins              ?? 500
        _s.gems             = data.gems               ?? 10
        _s.tickets          = data.tickets            ?? 3
        _s.ticketsLastRefill = data.tickets_last_refill ?? null
        _s.ownedOutfits     = data.owned_outfits      ?? ['casual']
        _s.lastDailyBonus   = data.last_daily_bonus   ?? null
        _s.loginStreak      = data.login_streak       ?? 0
      }
    } catch {}
  } else {
    try {
      const raw = localStorage.getItem(_lsKey())
      if (raw) {
        const d = JSON.parse(raw)
        _s.coins            = d.coins            ?? 500
        _s.gems             = d.gems             ?? 10
        _s.tickets          = d.tickets          ?? 3
        _s.ticketsLastRefill = d.ticketsLastRefill ?? null
        _s.ownedOutfits     = d.ownedOutfits     ?? ['casual']
        _s.lastDailyBonus   = d.lastDailyBonus   ?? null
        _s.loginStreak      = d.loginStreak      ?? 0
      }
    } catch {}
  }

  _refillTickets()
  const bonusResult = _checkDailyBonus()
  _s.initialized = true
  _persist()
  emit()
  return bonusResult
}

// ── Coin helpers ──────────────────────────────────────────────────────────────
export function addCoins(n) {
  if (n <= 0) return
  _s.coins += n
  _persist(); emit()
}

export function spendCoins(n) {
  if (_s.coins < n) return false
  _s.coins -= n
  _persist(); emit()
  return true
}

// ── Gem helpers ───────────────────────────────────────────────────────────────
export function addGems(n) {
  if (n <= 0) return
  _s.gems += n
  _persist(); emit()
}

export function spendGems(n) {
  if (_s.gems < n) return false
  _s.gems -= n
  _persist(); emit()
  return true
}

// ── Ticket helpers ────────────────────────────────────────────────────────────
export function addTickets(n) {
  _s.tickets = Math.min(TICKET_MAX, _s.tickets + n)
  _persist(); emit()
}

export function spendTicket() {
  if (_s.tickets <= 0) return false
  _s.tickets -= 1
  _persist(); emit()
  return true
}

// ── Outfit shop ───────────────────────────────────────────────────────────────
export function purchaseOutfit(outfitId, currency, cost) {
  if (_s.ownedOutfits.includes(outfitId)) return { ok: true, alreadyOwned: true }
  const spent = currency === 'gems' ? spendGems(cost) : spendCoins(cost)
  if (!spent) return { ok: false, reason: `Not enough ${currency}` }
  _s.ownedOutfits = [..._s.ownedOutfits, outfitId]
  _persist(); emit()
  return { ok: true }
}

export function isOutfitOwned(outfitId) {
  return _s.ownedOutfits.includes(outfitId)
}

// ── Passive income ────────────────────────────────────────────────────────────
let _passiveTimer = null

export function startPassiveIncome() {
  if (_passiveTimer) return
  _passiveTimer = setInterval(() => {
    addCoins(PASSIVE_COINS)
    window.dispatchEvent(new CustomEvent('passive-coins', { detail: { amount: PASSIVE_COINS } }))
  }, PASSIVE_MS)
}

export function stopPassiveIncome() {
  if (_passiveTimer) { clearInterval(_passiveTimer); _passiveTimer = null }
}
