// Singleton Web-Audio engine — all sounds generated programmatically, no external files.
// Call audioSystem.unlock() on first user interaction (browsers block audio before that).

class AudioSystem {
  constructor() {
    this.ctx   = null
    this.master = null
    this._vol  = parseFloat(localStorage.getItem('game_sfx_vol') ?? '0.4')
    this._muted = false
    this._ready = false

    // Persistent looping nodes
    this._engineOsc   = null
    this._engineGain  = null
    this._engineLfo   = null
    this._engineBase  = 60
    this._birdsGain   = null
    this._birdTimer   = null
    this._cricketsGain = null
    this._cricketTimer = null
    this._cityHumGain  = null
    this._indoorOsc    = null
    this._indoorGain   = null
    this._windSrc      = null
    this._windGain     = null
    this._rainSrc      = null
    this._rainGain     = null

    // Footstep debounce (ctx.currentTime based)
    this._lastStep = -1

    // Cached 3-second noise buffer (reused for all noise-based sounds)
    this._noiseBuf = null
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  unlock() {
    if (this._ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
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
    if (this.master)
      this.master.gain.setTargetAtTime(
        this._muted ? 0 : this._vol, this.ctx.currentTime, 0.05,
      )
    return this._muted
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
  playFootstep() {
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
    bp.frequency.value = 180 + Math.random() * 80
    bp.Q.value = 3.5

    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.2, now)
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

    // Wobble LFO
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
    // Two-note ascending chime
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

  // Called each frame from DayNightCycle
  updateAmbience(isNight, rainIntensity, isIndoor) {
    if (!this._ready) return
    const t = this.ctx.currentTime
    const birdsTarget    = (!isNight && rainIntensity < 0.35 && !isIndoor) ? 0.55 : 0
    const cricketsTarget = (isNight  && rainIntensity < 0.7  && !isIndoor) ? 0.14 : 0
    const cityTarget     = isIndoor ? 0.01 : 0.038
    this._birdsGain?.gain.setTargetAtTime(birdsTarget,    t, 2.5)
    this._cricketsGain?.gain.setTargetAtTime(cricketsTarget, t, 3)
    this._cityHumGain?.gain.setTargetAtTime(cityTarget,   t, 1)
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
  }

  stopIndoor() {
    if (!this._ready || !this._indoorOsc) return
    const t = this.ctx.currentTime
    this._indoorGain?.gain.setTargetAtTime(0, t, 0.5)
    try { this._indoorOsc.stop(t + 2) } catch (_) {}
    this._indoorOsc = null; this._indoorGain = null
  }

  // ── Rain ──────────────────────────────────────────────────────────────────
  startRain() {
    if (!this._ready || this._rainSrc) return
    const ctx = this.ctx
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(this.master)
    this._rainGain = g

    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuf; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4
    src.connect(bp); bp.connect(g)
    src.start()
    this._rainSrc = src
  }

  setRainVolume(v) {
    if (!this._ready || !this._rainGain) return
    this._rainGain.gain.setTargetAtTime(v * 0.14, this.ctx.currentTime, 1.2)
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
}

export const audioSystem = new AudioSystem()
