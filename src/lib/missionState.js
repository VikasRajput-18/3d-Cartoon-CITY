import { supabase } from './supabase'

const _s = {
  uid: null,
  avatarName: null,
  missions: [],
  playerMissions: [],
  xp: 0,
  level: 1,
  dailyCompleted: {},
  dailyResetAt: 0,
  listeners: new Set(),
  initialized: false,
}

const WEEK = 1

const STORY_MISSIONS = [
  { id:'m1_1', chapter:1, week:1, title:'Something Strange',   description:'Visit the Cafe and talk to Anaya. She has noticed something odd.',                                              type:'talk',         target_npc:'Anaya',      target_place:'cafe',        reward_coins:30,  reward_xp:50,  order_index:1 },
  { id:'m1_2', chapter:1, week:1, title:'Ask Around',          description:'Talk to Rahul at the Arcade and Zoya at the Beach. They might know something.',                                  type:'talk_multiple',target_npc:'Rahul,Zoya', target_place:'arcade,beach',reward_coins:50,  reward_xp:100, order_index:2 },
  { id:'m1_3', chapter:1, week:1, title:'The Hidden Note',     description:'A glowing object has appeared in the Park. Go find it and interact with it.',                                     type:'explore',      target_npc:null,         target_place:'park',        reward_coins:75,  reward_xp:150, order_index:3 },
  { id:'m1_4', chapter:1, week:1, title:'Decode Together',     description:'The note is scrambled. Find 2 other online players and stand near them to decode it together.',                   type:'coop',         target_npc:null,         target_place:null,          reward_coins:100, reward_xp:200, order_index:4 },
  { id:'m1_5', chapter:1, week:1, title:'Confront the Shadow', description:'All clues point to the city center. The Shadow Vendor has appeared. Defeat him!',                                 type:'boss',         target_npc:null,         target_place:'center',      reward_coins:200, reward_xp:500, order_index:5 },
]

export const DAILY_MISSIONS = [
  { id:'daily_building', title:'City Explorer',    description:'Visit any building today',        reward_coins:20, icon:'🏛️' },
  { id:'daily_npc',      title:'Social Butterfly', description:'Chat with any NPC',               reward_coins:30, icon:'💬' },
  { id:'daily_vehicle',  title:'Road Warrior',     description:'Drive a vehicle for 30 seconds',  reward_coins:25, icon:'🚗' },
]

// Shared flag so WorldCanvas can check orb visibility without importing React state
export const orbActiveFlag = { value: false }

// Mission hint text shown in toast when a mission unlocks
const MISSION_HINTS = {
  m1_1: '🏙️ Head to the Cafe and talk to Anaya — she has noticed something strange.',
  m1_2: '🕹️ Find Rahul at the Arcade and Zoya at the Beach and chat with both.',
  m1_3: '🌳 A glowing object appeared in the Park. Walk up to it and press F to examine it.',
  m1_4: '🤝 Stand near 2 other players for 5 seconds to decode the note together.',
  m1_5: '⚔️ The Shadow Vendor has appeared at the city center — press F to attack!',
}

let _m4FallbackTimer = null

function emit() { _s.listeners.forEach(fn => fn(getMissionState())) }

export function onMissionUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getMissionState() {
  return {
    missions: _s.missions,
    playerMissions: _s.playerMissions,
    xp: _s.xp,
    level: _s.level,
    dailyCompleted: { ..._s.dailyCompleted },
    dailyResetAt: _s.dailyResetAt,
    initialized: _s.initialized,
  }
}

function lsKey(uid)      { return `ms_prog_${uid}` }
function lsDailyKey(uid) { return `ms_daily_${uid}` }

function saveProgress() {
  try {
    localStorage.setItem(lsKey(_s.uid), JSON.stringify({
      playerMissions: _s.playerMissions,
      xp: _s.xp,
      level: _s.level,
    }))
  } catch {}
}

function loadDailyLocal(uid) {
  try {
    const raw = localStorage.getItem(lsDailyKey(uid))
    if (!raw) { _s.dailyResetAt = nextMidnight(); return }
    const data = JSON.parse(raw)
    if (Date.now() >= data.resetAt) {
      _s.dailyCompleted = {}
      _s.dailyResetAt   = nextMidnight()
    } else {
      _s.dailyCompleted = data.completed || {}
      _s.dailyResetAt   = data.resetAt
    }
  } catch { _s.dailyResetAt = nextMidnight() }
}

function saveDailyLocal() {
  try {
    localStorage.setItem(lsDailyKey(_s.uid), JSON.stringify({
      completed: _s.dailyCompleted,
      resetAt:   _s.dailyResetAt,
    }))
  } catch {}
}

function nextMidnight() {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}

export function calcLevel(xp) {
  const level     = Math.floor(xp / 500) + 1
  const xpInLevel = xp % 500
  return { level, xpInLevel, xpToNext: 500 }
}

export async function initMissions(uid, avatarName) {
  if (!uid) return
  _s.uid         = uid
  _s.avatarName  = avatarName
  _s.dailyResetAt = nextMidnight()

  if (supabase) {
    const { data: ms } = await supabase.from('missions').select('*').eq('week', WEEK).order('order_index')
    _s.missions = (ms && ms.length > 0) ? ms : STORY_MISSIONS

    const { data: pm } = await supabase.from('player_missions').select('*').eq('player_uid', uid)
    if (pm && pm.length > 0) {
      _s.playerMissions = pm
    } else {
      await _bootstrap(uid)
    }

    const { data: player } = await supabase.from('players').select('xp,level').eq('id', uid).maybeSingle()
    if (player) { _s.xp = player.xp ?? 0; _s.level = player.level ?? 1 }
  } else {
    _s.missions = STORY_MISSIONS
    const raw = localStorage.getItem(lsKey(uid))
    if (raw) {
      const d = JSON.parse(raw)
      _s.playerMissions = d.playerMissions || []
      _s.xp    = d.xp    || 0
      _s.level = d.level || 1
    } else {
      await _bootstrap(uid)
    }
  }

  loadDailyLocal(uid)
  _updateOrbFlag()
  _s.initialized = true
  emit()
}

async function _bootstrap(uid) {
  const rows = _s.missions.map((m, i) => ({
    player_uid: uid, mission_id: m.id,
    status: i === 0 ? 'active' : 'locked',
  }))
  if (supabase) {
    const { data } = await supabase.from('player_missions').insert(rows).select()
    _s.playerMissions = data || rows
  } else {
    _s.playerMissions = rows
  }
  saveProgress()
}

function _updateOrbFlag() {
  orbActiveFlag.value = getMissionStatus('m1_3') === 'active'
}

export function getMissionStatus(missionId) {
  const pm = _s.playerMissions.find(p => p.mission_id === missionId)
  return pm?.status ?? 'locked'
}

export function getActiveMission() {
  for (const m of _s.missions) {
    if (getMissionStatus(m.id) === 'active') return m
  }
  return null
}

export function getChapterProgress() {
  const total     = _s.missions.length
  const completed = _s.missions.filter(m => getMissionStatus(m.id) === 'completed').length
  return total > 0 ? completed / total : 0
}

export async function completeMission(missionId) {
  const mission = _s.missions.find(m => m.id === missionId)
  if (!mission || getMissionStatus(missionId) !== 'active') return

  const pm = _s.playerMissions.find(p => p.mission_id === missionId)
  if (pm) { pm.status = 'completed'; pm.completed_at = new Date().toISOString() }

  _s.xp += mission.reward_xp
  const { level } = calcLevel(_s.xp)
  _s.level = level

  window.dispatchEvent(new CustomEvent('economy-reward', { detail: { coins: mission.reward_coins ?? 0 } }))

  const next = _s.missions.find(m => m.order_index === mission.order_index + 1)
  if (next) {
    let nextPm = _s.playerMissions.find(p => p.mission_id === next.id)
    if (nextPm) { nextPm.status = 'active'; nextPm.started_at = new Date().toISOString() }
    else _s.playerMissions.push({ player_uid: _s.uid, mission_id: next.id, status: 'active', started_at: new Date().toISOString() })
    window.dispatchEvent(new CustomEvent('mission-unlocked', {
      detail: { title: next.title, hint: MISSION_HINTS[next.id] || next.description, id: next.id },
    }))

    // m1_4 solo fallback — auto-complete after 75 s if no co-op partner found
    if (next.id === 'm1_4') {
      if (_m4FallbackTimer) clearTimeout(_m4FallbackTimer)
      _m4FallbackTimer = setTimeout(() => {
        _m4FallbackTimer = null
        if (getMissionStatus('m1_4') === 'active') completeMission('m1_4')
      }, 75000)
    }
  }

  saveProgress()

  if (supabase) {
    await supabase.from('player_missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('player_uid', _s.uid).eq('mission_id', missionId)
    if (next) {
      await supabase.from('player_missions')
        .upsert({ player_uid: _s.uid, mission_id: next.id, status: 'active', started_at: new Date().toISOString() }, { onConflict: 'player_uid,mission_id' })
    }
    await supabase.from('players').update({ xp: _s.xp, level: _s.level }).eq('id', _s.uid)
  }

  _updateOrbFlag()

  if (next?.type === 'boss') {
    window.dispatchEvent(new CustomEvent('boss-activate'))
  }
  if (!next) {
    window.dispatchEvent(new CustomEvent('chapter-complete'))
  }

  emit()
}

export function skipMission(missionId) {
  if (getMissionStatus(missionId) !== 'active') return { ok: false, reason: 'Mission is not active' }
  completeMission(missionId)
  return { ok: true }
}

export function completeDailyMission(id) {
  if (!_s.uid || _s.dailyCompleted[id]) return
  const dailyDef = DAILY_MISSIONS.find(d => d.id === id)
  const coinsReward = dailyDef?.reward_coins ?? 20
  _s.dailyCompleted[id] = true
  _s.xp += 20
  const { level } = calcLevel(_s.xp)
  _s.level = level
  saveDailyLocal()
  saveProgress()
  window.dispatchEvent(new CustomEvent('economy-reward', { detail: { coins: coinsReward } }))
  if (supabase && _s.uid) supabase.from('players').update({ xp: _s.xp, level: _s.level }).eq('id', _s.uid)
  emit()
}

const _talkedTo = new Set()

export function recordNPCTalk(npcName) {
  if (!npcName) return
  _talkedTo.add(npcName)
  completeDailyMission('daily_npc')

  const active = getActiveMission()
  if (!active) return

  if (active.id === 'm1_1' && npcName === 'Anaya') {
    completeMission('m1_1')
    return
  }
  if (active.id === 'm1_2') {
    const npcs = (active.target_npc || '').split(',').map(s => s.trim())
    if (npcs.every(n => _talkedTo.has(n))) completeMission('m1_2')
  }
}
