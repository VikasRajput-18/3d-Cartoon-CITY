import { useState, useRef } from 'react'
import { audioSystem } from '@/lib/audioSystem'

export default function VolumeControl() {
  const [vol,   setVol]   = useState(audioSystem.volume)
  const [muted, setMuted] = useState(audioSystem.muted)
  const [open,  setOpen]  = useState(false)
  const hideTimer = useRef(null)

  const icon = muted || vol === 0 ? '🔇' : vol < 0.4 ? '🔉' : '🔊'

  const keepOpen    = () => clearTimeout(hideTimer.current)
  const scheduleClose = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOpen(false), 1200)
  }

  const handleClick = () => {
    audioSystem.unlock()
    if (!open) { setOpen(true); scheduleClose(); return }
    setMuted(audioSystem.toggleMute())
    audioSystem.playClick()
  }

  const handleVolChange = (e) => {
    const v = parseFloat(e.target.value)
    setVol(v)
    audioSystem.setVolume(v)
    if (muted && v > 0) { audioSystem.toggleMute(); setMuted(false) }
    scheduleClose()
  }

  return (
    <div
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
      className="fixed top-3 right-3 z-[200] flex items-center gap-2 font-mono"
    >
      {open && (
        <div
          className="flex items-center gap-2 backdrop-blur-sm"
          style={{
            background: 'rgba(8,6,18,0.88)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 20, padding: '4px 12px',
          }}
        >
          <span className="text-slate-400" style={{ fontSize: 10 }}>VOL</span>
          <input
            type="range" min={0} max={1} step={0.02} value={vol}
            onChange={handleVolChange}
            className="w-20 cursor-pointer"
            style={{ accentColor: '#7c3aed' }}
          />
          <span className="text-slate-400 text-right" style={{ fontSize: 10, width: 24 }}>
            {Math.round(vol * 100)}
          </span>
        </div>
      )}

      <button
        onClick={handleClick}
        title="Volume (click to mute)"
        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-sm text-white transition-[border-color] duration-150"
        style={{
          background: 'rgba(8,6,18,0.82)',
          border: '1px solid rgba(124,58,237,0.35)',
          fontSize: 16,
        }}
      >
        {icon}
      </button>
    </div>
  )
}
