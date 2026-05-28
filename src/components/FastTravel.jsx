import { useState, useEffect, useCallback } from 'react'
import { minimapState } from '@/lib/minimapState'
import { spendCoins, getEconomyState, onEconomyUpdate } from '@/lib/economyState'
import { teleportRequest } from '@/lib/teleportState'
import { COSTS } from '@/lib/costs'
import { getHouseState, onHouseUpdate } from '@/lib/houseService'

const COST       = COSTS.fastTravel
const HOUSE_COST = COSTS.houseTravel

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
  const [eco, setEco]         = useState(getEconomyState())
  const [hs,  setHs]          = useState(getHouseState())
  const [confirm, setConfirm] = useState(null)  // loc object or null

  useEffect(() => onEconomyUpdate(setEco), [])
  useEffect(() => onHouseUpdate(setHs),  [])

  const selectLoc = useCallback((loc) => {
    const cost = loc.isHome ? HOUSE_COST : COST
    if (eco.coins < cost) return
    setConfirm(loc)
  }, [eco.coins])

  const confirmTravel = useCallback(() => {
    if (!confirm) return
    const cost = confirm.isHome ? HOUSE_COST : COST
    if (eco.coins < cost) { setConfirm(null); return }
    spendCoins(cost)
    teleportRequest.x       = confirm.pos[0]
    teleportRequest.z       = confirm.pos[2]
    teleportRequest.pending = true
    onTravel?.(`Traveled to ${confirm.label} · ${cost} coins spent`)
    setConfirm(null)
    onClose()
  }, [confirm, eco.coins, onClose, onTravel])

  if (!open) return null

  // Build the home location entry if the player has a house
  const homeLoc = hs.ready && hs.position && !hs.evicted
    ? { id: 'my-house', pos: [hs.position.x, 0, hs.position.z], emoji: '🏠', label: `My House (${hs.number})`, isHome: true }
    : null

  const allLocations = homeLoc ? [homeLoc, ...LOCATIONS] : LOCATIONS
  const canAfford    = (loc) => eco.coins >= (loc.isHome ? HOUSE_COST : COST)

  return (
    <div
      onClick={() => { setConfirm(null); onClose() }}
      className="fixed inset-0 z-[550]"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="absolute left-16 top-1/2 -translate-y-1/2 w-[288px] rounded-2xl overflow-hidden flex flex-col font-body max-h-[80vh]"
        style={{
          background: 'rgba(8,4,20,0.97)',
          border: '1px solid rgba(124,58,237,0.35)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <div className="text-violet-400 font-extrabold text-[15px]">📍 Fast Travel</div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              🪙 {eco.coins} coins · {COST} per trip · {HOUSE_COST} to home
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-0 text-slate-500 text-lg cursor-pointer"
          >✕</button>
        </div>

        {/* Not enough coins */}
        {eco.coins < COST && !homeLoc && (
          <div
            className="px-[14px] py-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.12)' }}
          >
            <span className="text-red-400">Need {COST} coins. You have {eco.coins}.</span>
            {onOpenShop && (
              <button
                onClick={() => { onClose(); onOpenShop() }}
                className="ml-1.5 bg-transparent border-0 text-violet-400 font-bold text-xs cursor-pointer underline font-body"
              >Buy more?</button>
            )}
            <div className="text-slate-500 text-[11px] mt-[3px]">Or walk for free — close this panel.</div>
          </div>
        )}

        {/* Confirm dialog */}
        {confirm && (
          <div
            className="px-[14px] py-3"
            style={{
              background: 'rgba(124,58,237,0.1)',
              borderBottom: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            <div className="text-slate-200 text-[13px] font-bold mb-2">
              {confirm.emoji} Fast travel to <span className="text-violet-400">{confirm.label}</span>
              {' '}costs {confirm.isHome ? HOUSE_COST : COST} coins
            </div>
            <div className="text-slate-500 text-[11px] mb-[10px]">
              Or close this panel to walk for free.
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmTravel}
                className="flex-1 py-[9px] rounded-lg text-white font-bold text-[13px] cursor-pointer font-body border-0"
                style={{ background: 'rgba(124,58,237,0.7)' }}
              >
                Travel (🪙 {confirm.isHome ? HOUSE_COST : COST})
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="py-[9px] px-[14px] rounded-lg text-slate-400 text-[13px] cursor-pointer font-body"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Location list */}
        <div className="overflow-y-auto" style={{ padding: '8px 10px 12px' }}>
          {allLocations.map(loc => {
            const cost       = loc.isHome ? HOUSE_COST : COST
            const affordable = canAfford(loc)
            return (
              <button
                key={loc.id}
                onClick={() => selectLoc(loc)}
                disabled={!affordable}
                className={`flex items-center gap-[10px] w-full py-[9px] px-[10px] rounded-[10px] mb-[5px] transition-[background] duration-150 text-left ${affordable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                style={{
                  background: confirm?.id === loc.id
                    ? (loc.isHome ? 'rgba(251,191,36,0.18)' : 'rgba(124,58,237,0.18)')
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${confirm?.id === loc.id
                    ? (loc.isHome ? 'rgba(251,191,36,0.4)' : 'rgba(124,58,237,0.4)')
                    : (loc.isHome ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.05)')}`,
                  opacity: affordable ? 1 : 0.45,
                }}
                onMouseEnter={e => { if (affordable) e.currentTarget.style.background = loc.isHome ? 'rgba(251,191,36,0.1)' : 'rgba(124,58,237,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = confirm?.id === loc.id ? (loc.isHome ? 'rgba(251,191,36,0.18)' : 'rgba(124,58,237,0.18)') : 'rgba(255,255,255,0.03)' }}
              >
                <span className="text-xl leading-none shrink-0">{loc.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-bold ${loc.isHome ? 'text-amber-300' : 'text-slate-200'}`}>{loc.label}</div>
                  <div className="text-slate-500 text-[11px] mt-[1px]">{walkTime(loc.pos[0], loc.pos[2])}</div>
                </div>
                <div className={`text-xs font-bold shrink-0 ${loc.isHome ? 'text-amber-400' : 'text-yellow-400'}`}>
                  🪙 {cost}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
