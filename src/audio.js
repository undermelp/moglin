const MOG_URLS = [
  new URL('../audio/mog0.mp3', import.meta.url).href,
  new URL('../audio/mog1.mp3', import.meta.url).href,
  new URL('../audio/mog2.mp3', import.meta.url).href,
  new URL('../audio/mog3.mp3', import.meta.url).href,
  new URL('../audio/mog4.mp3', import.meta.url).href,
  new URL('../audio/mog5.mp3', import.meta.url).href,
]
const MOG_MAX_DIST = 95
const MOG_MAX_VOL = 0.62
const MOG_MIN_VOL = 0.03
const MOG_CD_MIN = 0.3
const MOG_CD_MAX = 0.87

/** Minor / open cluster — low drones + high keening for an end-times choir. */
const CHOIR_PARTS = [
  { hz: 55.0, type: 'sine', vol: 0.55, form: 420 },
  { hz: 82.41, type: 'sine', vol: 0.4, form: 480 },
  { hz: 110.0, type: 'triangle', vol: 0.34, form: 620 },
  { hz: 130.81, type: 'triangle', vol: 0.3, form: 720 },
  { hz: 164.81, type: 'sine', vol: 0.26, form: 860 },
  { hz: 196.0, type: 'sawtooth', vol: 0.12, form: 980 },
  { hz: 261.63, type: 'sine', vol: 0.22, form: 1100 },
  { hz: 311.13, type: 'sine', vol: 0.2, form: 1400 },
  { hz: 392.0, type: 'sine', vol: 0.18, form: 1650 },
  { hz: 466.16, type: 'triangle', vol: 0.14, form: 1900 },
  { hz: 587.33, type: 'sine', vol: 0.1, form: 2200 },
]
const CHOIR_VOL_MIN = 0.12
const CHOIR_VOL_MAX = 0.38
const CHOIR_CUT_MIN = 1400
const CHOIR_CUT_MAX = 6200

export class Sfx {
  constructor() {
    this.ctx = null
    this.master = null
    this.hurtReady = 0
    this.rainSrc = null
    this.rainGain = null
    this.mogBufs = []
    this.mogLoading = false
    this.mogCd = 0
    this.choirGain = null
    this.choirFilter = null
    this.choirLevel = 0
    this.choirTarget = 0
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.42
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.rain()
    this.choir()
    this.loadMogs()
    return this.ctx
  }

  loadMogs() {
    if (this.mogLoading || this.mogBufs.length || !this.ctx) return
    this.mogLoading = true
    const ctx = this.ctx
    Promise.all(
      MOG_URLS.map((url) =>
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((raw) => ctx.decodeAudioData(raw)),
      ),
    )
      .then((bufs) => {
        this.mogBufs = bufs
        this.mogLoading = false
      })
      .catch(() => {
        this.mogLoading = false
      })
  }

  voices(dt, enemies, px, pz) {
    const ctx = this.ensure()
    if (!ctx || !this.mogBufs.length) return
    this.mogCd -= dt
    if (this.mogCd > 0) return

    this.mogCd = MOG_CD_MIN + Math.random() * (MOG_CD_MAX - MOG_CD_MIN)

    let alive = 0
    for (let i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) alive++
    }
    if (alive === 0) return

    let pick = (Math.random() * alive) | 0
    let enemy = null
    for (let i = 0; i < enemies.length; i++) {
      if (!enemies[i].alive) continue
      if (pick === 0) {
        enemy = enemies[i]
        break
      }
      pick--
    }
    if (!enemy) return

    const dist = Math.hypot(enemy.x - px, enemy.z - pz)
    const volume = Math.max(0, 1 - dist / MOG_MAX_DIST) * MOG_MAX_VOL
    if (volume < MOG_MIN_VOL) return
    this.moglin(volume)
  }

  moglin(volume) {
    const ctx = this.ensure()
    if (!ctx || !this.mogBufs.length) return
    const buf = this.mogBufs[(Math.random() * this.mogBufs.length) | 0]
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = 0.92 + Math.random() * 0.16
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain).connect(this.master)
    src.start()
  }

  rain() {
    const ctx = this.ctx
    if (!ctx || this.rainSrc) return

    const seconds = 3.5
    const length = (ctx.sampleRate * seconds) | 0
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      brown = (brown + white * 0.02) * 0.98
      data[i] = white * 0.55 + brown * 0.45
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true

    const hipass = ctx.createBiquadFilter()
    hipass.type = 'highpass'
    hipass.frequency.value = 420
    hipass.Q.value = 0.5

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1800
    band.Q.value = 0.55

    const gain = ctx.createGain()
    gain.gain.value = 0

    src.connect(hipass).connect(band).connect(gain).connect(this.master)
    src.start()
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1.2)

    this.rainSrc = src
    this.rainGain = gain
  }

  choir() {
    const ctx = this.ctx
    if (!ctx || this.choirGain) return

    const bus = ctx.createGain()
    bus.gain.value = 0

    const cut = ctx.createBiquadFilter()
    cut.type = 'lowpass'
    cut.frequency.value = CHOIR_CUT_MIN
    cut.Q.value = 0.35

    const wet = ctx.createGain()
    wet.gain.value = 0.55
    const dry = ctx.createGain()
    dry.gain.value = 0.7

    const delay = ctx.createDelay(1.2)
    delay.delayTime.value = 0.42
    const feedback = ctx.createGain()
    feedback.gain.value = 0.48
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 2400

    cut.connect(dry).connect(bus)
    cut.connect(delay).connect(damp).connect(wet).connect(bus)
    damp.connect(feedback).connect(delay)
    bus.connect(this.master)

    const t0 = ctx.currentTime
    for (let i = 0; i < CHOIR_PARTS.length; i++) {
      const part = CHOIR_PARTS[i]
      const detune = 1 + ((i % 3) - 1) * 0.0045
      for (let v = 0; v < 2; v++) {
        const osc = ctx.createOscillator()
        osc.type = part.type
        osc.frequency.value = part.hz * detune * (1 + (v - 0.5) * 0.007)

        const form = ctx.createBiquadFilter()
        form.type = 'bandpass'
        form.frequency.value = part.form
        form.Q.value = 2.2 + (i % 4) * 0.35

        const soft = ctx.createBiquadFilter()
        soft.type = 'lowpass'
        soft.frequency.value = part.form * 1.8
        soft.Q.value = 0.5

        const gain = ctx.createGain()
        const breath = 0.12 + (i % 5) * 0.03
        const phase = (i * 0.37 + v * 1.7) % (Math.PI * 2)
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(part.vol * 0.85, t0 + 2.5 + i * 0.12)

        const lfo = ctx.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = 0.04 + breath * 0.08
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = part.vol * 0.28
        lfo.connect(lfoGain).connect(gain.gain)
        lfo.start(t0 + phase * 0.1)

        const drift = ctx.createOscillator()
        drift.type = 'sine'
        drift.frequency.value = 0.015 + (i % 7) * 0.004
        const driftAmt = ctx.createGain()
        driftAmt.gain.value = part.hz * 0.004
        drift.connect(driftAmt).connect(osc.frequency)
        drift.start(t0)

        osc.connect(form).connect(soft).connect(gain).connect(cut)
        osc.start(t0 + i * 0.05)
      }
    }

    this.choirGain = bus
    this.choirFilter = cut
    this.choirLevel = 0
    this.choirTarget = 0.22
    bus.gain.linearRampToValueAtTime(CHOIR_VOL_MIN, t0 + 3.2)
  }

  /** 0–1 tension: denser / brighter / louder as waves mount. */
  swell(dt, wave, threat) {
    if (!this.choirGain || !this.choirFilter) return
    const w = Math.max(0, wave - 1)
    const fromWave = Math.min(1, w / 10)
    const fromThreat = Math.min(1, threat)
    this.choirTarget = 0.18 + fromWave * 0.55 + fromThreat * 0.27

    const k = 1 - Math.exp(-dt * 0.55)
    this.choirLevel += (this.choirTarget - this.choirLevel) * k

    const level = this.choirLevel
    const vol = CHOIR_VOL_MIN + (CHOIR_VOL_MAX - CHOIR_VOL_MIN) * level
    const cut = CHOIR_CUT_MIN + (CHOIR_CUT_MAX - CHOIR_CUT_MIN) * (0.25 + level * 0.75)
    const t = this.ctx.currentTime
    this.choirGain.gain.setTargetAtTime(vol, t, 0.35)
    this.choirFilter.frequency.setTargetAtTime(cut, t, 0.5)
  }

  shot() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(210 + Math.random() * 30, t)
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.11)
    gain.gain.setValueAtTime(0.32, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.13)
    this.burst(0.07, 1400, 0.4)
  }

  smg() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(240 + Math.random() * 35, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.06)
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.08)
    this.burst(0.035, 1600, 0.16)
  }

  plasma() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520 + Math.random() * 80, t)
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.1)
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.13)
    this.burst(0.06, 900, 0.22)
  }

  plasmaBoom(volume = 1) {
    const ctx = this.ensure()
    if (!ctx || volume <= 0.02) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(420 + Math.random() * 60, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.2)
    gain.gain.setValueAtTime(0.26 * volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.24)

    const hum = ctx.createOscillator()
    const humGain = ctx.createGain()
    hum.type = 'sawtooth'
    hum.frequency.setValueAtTime(180 + Math.random() * 40, t)
    hum.frequency.exponentialRampToValueAtTime(55, t + 0.24)
    humGain.gain.setValueAtTime(0.14 * volume, t)
    humGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26)
    hum.connect(humGain).connect(this.master)
    hum.start(t)
    hum.stop(t + 0.28)

    this.burst(0.12, 700, 0.28 * volume)
  }

  lightning() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(920 + Math.random() * 180, t)
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.11)
    gain.gain.setValueAtTime(0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.15)

    const rumble = ctx.createOscillator()
    const rumbleGain = ctx.createGain()
    rumble.type = 'sine'
    rumble.frequency.setValueAtTime(74, t)
    rumble.frequency.exponentialRampToValueAtTime(34, t + 0.32)
    rumbleGain.gain.setValueAtTime(0.2, t)
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34)
    rumble.connect(rumbleGain).connect(this.master)
    rumble.start(t)
    rumble.stop(t + 0.36)
    this.burst(0.08, 2600, 0.3)
  }

  boom() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, t)
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.28)
    gain.gain.setValueAtTime(0.36, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.32)
    this.burst(0.18, 180, 0.45)
  }

  bow() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(180 + Math.random() * 40, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.05)
    gain.gain.setValueAtTime(0.14, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.07)
    this.burst(0.025, 2200, 0.12)
  }

  splash() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const noise = ctx.createBufferSource()
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(900, t)
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.28, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    noise.connect(filter).connect(gain).connect(this.master)
    noise.start(t)
    noise.stop(t + 0.1)
    this.burst(0.05, 420, 0.22)
  }

  dry() {
    this.burst(0.03, 1800, 0.12)
  }

  reload() {
    this.burst(0.04, 900, 0.16)
  }

  rack() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(320, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.06)
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.08)
  }

  hit(head, volume = 1) {
    const ctx = this.ensure()
    if (!ctx || volume <= 0.02) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(head ? 540 : 240, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08)
    gain.gain.setValueAtTime((head ? 0.16 : 0.1) * volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.1)
  }

  hurt() {
    const ctx = this.ensure()
    if (!ctx || ctx.currentTime < this.hurtReady) return
    this.hurtReady = ctx.currentTime + 0.18
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18)
    gain.gain.setValueAtTime(0.28, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.21)
    this.burst(0.12, 240, 0.22)
  }

  wave() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    for (const freq of [196, 294]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 0.45)
      gain.gain.setValueAtTime(0.045, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(gain).connect(this.master)
      osc.start(t)
      osc.stop(t + 0.52)
    }
  }

  slide() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.26)
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.3)
    this.burst(0.2, 480, 0.16)
  }

  hop() {
    this.burst(0.04, 820, 0.07)
  }

  swing() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(210, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08)
    gain.gain.setValueAtTime(0.1, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.1)
    this.burst(0.07, 320, 0.28)
  }

  gem() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(740, t)
    osc.frequency.exponentialRampToValueAtTime(1180, t + 0.07)
    gain.gain.setValueAtTime(0.07, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  chime() {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const parts = [
      { hz: 196.0, type: 'sine', vol: 0.09, form: 720 },
      { hz: 246.94, type: 'triangle', vol: 0.08, form: 900 },
      { hz: 293.66, type: 'sine', vol: 0.1, form: 1100 },
      { hz: 349.23, type: 'sine', vol: 0.085, form: 1400 },
      { hz: 440.0, type: 'triangle', vol: 0.07, form: 1700 },
      { hz: 587.33, type: 'sine', vol: 0.055, form: 2100 },
    ]

    const bus = ctx.createGain()
    bus.gain.value = 1
    const cut = ctx.createBiquadFilter()
    cut.type = 'lowpass'
    cut.frequency.value = 2800
    cut.Q.value = 0.4
    const delay = ctx.createDelay(0.8)
    delay.delayTime.value = 0.28
    const wet = ctx.createGain()
    wet.gain.value = 0.45
    const dry = ctx.createGain()
    dry.gain.value = 0.85
    cut.connect(dry).connect(bus)
    cut.connect(delay).connect(wet).connect(bus)
    bus.connect(this.master)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      for (let v = 0; v < 2; v++) {
        const osc = ctx.createOscillator()
        osc.type = part.type
        osc.frequency.value = part.hz * (1 + (v - 0.5) * 0.008)

        const form = ctx.createBiquadFilter()
        form.type = 'bandpass'
        form.frequency.value = part.form
        form.Q.value = 2.4

        const soft = ctx.createBiquadFilter()
        soft.type = 'lowpass'
        soft.frequency.value = part.form * 1.6
        soft.Q.value = 0.5

        const gain = ctx.createGain()
        const peak = part.vol * (v === 0 ? 1 : 0.7)
        gain.gain.setValueAtTime(0.001, t)
        gain.gain.linearRampToValueAtTime(peak, t + 0.05 + i * 0.012)
        gain.gain.setValueAtTime(peak * 0.85, t + 0.22)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.15)

        osc.connect(form).connect(soft).connect(gain).connect(cut)
        osc.start(t)
        osc.stop(t + 1.2)
      }
    }
  }

  burst(seconds, freq, volume) {
    const ctx = this.ensure()
    if (!ctx) return
    const length = Math.max(1, (ctx.sampleRate * seconds) | 0)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = freq
    const gain = ctx.createGain()
    const t = ctx.currentTime
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t)
  }
}
