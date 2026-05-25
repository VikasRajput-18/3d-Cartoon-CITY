import { supabase } from './supabase'
import { addCoins } from './economyState'

export const GAME_IDS   = ['snake', 'flappy', 'tictactoe', 'memory', 'dodge']
export const GAME_NAMES = {
  snake: 'Snake', flappy: 'Flappy Bird', tictactoe: 'Tic Tac Toe',
  memory: 'Memory Match', dodge: 'Dodge Ball',
}
export const GAME_EMOJIS = {
  snake: '🐍', flappy: '🐦', tictactoe: '⭕', memory: '🃏', dodge: '💣',
}

const _s = {
  scores:       {},   // { gameId: [{player_uid, player_name, score}] }
  myStats:      null,
  challenges:   [],
  listeners:    new Set(),
  myUid:        null,
  myName:       null,
  initialized:  false,
  _refreshTimer: null,
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

export function getPendingChallenges() {
  return _s.challenges.filter(c => c.challenged_uid === _s.myUid && c.status === 'pending')
}
export function getMyChallenges() { return _s.challenges }

function emptyStats() {
  return {
    player_uid: _s.myUid, total_wins: 0, total_losses: 0, total_games: 0,
    best_snake: 0, best_flappy: 0, best_tictactoe: 0, best_memory: 0, best_dodge: 0,
    coins_earned_from_games: 0,
  }
}

export async function initGameState(uid, name) {
  if (_s.initialized && _s.myUid === uid) return
  _s.myUid  = uid
  _s.myName = name
  _s.initialized = true
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
    default:          return Math.max(5, Math.floor(score / 10))
  }
}

export async function submitScore(gameId, score) {
  if (!_s.myUid) return { isNewBest: false, coinsEarned: 0 }

  const result    = score > 0 ? 'win' : 'loss'
  const bestKey   = `best_${gameId}`
  const prevBest  = _s.myStats?.[bestKey] ?? 0
  const isNewBest = score > prevBest

  let coinsEarned = calcGameCoins(gameId, score)
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
    if (gpt.length === 5) {
      coinsEarned += 100
      window.dispatchEvent(new CustomEvent('achievement', {
        detail: { text: '🏆 Played all 5 games today! +100 coins!' },
      }))
    }
  }

  addCoins(coinsEarned)

  // Update local stats
  const stats = { ...(_s.myStats || emptyStats()) }
  stats.total_games++
  if (result === 'win')  stats.total_wins++
  else                   stats.total_losses++
  if (isNewBest)         stats[bestKey] = score
  stats.coins_earned_from_games = (stats.coins_earned_from_games || 0) + coinsEarned
  _s.myStats = stats

  if (supabase) {
    await supabase.from('game_scores').insert({
      player_uid: _s.myUid, player_name: _s.myName, game_id: gameId, score, result,
    })
    await supabase.from('game_stats').upsert({ player_uid: _s.myUid, ...stats })
  } else {
    localStorage.setItem(`gs_stats_${_s.myUid}`, JSON.stringify(stats))
    const lb = [...(_s.scores[gameId] || []), { player_uid: _s.myUid, player_name: _s.myName, score }]
    lb.sort((a, b) => b.score - a.score)
    const seen = new Set(); _s.scores[gameId] = lb.filter(r => { if (seen.has(r.player_uid)) return false; seen.add(r.player_uid); return true }).slice(0, 10)
    localStorage.setItem(`gs_lb_${gameId}`, JSON.stringify(_s.scores[gameId]))
  }

  await Promise.all([fetchLeaderboards(), fetchMyStats()])
  return {
    isNewBest,
    coinsEarned,
    dailyBonus,
    globalBest: _s.scores[gameId]?.[0],
    myRank: (_s.scores[gameId]?.findIndex(r => r.player_uid === _s.myUid) ?? -1) + 1,
  }
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
