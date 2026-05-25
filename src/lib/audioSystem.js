// Singleton Web-Audio engine — SFX generated programmatically; bg + rain use real MP3 files.
// Call audioSystem.unlock() on first user interaction (browsers block audio before that).

import { timeWeatherState } from '@/lib/timeWeatherState'

// Road zone detector — used by WorldCanvas to pick footstep variant
export function isOnRoad(x, z) {
  if (Math.abs(z) < 3.2) return true   // main E-W road
  if (Math.abs(x) < 3.2) return true   // main N-S road
  if (Math.abs(Math.abs(x) - 20) < 2.5) return true  // arterial E/W
  if (Math.abs(Math.abs(z) - 20) < 2.5) return true  // arterial N/S
  return false
}

class AudioSystem {
  constructor() {
    this.ctx    = null
    this.master = null
    this._vol   = parseFloat(localStorage.getItem('game_sfx_vol') ?? '0.4')
    this._muted = localStorage.getItem('game_muted') === '1'
    this._ready = false

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

    // Crowd ambient (separate mute)
    this._crowdSrc   = null
    this._crowdGain  = null
    this._crowdLfo   = null
    this._crowdMuted = localStorage.getItem('crowd_muted') === '1'
    this._crowdBaseVol = 0.038

    // Footstep debounce (ctx.currentTime based)
    this._lastStep = -1

    // Cached 3-second noise buffer (reused for all noise-based sounds)
    this._noiseBuf = null

    // ── HTML Audio elements (bg + rain MP3) ──────────────────────────────
    this._bgAudio      = null
    this._rainAudio    = null
    this._bgFadeTimer  = null
    this._rainFadeTimer= null
    this._bgReady      = false   // true once initial 2s fade-in completes
    this._isIndoor     = false
    this._lastRainI    = 0       // last rainIntensity from setRainVolume
    this._bgTargetVol  = parseFloat(localStorage.getItem('game_bg_vol')   ?? '1')
    this._bgMuted      = localStorage.getItem('game_bg_muted') === '1'

    this._preloadHtmlAudio()
  }

  // Preload MP3s immediately so they're buffered before first play
  _preloadHtmlAudio() {
    try {
      this._bgAudio = new Audio('/sounds/bg.mp3')
      this._bgAudio.loop    = true
      this._bgAudio.preload = 'auto'
      this._bgAudio.volume  = 0
    } catch (_) {}
    try {
      this._rainAudio = new Audio('/sounds/rain.mp3')
      this._rainAudio.loop    = true
      this._rainAudio.preload = 'auto'
      this._rainAudio.volume  = 0
    } catch (_) {}
  }

  // Smooth volume fade for an HTML Audio element
  // timerField: string key on `this` holding the setInterval id
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

  // ── Bootstrap ─────────────────────────────────────────────────────────────
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
      this.master.connect(this.ctx.destination)
      this._ready  = true
      this._noiseBuf = this._makeNoise(3)
      this._startAmbience()
      if (this.ctx.state === 'suspended') this.ctx.resume()
    } catch (_) {}
    this._startHtmlAudio()
  }

  _startHtmlAudio() {
    // BG — fade in from 0 to target over 2 seconds
    if (this._bgAudio && this._bgAudio.paused) {
      this._bgAudio.muted = this._bgMuted
      this._bgAudio.play().catch(() => {})
      if (!this._bgMuted) {
        this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', 0, 0.3 * this._bgTargetVol, 2000, () => {
          this._bgReady = true
        })
      } else {
        this._bgReady = true
      }
    }
    // Rain — start silent; setRainVolume drives volume as weather changes
    if (this._rainAudio && this._rainAudio.paused) {
      this._rainAudio.muted = this._bgMuted
      this._rainAudio.volume = 0
      this._rainAudio.play().catch(() => {})
    }
  }

  // ── Volume control ────────────────────────────────────────────────────────
  get volume() { return this._vol }
  get muted()  { return this._muted }
  get ready()  { return this._ready }

  setVolume(v) {
    this._vol = Math.max(0, Math.min(1, v))
    localStorage.setItem('game_sfx_vol', String(this._vol))
    if (this.master && !this._muted)
      this.master.gain.setTargetAtTime(this._vol, this.ctx.currentTime, 0.05)
  }

  toggleMute() {
    this._muted = !this._muted
    localStorage.setItem('game_muted', this._muted ? '1' : '0')
    if (this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setValueAtTime(this._muted ? 0 : this._vol, t)
    }
    // SFX mute only silences the Web Audio graph; bg music has its own control
    return this._muted
  }

  get bgMuted()  { return this._bgMuted }
  get bgVolume() { return this._bgTargetVol }

  toggleBgMute() {
    this._bgMuted = !this._bgMuted
    localStorage.setItem('game_bg_muted', this._bgMuted ? '1' : '0')
    if (this._bgAudio)   this._bgAudio.muted   = this._bgMuted
    if (this._rainAudio) this._rainAudio.muted  = this._bgMuted
    if (!this._bgMuted && this._bgAudio && this._bgReady) {
      this._bgAudio.volume = 0.3 * this._bgTargetVol
    }
    return this._bgMuted
  }

  setBgVolume(v) {
    this._bgTargetVol = Math.max(0, Math.min(1, v))
    localStorage.setItem('game_bg_vol', String(this._bgTargetVol))
    if (this._bgAudio && !this._bgMuted && this._bgReady) {
      this._bgAudio.volume = 0.3 * this._bgTargetVol
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _makeNoise(sec = 1) {
    if (!this.ctx) return null
    const buf  = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  _tone(freq, dur, type = 'sine', vol = 0.22, fadeOut = 0.08) {
    if (!this._ready) return
    const ctx = this.ctx
    const t   = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type; osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.setValueAtTime(vol, t + dur - fadeOut)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g); g.connect(this.master)
    osc.start(t); osc.stop(t + dur + 0.01)
  }

  // ── Footstep ──────────────────────────────────────────────────────────────
  playFootstep(isRoad = false) {
    if (!this._ready) return
    const now = this.ctx.currentTime
    if (now - this._lastStep < 0.34) return
    this._lastStep = now

    const src = this.ctx.createBufferSource()
    src.buffer    = this._noiseBuf
    src.loopStart = (Math.random() * 2.4)
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

    src.connect(bp); bp.connect(g); g.connect(this.master)
    src.start(now); src.stop(now + 0.1)
  }

  // ── Vehicle engine ────────────────────────────────────────────────────────
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

    osc.connect(lp); lp.connect(g); g.connect(this.master)
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

  // ── One-shot interaction sounds ───────────────────────────────────────────
  playEnter() {
    this._tone(880,  0.18, 'sine', 0.18)
    setTimeout(() => this._tone(1108, 0.22, 'sine', 0.14), 110)
  }

  playInteract() {
    this._tone(600, 0.14, 'sine', 0.16)
  }

  playTransition() {
    if (!this._ready) return
    const ctx = this.ctx; const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(180, t)
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.35)
    bp.Q.value = 2.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.38, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    src.connect(bp); bp.connect(g); g.connect(this.master)
    src.start(t); src.stop(t + 0.5)
  }

  playClick() { this._tone(1100, 0.06, 'sine', 0.1, 0.05) }

  playNotification() {
    this._tone(660, 0.14, 'sine', 0.15)
    setTimeout(() => this._tone(880, 0.18, 'sine', 0.12), 120)
  }

  playChime() {
    this._tone(1047, 0.12, 'sine', 0.12)
    setTimeout(() => this._tone(1319, 0.14, 'sine', 0.10), 100)
    setTimeout(() => this._tone(1568, 0.18, 'sine', 0.08), 200)
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
    osc.connect(g); g.connect(this.master)
    osc.start(t); osc.stop(t + 0.03)
  }

  // ── Ambience (birds + crickets + city hum) ────────────────────────────────
  _startAmbience() {
    this._startCityHum()
    this._initBirds()
    this._initCrickets()
    this.startCrowd()
  }

  _startCityHum() {
    const ctx = this.ctx; const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'; osc.frequency.value = 56
    const g = ctx.createGain(); g.gain.value = 0.038
    osc.connect(g); g.connect(this.master)
    osc.start(t)
    this._cityHumGain = g
  }

  _initBirds() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.connect(this.master)
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
    g.connect(this.master)
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

  // Called each frame from DayNightCycle (always outdoors)
  updateAmbience(isNight, rainIntensity, isIndoor) {
    if (!this._ready || this._muted) return
    const t = this.ctx.currentTime
    const birdsTarget    = (!isNight && rainIntensity < 0.35 && !isIndoor) ? 0.55 : 0
    const cricketsTarget = (isNight  && rainIntensity < 0.7  && !isIndoor) ? 0.14 : 0
    const cityTarget     = isIndoor ? 0.01 : 0.038
    this._birdsGain?.gain.setTargetAtTime(birdsTarget,    t, 2.5)
    this._cricketsGain?.gain.setTargetAtTime(cricketsTarget, t, 3)
    this._cityHumGain?.gain.setTargetAtTime(cityTarget,   t, 1)

    // BG audio: slowly drift volume toward night/day target when outdoors
    if (this._bgReady && !this._isIndoor && !this._bgMuted && this._bgAudio) {
      const bgTarget = (isNight ? 0.25 : 0.3) * this._bgTargetVol
      const cur = this._bgAudio.volume
      this._bgAudio.volume = cur + (bgTarget - cur) * 0.005
    }
  }

  // ── Indoor ambient ────────────────────────────────────────────────────────
  startIndoor() {
    if (!this._ready || this._indoorOsc) return
    const ctx = this.ctx; const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'; osc.frequency.value = 120
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.03, t + 1)
    osc.connect(g); g.connect(this.master)
    osc.start(t)
    this._indoorOsc = osc; this._indoorGain = g

    this._isIndoor = true
    // Reduce bg to indoor level
    if (this._bgAudio && this._bgReady && !this._bgMuted)
      this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', this._bgAudio.volume, 0.2 * this._bgTargetVol, 1500)
    // Reduce rain proportionally if it was audible
    if (this._rainAudio && this._rainAudio.volume > 0.01 && !this._bgMuted)
      this._fadeHtmlVol(this._rainAudio, '_rainFadeTimer', this._rainAudio.volume, 0.2, 1500)
  }

  stopIndoor() {
    if (!this._ready || !this._indoorOsc) return
    const t = this.ctx.currentTime
    this._indoorGain?.gain.setTargetAtTime(0, t, 0.5)
    try { this._indoorOsc.stop(t + 2) } catch (_) {}
    this._indoorOsc = null; this._indoorGain = null

    this._isIndoor = false
    // Restore bg to outdoor level
    const bgTarget = (timeWeatherState.isNight ? 0.25 : 0.3) * this._bgTargetVol
    if (this._bgAudio && this._bgReady && !this._bgMuted)
      this._fadeHtmlVol(this._bgAudio, '_bgFadeTimer', this._bgAudio.volume, bgTarget, 1500)
    // Rain volume will be restored naturally by WeatherSystem's setRainVolume calls resuming
  }

  // ── Rain (rain.mp3) ───────────────────────────────────────────────────────
  startRain() {
    // No-op: rain.mp3 is started silently in _startHtmlAudio(); setRainVolume drives volume
  }

  setRainVolume(v) {
    if (!this._rainAudio || this._rainAudio.paused || this._muted) return
    this._lastRainI = v
    // Target: 0.5 when fully raining outdoors, 0 when not raining
    const targetVol = v * 0.5
    // Per-frame lerp ≈ 3s fade at 60fps (0.05 * 60 = 3 frames to halve, ~3s to 95%)
    const cur = this._rainAudio.volume
    this._rainAudio.volume = Math.max(0, Math.min(1, cur + (targetVol - cur) * 0.05))
  }

  // ── Thunder ───────────────────────────────────────────────────────────────
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
    src.connect(lp); lp.connect(g); g.connect(this.master)
    src.start(t); src.stop(t + 2.2)
  }

  // ── Wind ──────────────────────────────────────────────────────────────────
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
    src.connect(bp); bp.connect(g); g.connect(this.master)
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

  // ── Crowd ambient ─────────────────────────────────────────────────────────
  get crowdMuted() { return this._crowdMuted }

  startCrowd() {
    if (!this._ready || this._crowdSrc) return
    const ctx = this.ctx; const t = ctx.currentTime

    const g = ctx.createGain()
    g.gain.value = this._crowdMuted ? 0 : this._crowdBaseVol
    g.connect(this.master)
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
    localStorage.setItem('crowd_muted', this._crowdMuted ? '1' : '0')
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
}

export const audioSystem = new AudioSystem()
