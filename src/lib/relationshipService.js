// Relationship system (Phase 1 — core loop): send a rose, accept/decline, become a
// couple, see partner status, navigate to partner, and break up with drama.
// Synced via Supabase `relationships` (+ realtime) and the players partner columns.
// Dates, shared piggy bank, gifts, online-together bonus, world heart visuals and
// achievements are later phases.

import { supabase } from './supabase'
import { addCoins, spendCoins } from './economyState'
import { remotePlayersRef } from './multiplayerState'
import { teleportRequest } from './teleportState'

const ROSE_COST        = 10
const COUPLE_BONUS     = 50
const BREAKUP_PENALTY  = 100
const COOLDOWN_MS      = 48 * 60 * 60 * 1000   // 48h before a new relationship
const BADGE_MS         = 24 * 60 * 60 * 1000   // broken-heart badge duration

const _s = {
  uid: null, name: null,
  status: 'single',          // 'single' | 'relationship'
  partner: null,             // { id, name }
  rowId: null,
  startedAt: null,
  incomingRoses: [],         // [{ rowId, fromId, fromName }]
  cooldownUntil: 0,
  brokenHeartUntil: 0,
  listeners: new Set(),
  channel: null,
  inited: false,
}

function emit() { const st = getRelationshipState(); _s.listeners.forEach(fn => fn(st)) }
export function onRelationshipUpdate(fn) { _s.listeners.add(fn); return () => _s.listeners.delete(fn) }

export function getRelationshipState() {
  return {
    status: _s.status,
    partner: _s.partner ? { ..._s.partner } : null,
    startedAt: _s.startedAt,
    incomingRoses: [..._s.incomingRoses],
    daysTogether: _s.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(_s.startedAt).getTime()) / 86400000)) : 0,
    partnerOnline: _s.partner ? (_s.partner.isNpc ? true : remotePlayersRef.current.has(_s.partner.id)) : false,
    onCooldown: Date.now() < _s.cooldownUntil,
    cooldownUntil: _s.cooldownUntil,
    brokenHeart: Date.now() < _s.brokenHeartUntil,
  }
}

const _lsKey = () => `rel_${_s.uid}`
function _saveLocal() {
  try {
    // NPC relationships have no server row, so persist them locally.
    const npc = _s.partner?.isNpc ? { partner: _s.partner, startedAt: _s.startedAt } : {}
    localStorage.setItem(_lsKey(), JSON.stringify({ cooldownUntil: _s.cooldownUntil, brokenHeartUntil: _s.brokenHeartUntil, ...npc }))
  } catch {}
}
function _loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(_lsKey()) || '{}')
    _s.cooldownUntil    = d.cooldownUntil    || 0
    _s.brokenHeartUntil = d.brokenHeartUntil || 0
    if (d.partner?.isNpc) { _s.partner = d.partner; _s.startedAt = d.startedAt; _s.status = 'relationship' }
  } catch {}
}

// ── Init ───────────────────────────────────────────────────────────────────────
export async function initRelationships(uid = null, name = null) {
  if (uid) _s.uid = uid
  if (name) _s.name = name
  if (_s.inited) return
  _s.inited = true
  _loadLocal()
  await fetchMine()

  if (supabase) {
    try {
      _s.channel = supabase.channel('relationships_rt')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'relationships' }, p => _onRow(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'relationships' }, p => _onRow(p.new))
        .subscribe()
    } catch {}
  }
  emit()
}

function _setPartnerFromRow(row) {
  const iAmP1 = row.player1_id === _s.uid
  _s.status = 'relationship'
  _s.rowId = row.id
  _s.startedAt = row.started_at || new Date().toISOString()
  _s.partner = iAmP1 ? { id: row.player2_id, name: row.player2_name } : { id: row.player1_id, name: row.player1_name }
}

async function fetchMine() {
  if (!supabase || !_s.uid) return
  try {
    // Active relationship I'm part of.
    const { data: act } = await supabase.from('relationships').select('*')
      .or(`player1_id.eq.${_s.uid},player2_id.eq.${_s.uid}`).eq('status', 'active').limit(1)
    if (act && act[0]) _setPartnerFromRow(act[0])
    // Pending roses sent TO me.
    const { data: pend } = await supabase.from('relationships').select('*')
      .eq('player2_id', _s.uid).eq('status', 'pending')
    _s.incomingRoses = (pend || []).map(r => ({ rowId: r.id, fromId: r.player1_id, fromName: r.player1_name }))
  } catch {}
  emit()
}

function _onRow(row) {
  if (!row) return
  const involvesMe = row.player1_id === _s.uid || row.player2_id === _s.uid
  if (!involvesMe) return

  if (row.status === 'pending' && row.player2_id === _s.uid) {
    if (!_s.incomingRoses.some(r => r.rowId === row.id)) {
      _s.incomingRoses.push({ rowId: row.id, fromId: row.player1_id, fromName: row.player1_name })
      window.dispatchEvent(new CustomEvent('rose-received', { detail: { fromName: row.player1_name, rowId: row.id } }))
      emit()
    }
  } else if (row.status === 'active') {
    _setPartnerFromRow(row)
    _s.incomingRoses = []
    window.dispatchEvent(new CustomEvent('relationship-started', { detail: { partner: _s.partner } }))
    emit()
  } else if (row.status === 'ended') {
    if (_s.rowId === row.id || (_s.partner && (row.player1_id === _s.partner.id || row.player2_id === _s.partner.id))) {
      const wasPartner = _s.partner?.name
      _clearRelationshipLocal()
      window.dispatchEvent(new CustomEvent('relationship-ended', { detail: { byPartner: true, partnerName: wasPartner } }))
      emit()
    }
  } else if (row.status === 'declined' && row.player1_id === _s.uid) {
    window.dispatchEvent(new CustomEvent('rose-declined', { detail: { name: row.player2_name } }))
  }
}

function _clearRelationshipLocal() {
  _s.status = 'single'; _s.partner = null; _s.rowId = null; _s.startedAt = null
}

// ── Actions ───────────────────────────────────────────────────────────────────
export function sendRose(targetId, targetName) {
  if (!targetId || targetId === _s.uid) return { ok: false, reason: "That's not someone you can romance." }
  if (_s.status === 'relationship') return { ok: false, reason: "You're already in a relationship." }
  if (Date.now() < _s.cooldownUntil) return { ok: false, reason: 'Heartbreak cooldown — try again later.' }
  if (!spendCoins(ROSE_COST)) return { ok: false, reason: `Need ${ROSE_COST} coins to send a rose.` }

  if (supabase) {
    supabase.from('relationships').insert({
      player1_id: _s.uid, player1_name: _s.name,
      player2_id: targetId, player2_name: targetName, status: 'pending',
    }).then(() => {}, () => {})
  }
  window.dispatchEvent(new CustomEvent('rose-sent', { detail: { to: targetName } }))
  return { ok: true }
}

// Send a rose to a city NPC — they accept instantly (local relationship, no server).
export function sendRoseToNpc(npcName) {
  if (!npcName) return { ok: false }
  if (_s.status === 'relationship') return { ok: false, reason: "You're already in a relationship." }
  if (Date.now() < _s.cooldownUntil) return { ok: false, reason: 'Heartbreak cooldown — try again later.' }
  if (!spendCoins(ROSE_COST)) return { ok: false, reason: `Need ${ROSE_COST} coins to send a rose.` }
  _s.status = 'relationship'
  _s.partner = { id: 'npc:' + npcName, name: npcName, isNpc: true }
  _s.startedAt = new Date().toISOString()
  _s.rowId = null
  addCoins(COUPLE_BONUS)
  _saveLocal()
  window.dispatchEvent(new CustomEvent('relationship-confetti'))
  window.dispatchEvent(new CustomEvent('relationship-started', { detail: { partner: _s.partner } }))
  emit()
  return { ok: true }
}

export async function acceptRose(rowId, fromId, fromName) {
  if (_s.status === 'relationship') return { ok: false, reason: 'Already in a relationship.' }
  const startedAt = new Date().toISOString()
  if (supabase) {
    try { await supabase.from('relationships').update({ status: 'active', started_at: startedAt }).eq('id', rowId) } catch {}
    // Decline any other pending roses to me.
    try { await supabase.from('relationships').update({ status: 'declined' }).eq('player2_id', _s.uid).eq('status', 'pending') } catch {}
    _updatePlayersPartner(_s.uid, fromId, fromName)
    _updatePlayersPartner(fromId, _s.uid, _s.name)
  }
  _s.status = 'relationship'; _s.rowId = rowId; _s.startedAt = startedAt; _s.partner = { id: fromId, name: fromName }
  _s.incomingRoses = []
  addCoins(COUPLE_BONUS)
  window.dispatchEvent(new CustomEvent('relationship-confetti'))
  window.dispatchEvent(new CustomEvent('relationship-announce', { detail: { text: `💕 ${fromName} and ${_s.name} are now in a relationship!` } }))
  emit()
  return { ok: true }
}

export async function declineRose(rowId) {
  _s.incomingRoses = _s.incomingRoses.filter(r => r.rowId !== rowId)
  if (supabase) { try { await supabase.from('relationships').update({ status: 'declined' }).eq('id', rowId) } catch {} }
  emit()
}

export async function breakUp() {
  if (_s.status !== 'relationship') return { ok: false }
  const partner = _s.partner
  if (supabase && _s.rowId) { try { await supabase.from('relationships').update({ status: 'ended' }).eq('id', _s.rowId) } catch {} }
  if (supabase) {
    _updatePlayersPartner(_s.uid, null, null)
    if (partner && !partner.isNpc) _updatePlayersPartner(partner.id, null, null)
  }
  spendCoins(BREAKUP_PENALTY)   // heartbreak penalty (best-effort)
  _s.cooldownUntil    = Date.now() + COOLDOWN_MS
  _s.brokenHeartUntil = Date.now() + BADGE_MS
  _saveLocal()
  _clearRelationshipLocal()
  window.dispatchEvent(new CustomEvent('relationship-announce', { detail: { text: '💔 A relationship in the city has ended.' } }))
  window.dispatchEvent(new CustomEvent('relationship-broke', { detail: { partnerName: partner?.name } }))
  emit()
  return { ok: true }
}

/** Free fast-travel to the partner's current position (if online). */
export function navigateToPartner() {
  if (!_s.partner) return { ok: false, reason: 'No partner.' }
  if (_s.partner.isNpc) return { ok: false, reason: 'Your sweetheart is wandering the city — go find them!' }
  const p = remotePlayersRef.current.get(_s.partner.id)
  if (!p) return { ok: false, reason: 'Partner is offline.' }
  teleportRequest.x = p.x; teleportRequest.z = p.z; teleportRequest.pending = true
  return { ok: true }
}

function _updatePlayersPartner(playerId, partnerId, partnerName) {
  if (!supabase || !playerId) return
  supabase.from('players').update({
    relationship_status: partnerId ? 'relationship' : 'single',
    partner_id: partnerId, partner_name: partnerName,
  }).eq('id', playerId).then(() => {}, () => {})
}
