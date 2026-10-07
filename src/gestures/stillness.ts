// Cielo Inconquistable: stop touching. Stillness only starts counting after
// a minimum dwell derived from the station's word count. A touch never
// restarts the dwell, only the stillness timer. Then a slow fade advances
// the view; any touch during the fade cancels it and restores the view.
// Never advances a visitor who navigates with the keyboard.
import { cieloDwellMs, config } from './config'
import type { Recognizer } from './types'

export function createStillnessRecognizer(words: number): Recognizer {
  let mountedAt = 0
  let lastTouch = 0
  let fading = false
  let fadeStart = 0

  return {
    kind: 'stillness',
    mount(_ctx, now) {
      mountedAt = now
      lastTouch = now
      fading = false
    },
    start(ctx, s) {
      lastTouch = s.t
      if (fading) {
        fading = false
        ctx.snapBack()
      }
    },
    move(_ctx, s) {
      lastTouch = s.t
    },
    end(_ctx, s) {
      lastTouch = s.t
    },
    cancel() {
      lastTouch = performance.now()
    },
    tick(ctx, now) {
      if (ctx.keyboardUser || ctx.settling) return
      if (ctx.pointerDown) {
        lastTouch = now
        return
      }
      if (fading) {
        const p = Math.min(1, (now - fadeStart) / Math.max(1, config.CIELO_FADE_MS))
        ctx.setProgress(p)
        if (p >= 1) {
          fading = false
          ctx.commit(0)
        }
        return
      }
      const dwell = cieloDwellMs(words)
      if (now - mountedAt >= dwell && now - lastTouch >= config.CIELO_STILL_MS) {
        fading = true
        fadeStart = now
      }
    },
  }
}
