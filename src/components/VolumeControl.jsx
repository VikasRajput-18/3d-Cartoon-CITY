import { useState, useRef } from 'react'
import { audioSystem } from '@/lib/audioSystem'

export default function VolumeControl() {
  const [vol,   setVol]   = useState(audioSystem.volume)
  const [muted, setMuted] = useState(audioSystem.muted)
  const [open,  setOpen]  = useState(false)
  const hideTimer = useRef(null)

  const icon = muted || vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'

  const keepOpen = () => {
    clearTimeout(hideTimer.current)
  }
  const scheduleClose = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOpen(false), 1200)
  }

  const handleClick = () => {
    audioSystem.unlock()
    if (!open) {
      setOpen(true)
      scheduleClose()
      return
    }
    const m = audioSystem.toggleMute()
    setMuted(m)
    audioSystem.playClick()
  }

  const handleVolChange = (e) => {
    const v = parseFloat(e.target.value)
    setVol(v)
    audioSystem.setVolume(v)
    if (muted && v > 0) {
      audioSystem.toggleMute()
      setMuted(false)
    }
    scheduleClose()
  }

  return (
    <div
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
      style={{
        position: 'fixed', top: 12, right: 12, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'monospace',
      }}
    >
      {/* Slider — slides in when open */}
      {open && (
        <div style={{
          background: 'rgba(8,6,18,0.88)',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 20, padding: '4px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ color: '#94a3b8', fontSize: 10 }}>VOL</span>
          <input
            type="range" min={0} max={1} step={0.02} value={vol}
            onChange={handleVolChange}
            style={{ width: 80, accentColor: '#7c3aed', cursor: 'pointer' }}
          />
          <span style={{ color: '#94a3b8', fontSize: 10, width: 24, textAlign: 'right' }}>
            {Math.round(vol * 100)}
          </span>
        </div>
      )}

      {/* Speaker button */}
      <button
        onClick={handleClick}
        title="Volume (click to mute)"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(8,6,18,0.82)',
          border: '1px solid rgba(124,58,237,0.35)',
          backdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 16,
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        {icon}
      </button>
    </div>
  )
}
