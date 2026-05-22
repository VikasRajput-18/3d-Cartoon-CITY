export default function OnlinePlayersHUD({ onlinePlayers }) {
  if (!onlinePlayers || onlinePlayers.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 140, right: 12, zIndex: 40,
      background: 'rgba(8,4,20,0.82)',
      border: '1px solid rgba(124,58,237,0.25)',
      borderRadius: 8, padding: '5px 10px',
      fontFamily: 'Nunito, sans-serif',
      minWidth: 110,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: onlinePlayers.length ? 4 : 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
          {onlinePlayers.length + 1} online
        </span>
      </div>
      {onlinePlayers.slice(0, 6).map(p => (
        <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 80 }}>
            {p.name}
          </span>
        </div>
      ))}
      {onlinePlayers.length > 6 && (
        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>+{onlinePlayers.length - 6} more</div>
      )}
    </div>
  )
}
