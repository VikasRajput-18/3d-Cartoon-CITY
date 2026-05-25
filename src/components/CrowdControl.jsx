import { useState } from 'react'
import { audioSystem } from '@/lib/audioSystem'

export default function CrowdControl() {
  const [muted, setMuted] = useState(() => audioSystem.crowdMuted)

  const toggle = () => {
    audioSystem.unlock()
    setMuted(audioSystem.toggleCrowdMute())
  }

  return (
    <button
      onClick={toggle}
      title={muted ? 'Unmute crowd' : 'Mute crowd'}
      style={{
        position: 'fixed', top: 60, right: 12, zIndex: 200,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(15,10,30,0.82)', border: '1.5px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(8px)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: muted ? '#64748b' : '#a78bfa',
        transition: 'color 0.2s',
      }}
    >
      {muted ? '🔇' : '💬'}
    </button>
  )
}
