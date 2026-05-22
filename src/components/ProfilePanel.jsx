import { useUser, useClerk } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'

const OUTFIT_COLORS = {
  casual: '#7C3AED', school: '#1D4ED8', party: '#DB2777',
  traditional: '#D97706', winter: '#0F766E', sports: '#DC2626',
}

export default function ProfilePanel({ onClose }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const avatar = useStore(s => s.avatar)
  const wallet = useStore(s => s.wallet)
  const stats  = useStore(s => s.stats)

  const outfitColor = OUTFIT_COLORS[avatar.outfit] || '#7C3AED'

  async function handleSignOut() {
    onClose()
    await signOut()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(12,8,26,0.97)',
          border: '1.5px solid rgba(124,58,237,0.4)',
          borderRadius: 20, width: 'min(90vw, 340px)',
          fontFamily: 'Nunito, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(219,39,119,0.2))',
          padding: '20px 20px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt=""
              style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(124,58,237,0.6)', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: outfitColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, border: '2px solid rgba(255,255,255,0.2)',
            }}>
              {avatar.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              {avatar.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 4,
            lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Outfit badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: outfitColor, flexShrink: 0,
            }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              Outfit: <span style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{avatar.outfit}</span>
            </span>
          </div>

          {/* Wallet */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px',
            display: 'flex', gap: 16,
          }}>
            <Stat label="Coins" value={`🪙 ${wallet.coins}`} />
            <Stat label="Gems" value={`💎 ${wallet.gems}`} />
            <Stat label="Tickets" value={`🎟️ ${wallet.tickets}`} />
          </div>

          {/* Stats */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
              VITALS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(stats).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} />
              ))}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              marginTop: 4, width: '100%', background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
              padding: '12px', color: '#f87171', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'Nunito, sans-serif',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function StatBar({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 58, textTransform: 'capitalize', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, width: 24, textAlign: 'right', flexShrink: 0 }}>{value}</div>
    </div>
  )
}
