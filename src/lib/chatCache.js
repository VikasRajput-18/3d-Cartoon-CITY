// Session-level message cache — survives component unmount/remount within a page session.
// DirectChat: keyed by sorted uid pair.  ChatPanel: keyed by NPC name.

const dmCache   = new Map()   // `${uidA}-${uidB}` (sorted) → Message[]
const npcCache  = new Map()   // npcName → { msgs, hist }

// ── Direct messages ──────────────────────────────────────────────────────────

export function dmKey(a, b) {
  return [a, b].sort().join('-')
}

export function getDmCache(a, b) {
  return dmCache.get(dmKey(a, b)) ?? null
}

export function setDmCache(a, b, messages) {
  dmCache.set(dmKey(a, b), messages)
}

export function appendDmCache(a, b, msg) {
  const key  = dmKey(a, b)
  const prev = dmCache.get(key) ?? []
  dmCache.set(key, [...prev, msg])
}

// ── NPC chat ─────────────────────────────────────────────────────────────────

export function getNpcCache(npcName) {
  return npcCache.get(npcName) ?? null
}

export function setNpcCache(npcName, msgs, hist) {
  npcCache.set(npcName, { msgs, hist })
}
