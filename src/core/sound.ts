type SoundName = 'page' | 'pen' | 'flap' | 'stamp' | 'click' | 'ding'

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  enabled = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
      const len = Math.floor(this.ctx.sampleRate * 0.6)
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.noise = buf
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on) this.ensure()
  }

  play(name: SoundName, opts: { gain?: number } = {}) {
    if (!this.enabled) return
    const ctx = this.ensure()
    if (!ctx || !this.master || !this.noise) return
    const t = ctx.currentTime
    const gain = opts.gain ?? 1

    const noise = (dur: number, type: BiquadFilterType, freq: number, q: number, vol: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol * gain, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      src.connect(f).connect(g).connect(this.master!)
      src.start(t)
      src.stop(t + dur + 0.02)
    }

    const tone = (freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(freq, t)
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol * gain, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(this.master!)
      o.start(t)
      o.stop(t + dur + 0.02)
    }

    switch (name) {
      case 'page':
        noise(0.34, 'bandpass', 1500, 0.6, 0.22)
        noise(0.16, 'highpass', 2800, 0.5, 0.08)
        break
      case 'pen':
        noise(0.07, 'bandpass', 3200, 0.9, 0.12)
        break
      case 'flap':
        tone(320, 0.06, 0.05, 'triangle', -80)
        noise(0.09, 'bandpass', 1800, 1.2, 0.1)
        break
      case 'stamp':
        tone(96, 0.16, 0.2, 'sine', -40)
        noise(0.08, 'lowpass', 700, 0.7, 0.16)
        break
      case 'click':
        tone(760, 0.035, 0.06, 'square')
        break
      case 'ding':
        tone(1046, 0.5, 0.09, 'sine')
        tone(1568, 0.4, 0.05, 'sine')
        break
    }
  }
}

export const sound = new Sound()
