// Singleton Web-Audio engine.
// bg.mp3 and rain.mp3 use HTML Audio (primary tracks).
// All other sounds are synthesised via Web Audio API.
// Call audioSystem.unlock() on first user interaction.

import { timeWeatherState } from '@/lib/timeWeatherState'

// Road zone detector used by WorldCanvas
export function isOnRoad(x, z) {
  if (Math.abs(z) < 3.2) return true
  if (Math.abs(x) < 3.2) return true
  if (Math.abs(Math.abs(x) - 20) < 2.5) return true
  if (Math.abs(Math.abs(z) - 20) < 2.5) return true
  return false
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_SIMULTANEOUS = 8   // max one-shot sounds playing at once
const CULL_DIST        = 30  // spatial sounds beyond this distance are silent
const LS               = k  => localStorage.getItem('gas_' + k)
const LSS              = (k, v) => localStorage.setItem('gas_' + k, String(v))

// Location proximity sound definitions (match WorldCanvas PLACES positions)
const LOC_DEFS = {
  cafe:   { x: 0,   z: -22, r: 10 },
  arcade: { x: 16,  z: -28, r: 10 },
  park:   { x: -16, z: 18,  r: 10 },
}

// Category default volumes
const CAT_DEFAULTS = { music: 0.7, ambient: 0.75, effects: 0.8, ui: 0.55, vehicles: 0.85 }

// ── Synth music sequences ─────────────────────────────────────────────────────
// [freq_hz, duration_beats]
const BPM_DAY   = 80   // warm city feel
const BPM_NIGHT = 58   // slow lo-fi jazz
const BPM_RAIN  = 50   // calm melancholic

const DAY_SEQ = [
  [261.63, 1], [329.63, 0.75], [392.00, 0.75], [440.00, 1.5],
  [392.00, 0.5], [329.63, 1], [261.63, 0.75], [196.00, 1.25],
  [261.63, 1.5],
]  // C4-E4-G4-A4 pentatonic

const NIGHT_SEQ = [
  [220.00, 2], [261.63, 1.5], [293.66, 2.5],
  [329.63, 3], [293.66, 1], [261.63, 2],
  [220.00, 2],
]  // Am pentatonic, spacious

const RAIN_SEQ = [
  [174.61, 4], [220.00, 3], [261.63, 3],
  [329.63, 4], [261.63, 2], [220.00, 4],
]  // Fmaj7 pad, very slow and sparse

// ── Reverb impulse response generator ────────────────────────────────────────
function makeImpulseResponse(ctx, dur = 1.8, decay = 2.2) {
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

// ── Main class ────────────────────────────────────────────────────────────────
class AudioSystem {
  constructor() {
    this.ctx    = null
    this.master = null   // master gain (controls overall SFX vol)
    this._ready = false

    // Legacy volume fields (kept for backwards compatibility with existing callers)
    this._vol   = parseFloat(LS('sfx_vol') ?? '0.4')
    this._muted = LS('muted') === '1'

    // Per-category volumes + mute states
    this._catVol   = {}
    this._catMuted = {}
    for (const cat of Object.keys(CAT_DEFAULTS)) {
      this._catVol[cat]   = parseFloat(LS('cv_' + cat)   ?? CAT_DEFAULTS[cat])
      this._catMuted[cat] = LS('cm_' + cat) === '1'
    }

    // Category gain nodes (keyed by category name, set up in unlock())
    this._catGains = {}

    // Indoor lowpass filter (muffles all sounds when in building)
    this._indoorFilter = null

    // Reverb (ConvolverNode) — indoor only
    this._convolver     = null
    this._reverbReturn  = null   // gain node returning reverb to destination

    // Active one-shot counter (for MAX_SIMULTANEOUS limit)
    this._activeSoundCount = 0

    // Persistent looping nodes
    this._engineOsc    = null
    this._engineGain   = null
    this._engineLfo    = null
    this._engineBase   = 60
    this._birdsGain    = null
    this._birdTimer    = null
    this._cricketsGain = null
    this._cricketTimer = null
    this._cityHumGain  = null
    this._indoorOsc    = null
    this._indoorGain   = null
    this._windSrc      = null
    this._windGain     = null

    // Crowd
    this._crowdSrc      = null
    this._crowdGain     = null
    this._crowdLfo      = null
    this._crowdMuted    = LS('crowd_muted') === '1'
    this._crowdBaseVol  = 0.038

    // Footstep debounce
    this._lastStep = -1

    // Noise buffer (3s, reused)
    this._noiseBuf = null

    // Synth music
    this._synthTrack   = null   // null | 'day' | 'night' | 'rain'
    this._synthGain    = null
    this._synthLoopTmr = null
    this._synthNextT   = 0
    this._synthFading  = false

    // Location proximity sounds: { gain, panner, src }
    this._locNodes = {}   // keyed by LOC key
    this._locTick  = null

    // Player position (updated via updateLocation each frame)
    this._playerX = 0
    this._playerZ = 0
    this._isIndoor = false

    // Horn debounce
    this._hornLast = 0

    // Ringtone timer
    this._ringTimer = null

    // HTML Audio (bg + rain MP3 — primary tracks)
    this._bgAudio      = null
    this._rainAudio    = null
    this._bgFadeTimer  = null
    this._rainFadeTimer= null
    this._bgReady      = false
    this._lastRainI    = 0
    this._bgTargetVol  = parseFloat(LS('bg_vol')  ?? '1')
    this._bgMuted      = LS('bg_muted') === '1'

    this._preloadHtmlAudio()
  }

  // ── HTML audio preload ──────────────────────────────────────────────────────
  _preloadHtmlAudio() {
    try {
      this._bgAudio        = new Audio('/sounds/bg.mp3')
      this._bgAudio.loop   = true
      this._bgAudio.preload= 'auto'
      this._bgAudio.volume = 0
    } catch (_) {}
    try {
      this._rainAudio        = new Audio('/sounds/rain.mp3')
      this._rainAudio.loop   = true
      this._rainAudio.preload= 'auto'
      this._rainAudio.volume = 0
    } catch (_) {}
  }

  _fadeHtmlVol(audio, timerField, from, to, ms, onDone) {
    if (!audio) return
    if (this[timerField]) { clearInterval(this[timerField]); this[timerField] = null }
    audio.volume = Math.max(0, Math.min(1, from))
    const steps = Math.max(1, Math.ceil(ms / 50))
    const inc   = (to - from) / steps
    let i = 0
    this[timerField] = setInterval(() => {
      i++
      audio.volume = Math.max(0, Math.min(1, from + inc * i))
      if (i >= steps) {
        clearInterval(this[timerField]); this[timerField] = null
        audio.volume = Math.max(0, Math.min(1, to))
        if (onDone) onDone()
      }
    }, 50)
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  unlock() {
    if (this._ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      this._startHtmlAudio()
      return
    }
    try {
      this.ctx    = new (window.AudioContext || window.webkitAudioContext)()
      this.master = this.ctx.createGain()
      this.master.gain.value = this._muted ? 0 : this._vol

      // Indoor lowpass filter in the main signal chain
      this._indoorFilter = this.ctx.createBiquadFilter()
      this._indoorFilter.type = 'lowpass'
      this._indoorFilter.frequency.value = 20000  // fully open (bypass)

      this.master.connect(this._indoorFilter)
      this._indoorFilter.connect(this.ctx.destination)

      // Per-category submix gains → master
      for (const cat of Object.keys(CAT_DEFAULTS)) {
        const g = this.ctx.createGain()
        g.gain.value = this._catMuted[cat] ? 0 : this._catVol[cat]
        g.connect(this.master)
        this._catGains[cat] = g
      }

      // Reverb bus (convolver → reverbReturn → destination)
      const irBuf = makeImpulseResponse(this.ctx)
      this._convolver    = this.ctx.createConvolver()
      this._convolver.buffer = irBuf
      this._reverbReturn = this.ctx.createGain()
      this._reverbReturn.gain.value = 0   // 0 outdoors, ~0.35 indoors
      this._convolver.connect(this._reverbReturn)
      this._reverbReturn.connect(this.ctx.destination)

      // Synth music gain (connected to musicCatGain)
      this._synthGain = this.ctx.createGain()
      this._synthGain.gain.value = 0
      this._synthGain.connect(this._catGains.music)

      this._ready  = true
      this._noiseBuf = this._makeNoise(3)
      this._startAmbience()
      if (this.ctx.state === 'suspended') this.ctx.resume()
    } catch (_) {}
    this._startHtmlAudio()
  }

  _startHtmlAudio() {
    const musicVol = this._catMuted.music ? 0 : this._catVol.music
    if (this._bgAudio && this._bgAudio.paused) {
      this._bgAudio.muted = this._bgMuted
      this._bgAudio.play().catch(() => {})
      if (!this._bgMuted) {
        this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', 0, 0.28 * this._bgTargetVol * musicVol, 2000, () => {
          this._bgReady = true
        })
      } else {
        this._bgReady = true
      }
    }
    if (this._rainAudio && this._rainAudio.paused) {
      this._rainAudio.muted   = this._bgMuted
      this._rainAudio.volume  = 0
      this._rainAudio.play().catch(() => {})
    }
  }

  // ── Master volume (legacy SFX control, maps to overall Web Audio graph) ─────
  get volume() { return this._vol }
  get muted()  { return this._muted }
  get ready()  { return this._ready }

  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, v))
    LSS('sfx_vol', this._vol)
    if (this.master && !this._muted)
      this.master.gain.setTargetAtTime(this._vol, this.ctx.currentTime, 0.05)
  }

  toggleMute() {
    this._muted = !this._muted
    LSS('muted', this._muted ? '1' : '0')
    if (this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setValueAtTime(this._muted ? 0 : this._vol, t)
    }
    return this._muted
  }

  // ── Category volume control ─────────────────────────────────────────────────
  getCategoryVol(cat)   { return this._catVol[cat]   ?? 1 }
  getCategoryMuted(cat) { return this._catMuted[cat] ?? false }

  setCategoryVolume(cat, v) {
    if (!CAT_DEFAULTS[cat]) return
    this._catVol[cat] = Math.max(0, Math.min(1, v))
    LSS('cv_' + cat, this._catVol[cat])
    if (this._catGains[cat] && !this._catMuted[cat])
      this._catGains[cat].gain.setTargetAtTime(this._catVol[cat], this.ctx?.currentTime ?? 0, 0.05)
    // Keep bg.mp3 volume in sync with music category
    if (cat === 'music' && this._bgReady && !this._bgMuted && this._bgAudio)
      this._bgAudio.volume = 0.28 * this._bgTargetVol * this._catVol.music
  }

  toggleCategoryMute(cat) {
    if (!CAT_DEFAULTS[cat]) return false
    this._catMuted[cat] = !this._catMuted[cat]
    LSS('cm_' + cat, this._catMuted[cat] ? '1' : '0')
    if (this._catGains[cat]) {
      const val = this._catMuted[cat] ? 0 : this._catVol[cat]
      this._catGains[cat].gain.setTargetAtTime(val, this.ctx?.currentTime ?? 0, 0.05)
    }
    if (cat === 'music' && this._bgAudio) this._bgAudio.muted = this._catMuted.music || this._bgMuted
    return this._catMuted[cat]
  }

  // ── BG music (HTML Audio) ───────────────────────────────────────────────────
  get bgMuted()  { return this._bgMuted }
  get bgVolume() { return this._bgTargetVol }

  toggleBgMute() {
    this._bgMuted = !this._bgMuted
    LSS('bg_muted', this._bgMuted ? '1' : '0')
    if (this._bgAudio)   this._bgAudio.muted   = this._bgMuted
    if (this._rainAudio) this._rainAudio.muted  = this._bgMuted
    if (!this._bgMuted && this._bgAudio && this._bgReady)
      this._bgAudio.volume = 0.28 * this._bgTargetVol * (this._catMuted.music ? 0 : this._catVol.music)
    return this._bgMuted
  }

  setBgVolume(v) {
    this._bgTargetVol = Math.max(0, Math.min(1, v))
    LSS('bg_vol', this._bgTargetVol)
    if (this._bgAudio && !this._bgMuted && this._bgReady)
      this._bgAudio.volume = 0.28 * this._bgTargetVol * (this._catMuted.music ? 0 : this._catVol.music)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  _makeNoise(sec = 1) {
    if (!this.ctx) return null
    const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  // Play a tone through the given category
  _tone(freq, dur, type = 'sine', vol = 0.22, fadeOut = 0.08, cat = 'effects') {
    if (!this._ready || this._activeSoundCount >= MAX_SIMULTANEOUS) return
    const ctx = this.ctx
    const t   = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type; osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.setValueAtTime(vol, t + dur - fadeOut)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(this._catGains[cat] || this.master)
    osc.start(t); osc.stop(t + dur + 0.01)
    this._activeSoundCount++
    setTimeout(() => this._activeSoundCount--, (dur + 0.05) * 1000)
  }

  // Play a note (for synth music) — bypasses the simultaneous limit
  _musicNote(freq, startT, dur, vol, type = 'sine', vibrato = false) {
    if (!this._ready || !this._synthGain) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type  = type
    osc.frequency.value = freq

    if (vibrato) {
      const lfo  = ctx.createOscillator()
      lfo.frequency.value = 5.2
      const lg = ctx.createGain()
      lg.gain.value = freq * 0.010
      lfo.connect(lg); lg.connect(osc.frequency)
      lfo.start(startT); lfo.stop(startT + dur + 0.05)
    }

    const g = ctx.createGain()
    const att = Math.min(0.12, dur * 0.18)
    const rel = Math.min(0.2,  dur * 0.28)
    g.gain.setValueAtTime(0, startT)
    g.gain.linearRampToValueAtTime(vol, startT + att)
    g.gain.setValueAtTime(vol, startT + dur - rel)
    g.gain.exponentialRampToValueAtTime(0.0001, startT + dur)

    osc.connect(g)
    g.connect(this._synthGain)
    osc.start(startT)
    osc.stop(startT + dur + 0.02)
  }

  // ── Footstep ─────────────────────────────────────────────────────────────────
  playFootstep(isRoad = false) {
    if (!this._ready) return
    const now = this.ctx.currentTime
    if (now - this._lastStep < 0.34) return
    this._lastStep = now

    const src = this.ctx.createBufferSource()
    src.buffer    = this._noiseBuf
    src.loopStart = Math.random() * 2.4
    src.loopEnd   = src.loopStart + 0.055
    src.loop      = true

    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = isRoad ? 340 + Math.random() * 80 : 150 + Math.random() * 60
    bp.Q.value = isRoad ? 4.5 : 3.0

    const vol = isRoad ? 0.18 : 0.24
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    src.connect(bp); bp.connect(g)
    g.connect(this._catGains.effects || this.master)
    src.start(now); src.stop(now + 0.1)
  }

  // ── NPC ambient sounds ────────────────────────────────────────────────────────
  playNpcAmbient(npcX, npcZ) {
    if (!this._ready || this._activeSoundCount >= MAX_SIMULTANEOUS) return
    const dx   = npcX - this._playerX
    const dz   = npcZ - this._playerZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > CULL_DIST * 0.6) return   // only very nearby NPCs

    const vol = Math.max(0, (1 - dist / (CULL_DIST * 0.6)) * 0.07)
    if (Math.random() < 0.5) {
      // soft footstep clunk
      this.playFootstep(true)
    } else {
      // very soft hum tone
      this._tone(280 + Math.random() * 120, 0.18, 'sine', vol * 0.4, 0.1, 'ambient')
    }
  }

  // ── Vehicle engine ────────────────────────────────────────────────────────────
  startEngine(type) {
    if (!this._ready) return
    this.stopEngine()
    const ctx  = this.ctx
    const t    = ctx.currentTime
    const base = type === 'bike' ? 90 : 58

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base, t)

    const lfo  = ctx.createOscillator()
    lfo.frequency.value = 6
    const lfog = ctx.createGain()
    lfog.gain.value = 4
    lfo.connect(lfog); lfog.connect(osc.frequency)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 260

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + 0.5)

    osc.connect(lp); lp.connect(g)
    g.connect(this._catGains.vehicles || this.master)
    osc.start(t); lfo.start(t)

    this._engineOsc  = osc
    this._engineGain = g
    this._engineLfo  = lfo
    this._engineBase = base
  }

  updateEngine(speed, maxSpeed) {
    if (!this._engineOsc || !this.ctx) return
    const frac = Math.min(1, Math.abs(speed) / maxSpeed)
    const t    = this.ctx.currentTime
    this._engineOsc.frequency.setTargetAtTime(
      this._engineBase * (1 + frac * 2.5), t, 0.12,
    )
    this._engineGain.gain.setTargetAtTime(0.05 + frac * 0.09, t, 0.1)
  }

  stopEngine() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this._engineGain?.gain.setTargetAtTime(0, t, 0.3)
    try { this._engineOsc?.stop(t + 1.2) } catch (_) {}
    try { this._engineLfo?.stop(t + 1.2) } catch (_) {}
    this._engineOsc = null; this._engineGain = null; this._engineLfo = null
  }

  // Vehicle horn — short satisfying beep
  playHorn(type = 'car') {
    if (!this._ready) return
    const now = Date.now()
    if (now - this._hornLast < 600) return
    this._hornLast = now
    if (type === 'bike') {
      this._tone(880, 0.22, 'sine', 0.35, 0.08, 'vehicles')
      setTimeout(() => this._tone(1100, 0.15, 'sine', 0.28, 0.07, 'vehicles'), 160)
    } else {
      this._tone(280, 0.28, 'sine', 0.42, 0.1, 'vehicles')
      setTimeout(() => this._tone(352, 0.22, 'sine', 0.38, 0.08, 'vehicles'), 180)
    }
  }

  // Brake screech — short white-noise squeal
  playBrake() {
    if (!this._ready || this._activeSoundCount >= MAX_SIMULTANEOUS) return
    const ctx = this.ctx; const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf
    src.loopStart = 0.5; src.loopEnd = 1.5; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.38, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    src.connect(bp); bp.connect(g)
    g.connect(this._catGains.vehicles || this.master)
    src.start(t); src.stop(t + 0.4)
    this._activeSoundCount++
    setTimeout(() => this._activeSoundCount--, 450)
  }

  // ── Interaction one-shots ─────────────────────────────────────────────────────
  playEnter() {
    // Building enter — upward whoosh
    if (!this._ready || this._activeSoundCount >= MAX_SIMULTANEOUS) return
    const ctx = this.ctx; const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(180, t)
    bp.frequency.exponentialRampToValueAtTime(2800, t + 0.38)
    bp.Q.value = 1.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.32, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
    src.connect(bp); bp.connect(g)
    g.connect(this._catGains.effects || this.master)
    src.start(t); src.stop(t + 0.45)
    this._activeSoundCount++
    setTimeout(() => this._activeSoundCount--, 500)
  }

  playExit() {
    // Building exit — downward whoosh
    if (!this._ready || this._activeSoundCount >= MAX_SIMULTANEOUS) return
    const ctx = this.ctx; const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(2800, t)
    bp.frequency.exponentialRampToValueAtTime(180, t + 0.38)
    bp.Q.value = 1.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.28, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
    src.connect(bp); bp.connect(g)
    g.connect(this._catGains.effects || this.master)
    src.start(t); src.stop(t + 0.45)
    this._activeSoundCount++
    setTimeout(() => this._activeSoundCount--, 500)
  }

  playInteract() {
    // F key — soft distinct click
    this._tone(520, 0.11, 'sine', 0.14, 0.06, 'effects')
    setTimeout(() => this._tone(680, 0.08, 'sine', 0.10, 0.05, 'effects'), 70)
  }

  playInteractE() {
    // E key — different soft click
    this._tone(720, 0.09, 'sine', 0.13, 0.06, 'effects')
  }

  playTransition() {
    // Generic transition (kept for compatibility — same as enter whoosh)
    this.playEnter()
  }

  playClick() {
    // UI click — satisfying soft click
    this._tone(1100, 0.06, 'sine', 0.1, 0.05, 'ui')
  }

  playUIHover() {
    // Very subtle tick on hover
    this._tone(1800, 0.028, 'sine', 0.028, 0.02, 'ui')
  }

  playPanelOpen() {
    this._tone(660, 0.08, 'sine', 0.09, 0.05, 'ui')
    setTimeout(() => this._tone(880, 0.10, 'sine', 0.07, 0.06, 'ui'), 60)
  }

  playPanelClose() {
    this._tone(880, 0.06, 'sine', 0.07, 0.04, 'ui')
    setTimeout(() => this._tone(660, 0.09, 'sine', 0.06, 0.06, 'ui'), 50)
  }

  playError() {
    // Low thud
    this._tone(120, 0.22, 'triangle', 0.22, 0.15, 'ui')
  }

  playSuccess() {
    this._tone(880, 0.1, 'sine', 0.13, 0.07, 'ui')
    setTimeout(() => this._tone(1100, 0.12, 'sine', 0.11, 0.08, 'ui'), 80)
  }

  playNotification() {
    this._tone(660, 0.14, 'sine', 0.15, 0.08, 'effects')
    setTimeout(() => this._tone(880, 0.18, 'sine', 0.12, 0.09, 'effects'), 120)
  }

  playChime() {
    // Chat message received
    this._tone(1047, 0.12, 'sine', 0.12, 0.08, 'effects')
    setTimeout(() => this._tone(1319, 0.14, 'sine', 0.10, 0.09, 'effects'), 100)
    setTimeout(() => this._tone(1568, 0.18, 'sine', 0.08, 0.10, 'effects'), 200)
  }

  playChatSent() {
    // Soft pop on send
    this._tone(660, 0.07, 'sine', 0.09, 0.05, 'effects')
  }

  playTyping() {
    if (!this._ready) return
    const ctx = this.ctx; const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 900 + Math.random() * 500
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.032, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.025)
    osc.connect(g); g.connect(this._catGains.ui || this.master)
    osc.start(t); osc.stop(t + 0.03)
  }

  // ── Mission / reward sounds ───────────────────────────────────────────────────
  playMissionComplete() {
    if (!this._ready) return
    // Triumphant 3-note jingle
    this._tone(523.25, 0.18, 'sine', 0.3, 0.08, 'effects')
    setTimeout(() => this._tone(659.25, 0.18, 'sine', 0.28, 0.08, 'effects'), 160)
    setTimeout(() => this._tone(783.99, 0.35, 'sine', 0.32, 0.15, 'effects'), 320)
    setTimeout(() => this._tone(1046.5, 0.45, 'sine', 0.28, 0.2,  'effects'), 500)
  }

  playCoinsEarned() {
    if (!this._ready) return
    // Coin collect chime — bright ascending ding
    const freqs = [880, 1109, 1319]
    freqs.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.14, 'sine', 0.22, 0.08, 'effects'), i * 70)
    })
  }

  playLevelUp() {
    if (!this._ready) return
    // Exciting fanfare
    const seq = [523.25, 659.25, 783.99, 523.25, 659.25, 1046.5]
    const durs = [0.15,   0.15,   0.15,   0.15,   0.15,   0.55]
    let t = 0
    seq.forEach((f, i) => {
      setTimeout(() => this._tone(f, durs[i], 'sine', 0.28 + (i === 5 ? 0.06 : 0), 0.08, 'effects'), t)
      t += durs[i] * 1000 * 0.85
    })
  }

  playBossAppear() {
    if (!this._ready) return
    // Dramatic low boom
    const ctx = this.ctx; const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._makeNoise(1.5)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 100
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.9, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4)
    src.connect(lp); lp.connect(g)
    g.connect(this._catGains.effects || this.master)
    src.start(now); src.stop(now + 1.5)
    // Alert tone on top
    setTimeout(() => {
      this._tone(180, 0.6, 'sawtooth', 0.18, 0.3, 'effects')
      setTimeout(() => this._tone(160, 0.8, 'sawtooth', 0.22, 0.4, 'effects'), 400)
    }, 200)
  }

  playBossDefeated() {
    if (!this._ready) return
    // Victory fanfare
    const seq = [392, 523.25, 659.25, 783.99, 1046.5]
    const durs = [0.2, 0.2,    0.2,    0.2,    0.65]
    let t = 0
    seq.forEach((f, i) => {
      setTimeout(() => this._tone(f, durs[i], 'sine', 0.3, 0.08, 'effects'), t)
      t += durs[i] * 900
    })
  }

  // ── Ambience (city hum, birds, crickets) ─────────────────────────────────────
  _startAmbience() {
    this._startCityHum()
    this._initBirds()
    this._initCrickets()
    this.startCrowd()
    this._startLocationSounds()
  }

  _startCityHum() {
    const ctx = this.ctx; const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'; osc.frequency.value = 56
    const g = ctx.createGain(); g.gain.value = 0.038
    osc.connect(g)
    g.connect(this._catGains.ambient || this.master)
    osc.start(t)
    this._cityHumGain = g
  }

  _initBirds() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.connect(this._catGains.ambient || this.master)
    this._birdsGain = g

    const chirp = () => {
      if (!this._birdsGain) return
      const ctx = this.ctx; const t = ctx.currentTime
      const f = 2400 + Math.random() * 900
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, t)
      osc.frequency.linearRampToValueAtTime(f * 1.28, t + 0.06)
      osc.frequency.linearRampToValueAtTime(f, t + 0.13)
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0, t)
      cg.gain.linearRampToValueAtTime(0.45, t + 0.02)
      cg.gain.setValueAtTime(0.45, t + 0.08)
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
      osc.connect(cg); cg.connect(g)
      osc.start(t); osc.stop(t + 0.18)
    }

    const schedule = () => {
      if (!this._birdsGain) return
      chirp()
      if (Math.random() < 0.45) setTimeout(chirp, 70 + Math.random() * 120)
      this._birdTimer = setTimeout(schedule, 1800 + Math.random() * 3500)
    }
    schedule()
  }

  _initCrickets() {
    const ctx = this.ctx
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(this._catGains.ambient || this.master)
    this._cricketsGain = g

    const chirp = () => {
      if (!this._cricketsGain) return
      const t = ctx.currentTime
      const f = 3700 + Math.random() * 400
      const osc = ctx.createOscillator()
      osc.type = 'sine'; osc.frequency.value = f
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0, t)
      cg.gain.linearRampToValueAtTime(0.55, t + 0.008)
      cg.gain.setValueAtTime(0.55, t + 0.025)
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.048)
      osc.connect(cg); cg.connect(g)
      osc.start(t); osc.stop(t + 0.055)
    }

    const schedule = () => {
      if (!this._cricketsGain) return
      const count = 3 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) setTimeout(chirp, i * 52 + Math.random() * 18)
      this._cricketTimer = setTimeout(schedule, 380 + Math.random() * 620)
    }
    schedule()
  }

  // ── Location proximity sounds ─────────────────────────────────────────────────
  _startLocationSounds() {
    for (const [key, def] of Object.entries(LOC_DEFS)) {
      const g = this.ctx.createGain()
      g.gain.value = 0
      g.connect(this._catGains.ambient || this.master)
      this._locNodes[key] = { gain: g, src: null, seqTimer: null }
      this._startLocLoop(key)
    }
    // Update gains every 200ms based on player position
    this._locTick = setInterval(() => this._updateLocGains(), 200)
  }

  _startLocLoop(key) {
    const node = this._locNodes[key]
    if (!node) return
    const schedule = () => {
      if (!this._locNodes[key]) return
      const ctx = this.ctx
      if (key === 'cafe') {
        // Coffee shop chatter: bandpass-filtered noise bursts with gentle background hum
        const t = ctx.currentTime
        const src = ctx.createBufferSource()
        src.buffer = this._noiseBuf; src.loop = true
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 300; bp.Q.value = 0.7
        src.connect(bp); bp.connect(node.gain)
        src.start(t)
        if (node.src) { try { node.src.stop() } catch (_) {} }
        node.src = src
        // Occasional clink sound
        const clinkT = 2 + Math.random() * 4
        node.seqTimer = setTimeout(() => {
          this._tone(2800 + Math.random() * 400, 0.12, 'sine', 0.12, 0.09, 'ambient')
          schedule()
        }, clinkT * 1000)
      } else if (key === 'arcade') {
        // Arcade: electronic blips and bleeps
        const blipFreqs = [440, 523, 659, 784, 880, 1047]
        const f = blipFreqs[Math.floor(Math.random() * blipFreqs.length)]
        this._tone(f, 0.08, 'square', 0.08, 0.05, 'ambient')
        const next = 0.5 + Math.random() * 1.5
        node.seqTimer = setTimeout(schedule, next * 1000)
        // Continuous noise background
        if (!node.src) {
          const t = ctx.currentTime
          const src = ctx.createBufferSource()
          src.buffer = this._noiseBuf; src.loop = true
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5
          const sg = ctx.createGain(); sg.gain.value = 0.4
          src.connect(bp); bp.connect(sg); sg.connect(node.gain)
          src.start(t)
          node.src = src
        }
      } else if (key === 'park') {
        // Park: soft leaves rustle + occasional bird chirp
        const t = ctx.currentTime
        const src = ctx.createBufferSource()
        src.buffer = this._noiseBuf; src.loop = true
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'; bp.frequency.value = 800 + Math.random() * 200; bp.Q.value = 0.4
        const sg = ctx.createGain(); sg.gain.value = 0.3
        src.connect(bp); bp.connect(sg); sg.connect(node.gain)
        if (node.src) { try { node.src.stop() } catch (_) {} }
        node.src = src
        src.start(t)
        const nextBird = 3 + Math.random() * 5
        node.seqTimer = setTimeout(() => {
          this._tone(2600 + Math.random() * 700, 0.15, 'sine', 0.15, 0.08, 'ambient')
          schedule()
        }, nextBird * 1000)
      }
    }
    schedule()
  }

  _updateLocGains() {
    if (!this._ready) return
    const px = this._playerX, pz = this._playerZ
    for (const [key, def] of Object.entries(LOC_DEFS)) {
      const node = this._locNodes[key]
      if (!node) continue
      const dist = Math.sqrt((px - def.x) ** 2 + (pz - def.z) ** 2)
      // Fade in from r*0.8 down to r*0.1 (fully audible at close range)
      let t_gain = this._isIndoor ? 0 : Math.max(0, 1 - (dist - def.r * 0.15) / (def.r * 0.85))
      t_gain *= 0.22   // overall scale so it stays subtle
      if (!this._catMuted.ambient) {
        node.gain.gain.setTargetAtTime(t_gain, this.ctx.currentTime, 0.5)
      } else {
        node.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
      }
    }
  }

  // Called from DayNightCycle and WorldCanvas each frame
  updateAmbience(isNight, rainIntensity, isIndoor, hour = -1) {
    if (!this._ready || this._muted) return
    const t = this.ctx.currentTime
    const birdsTarget    = (!isNight && rainIntensity < 0.35 && !isIndoor) ? 0.55 : 0
    const cricketsTarget = (isNight  && rainIntensity < 0.7  && !isIndoor) ? 0.14 : 0
    const cityTarget     = isIndoor ? 0.01 : 0.038
    this._birdsGain?.gain.setTargetAtTime(birdsTarget,    t, 2.5)
    this._cricketsGain?.gain.setTargetAtTime(cricketsTarget, t, 3)
    this._cityHumGain?.gain.setTargetAtTime(cityTarget,   t, 1)

    // Night time: hushed overall sound mix (ambient category quieter)
    const nightMod = isNight ? 0.65 : 1.0
    const rainMod  = rainIntensity > 0.5 ? 0.8 : 1.0
    if (this._catGains.ambient && !this._catMuted.ambient) {
      const targetAmbVol = this._catVol.ambient * nightMod * rainMod
      this._catGains.ambient.gain.setTargetAtTime(targetAmbVol, t, 3)
    }

    // Synth music track selection
    if (hour >= 0) this._updateSynthTrack(isNight, rainIntensity)

    // BG audio level (night is quieter)
    if (this._bgReady && !this._isIndoor && !this._bgMuted && this._bgAudio) {
      const musicVol = this._catMuted.music ? 0 : this._catVol.music
      const bgBase   = isNight ? 0.20 : (rainIntensity > 0.5 ? 0.22 : 0.28)
      const cur      = this._bgAudio.volume
      const tgt      = bgBase * this._bgTargetVol * musicVol
      this._bgAudio.volume = cur + (tgt - cur) * 0.005
    }
  }

  // Update player position for spatial sound calculations
  updateLocation(playerX, playerZ, isIndoor) {
    this._playerX  = playerX
    this._playerZ  = playerZ
    this._isIndoor = isIndoor
  }

  // ── Indoor ambience ───────────────────────────────────────────────────────────
  startIndoor() {
    if (!this._ready || this._indoorOsc) return
    const ctx = this.ctx; const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'; osc.frequency.value = 120
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.03, t + 1)
    osc.connect(g)
    g.connect(this._catGains.ambient || this.master)
    osc.start(t)
    this._indoorOsc = osc; this._indoorGain = g
    this._isIndoor = true

    // Muffle all outdoor sounds — lowpass at 900Hz
    this._indoorFilter?.frequency.setTargetAtTime(900, t, 0.8)
    // Enable reverb
    if (this._reverbReturn) this._reverbReturn.gain.setTargetAtTime(0.32, t, 1.0)

    if (this._bgAudio && this._bgReady && !this._bgMuted)
      this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', this._bgAudio.volume, 0.18 * this._bgTargetVol, 1500)
    if (this._rainAudio && this._rainAudio.volume > 0.01 && !this._bgMuted)
      this._fadeHtmlVol(this._rainAudio, '_rainFadeTimer', this._rainAudio.volume, 0.18, 1500)
    // Stop location sounds (they sound weird indoors)
    for (const node of Object.values(this._locNodes))
      node.gain.gain.setTargetAtTime(0, t, 0.3)
  }

  stopIndoor() {
    if (!this._ready || !this._indoorOsc) return
    const t = this.ctx.currentTime
    this._indoorGain?.gain.setTargetAtTime(0, t, 0.5)
    try { this._indoorOsc.stop(t + 2) } catch (_) {}
    this._indoorOsc = null; this._indoorGain = null
    this._isIndoor = false

    // Restore open-air sound chain
    this._indoorFilter?.frequency.setTargetAtTime(20000, t, 1.0)
    if (this._reverbReturn) this._reverbReturn.gain.setTargetAtTime(0, t, 1.2)

    const musicVol = this._catMuted.music ? 0 : this._catVol.music
    const bgTarget = (timeWeatherState.isNight ? 0.20 : 0.28) * this._bgTargetVol * musicVol
    if (this._bgAudio && this._bgReady && !this._bgMuted)
      this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', this._bgAudio.volume, bgTarget, 1500)
  }

  // ── Rain (rain.mp3) ───────────────────────────────────────────────────────────
  startRain() { /* rain.mp3 driven entirely by setRainVolume */ }

  setRainVolume(v) {
    if (!this._rainAudio || this._rainAudio.paused || this._bgMuted) return
    this._lastRainI = v
    const ambVol   = this._catMuted.ambient ? 0 : this._catVol.ambient
    const targetVol = v * 0.5 * ambVol
    const cur = this._rainAudio.volume
    this._rainAudio.volume = Math.max(0, Math.min(1, cur + (targetVol - cur) * 0.05))
  }

  // ── Thunder ───────────────────────────────────────────────────────────────────
  playThunder() {
    if (!this._ready) return
    const ctx = this.ctx; const t = ctx.currentTime
    const buf = this._makeNoise(2.2)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 160
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.85, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.1)
    src.connect(lp); lp.connect(g)
    g.connect(this._catGains.ambient || this.master)
    src.start(t); src.stop(t + 2.2)
  }

  // ── Wind ──────────────────────────────────────────────────────────────────────
  startWind() {
    if (!this._ready || this._windSrc) return
    const ctx = this.ctx; const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.55
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.11, t + 3)
    src.connect(bp); bp.connect(g)
    g.connect(this._catGains.ambient || this.master)
    src.start(t)
    this._windSrc = src; this._windGain = g
  }

  setWindVolume(v) {
    if (!this._ready || !this._windGain) return
    this._windGain.gain.setTargetAtTime(v * 0.11, this.ctx.currentTime, 1)
  }

  stopWind() {
    if (!this._ready || !this._windSrc) return
    const t = this.ctx.currentTime
    this._windGain?.gain.setTargetAtTime(0, t, 1.5)
    try { this._windSrc.stop(t + 5) } catch (_) {}
    this._windSrc = null; this._windGain = null
  }

  // ── Crowd ambient ─────────────────────────────────────────────────────────────
  get crowdMuted() { return this._crowdMuted }

  startCrowd() {
    if (!this._ready || this._crowdSrc) return
    const ctx = this.ctx; const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.value = this._crowdMuted ? 0 : this._crowdBaseVol
    g.connect(this._catGains.ambient || this.master)
    this._crowdGain = g

    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6
    src.connect(bp); bp.connect(g)
    src.start(t)
    this._crowdSrc = src

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.22
    const lfog = ctx.createGain()
    lfog.gain.value = this._crowdBaseVol * 0.4
    lfo.connect(lfog); lfog.connect(g.gain)
    lfo.start(t)
    this._crowdLfo = lfo
  }

  toggleCrowdMute() {
    this._crowdMuted = !this._crowdMuted
    LSS('crowd_muted', this._crowdMuted ? '1' : '0')
    if (this._crowdGain)
      this._crowdGain.gain.setTargetAtTime(
        this._crowdMuted ? 0 : this._crowdBaseVol, this.ctx.currentTime, 0.3,
      )
    return this._crowdMuted
  }

  setCrowdIndoor(isIndoor) {
    if (!this._crowdGain || this._crowdMuted) return
    const target = isIndoor ? this._crowdBaseVol * 1.6 : this._crowdBaseVol
    this._crowdGain.gain.setTargetAtTime(target, this.ctx.currentTime, 1.5)
  }

  // ── Synthesised music tracks ──────────────────────────────────────────────────
  _updateSynthTrack(isNight, rainI) {
    let desired = 'day'
    if (rainI > 0.4)  desired = 'rain'
    else if (isNight) desired = 'night'

    if (desired === this._synthTrack) return
    this._switchSynthTrack(desired)
  }

  _switchSynthTrack(track) {
    if (this._synthFading) return
    this._synthFading = true
    const prevTrack = this._synthTrack
    this._synthTrack = track

    // Clear any pending loop
    if (this._synthLoopTmr) { clearTimeout(this._synthLoopTmr); this._synthLoopTmr = null }
    this._synthNextT = 0

    if (!this._synthGain || !this._ready) { this._synthFading = false; return }
    const ctx = this.ctx
    const t   = ctx.currentTime

    // Fade out current synth track
    this._synthGain.gain.setTargetAtTime(0, t, 1.2)

    // Fade in new track after 3 seconds
    setTimeout(() => {
      this._synthFading = false
      if (!this._ready || this._synthTrack !== track) return
      this._synthGain.gain.setTargetAtTime(0.14, ctx.currentTime, 1.5)
      this._runSynthLoop(track)
    }, 3000)
  }

  _runSynthLoop(track) {
    if (!this._ready || this._synthTrack !== track) return

    const ctx  = this.ctx
    const now  = ctx.currentTime
    const startT = Math.max(now, this._synthNextT || now)

    let seq, bpm, bassNote
    if (track === 'day') {
      seq = DAY_SEQ; bpm = BPM_DAY; bassNote = 65.41  // C2
    } else if (track === 'night') {
      seq = NIGHT_SEQ; bpm = BPM_NIGHT; bassNote = 55.0  // A1
    } else {
      seq = RAIN_SEQ; bpm = BPM_RAIN; bassNote = 43.65  // F1
    }

    const beatDur  = 60 / bpm
    let   cursor   = startT

    // Schedule one full sequence
    for (const [freq, beats] of seq) {
      const dur = beats * beatDur
      const vol = track === 'rain' ? 0.065 : track === 'night' ? 0.08 : 0.07
      this._musicNote(freq, cursor, dur * 0.88, vol, 'sine', track !== 'rain')
      // Bass note every 2 beats
      if (beats >= 2 || Math.random() < 0.35) {
        this._musicNote(bassNote, cursor, Math.min(dur * 0.7, beatDur * 1.5), vol * 0.55, 'triangle')
      }
      cursor += dur
    }

    // Rain track: add sustained chord pad underneath
    if (track === 'rain') {
      const padFreqs = [174.61, 220.00, 261.63, 329.63]
      const totalDur = cursor - startT
      padFreqs.forEach((f, i) => {
        this._musicNote(f, startT + i * 0.15, totalDur * 0.9, 0.038, 'sine')
      })
    }

    this._synthNextT = cursor
    // Schedule next loop 0.5s before the current one ends
    const loopIn = Math.max(200, (cursor - ctx.currentTime - 0.5) * 1000)
    this._synthLoopTmr = setTimeout(() => this._runSynthLoop(track), loopIn)
  }

  // ── Phone ringtone ────────────────────────────────────────────────────────────
  playRingtone() {
    if (!this._ready || this._ringTimer) return
    const ring = () => {
      if (!this._ready) return
      const ctx = this.ctx; const t = ctx.currentTime
      // Two alternating tones: dring-dring pattern
      const tones = [[880, 0.12], [1100, 0.12], [880, 0.12], [1100, 0.12]]
      let offset = 0
      for (const [f, dur] of tones) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'; osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t + offset)
        g.gain.linearRampToValueAtTime(0.35, t + offset + 0.01)
        g.gain.setValueAtTime(0.35, t + offset + dur - 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + dur)
        osc.connect(g); g.connect(this._catGains.ui || this.master)
        osc.start(t + offset); osc.stop(t + offset + dur + 0.01)
        offset += dur
      }
      this._ringTimer = setTimeout(ring, 1600)
    }
    ring()
  }

  stopRingtone() {
    if (this._ringTimer) { clearTimeout(this._ringTimer); this._ringTimer = null }
  }
}

export const audioSystem = new AudioSystem()
