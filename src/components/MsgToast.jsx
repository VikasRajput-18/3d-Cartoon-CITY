import { useEffect, useRef } from 'react'

export default function MsgToast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed bottom-[86px] left-4 z-[700] flex flex-col-reverse gap-2 items-start pointer-events-none max-w-[300px]">
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
      className="flex flex-col gap-1.5 font-body pointer-events-auto w-[280px] rounded-[10px]"
      style={{
        background: 'rgba(8,4,20,0.96)',
        border: `1px solid ${borderColor}`,
        padding: toast.actions ? '8px 12px 10px' : '8px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        cursor: (!toast.actions && toast.onClick) ? 'pointer' : 'default',
        animation: 'toastIn 0.22s ease',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-extrabold mb-0.5" style={{ color: nameColor }}>
            {toast.fromName}
          </div>
          <div className="text-xs text-slate-400 leading-[1.3]">{preview}</div>
        </div>
      </div>

      {/* Action buttons */}
      {toast.actions && (
        <div className="flex gap-1.5 ml-6">
          {toast.actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); a.action() }}
              className="flex-1 py-[5px] text-[11px] font-bold cursor-pointer rounded-[7px]"
              style={{
                background: a.primary ? '#7c3aed' : 'rgba(255,255,255,0.08)',
                border: a.primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
                color: a.primary ? '#fff' : '#94a3b8',
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
