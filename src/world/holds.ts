// Cordillera's holds: knots of mineral ink in the rock, laid as seeded
// routes up the massif. Climbing is going from hold to hold: touch one and
// you grip it, pull and you rise. One route passes by every place (the
// ledges where the visitor rests); the others wander. A pure function of
// the cycle, like the rest of the geography.
import { config } from '../gestures/config'
import { hashSeed, rng } from './rng'
import { regionScale } from './scale'
import type { Place, Rect, Vec2 } from './types'

export interface Hold {
  x: number
  y: number
  /** Knot radius in world px. */
  r: number
  seed: number
}

export interface HoldsInput {
  cycle: number
  rect: Rect
  places: readonly Place[]
  short: number
  viewW: number
  viewH: number
}

export function buildHolds(input: HoldsInput): Hold[] {
  const { cycle, rect, short } = input
  const s = regionScale('cordillera')
  const vw = input.viewW / s
  const vh = input.viewH / s
  const random = rng(hashSeed('holds', cycle))
  const places = input.places.filter((p) => p.region === 'cordillera').sort((a, b) => b.y - a.y) // bottom first
  const textHalf = Math.min(240, 0.37 * input.viewW) / s
  const minX = rect.x + vw * 0.12
  const maxX = rect.x + rect.w - vw * 0.12
  const radius = (config.CORDILLERA_HOLD_RADIUS * short) / s
  const stepMin = Math.max(0.05, config.CORDILLERA_HOLD_STEP_MIN) * vh
  const stepMax = Math.max(stepMin, config.CORDILLERA_HOLD_STEP_MAX * vh)
  const startY = rect.y + rect.h - vh * 0.2
  const endY = rect.y - vh * 0.05
  const holds: Hold[] = []

  // A hold never sits on a text block (the ink clears there): it moves to the side of it.
  const clearOfText = (x: number, y: number): number => {
    for (const p of places) {
      if (Math.abs(y - p.y) < vh * 0.22 && Math.abs(x - p.x) < textHalf + radius * 2) {
        return x < p.x ? p.x - textHalf - radius * 2.5 : p.x + textHalf + radius * 2.5
      }
    }
    return x
  }
  const add = (x: number, y: number) => {
    const cx = Math.min(maxX, Math.max(minX, clearOfText(x, y)))
    if (holds.some((h) => Math.hypot(h.x - cx, h.y - y) < radius * 3)) return
    holds.push({ x: cx, y, r: radius * (0.8 + random() * 0.45), seed: Math.floor(random() * 1000) })
  }

  const routes = Math.max(1, Math.round(config.CORDILLERA_ROUTES))
  for (let route = 0; route < routes; route++) {
    // The first route leads past every place; the others start elsewhere and wander.
    let x = route === 0 ? rect.x + rect.w / 2 : minX + ((route - 0.5) / (routes - 0.5)) * (maxX - minX) + (random() - 0.5) * vw * 0.3
    let y = startY - random() * stepMin
    let target = 0
    while (y > endY) {
      add(x, y)
      y -= stepMin + random() * (stepMax - stepMin)
      let dx = (random() - 0.5) * 2 * vw * 0.22
      if (route === 0) {
        while (target < places.length && places[target]!.y > y + vh * 0.1) target++
        const next = places[target]
        if (next) dx = (next.x - x) * 0.35 + dx * 0.5
        else dx = (rect.x + rect.w / 2 - x) * 0.3 + dx * 0.5
      }
      x = Math.min(maxX, Math.max(minX, x + dx))
    }
    add(x, endY)
  }
  // Around every place, holds within reach above and below, so a ledge is never a dead end.
  for (const p of places) {
    const side = random() < 0.5 ? -1 : 1
    add(p.x + side * (textHalf + radius * 2.5), p.y - vh * 0.28)
    add(p.x - side * (textHalf * 0.4), p.y + vh * 0.3)
  }
  holds.sort((a, b) => b.y - a.y)
  return holds
}

/** The hold under a world point, within `radius` world px, if any. */
export function holdAt(holds: readonly Hold[], p: Vec2, radius: number): Hold | null {
  let best: Hold | null = null
  let bestD = Infinity
  for (const h of holds) {
    const d = Math.hypot(h.x - p.x, h.y - p.y) - h.r * 0.5
    if (d <= radius && d < bestD) {
      best = h
      bestD = d
    }
  }
  return best
}
