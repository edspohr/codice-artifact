// The dissolution: unfolds on its own, nothing to do.
import { config } from './config'
import type { Recognizer } from './types'

export function createAutoRecognizer(): Recognizer {
  let start = 0
  return {
    kind: 'auto',
    mount(_ctx, now) {
      start = now
    },
    tick(ctx, now) {
      if (ctx.settling) return
      const p = Math.min(1, (now - start) / Math.max(1, config.DISSOLUTION_MS))
      ctx.setProgress(p)
      if (p >= 1) ctx.commit(0)
    },
  }
}
