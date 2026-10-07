// Tierra Herida: press and drag until the view fractures. One stroke opens
// a crack but never breaks the view: progress accumulates across strokes,
// persists when the finger lifts and heals slowly, so breaking takes
// insistence. No hold delay before dragging.
import { config } from './config'
import type { Recognizer, RecognizerContext, Sample } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'

interface Stroke {
  el: SVGPolylineElement
  points: string[]
  length: number
}

function jitter(i: number, seed: number): number {
  // Deterministic small perpendicular offset so a crack is not a finger trace.
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 6
}

export function createFractureRecognizer(): Recognizer {
  let accumulated = 0 // progress kept across strokes
  let strokeAdded = 0 // progress contributed by the live stroke (capped)
  let last: Sample | null = null
  let stroke: Stroke | null = null
  let strokes: Stroke[] = []
  let healAfter = 0
  let seed = 0
  let committed = false

  function overlayFor(ctx: RecognizerContext): SVGSVGElement | null {
    const svg = ctx.overlay
    if (svg && svg.getAttribute('viewBox') !== `0 0 ${ctx.width} ${ctx.height}`) {
      svg.setAttribute('viewBox', `0 0 ${ctx.width} ${ctx.height}`)
    }
    return svg
  }

  function clearStrokes() {
    for (const s of strokes) s.el.remove()
    strokes = []
  }

  return {
    kind: 'fracture',
    mount() {
      committed = false
      accumulated = 0
      strokeAdded = 0
      strokes = []
      stroke = null
      last = null
    },
    unmount() {
      clearStrokes()
    },
    start(ctx, s) {
      last = s
      strokeAdded = 0
      seed += 1
      const svg = overlayFor(ctx)
      if (svg) {
        const el = document.createElementNS(SVG_NS, 'polyline')
        el.setAttribute('points', `${s.x.toFixed(1)},${s.y.toFixed(1)}`)
        svg.appendChild(el)
        stroke = { el, points: [`${s.x.toFixed(1)},${s.y.toFixed(1)}`], length: 0 }
        strokes.push(stroke)
      }
      ctx.setProgress(accumulated)
    },
    move(ctx, s) {
      if (!last) return
      const segment = Math.hypot(s.x - last.x, s.y - last.y)
      last = s
      if (segment < 1.5) return
      const unit = ctx.width * config.FRACTURE_PATH_PER_UNIT
      if (stroke) {
        stroke.length += segment
        const i = stroke.points.length
        const j = jitter(i, seed)
        stroke.points.push(`${(s.x + j).toFixed(1)},${(s.y - j).toFixed(1)}`)
        stroke.el.setAttribute('points', stroke.points.join(' '))
        strokeAdded = Math.min(config.FRACTURE_STROKE_CAP, stroke.length / unit)
      } else {
        strokeAdded = Math.min(config.FRACTURE_STROKE_CAP, strokeAdded + segment / unit)
      }
      const total = accumulated + strokeAdded
      ctx.setProgress(total)
      if (total >= 1) {
        accumulated = 1
        strokeAdded = 0
        stroke = null
        last = null
        committed = true
        ctx.commit()
      }
    },
    end(ctx, s) {
      if (committed) return
      accumulated = Math.min(1, accumulated + strokeAdded)
      strokeAdded = 0
      stroke = null
      last = null
      healAfter = s.t + config.FRACTURE_HEAL_DELAY_MS
      ctx.setProgress(accumulated)
      if (accumulated >= 1) {
        committed = true
        ctx.commit()
      }
    },
    cancel(ctx) {
      if (committed) return
      accumulated = Math.min(1, accumulated + strokeAdded)
      strokeAdded = 0
      stroke = null
      last = null
      healAfter = performance.now() + config.FRACTURE_HEAL_DELAY_MS
      ctx.setProgress(accumulated)
    },
    tick(ctx, now, dt) {
      if (ctx.pointerDown || ctx.settling || accumulated <= 0) return
      if (now < healAfter) return
      accumulated = Math.max(0, accumulated - (config.FRACTURE_HEAL_PER_S * dt) / 1000)
      ctx.setProgress(accumulated)
      if (accumulated === 0) clearStrokes()
    },
  }
}
