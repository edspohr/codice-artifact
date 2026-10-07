// Pointer input on the stage: capture, edge insets, cancellation and
// long-press suppression. Delivers drag deltas to the loop; knows nothing
// about physics.
import { session } from '../app/session'
import { config } from '../gestures/config'

export interface DragSample {
  x: number
  y: number
  t: number
}

export interface InputHandlers {
  onStart(s: DragSample): void
  onMove(s: DragSample, prev: DragSample): void
  onEnd(s: DragSample, vx: number, vy: number): void
  onCancel(): void
}

export class PointerInput {
  private pointerId: number | null = null
  private samples: DragSample[] = []
  private rect: DOMRect | null = null
  private stage: HTMLElement | null = null
  private handlers: InputHandlers | null = null

  private readonly onDown = (e: PointerEvent) => this.handleDown(e)
  private readonly onMove = (e: PointerEvent) => this.move(e)
  private readonly onUp = (e: PointerEvent) => this.up(e)
  private readonly onCancel = (e: PointerEvent) => this.cancel(e)
  private readonly suppress = (e: Event) => e.preventDefault()

  attach(stage: HTMLElement, handlers: InputHandlers) {
    this.detach()
    this.stage = stage
    this.handlers = handlers
    stage.addEventListener('pointerdown', this.onDown)
    stage.addEventListener('pointermove', this.onMove)
    stage.addEventListener('pointerup', this.onUp)
    stage.addEventListener('pointercancel', this.onCancel)
    stage.addEventListener('contextmenu', this.suppress)
    stage.addEventListener('dragstart', this.suppress)
    stage.addEventListener('selectstart', this.suppress)
  }

  detach() {
    const stage = this.stage
    if (stage) {
      stage.removeEventListener('pointerdown', this.onDown)
      stage.removeEventListener('pointermove', this.onMove)
      stage.removeEventListener('pointerup', this.onUp)
      stage.removeEventListener('pointercancel', this.onCancel)
      stage.removeEventListener('contextmenu', this.suppress)
      stage.removeEventListener('dragstart', this.suppress)
      stage.removeEventListener('selectstart', this.suppress)
    }
    this.stage = null
    this.handlers = null
    this.pointerId = null
    session.patch({ pointerDown: false })
  }

  get down() {
    return this.pointerId !== null
  }

  private sample(e: PointerEvent): DragSample {
    const r = this.rect
    return { x: e.clientX - (r ? r.left : 0), y: e.clientY - (r ? r.top : 0), t: e.timeStamp || performance.now() }
  }

  private handleDown(e: PointerEvent) {
    if (!this.stage || !this.handlers || !e.isPrimary) return
    if (this.pointerId !== null) return
    const inset = config.EDGE_INSET_PX
    if (e.clientX < inset || e.clientX > window.innerWidth - inset) return
    // Buttons (the a11y controls, the seal) keep their own clicks.
    const target = e.target as HTMLElement | null
    if (target && target.closest('button, a')) return
    this.rect = this.stage.getBoundingClientRect()
    this.pointerId = e.pointerId
    try {
      this.stage.setPointerCapture(e.pointerId)
    } catch {
      // capture unavailable; bubbling still works
    }
    const s = this.sample(e)
    this.samples = [s]
    session.patch({ pointerDown: true })
    this.handlers.onStart(s)
  }

  private move(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId || !this.handlers) return
    const s = this.sample(e)
    const prev = this.samples[this.samples.length - 1]
    this.samples.push(s)
    if (this.samples.length > 48) this.samples.shift()
    if (prev) this.handlers.onMove(s, prev)
  }

  private up(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId || !this.handlers) return
    const s = this.sample(e)
    this.samples.push(s)
    const v = this.velocity()
    this.release()
    this.handlers.onEnd(s, v.vx, v.vy)
  }

  private cancel(e: PointerEvent) {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return
    this.release()
    this.handlers?.onCancel()
  }

  private release() {
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

  private velocity(): { vx: number; vy: number } {
    const s = this.samples
    const last = s[s.length - 1]
    if (!last) return { vx: 0, vy: 0 }
    let i = s.length - 1
    while (i > 0 && last.t - (s[i - 1] as DragSample).t < 80) i--
    const first = s[i] as DragSample
    const dt = last.t - first.t
    if (dt <= 0) return { vx: 0, vy: 0 }
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
  }
}
