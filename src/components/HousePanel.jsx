import { useState, useEffect } from 'react'
import {
  getHouseState, onHouseUpdate,
  payBill, payAllBills, payEvictionFine, upgradeHouse,
  EVICT_FINE, LEVEL_NAMES, LEVEL_DESCRIPTIONS, UPGRADE_COST, MAX_LEVEL,
  VEHICLE_CATALOG, FURNITURE_CATALOG, PET_CATALOG,
  buyVehicle, buyFurniture, buyPet,
  canRest, canSleep, doRest, doSleep,
  callVehiclesHome, CALL_HOME_COST,
} from '@/lib/houseService'
import { getEconomyState, onEconomyUpdate } from '@/lib/economyState'

const BILL_ICON  = { rent:'🏠', electricity:'⚡', water:'💧', wifi:'📡', food:'🍔' }
const BILL_LABEL = { rent:'Rent', electricity:'Electricity', water:'Water', wifi:'Wi-Fi', food:'Food' }

const STATUS_COLOR = {
  ok:'#22c55e', warning:'#eab308',
  'eviction-warning':'#f97316', evicted:'#ef4444',
}
const STATUS_TEXT = {
  ok:'Good standing', warning:'Bills overdue — pay soon',
  'eviction-warning':'Eviction risk!', evicted:'EVICTED — pay fine to return',
}

const TABS = ['Bills','Upgrade','Shop','Rest/Sleep']

export function HouseQuickButton({ onClick }) {
  const [hs, setHs] = useState(getHouseState)
  useEffect(() => onHouseUpdate(setHs), [])
  const hasDue = hs.ready && hs.unpaid > 0
  const dotColor = hs.status === 'evicted' ? '#ef4444'
    : hs.status === 'eviction-warning' ? '#f97316'
    : hs.status === 'warning' ? '#eab308' : null
  return (
    <button onClick={onClick} title="My House"
      className="relative w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
      style={{
        background:'rgba(251,191,36,0.15)',
        border:'1.5px solid rgba(251,191,36,0.35)',
        boxShadow: hasDue ? '0 2px 12px rgba(239,68,68,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
      }}>
      🏠
      {dotColor && (
        <span className="absolute -top-[4px] -right-[4px] w-3 h-3 rounded-full"
          style={{ background: dotColor, boxShadow:`0 0 6px ${dotColor}` }} />
      )}
    </button>
  )
}

export default function HousePanel({ open, onClose, onEnterHouse }) {
  const [hs,   setHs]  = useState(getHouseState)
  const [eco,  setEco] = useState(getEconomyState)
  const [busy, setBusy]  = useState(false)
  const [msg,  setMsg]   = useState(null)
  const [tab,  setTab]   = useState('Bills')
  const [shopSub, setShopSub] = useState('vehicles') // vehicles | furniture | pets

  useEffect(() => onHouseUpdate(setHs),    [])
  useEffect(() => onEconomyUpdate(setEco), [])
  useEffect(() => {
    if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) }
  }, [msg])

  if (!open || !hs.ready) return null

  const { number, level, evicted, bills, unpaid, status } = hs
  const upgradeCost = level < MAX_LEVEL ? UPGRADE_COST[level - 1] : null
  const levelFrac   = (level - 1) / (MAX_LEVEL - 1)

  async function run(fn, successMsg) {
    setBusy(true)
    const r = await fn()
    if (!r.ok) setMsg(r.reason || 'Not enough coins')
    else if (successMsg) setMsg(successMsg)
    setBusy(false)
  }

  const panelStyle = {
    maxHeight: '88vh',
    background: 'rgba(8,4,20,0.97)',
    border: '1px solid rgba(124,58,237,0.35)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[550]" style={{ background:'rgba(0,0,0,0.55)' }}>
      <div onClick={e => e.stopPropagation()}
        className="absolute left-16 top-1/2 -translate-y-1/2 w-[310px] rounded-2xl overflow-hidden flex flex-col font-body"
        style={panelStyle}>

        {/* Header */}
        <div className="flex items-center justify-between shrink-0"
          style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="text-violet-400 font-extrabold text-[15px]">🏠 My House</div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              {number} · <span style={{ color: STATUS_COLOR[status] }}>Lv {level} — {LEVEL_NAMES[level-1]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEnterHouse && (
              <button onClick={onEnterHouse}
                className="border-0 rounded-lg text-[11px] font-bold cursor-pointer font-body"
                style={{ background:'rgba(124,58,237,0.5)', color:'#fff', padding:'4px 9px' }}>
                Enter
              </button>
            )}
            <button onClick={onClose}
              className="bg-transparent border-0 text-slate-500 text-lg cursor-pointer">✕</button>
          </div>
        </div>

        {/* Status bar */}
        <div className="shrink-0 px-[14px] py-[7px] text-[12px] font-bold"
          style={{ background:`${STATUS_COLOR[status]}16`, borderBottom:'1px solid rgba(255,255,255,0.04)', color: STATUS_COLOR[status] }}>
          {STATUS_TEXT[status]}
          {unpaid > 0 && !evicted && <span className="text-slate-400 font-normal ml-1.5">· 🪙 {unpaid} unpaid</span>}
        </div>

        {/* Toast */}
        {msg && (
          <div className="shrink-0 px-[14px] py-[6px] text-[12px]"
            style={{ background:'rgba(124,58,237,0.15)', borderBottom:'1px solid rgba(124,58,237,0.2)', color:'#c4b5fd' }}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 text-[11px] font-bold py-[7px] cursor-pointer border-0 font-body"
              style={{
                background: tab === t ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: tab === t ? '#a78bfa' : '#64748b',
                borderBottom: tab === t ? '2px solid #7c3aed' : '2px solid transparent',
              }}>
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding:'10px 12px 14px' }}>

          {/* ── BILLS TAB ── */}
          {tab === 'Bills' && <>
            {evicted && (
              <div className="rounded-xl mb-3"
                style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', padding:'12px 14px' }}>
                <div className="text-red-400 font-bold text-[13px] mb-1">You have been evicted</div>
                <div className="text-slate-400 text-[11px] mb-3">
                  Pay a {EVICT_FINE} coin fine to move back in.
                </div>
                <button onClick={() => run(payEvictionFine, 'Back home!')}
                  disabled={busy || eco.coins < EVICT_FINE}
                  className="w-full py-[8px] rounded-lg text-white font-bold text-[13px] cursor-pointer font-body border-0 disabled:opacity-40"
                  style={{ background:'rgba(239,68,68,0.75)' }}>
                  Pay fine · 🪙 {EVICT_FINE}
                </button>
              </div>
            )}
            {bills.length > 0 ? <>
              <div className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide mb-2">Unpaid bills</div>
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center gap-2 rounded-[9px] mb-[5px]"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'8px 10px' }}>
                  <span className="text-base shrink-0">{BILL_ICON[bill.type] ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 text-[12px] font-semibold">{BILL_LABEL[bill.type] ?? bill.type}</div>
                    <div className="text-slate-600 text-[10px]">{bill.dueDate}</div>
                  </div>
                  <div className="text-yellow-400 text-[12px] font-bold shrink-0 mr-1">🪙 {bill.amount}</div>
                  <button onClick={() => run(() => payBill(bill.id))}
                    disabled={busy || eco.coins < bill.amount}
                    className="shrink-0 rounded-[7px] text-white text-[11px] font-bold cursor-pointer font-body border-0 disabled:opacity-35"
                    style={{ background:'rgba(124,58,237,0.65)', padding:'4px 10px' }}>
                    Pay
                  </button>
                </div>
              ))}
              <button onClick={() => run(payAllBills, `All clear!`)}
                disabled={busy || eco.coins < unpaid}
                className="w-full mt-2 py-[9px] rounded-xl text-white font-bold text-[13px] cursor-pointer font-body border-0 disabled:opacity-40"
                style={{ background:'rgba(124,58,237,0.7)' }}>
                Pay all · 🪙 {unpaid}
              </button>
            </> : !evicted && (
              <div className="text-center py-5">
                <div className="text-2xl mb-1">✅</div>
                <div className="text-green-400 text-[13px] font-bold">All bills paid!</div>
              </div>
            )}
            <div className="mt-3 rounded-xl flex items-center justify-between"
              style={{ background:'rgba(255,255,255,0.04)', padding:'9px 12px' }}>
              <span className="text-slate-400 text-[12px]">Balance</span>
              <span className="text-yellow-400 font-bold text-[13px]">🪙 {eco.coins}</span>
            </div>
          </>}

          {/* ── UPGRADE TAB ── */}
          {tab === 'Upgrade' && <>
            {/* Level progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Level {level} of {MAX_LEVEL}</span>
                <span className="text-amber-400 font-bold">{LEVEL_NAMES[level-1]}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.08)', height:6 }}>
                <div style={{
                  height:'100%', width:`${(levelFrac*100).toFixed(1)}%`,
                  background:'linear-gradient(90deg,#7c3aed,#fbbf24)',
                  borderRadius:'9999px', transition:'width 0.4s',
                }} />
              </div>
            </div>

            {/* Current level card */}
            <div className="rounded-xl mb-3"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', padding:'12px 14px' }}>
              <div className="text-slate-300 font-bold text-[13px] mb-1">
                Current: Lv {level} — {LEVEL_NAMES[level-1]}
              </div>
              <div className="text-slate-500 text-[11px]">{LEVEL_DESCRIPTIONS[level-1]}</div>
            </div>

            {/* Upgrade to next level */}
            {level < MAX_LEVEL ? (
              <div className="rounded-xl"
                style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)', padding:'12px 14px' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400 font-bold text-[13px]">Upgrade to Lv {level+1}</span>
                </div>
                <div className="text-slate-300 font-semibold text-[12px] mb-0.5">{LEVEL_NAMES[level]}</div>
                <div className="text-slate-500 text-[11px] mb-3">{LEVEL_DESCRIPTIONS[level]}</div>
                {eco.coins < upgradeCost && (
                  <div className="text-red-400 text-[11px] mb-2">
                    Need {upgradeCost - eco.coins} more coins
                  </div>
                )}
                <button onClick={() => run(upgradeHouse, `Upgraded to ${LEVEL_NAMES[level]}!`)}
                  disabled={busy || evicted || eco.coins < upgradeCost}
                  className="w-full py-[9px] rounded-lg font-bold text-[13px] cursor-pointer font-body border-0 disabled:opacity-40"
                  style={{ background:'rgba(251,191,36,0.25)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.35)' }}>
                  Upgrade · 🪙 {upgradeCost}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-2xl">⭐</div>
                <div className="text-amber-400 font-bold text-[13px] mt-1">Max level reached!</div>
              </div>
            )}

            {/* All levels list */}
            <div className="mt-4">
              <div className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide mb-2">All levels</div>
              {LEVEL_NAMES.map((name, i) => (
                <div key={i} className="flex items-center gap-2 mb-[4px]">
                  <span className="text-[10px] font-bold w-5 text-right"
                    style={{ color: i < level ? '#22c55e' : i === level-1 ? '#fbbf24' : '#475569' }}>
                    {i < level-1 ? '✓' : i === level-1 ? '★' : `${i+1}`}
                  </span>
                  <span className="text-[11px]" style={{ color: i < level-1 ? '#4ade80' : i === level-1 ? '#fbbf24' : '#475569' }}>
                    {name}
                  </span>
                  {i < MAX_LEVEL-1 && i >= level-1 && (
                    <span className="ml-auto text-[10px] text-slate-600">🪙 {UPGRADE_COST[i]}</span>
                  )}
                </div>
              ))}
            </div>
          </>}

          {/* ── SHOP TAB ── */}
          {tab === 'Shop' && <>
            <div className="flex gap-1 mb-3">
              {['vehicles','furniture','pets'].map(s => (
                <button key={s} onClick={() => setShopSub(s)}
                  className="flex-1 text-[11px] py-[5px] rounded-lg font-bold cursor-pointer border-0 font-body"
                  style={{
                    background: shopSub === s ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                    color: shopSub === s ? '#c4b5fd' : '#64748b',
                  }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {shopSub === 'vehicles' && VEHICLE_CATALOG.map(v => {
              const owned = hs.ownedVehicles.includes(v.id)
              return (
                <div key={v.id} className="flex items-center gap-2 rounded-[9px] mb-[5px]"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'8px 10px' }}>
                  <span className="text-xl">{v.emoji}</span>
                  <div className="flex-1">
                    <div className="text-slate-200 text-[12px] font-semibold">{v.label}</div>
                    <div className="text-slate-500 text-[10px]">{v.speed} speed</div>
                  </div>
                  {owned ? (
                    <span className="text-green-400 text-[11px] font-bold">Owned ✓</span>
                  ) : (
                    <button onClick={() => run(() => buyVehicle(v.id), `${v.label} bought!`)}
                      disabled={busy || eco.coins < v.price}
                      className="rounded-[7px] text-white text-[11px] font-bold cursor-pointer font-body border-0 disabled:opacity-35"
                      style={{ background:'rgba(124,58,237,0.65)', padding:'4px 10px' }}>
                      🪙 {v.price}
                    </button>
                  )}
                </div>
              )
            })}

            {shopSub === 'vehicles' && hs.ownedVehicles.length > 0 && (
              <button
                onClick={() => run(callVehiclesHome, 'Vehicles called home!')}
                disabled={busy || eco.coins < CALL_HOME_COST}
                className="w-full mt-2 py-[8px] rounded-lg text-white font-bold text-[12px] cursor-pointer font-body border-0 disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.5)' }}>
                📞 Call all vehicles home · 🪙 {CALL_HOME_COST}
              </button>
            )}

            {shopSub === 'furniture' && FURNITURE_CATALOG.map(f => {
              const owned = hs.ownedFurniture.includes(f.id)
              return (
                <div key={f.id} className="flex items-center gap-2 rounded-[9px] mb-[5px]"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'8px 10px' }}>
                  <span className="text-xl">{f.emoji}</span>
                  <div className="flex-1">
                    <div className="text-slate-200 text-[12px] font-semibold">{f.label}</div>
                  </div>
                  {owned ? (
                    <span className="text-green-400 text-[11px] font-bold">Owned ✓</span>
                  ) : (
                    <button onClick={() => run(() => buyFurniture(f.id), `${f.label} added!`)}
                      disabled={busy || eco.coins < f.price}
                      className="rounded-[7px] text-white text-[11px] font-bold cursor-pointer font-body border-0 disabled:opacity-35"
                      style={{ background:'rgba(124,58,237,0.65)', padding:'4px 10px' }}>
                      🪙 {f.price}
                    </button>
                  )}
                </div>
              )
            })}

            {shopSub === 'pets' && PET_CATALOG.map(p => {
              const owned = hs.ownedPets.includes(p.id)
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-[9px] mb-[5px]"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'8px 10px' }}>
                  <span className="text-xl">{p.emoji}</span>
                  <div className="flex-1">
                    <div className="text-slate-200 text-[12px] font-semibold">{p.label}</div>
                  </div>
                  {owned ? (
                    <span className="text-green-400 text-[11px] font-bold">Owned ✓</span>
                  ) : (
                    <button onClick={() => run(() => buyPet(p.id), `${p.label} adopted!`)}
                      disabled={busy || eco.coins < p.price}
                      className="rounded-[7px] text-white text-[11px] font-bold cursor-pointer font-body border-0 disabled:opacity-35"
                      style={{ background:'rgba(124,58,237,0.65)', padding:'4px 10px' }}>
                      🪙 {p.price}
                    </button>
                  )}
                </div>
              )
            })}
          </>}

          {/* ── REST / SLEEP TAB ── */}
          {tab === 'Rest/Sleep' && <>
            <div className="text-slate-400 text-[11px] mb-3 leading-relaxed">
              Resting and sleeping at home restores your energy and earns bonuses.
            </div>

            {/* Rest card */}
            <div className="rounded-xl mb-3"
              style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', padding:'12px 14px' }}>
              <div className="text-indigo-400 font-bold text-[13px] mb-1">😌 Rest (30 seconds)</div>
              <div className="text-slate-400 text-[11px] mb-3">All stats +20 · Recover slowly on the couch.</div>
              {!canRest() && (
                <div className="text-slate-600 text-[11px] mb-2">Available again in ~10 minutes</div>
              )}
              {onEnterHouse ? (
                <button
                  onClick={() => { onClose(); setTimeout(() => { onEnterHouse?.('rest') }, 100) }}
                  disabled={busy || !canRest()}
                  className="w-full py-[8px] rounded-lg text-white font-bold text-[13px] cursor-pointer font-body border-0 disabled:opacity-40"
                  style={{ background:'rgba(99,102,241,0.5)' }}>
                  Enter House to Rest
                </button>
              ) : (
                <div className="text-slate-600 text-[11px]">Walk to your house and press E to enter first.</div>
              )}
            </div>

            {/* Sleep card */}
            <div className="rounded-xl"
              style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', padding:'12px 14px' }}>
              <div className="text-violet-400 font-bold text-[13px] mb-1">🌙 Sleep (60 seconds)</div>
              <div className="text-slate-400 text-[11px] mb-3">All stats → 100 · +50 🪙 overnight earnings · Once per 8 hours.</div>
              {!canSleep() && (
                <div className="text-slate-600 text-[11px] mb-2">Already slept recently — available after 8 hours</div>
              )}
              {onEnterHouse ? (
                <button
                  onClick={() => { onClose(); setTimeout(() => { onEnterHouse?.('sleep') }, 100) }}
                  disabled={busy || !canSleep()}
                  className="w-full py-[8px] rounded-lg text-white font-bold text-[13px] cursor-pointer font-body border-0 disabled:opacity-40"
                  style={{ background:'rgba(139,92,246,0.5)' }}>
                  Enter House to Sleep
                </button>
              ) : (
                <div className="text-slate-600 text-[11px]">Walk to your house and press E to enter first.</div>
              )}
            </div>
          </>}

        </div>
      </div>
    </div>
  )
}
