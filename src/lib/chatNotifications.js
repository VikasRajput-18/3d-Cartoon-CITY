// Lightweight pub/sub for new-message notifications across components.
// Publishers: useMultiplayer (DM inserts), GlobalChat (incoming messages).
// Subscribers: Game.jsx (badge counts, toast queue).

const listeners = new Set()

export function onChatNotification(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// type: 'dm' | 'global'
// payload: { fromId, fromName, text }
export function emitChatNotification(type, payload) {
  for (const fn of listeners) {
    try { fn(type, payload) } catch (_) {}
  }
}
