import { supabase } from './supabase'

const _s = {
  isActive: false,
  sessionId: null,
  bossName: 'Shadow Vendor',
  maxHp: 1000,
  currentHp: 1000,
  isDefeated: false,
  listeners: new Set(),
}

// Shared flag for WorldCanvas proximity checks
export const bossActiveFlag = { value: false }

function emit() { _s.listeners.forEach(fn => fn(getBossState())) }

export function getBossState() {
  return {
    isActive:   _s.isActive,
    sessionId:  _s.sessionId,
    bossName:   _s.bossName,
    maxHp:      _s.maxHp,
    currentHp:  _s.currentHp,
    isDefeated: _s.isDefeated,
    hpPercent:  _s.maxHp > 0 ? _s.currentHp / _s.maxHp : 0,
  }
}

export function onBossUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export async function initBoss() {
  if (!supabase) {
    try {
      const raw = localStorage.getItem('boss_state')
      if (raw) {
        const d = JSON.parse(raw)
        _s.isActive   = d.isActive   || false
        _s.currentHp  = d.currentHp  ?? 1000
        _s.maxHp      = d.maxHp      || 1000
        _s.isDefeated = d.isDefeated || false
        bossActiveFlag.value = _s.isActive && !_s.isDefeated
        emit()
      }
    } catch {}
    return
  }

  const { data } = await supabase.from('boss_sessions').select('*').eq('is_active', true).maybeSingle()
  if (data) {
    _s.isActive   = true
    _s.sessionId  = data.id
    _s.bossName   = data.boss_name
    _s.maxHp      = data.boss_hp
    _s.currentHp  = data.current_hp
    _s.isDefeated = data.current_hp <= 0
    bossActiveFlag.value = _s.isActive && !_s.isDefeated
    emit()
  }

  supabase.channel('boss_rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'boss_sessions' }, ({ new: d }) => {
      if (!d) return
      const wasDefeated = _s.isDefeated
      const wasActive   = _s.isActive
      _s.isActive   = d.is_active
      _s.sessionId  = d.id
      _s.bossName   = d.boss_name
      _s.maxHp      = d.boss_hp
      _s.currentHp  = d.current_hp
      bossActiveFlag.value = _s.isActive && _s.currentHp > 0
      if (d.current_hp <= 0 && !wasDefeated) {
        _s.isDefeated = true
        window.dispatchEvent(new CustomEvent('boss-defeated'))
        window.dispatchEvent(new CustomEvent('economy-reward', { detail: { coins: 200, gems: 25 } }))
      }
      if (d.is_active && !wasActive) {
        window.dispatchEvent(new CustomEvent('boss-spawned'))
      }
      emit()
    })
    .subscribe()
}

export async function spawnBoss() {
  _s.isActive   = true
  _s.currentHp  = 1000
  _s.maxHp      = 1000
  _s.isDefeated = false
  bossActiveFlag.value = true

  if (supabase) {
    await supabase.from('boss_sessions').update({ is_active: false }).eq('is_active', true)
    const { data } = await supabase.from('boss_sessions')
      .insert({ week: 1, boss_name: 'Shadow Vendor', boss_hp: 1000, current_hp: 1000, is_active: true })
      .select().single()
    if (data) _s.sessionId = data.id
  } else {
    localStorage.setItem('boss_state', JSON.stringify({ isActive: true, currentHp: 1000, maxHp: 1000, isDefeated: false }))
  }

  window.dispatchEvent(new CustomEvent('boss-spawned'))
  emit()
}

export async function attackBoss(uid, playerName) {
  if (!_s.isActive || _s.isDefeated || _s.currentHp <= 0) return 0
  const damage = 10 + Math.floor(Math.random() * 21)
  const newHp  = Math.max(0, _s.currentHp - damage)
  _s.currentHp = newHp
  bossActiveFlag.value = newHp > 0

  // 10 coins per attack hit
  window.dispatchEvent(new CustomEvent('economy-reward', { detail: { coins: 10 } }))

  if (supabase && _s.sessionId) {
    await supabase.from('boss_attacks').insert({ session_id: _s.sessionId, player_uid: uid, player_name: playerName, damage })
    const upd = { current_hp: newHp }
    if (newHp <= 0) { upd.is_active = false; upd.defeated_at = new Date().toISOString() }
    await supabase.from('boss_sessions').update(upd).eq('id', _s.sessionId)
  } else {
    if (newHp <= 0) {
      _s.isDefeated = true
      localStorage.setItem('boss_state', JSON.stringify({ isActive: false, currentHp: 0, maxHp: 1000, isDefeated: true }))
      window.dispatchEvent(new CustomEvent('boss-defeated'))
      window.dispatchEvent(new CustomEvent('economy-reward', { detail: { coins: 200, gems: 25 } }))
    }
    emit()
  }
  return damage
}
