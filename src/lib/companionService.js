// Personal AI companion (Phase 1 — core): one permanent companion per player that
// follows them in the world, talks via Groq, remembers things, and levels up.
// Persists to the Supabase `companions` table (+ localStorage fallback).
// Challenges, leveling perks, customization shop, multiplayer-visibility and the
// settings panel are later phases.

import { supabase } from './supabase'
import { groqChat } from './groqChat'

export const PERSONALITIES = [
  { id: 'funny',       emoji: '😜', label: 'Funny',       desc: 'Makes jokes, teases you, always cheerful' },
  { id: 'caring',      emoji: '🥰', label: 'Caring',      desc: 'Worries about you, supportive, sweet' },
  { id: 'competitive', emoji: '😎', label: 'Competitive', desc: 'Always challenges you, brags, pushes you' },
  { id: 'chill',       emoji: '😌', label: 'Chill',       desc: 'Goes with the flow, random wisdom, relaxed' },
]
export const OUTFIT_COLORS = ['#FF6B6B', '#4FC3F7', '#FFD166', '#06D6A0', '#A78BFA', '#F472B6', '#FB923C', '#94A3B8']
export const SKIN_COLORS   = ['#FDBCB4', '#F4C08A', '#D4956A', '#C68642', '#8D5524', '#5C3A21']
export const NAME_SUGGESTIONS = ['Max', 'Luna', 'Raj', 'Priya', 'Rocky', 'Zara']

// Per-personality fallback quips (used when Groq is unavailable, keeps it alive offline).
const FALLBACK = {
  funny:       ['Bhai ATM se coins nikalo... oh wait 😏', 'Yeh sheher mast hai, par tu boring hai!', 'Chal koi panga karte hain!'],
  caring:      ['Yaar paani piya? Apna dhyan rakho 🥺', 'Koi mission pending hai na? Chalo karte hain', 'Tum thak gaye ho, thoda rest karo'],
  competitive: ['Race lagaoge? Main toh jeet hi jaunga 😎', 'Itne kam coins? Main zyada kamaata', 'Chal dekhte hain kaun aage nikalta hai'],
  chill:       ['Sab moh maya hai yaar... coins bhi 🌿', 'Jo hoga dekha jayega, tension nahi', 'Bas vibe check kar raha tha'],
}

const XP = { conversation: 5, challenge: 20, day: 10 }
const LEVELS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000]

const _s = {
  uid: null, playerName: null,
  companion: null,           // { name, personality, outfitColor, skinColor, level, xp, mood, memories }
  visible: true,
  sessionMsgs: [],           // chat history for the session
  listeners: new Set(),
  inited: false,
  saveT: 0,
}

function emit() { const c = getCompanion(); _s.listeners.forEach(fn => fn(c)) }
export function onCompanionUpdate(fn) { _s.listeners.add(fn); return () => _s.listeners.delete(fn) }
export function getCompanion() { return _s.companion ? { ..._s.companion, visible: _s.visible } : null }
export function hasCompanion() { return !!_s.companion }
export function setCompanionVisible(v) { _s.visible = v; emit() }

const _lsKey = () => `companion_${_s.uid}`
function _saveLocal() { try { if (_s.companion) localStorage.setItem(_lsKey(), JSON.stringify(_s.companion)) } catch {} }

function _levelForXp(xp) {
  let lvl = 1
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) lvl = i + 1
  return lvl
}

export async function initCompanions(uid, playerName) {
  _s.uid = uid; _s.playerName = playerName
  if (_s.inited) return getCompanion()
  _s.inited = true

  let row = null
  if (supabase && uid) {
    try { const { data } = await supabase.from('companions').select('*').eq('player_id', uid).maybeSingle(); row = data } catch {}
  }
  if (!row) { try { const raw = localStorage.getItem(_lsKey()); if (raw) row = JSON.parse(raw) } catch {} }

  if (row) {
    _s.companion = {
      name: row.name || 'Buddy',
      personality: row.personality || 'friendly',
      outfitColor: row.outfit_color || row.outfitColor || '#FF6B6B',
      skinColor: row.skin_color || row.skinColor || '#FDBCB4',
      level: row.level || 1,
      xp: row.xp || 0,
      mood: row.mood || 'happy',
      memories: row.memories || [],
    }
    addXp(XP.day)   // a little XP for spending another day together
  }
  emit()
  return getCompanion()
}

export async function createCompanion({ name, personality, outfitColor, skinColor }) {
  _s.companion = {
    name: name?.trim() || 'Buddy',
    personality: personality || 'funny',
    outfitColor: outfitColor || '#FF6B6B',
    skinColor: skinColor || '#FDBCB4',
    level: 1, xp: 0, mood: 'happy', memories: [],
  }
  _saveLocal()
  if (supabase && _s.uid) {
    try {
      await supabase.from('companions').upsert({
        player_id: _s.uid, name: _s.companion.name, personality: _s.companion.personality,
        outfit_color: _s.companion.outfitColor, skin_color: _s.companion.skinColor,
        level: 1, xp: 0, mood: 'happy', memories: [],
      }, { onConflict: 'player_id' })
    } catch {}
  }
  emit()
  return getCompanion()
}

function _persist() {
  _saveLocal()
  const now = Date.now()
  if (supabase && _s.uid && now - _s.saveT > 4000) {
    _s.saveT = now
    const c = _s.companion
    supabase.from('companions').update({
      level: c.level, xp: c.xp, mood: c.mood, memories: c.memories, last_interaction: new Date().toISOString(),
    }).eq('player_id', _s.uid).then(() => {}, () => {})
  }
}

export function addXp(n) {
  if (!_s.companion || n <= 0) return
  _s.companion.xp += n
  const lvl = _levelForXp(_s.companion.xp)
  if (lvl > _s.companion.level) {
    _s.companion.level = lvl
    window.dispatchEvent(new CustomEvent('companion-levelup', { detail: { name: _s.companion.name, level: lvl } }))
  }
  _persist(); emit()
}

export function addMemory(event, extra = {}) {
  if (!_s.companion) return
  _s.companion.memories.push({ event, time: Date.now(), ...extra })
  if (_s.companion.memories.length > 20) _s.companion.memories = _s.companion.memories.slice(-20)
  _persist()
}

function _fallbackLine() {
  const pool = FALLBACK[_s.companion?.personality] || FALLBACK.funny
  return pool[Math.floor(Math.random() * pool.length)]
}

function _sysPrompt(context = {}) {
  const c = _s.companion
  const mem = (c.memories || []).slice(-4).map(m => m.event).join(', ')
  return (
    `You are ${c.name}, a ${c.personality} AI companion in Cartoon Life Universe, hanging out with your player ${_s.playerName || 'friend'}. ` +
    `Context — time: ${context.time || 'day'}, weather: ${context.weather || 'clear'}, location: ${context.location || 'the city'}, player coins: ${context.coins ?? '?'}. ` +
    (mem ? `Things you remember: ${mem}. ` : '') +
    `Reply with ONE short message in Hinglish (Hindi+English mix), max 15 words, natural and fun. ` +
    `Personality: funny=jokes/roasts, caring=concerned/sweet, competitive=challenging/boastful, chill=philosophical/relaxed.`
  )
}

/** A spontaneous one-liner for the speech bubble. Falls back to canned lines offline. */
export async function generateLine(context = {}) {
  if (!_s.companion) return ''
  try {
    const line = await groqChat([{ role: 'user', content: '[Say something spontaneous to me right now.]' }], _sysPrompt(context), 50)
    addXp(1)
    return line.replace(/^["']|["']$/g, '')
  } catch {
    return _fallbackLine()
  }
}

/** Full chat reply (companion chat panel). Keeps short session context. */
export async function chatWithCompanion(message, context = {}) {
  if (!_s.companion) return ''
  _s.sessionMsgs.push({ role: 'user', content: message })
  let reply
  try {
    reply = await groqChat(_s.sessionMsgs.slice(-8), _sysPrompt(context), 90)
  } catch {
    reply = _fallbackLine()
  }
  _s.sessionMsgs.push({ role: 'assistant', content: reply })
  addXp(XP.conversation)
  addMemory('chatted', { snippet: message.slice(0, 40) })
  return reply
}
