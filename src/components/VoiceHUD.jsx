// Always-visible proximity-voice controls. Sits on top of the existing useVoiceChat
// system: enable mic (one-time permission + privacy notice), self-mute toggle,
// whisper (Shift+V, range 3u) and megaphone (range 100u, costs coins) modes.
import { useState, useEffect } from 'react'

const PRIVACY_KEY = 'clu3d_voice_privacy_seen'

export default function VoiceHUD({ voice }) {
  const [notice, setNotice] = useState(false)
  const [toast, setToast]   = useState('')

  // Show the privacy notice the first time voice is enabled.
  useEffect(() => {
    if (voice.voiceEnabled && !localStorage.getItem(PRIVACY_KEY)) {
      setNotice(true)
      try { localStorage.setItem(PRIVACY_KEY, '1') } catch {}
      const t = setTimeout(() => setNotice(false), 6000)
      return () => clearTimeout(t)
    }
  }, [voice.voiceEnabled])

  const flash = (text) => { setToast(text); setTimeout(() => setToast(''), 2500) }

  const onMega = () => {
    const r = voice.activateMegaphone()
    if (!r.ok) flash(r.reason)
  }

  const mode = voice.voiceMode
  return (
    <div style={{ position: 'fixed', left: 12, bottom: 96, zIndex: 470, fontFamily: 'Nunito, sans-serif', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {notice && (
        <div style={{ maxWidth: 230, background: 'rgba(8,8,16,0.92)', border: '1px solid #334155', borderRadius: 10, padding: '8px 12px', color: '#cbd5e1', fontSize: 12 }}>
          🔒 Voice chat is <b>live & peer-to-peer</b>. No recording. Players near you can hear you.
          <button onClick={() => setNotice(false)} style={{ display: 'block', marginTop: 6, color: '#7dd3fc', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Got it</button>
        </div>
      )}

      {toast && (
        <div style={{ background: 'rgba(234,179,8,0.95)', color: '#000', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 800 }}>{toast}</div>
      )}

      {!voice.voiceEnabled ? (
        <button
          onClick={voice.toggleVoice}
          title="Enable proximity voice — players near you can hear you"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(34,197,94,0.85)', border: '1.5px solid rgba(34,197,94,0.5)', color: '#fff', borderRadius: 999, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          🎤 Enable Voice
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Mic mute toggle */}
          <button
            onClick={voice.toggleSelfMute}
            title={voice.selfMuted ? 'Unmute mic' : 'Mute mic (proximity voice)'}
            className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center border-0"
            style={{ background: voice.selfMuted ? 'rgba(239,68,68,0.85)' : 'rgba(34,197,94,0.85)', border: `1.5px solid ${voice.selfMuted ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}` }}
          >
            {voice.selfMuted ? '🔇' : '🎤'}
          </button>

          {/* Whisper toggle (Shift+V) */}
          <button
            onClick={voice.toggleWhisper}
            title="Whisper mode (Shift+V) — only players within 3 units hear you"
            className="w-[42px] h-[42px] rounded-xl cursor-pointer text-lg flex items-center justify-center border-0"
            style={{ background: mode === 'whisper' ? 'rgba(99,102,241,0.9)' : 'rgba(30,41,59,0.85)', border: '1.5px solid rgba(99,102,241,0.4)' }}
          >🤫</button>

          {/* Megaphone (costs coins, 30s, range 100) */}
          <button
            onClick={onMega}
            title="Megaphone — broadcast to 100 units for 30s (costs coins)"
            className="w-[42px] h-[42px] rounded-xl cursor-pointer text-lg flex items-center justify-center border-0"
            style={{ background: mode === 'megaphone' ? 'rgba(234,179,8,0.95)' : 'rgba(30,41,59,0.85)', border: '1.5px solid rgba(234,179,8,0.4)' }}
          >📢</button>
        </div>
      )}
    </div>
  )
}
