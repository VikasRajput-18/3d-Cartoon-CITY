// Wardrobe — character customization with a live rotating 3D preview.
// Categories per slot, buy/equip/unequip, colour variants, 3 outfit presets.
// Level-locked items are earned (never bought) and show their unlock level.
import { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useStore } from '@/store'
import Avatar3D from '@/world/Avatar3D'
import Accessories from '@/world/Accessories'
import {
  WARDROBE_CATALOG, SLOTS, itemById, getWardrobe, onWardrobeUpdate,
  buyItem, equipItem, unequipSlot, setItemColor, savePreset, loadPreset,
  itemStatus, playerLevel,
} from '@/lib/wardrobeService'

function PreviewCharacter({ avatar, equipped, colors }) {
  const ref = useRef()
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.6 })
  const items = {}
  for (const [slot, id] of Object.entries(equipped)) {
    if (!id) continue
    const item = itemById(id)
    if (item) items[slot] = { id, color: colors[id] || item.colors[0] }
  }
  return (
    <group ref={ref} position={[0, -0.95, 0]}>
      <Avatar3D externalControl outfit={avatar?.outfit} skin={avatar?.skin} />
      <Accessories items={items} />
    </group>
  )
}

export default function WardrobePanel({ open, onClose }) {
  const avatar = useStore(s => s.avatar)
  const [w, setW] = useState(getWardrobe)
  const [slot, setSlot] = useState('head')
  const [msg, setMsg] = useState('')
  useEffect(() => onWardrobeUpdate(setW), [])
  useEffect(() => { if (open) setMsg('') }, [open])
  if (!open) return null

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2200) }
  const lvl = playerLevel()
  const items = WARDROBE_CATALOG.filter(i => i.slot === slot)
  const equippedId = w.equipped[slot]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(96vw, 720px)', height: 'min(90vh, 560px)', display: 'flex', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden' }}>

        {/* ── Live 3D preview ── */}
        <div style={{ width: 240, flexShrink: 0, background: 'linear-gradient(180deg,#1e2a4a,#0c1322)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <Canvas camera={{ position: [0, 0.35, 2.6], fov: 40 }} gl={{ antialias: true }}>
              <ambientLight intensity={0.85} color="#fff2e0" />
              <directionalLight position={[2, 3, 4]} intensity={1.1} color="#ffe3b8" />
              <PreviewCharacter avatar={avatar} equipped={w.equipped} colors={w.colors} />
            </Canvas>
          </div>
          <div style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
            Lv {lvl} · {avatar?.name}
          </div>
          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, padding: '0 10px 12px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button onClick={() => loadPreset(i)} disabled={!w.presets[i]}
                  style={{ background: w.presets[i] ? '#2563eb' : '#1e293b', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 10, fontWeight: 800, cursor: w.presets[i] ? 'pointer' : 'default', opacity: w.presets[i] ? 1 : 0.45 }}>
                  Outfit {i + 1}
                </button>
                <button onClick={() => { savePreset(i); flash(`Saved Outfit ${i + 1}`) }}
                  style={{ background: 'none', color: '#64748b', border: '1px solid #334155', borderRadius: 6, padding: '2px 0', fontSize: 9, cursor: 'pointer' }}>
                  save
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Catalog ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 16 }}>👕 Wardrobe</div>
            {msg && <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, marginRight: 10 }}>{msg}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>

          {/* Slot tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #1e293b' }}>
            {SLOTS.map(s => (
              <button key={s.id} onClick={() => setSlot(s.id)}
                style={{ padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 800, color: slot === s.id ? '#fff' : '#64748b', borderBottom: slot === s.id ? '2px solid #3b82f6' : '2px solid transparent' }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {equippedId && (
              <button onClick={() => unequipSlot(slot)}
                style={{ marginBottom: 10, background: '#1e293b', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                ✖ Remove {itemById(equippedId)?.label}
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {items.map(item => {
                const status = itemStatus(item)
                const isEq = equippedId === item.id
                const chosen = w.colors[item.id] || item.colors[0]
                return (
                  <div key={item.id} style={{ background: isEq ? 'rgba(37,99,235,0.18)' : '#16213a', border: `1.5px solid ${isEq ? '#3b82f6' : 'transparent'}`, borderRadius: 12, padding: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{item.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: 12 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: status === 'locked' ? '#f87171' : '#94a3b8' }}>
                          {status === 'owned' ? 'Owned' :
                           status === 'earned' ? `🏆 Earned (Lv ${item.levelLock})` :
                           status === 'locked' ? `🔒 Reach Lv ${item.levelLock}` :
                           item.currency === 'gems' ? `💎 ${item.price}` : `🪙 ${item.price}`}
                        </div>
                      </div>
                    </div>
                    {/* colour swatches */}
                    {item.colors.length > 1 && (
                      <div style={{ display: 'flex', gap: 5, margin: '8px 0 0' }}>
                        {item.colors.map(c => (
                          <button key={c} onClick={() => setItemColor(item.id, c)}
                            style={{ width: 18, height: 18, borderRadius: 5, background: c, border: chosen === c ? '2px solid #fff' : '1px solid #334155', cursor: 'pointer' }} />
                        ))}
                      </div>
                    )}
                    <button
                      disabled={status === 'locked' || isEq}
                      onClick={() => {
                        const r = equipItem(item.id)
                        if (!r.ok) flash(r.reason || 'Cannot equip')
                        else if (status === 'buyable') flash(`Bought ${item.label}!`)
                      }}
                      style={{ width: '100%', marginTop: 8, background: isEq ? '#16a34a' : status === 'locked' ? '#1e293b' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 0', fontSize: 11, fontWeight: 800, cursor: status === 'locked' || isEq ? 'default' : 'pointer', opacity: status === 'locked' ? 0.5 : 1 }}>
                      {isEq ? '✓ Equipped' : status === 'owned' || status === 'earned' ? 'Equip' : status === 'locked' ? 'Locked' : 'Buy & Equip'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WardrobeButton({ onClick }) {
  return (
    <button onClick={onClick} title="Wardrobe — customize your look"
      className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
      style={{ background: 'rgba(244,114,182,0.85)', border: '1.5px solid rgba(244,114,182,0.5)', boxShadow: '0 2px 12px rgba(244,114,182,0.4)' }}
    >👕</button>
  )
}
