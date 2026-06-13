// Wardrobe system — primitive-geometry accessories that attach to the character.
// Catalog + owned/equipped state + outfit presets, persisted to the players table
// (equipped_items / owned_items / outfit_presets jsonb) with localStorage fallback.
// Level-locked items are EARNED (never buyable); VIP items show for VIP only.

import { supabase } from './supabase'
import { spendCoins, spendGems } from './economyState'
import { getMissionState } from './missionState'

// Slots: head, face, beard, body, legs, feet, back, neck, aura
export const WARDROBE_CATALOG = [
  // ── Head ──
  { id: 'cap',        slot: 'head',  label: 'Cap',          emoji: '🧢', price: 80,  currency: 'coins', colors: ['#e2574c', '#2e6e73', '#f2c94c', '#3d4a5c'] },
  { id: 'beanie',     slot: 'head',  label: 'Beanie',       emoji: '🎿', price: 60,  currency: 'coins', colors: ['#7c3aed', '#e2574c', '#3e7c3a', '#1a1a2e'] },
  { id: 'tophat',     slot: 'head',  label: 'Top Hat',      emoji: '🎩', price: 250, currency: 'coins', colors: ['#1a1a2e', '#5a3e28'] },
  { id: 'crown',      slot: 'head',  label: 'Golden Crown', emoji: '👑', levelLock: 20, colors: ['#f2c94c'] },
  // ── Face ──
  { id: 'glasses',    slot: 'face',  label: 'Round Glasses', emoji: '👓', price: 50,  currency: 'coins', colors: ['#1a1a2e', '#8a5a3b'] },
  { id: 'sunglasses', slot: 'face',  label: 'Sunglasses',    emoji: '🕶️', price: 120, currency: 'coins', colors: ['#1a1a2e'] },
  { id: 'goggles',    slot: 'face',  label: 'Sci-fi Goggles', emoji: '🥽', price: 8,  currency: 'gems',  colors: ['#22d3ee', '#a855f7'] },
  // ── Beard ──
  { id: 'stubble',    slot: 'beard', label: 'Stubble',    emoji: '🧔', price: 30, currency: 'coins', colors: ['#2c1810', '#4a3828', '#777'] },
  { id: 'fullbeard',  slot: 'beard', label: 'Full Beard', emoji: '🧔', price: 60, currency: 'coins', colors: ['#2c1810', '#4a3828', '#777'] },
  { id: 'goatee',     slot: 'beard', label: 'Goatee',     emoji: '🧔', price: 45, currency: 'coins', colors: ['#2c1810', '#4a3828'] },
  // ── Body (over-torso layer) ──
  { id: 'hoodie',     slot: 'body',  label: 'Hoodie',         emoji: '🧥', price: 150, currency: 'coins', colors: ['#7c3aed', '#e2574c', '#3a3f47', '#2e6e73'] },
  { id: 'blazer',     slot: 'body',  label: 'Blazer',         emoji: '🤵', price: 220, currency: 'coins', colors: ['#1a1a2e', '#3d4a5c', '#5a3e28'] },
  { id: 'leather',    slot: 'body',  label: 'Leather Jacket', emoji: '🏍️', price: 300, currency: 'coins', colors: ['#1a1a2e', '#5a3e28'] },
  { id: 'goldjacket', slot: 'body',  label: 'Gilded Jacket',  emoji: '✨', levelLock: 10, colors: ['#f2c94c'] },
  // ── Legs ──
  { id: 'jeans',      slot: 'legs',  label: 'Jeans',        emoji: '👖', price: 70, currency: 'coins', colors: ['#3d5a80', '#1a1a2e', '#4f8438'] },
  { id: 'shorts',     slot: 'legs',  label: 'Shorts',       emoji: '🩳', price: 50, currency: 'coins', colors: ['#d9886a', '#2e6e73', '#f2c94c'] },
  { id: 'formal',     slot: 'legs',  label: 'Formal Pants', emoji: '👔', price: 90, currency: 'coins', colors: ['#1a1a2e', '#3d4a5c'] },
  // ── Feet ──
  { id: 'sneakers',   slot: 'feet',  label: 'Sneakers', emoji: '👟', price: 60,  currency: 'coins', colors: ['#e2574c', '#fff', '#22d3ee'] },
  { id: 'boots',      slot: 'feet',  label: 'Boots',    emoji: '🥾', price: 90,  currency: 'coins', colors: ['#5a3e28', '#1a1a2e'] },
  // ── Back ──
  { id: 'backpack',   slot: 'back',  label: 'Backpack', emoji: '🎒', price: 110, currency: 'coins', colors: ['#e2574c', '#3e7c3a', '#3d5a80'] },
  { id: 'cape',       slot: 'back',  label: 'Hero Cape', emoji: '🦸', levelLock: 20, colors: ['#e2574c', '#7c3aed'] },
  // ── Neck ──
  { id: 'chain',      slot: 'neck',  label: 'Gold Chain', emoji: '📿', price: 12, currency: 'gems', colors: ['#f2c94c'] },
  // ── Aura (earned only) ──
  { id: 'glowaura',   slot: 'aura',  label: 'Glow Aura',   emoji: '✨', levelLock: 5,  colors: ['#7dd3fc', '#f2c94c', '#a855f7'] },
  { id: 'starpulse',  slot: 'aura',  label: 'Star Pulse',  emoji: '🌟', levelLock: 10, colors: ['#f2c94c'] },
]
export const SLOTS = [
  { id: 'head',  label: 'Head',  emoji: '🧢' },
  { id: 'face',  label: 'Face',  emoji: '🕶️' },
  { id: 'beard', label: 'Beard', emoji: '🧔' },
  { id: 'body',  label: 'Body',  emoji: '🧥' },
  { id: 'legs',  label: 'Legs',  emoji: '👖' },
  { id: 'feet',  label: 'Feet',  emoji: '👟' },
  { id: 'back',  label: 'Back',  emoji: '🎒' },
  { id: 'neck',  label: 'Neck',  emoji: '📿' },
  { id: 'aura',  label: 'Aura',  emoji: '✨' },
]
export const itemById = (id) => WARDROBE_CATALOG.find(i => i.id === id)

const _s = {
  uid: null,
  equipped: {},     // slot → itemId
  colors: {},       // itemId → chosen hex
  owned: [],        // itemIds
  presets: [],      // [{ name, equipped, colors }] ×3
  listeners: new Set(),
  inited: false,
  notifiedLocks: {},  // levelLock → true once celebrated
}

function emit() { const st = getWardrobe(); _s.listeners.forEach(fn => fn(st)) }
export function onWardrobeUpdate(fn) { _s.listeners.add(fn); return () => _s.listeners.delete(fn) }
export function getWardrobe() {
  return { equipped: { ..._s.equipped }, colors: { ..._s.colors }, owned: [..._s.owned], presets: [..._s.presets] }
}
/** The render payload: { slot: { id, color } } — consumed by <Accessories/> and multiplayer sync. */
export function getEquippedRender() {
  const out = {}
  for (const [slot, id] of Object.entries(_s.equipped)) {
    if (!id) continue
    const item = itemById(id)
    if (!item) continue
    out[slot] = { id, color: _s.colors[id] || item.colors[0] }
  }
  return out
}

const _ls = () => `wardrobe_${_s.uid}`
function _saveLocal() {
  try { localStorage.setItem(_ls(), JSON.stringify({ equipped: _s.equipped, colors: _s.colors, owned: _s.owned, presets: _s.presets })) } catch {}
}
let _dbT = 0
function _persist() {
  _saveLocal()
  if (!supabase || !_s.uid) return
  const now = Date.now()
  if (now - _dbT < 1500) return
  _dbT = now
  supabase.from('players').update({
    equipped_items: { equipped: _s.equipped, colors: _s.colors },
    owned_items: _s.owned,
    outfit_presets: _s.presets,
  }).eq('id', _s.uid).then(() => {}, () => {})
}

export async function initWardrobe(uid) {
  if (uid) _s.uid = uid
  if (_s.inited) return
  _s.inited = true
  let row = null
  if (supabase && _s.uid) {
    try {
      const { data } = await supabase.from('players')
        .select('equipped_items, owned_items, outfit_presets').eq('id', _s.uid).maybeSingle()
      row = data
    } catch {}
  }
  if (row && (row.equipped_items || row.owned_items)) {
    _s.equipped = row.equipped_items?.equipped || {}
    _s.colors   = row.equipped_items?.colors || {}
    _s.owned    = row.owned_items || []
    _s.presets  = row.outfit_presets || []
  } else {
    try {
      const d = JSON.parse(localStorage.getItem(_ls()) || 'null')
      if (d) { _s.equipped = d.equipped || {}; _s.colors = d.colors || {}; _s.owned = d.owned || []; _s.presets = d.presets || [] }
    } catch {}
  }
  emit()
}

export function playerLevel() { return getMissionState()?.level || 1 }

/** owned | locked | buyable — level items are earned, never bought. */
export function itemStatus(item) {
  if (_s.owned.includes(item.id)) return 'owned'
  if (item.levelLock) return playerLevel() >= item.levelLock ? 'earned' : 'locked'
  return 'buyable'
}

export function buyItem(itemId) {
  const item = itemById(itemId)
  if (!item || _s.owned.includes(itemId)) return { ok: false }
  if (item.levelLock) {
    if (playerLevel() < item.levelLock) return { ok: false, reason: `Reach level ${item.levelLock} to earn this` }
    _s.owned.push(itemId); _persist(); emit()
    return { ok: true, earned: true }
  }
  const paid = item.currency === 'gems' ? spendGems(item.price) : spendCoins(item.price)
  if (!paid) return { ok: false, reason: `Not enough ${item.currency}` }
  _s.owned.push(itemId); _persist(); emit()
  return { ok: true }
}

export function equipItem(itemId) {
  const item = itemById(itemId)
  if (!item) return { ok: false }
  if (!_s.owned.includes(itemId)) {
    const r = buyItem(itemId)             // earned items auto-own on equip
    if (!r.ok) return r
  }
  _s.equipped[item.slot] = itemId
  _persist(); emit()
  window.dispatchEvent(new CustomEvent('wardrobe-changed'))
  return { ok: true }
}

export function unequipSlot(slot) {
  delete _s.equipped[slot]
  _persist(); emit()
  window.dispatchEvent(new CustomEvent('wardrobe-changed'))
}

export function setItemColor(itemId, color) {
  _s.colors[itemId] = color
  _persist(); emit()
  window.dispatchEvent(new CustomEvent('wardrobe-changed'))
}

export function savePreset(index, name) {
  _s.presets[index] = { name: name || `Outfit ${index + 1}`, equipped: { ..._s.equipped }, colors: { ..._s.colors } }
  _persist(); emit()
}
export function loadPreset(index) {
  const p = _s.presets[index]
  if (!p) return
  _s.equipped = { ...p.equipped }
  _s.colors   = { ...p.colors, ..._s.colors, ...p.colors }
  _persist(); emit()
  window.dispatchEvent(new CustomEvent('wardrobe-changed'))
}

/** Level-up unlock celebration — call when level changes; returns newly reachable items. */
export function checkLevelUnlocks() {
  const lvl = playerLevel()
  const fresh = []
  for (const item of WARDROBE_CATALOG) {
    if (item.levelLock && lvl >= item.levelLock && !_s.notifiedLocks[item.id]) {
      _s.notifiedLocks[item.id] = true
      if (!_s.owned.includes(item.id)) fresh.push(item)
    }
  }
  return fresh
}
