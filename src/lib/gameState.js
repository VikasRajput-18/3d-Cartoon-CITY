import { supabase } from './supabase'
import { addCoins } from './economyState'

export const GAME_IDS   = ['snake', 'flappy', 'tictactoe', 'memory', 'dodge', 'cricket']
export const GAME_NAMES = {
  snake: 'Snake', flappy: 'Flappy Bird', tictactoe: 'Tic Tac Toe',
  memory: 'Memory Match', dodge: 'Dodge Ball', cricket: 'Cricket',
}
export const GAME_EMOJIS = {
  snake: '🐍', flappy: '🐦', tictactoe: '⭕', memory: '🃏', dodge: '💣', cricket: '🏏',
}

// ── Ranks ──────────────────────────────────────────────────────────────────────
export const RANKS = [
  { name: 'Bronze',   emoji: '🥉', color: '#cd7f32', min: 0    },
  { name: 'Silver',   emoji: '🥈', color: '#94a3b8', min: 10   },
  { name: 'Gold',     emoji: '🥇', color: '#facc15', min: 25   },
  { name: 'Platinum', emoji: '💿', color: '#e2e8f0', min: 50   },
  { name: 'Diamond',  emoji: '💎', color: '#7dd3fc', min: 100  },
  { name: 'Master',   emoji: '⚡', color: '#a78bfa', min: 200  },
  { name: 'Legend',   emoji: '👑', color: '#fbbf24', min: 500  },
]
export function calcRank(wins = 0) {
  let rank = RANKS[0]
  for (const r of RANKS) { if (wins >= r.min) rank = r }
  return rank
}

// ── Achievements ───────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: 'first_win',       label: 'First Win',        emoji: '🏅', coins: 25,  desc: 'Win any game for the first time' },
  { id: 'hat_trick',       label: 'Hat Trick',         emoji: '🎩', coins: 50,  desc: 'Win 3 games in a row' },
  { id: 'century',         label: 'Century',           emoji: '💯', coins: 30,  desc: 'Score 100+ in any game' },
  { id: 'record_breaker',  label: 'Record Breaker',    emoji: '📈', coins: 75,  desc: 'Set an all-time high score' },
  { id: 'tournament_win',  label: 'Tournament Victor', emoji: '🏆', coins: 200, desc: 'Win a tournament' },
  { id: 'triple_champ',    label: 'Champion',          emoji: '🌟', coins: 500, desc: 'Win 3 tournaments' },
  { id: 'legend_ten',      label: 'Legend',            emoji: '👑', coins: 1000,desc: 'Win 10 tournaments' },
  { id: 'all_five',        label: 'All-Rounder',       emoji: '🎯', coins: 100, desc: 'Play all 5 games in one day' },
  { id: 'win_streak_3',    label: 'On a Roll',         emoji: '🔥', coins: 40,  desc: '3-win streak in any game' },
  { id: 'win_streak_5',    label: 'On Fire',           emoji: '🌋', coins: 80,  desc: '5-win streak in any game' },
  { id: 'win_streak_10',   label: 'Unstoppable',       emoji: '⚡', coins: 200, desc: '10-win streak in any game' },
  // Cricket-specific (awarded in-game via the achievement event stream)
  { id: 'first_boundary',  label: 'First Boundary',    emoji: '🏏', coins: 20,  desc: 'Hit your first four in Cricket' },
  { id: 'six_machine',     label: 'Six Machine',       emoji: '💥', coins: 60,  desc: 'Hit 3 sixes in one Cricket game' },
  { id: 'cricket_century', label: 'Cricket Century',   emoji: '💯', coins: 100, desc: 'Score 100 total runs in Cricket' },
  { id: 'cricket_hattrick',label: 'Cricket Hat Trick', emoji: '🎩', coins: 80,  desc: 'Hit 6 runs on 3 consecutive balls' },
]

// ── Ticker (last 20 events) ────────────────────────────────────────────────────
const _ticker = []
export function addTickerEvent(text) {
  _ticker.unshift({ text, ts: Date.now() })
  if (_ticker.length > 20) _ticker.pop()
  window.dispatchEvent(new CustomEvent('ticker-event', { detail: { text } }))
}
export function getTickerEvents() { return [..._ticker] }

const _s = {
  scores:        {},
  myStats:       null,
  challenges:    [],
  listeners:     new Set(),
  myUid:         null,
  myName:        null,
  initialized:   false,
  _refreshTimer: null,
  // Streaks
  dailyStreak:   0,
  winStreak:     0,
  winStreakGame:  null,
  lastPlayedDate: null,
  // Achievements
  achievements:  [],    // earned achievement ids
  tournamentWins: 0,
  // Consecutive wins tracking
  _consecutiveWins: 0,
}

function emit() { _s.listeners.forEach(fn => fn()) }

export function onGameUpdate(fn) {
  _s.listeners.add(fn)
  return () => _s.listeners.delete(fn)
}

export function getLeaderboard(gameId) { return _s.scores[gameId] || [] }
export function getAllLeaderboards()   { return _s.scores }
export function getMyStats()           { return _s.myStats }
export function getMyUid()             { return _s.myUid }
export function getDailyStreak()       { return _s.dailyStreak }
export function getWinStreak()         { return { streak: _s.winStreak, game: _s.winStreakGame } }
export function getAchievements()      { return [..._s.achievements] }
export function getMyRank()            { return calcRank(_s.myStats?.total_wins ?? 0) }

function _hasAchievement(id) { return _s.achievements.includes(id) }

function _awardAchievement(id) {
  if (_hasAchievement(id)) return
  const def = ACHIEVEMENTS.find(a => a.id === id)
  if (!def) return
  _s.achievements.push(id)
  addCoins(def.coins)
  _saveStreaksLocal()
  window.dispatchEvent(new CustomEvent('achievement', {
    detail: { text: `${def.emoji} Achievement Unlocked: ${def.label}! +${def.coins} coins` },
  }))
  addTickerEvent(`${_s.myName} earned achievement: ${def.label} ${def.emoji}`)
}

function _streakLsKey()       { return `gs_streak_${_s.myUid}` }
function _achLsKey()          { return `gs_ach_${_s.myUid}` }
function _saveStreaksLocal() {
  if (!_s.myUid) return
  try {
    localStorage.setItem(_streakLsKey(), JSON.stringify({
      dailyStreak: _s.dailyStreak, winStreak: _s.winStreak,
      winStreakGame: _s.winStreakGame, lastPlayedDate: _s.lastPlayedDate,
      tournamentWins: _s.tournamentWins,
    }))
    localStorage.setItem(_achLsKey(), JSON.stringify(_s.achievements))
  } catch {}
}
function _loadStreaksLocal() {
  if (!_s.myUid) return
  try {
    const raw = localStorage.getItem(_streakLsKey())
    if (raw) {
      const d = JSON.parse(raw)
      _s.dailyStreak    = d.dailyStreak    ?? 0
      _s.winStreak      = d.winStreak      ?? 0
      _s.winStreakGame   = d.winStreakGame   ?? null
      _s.lastPlayedDate  = d.lastPlayedDate  ?? null
      _s.tournamentWins  = d.tournamentWins  ?? 0
    }
    const rawAch = localStorage.getItem(_achLsKey())
    if (rawAch) _s.achievements = JSON.parse(rawAch)
  } catch {}
}

export function getPendingChallenges() {
  return _s.challenges.filter(c => c.challenged_uid === _s.myUid && c.status === 'pending')
}
export function getMyChallenges() { return _s.challenges }

function emptyStats() {
  return {
    player_uid: _s.myUid, total_wins: 0, total_losses: 0, total_games: 0,
    best_snake: 0, best_flappy: 0, best_tictactoe: 0, best_memory: 0, best_dodge: 0, best_cricket: 0,
    coins_earned_from_games: 0,
  }
}

export async function initGameState(uid, name) {
  if (_s.initialized && _s.myUid === uid) return
  _s.myUid  = uid
  _s.myName = name
  _s.initialized = true
  _loadStreaksLocal()
  await Promise.all([fetchLeaderboards(), fetchMyStats(), fetchChallenges()])

  // 30-second leaderboard auto-refresh
  if (_s._refreshTimer) clearInterval(_s._refreshTimer)
  _s._refreshTimer = setInterval(fetchLeaderboards, 30000)

  if (!supabase) return
  supabase.channel('gs_scores_rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_scores' }, () => {
      fetchLeaderboards()
    })
    .subscribe()

  supabase.channel('gs_challenges_rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, ({ new: d }) => {
      if (!d) return
      if (d.challenged_uid === uid || d.challenger_uid === uid) {
        fetchChallenges()
        if (d.challenged_uid === uid && d.status === 'pending') {
          window.dispatchEvent(new CustomEvent('challenge-incoming', { detail: d }))
        }
        if (d.challenger_uid === uid && (d.status === 'challenged_won' || d.status === 'challenger_won')) {
          window.dispatchEvent(new CustomEvent('challenge-resolved', { detail: d }))
        }
      }
    })
    .subscribe()
}

export async function fetchLeaderboards() {
  if (!supabase) {
    for (const gid of GAME_IDS) {
      const raw = localStorage.getItem(`gs_lb_${gid}`)
      if (raw) try { _s.scores[gid] = JSON.parse(raw) } catch {}
    }
    emit(); return
  }
  for (const gid of GAME_IDS) {
    const { data } = await supabase
      .from('game_scores')
      .select('player_uid, player_name, score')
      .eq('game_id', gid)
      .order('score', { ascending: false })
      .limit(60)
    if (data) {
      const seen = new Set()
      _s.scores[gid] = data.filter(r => {
        if (seen.has(r.player_uid)) return false
        seen.add(r.player_uid); return true
      }).slice(0, 10)
    }
  }
  emit()
}

export async function fetchMyStats() {
  if (!supabase) {
    const raw = localStorage.getItem(`gs_stats_${_s.myUid}`)
    _s.myStats = raw ? JSON.parse(raw) : emptyStats()
    emit(); return
  }
  const { data } = await supabase
    .from('game_stats').select('*').eq('player_uid', _s.myUid).maybeSingle()
  _s.myStats = data || emptyStats()
  emit()
}

async function fetchChallenges() {
  if (!supabase || !_s.myUid) return
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .or(`challenged_uid.eq.${_s.myUid},challenger_uid.eq.${_s.myUid}`)
    .order('created_at', { ascending: false })
    .limit(20)
  _s.challenges = data || []
  emit()
}

function calcGameCoins(gameId, score) {
  switch (gameId) {
    case 'snake':     return Math.max(5, Math.floor(score / 10))
    case 'flappy':    return Math.max(5, score * 3)
    case 'memory':    return Math.max(5, Math.floor(score / 20))
    case 'dodge':     return Math.max(5, Math.floor(score / 5))   // score=elapsed*10 → coins=seconds*2
    case 'tictactoe': return score >= 15 ? 25 : score >= 5 ? 10 : 5
    case 'cricket':   // runs-based tiers per spec
      return score >= 81 ? 75 : score >= 61 ? 50 : score >= 41 ? 35 : score >= 21 ? 20 : 10
    default:          return Math.max(5, Math.floor(score / 10))
  }
}

export async function submitScore(gameId, score, powerUpMultiplier = 1) {
  if (!_s.myUid) return { isNewBest: false, coinsEarned: 0 }

  const effectiveScore = Math.floor(score * powerUpMultiplier)
  const result         = effectiveScore > 0 ? 'win' : 'loss'
  const bestKey        = `best_${gameId}`
  const prevBest       = _s.myStats?.[bestKey] ?? 0
  const isNewBest      = effectiveScore > prevBest
  // Also check against global best before fetching
  const prevGlobalBest = _s.scores[gameId]?.[0]?.score ?? 0
  const isGlobalRecord = effectiveScore > prevGlobalBest

  let coinsEarned = calcGameCoins(gameId, effectiveScore)
  if (isNewBest) coinsEarned += 10

  // Daily first-game bonus
  const today = new Date().toDateString()
  let dailyBonus = 0
  if (localStorage.getItem('gs_first_day') !== today) {
    dailyBonus = 20; coinsEarned += dailyBonus
    localStorage.setItem('gs_first_day', today)
  }

  // Track games-played-today for all-5 achievement
  const gptDate = localStorage.getItem('gs_gpt_date')
  const gpt     = gptDate === today ? JSON.parse(localStorage.getItem('gs_gpt') || '[]') : []
  if (!gpt.includes(gameId)) {
    gpt.push(gameId)
    localStorage.setItem('gs_gpt_date', today)
    localStorage.setItem('gs_gpt', JSON.stringify(gpt))
  }

  // ── Win streak tracking ────────────────────────────────────────────────────
  if (result === 'win') {
    if (_s.winStreakGame === gameId) {
      _s.winStreak++
    } else {
      _s.winStreak = 1
      _s.winStreakGame = gameId
    }
    _s._consecutiveWins++
  } else {
    _s.winStreak = 0
    _s.winStreakGame = null
    _s._consecutiveWins = 0
  }

  // ── Daily streak tracking ──────────────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10)
  if (_s.lastPlayedDate !== todayIso) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (_s.lastPlayedDate === yesterday) {
      _s.dailyStreak++
    } else if (_s.lastPlayedDate !== todayIso) {
      _s.dailyStreak = 1
    }
    _s.lastPlayedDate = todayIso
  }

  // ── Streak multiplier bonus ────────────────────────────────────────────────
  let streakMult = 1
  if (_s.dailyStreak >= 100) streakMult = 2
  else if (_s.dailyStreak >= 30) streakMult = 2
  else if (_s.dailyStreak >= 7)  streakMult = 1.5
  coinsEarned = Math.floor(coinsEarned * streakMult)

  addCoins(coinsEarned)
  _saveStreaksLocal()

  // ── Update local stats ─────────────────────────────────────────────────────
  const stats = { ...(_s.myStats || emptyStats()) }
  stats.total_games++
  if (result === 'win')  stats.total_wins++
  else                   stats.total_losses++
  if (isNewBest)         stats[bestKey] = effectiveScore
  stats.coins_earned_from_games = (stats.coins_earned_from_games || 0) + coinsEarned
  _s.myStats = stats

  if (supabase) {
    await supabase.from('game_scores').insert({
      player_uid: _s.myUid, player_name: _s.myName, game_id: gameId,
      score: effectiveScore, result,
    })
    await supabase.from('game_stats').upsert({ player_uid: _s.myUid, ...stats })
  } else {
    localStorage.setItem(`gs_stats_${_s.myUid}`, JSON.stringify(stats))
    const lb = [...(_s.scores[gameId] || []), { player_uid: _s.myUid, player_name: _s.myName, score: effectiveScore }]
    lb.sort((a, b) => b.score - a.score)
    const seen = new Set(); _s.scores[gameId] = lb.filter(r => { if (seen.has(r.player_uid)) return false; seen.add(r.player_uid); return true }).slice(0, 10)
    localStorage.setItem(`gs_lb_${gameId}`, JSON.stringify(_s.scores[gameId]))
  }

  await Promise.all([fetchLeaderboards(), fetchMyStats()])

  // ── Ticker events ──────────────────────────────────────────────────────────
  if (isNewBest) addTickerEvent(`${_s.myName} just got a new personal best in ${GAME_NAMES[gameId]}: ${effectiveScore}!`)
  if (isGlobalRecord) {
    addTickerEvent(`🔥 NEW RECORD! ${_s.myName} broke the ${GAME_NAMES[gameId]} record with ${effectiveScore} points!`)
    window.dispatchEvent(new CustomEvent('achievement', {
      detail: { text: `🌍 NEW CITY RECORD in ${GAME_NAMES[gameId]}! ${effectiveScore} pts` },
    }))
  }

  // ── Achievement checks ─────────────────────────────────────────────────────
  if (result === 'win' && stats.total_wins === 1)  _awardAchievement('first_win')
  if (effectiveScore >= 100)                        _awardAchievement('century')
  if (isGlobalRecord)                               _awardAchievement('record_breaker')
  if (gpt.length === 5)                             _awardAchievement('all_five')
  if (_s.winStreak >= 10)                           _awardAchievement('win_streak_10')
  else if (_s.winStreak >= 5)                       _awardAchievement('win_streak_5')
  else if (_s.winStreak >= 3)                       _awardAchievement('win_streak_3')
  if (_s._consecutiveWins >= 3)                     _awardAchievement('hat_trick')

  // Win-streak announcements
  if (_s.winStreak === 10) {
    window.dispatchEvent(new CustomEvent('achievement', {
      detail: { text: `⚡ ${_s.myName} is on an UNSTOPPABLE 10-win streak in ${GAME_NAMES[gameId]}!` },
    }))
  }

  return {
    isNewBest,
    coinsEarned,
    dailyBonus,
    dailyStreak:  _s.dailyStreak,
    winStreak:    _s.winStreak,
    streakMult,
    isGlobalRecord,
    globalBest:   _s.scores[gameId]?.[0],
    myRank: (_s.scores[gameId]?.findIndex(r => r.player_uid === _s.myUid) ?? -1) + 1,
  }
}

// Called from tournamentState when player wins a tournament
export function recordTournamentWin() {
  _s.tournamentWins++
  _saveStreaksLocal()
  _awardAchievement('tournament_win')
  if (_s.tournamentWins >= 3)  _awardAchievement('triple_champ')
  if (_s.tournamentWins >= 10) _awardAchievement('legend_ten')
}

export async function sendChallenge(challengedUid, challengedName, gameId, myScore) {
  if (!supabase || !_s.myUid) return false
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('challenges').insert({
    challenger_uid:   _s.myUid,
    challenger_name:  _s.myName,
    challenged_uid:   challengedUid,
    challenged_name:  challengedName,
    game_id:          gameId,
    challenger_score: myScore,
    target_score:     myScore,
    status:           'pending',
    expires_at:       expiresAt,
  })
  return !error
}

export async function fetchOnlinePlayers(excludeUid) {
  if (!supabase) return []
  const { data } = await supabase
    .from('players')
    .select('id, name')        // DB PK is "id"
    .eq('is_online', true)
    .limit(50)
  // Normalize to { uid, name } for the rest of the app
  return (data || [])
    .filter(p => p.id !== excludeUid)
    .map(p => ({ uid: p.id, name: p.name }))
}

export async function resolveChallenge(challengeId, score) {
  if (!supabase) return null
  const { data: ch } = await supabase.from('challenges').select('*').eq('id', challengeId).maybeSingle()
  if (!ch) return null
  const won    = score > ch.challenger_score
  const status = won ? 'challenged_won' : 'challenger_won'
  await supabase.from('challenges').update({ challenged_score: score, status }).eq('id', challengeId)
  const reward = won ? 40 : 10
  addCoins(reward)
  return { won, challengerScore: ch.challenger_score, reward, gameId: ch.game_id }
}
