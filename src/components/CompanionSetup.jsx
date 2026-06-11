// First-login wizard to create your permanent AI companion: name → personality →
// appearance. Disables game controls while open (it has a text input).
import { useState, useEffect, useRef } from 'react'
import { gameControls } from '@/lib/gameControls'
import {
  PERSONALITIES, OUTFIT_COLORS, SKIN_COLORS, NAME_SUGGESTIONS, createCompanion,
  markCompanionSkipped,
} from '@/lib/companionService'

export default function CompanionSetup({ onDone }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('funny')
  const [outfitColor, setOutfitColor] = useState(OUTFIT_COLORS[0])
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[0])
  const inputRef = useRef(null)

  useEffect(() => { gameControls.enabled = false; return () => { gameControls.enabled = true } }, [])
  useEffect(() => { if (step === 1) inputRef.current?.focus() }, [step])

  const finish = async () => {
    await createCompanion({ name: name.trim() || 'Buddy', personality, outfitColor, skinColor })
    onDone?.()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ width: 'min(94vw, 460px)', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: 17 }}>Meet your AI Companion</div>
          <span style={{ color: '#64748b', fontSize: 12 }}>Step {step}/3</span>
          <button
            onClick={() => { markCompanionSkipped(); onDone?.() }}
            title="Skip — you can create a companion later"
            style={{ background: 'none', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >Skip</button>
        </div>

        <div style={{ padding: 18 }}>
          {step === 1 && (
            <>
              <div style={{ color: '#cbd5e1', fontWeight: 800, marginBottom: 8 }}>Name your companion</div>
              <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => { gameControls.enabled = false }}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') setStep(2) }}
                onKeyUp={e => e.stopPropagation()}
                placeholder="e.g. Max"
                maxLength={16}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 15, outline: 'none' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {NAME_SUGGESTIONS.map(n => (
                  <button key={n} onClick={() => setName(n)} style={{ background: '#1e293b', color: '#7dd3fc', border: 'none', borderRadius: 999, padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ color: '#cbd5e1', fontWeight: 800, marginBottom: 8 }}>Choose a personality</div>
              {PERSONALITIES.map(p => (
                <button key={p.id} onClick={() => setPersonality(p.id)} style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                  background: personality === p.id ? 'rgba(37,99,235,0.25)' : '#1e293b',
                  border: `1.5px solid ${personality === p.id ? '#3b82f6' : 'transparent'}`,
                  borderRadius: 10, padding: 12, cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 26 }}>{p.emoji}</span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 800 }}>{p.label}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{p.desc}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ color: '#cbd5e1', fontWeight: 800, marginBottom: 8 }}>Outfit colour</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {OUTFIT_COLORS.map(c => (
                  <button key={c} onClick={() => setOutfitColor(c)} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: outfitColor === c ? '3px solid #fff' : '2px solid #334155', cursor: 'pointer' }} />
                ))}
              </div>
              <div style={{ color: '#cbd5e1', fontWeight: 800, marginBottom: 8 }}>Skin tone</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SKIN_COLORS.map(c => (
                  <button key={c} onClick={() => setSkinColor(c)} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: skinColor === c ? '3px solid #fff' : '2px solid #334155', cursor: 'pointer' }} />
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: 14, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            style={{ background: '#1e293b', color: '#cbd5e1', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 800, cursor: step === 1 ? 'default' : 'pointer', opacity: step === 1 ? 0.4 : 1 }}>
            Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !name.trim()}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 800, cursor: 'pointer', opacity: step === 1 && !name.trim() ? 0.5 : 1 }}>
              Next
            </button>
          ) : (
            <button onClick={finish} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontWeight: 900, cursor: 'pointer' }}>
              Create {name.trim() || 'Buddy'} 🎉
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
