import { useState, useEffect, useCallback } from 'react'
import { minimapState } from '@/lib/minimapState'
import { spendCoins, getEconomyState, onEconomyUpdate } from '@/lib/economyState'
import { teleportRequest } from '@/lib/teleportState'

const COST = 10

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

export default function FastTravel({ open, onClose, onTravel }) {
  const [eco, setEco]   = useState(getEconomyState())
  const [msg, setMsg]   = useState('')

  useEffect(() => onEconomyUpdate(setEco), [])

  const travel = useCallback((loc) => {
    if (eco.coins < COST) {
      setMsg(`Need ${COST} coins — earn more by completing missions!`)
      setTimeout(() => setMsg(''), 3000)
      return
    }
    spendCoins(COST)
    teleportRequest.x       = loc.pos[0]
    teleportRequest.z       = loc.pos[2]
    teleportRequest.pending = true
    onTravel?.(`Traveled to ${loc.label} · ${COST} coins spent`)
    onClose()
  }, [eco.coins, onClose, onTravel])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 550,
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 64, top: '50%', transform: 'translateY(-50%)',
          width: 280,
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

        {/* Error message */}
        {msg && (
          <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 12 }}>
            {msg}
          </div>
        )}

        {/* Location list */}
        <div style={{ overflowY: 'auto', padding: '8px 10px 12px' }}>
          {LOCATIONS.map(loc => (
            <button
              key={loc.id}
              onClick={() => travel(loc)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 10, marginBottom: 5,
                cursor: eco.coins >= COST ? 'pointer' : 'not-allowed',
                opacity: eco.coins >= COST ? 1 : 0.5,
                transition: 'background 0.15s',
                fontFamily: 'Nunito, sans-serif',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (eco.coins >= COST) e.currentTarget.style.background = 'rgba(124,58,237,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
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
