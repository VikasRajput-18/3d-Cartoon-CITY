// Relationship panel — shows your romance status: send/receive roses when single,
// or partner details + navigate + break-up when coupled. Phase 1 of the dating system.
import { useState, useEffect } from 'react'
import {
  getRelationshipState, onRelationshipUpdate,
  acceptRose, declineRose, breakUp, navigateToPartner,
} from '@/lib/relationshipService'

export default function RelationshipPanel({ open, onClose }) {
  const [s, setS] = useState(getRelationshipState)
  const [confirmBreak, setConfirmBreak] = useState(false)
  useEffect(() => onRelationshipUpdate(setS), [])
  useEffect(() => { if (open) setConfirmBreak(false) }, [open])
  if (!open) return null

  const coupled = s.status === 'relationship' && s.partner

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(94vw, 440px)', maxHeight: '88vh', overflowY: 'auto', background: '#1a0f1f', border: '1px solid #6d28d9', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3b1d4d', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>💖</span>
          <div style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 17 }}>Relationships</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 16 }}>
          {coupled ? (
            <>
              <div style={{ textAlign: 'center', background: 'linear-gradient(135deg,#3b1d4d,#5b2333)', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 40 }}>💑</div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, marginTop: 6 }}>
                  You 💗 {s.partner.name}
                </div>
                <div style={{ color: '#f9a8d4', fontSize: 13, marginTop: 4 }}>
                  Together for {s.daysTogether} day{s.daysTogether === 1 ? '' : 's'}
                </div>
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: s.partnerOnline ? '#34d399' : '#94a3b8' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s.partnerOnline ? '#34d399' : '#64748b', display: 'inline-block' }} />
                  {s.partnerOnline ? 'Partner is online now' : 'Partner is offline'}
                </div>
              </div>

              <button
                onClick={() => { const r = navigateToPartner(); if (!r.ok) alert(r.reason); else onClose() }}
                disabled={!s.partnerOnline}
                style={{ width: '100%', marginTop: 14, background: s.partnerOnline ? '#7c3aed' : '#3b1d4d', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontWeight: 800, cursor: s.partnerOnline ? 'pointer' : 'not-allowed', opacity: s.partnerOnline ? 1 : 0.6 }}>
                🧭 Navigate to Partner (free)
              </button>

              {/* Phase 2/3 features — placeholders so the layout is ready */}
              <div style={{ marginTop: 14, background: '#241430', borderRadius: 12, padding: 12, color: '#a78bfa', fontSize: 12 }}>
                💝 Dates, shared piggy bank &amp; gifts are coming soon.
              </div>

              {!confirmBreak ? (
                <button onClick={() => setConfirmBreak(true)}
                  style={{ width: '100%', marginTop: 14, background: 'none', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 10, padding: '10px 0', fontWeight: 800, cursor: 'pointer' }}>
                  💔 Break Up
                </button>
              ) : (
                <div style={{ marginTop: 14, background: '#2a1015', border: '1px solid #7f1d1d', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 700 }}>
                    End your relationship with {s.partner.name}? You'll lose 100 coins and can't date again for 48h.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setConfirmBreak(false)} style={{ flex: 1, background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 800, cursor: 'pointer' }}>Keep</button>
                    <button onClick={() => { breakUp(); setConfirmBreak(false) }} style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 800, cursor: 'pointer' }}>Break Up</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', color: '#e9d5ff', padding: '8px 0 14px' }}>
                <div style={{ fontSize: 40 }}>💔</div>
                <div style={{ fontWeight: 900, fontSize: 16, marginTop: 4 }}>You're single</div>
                {s.onCooldown && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>Heartbreak cooldown active — no new romance for now.</div>}
              </div>

              <div style={{ color: '#c4b5fd', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Roses received</div>
              {s.incomingRoses.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, background: '#241430', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  No roses yet. 🌹
                </div>
              ) : s.incomingRoses.map(r => (
                <div key={r.rowId} style={{ background: '#241430', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🌹</span>
                  <div style={{ flex: 1, color: '#fff', fontSize: 14, fontWeight: 700 }}>{r.fromName} sent you a rose</div>
                  <button onClick={() => acceptRose(r.rowId, r.fromId, r.fromName)} disabled={s.onCooldown}
                    style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 800, cursor: s.onCooldown ? 'not-allowed' : 'pointer', opacity: s.onCooldown ? 0.5 : 1 }}>Accept</button>
                  <button onClick={() => declineRose(r.rowId)}
                    style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 800, cursor: 'pointer' }}>Decline</button>
                </div>
              ))}

              <div style={{ marginTop: 14, color: '#a78bfa', fontSize: 12, textAlign: 'center' }}>
                💡 Walk near someone you like and use their menu → <b>Send Rose</b> (🪙10).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function HeartButton({ onClick, hasRose }) {
  return (
    <button
      onClick={onClick}
      title="Relationships"
      className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0 relative"
      style={{ background: 'rgba(219,39,119,0.85)', border: '1.5px solid rgba(219,39,119,0.5)', boxShadow: '0 2px 12px rgba(219,39,119,0.4)' }}
    >
      💖
      {hasRose && <span style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 999, background: '#f43f5e', border: '2px solid #1a0f1f' }} />}
    </button>
  )
}
