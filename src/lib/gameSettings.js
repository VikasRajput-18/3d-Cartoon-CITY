// Game settings loader — reads from Supabase game_settings table and overrides
// hardcoded COSTS values. Falls back gracefully when Supabase is unavailable.
import { supabase } from './supabase'
import { COSTS } from './costs'

const _settings = {}
const _listeners = new Set()
let _ready = false

function _notify() { _listeners.forEach(fn => fn({ ..._settings })) }

export function onSettingsUpdate(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function getSetting(key, defaultValue = null) {
  return key in _settings ? _settings[key] : defaultValue
}

export function getSettingBool(key, defaultValue = true) {
  if (!(key in _settings)) return defaultValue
  return _settings[key] !== 'false' && _settings[key] !== '0'
}

export function getSettingNum(key, defaultValue = 0) {
  const v = _settings[key]
  if (v === undefined || v === null) return defaultValue
  const n = Number(v)
  return isNaN(n) ? defaultValue : n
}

export function isFeatureEnabled(key) {
  return getSettingBool(key, true)
}

export function areSettingsReady() { return _ready }

// Applies fetched settings to the mutable COSTS object in place
function _applyCosts() {
  const map = {
    fast_travel_cost:       'fastTravel',
    house_travel_cost:      'houseTravel',
    call_start_cost:        'callPlayer',
    call_per_minute_cost:   'callMinute',
    npc_extra_message_cost: 'chatNPCExtra',
    vehicle_boost_cost:     'vehicleBoost',
  }
  for (const [settingKey, costKey] of Object.entries(map)) {
    if (settingKey in _settings) {
      const n = Number(_settings[settingKey])
      if (!isNaN(n)) COSTS[costKey] = n
    }
  }
}

export async function initGameSettings() {
  if (!supabase) { _ready = true; return }
  try {
    const { data } = await supabase.from('game_settings').select('key, value')
    if (data) {
      data.forEach(row => { _settings[row.key] = row.value })
      _applyCosts()
    }
  } catch { /* offline — use defaults */ }

  _ready = true
  _notify()

  // Subscribe to real-time settings changes (admin updates go live instantly)
  supabase.channel('settings_rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, ({ new: row }) => {
      if (row?.key) {
        _settings[row.key] = row.value
        _applyCosts()
        _notify()
      }
    })
    .subscribe()
}
