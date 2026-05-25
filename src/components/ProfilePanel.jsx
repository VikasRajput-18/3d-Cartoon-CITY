import { useState, useEffect, useCallback } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { getEconomyState, onEconomyUpdate, purchaseOutfit, msUntilNextTicket } from '@/lib/economyState'
import { getMissionState, onMissionUpdate, calcLevel } from '@/lib/missionState'

const ALL_OUTFITS = [
  { id: 'casual',      label: 'Casual',      color: '#7C3AED', currency: 'coins', cost: 0,   free: true  },
  { id: 'school',      label: 'School',      color: '#1D4ED8', currency: 'coins', cost: 100              },
  { id: 'sports',      label: 'Sports',      color: '#DC2626', currency: 'coins', cost: 150              },
  { id: 'winter',      label: 'Winter',      color: '#0F766E', currency: 'coins', cost: 200              },
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

  useEffect(() => onEconomyUpdate(setEco), [])
  useEffect(() => onMissionUpdate(setMs),   [])

  // Tick countdown for next ticket
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

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
        background: tab === id ? 'rgba(124,58,237,0.25)' : 'transparent',
        color: tab === id ? '#a78bfa' : '#64748b',
        fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12,
        borderBottom: tab === id ? '2px solid #7c3aed' : '2px solid transparent',
      }}
    >{label}</button>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(12,8,26,0.97)', border: '1.5px solid rgba(124,58,237,0.4)',
          borderRadius: 20, width: 'min(92vw, 360px)', maxHeight: '88vh',
          fontFamily: 'Nunito, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(219,39,119,0.2))', padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.imageUrl
            ? <img src={user.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.6)', flexShrink: 0 }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '2px solid rgba(255,255,255,0.2)' }}>
                {avatar.name?.[0]?.toUpperCase() || '?'}
              </div>
          }
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{avatar.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>Lv {level}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(xpInLevel / xpToNext) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)', borderRadius: 2, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 10, color: '#64748b' }}>{xpInLevel}/{xpToNext}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Wallet row */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { icon: '🪙', val: eco.coins,   label: 'Coins'   },
            { icon: '💎', val: eco.gems,    label: 'Gems'    },
            { icon: '🎟️', val: eco.tickets, label: 'Tickets' },
          ].map(({ icon, val, label }) => (
            <div key={label} style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>{icon} {val}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Streak + next ticket */}
        <div style={{ display: 'flex', padding: '8px 14px', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
            🔥 {eco.loginStreak}-day streak
          </div>
          {eco.tickets < 5 && (
            <div style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
              🎟️ next in {fmtMs(nextTicket)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {tabBtn('profile', '👤 Profile')}
          {tabBtn('shop',    '🛍️ Shop')}
          {tabBtn('stats',   '📊 Stats')}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 16px' }}>
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: ALL_OUTFITS.find(o => o.id === avatar.outfit)?.color ?? '#7C3AED' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  Outfit: <span style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{avatar.outfit}</span>
                </span>
                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>
                  {eco.ownedOutfits.length} owned
                </span>
              </div>

              <button
                onClick={() => setTab('shop')}
                style={{ width: '100%', padding: '10px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
              >
                🛍️ Open Outfit Shop
              </button>

              {onOpenFastTravel && (
                <button
                  onClick={() => { onClose(); onOpenFastTravel() }}
                  style={{ width: '100%', padding: '10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, color: '#fbbf24', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
                >
                  📍 Fast Travel — 10 coins/trip
                </button>
              )}

              <button
                onClick={handleSignOut}
                style={{ width: '100%', padding: '11px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', marginTop: 4 }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              >
                Sign Out
              </button>
            </div>
          )}

          {tab === 'shop' && (
            <div>
              {shopMsg && (
                <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>
                  {shopMsg}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 700 }}>COIN OUTFITS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {ALL_OUTFITS.filter(o => o.currency === 'coins').map(o => (
                  <OutfitCard key={o.id} outfit={o} eco={eco} current={avatar.outfit} onAction={handleBuy} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 700 }}>GEM OUTFITS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ALL_OUTFITS.filter(o => o.currency === 'gems').map(o => (
                  <OutfitCard key={o.id} outfit={o} eco={eco} current={avatar.outfit} onAction={handleBuy} />
                ))}
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em' }}>VITALS</div>
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
    <div style={{
      background: equipped ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${equipped ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 10, padding: '10px 10px 8px', textAlign: 'center',
    }}>
      {/* Preview circle */}
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: outfit.color, margin: '0 auto 6px', border: '2px solid rgba(255,255,255,0.15)' }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{outfit.label}</div>

      {equipped ? (
        <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Equipped</div>
      ) : owned ? (
        <button
          onClick={() => onAction(outfit)}
          style={{ width: '100%', padding: '5px 0', background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, color: '#a78bfa', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
        >
          Equip
        </button>
      ) : (
        <button
          onClick={() => onAction(outfit)}
          disabled={!canAfford}
          style={{ width: '100%', padding: '5px 0', background: canAfford ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${canAfford ? 'rgba(250,204,21,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, color: canAfford ? '#facc15' : '#475569', fontSize: 11, fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'Nunito, sans-serif' }}
        >
          {outfit.currency === 'gems' ? '💎' : '🪙'} {outfit.cost === 0 ? 'Free' : outfit.cost}
        </button>
      )}
    </div>
  )
}

function StatBar({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, width: 58, textTransform: 'capitalize', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, width: 24, textAlign: 'right', flexShrink: 0 }}>{value}</div>
    </div>
  )
}
