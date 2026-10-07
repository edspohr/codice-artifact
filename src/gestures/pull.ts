// Cordillera Silente: an upward pull against heavy resistance. Progress
// grows sub-linearly with distance; a release keeps some inertia, then the
// view either crests or slides back down.
import { config } from './config'
import type { Recognizer, Sample } from './types'

export function progressForPull(dyPx: number): number {
  if (dyPx <= 0) return 0
  return 1 - Math.exp(-dyPx / config.PULL_RESISTANCE_PX)
}

export function createPullRecognizer(): Recognizer {
  let origin: Sample | null = null
  let dy = 0
  let flying = false
  let v = 0 // upward px/ms

  return {
    kind: 'pull',
    mount() {
      origin = null
      dy = 0
      flying = false
      v = 0
    },
    start(_ctx, s) {
      flying = false
      v = 0
      // Continue from the current lift so a second pull does not restart from zero.
      origin = { ...s, y: s.y + dy }
    },
    move(ctx, s) {
      if (!origin) return
      dy = Math.max(0, origin.y - s.y)
      const p = progressForPull(dy)
      ctx.setProgress(p)
      if (p >= config.PULL_COMMIT_PROGRESS) {
        origin = null
        dy = 0
        ctx.commit()
      }
    },
    end(ctx, _s, _samples, vel) {
      if (!origin) return
      origin = null
      v = -vel.vy
      if (v > 0.05) {
        flying = true
      } else {
        dy = 0
        ctx.snapBack()
      }
    },
    cancel(ctx) {
      origin = null
      flying = false
      dy = 0
      ctx.snapBack()
    },
    tick(ctx, _now, dt) {
      if (!flying || ctx.settling) return
      v = v * Math.exp(-config.PULL_FRICTION * dt) - config.PULL_GRAVITY * dt
      dy += v * dt
      if (dy <= 0) {
        flying = false
        dy = 0
        ctx.setProgress(0)
        return
      }
      const p = progressForPull(dy)
      ctx.setProgress(p)
      if (p >= config.PULL_COMMIT_PROGRESS) {
        flying = false
        dy = 0
        ctx.commit()
      } else if (v <= 0) {
        flying = false
        dy = 0
        ctx.snapBack()
      }
    },
  }
}
