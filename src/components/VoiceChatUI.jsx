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
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[600] font-body text-[13px] font-semibold text-white text-center rounded-[10px] py-[10px] px-[18px] max-w-[85vw] backdrop-blur-sm"
          style={{
            background: 'rgba(239,68,68,0.95)',
            boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
          }}
        >
          {error}
        </div>
      )}

      {/* PTT indicator bar */}
      {voiceEnabled && pttMode && (
        <div
          className="fixed bottom-[120px] left-1/2 -translate-x-1/2 text-white font-mono text-[13px] font-bold rounded-[20px] py-[6px] px-[18px] pointer-events-none z-[300] transition-[background] duration-150"
          style={{
            background: localSpeaking ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.72)',
            border: '1px solid rgba(74,222,128,0.4)',
          }}
        >
          {localSpeaking ? '🎙️ Talking…' : 'Hold V to talk'}
        </div>
      )}

      {/* Mic button + settings popup wrapper */}
      <div ref={settingsRef} className="fixed right-3 z-[400]" style={{ top: TOP }}>

        {/* Settings popup — opens below the button */}
        {showSettings && voiceEnabled && (
          <div
            className="absolute top-[42px] right-0 rounded-xl font-body min-w-[220px] backdrop-blur-[10px]"
            style={{
              background: 'rgba(8,4,20,0.97)',
              border: '1px solid rgba(124,58,237,0.35)',
              padding: '12px 14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            }}
          >
            <div className="text-violet-400 text-[11px] font-bold mb-[10px] uppercase tracking-[1px]">
              Voice Chat
            </div>

            {/* PTT toggle */}
            <button
              onClick={togglePttMode}
              className="w-full py-2 mb-2 rounded-lg text-[13px] font-bold cursor-pointer font-body"
              style={{
                background: pttMode ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${pttMode ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
                color: pttMode ? '#a78bfa' : '#94a3b8',
              }}
            >
              {pttMode ? '✓ Push to Talk (V)' : '○ Push to Talk (V)'}
            </button>

            {/* Mic volume */}
            <div className="mb-[10px]">
              <div className="text-slate-500 text-[11px] mb-1">Mic Volume</div>
              <input
                type="range" min="0" max="1" step="0.05" value={inputVol}
                onChange={e => setInputVolume(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
                style={{ accentColor: '#7c3aed' }}
              />
            </div>

            {/* Speaker volume */}
            <div className="mb-3">
              <div className="text-slate-500 text-[11px] mb-1">Speaker Volume</div>
              <input
                type="range" min="0" max="1" step="0.05" value={outputVol}
                onChange={e => setOutputVolume(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
                style={{ accentColor: '#7c3aed' }}
              />
            </div>

            {/* Disable voice */}
            <button
              onClick={() => { toggleVoice(); setShowSettings(false) }}
              className="w-full py-2 rounded-lg text-red-400 text-[13px] font-bold cursor-pointer font-body"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
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
          className="w-9 h-9 rounded-full backdrop-blur-sm cursor-pointer flex items-center justify-center"
          style={{
            background: micBg,
            border: `1.5px solid ${micBorder}`,
            color: micColor,
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
