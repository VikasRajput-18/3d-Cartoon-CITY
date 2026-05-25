import { useState, useRef, useEffect } from 'react'
import { audioSystem } from '@/lib/audioSystem'

const CATEGORIES = [
  { key: 'music',    label: 'Music',       icon: '🎵' },
  { key: 'ambient',  label: 'Ambience',    icon: '🌿' },
  { key: 'effects',  label: 'Effects',     icon: '✨' },
  { key: 'ui',       label: 'UI Sounds',   icon: '🔔' },
  { key: 'vehicles', label: 'Vehicles',    icon: '🚗' },
]

export default function AudioPanel({
  voiceEnabled, pttMode, localSpeaking, error,
  inputVol, outputVol,
  toggleVoice, togglePttMode,
  setInputVolume, setOutputVolume,
}) {
  const [open,     setOpen]     = useState(false)
  const [sfxMuted, setSfxMuted] = useState(() => audioSystem.muted)
  const [sfxVol,   setSfxVol]   = useState(() => audioSystem.volume)
  const [bgMuted,  setBgMuted]  = useState(() => audioSystem.bgMuted)
  const [bgVol,    setBgVol]    = useState(() => audioSystem.bgVolume)

  // Per-category state
  const [catVols,  setCatVols]  = useState(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.key, audioSystem.getCategoryVol(c.key)]))
  )
  const [catMuted, setCatMuted] = useState(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.key, audioSystem.getCategoryMuted(c.key)]))
  )

  const panelRef = useRef()

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const toggleSfx    = () => setSfxMuted(audioSystem.toggleMute())
  const changeSfxVol = (v) => { audioSystem.setVolume(v); setSfxVol(v) }
  const toggleBg     = () => setBgMuted(audioSystem.toggleBgMute())
  const changeBgVol  = (v) => { audioSystem.setBgVolume(v); setBgVol(v) }

  const toggleCatMute = (cat) => {
    const next = audioSystem.toggleCategoryMute(cat)
    setCatMuted(prev => ({ ...prev, [cat]: next }))
  }
  const changeCatVol = (cat, v) => {
    audioSystem.setCategoryVolume(cat, v)
    setCatVols(prev => ({ ...prev, [cat]: v }))
  }

  const isSpeaking  = voiceEnabled && localSpeaking
  const borderColor = isSpeaking
    ? '#22c55e'
    : open
      ? 'rgba(124,58,237,0.7)'
      : 'rgba(255,255,255,0.15)'

  return (
    <div ref={panelRef} style={{ position: 'fixed', top: 12, right: 12, zIndex: 400 }}>

      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0,
          width: 268,
          background: 'rgba(8,4,20,0.97)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 12, padding: '14px 16px',
          fontFamily: 'Nunito, sans-serif',
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
          backdropFilter: 'blur(10px)',
          maxHeight: '80vh', overflowY: 'auto',
        }}>

          {/* Header */}
          <div style={{
            color: '#a78bfa', fontSize: 11, fontWeight: 800,
            marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Audio Settings
          </div>

          {/* Master SFX volume */}
          <AudioRow
            label="Master Volume"
            muted={sfxMuted}
            onToggle={toggleSfx}
            vol={sfxVol}
            onVol={changeSfxVol}
          />

          {/* Background music HTML audio volume */}
          <AudioRow
            label="BG Music (MP3)"
            muted={bgMuted}
            onToggle={toggleBg}
            vol={bgVol}
            onVol={changeBgVol}
          />

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '8px 0 10px' }} />
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Sound Categories
          </div>

          {/* Per-category rows */}
          {CATEGORIES.map(({ key, label, icon }) => (
            <CategoryRow
              key={key}
              icon={icon}
              label={label}
              muted={catMuted[key]}
              onToggle={() => toggleCatMute(key)}
              vol={catVols[key]}
              onVol={(v) => changeCatVol(key, v)}
            />
          ))}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '10px 0 12px' }} />

          {/* Voice Chat */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: voiceEnabled || error ? 10 : 0 }}>
            <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>Voice Chat</span>
            <button
              onClick={toggleVoice}
              style={{
                background: voiceEnabled ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${voiceEnabled ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 6, padding: '4px 14px',
                color: voiceEnabled ? '#4ade80' : '#94a3b8',
                fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {voiceEnabled ? 'On' : 'Enable'}
            </button>
          </div>

          {error && (
            <div style={{ color: '#f87171', fontSize: 11, marginBottom: 8, lineHeight: 1.35 }}>
              {error}
            </div>
          )}

          {voiceEnabled && (
            <>
              <button
                onClick={togglePttMode}
                style={{
                  width: '100%', padding: '7px 0', marginBottom: 10,
                  background: pttMode ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${pttMode ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 8,
                  color: pttMode ? '#a78bfa' : '#94a3b8',
                  fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {pttMode ? '✓ Push to Talk (hold V)' : '○ Open Mic'}
              </button>

              <SliderRow label="Mic Volume"   value={inputVol}  onChange={e => setInputVolume(parseFloat(e.target.value))} />
              <SliderRow label="Voice Volume" value={outputVol} onChange={e => setOutputVolume(parseFloat(e.target.value))} />

              {pttMode && (
                <div style={{
                  padding: '5px 10px', borderRadius: 8, textAlign: 'center',
                  background: localSpeaking ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(74,222,128,0.25)',
                  color: localSpeaking ? '#4ade80' : '#475569',
                  fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                  marginBottom: 10,
                }}>
                  {localSpeaking ? '🎙️ Talking…' : 'Hold V to talk'}
                </div>
              )}

              <button
                onClick={() => { toggleVoice(); setOpen(false) }}
                style={{
                  width: '100%', padding: '7px 0',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: 8, color: '#f87171',
                  fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                🔇 Disable Voice
              </button>
            </>
          )}
        </div>
      )}

      {/* Speaker button */}
      <button
        onClick={() => { audioSystem.unlock(); setOpen(s => !s) }}
        title="Audio Settings"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: open ? 'rgba(124,58,237,0.2)' : 'rgba(15,10,30,0.82)',
          border: `1.5px solid ${borderColor}`,
          backdropFilter: 'blur(8px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.2s, background 0.2s',
          boxShadow: isSpeaking ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
          animation: isSpeaking ? 'audioPulse 0.8s ease-in-out infinite' : 'none',
        }}
      >
        <SpeakerIcon muted={sfxMuted} voiceActive={voiceEnabled} speaking={isSpeaking} />
      </button>

      <style>{`
        @keyframes audioPulse {
          0%, 100% { box-shadow: 0 0 6px rgba(34,197,94,0.4); }
          50%       { box-shadow: 0 0 18px rgba(34,197,94,0.8); }
        }
      `}</style>
    </div>
  )
}

function AudioRow({ label, muted, onToggle, vol, onVol }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}>{label}</span>
        <ToggleBtn on={!muted} onToggle={onToggle} />
      </div>
      {!muted && (
        <input
          type="range" min="0" max="1" step="0.05" value={vol}
          onChange={e => onVol(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
        />
      )}
    </div>
  )
}

function CategoryRow({ icon, label, muted, onToggle, vol, onVol }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
          <span style={{ marginRight: 5, fontSize: 12 }}>{icon}</span>{label}
        </span>
        <ToggleBtn on={!muted} onToggle={onToggle} small />
      </div>
      {!muted && (
        <input
          type="range" min="0" max="1" step="0.05" value={vol}
          onChange={e => onVol(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#6d28d9', cursor: 'pointer', height: 3 }}
        />
      )}
    </div>
  )
}

function SliderRow({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#64748b', fontSize: 11, marginBottom: 3 }}>{label}</div>
      <input
        type="range" min="0" max="1" step="0.05" value={value}
        onChange={onChange}
        style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
      />
    </div>
  )
}

function ToggleBtn({ on, onToggle, small }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: on ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
        border: `1px solid ${on ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)'}`,
        borderRadius: 6, padding: small ? '2px 8px' : '3px 10px',
        color: on ? '#4ade80' : '#f87171',
        fontFamily: 'Nunito, sans-serif', fontSize: small ? 10 : 11, fontWeight: 700, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {on ? 'On' : 'Off'}
    </button>
  )
}

function SpeakerIcon({ muted, voiceActive, speaking }) {
  const color = voiceActive
    ? (speaking ? '#22c55e' : '#4ade80')
    : (muted ? '#475569' : '#94a3b8')

  if (muted) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  )
}
