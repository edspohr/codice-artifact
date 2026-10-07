// Experimental, behind SOUND_ENABLED (0 by default, always 0 in tests).
// Touching is playing a note: one sustained note per contact, low in Mar,
// airier toward the top. Web Audio only, no files. Unlocked by the first
// touch on the epigraph.
import { config } from '../gestures/config'

export class Sound {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private osc2: OscillatorNode | null = null
  private gain: GainNode | null = null

  get enabled() {
    return config.SOUND_ENABLED > 0
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.enabled || this.ctx) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    void this.ctx.resume()
  }

  /** `height` 0 = bottom of the territory, 1 = top. */
  noteOn(height: number) {
    if (!this.enabled) return
    this.unlock()
    const ctx = this.ctx
    if (!ctx) return
    this.noteOff(true)
    const base = config.SOUND_BASE_HZ
    const freq = base * Math.pow(2, Math.max(0, Math.min(1, height)) * 1.5)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = freq * 1.005
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400 + 1800 * height
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, config.SOUND_GAIN), ctx.currentTime + 0.35)
    osc.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc2.start()
    this.osc = osc
    this.osc2 = osc2
    this.gain = gain
  }

  noteOff(quick = false) {
    const ctx = this.ctx
    const gain = this.gain
    const osc = this.osc
    const osc2 = this.osc2
    this.osc = null
    this.osc2 = null
    this.gain = null
    if (!ctx || !gain || !osc || !osc2) return
    const t = ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (quick ? 0.08 : 0.9))
    osc.stop(t + 1)
    osc2.stop(t + 1)
  }

  /** The stamp: a short note an octave up. */
  stamp(height: number) {
    if (!this.enabled) return
    const ctx = this.ctx
    if (!ctx) return
    const freq = config.SOUND_BASE_HZ * 2 * Math.pow(2, height * 1.5)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, config.SOUND_GAIN * 1.4), t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 1.3)
  }
}
