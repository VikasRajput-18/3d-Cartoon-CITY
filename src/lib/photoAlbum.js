// Companion photo album — captures a downscaled snapshot of the 3D canvas and
// stores up to 20 photos (with caption/location/date) in localStorage. Capture
// works because the Canvas is created with preserveDrawingBuffer:true.

let _uid = null
let _photos = []
const _key = () => `photos_${_uid}`

export function initPhotoAlbum(uid) {
  _uid = uid
  try { _photos = JSON.parse(localStorage.getItem(_key()) || '[]') } catch { _photos = [] }
}
export function getPhotos() { return [..._photos] }
export function deletePhoto(index) {
  if (index < 0 || index >= _photos.length) return
  _photos.splice(index, 1)
  try { localStorage.setItem(_key(), JSON.stringify(_photos)) } catch {}
}

/** Grab a downscaled JPEG of the current 3D canvas (≈480px wide). */
export function capturePhoto() {
  const canvas = document.querySelector('canvas')
  if (!canvas || !canvas.width) return null
  try {
    const w = 480, h = Math.max(1, Math.round(480 * canvas.height / canvas.width))
    const off = document.createElement('canvas')
    off.width = w; off.height = h
    off.getContext('2d').drawImage(canvas, 0, 0, w, h)
    return off.toDataURL('image/jpeg', 0.72)
  } catch { return null }
}

export function addPhoto({ dataUrl, caption, location, playerName }) {
  _photos.unshift({ dataUrl, caption, location, playerName, date: new Date().toLocaleDateString() })
  if (_photos.length > 20) _photos = _photos.slice(0, 20)
  try { localStorage.setItem(_key(), JSON.stringify(_photos)) } catch {}
}

const CAPTIONS = [
  'Yaar ke saath best time', 'City life is good', 'Challenge accepted and won',
  'Companion squad goals', 'Yeh sheher, yeh dosti', 'Picture perfect, kya?',
]
export function autoCaption(location) {
  const c = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]
  return location ? `${c} — ${location}` : c
}
