import { useState, useRef, useEffect } from 'react'

function IconMicOn()  {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm-1 1.93A6 6 0 0 1 6 10H4a8 8 0 0 0 7 7.93V20H9v2h6v-2h-2v-2.07A8 8 0 0 0 20 10h-2a6 6 0 0 1-5 5.93z"/>
    </svg>
  )
}
function IconMicOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="m19.5 12-1.5 1.5L16.41 12H15v2h.59L14 15.59V17a5 5 0 0 1-5-5V8.41L7.5 6.91A3 3 0 0 0 9 5V4h3V2h-3A5 5 0 0 0 4 7v5a8 8 0 0 0 10.15 7.71L15.5 21H14v2h6v-2h-2.15l-1.3-1.3A8 8 0 0 0 20 10h-2a6 6 0 0 1-.5 3.5zM12 2a3 3 0 0 1 3 3v3.59L7.41 1A3 3 0 0 1 12 2zM2.81 1.81 1.39 3.22l18 18 1.42-1.42L2.81 1.81z"/>
    </svg>
  )
}

// Position in the right-side button column — slot 3 (0-indexed from top)
// Volume: top 12 | Crowd: top 60 | Voice: top 108 | Profile: top 156
const TOP = 108

export default function VoiceChatUI({
  voiceEnabled, pttMode, localSpeaking, error,
  inputVol, outputVol,
  toggleVoice, togglePttMode,
  setInputVolume, setOutputVolume,
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [showError,    setShowError]    = useState(false)
  const settingsRef  = useRef()
  const errorTimerRef = useRef()

  useEffect(() => {
    if (!error) return
    setShowError(true)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setShowError(false), 6000)
    return () => clearTimeout(errorTimerRef.current)
  }, [error])

  // Close settings popup on outside click
  useEffect(() => {
    if (!showSettings) return
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [showSettings])

  // When voice gets disabled externally, close settings
  useEffect(() => {
    if (!voiceEnabled) setShowSettings(false)
  }, [voiceEnabled])

  const handleMicClick = () => {
    if (!voiceEnabled) {
      // Directly enable voice — this triggers getUserMedia
      toggleVoice()
    } else {
      // Voice is on — show settings
      setShowSettings(s => !s)
    }
  }

  const micColor  = voiceEnabled ? (localSpeaking ? '#22c55e' : '#4ade80') : '#94a3b8'
  const micBg     = voiceEnabled ? 'rgba(74,222,128,0.15)'  : 'rgba(15,10,30,0.82)'
  const micBorder = voiceEnabled
    ? (localSpeaking ? '#22c55e' : 'rgba(74,222,128,0.45)')
    : 'rgba(124,58,237,0.35)'

  return (
    <>
      {/* Error toast */}
      {showError && error && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(239,68,68,0.95)', color: '#fff',
          padding: '10px 18px', borderRadius: 10, zIndex: 600,
          fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 600,
          maxWidth: '85vw', textAlign: 'center',
          boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
          backdropFilter: 'blur(8px)',
        }}>
          {error}
        </div>
      )}

      {/* PTT indicator bar */}
      {voiceEnabled && pttMode && (
        <div style={{
          position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)',
          background: localSpeaking ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.72)',
          color: '#fff', padding: '6px 18px', borderRadius: 20,
          fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
          border: '1px solid rgba(74,222,128,0.4)',
          pointerEvents: 'none', zIndex: 300,
          transition: 'background 0.15s',
        }}>
          {localSpeaking ? '🎙️ Talking…' : 'Hold V to talk'}
        </div>
      )}

      {/* Mic button + settings popup wrapper */}
      <div ref={settingsRef} style={{ position: 'fixed', top: TOP, right: 12, zIndex: 400 }}>

        {/* Settings popup — opens below the button */}
        {showSettings && voiceEnabled && (
          <div style={{
            position: 'absolute', top: 42, right: 0,
            background: 'rgba(8,4,20,0.97)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 12, padding: '12px 14px',
            minWidth: 220,
            fontFamily: 'Nunito, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              color: '#a78bfa', fontSize: 11, fontWeight: 700,
              marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              Voice Chat
            </div>

            {/* PTT toggle */}
            <button
              onClick={togglePttMode}
              style={{
                width: '100%', padding: '8px 0', marginBottom: 8,
                background: pttMode ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pttMode ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                color: pttMode ? '#a78bfa' : '#94a3b8',
                fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {pttMode ? '✓ Push to Talk (V)' : '○ Push to Talk (V)'}
            </button>

            {/* Mic volume */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Mic Volume</div>
              <input
                type="range" min="0" max="1" step="0.05" value={inputVol}
                onChange={e => setInputVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
              />
            </div>

            {/* Speaker volume */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Speaker Volume</div>
              <input
                type="range" min="0" max="1" step="0.05" value={outputVol}
                onChange={e => setOutputVolume(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
              />
            </div>

            {/* Disable voice */}
            <button
              onClick={() => { toggleVoice(); setShowSettings(false) }}
              style={{
                width: '100%', padding: '8px 0',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 8, color: '#f87171',
                fontFamily: 'Nunito, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🔇 Disable Voice
            </button>
          </div>
        )}

        {/* Mic button */}
        <button
          onClick={handleMicClick}
          title={voiceEnabled ? 'Voice on — click for settings' : 'Click to enable voice chat'}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: micBg,
            border: `1.5px solid ${micBorder}`,
            backdropFilter: 'blur(8px)',
            color: micColor, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.2s, color 0.2s, background 0.2s',
            animation: localSpeaking ? 'voicePulse 0.8s ease-in-out infinite' : 'none',
            boxShadow: localSpeaking ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
          }}
        >
          {voiceEnabled ? <IconMicOn /> : <IconMicOff />}
        </button>
      </div>

      <style>{`
        @keyframes voicePulse {
          0%, 100% { box-shadow: 0 0 6px rgba(34,197,94,0.4); }
          50%       { box-shadow: 0 0 18px rgba(34,197,94,0.8); }
        }
      `}</style>
    </>
  )
}
