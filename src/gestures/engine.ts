// The gesture engine. Owns pointer input on the stage, the `--progress`
// CSS variable that drives transitions, the settle/snap-back tweens and the
// stall timer. Runs outside React's render loop; React only swaps the
// recognizer when the station changes and reacts to `onCommit`.
import { session } from '../app/session'
import { config } from './config'
import type { Recognizer, RecognizerContext, Sample, Velocity } from './types'

const MAX_SAMPLES = 64
const CUE_KINDS = new Set(['tap', 'drift', 'fracture', 'pull'])

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

interface Settle {
  from: number
  to: number
  start: number
  duration: number
  onDone: (() => void) | null
}

export interface EngineOptions {
  onCommit: () => void
}

export class GestureEngine {
  private stage: HTMLElement | null = null
  private recognizer: Recognizer | null = null
  private options: EngineOptions = { onCommit: () => {} }

  private pointerId: number | null = null
  private rect: DOMRect | null = null
  private samples: Sample[] = []

  private progress = 0
  private settle: Settle | null = null
  private raf = 0
  private lastFrame = 0
  private lastActivity = 0
  private destroyed = false

  // Bound handlers so they can be removed.
  private readonly onPointerDown = (e: PointerEvent) => this.handlePointerDown(e)
  private readonly onPointerMove = (e: PointerEvent) => this.handlePointerMove(e)
  private readonly onPointerUp = (e: PointerEvent) => this.handlePointerUp(e)
  private readonly onPointerCancel = (e: PointerEvent) => this.handlePointerCancel(e)
  private readonly onSuppress = (e: Event) => e.preventDefault()
  private readonly onFrame = (now: number) => this.frame(now)

  attach(stage: HTMLElement, options: EngineOptions) {
    this.detach()
    this.destroyed = false
    this.stage = stage
    this.options = options
    stage.addEventListener('pointerdown', this.onPointerDown)
    stage.addEventListener('pointermove', this.onPointerMove)
    stage.addEventListener('pointerup', this.onPointerUp)
    stage.addEventListener('pointercancel', this.onPointerCancel)
    // Long-press side effects on the gesture layer: context menu, drag, selection.
    stage.addEventListener('contextmenu', this.onSuppress)
    stage.addEventListener('dragstart', this.onSuppress)
    stage.addEventListener('selectstart', this.onSuppress)
    this.writeProgress(0)
    this.lastActivity = performance.now()
    this.startLoop()
  }

  detach() {
    const stage = this.stage
    if (stage) {
      stage.removeEventListener('pointerdown', this.onPointerDown)
      stage.removeEventListener('pointermove', this.onPointerMove)
      stage.removeEventListener('pointerup', this.onPointerUp)
      stage.removeEventListener('pointercancel', this.onPointerCancel)
      stage.removeEventListener('contextmenu', this.onSuppress)
      stage.removeEventListener('dragstart', this.onSuppress)
      stage.removeEventListener('selectstart', this.onSuppress)
    }
    this.recognizer?.unmount?.()
    this.recognizer = null
    this.stage = null
    this.settle = null
    this.pointerId = null
    this.destroyed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    session.patch({ pointerDown: false, stalled: false })
  }

  /** Swap the recognizer when the station changes. Progress resets to 0. */
  setRecognizer(recognizer: Recognizer | null) {
    this.recognizer?.unmount?.()
    this.recognizer = recognizer
    this.settle = null
    this.pointerId = null
    this.samples = []
    this.stage?.removeAttribute('data-settling')
    this.writeProgress(0)
    this.markActivity()
    recognizer?.mount?.(this.context(), performance.now())
  }

  getProgress() {
    return this.progress
  }

  isSettling() {
    return this.settle !== null
  }

  /** Advance from the keyboard or the accessible control. */
  advance(durationMs: number = config.KEYBOARD_SETTLE_MS) {
    if (!this.stage || !this.recognizer || this.recognizer.kind === 'none') return
    this.markActivity()
    this.commit(durationMs)
  }

  /** Reset the stall timer. Also called by keyboard navigation. */
  markActivity() {
    this.lastActivity = performance.now()
    session.patch({ stalled: false })
  }

  // --- context given to recognizers --------------------------------------

  private context(): RecognizerContext {
    // oxlint-disable-next-line typescript/no-this-alias -- getters below need the instance
    const engine = this
    const stage = this.stage
    return {
      get width() {
        return stage ? stage.clientWidth : 0
      },
      get height() {
        return stage ? stage.clientHeight : 0
      },
      get progress() {
        return engine.progress
      },
      get settling() {
        return engine.settle !== null
      },
      get pointerDown() {
        return engine.pointerId !== null
      },
      get reducedMotion() {
        return session.get().reducedMotion
      },
      get keyboardUser() {
        return session.get().keyboardUser
      },
      get overlay() {
        return stage ? stage.querySelector<SVGSVGElement>('.view--current [data-gesture-overlay]') : null
      },
      setProgress: (p) => engine.setProgress(p),
      commit: (d) => engine.commit(d),
      snapBack: (d) => engine.snapBack(d),
    }
  }

  private setProgress(p: number) {
    if (this.settle) return
    this.writeProgress(Math.max(0, Math.min(1, p)))
  }

  private writeProgress(p: number) {
    this.progress = p
    this.stage?.style.setProperty('--progress', p.toFixed(4))
  }

  private commit(durationMs: number = config.COMMIT_SETTLE_MS) {
    if (!this.stage || this.settle) return
    const reduced = session.get().reducedMotion
    const duration = reduced ? Math.min(durationMs, 160) : durationMs
    this.releasePointer()
    this.stage.setAttribute('data-settling', '')
    this.startSettle(1, duration, () => {
      this.stage?.removeAttribute('data-settling')
      this.settle = null
      this.writeProgress(0)
      this.markActivity()
      this.options.onCommit()
    })
  }

  private snapBack(durationMs: number = config.SNAPBACK_MS) {
    if (!this.stage || this.settle) return
    if (this.progress === 0) return
    this.startSettle(0, durationMs, () => {
      this.settle = null
    })
  }

  private startSettle(to: number, duration: number, onDone: () => void) {
    const now = performance.now()
    this.settle = { from: this.progress, to, start: now, duration: Math.max(0, duration), onDone }
    if (duration <= 0) {
      this.writeProgress(to)
      const done = this.settle.onDone
      this.settle.onDone = null
      done?.()
    }
  }

  // --- pointer -------------------------------------------------------------

  private toSample(e: PointerEvent): Sample {
    const r = this.rect
    return { x: e.clientX - (r ? r.left : 0), y: e.clientY - (r ? r.top : 0), t: e.timeStamp || performance.now() }
  }

  private handlePointerDown(e: PointerEvent) {
    if (!this.stage || !e.isPrimary) return
    this.markActivity()
    if (this.settle || this.pointerId !== null) return
    const inset = config.EDGE_INSET_PX
    const vw = window.innerWidth
    if (e.clientX < inset || e.clientX > vw - inset) return
    this.rect = this.stage.getBoundingClientRect()
    this.pointerId = e.pointerId
    try {
      this.stage.setPointerCapture(e.pointerId)
    } catch {
      // Some environments refuse capture; the gesture still works via bubbling.
    }
    const s = this.toSample(e)
    this.samples = [s]
    session.patch({ pointerDown: true })
    this.recognizer?.start?.(this.context(), s)
  }

  private handlePointerMove(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return
    this.markActivity()
    const s = this.toSample(e)
    this.samples.push(s)
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()
    this.recognizer?.move?.(this.context(), s, this.samples)
  }

  private handlePointerUp(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return
    this.markActivity()
    const s = this.toSample(e)
    this.samples.push(s)
    const v = this.velocity()
    const samples = this.samples
    this.releasePointer()
    this.recognizer?.end?.(this.context(), s, samples, v)
  }

  private handlePointerCancel(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return
    this.releasePointer()
    const r = this.recognizer
    if (r?.cancel) r.cancel(this.context())
    else this.snapBack()
  }

  private releasePointer() {
    if (this.pointerId !== null && this.stage) {
      try {
        this.stage.releasePointerCapture(this.pointerId)
      } catch {
        // already released
      }
    }
    this.pointerId = null
    session.patch({ pointerDown: false })
  }

  /** Velocity over the last ~80 ms of samples. */
  private velocity(): Velocity {
    const s = this.samples
    const last = s[s.length - 1]
    if (!last) return { vx: 0, vy: 0 }
    let i = s.length - 1
    while (i > 0 && last.t - (s[i - 1] as Sample).t < 80) i--
    const first = s[i] as Sample
    const dt = last.t - first.t
    if (dt <= 0) return { vx: 0, vy: 0 }
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
  }

  // --- frame loop ------------------------------------------------------------

  private startLoop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.onFrame)
  }

  private frame(now: number) {
    if (this.destroyed) return
    const dt = Math.min(100, now - this.lastFrame)
    this.lastFrame = now

    const settle = this.settle
    if (settle) {
      const t = settle.duration > 0 ? Math.min(1, (now - settle.start) / settle.duration) : 1
      this.writeProgress(settle.from + (settle.to - settle.from) * easeOutCubic(t))
      if (t >= 1) {
        const done = settle.onDone
        settle.onDone = null
        done?.()
      }
    } else {
      this.recognizer?.tick?.(this.context(), now, dt)
    }

    const kind = this.recognizer?.kind
    const stalled =
      kind !== undefined &&
      CUE_KINDS.has(kind) &&
      this.pointerId === null &&
      !this.settle &&
      now - this.lastActivity >= config.STALL_CUE_MS
    session.patch({ stalled })

    this.raf = requestAnimationFrame(this.onFrame)
  }
}

export const engine = new GestureEngine()
