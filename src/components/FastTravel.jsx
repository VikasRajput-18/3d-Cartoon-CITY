import { useState, useEffect, useCallback } from 'react'
import { minimapState } from '@/lib/minimapState'
import { spendCoins, getEconomyState, onEconomyUpdate } from '@/lib/economyState'
import { teleportRequest } from '@/lib/teleportState'
import { COSTS } from '@/lib/costs'

const COST = COSTS.fastTravel

const LOCATIONS = [
  { id: 'center',     pos: [0,   0,  6],  emoji: '🏙️', label: 'City Center'    },
  { id: 'cafe',       pos: [-10, 0, -6],  emoji: '☕', label: 'Cafe'            },
  { id: 'arcade',     pos: [10,  0, -6],  emoji: '🕹️', label: 'Arcade'          },
  { id: 'beach',      pos: [0,   0,-14],  emoji: '🏖️', label: 'Beach Club'      },
  { id: 'rooftop',    pos: [-14, 0,  4],  emoji: '🌙', label: 'Rooftop Bar'     },
  { id: 'musicroom',  pos: [14,  0,  4],  emoji: '🎵', label: 'Music Room'      },
  { id: 'park',       pos: [0,   0, 14],  emoji: '🌳', label: 'Park'            },
  { id: 'mall',       pos: [-16, 0,-28],  emoji: '🛍️', label: 'Shopping Mall'   },
  { id: 'cinema',     pos: [16,  0,-28],  emoji: '🎬', label: 'Cinema'          },
  { id: 'hospital',   pos: [34,  0, -5],  emoji: '🏥', label: 'Hospital'        },
  { id: 'school',     pos: [-34, 0, -5],  emoji: '🏫', label: 'School'          },
  { id: 'restaurant', pos: [12,  0, 28],  emoji: '🍕', label: 'Restaurant'      },
  { id: 'gamearea',   pos: [22,  0,-10],  emoji: '🎮', label: 'Game Zone'        },
]

function walkTime(x, z) {
  const px   = minimapState.playerX
  const pz   = minimapState.playerZ
  const dist = Math.hypot(x - px, z - pz)
  const secs = Math.round(dist / 8)
  if (secs < 60) return `~${secs}s walk`
  return `~${Math.round(secs / 60)}m walk`
}

export default function FastTravel({ open, onClose, onTravel, onOpenShop }) {
  const [eco, setEco]       = useState(getEconomyState())
  const [confirm, setConfirm] = useState(null)  // loc object or null

  useEffect(() => onEconomyUpdate(setEco), [])

  const selectLoc = useCallback((loc) => {
    if (eco.coins < COST) return  // blocked — handled by button disabled state
    setConfirm(loc)
  }, [eco.coins])

  const confirmTravel = useCallback(() => {
    if (!confirm) return
    if (eco.coins < COST) {
      setConfirm(null)
      return
    }
    spendCoins(COST)
    teleportRequest.x       = confirm.pos[0]
    teleportRequest.z       = confirm.pos[2]
    teleportRequest.pending = true
    onTravel?.(`Traveled to ${confirm.label} · ${COST} coins spent`)
    setConfirm(null)
    onClose()
  }, [confirm, eco.coins, onClose, onTravel])

  if (!open) return null

  const canAfford = eco.coins >= COST

  return (
    <div
      onClick={() => { setConfirm(null); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 550,
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)',
          width: 288,
          background: 'rgba(8,4,20,0.97)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 16,
          fontFamily: 'Nunito, sans-serif',
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: 15 }}>📍 Fast Travel</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              🪙 {eco.coins} coins · {COST} coins per trip
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Not enough coins */}
        {!canAfford && (
          <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.12)', fontSize: 12 }}>
            <span style={{ color: '#f87171' }}>Need {COST} coins. You have {eco.coins}.</span>
            {onOpenShop && (
              <button
                onClick={() => { onClose(); onOpenShop() }}
                style={{ marginLeft: 6, background: 'none', border: 'none', color: '#a78bfa', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Nunito, sans-serif' }}
              >Buy more?</button>
            )}
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Or walk for free — close this panel.</div>
          </div>
        )}

        {/* Confirm dialog */}
        {confirm && (
          <div style={{ padding: '12px 14px', background: 'rgba(124,58,237,0.1)', borderBottom: '1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              {confirm.emoji} Fast travel to <span style={{ color: '#a78bfa' }}>{confirm.label}</span> costs {COST} coins
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
              Or close this panel to walk for free.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmTravel}
                style={{
                  flex: 1, padding: '9px 0', background: 'rgba(124,58,237,0.7)',
                  border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                Travel (🪙 {COST})
              </button>
              <button
                onClick={() => setConfirm(null)}
                style={{
                  padding: '9px 14px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Location list */}
        <div style={{ overflowY: 'auto', padding: '8px 10px 12px' }}>
          {LOCATIONS.map(loc => (
            <button
              key={loc.id}
              onClick={() => selectLoc(loc)}
              disabled={!canAfford}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px',
                background: confirm?.id === loc.id ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${confirm?.id === loc.id ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 10, marginBottom: 5,
                cursor: canAfford ? 'pointer' : 'not-allowed',
                opacity: canAfford ? 1 : 0.45,
                transition: 'background 0.15s',
                fontFamily: 'Nunito, sans-serif',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (canAfford) e.currentTarget.style.background = 'rgba(124,58,237,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = confirm?.id === loc.id ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)' }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{loc.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{loc.label}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>{walkTime(loc.pos[0], loc.pos[2])}</div>
              </div>
              <div style={{ color: '#facc15', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                🪙 {COST}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
