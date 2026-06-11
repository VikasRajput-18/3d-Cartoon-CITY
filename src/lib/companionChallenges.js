// Companion challenge mini-games: coin-collect, trivia, hide-and-seek, race.
// Spontaneously triggered while the companion is active. The 2D UI lives in
// ChallengePopup.jsx; the 3D bits (coins, race lines, countdown) + the per-frame
// tick are driven by ChallengeScene.jsx. Companion movement during games is driven
// through companionState.targetOverride (Companion3D honours it).

import { addCoins } from './economyState'
import { addXp, addMemory, getCompanion, noteChallengeResult, noteActivity } from './companionService'
import { minimapState, chatState } from './minimapState'
import { companionState } from './companionState'
import { parkedVehicles } from './parkedVehicleState'
import { vehicleState } from './vehicleState'
import { remotePlayersRef } from './multiplayerState'
import { timeWeatherState } from './timeWeatherState'
import { groqChat } from './groqChat'

const COIN_VALUE   = 10
const TRIGGER_MIN  = 180   // 3 min
const TRIGGER_MAX  = 480   // 8 min
const POPUP_MS     = 15000
const RACE_DIST    = 120

const TRIVIA_FALLBACK = [
  { question: 'Konsa cricketer "Captain Cool" kehlata hai?', options: ['Virat Kohli', 'MS Dhoni', 'Rohit Sharma', 'Kapil Dev'], correct: 1, explanation: 'MS Dhoni is Captain Cool!' },
  { question: 'Taj Mahal kis sheher mein hai?', options: ['Delhi', 'Jaipur', 'Agra', 'Lucknow'], correct: 2, explanation: 'Agra mein hai.' },
  { question: 'Paani ka chemical formula kya hai?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correct: 1, explanation: 'H2O — do hydrogen, ek oxygen.' },
  { question: 'Bollywood ka "King Khan" kaun hai?', options: ['Salman', 'Aamir', 'Shah Rukh', 'Akshay'], correct: 2, explanation: 'Shah Rukh Khan!' },
  { question: 'Sabse bada planet konsa hai?', options: ['Earth', 'Jupiter', 'Mars', 'Saturn'], correct: 1, explanation: 'Jupiter sabse bada hai.' },
]

const _s = {
  active: null,
  listeners: new Set(),
  checkTimer: null,
  nextTriggerAt: 0,
  popupTimer: null,
  enabled: true,
  inCity: true,          // false while inside a building interior — gate challenges
  missionJustDone: false,
}

/** Called by Game when the player enters/leaves a building interior. */
export function setChallengeInCity(v) { _s.inCity = v }

function emit() { const st = getChallengeState(); _s.listeners.forEach(fn => fn(st)) }
export function onChallengeUpdate(fn) { _s.listeners.add(fn); return () => _s.listeners.delete(fn) }

export function getChallengeState() {
  const a = _s.active
  if (!a) return { active: false }
  return {
    active: true, type: a.type, phase: a.phase,
    timeLeft: a.endsAt ? Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)) : 0,
    playerScore: a.playerScore, compScore: a.compScore,
    coins: a.coins, question: a.question, options: a.options, qIndex: a.qIndex, qResult: a.qResult,
    temp: a.temp, tempColor: a.tempColor, dist: a.dist,
    countdown: a.countdown, result: a.result, line: a.line, prompt: a.prompt,
    race: a.type === 'race' ? { startX: a.startX, startZ: a.startZ, finishX: a.finishX, finishZ: a.finishZ, axis: a.axis } : null,
  }
}

// ── Trigger scheduling ────────────────────────────────────────────────────────
export function initCompanionChallenges() {
  if (_s.checkTimer) return
  _scheduleNext()
  _s.checkTimer = setInterval(_maybeTrigger, 20000)
  // Mission complete → celebration coin-collect with bonus coins (if in the open city).
  window.addEventListener('mission-completed', () => {
    _s.missionJustDone = true
    if (_canTrigger()) { _scheduleNext(); triggerChallenge('coin_collect', { bonus: true }) }
  })
}
function _scheduleNext() { _s.nextTriggerAt = Date.now() + (TRIGGER_MIN + Math.random() * (TRIGGER_MAX - TRIGGER_MIN)) * 1000 }

function _canTrigger() {
  if (!_s.enabled || _s.active) return false
  if (!_s.inCity) return false                                              // inside a building
  const c = getCompanion()
  if (!c || c.visible === false) return false
  if (minimapState.drivingType || minimapState.passengerOf) return false   // in a vehicle
  if (chatState.activeNpcName) return false                                 // talking to an NPC
  return true
}

function _nearVehicle() {
  const px = minimapState.playerX, pz = minimapState.playerZ
  const near = (x, z) => Math.hypot(px - x, pz - z) < 16
  if (near(vehicleState.car.x, vehicleState.car.z) || near(vehicleState.bike.x, vehicleState.bike.z)) return true
  return parkedVehicles.some(v => v.driverId === null && near(v.x, v.z))
}

function _pickType() {
  const px = minimapState.playerX, pz = minimapState.playerZ
  const night = !!timeWeatherState.isNight
  const nearFountain = Math.hypot(px, pz) < 12
  let nearPlayers = false
  remotePlayersRef.current.forEach(p => { if (Math.hypot(px - p.x, pz - p.z) < 25) nearPlayers = true })

  const w = { trivia: 2, coin_collect: 2, hide_seek: 1.5, dance_battle: 1.5, photo: 1, race: _nearVehicle() ? 4 : 0.4 }
  if (night)        { w.trivia += 1.5; w.dance_battle += 1.5 }   // cosy night vibes
  if (nearPlayers)  w.coin_collect += 2                          // competitive with others around
  if (nearFountain) w.photo += 3                                 // scenic spot

  const entries = Object.entries(w)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  let r = Math.random() * total
  for (const [k, v] of entries) { r -= v; if (r <= 0) return k }
  return 'trivia'
}

function _maybeTrigger() {
  if (Date.now() < _s.nextTriggerAt || !_canTrigger()) return
  triggerChallenge(_pickType())
}

const PROMPTS = {
  coin_collect: 'Chal 60 second mein jyada coins collect karta hai woh jeeta! 🪙',
  trivia:       'Ek sawal puchun? Sahi jawab pe coins milenge! 🧠',
  hide_seek:    'Main chupta hoon, dhundh mujhe 90 seconds mein! 🙈',
  race:         'Ek race lagaate hain? Main apni bike lata hoon! 🏍️',
}
const PERSONA_PROMPTS = {
  dance_battle: {
    funny: 'Dance battle? Tujhe toh harana easy hai 😜', caring: 'Saath mein dance karein? Fun hoga! 🥰',
    competitive: 'Dance mein bhi main jeitunga, challenge accepted? 😎', chill: 'Vibe check, dance battle chal? 🌿',
  },
  photo: {
    funny: 'Selfie lete hain sabse ajeeb jagah pe! 📸', caring: 'Ek yaadgar photo kheenchte hain saath mein? 🥰',
    competitive: 'Best photo kaun kheeench sakta hai? 😎', chill: 'Photo op hai, chal ✌️',
  },
}
function _prompt(type) {
  const pset = PERSONA_PROMPTS[type]
  if (pset) return pset[getCompanion()?.personality] || pset.funny
  return PROMPTS[type]
}

export function triggerChallenge(type, opts = {}) {
  if (_s.active) return
  _s.active = { type, phase: 'pending', prompt: _prompt(type), playerScore: 0, compScore: 0, bonus: !!opts.bonus }
  emit()
  clearTimeout(_s.popupTimer)
  _s.popupTimer = setTimeout(() => { if (_s.active?.phase === 'pending') declineChallenge() }, POPUP_MS)
}

export function declineChallenge() {
  clearTimeout(_s.popupTimer)
  _s.active = null
  _scheduleNext()
  window.dispatchEvent(new CustomEvent('companion-say', { detail: { text: 'Theek hai, next time! 🤷' } }))
  emit()
}

export function acceptChallenge() {
  const a = _s.active
  if (!a || a.phase !== 'pending') return
  clearTimeout(_s.popupTimer)
  noteActivity()
  if (a.type === 'coin_collect') _startCoinCollect()
  else if (a.type === 'trivia')  _startTrivia()
  else if (a.type === 'hide_seek') _startHideSeek()
  else if (a.type === 'race')    _startRace()
  else if (a.type === 'dance_battle') _startDanceBattle()
  else if (a.type === 'photo')   _startPhoto()
}

// ── Coin collect ──────────────────────────────────────────────────────────────
function _startCoinCollect() {
  const a = _s.active
  const px = minimapState.playerX, pz = minimapState.playerZ
  a.coins = Array.from({ length: 8 }, () => {
    const ang = Math.random() * Math.PI * 2, r = 6 + Math.random() * 19
    return { x: px + Math.cos(ang) * r, z: pz + Math.sin(ang) * r, by: null }
  })
  a.phase = 'running'; a.endsAt = Date.now() + 60000; a.compVar = 1
  emit()
}

// ── Trivia ──────────────────────────────────────────────────────────────────
async function _startTrivia() {
  const a = _s.active
  a.phase = 'running'; a.qIndex = 0; a.qResult = null
  emit()
  await _loadTriviaQuestion()
}
async function _loadTriviaQuestion() {
  const a = _s.active
  if (!a) return
  a.question = null; emit()
  let q
  try {
    const sys = 'Generate 1 fun trivia question in Hinglish about Bollywood, cricket, Indian food, general knowledge, science, or geography. Return ONLY JSON: {"question": string, "options": [4 strings], "correct": 0-3, "explanation": string}.'
    const raw = await groqChat([{ role: 'user', content: '[Give me a question.]' }], sys, 200)
    const j = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    q = JSON.parse(j)
    if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error('bad')
  } catch {
    q = TRIVIA_FALLBACK[Math.floor(Math.random() * TRIVIA_FALLBACK.length)]
  }
  if (!_s.active) return
  a.question = q.question; a.options = q.options; a.correct = q.correct; a.explanation = q.explanation
  a.endsAt = Date.now() + 30000; a.qResult = null
  emit()
}
export function answerTrivia(idx) {
  const a = _s.active
  if (!a || a.type !== 'trivia' || a.qResult) return
  const correct = idx === a.correct
  if (correct) { a.playerScore++; addCoins(40) } else { addCoins(10) }
  // Companion answers (competitive companions are a bit better).
  const persona = getCompanion()?.personality
  const compRight = Math.random() < (persona === 'competitive' ? 0.7 : 0.5)
  if (compRight) a.compScore++
  a.qResult = { picked: idx, correct: a.correct, playerRight: correct, compRight, compPicked: compRight ? a.correct : (a.correct + 1) % 4, explanation: a.explanation }
  emit()
  setTimeout(() => {
    if (!_s.active) return
    a.qIndex++
    if (a.qIndex >= 5) _finish('trivia')
    else _loadTriviaQuestion()
  }, 2600)
}

// ── Hide and seek ─────────────────────────────────────────────────────────────
function _startHideSeek() {
  const a = _s.active
  const ang = Math.random() * Math.PI * 2, r = 30 + Math.random() * 20
  a.hideX = minimapState.playerX + Math.cos(ang) * r
  a.hideZ = minimapState.playerZ + Math.sin(ang) * r
  a.phase = 'running'; a.endsAt = Date.now() + 90000
  companionState.targetOverride = { x: a.hideX, z: a.hideZ, speed: 9 }
  companionState.hidden = true
  emit()
}

// ── Race ──────────────────────────────────────────────────────────────────────
function _startRace() {
  const a = _s.active
  const px = minimapState.playerX, pz = minimapState.playerZ
  const f = minimapState.playerFacing
  const fx = Math.sin(f), fz = Math.cos(f)         // forward unit vector
  // Snap the race to the road the player is on (main highways run x=0 / z=0, 12 wide).
  let axis, dir, roadC
  if (Math.abs(pz) < 6 && Math.abs(fx) >= Math.abs(fz)) { axis = 'x'; dir = fx >= 0 ? 1 : -1; roadC = 0 }
  else if (Math.abs(px) < 6)                            { axis = 'z'; dir = fz >= 0 ? 1 : -1; roadC = 0 }
  else if (Math.abs(fx) >= Math.abs(fz))                { axis = 'x'; dir = fx >= 0 ? 1 : -1; roadC = pz }
  else                                                  { axis = 'z'; dir = fz >= 0 ? 1 : -1; roadC = px }
  a.axis = axis; a.dir = dir; a.roadC = roadC
  a.startX = px; a.startZ = pz
  if (axis === 'x') { a.finishX = px + dir * RACE_DIST; a.finishZ = roadC }
  else              { a.finishX = roadC; a.finishZ = pz + dir * RACE_DIST }
  a.compProg = 0; a.compSpeed = 0; a.playerFinished = false; a.compFinished = false
  a.phase = 'countdown'; a.countdown = 3
  // line the companion up beside the player on the road
  if (axis === 'x') companionState.targetOverride = { x: px, z: roadC + 2, speed: 12 }
  else              companionState.targetOverride = { x: roadC + 2, z: pz, speed: 12 }
  companionState.faceTarget = true
  emit()
  companionState.riding = true   // companion mounts the spawned bike
  const tick = () => {
    if (!_s.active || _s.active.type !== 'race') return
    a.countdown--
    if (a.countdown <= 0) { a.phase = 'running'; a.endsAt = Date.now() + 60000; a.countdown = 0; emit() }
    else { emit(); setTimeout(tick, 1000) }
  }
  setTimeout(tick, 1000)
}

// ── Dance battle (the minigame timing/input lives in ChallengePopup) ──────────
function _startDanceBattle() {
  const a = _s.active
  a.phase = 'running'
  emit()
}
/** Called by ChallengePopup when the dance battle ends. */
export function reportDanceResult(playerScore, compScore) {
  const a = _s.active
  if (!a || a.type !== 'dance_battle') return
  a.playerScore = playerScore; a.compScore = compScore
  _finish('dance_battle')
}

// ── Photo challenge ───────────────────────────────────────────────────────────
const PHOTO_SPOTS = [
  { dx: 3, dz: 3, label: 'by the fountain' }, { dx: -4, dz: 6, label: 'on a bench' },
  { dx: 8, dz: -3, label: 'near a building' }, { dx: -6, dz: -5, label: 'at the road edge' },
  { dx: 5, dz: 7, label: 'under a tree' },
]
function _startPhoto() {
  const a = _s.active
  const spot = PHOTO_SPOTS[Math.floor(Math.random() * PHOTO_SPOTS.length)]
  a.photoSpotLabel = spot.label
  a.phase = 'running'; a.endsAt = Date.now() + 15000
  companionState.targetOverride = { x: minimapState.playerX + spot.dx, z: minimapState.playerZ + spot.dz, speed: 8 }
  companionState.faceTarget = false
  emit()
}
/** Called by ChallengePopup once the photo is captured + reviewed (polaroid is its
 *  own result screen, so this just grants the reward and closes). */
export function reportPhotoDone() {
  const a = _s.active
  if (!a || a.type !== 'photo') return
  companionState.targetOverride = null
  companionState.faceTarget = false
  addCoins(25); addXp(20); addMemory(`took a photo ${a.photoSpotLabel || ''}`.trim())
  closeResult()
}
export function photoLocationLabel() { return _s.active?.photoSpotLabel || 'the city' }

// ── Per-frame tick (called by ChallengeScene useFrame) ────────────────────────
export function tick(dt) {
  const a = _s.active
  if (!a || a.phase !== 'running') return
  const px = minimapState.playerX, pz = minimapState.playerZ

  if (a.type === 'coin_collect') {
    // Player pickups.
    for (const c of a.coins) if (!c.by && Math.hypot(px - c.x, pz - c.z) < 1.5) { c.by = 'player'; a.playerScore++ }
    // Companion AI → nearest uncollected coin, with speed variance.
    const remaining = a.coins.filter(c => !c.by)
    if (remaining.length) {
      let best = remaining[0], bd = Infinity
      for (const c of remaining) { const d = Math.hypot(companionState.x - c.x, companionState.z - c.z); if (d < bd) { bd = d; best = c } }
      if (Math.random() < 0.02) a.compVar = 0.8 + Math.random() * 0.4
      companionState.targetOverride = { x: best.x, z: best.z, speed: 7 * a.compVar }
      if (bd < 1.5) { best.by = 'companion'; a.compScore++ }
    }
    if (a.coins.every(c => c.by) || Date.now() >= a.endsAt) _finish('coin_collect')
    else emit()

  } else if (a.type === 'hide_seek') {
    const d = Math.hypot(px - companionState.x, pz - companionState.z)
    a.dist = d
    a.temp = d > 40 ? 'Freezing' : d > 30 ? 'Cold' : d > 20 ? 'Warm' : d > 10 ? 'Hot' : 'Burning'
    a.tempColor = d > 40 ? '#3b82f6' : d > 30 ? '#7dd3fc' : d > 20 ? '#facc15' : d > 10 ? '#f97316' : '#ef4444'
    if (d < 3) _finish('hide_seek')
    else if (Date.now() >= a.endsAt) _finish('hide_seek')
    else emit()

  } else if (a.type === 'race') {
    // Smooth acceleration 0 → max over ~2s, with a gentle speed shimmer.
    const max = 16 + Math.sin(Date.now() / 800) * 2
    a.compSpeed = Math.min(max, a.compSpeed + (16 / 2) * dt)
    a.compProg = Math.min(RACE_DIST, a.compProg + a.compSpeed * dt)
    // Stay on the road: lateral pinned to road centre with a slight wobble.
    const wobble = Math.sin(Date.now() / 240) * 0.6
    let cx, cz
    if (a.axis === 'x') { cx = a.startX + a.dir * a.compProg; cz = a.roadC + wobble }
    else                { cz = a.startZ + a.dir * a.compProg; cx = a.roadC + wobble }
    companionState.targetOverride = { x: cx, z: cz, speed: 40 }
    // Player progress along the road axis.
    const playerProg = a.axis === 'x' ? (px - a.startX) * a.dir : (pz - a.startZ) * a.dir
    if (!a.playerFinished && playerProg >= RACE_DIST) a.playerFinished = true
    if (!a.compFinished && a.compProg >= RACE_DIST) a.compFinished = true
    if (a.playerFinished || a.compFinished || Date.now() >= a.endsAt) _finish('race')
    else emit()
  }
}

// ── Finish / results ──────────────────────────────────────────────────────────
function _finish(type) {
  const a = _s.active
  if (!a || a.phase === 'result') return
  companionState.targetOverride = null
  companionState.hidden = false
  companionState.faceTarget = false
  companionState.riding = false

  let playerWon, coinsEarned, line, memEvent
  const persona = getCompanion()?.personality || 'funny'

  if (type === 'coin_collect') {
    playerWon = a.playerScore > a.compScore
    coinsEarned = Math.max(10, a.playerScore * COIN_VALUE * (playerWon ? 2 : 1))
    if (a.bonus) coinsEarned = Math.round(coinsEarned * 1.5)   // mission-celebration bonus
    addCoins(coinsEarned)
    line = playerWon ? _reaction(persona, 'lost') : _reaction(persona, 'won')
    memEvent = playerWon ? 'lost coin race to player' : 'beat player at coin collect'
  } else if (type === 'dance_battle') {
    playerWon = a.playerScore >= a.compScore
    coinsEarned = playerWon ? 90 : 30
    addCoins(coinsEarned)
    line = playerWon ? _reaction(persona, 'lost') : _reaction(persona, 'won')
    memEvent = playerWon ? `lost dance battle ${a.compScore}-${a.playerScore}` : `won dance battle ${a.compScore}-${a.playerScore}`
  } else if (type === 'photo') {
    playerWon = true
    coinsEarned = 25
    addCoins(coinsEarned)
    line = 'Mast photo aayi! Yaadgaar 📸'
    memEvent = `took a photo ${a.photoSpotLabel || ''}`.trim()
  } else if (type === 'trivia') {
    playerWon = a.playerScore >= a.compScore
    coinsEarned = 0   // already paid per-question
    line = playerWon ? _reaction(persona, 'lost') : _reaction(persona, 'won')
    memEvent = playerWon ? `lost trivia ${a.compScore}-${a.playerScore}` : `won trivia ${a.compScore}-${a.playerScore}`
  } else if (type === 'hide_seek') {
    playerWon = a.dist < 3
    coinsEarned = playerWon ? 80 : 20
    addCoins(coinsEarned)
    line = playerWon ? _reaction(persona, 'lost') : 'BOO! 👻 Mil nahi paya na?'
    memEvent = playerWon ? 'got found in hide-and-seek' : 'won hide-and-seek (never found)'
  } else { // race
    playerWon = a.playerFinished && !a.compFinished ? true : a.compFinished && !a.playerFinished ? false : true
    coinsEarned = playerWon ? 100 : 40
    addCoins(coinsEarned)
    line = playerWon ? _reaction(persona, 'lost') : _reaction(persona, 'won')
    memEvent = playerWon ? 'lost a race to player' : 'won a race'
  }

  addXp(20); addMemory(memEvent); noteChallengeResult(playerWon)
  a.phase = 'result'; a.result = { type, playerWon, coinsEarned, playerScore: a.playerScore, compScore: a.compScore }
  a.line = line
  emit()
}

const REACTIONS = {
  funny:       { won: 'Haha main jeet gaya! Tu practice kar 😎', lost: 'Arre tu toh cheat karta hai! 😜' },
  caring:      { won: 'Main jeeta par tu bhi great tha 🥰', lost: 'Shabaash! Tujhe pata tha tu jeetega 💖' },
  competitive: { won: 'Obviously main jeeta. Main hamesha jeetta hoon 😏', lost: 'Hmph, is baar luck tha tera. Rematch!' },
  chill:       { won: 'Jeet gaya... cool cool, no big deal 🌿', lost: 'Tu jeeta, sab maya hai yaar ✌️' },
}
function _reaction(persona, outcome) { return (REACTIONS[persona] || REACTIONS.funny)[outcome] }

export function closeResult() {
  _s.active = null
  _scheduleNext()
  emit()
}
export function playAgain() {
  const type = _s.active?.result?.type
  closeResult()
  if (type) triggerChallenge(type)
}
