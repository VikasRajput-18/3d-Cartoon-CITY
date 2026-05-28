// Registry of procedural chunk tree positions for ChunkTrees renderer.
// ProceduralChunks writes here; ChunkTrees reads here.
// No React state — plain mutable module so useFrame can write without re-render overhead.

const _trees = new Map()       // chunkKey → [{x, z, s, ry}]
const _listeners = new Set()

function _notify() { _listeners.forEach(fn => fn()) }

/** Register all trees for one chunk (call on chunk load). */
export function registerChunkTrees(key, trees) {
  _trees.set(key, trees)
  _notify()
}

/** Remove all trees for a chunk (call on chunk unload). */
export function unregisterChunkTrees(key) {
  if (!_trees.has(key)) return
  _trees.delete(key)
  _notify()
}

/** Flat list of every active chunk tree — read by ChunkTrees renderer. */
export function getAllChunkTrees() {
  const out = []
  for (const trees of _trees.values()) out.push(...trees)
  return out
}

/** Subscribe to any registration change; returns unsubscribe fn. */
export function onChunkTreeChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
