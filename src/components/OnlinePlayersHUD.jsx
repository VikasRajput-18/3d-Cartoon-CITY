export default function OnlinePlayersHUD({ onlinePlayers, mutePlayer, unmutePlayer, isPlayerMuted }) {
  if (!onlinePlayers || onlinePlayers.length === 0) return null

  return (
    <div
      className="fixed top-[106px] right-3 z-40 rounded-lg font-body"
      style={{
        background: 'rgba(8,4,20,0.82)',
        border: '1px solid rgba(124,58,237,0.25)',
        padding: '5px 10px',
        minWidth: 120,
      }}
    >
      <div className={`flex items-center gap-[6px] ${onlinePlayers.length ? 'mb-1' : ''}`}>
        <div className="w-[7px] h-[7px] rounded-full bg-green-400" style={{ boxShadow: '0 0 4px #4ade80' }} />
        <span className="font-bold text-slate-400" style={{ fontSize: 11 }}>
          {onlinePlayers.length + 1} online
        </span>
      </div>
      {onlinePlayers.slice(0, 6).map(p => {
        const muted = isPlayerMuted ? isPlayerMuted(p.uid) : false
        return (
          <div key={p.uid} className="flex items-center gap-[5px] mt-0.5">
            <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: '#60a5fa' }} />
            <span className="overflow-hidden whitespace-nowrap truncate text-slate-500" style={{ fontSize: 10, maxWidth: 68 }}>
              {p.name}
            </span>
            {p.voice_enabled && (
              <span title="Voice chat on" className="shrink-0 leading-none" style={{ fontSize: 9 }}>🎤</span>
            )}
            {(mutePlayer || unmutePlayer) && (
              <button
                title={muted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                onClick={() => muted ? unmutePlayer(p.uid) : mutePlayer(p.uid)}
                className="cursor-pointer shrink-0 leading-none p-0"
                style={{
                  background: 'none', border: 'none',
                  fontSize: 9,
                  color: muted ? '#ef4444' : '#475569',
                  opacity: muted ? 1 : 0.5,
                }}
              >
                {muted ? '🔇' : '🔊'}
              </button>
            )}
          </div>
        )
      })}
      {onlinePlayers.length > 6 && (
        <div className="text-slate-600 mt-0.5" style={{ fontSize: 10 }}>+{onlinePlayers.length - 6} more</div>
      )}
    </div>
  )
}
