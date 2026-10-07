// Mar Primigenio: lateral drift. Fluid, undivided. Right-to-left carries
// the view away; a quick flick is enough once the drift has begun.
import { config } from './config'
import type { Recognizer, Sample } from './types'

export function createDriftRecognizer(): Recognizer {
  let origin: Sample | null = null
  return {
    kind: 'drift',
    start(_ctx, s) {
      origin = s
    },
    move(ctx, s) {
      if (!origin) return
      const dx = origin.x - s.x
      const p = dx / (ctx.width * config.DRIFT_COMMIT_FRACTION)
      ctx.setProgress(p)
      if (p >= 1) {
        origin = null
        ctx.commit()
      }
    },
    end(ctx, _s, _samples, v) {
      if (!origin) return
      origin = null
      const flick = -v.vx >= config.DRIFT_FLICK_VELOCITY && ctx.progress >= config.DRIFT_FLICK_MIN_PROGRESS
      if (ctx.progress >= 1 || flick) ctx.commit()
      else ctx.snapBack()
    },
    cancel(ctx) {
      origin = null
      ctx.snapBack()
    },
  }
}
