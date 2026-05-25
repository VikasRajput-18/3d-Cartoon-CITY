import { useEffect, useRef } from 'react'

export default function MsgToast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 86, left: 16,
      zIndex: 700, display: 'flex', flexDirection: 'column-reverse', gap: 8,
      alignItems: 'flex-start', pointerEvents: 'none',
      maxWidth: 300,
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef()

  useEffect(() => {
    const duration = toast.duration ?? (toast.actions ? 12000 : 4000)
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timerRef.current)
  }, [toast.id])

  const preview = toast.text
    ? toast.text.slice(0, 80) + (toast.text.length > 80 ? '…' : '')
    : ''

  const isChallenge = toast.type === 'challenge'
  const borderColor = isChallenge
    ? 'rgba(236,72,153,0.5)'
    : toast.type === 'dm'
      ? 'rgba(96,165,250,0.4)'
      : 'rgba(124,58,237,0.4)'
  const nameColor = isChallenge ? '#f9a8d4' : toast.type === 'dm' ? '#60a5fa' : '#a78bfa'
  const icon = isChallenge ? '⚔️' : toast.type === 'dm' ? '💬' : '🌍'

  const handleBodyClick = () => {
    if (toast.actions) return  // don't dismiss on body click if has buttons
    onDismiss(toast.id)
    toast.onClick?.()
  }

  return (
    <div
      onClick={handleBodyClick}
      style={{
        background: 'rgba(8,4,20,0.96)',
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: toast.actions ? '8px 12px 10px' : '8px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
        fontFamily: 'Nunito, sans-serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        cursor: (!toast.actions && toast.onClick) ? 'pointer' : 'default',
        pointerEvents: 'all',
        width: 280,
        animation: 'toastIn 0.22s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: nameColor, marginBottom: 2 }}>
            {toast.fromName}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.3 }}>{preview}</div>
        </div>
      </div>

      {/* Action buttons */}
      {toast.actions && (
        <div style={{ display: 'flex', gap: 6, marginLeft: 24 }}>
          {toast.actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); a.action() }}
              style={{
                flex: 1, padding: '5px 0',
                background: a.primary ? '#7c3aed' : 'rgba(255,255,255,0.08)',
                border: a.primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: 7, color: a.primary ? '#fff' : '#94a3b8',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const toastStyle = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`
