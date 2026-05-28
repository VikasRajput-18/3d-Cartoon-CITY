import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'
import { getEconomyState, onEconomyUpdate, purchaseOutfit, msUntilNextTicket, spendCoins } from '@/lib/economyState'
import { getMissionState, onMissionUpdate, calcLevel } from '@/lib/missionState'
import { getMyStats, onGameUpdate, GAME_IDS, GAME_NAMES, GAME_EMOJIS } from '@/lib/gameState'
import { supabase } from '@/lib/supabase'

const NAME_CHANGE_COST   = 50
const NAME_COOLDOWN_MS   = 24 * 60 * 60 * 1000   // 24 hours
const NAME_MAX           = 16
const NAME_MIN           = 3
const NAME_REGEX         = /^[a-zA-Z0-9 _]+$/

function validateNameInput(raw) {
  const n = raw.trim()
  if (!n)                      return 'Name cannot be empty'
  if (/^\s+$/.test(raw))       return 'Name cannot be only spaces'
  if (n.length < NAME_MIN)     return `At least ${NAME_MIN} characters required`
  if (n.length > NAME_MAX)     return `Maximum ${NAME_MAX} characters`
  if (!NAME_REGEX.test(n))     return 'Only letters, numbers, spaces and underscores'
  return null
}

// Cooldown helpers
function cooldownHoursLeft(changedAt) {
  if (!changedAt) return 0
  const elapsed = Date.now() - new Date(changedAt).getTime()
  if (elapsed >= NAME_COOLDOWN_MS) return 0
  return Math.ceil((NAME_COOLDOWN_MS - elapsed) / 3600000)
}
function isFirstChange(changedAt) { return !changedAt }

const ALL_OUTFITS = [
  { id: 'casual',      label: 'Casual',      color: '#7C3AED', currency: 'coins', cost: 0,   free: true  },
  { id: 'school',      label: 'School',      color: '#1D4ED8', currency: 'coins', cost: 150              },
  { id: 'sports',      label: 'Sports',      color: '#DC2626', currency: 'coins', cost: 150              },
  { id: 'winter',      label: 'Winter',      color: '#0F766E', currency: 'coins', cost: 350              },
  { id: 'party',       label: 'Party',       color: '#DB2777', currency: 'gems',  cost: 30               },
  { id: 'traditional', label: 'Traditional', color: '#D97706', currency: 'gems',  cost: 40               },
]

function fmtMs(ms) {
  if (ms <= 0) return 'Full'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ProfilePanel({ onClose, onOpenShop, onOpenFastTravel }) {
  const { user }   = useUser()
  const { signOut } = useClerk()
  const avatar      = useStore(s => s.avatar)
  const setAvatar   = useStore(s => s.setAvatar)
  const stats       = useStore(s => s.stats)

  const [tab, setTab]   = useState('profile')
  const [eco, setEco]   = useState(getEconomyState())
  const [ms,  setMs]    = useState(getMissionState())
  const [nextTicket, setNextTicket] = useState(msUntilNextTicket())
  const [shopMsg, setShopMsg] = useState('')
  const [, forceGames]  = useState(0)

  // ── Edit name state ────────────────────────────────────────────────────────
  const [editingName,   setEditingName]   = useState(false)
  const [nameInput,     setNameInput]     = useState('')
  const [nameError,     setNameError]     = useState('')
  const [nameSaving,    setNameSaving]    = useState(false)
  const [nameChangedAt, setNameChangedAt] = useState(null)   // ISO string | null
  const [nameSuccess,   setNameSuccess]   = useState('')
  const nameInputRef = useRef()

  // Disable / restore game controls when edit mode opens or closes
  useEffect(() => {
    if (editingName) {
      gameControls.enabled = false
    } else {
      gameControls.enabled = true
    }
    return () => { gameControls.enabled = true }
  }, [editingName])

  // Fetch name_changed_at when edit mode opens
  useEffect(() => {
    if (!editingName || !user?.id) return
    setNameInput(avatar.name)
    setNameError('')
    setNameSuccess('')
    if (supabase) {
      supabase.from('players').select('name_changed_at, name').eq('id', user.id).maybeSingle()
        .then(({ data }) => setNameChangedAt(data?.name_changed_at ?? null))
        .catch(() => {})
    }
    setTimeout(() => nameInputRef.current?.focus(), 60)
  }, [editingName])

  async function handleSaveName() {
    const trimmed = nameInput.trim()
    const validErr = validateNameInput(nameInput)
    if (validErr) { setNameError(validErr); return }
    if (trimmed === avatar.name) { setEditingName(false); return }

    const hoursLeft = cooldownHoursLeft(nameChangedAt)
    if (hoursLeft > 0) {
      setNameError(`You can change your name again in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`)
      return
    }

    const free = isFirstChange(nameChangedAt)
    const cost = free ? 0 : NAME_CHANGE_COST
    if (cost > 0 && eco.coins < cost) {
      setNameError(`Need ${cost} more coins to change name`)
      return
    }

    setNameSaving(true)
    setNameError('')

    // Uniqueness check
    if (supabase) {
      try {
        const { data: taken } = await supabase
          .from('players').select('id')
          .ilike('name', trimmed)
          .neq('id', user.id)
        if (taken?.length > 0) {
          setNameError('This name is already taken, try another')
          setNameSaving(false)
          return
        }
      } catch { /* offline — skip check */ }
    }

    // Deduct coins
    if (cost > 0 && !spendCoins(cost)) {
      setNameError('Not enough coins')
      setNameSaving(false)
      return
    }

    try {
      // 1. Update Clerk
      await user.update({ firstName: trimmed })

      // 2. Update Supabase players row
      const now = new Date().toISOString()
      if (supabase) {
        await supabase.from('players')
          .upsert({ id: user.id, name: trimmed, name_changed_at: now }, { onConflict: 'id' })
      }
      setNameChangedAt(now)

      // 3. Update local store + save to localStorage
      setAvatar({ name: trimmed })
      useStore.getState().saveForUser(user.id)

      // 4. Broadcast for toast in Game.jsx
      window.dispatchEvent(new CustomEvent('name-updated', { detail: { name: trimmed } }))

      setNameSuccess(`Name updated to "${trimmed}"`)
      setTimeout(() => { gameControls.enabled = true; setEditingName(false); setNameSuccess('') }, 1200)
    } catch {
      setNameError('Failed to update. Please try again.')
    }
    setNameSaving(false)
  }

  useEffect(() => onEconomyUpdate(setEco), [])
  useEffect(() => onMissionUpdate(setMs),   [])
  useEffect(() => onGameUpdate(() => forceGames(n => n + 1)), [])

  useEffect(() => {
    const id = setInterval(() => setNextTicket(msUntilNextTicket()), 30000)
    return () => clearInterval(id)
  }, [])

  const { level, xpInLevel, xpToNext } = calcLevel(ms.xp)

  const handleBuy = useCallback((outfit) => {
    const result = purchaseOutfit(outfit.id, outfit.currency, outfit.cost)
    if (result.alreadyOwned) {
      setAvatar({ outfit: outfit.id })
      setShopMsg(`Equipped ${outfit.label}!`)
    } else if (result.ok) {
      setAvatar({ outfit: outfit.id })
      setShopMsg(`Bought & equipped ${outfit.label}!`)
    } else {
      setShopMsg(result.reason || 'Not enough currency')
    }
    setTimeout(() => setShopMsg(''), 2500)
  }, [setAvatar])

  async function handleSignOut() { onClose(); await signOut() }

  const tabBtnCls = (id) =>
    `flex-1 py-[9px] border-0 cursor-pointer font-body font-bold text-[12px]`

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[600] flex items-center justify-center backdrop-blur-[6px]"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="flex flex-col overflow-hidden rounded-[20px] font-body max-h-[88vh]"
        style={{
          background: 'rgba(12,8,26,0.97)',
          border: '1.5px solid rgba(124,58,237,0.4)',
          width: 'min(92vw, 360px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(219,39,119,0.2))', padding: '18px 18px 14px' }}
        >
          {user?.imageUrl
            ? <img src={user.imageUrl} alt="" className="w-[52px] h-[52px] rounded-full shrink-0" style={{ border: '2px solid rgba(124,58,237,0.6)' }} />
            : <div
                className="w-[52px] h-[52px] rounded-full shrink-0 flex items-center justify-center text-[22px] text-white font-extrabold"
                style={{ background: '#7C3AED', border: '2px solid rgba(255,255,255,0.2)' }}
              >
                {avatar.name?.[0]?.toUpperCase() || '?'}
              </div>
          }
          <div className="min-w-0 flex-1">
            {/* ── Name row with inline edit ── */}
            {editingName ? (
              <div className="mb-[4px]">
                {/* Input + char count */}
                <div className="flex items-center gap-1 mb-[5px]">
                  <input
                    ref={nameInputRef}
                    value={nameInput}
                    onChange={e => {
                      setNameInput(e.target.value.slice(0, NAME_MAX))
                      setNameError('')
                    }}
                    onFocus={() => { gameControls.enabled = false }}
                    onBlur={() => { if (!nameSaving) gameControls.enabled = true }}
                    onKeyDown={e => {
                      e.stopPropagation()   // prevent WASD/E/F from reaching game controller
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveName()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        gameControls.enabled = true
                        setEditingName(false)
                        setNameError('')
                      }
                    }}
                    maxLength={NAME_MAX}
                    className="flex-1 rounded-lg font-body text-[13px] font-bold text-white outline-none min-w-0"
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: nameError ? '1.5px solid #ef4444' : '1.5px solid rgba(124,58,237,0.6)',
                      padding: '5px 9px',
                    }}
                    autoComplete="off"
                  />
                  <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                    {nameInput.trim().length}/{NAME_MAX}
                  </span>
                </div>
                {/* Cost / cooldown hint */}
                {!nameError && (() => {
                  const hoursLeft = cooldownHoursLeft(nameChangedAt)
                  const free      = isFirstChange(nameChangedAt)
                  if (hoursLeft > 0)
                    return <div className="text-amber-400 text-[10px] mb-[4px]">⏳ Available in {hoursLeft}h</div>
                  if (free)
                    return <div className="text-green-400 text-[10px] mb-[4px]">✨ First change is free</div>
                  return (
                    <div className="text-slate-400 text-[10px] mb-[4px]">
                      Change costs <span className="text-yellow-400 font-bold">🪙 {NAME_CHANGE_COST}</span>
                    </div>
                  )
                })()}
                {/* Error */}
                {nameError && (
                  <div className="text-red-400 text-[10px] mb-[4px]">{nameError}</div>
                )}
                {/* Success */}
                {nameSuccess && (
                  <div className="text-green-400 text-[10px] mb-[4px]">{nameSuccess}</div>
                )}
                {/* Save / Cancel */}
                <div className="flex gap-1">
                  <button
                    onClick={handleSaveName}
                    disabled={
                      nameSaving ||
                      !nameInput.trim() ||
                      nameInput.trim() === avatar.name ||
                      !!validateNameInput(nameInput) ||
                      cooldownHoursLeft(nameChangedAt) > 0
                    }
                    className="flex-1 py-[5px] rounded-[7px] text-white text-[11px] font-bold cursor-pointer font-body border-0 disabled:opacity-40"
                    style={{ background: 'rgba(124,58,237,0.7)' }}
                  >
                    {nameSaving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { gameControls.enabled = true; setEditingName(false); setNameError('') }}
                    className="py-[5px] px-[10px] rounded-[7px] text-slate-400 text-[11px] cursor-pointer font-body"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-[6px] mb-[2px]">
                <div className="text-white font-extrabold text-base leading-[1.2] truncate">{avatar.name}</div>
                <button
                  onClick={() => setEditingName(true)}
                  title="Edit display name"
                  className="shrink-0 border-0 cursor-pointer font-body font-bold text-[11px] rounded-md"
                  style={{
                    background: 'rgba(124,58,237,0.35)',
                    color: '#c4b5fd',
                    padding: '2px 7px',
                    lineHeight: '1.4',
                  }}
                >
                  ✏️ Edit
                </button>
              </div>
            )}
            <div className="text-white/40 text-[11px] mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap">
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </div>
            <div className="flex items-center gap-[6px] mt-[5px]">
              <span className="text-[11px] text-violet-400 font-bold">Lv {level}</span>
              <div className="flex-1 h-1 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-sm transition-[width] duration-[400ms]"
                  style={{ width: `${(xpInLevel / xpToNext) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)' }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{xpInLevel}/{xpToNext}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-0 text-[18px] cursor-pointer p-1 shrink-0 text-white/35"
          >✕</button>
        </div>

        {/* Wallet row */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { icon: '🪙', val: eco.coins,   label: 'Coins'   },
            { icon: '💎', val: eco.gems,    label: 'Gems'    },
            { icon: '🎟️', val: eco.tickets, label: 'Tickets' },
          ].map(({ icon, val, label }) => (
            <div key={label} className="flex-1 py-[10px] text-center" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-[15px] font-extrabold text-slate-200">{icon} {val}</div>
              <div className="text-[10px] text-slate-500 mt-[2px]">{label}</div>
            </div>
          ))}
        </div>

        {/* Streak + next ticket */}
        <div className="flex gap-3" style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[12px] text-amber-400 font-bold">🔥 {eco.loginStreak}-day streak</div>
          {eco.tickets < 5 && (
            <div className="text-[12px] text-slate-500 ml-auto">🎟️ next in {fmtMs(nextTicket)}</div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[['profile','👤 Profile'],['shop','🛍️ Shop'],['games','🎮 Games'],['stats','📊 Stats']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={tabBtnCls(id)}
              style={{
                background: tab === id ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: tab === id ? '#a78bfa' : '#64748b',
                borderBottom: tab === id ? '2px solid #7c3aed' : '2px solid transparent',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '12px 14px 16px' }}>
          {tab === 'profile' && (
            <div className="flex flex-col gap-[10px]">
              <div className="flex items-center gap-2">
                <div
                  className="w-[10px] h-[10px] rounded-full"
                  style={{ background: ALL_OUTFITS.find(o => o.id === avatar.outfit)?.color ?? '#7C3AED' }}
                />
                <span className="text-white/50 text-[12px]">
                  Outfit: <span className="text-slate-200 capitalize">{avatar.outfit}</span>
                </span>
                <span className="ml-auto text-slate-500 text-[11px]">{eco.ownedOutfits.length} owned</span>
              </div>

              <button
                onClick={() => setTab('shop')}
                className="w-full py-[10px] rounded-[10px] text-violet-400 text-[13px] font-bold cursor-pointer font-body border-0"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}
              >
                🛍️ Open Outfit Shop
              </button>

              {onOpenFastTravel && (
                <button
                  onClick={() => { onClose(); onOpenFastTravel() }}
                  className="w-full py-[10px] rounded-[10px] text-yellow-400 text-[13px] font-bold cursor-pointer font-body border-0"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  📍 Fast Travel — 25 coins/trip
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="w-full py-[11px] mt-1 rounded-[10px] text-red-400 text-[13px] font-bold cursor-pointer font-body border-0 hover:bg-[rgba(239,68,68,0.2)]"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                Sign Out
              </button>
            </div>
          )}

          {tab === 'shop' && (
            <div>
              {shopMsg && (
                <div
                  className="mb-[10px] rounded-lg text-green-400 text-[12px]"
                  style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}
                >
                  {shopMsg}
                </div>
              )}
              <div className="text-[11px] text-slate-500 mb-2 font-bold">COIN OUTFITS</div>
              <div className="grid grid-cols-2 gap-2 mb-[14px]">
                {ALL_OUTFITS.filter(o => o.currency === 'coins').map(o => (
                  <OutfitCard key={o.id} outfit={o} eco={eco} current={avatar.outfit} onAction={handleBuy} />
                ))}
              </div>
              <div className="text-[11px] text-slate-500 mb-2 font-bold">GEM OUTFITS</div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_OUTFITS.filter(o => o.currency === 'gems').map(o => (
                  <OutfitCard key={o.id} outfit={o} eco={eco} current={avatar.outfit} onAction={handleBuy} />
                ))}
              </div>
            </div>
          )}

          {tab === 'games' && (() => {
            const gs = getMyStats()
            const totalGames = gs?.total_games || 0
            const wins       = gs?.total_wins   || 0
            const losses     = gs?.total_losses || 0
            const winRate    = totalGames > 0 ? Math.round(wins / totalGames * 100) : 0
            const coinsFromGames = gs?.coins_earned_from_games || 0
            const favGame = gs ? GAME_IDS.reduce((best, gid) =>
              (gs[`best_${gid}`] || 0) > (gs[`best_${best}`] || 0) ? gid : best
            , 'snake') : 'snake'

            return (
              <div className="flex flex-col gap-[10px]">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '🏆', val: wins,          label: 'Total Wins'   },
                    { icon: '💀', val: losses,         label: 'Total Losses' },
                    { icon: '🎮', val: totalGames,     label: 'Games Played' },
                    { icon: '📈', val: `${winRate}%`,  label: 'Win Rate'     },
                    { icon: '🪙', val: coinsFromGames, label: 'Coins Earned' },
                    { icon: '🌟', val: GAME_NAMES[favGame]?.split(' ')[0] ?? '—', label: 'Fav Game' },
                  ].map(({ icon, val, label }) => (
                    <div
                      key={label}
                      className="rounded-[10px]"
                      style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="text-[15px] font-extrabold text-slate-200">{icon} {val}</div>
                      <div className="text-[10px] text-slate-500 mt-[2px]">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="text-white/35 text-[11px] font-bold tracking-[0.06em] mt-1">PERSONAL BESTS</div>
                {GAME_IDS.map(gid => {
                  const best = gs?.[`best_${gid}`] || 0
                  return (
                    <div
                      key={gid}
                      className="flex items-center gap-[10px] rounded-lg"
                      style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <span className="text-lg">{GAME_EMOJIS[gid]}</span>
                      <span className="flex-1 text-slate-200 text-[13px] font-semibold">{GAME_NAMES[gid]}</span>
                      <span className="text-[14px] font-extrabold" style={{ color: best > 0 ? '#facc15' : '#475569' }}>{best}</span>
                    </div>
                  )
                })}

                {!gs && (
                  <div className="text-slate-600 text-center text-[13px] py-4">
                    Visit the Game Zone to start playing!
                  </div>
                )}
              </div>
            )
          })()}

          {tab === 'stats' && (
            <div className="flex flex-col gap-[6px]">
              <div className="text-white/35 text-[11px] font-bold mb-1 tracking-[0.06em]">VITALS</div>
              {Object.entries(stats).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function OutfitCard({ outfit, eco, current, onAction }) {
  const owned    = eco.ownedOutfits.includes(outfit.id) || outfit.free
  const equipped = current === outfit.id
  const canAfford = outfit.currency === 'gems' ? eco.gems >= outfit.cost : eco.coins >= outfit.cost

  return (
    <div
      className="rounded-[10px] text-center"
      style={{
        background: equipped ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${equipped ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
        padding: '10px 10px 8px',
      }}
    >
      <div
        className="w-9 h-9 rounded-full mx-auto mb-[6px]"
        style={{ background: outfit.color, border: '2px solid rgba(255,255,255,0.15)' }}
      />
      <div className="text-[12px] font-bold text-slate-200 mb-1">{outfit.label}</div>

      {equipped ? (
        <div className="text-[10px] text-green-400 font-bold">✓ Equipped</div>
      ) : owned ? (
        <button
          onClick={() => onAction(outfit)}
          className="w-full py-[5px] text-[11px] font-bold cursor-pointer font-body rounded-[6px] text-violet-400"
          style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)' }}
        >
          Equip
        </button>
      ) : (
        <button
          onClick={() => onAction(outfit)}
          disabled={!canAfford}
          className={`w-full py-[5px] text-[11px] font-bold font-body rounded-[6px] ${canAfford ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          style={{
            background: canAfford ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${canAfford ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.08)'}`,
            color: canAfford ? '#facc15' : '#475569',
          }}
        >
          {outfit.currency === 'gems' ? '💎' : '🪙'} {outfit.cost === 0 ? 'Free' : outfit.cost}
        </button>
      )}
    </div>
  )
}

function StatBar({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-white/45 text-[12px] w-[58px] capitalize shrink-0">{label}</div>
      <div className="flex-1 h-[5px] rounded-[3px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-[3px] transition-[width] duration-300"
          style={{ width: `${value}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)' }}
        />
      </div>
      <div className="text-white/35 text-[11px] w-6 text-right shrink-0">{value}</div>
    </div>
  )
}
