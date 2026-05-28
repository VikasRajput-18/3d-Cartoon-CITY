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
      className="fixed top-[60px] right-3 z-[200] w-9 h-9 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-sm transition-colors duration-200"
      style={{
        background: 'rgba(15,10,30,0.82)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        fontSize: 16,
        color: muted ? '#64748b' : '#a78bfa',
      }}
    >
      {muted ? '🔇' : '💬'}
    </button>
  )
}
