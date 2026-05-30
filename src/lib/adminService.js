// Admin Supabase operations — all actions are logged to admin_logs.
// Uses the anon client; RLS policies must allow admin operations (see SQL in spec).
import { supabase } from './supabase'
import { ADMIN_IDS } from './adminConfig'

// ── Logging ────────────────────────────────────────────────────────────────────
export async function logAdminAction(adminId, action, targetPlayer = null, details = {}) {
  if (!supabase) return
  try {
    await supabase.from('admin_logs').insert({
      admin_id: adminId, action, target_player: targetPlayer, details,
    })
  } catch {}
}

// ── Overview stats ─────────────────────────────────────────────────────────────
export async function getOverviewStats() {
  if (!supabase) return null
  try {
    const [
      { count: totalPlayers },
      { count: onlinePlayers },
      { data: coinData },
      { data: newToday },
      { count: activeTournaments },
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_online', true),
      supabase.from('players').select('coins'),
      supabase.from('players').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().slice(0, 10)),
      supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ])

    const totalCoins = (coinData || []).reduce((s, p) => s + (p.coins || 0), 0)

    return {
      totalPlayers:      totalPlayers ?? 0,
      onlinePlayers:     onlinePlayers ?? 0,
      newToday:          newToday ?? 0,
      totalCoins,
      activeTournaments: activeTournaments ?? 0,
    }
  } catch { return null }
}

export async function getActivityFeed(limit = 20) {
  if (!supabase) return []
  try {
    const { data } = await supabase.from('admin_logs')
      .select('*').order('created_at', { ascending: false }).limit(limit)
    return data || []
  } catch { return [] }
}

export async function getDailyStats(days = 7) {
  if (!supabase) return []
  try {
    const results = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const { count } = await supabase.from('players')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateStr)
        .lt('created_at', new Date(d.getTime() + 86400000).toISOString().slice(0, 10))
      results.push({ date: dateStr, value: count ?? 0 })
    }
    return results
  } catch { return [] }
}

// ── Players ────────────────────────────────────────────────────────────────────
async function _runPlayerQuery({ search, page, pageSize, sortBy, sortAsc, withOrder }) {
  let q = supabase.from('players').select('*', { count: 'exact' })
  if (withOrder) q = q.order(sortBy, { ascending: sortAsc })
  q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  if (search) q = q.or(`name.ilike.%${search}%,id.ilike.%${search}%`)
  return q
}

export async function getPlayers({ search = '', page = 0, pageSize = 20, sortBy = 'created_at', sortAsc = false } = {}) {
  if (!supabase) return { data: [], total: 0, error: 'Supabase not configured' }
  try {
    // First try with ordering by sortBy (e.g. created_at)
    let { data, count, error } = await _runPlayerQuery({ search, page, pageSize, sortBy, sortAsc, withOrder: true })

    // If the sort column doesn't exist, retry without ordering
    if (error) {
      const retry = await _runPlayerQuery({ search, page, pageSize, sortBy, sortAsc, withOrder: false })
      data = retry.data; count = retry.count; error = retry.error
    }

    if (error) {
      console.error('[admin] getPlayers error:', error)
      return { data: [], total: 0, error: error.message || String(error) }
    }
    return { data: data || [], total: count ?? 0, error: null }
  } catch (e) {
    console.error('[admin] getPlayers exception:', e)
    return { data: [], total: 0, error: e.message || String(e) }
  }
}

export async function getPlayerDetail(uid) {
  if (!supabase) return null
  try {
    const [
      { data: player },
      { data: stats },
      { data: scores },
      { data: challenges },
    ] = await Promise.all([
      supabase.from('players').select('*').eq('id', uid).maybeSingle(),
      supabase.from('game_stats').select('*').eq('player_uid', uid).maybeSingle(),
      supabase.from('game_scores').select('*').eq('player_uid', uid).order('created_at', { ascending: false }).limit(10),
      supabase.from('challenges').select('*').or(`challenger_uid.eq.${uid},challenged_uid.eq.${uid}`).order('created_at', { ascending: false }).limit(5),
    ])
    return { player, stats, scores: scores || [], challenges: challenges || [] }
  } catch { return null }
}

export async function banPlayer(adminId, targetUid, reason, durationDays) {
  if (!supabase) return false
  try {
    const bannedUntil = durationDays === 'permanent' ? '2099-01-01T00:00:00Z'
      : new Date(Date.now() + durationDays * 86400000).toISOString()
    await supabase.from('players').update({ banned_until: bannedUntil, ban_reason: reason }).eq('id', targetUid)
    await logAdminAction(adminId, 'ban_player', targetUid, { reason, durationDays, bannedUntil })
    return true
  } catch { return false }
}

export async function unbanPlayer(adminId, targetUid) {
  if (!supabase) return false
  try {
    await supabase.from('players').update({ banned_until: null, ban_reason: null }).eq('id', targetUid)
    await logAdminAction(adminId, 'unban_player', targetUid)
    return true
  } catch { return false }
}

export async function giveCoins(adminId, targetUid, amount, reason = '') {
  if (!supabase) return false
  try {
    const { data: p } = await supabase.from('players').select('coins').eq('id', targetUid).maybeSingle()
    const newCoins = (p?.coins ?? 0) + amount
    await supabase.from('players').update({ coins: newCoins }).eq('id', targetUid)
    await logAdminAction(adminId, 'give_coins', targetUid, { amount, reason })
    // Queue in-game notification via announcements table
    if (reason || amount > 0) {
      await supabase.from('game_announcements').insert({
        message: `🎁 Admin gifted you ${amount} coins${reason ? ': ' + reason : ''}!`,
        type: 'info', is_active: true, created_by: adminId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
    return true
  } catch { return false }
}

export async function giveGems(adminId, targetUid, amount, reason = '') {
  if (!supabase) return false
  try {
    const { data: p } = await supabase.from('players').select('gems').eq('id', targetUid).maybeSingle()
    const newGems = (p?.gems ?? 0) + amount
    await supabase.from('players').update({ gems: newGems }).eq('id', targetUid)
    await logAdminAction(adminId, 'give_gems', targetUid, { amount, reason })
    return true
  } catch { return false }
}

// ── Economy ────────────────────────────────────────────────────────────────────
export async function getEconomyStats() {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('players').select('coins, gems')
    const totalCoins = (data || []).reduce((s, p) => s + (p.coins || 0), 0)
    const totalGems  = (data || []).reduce((s, p) => s + (p.gems  || 0), 0)
    const avgCoins   = data?.length ? Math.floor(totalCoins / data.length) : 0
    const top10 = [...(data || [])].sort((a,b) => b.coins - a.coins).slice(0, 10)
    return { totalCoins, totalGems, avgCoins, playerCount: data?.length ?? 0, top10 }
  } catch { return null }
}

// ── Tournaments ────────────────────────────────────────────────────────────────
export async function getAllTournaments(limit = 20) {
  if (!supabase) return []
  try {
    const { data } = await supabase.from('tournaments').select('*')
      .order('created_at', { ascending: false }).limit(limit)
    return data || []
  } catch { return [] }
}

export async function forceTournamentEnd(adminId, tournamentId) {
  if (!supabase) return false
  try {
    await supabase.from('tournaments').update({ status: 'completed', ends_at: new Date().toISOString() }).eq('id', tournamentId)
    await logAdminAction(adminId, 'force_end_tournament', null, { tournamentId })
    return true
  } catch { return false }
}

export async function createTournament(adminId, gameId, startsAt, entryFee, prize1, prize2, prize3) {
  if (!supabase) return false
  const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60 * 1000).toISOString()
  try {
    await supabase.from('tournaments').insert({
      game_id: gameId, status: 'upcoming', starts_at: startsAt, ends_at: endsAt,
      entry_fee: entryFee, prize_1st: prize1, prize_2nd: prize2, prize_3rd: prize3, participants: [],
    })
    await logAdminAction(adminId, 'create_tournament', null, { gameId, startsAt })
    return true
  } catch { return false }
}

// ── Boss control ───────────────────────────────────────────────────────────────
export async function getBossStatus() {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('players')
      .select('id').eq('name', '__boss_active__').maybeSingle()
    // Boss state is stored via bossState.js module; we just check the flag
    return null  // bossState.js manages this in-memory
  } catch { return null }
}

// ── Announcements ──────────────────────────────────────────────────────────────
export async function getAnnouncements() {
  if (!supabase) return []
  try {
    const { data } = await supabase.from('game_announcements')
      .select('*').order('created_at', { ascending: false }).limit(50)
    return data || []
  } catch { return [] }
}

export async function createAnnouncement(adminId, message, type, hours) {
  if (!supabase) return false
  const expiresAt = hours === 0 ? null : new Date(Date.now() + hours * 3600000).toISOString()
  try {
    await supabase.from('game_announcements').insert({
      message, type, is_active: true, created_by: adminId, expires_at: expiresAt,
    })
    await logAdminAction(adminId, 'create_announcement', null, { message, type, hours })
    return true
  } catch { return false }
}

export async function toggleAnnouncement(id, isActive) {
  if (!supabase) return false
  try {
    await supabase.from('game_announcements').update({ is_active: isActive }).eq('id', id)
    return true
  } catch { return false }
}

export async function deleteAnnouncement(id) {
  if (!supabase) return false
  try {
    await supabase.from('game_announcements').delete().eq('id', id)
    return true
  } catch { return false }
}

// ── Settings ───────────────────────────────────────────────────────────────────
export async function getSettings() {
  if (!supabase) return {}
  try {
    const { data } = await supabase.from('game_settings').select('*')
    const map = {}
    ;(data || []).forEach(row => { map[row.key] = { value: row.value, description: row.description } })
    return map
  } catch { return {} }
}

export async function setSetting(adminId, key, value) {
  if (!supabase) return false
  try {
    await supabase.from('game_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    await logAdminAction(adminId, 'update_setting', null, { key, value })
    return true
  } catch { return false }
}

// ── Open challenges ────────────────────────────────────────────────────────────
export async function getOpenChallenges() {
  if (!supabase) return []
  try {
    const { data } = await supabase.from('open_challenges')
      .select('*').order('created_at', { ascending: false }).limit(50)
    return data || []
  } catch { return [] }
}
