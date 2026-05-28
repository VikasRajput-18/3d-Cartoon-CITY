// Real-time open challenge wall — any player can post a challenge for anyone to accept.
// Stakes are locked in Supabase; winner gets both stakes + 10 % house bonus.
import { supabase } from './supabase'
import { spendCoins, addCoins } from './economyState'

const _oc = {
  challenges: [],
  listeners:  new Set(),
}

function emit() { _oc.listeners.forEach(fn => fn([..._oc.challenges])) }

export function onOpenChallengeUpdate(fn) {
  _oc.listeners.add(fn)
  return () => _oc.listeners.delete(fn)
}
export function getOpenChallenges() { return [..._oc.challenges] }

export async function initOpenChallenges() {
  await _fetch()
  if (!supabase) return
  supabase.channel('open_chall')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'open_challenges' }, () => _fetch())
    .subscribe()
  // Prune expired every 60 s locally
  setInterval(() => {
    const now = new Date().toISOString()
    _oc.challenges = _oc.challenges.filter(c => c.expires_at > now)
    emit()
  }, 60000)
}

async function _fetch() {
  if (!supabase) return
  try {
    const { data } = await supabase
      .from('open_challenges')
      .select('*')
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(25)
    _oc.challenges = data || []
    emit()
  } catch {}
}

export async function postOpenChallenge(uid, name, gameId, stakeCoins, message) {
  if (stakeCoins < 10) return { ok: false, reason: 'Minimum stake is 10 coins' }
  if (!spendCoins(stakeCoins)) return { ok: false, reason: 'Not enough coins' }

  if (!supabase) {
    // Offline: add locally so UI works
    _oc.challenges.unshift({
      id: Date.now(), challenger_id: uid, challenger_name: name,
      game_id: gameId, stake_coins: stakeCoins, message,
      status: 'open', expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      created_at: new Date().toISOString(),
    })
    emit()
    return { ok: true }
  }

  try {
    await supabase.from('open_challenges').insert({
      challenger_id:   uid,
      challenger_name: name,
      game_id:         gameId,
      stake_coins:     stakeCoins,
      message,
      status:          'open',
      expires_at:      new Date(Date.now() + 30 * 60000).toISOString(),
    })
    window.dispatchEvent(new CustomEvent('ticker-event', {
      detail: { text: `${name} posted a challenge: "${message}" — ${stakeCoins} coin stake` },
    }))
    return { ok: true }
  } catch {
    addCoins(stakeCoins)
    return { ok: false, reason: 'Failed to post challenge' }
  }
}

export async function acceptOpenChallenge(challengeId, uid, name) {
  const ch = _oc.challenges.find(c => c.id === challengeId)
  if (!ch) return { ok: false }
  if (ch.challenger_id === uid) return { ok: false, reason: 'Cannot accept your own challenge' }
  if (!spendCoins(ch.stake_coins)) return { ok: false, reason: 'Not enough coins for stake' }

  if (supabase) {
    try {
      await supabase.from('open_challenges')
        .update({ status: 'accepted', accepted_by: uid })
        .eq('id', challengeId)
      window.dispatchEvent(new CustomEvent('ticker-event', {
        detail: { text: `${name} accepted ${ch.challenger_name}'s challenge in ${ch.game_id}!` },
      }))
    } catch {
      addCoins(ch.stake_coins)
      return { ok: false }
    }
  }
  return { ok: true, challenge: ch }
}

// Called after game finishes to settle stakes
export async function settleOpenChallenge(challengeId, winnerId, winnerName, isWinner) {
  const totalPot = (_oc.challenges.find(c => c.id === challengeId)?.stake_coins ?? 0) * 2
  const prize    = Math.floor(totalPot * 1.1)   // +10 % house bonus for winner

  if (isWinner) {
    addCoins(prize)
    window.dispatchEvent(new CustomEvent('ticker-event', {
      detail: { text: `${winnerName} won ${prize} coins in an open challenge!` },
    }))
    window.dispatchEvent(new CustomEvent('achievement', {
      detail: { text: `💰 You won ${prize} coins in an open challenge!` },
    }))
  }

  if (supabase) {
    try {
      await supabase.from('open_challenges')
        .update({ status: 'completed', winner_id: winnerId })
        .eq('id', challengeId)
    } catch {}
  }
}
