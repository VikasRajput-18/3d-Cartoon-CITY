// Personal house system — 7 upgrade levels, daily bills, eviction, vehicles.
//
// Required Supabase tables / columns (run once):
//   player_houses(
//     player_id text pk, player_name text, house_number text,
//     house_level int default 1, is_evicted bool default false,
//     last_bill_date date, sleep_last_at timestamptz, rest_last_at timestamptz,
//     owned_vehicles jsonb default '[]', owned_furniture jsonb default '[]',
//     owned_pets jsonb default '[]', active_vehicle text
//   )
//   bill_history(
//     id uuid pk default gen_random_uuid(),
//     player_id text, local_id text, bill_type text, amount int,
//     due_date date, is_paid bool default false, paid_at timestamptz
//   )

import { supabase } from './supabase'
import { spendCoins, addCoins } from './economyState'
import { addCollider, removeCollidersWithPrefix } from './playerColliders'
import { parkedVehicles, notifyParkedVehicleChange } from './parkedVehicleState'

// Maps a catalog vehicle id → the drivable parked-vehicle render type + color.
const VEH_RENDER = {
  scooter:   { type: 'bike', color: '#34d399' },
  sportbike: { type: 'bike', color: '#a855f7' },
  citycar:   { type: 'car',  color: '#3b82f6' },
  sportscar: { type: 'car',  color: '#ef4444' },
  suv:       { type: 'car',  color: '#64748b' },
  luxurycar: { type: 'car',  color: '#facc15' },
}
const CALL_HOME_COST = 10

// ── Level tables ───────────────────────────────────────────────────────────────
export const LEVEL_NAMES = [
  'Basic Hut', 'Small House', 'Standard House',
  'Modern House', 'Large Villa', 'Luxury Mansion', 'Penthouse',
]
export const LEVEL_DESCRIPTIONS = [
  'A cozy single-room wooden hut.',
  'Proper walls, one window, slightly bigger.',
  'Two rooms, garden fence, more space.',
  'Two floors, balcony, modern look.',
  'Three floors, garage, bigger garden.',
  'Four floors, swimming pool, premium look.',
  'Skyscraper top floor, rooftop terrace, helicopter pad.',
]
// coins to upgrade from level N to N+1 (index 0 = L1→L2)
export const UPGRADE_COST = [300, 800, 2000, 5000, 12000, 30000]
// daily rent (converted from per-3-day spec: L1 50/3d ≈ 17, etc.)
const BASE_RENT = [17, 23, 33, 50, 83, 133, 233]
// [width, depth] footprint per level — mirrors PlayerHouseMarker SIZES
export const HOUSE_DIMS = [
  [3, 3], [4, 4], [5, 5], [5.5, 5.5], [6.5, 6.5], [8, 8], [7, 12],
]
export const MAX_LEVEL = 7

const MAX_BILL_DAYS   = 5
const WARN_THRESHOLD  = 200
const EV_WARN_THRESH  = 500
const EV_THRESH       = 800
export const EVICT_FINE = 100

// ── House slot grid (5×5 = 25 slots, NW residential zone) ─────────────────────
export const HOUSE_SLOTS = (() => {
  const out = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      out.push({
        number: `${String.fromCharCode(65 + row)}-${101 + col}`,
        x: -15 - col * 12,
        z:  62 + row * 12,
      })
    }
  }
  return out
})()

// ── Module state ───────────────────────────────────────────────────────────────
const _s = {
  uid:          null,
  playerName:   null,
  number:       null,
  level:        1,
  evicted:      false,
  bills:        [],
  position:     null,
  ready:        false,
  ownedVehicles:   [],
  ownedFurniture:  [],
  ownedPets:       [],
  activeVehicle:   null,
  sleepLastAt:     null,
  restLastAt:      null,
  listeners:    new Set(),
}

function emit() { _s.listeners.forEach(fn => fn(getHouseState())) }

export function onHouseUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getHouseState() {
  const unpaid = _s.bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0)
  return {
    number:         _s.number,
    playerName:     _s.playerName,
    level:          _s.level,
    levelName:      LEVEL_NAMES[_s.level - 1],
    evicted:        _s.evicted,
    bills:          _s.bills.filter(b => !b.paid),
    unpaid,
    position:       _s.position,
    ready:          _s.ready,
    ownedVehicles:  [..._s.ownedVehicles],
    ownedFurniture: [..._s.ownedFurniture],
    ownedPets:      [..._s.ownedPets],
    activeVehicle:  _s.activeVehicle,
    sleepLastAt:    _s.sleepLastAt,
    restLastAt:     _s.restLastAt,
    status:   _s.evicted              ? 'evicted'
              : unpaid >= EV_WARN_THRESH ? 'eviction-warning'
              : unpaid >= WARN_THRESHOLD ? 'warning'
              : 'ok',
  }
}

// ── Persistence ────────────────────────────────────────────────────────────────
const _lsKey = () => `house_${_s.uid}`

function _saveLocal() {
  if (!_s.uid) return
  try {
    localStorage.setItem(_lsKey(), JSON.stringify({
      number: _s.number, playerName: _s.playerName, level: _s.level,
      evicted: _s.evicted,
      lastBillDate: _s.bills.map(b => b.dueDate).sort().at(-1) ?? null,
      bills: _s.bills,
      ownedVehicles: _s.ownedVehicles, ownedFurniture: _s.ownedFurniture,
      ownedPets: _s.ownedPets, activeVehicle: _s.activeVehicle,
      sleepLastAt: _s.sleepLastAt, restLastAt: _s.restLastAt,
    }))
  } catch {}
}

async function _saveHouseRow(fields) {
  if (!supabase || !_s.uid) return
  try {
    await supabase.from('player_houses')
      .upsert({ player_id: _s.uid, ...fields }, { onConflict: 'player_id' })
  } catch {}
}

// ── Bill generation ────────────────────────────────────────────────────────────
function _dayBills(dateStr, level) {
  const rent = BASE_RENT[level - 1]
  return [
    { id: `${dateStr}_rent`,        type: 'rent',        amount: rent,                              dueDate: dateStr, paid: false },
    { id: `${dateStr}_electricity`, type: 'electricity', amount: 15 + Math.floor(Math.random()*16), dueDate: dateStr, paid: false },
    { id: `${dateStr}_water`,       type: 'water',       amount:  3 + Math.floor(Math.random()* 5), dueDate: dateStr, paid: false },
    { id: `${dateStr}_wifi`,        type: 'wifi',        amount: 7,                                  dueDate: dateStr, paid: false },
    { id: `${dateStr}_food`,        type: 'food',        amount: 20 + Math.floor(Math.random()*21), dueDate: dateStr, paid: false },
  ]
}

function _missingBills(lastDateStr, level) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (!lastDateStr) return _dayBills(today.toISOString().slice(0, 10), level)
  const last  = new Date(lastDateStr); last.setHours(0, 0, 0, 0)
  const days  = Math.floor((today - last) / 86400000)
  if (days <= 0) return []
  const gen   = Math.min(days, MAX_BILL_DAYS)
  const out   = []
  for (let i = days - gen; i < days; i++) {
    const d = new Date(last); d.setDate(d.getDate() + 1 + i)
    out.push(..._dayBills(d.toISOString().slice(0, 10), level))
  }
  return out
}

async function _insertBillsDB(bills) {
  if (!supabase || !_s.uid || !bills.length) return
  try {
    await supabase.from('bill_history').insert(
      bills.map(b => ({
        player_id: _s.uid, local_id: b.id, bill_type: b.type,
        amount: b.amount, due_date: b.dueDate, is_paid: false,
      }))
    )
  } catch {}
}

async function _findFreeSlot() {
  if (supabase) {
    try {
      const { data } = await supabase.from('player_houses').select('house_number')
      const taken = new Set((data || []).map(r => r.house_number))
      return HOUSE_SLOTS.find(s => !taken.has(s.number)) ?? null
    } catch {}
  }
  return HOUSE_SLOTS[0]
}

function _registerCollider(x, z, level) {
  removeCollidersWithPrefix('player-house:')
  const [w, d] = HOUSE_DIMS[level - 1]
  addCollider(x, z, w, d, 'player-house:own')
}

// ── Init ───────────────────────────────────────────────────────────────────────
export async function initHouse(uid, playerName = null) {
  if (!uid) return
  _s.uid        = uid
  _s.playerName = playerName

  const today  = new Date().toISOString().slice(0, 10)
  let row      = null
  let billRows = []

  if (supabase) {
    try {
      const { data } = await supabase
        .from('player_houses').select('*').eq('player_id', uid).maybeSingle()
      row = data
    } catch {}
    if (row) {
      try {
        const { data } = await supabase
          .from('bill_history').select('*').eq('player_id', uid)
          .order('due_date', { ascending: true })
        billRows = data || []
      } catch {}
    }
  } else {
    try {
      const raw = localStorage.getItem(_lsKey())
      if (raw) {
        const d = JSON.parse(raw)
        row = {
          house_number: d.number, player_name: d.playerName,
          house_level: d.level, is_evicted: d.evicted,
          last_bill_date: d.lastBillDate,
          owned_vehicles: d.ownedVehicles, owned_furniture: d.ownedFurniture,
          owned_pets: d.ownedPets, active_vehicle: d.activeVehicle,
          sleep_last_at: d.sleepLastAt, rest_last_at: d.restLastAt,
        }
        billRows = d.bills || []
      }
    } catch {}
  }

  if (!row) {
    const slot = await _findFreeSlot()
    if (!slot) { _s.ready = true; emit(); return }
    const initBills = _dayBills(today, 1)
    _s.number   = slot.number
    _s.level    = 1
    _s.evicted  = false
    _s.bills    = initBills
    _s.position = { x: slot.x, z: slot.z }
    await _saveHouseRow({
      house_number: slot.number, player_name: playerName, house_level: 1,
      is_evicted: false, last_bill_date: today,
    })
    await _insertBillsDB(initBills)
    _saveLocal()
  } else {
    _s.number  = row.house_number
    _s.playerName = row.player_name ?? playerName
    _s.level   = row.house_level  ?? 1
    _s.evicted = row.is_evicted   ?? false
    _s.ownedVehicles  = row.owned_vehicles  ?? []
    _s.ownedFurniture = row.owned_furniture ?? []
    _s.ownedPets      = row.owned_pets      ?? []
    _s.activeVehicle  = row.active_vehicle  ?? null
    _s.sleepLastAt    = row.sleep_last_at   ?? null
    _s.restLastAt     = row.rest_last_at    ?? null
    const slot = HOUSE_SLOTS.find(s => s.number === _s.number)
    _s.position = slot ? { x: slot.x, z: slot.z } : null

    if (supabase) {
      _s.bills = billRows.map(b => ({
        id: b.local_id || b.id, db_id: b.id, type: b.bill_type,
        amount: b.amount, dueDate: b.due_date, paid: b.is_paid,
      }))
    } else {
      _s.bills = billRows
    }

    if (!_s.evicted) {
      const newBills = _missingBills(row.last_bill_date ?? null, _s.level)
      if (newBills.length) {
        _s.bills = [..._s.bills, ...newBills]
        await _saveHouseRow({ last_bill_date: today })
        await _insertBillsDB(newBills)
        _saveLocal()
      }
    }
  }

  _s.ready = true
  if (_s.position) _registerCollider(_s.position.x, _s.position.z, _s.level)
  spawnOwnedVehiclesAtHome()   // park owned vehicles outside the house
  emit()

  const unpaid = _s.bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0)
  if (!_s.evicted && unpaid >= EV_THRESH) {
    _s.evicted = true
    await _saveHouseRow({ is_evicted: true })
    _saveLocal(); emit()
    window.dispatchEvent(new CustomEvent('house-evicted'))
  }

  return getHouseState()
}

// ── Fetch all houses (Issue 3) ─────────────────────────────────────────────────
export async function fetchAllHouses() {
  if (!supabase) return []
  try {
    const [{ data: houses }, { data: online }] = await Promise.all([
      supabase.from('player_houses')
        .select('player_id, player_name, house_number, house_level, is_evicted'),
      supabase.from('players').select('id, is_online'),
    ])
    const onlineMap = new Map((online || []).map(p => [p.id, p.is_online === true]))
    return (houses || []).map(row => {
      const slot = HOUSE_SLOTS.find(s => s.number === row.house_number)
      if (!slot) return null
      return {
        playerId:    row.player_id,
        playerName:  row.player_name ?? '???',
        number:      row.house_number,
        level:       row.house_level ?? 1,
        evicted:     row.is_evicted  ?? false,
        online:      onlineMap.get(row.player_id) ?? false,
        x:           slot.x,
        z:           slot.z,
      }
    }).filter(Boolean)
  } catch { return [] }
}

// ── Bill actions ───────────────────────────────────────────────────────────────
export async function payBill(billId) {
  const bill = _s.bills.find(b => b.id === billId && !b.paid)
  if (!bill) return { ok: false }
  if (!spendCoins(bill.amount)) return { ok: false, reason: 'Not enough coins' }
  bill.paid = true
  if (supabase && bill.db_id) {
    try {
      await supabase.from('bill_history')
        .update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', bill.db_id)
    } catch {}
  }
  _saveLocal(); emit()
  return { ok: true }
}

export async function payAllBills() {
  const unpaid = _s.bills.filter(b => !b.paid)
  const total  = unpaid.reduce((s, b) => s + b.amount, 0)
  if (!total) return { ok: true, paid: 0 }
  if (!spendCoins(total)) return { ok: false, reason: 'Not enough coins' }
  unpaid.forEach(b => { b.paid = true })
  if (supabase) {
    const ids = unpaid.filter(b => b.db_id).map(b => b.db_id)
    if (ids.length) {
      try {
        await supabase.from('bill_history')
          .update({ is_paid: true, paid_at: new Date().toISOString() }).in('id', ids)
      } catch {}
    }
  }
  _saveLocal(); emit()
  return { ok: true, paid: total }
}

export async function payEvictionFine() {
  if (!_s.evicted) return { ok: false }
  if (!spendCoins(EVICT_FINE)) return { ok: false, reason: 'Not enough coins' }
  _s.evicted = false
  await _saveHouseRow({ is_evicted: false })
  _saveLocal(); emit()
  return { ok: true }
}

// ── Upgrade (7 levels) ─────────────────────────────────────────────────────────
export async function upgradeHouse() {
  if (_s.level >= MAX_LEVEL) return { ok: false, reason: 'Already max level' }
  if (_s.evicted)             return { ok: false, reason: 'Pay eviction fine first' }
  const cost = UPGRADE_COST[_s.level - 1]
  if (!spendCoins(cost)) return { ok: false, reason: 'Not enough coins' }
  _s.level++
  await _saveHouseRow({ house_level: _s.level })
  if (_s.position) _registerCollider(_s.position.x, _s.position.z, _s.level)
  _saveLocal(); emit()
  return { ok: true, level: _s.level }
}

// ── Rest / Sleep ───────────────────────────────────────────────────────────────
const REST_COOLDOWN_MS  = 10 * 60 * 1000   // 10 min for rest
const SLEEP_COOLDOWN_MS = 8 * 60 * 60 * 1000 // 8 hours for sleep
const SLEEP_BONUS       = 50

export function canRest() {
  if (!_s.restLastAt) return true
  return Date.now() - new Date(_s.restLastAt).getTime() > REST_COOLDOWN_MS
}

export function canSleep() {
  if (!_s.sleepLastAt) return true
  return Date.now() - new Date(_s.sleepLastAt).getTime() > SLEEP_COOLDOWN_MS
}

export async function doRest() {
  _s.restLastAt = new Date().toISOString()
  await _saveHouseRow({ rest_last_at: _s.restLastAt })
  _saveLocal(); emit()
  window.dispatchEvent(new CustomEvent('house-rest'))
}

export async function doSleep() {
  _s.sleepLastAt = new Date().toISOString()
  addCoins(SLEEP_BONUS)
  await _saveHouseRow({ sleep_last_at: _s.sleepLastAt })
  _saveLocal(); emit()
  window.dispatchEvent(new CustomEvent('house-sleep', { detail: { bonus: SLEEP_BONUS } }))
}

// ── Vehicle shop ───────────────────────────────────────────────────────────────
export const VEHICLE_CATALOG = [
  { id: 'scooter',     label: 'Basic Scooter',  emoji: '🛵', price:    200, speed: 'slow'   },
  { id: 'sportbike',   label: 'Sport Bike',     emoji: '🏍', price:    800, speed: 'fast'   },
  { id: 'citycar',     label: 'City Car',       emoji: '🚗', price:   1500, speed: 'medium' },
  { id: 'sportscar',   label: 'Sports Car',     emoji: '🏎', price:   5000, speed: 'vfast'  },
  { id: 'suv',         label: 'SUV',            emoji: '🚙', price:   3000, speed: 'medium' },
  { id: 'luxurycar',   label: 'Luxury Car',     emoji: '🚘', price: 15000,  speed: 'fast'   },
]

export async function buyVehicle(vehicleId) {
  const v = VEHICLE_CATALOG.find(c => c.id === vehicleId)
  if (!v) return { ok: false }
  if (_s.ownedVehicles.includes(vehicleId)) return { ok: false, reason: 'Already owned' }
  if (!spendCoins(v.price)) return { ok: false, reason: 'Not enough coins' }
  _s.ownedVehicles = [..._s.ownedVehicles, vehicleId]
  await _saveHouseRow({ owned_vehicles: _s.ownedVehicles })
  _saveLocal(); emit()
  spawnOwnedVehiclesAtHome()   // park it outside the house immediately
  return { ok: true }
}

// ── Personal vehicle parking (reuses the shared parked-vehicle system) ─────────
// Parking spots are laid out beside the house; vehicle N parks next to N-1.
export function getHomeParkingSpot(i = 0) {
  if (!_s.position) return null
  const [w] = HOUSE_DIMS[_s.level - 1]
  return { x: _s.position.x + w / 2 + 2.5 + i * 2.6, z: _s.position.z + 1.5, facing: 0 }
}

const _homeVehId = (vid) => `home:${_s.uid}:${vid}`

/** Add the player's owned vehicles to the drivable parked-vehicle array at home. */
export function spawnOwnedVehiclesAtHome() {
  if (!_s.position || !_s.ownedVehicles.length) return
  let added = false
  _s.ownedVehicles.forEach((vid, i) => {
    const id = _homeVehId(vid)
    if (parkedVehicles.some(p => p.id === id)) return   // already spawned this session
    const r    = VEH_RENDER[vid] || { type: 'car', color: '#888' }
    const spot = getHomeParkingSpot(i)
    if (!spot) return
    const cat  = VEHICLE_CATALOG.find(c => c.id === vid)
    parkedVehicles.push({
      id, type: r.type, x: spot.x, z: spot.z, facing: spot.facing, color: r.color,
      driverId: null,
      owner: _s.uid, ownerName: _s.playerName, vehicleLabel: cat?.label ?? 'Vehicle',
    })
    added = true
  })
  if (added) notifyParkedVehicleChange()
}

/** Teleport all of the player's vehicles back to the home parking spots. */
export function callVehiclesHome() {
  if (!_s.position) return { ok: false, reason: 'No house' }
  const mine = parkedVehicles.filter(p => p.owner === _s.uid)
  if (!mine.length) return { ok: false, reason: 'No vehicles owned' }
  if (!spendCoins(CALL_HOME_COST)) return { ok: false, reason: 'Not enough coins' }
  mine.forEach((p, i) => {
    const spot = getHomeParkingSpot(i)
    if (spot) { p.x = spot.x; p.z = spot.z; p.facing = spot.facing; p.driverId = null }
  })
  notifyParkedVehicleChange()
  return { ok: true }
}

export { CALL_HOME_COST }

// ── Furniture / pets ───────────────────────────────────────────────────────────
export const FURNITURE_CATALOG = [
  { id: 'basic_pack',    label: 'Basic Pack',    emoji: '🛋',  price:  100 },
  { id: 'gaming_setup',  label: 'Gaming Setup',  emoji: '🖥',  price:  300 },
  { id: 'luxury_pack',   label: 'Luxury Pack',   emoji: '🏺',  price:  800 },
  { id: 'garden_pack',   label: 'Garden Pack',   emoji: '🌻',  price:  200 },
]
export const PET_CATALOG = [
  { id: 'dog',       label: 'Dog',       emoji: '🐕', price: 500 },
  { id: 'cat',       label: 'Cat',       emoji: '🐈', price: 300 },
  { id: 'fishtank',  label: 'Fish Tank', emoji: '🐠', price: 200 },
]

export async function buyFurniture(id) {
  const item = FURNITURE_CATALOG.find(f => f.id === id)
  if (!item || _s.ownedFurniture.includes(id)) return { ok: false }
  if (!spendCoins(item.price)) return { ok: false, reason: 'Not enough coins' }
  _s.ownedFurniture = [..._s.ownedFurniture, id]
  await _saveHouseRow({ owned_furniture: _s.ownedFurniture })
  _saveLocal(); emit()
  return { ok: true }
}

export async function buyPet(id) {
  const item = PET_CATALOG.find(p => p.id === id)
  if (!item || _s.ownedPets.includes(id)) return { ok: false }
  if (!spendCoins(item.price)) return { ok: false, reason: 'Not enough coins' }
  _s.ownedPets = [..._s.ownedPets, id]
  await _saveHouseRow({ owned_pets: _s.ownedPets })
  _saveLocal(); emit()
  return { ok: true }
}

export function getHousePosition() { return _s.position }
