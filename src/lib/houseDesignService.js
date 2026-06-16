// House customization design service.
// Persists placed furniture items per player.
// Supabase table (run once):
//   house_furniture(player_id text pk, items jsonb default '[]')
//   + RLS: enable + "public all" policy (or auth-based)
//
// Each item in items[]: { id: uuid, catalogId: string, x: float, z: float, rot: float }

import { supabase } from './supabase'

const _s = {
  uid:       null,
  items:     [],
  listeners: new Set(),
}

function emit() { _s.listeners.forEach(fn => fn(getDesign())) }

export function onDesignUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getDesign() { return [..._s.items] }

const _lsKey = () => `house_design_${_s.uid ?? 'anon'}`

function _saveLocal() {
  try { localStorage.setItem(_lsKey(), JSON.stringify(_s.items)) } catch {}
}

async function _saveDB() {
  if (!supabase || !_s.uid) return
  try {
    await supabase.from('house_furniture')
      .upsert({ player_id: _s.uid, items: _s.items }, { onConflict: 'player_id' })
  } catch {}
}

export async function initDesign(uid) {
  _s.uid = uid
  if (supabase) {
    try {
      const { data } = await supabase.from('house_furniture')
        .select('items').eq('player_id', uid).maybeSingle()
      if (data?.items) {
        _s.items = data.items
        emit()
        return
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem(_lsKey())
    if (raw) _s.items = JSON.parse(raw)
  } catch {}
  emit()
}

function _uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export async function addFurnitureItem(catalogId, x, z, rot = 0) {
  const id = _uid()
  _s.items = [..._s.items, { id, catalogId, x, z, rot }]
  _saveLocal(); await _saveDB(); emit()
  return id
}

export async function removeFurnitureItem(id) {
  _s.items = _s.items.filter(it => it.id !== id)
  _saveLocal(); await _saveDB(); emit()
}

export async function moveFurnitureItem(id, x, z, rot) {
  _s.items = _s.items.map(it => it.id === id ? { ...it, x, z, rot } : it)
  _saveLocal(); await _saveDB(); emit()
}

export async function clearDesign() {
  _s.items = []
  _saveLocal(); await _saveDB(); emit()
}
