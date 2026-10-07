// Epigraph: a touch, or the same lateral drift that Mar will ask for.
import { config } from './config'
import type { Recognizer, Sample } from './types'

const TAP_MAX_DIST = 14
const TAP_MAX_MS = 450

export function createTapRecognizer(): Recognizer {
  let origin: Sample | null = null
  return {
    kind: 'tap',
    start(_ctx, s) {
      origin = s
    },
    move(ctx, s) {
      if (!origin) return
      const dx = origin.x - s.x
      const p = dx / (ctx.width * config.DRIFT_COMMIT_FRACTION)
      ctx.setProgress(p)
      if (p >= 1) ctx.commit()
    },
    end(ctx, s) {
      if (!origin) return
      const dist = Math.hypot(s.x - origin.x, s.y - origin.y)
      const dt = s.t - origin.t
      if (ctx.progress >= 1 || (dist <= TAP_MAX_DIST && dt <= TAP_MAX_MS)) ctx.commit()
      else ctx.snapBack()
      origin = null
    },
    cancel(ctx) {
      origin = null
      ctx.snapBack()
    },
  }
}
