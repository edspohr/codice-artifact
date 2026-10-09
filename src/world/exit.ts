// The exit and the Return. Fragment 22 is the exit: after the reading
// dwell, sustained stillness begins the dissolution; a touch during it
// cancels and restores the place. The dissolution is the only point of no
// return: the territory whitens, then the reprise, then the lone seal, and
// touching it opens the Colofón. The linear path steps through the same
// stages without stillness.
import { cieloDwellMs, config } from '../gestures/config'

export type ExitStage = 'idle' | 'dwelling' | 'dissolving' | 'reprise' | 'seal' | 'colofon'

export interface ExitSnapshot {
  stage: ExitStage
  /** 0..1 while dissolving (how white the territory is), 1 afterwards. */
  progress: number
}

export class Exit {
  private stage: ExitStage = 'idle'
  private arrivedAt = 0
  private lastTouch = 0
  private words = 0
  private dissolveStart = 0
  private progress = 0
  private restoring = false
  private restoreFrom = 0
  private restoreStart = 0
  private repriseStart = 0
  private onChange: (s: ExitSnapshot) => void

  constructor(onChange: (s: ExitSnapshot) => void) {
    this.onChange = onChange
  }

  snapshot(): ExitSnapshot {
    return { stage: this.stage, progress: this.progress }
  }

  private set(stage: ExitStage) {
    if (this.stage === stage) return
    this.stage = stage
    this.onChange(this.snapshot())
  }

  /** The visitor is at rest at fragment 22. */
  arrive(now: number, words: number) {
    if (this.stage !== 'idle') return
    this.words = words
    this.arrivedAt = now
    this.lastTouch = now
    this.set('dwelling')
  }

  /** Any touch: during the dwell it only restarts the stillness; during the dissolution it cancels it. */
  touch(now: number) {
    this.lastTouch = now
    if (this.stage === 'dissolving') {
      this.restoring = true
      this.restoreFrom = this.progress
      this.restoreStart = now
      this.set('dwelling')
    }
  }

  /** The lone seal was touched. */
  openColofon() {
    if (this.stage === 'seal') this.set('colofon')
  }

  /** The linear path: step to the next stage without stillness. */
  advance(now: number) {
    switch (this.stage) {
      case 'dwelling':
        this.beginDissolution(now)
        break
      case 'dissolving':
        this.progress = 1
        this.repriseStart = now
        this.set('reprise')
        break
      case 'reprise':
        this.set('seal')
        break
      case 'seal':
        this.set('colofon')
        break
      default:
        break
    }
  }

  private beginDissolution(now: number) {
    this.dissolveStart = now
    this.restoring = false
    this.set('dissolving')
  }

  /** Returns true while something is animating. */
  tick(now: number, pointerDown: boolean, keyboardUser: boolean): boolean {
    switch (this.stage) {
      case 'dwelling': {
        if (this.restoring) {
          const t = Math.min(1, (now - this.restoreStart) / Math.max(1, config.RESTORE_MS))
          this.progress = this.restoreFrom * (1 - t)
          if (t >= 1) this.restoring = false
          return true
        }
        if (pointerDown) {
          this.lastTouch = now
          return false
        }
        if (keyboardUser) return false
        const dwell = cieloDwellMs(this.words)
        if (now - this.arrivedAt >= dwell && now - this.lastTouch >= config.CIELO_STILL_MS) this.beginDissolution(now)
        return false
      }
      case 'dissolving': {
        this.progress = Math.min(1, (now - this.dissolveStart) / Math.max(1, config.CIELO_FADE_MS))
        if (this.progress >= 1) {
          this.repriseStart = now
          this.set('reprise')
        }
        return true
      }
      case 'reprise': {
        if (!keyboardUser && now - this.repriseStart >= config.REPRISE_MS) this.set('seal')
        return this.stage === 'reprise'
      }
      default:
        return false
    }
  }

  get current() {
    return this.stage
  }

  get whiteness() {
    return this.progress
  }
}
