import { useEffect, useRef } from 'react'

export default function MsgToast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 86, left: 16,
      zIndex: 700, display: 'flex', flexDirection: 'column-reverse', gap: 8,
      alignItems: 'flex-start', pointerEvents: 'none',
      maxWidth: 280,
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
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timerRef.current)
  }, [toast.id])

  const preview = toast.text
    ? toast.text.slice(0, 40) + (toast.text.length > 40 ? '…' : '')
    : ''

  const borderColor = toast.type === 'dm'
    ? 'rgba(96,165,250,0.4)'
    : 'rgba(124,58,237,0.4)'
  const nameColor = toast.type === 'dm' ? '#60a5fa' : '#a78bfa'

  return (
    <div
      onClick={() => { onDismiss(toast.id); toast.onClick?.() }}
      style={{
        background: 'rgba(8,4,20,0.95)',
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: '8px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 8,
        fontFamily: 'Nunito, sans-serif',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        cursor: toast.onClick ? 'pointer' : 'default',
        pointerEvents: 'all',
        width: 260,
        animation: 'toastIn 0.22s ease',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>
        {toast.type === 'dm' ? '💬' : '🌍'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: nameColor, marginBottom: 2 }}>
          {toast.fromName}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.3 }}>
          {preview}
        </div>
      </div>
    </div>
  )
}

export const toastStyle = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`
