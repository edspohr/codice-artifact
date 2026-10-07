import type { GestureKind } from '../content/journey'

export interface Sample {
  /** Stage-relative coordinates in CSS px. */
  x: number
  y: number
  /** performance.now() timestamp in ms. */
  t: number
}

export interface Velocity {
  /** px per ms */
  vx: number
  vy: number
}

/** What a recognizer can read and do. Provided by the engine. */
export interface RecognizerContext {
  readonly width: number
  readonly height: number
  readonly progress: number
  readonly settling: boolean
  readonly pointerDown: boolean
  readonly reducedMotion: boolean
  readonly keyboardUser: boolean
  /** SVG overlay inside the current view, for recognizers that draw (Tierra). */
  readonly overlay: SVGSVGElement | null
  setProgress(p: number): void
  /** Tween progress to 1, then leave the station. */
  commit(durationMs?: number): void
  /** Tween progress back to 0. */
  snapBack(durationMs?: number): void
}

export interface Recognizer {
  readonly kind: GestureKind
  mount?(ctx: RecognizerContext, now: number): void
  unmount?(): void
  start?(ctx: RecognizerContext, s: Sample): void
  move?(ctx: RecognizerContext, s: Sample, samples: readonly Sample[]): void
  end?(ctx: RecognizerContext, s: Sample, samples: readonly Sample[], v: Velocity): void
  cancel?(ctx: RecognizerContext): void
  /** Called every animation frame while mounted. */
  tick?(ctx: RecognizerContext, now: number, dtMs: number): void
}
