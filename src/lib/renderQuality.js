// Global render-quality flags shared between the auto-quality controller and the
// post-processing component. Plain mutable object + pub/sub (no React re-render cost).
export const isMobileDevice =
  typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0

export const renderQuality = {
  bloom:   !isMobileDevice,   // post-processing bloom (desktop only by default)
  postFx:  !isMobileDevice,   // whole post-processing stack
  listeners: new Set(),
}

function _emit() { renderQuality.listeners.forEach(fn => fn(renderQuality)) }

export function onQualityChange(fn) {
  renderQuality.listeners.add(fn)
  return () => renderQuality.listeners.delete(fn)
}

export function setBloom(on) {
  if (renderQuality.bloom === on) return
  renderQuality.bloom = on
  _emit()
}

export function setPostFx(on) {
  if (renderQuality.postFx === on) return
  renderQuality.postFx = on
  _emit()
}
