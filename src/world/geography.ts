// Places are a deterministic function of the cycle number. In a channel
// they are loosely ordered along the ascent by canonical number, with
// seeded jitter, alternating sides of the centre line; in an open region
// (Cordillera, Cielo) they scatter across its whole width. Order stays free:
// nothing forces the visitor to take them in sequence. Constraints: inside
// the region, off the edges, apart from each other, the first place about
// one screen above the start, and fragment 22 at the far top of Cielo.
import type { Fragment, MovementId } from '../content/canon'
import { config } from '../gestures/config'
import { hashSeed, rng } from './rng'
import type { Place, Rect } from './types'

export interface GeographyInput {
  cycle: number
  region: MovementId
  rect: Rect
  fragments: Fragment[]
  /** Viewport short side in px. */
  short: number
  /** Viewport height in px (the ascent is measured in screens). */
  viewH: number
  /** Viewport width in px (the text block width depends on it). */
  viewW: number
  /** View scale of the region (screen px per world px): distances that are felt on screen grow by its inverse. */
  scale?: number
}

/**
 * The least height (world px) an open region needs so its places can keep one
 * view apart along the ascent alone (on a wide screen they cannot do it sideways).
 */
export function minOpenHeight(count: number, hasExit: boolean, viewportH: number, scale: number): number {
  const v = viewportH / scale
  const top = hasExit ? 0.6 + 1.0 : 1.05
  const bottom = 0.5 + config.FIRST_PLACE_SCREENS
  const others = hasExit ? count - 1 : count
  return Math.ceil(v * (top + bottom + Math.max(0, others - 1) * 0.85 + 0.2))
}

export function placePlaces(input: GeographyInput): Place[] {
  const { cycle, region, rect, fragments, short } = input
  const scale = input.scale ?? 1
  // The view in world px: what one screen takes in at this region's scale.
  const viewH = input.viewH / scale
  const viewW = input.viewW / scale
  const random = rng(hashSeed('geo', cycle, region))
  const margin = (config.PLACE_EDGE_MARGIN * short) / scale
  const minDist = (config.PLACE_MIN_DIST * short) / scale
  const inner: Rect = { x: rect.x + margin, y: rect.y + margin, w: rect.w - 2 * margin, h: rect.h - 2 * margin }
  if (inner.w <= 0 || inner.h <= 0) throw new Error('geography: region too small for the edge margin')

  const centreX = rect.x + rect.w / 2
  // A place's text block (see .place in territory.css: min(30rem, 74vw)) must fit
  // inside the region with a margin, so the viewpoint can frame it on arrival.
  const textHalf = Math.min(240, 0.37 * input.viewW) / scale
  const fitMargin = textHalf + 40 / scale
  // And the viewpoint must be able to centre on it: on a wide screen the channel is barely wider than the view.
  const minX = rect.x + Math.max(fitMargin, Math.min(rect.w / 2, viewW / 2))
  const maxX = rect.x + rect.w - Math.max(fitMargin, Math.min(rect.w / 2, viewW / 2))
  const halfW = Math.max(0, (maxX - minX) / 2)
  const open = rect.w >= viewW * 1.7
  // Slots along the ascent: the first about one screen above the start
  // (the start sits half a screen above the region's bottom), the last
  // near the top. The exit (22) always takes the very top.
  const bottomSlot = rect.y + rect.h - viewH / 2 - config.FIRST_PLACE_SCREENS * viewH
  // The last place of a region stays at least a screen below the closing at its threshold;
  // the exit (22) has no threshold above it and takes the very top, but never above the
  // highest point the viewpoint can reach (half a screen below the top of the world).
  const hasExit = fragments.some((f) => f.n === 22)
  const exitSlot = Math.max(inner.y, rect.y + viewH / 2 + (short * 0.08) / scale)
  // The others keep a view and more below the exit, so the exit is read alone.
  const topSlot = hasExit ? exitSlot + viewH * 1.0 : inner.y + Math.max((short * 0.15) / scale, viewH * 1.05 - margin)
  const others = fragments.filter((f) => f.n !== 22).length
  const span = Math.max(0, bottomSlot - topSlot)
  const step = others > 1 ? span / (others - 1) : 0
  // Places are spread along the ascent by their slots; the minimum distance never asks for more than the slots allow
  // (in an open region the lateral spread adds room, so it can ask for more).
  const minDistEff = others > 1 ? Math.min(minDist, step * (open ? 1.4 : 0.8)) : minDist
  let side = random() < 0.5 ? -1 : 1

  const placed: Place[] = []
  fragments.forEach((fragment, i) => {
    const isExit = fragment.n === 22
    const slotY = isExit ? exitSlot : bottomSlot - i * step
    let best: { x: number; y: number } | null = null
    for (let attempt = 0; attempt < 48 && !best; attempt++) {
      const relax = attempt / 48
      const jitter = (random() - 0.5) * 2 * config.PLACE_JITTER * viewH * (1 - relax)
      // The exit only ever moves down from its slot: above it the viewpoint could not reach it.
      const jitterY = isExit ? Math.abs(jitter) : jitter
      // A channel keeps places near its centre line; an open region scatters them over its width.
      // (Toward the outer part of each side, so consecutive places, on alternate sides, fall in different views.)
      if (open && attempt > 0 && attempt % 2 === 0) side = -side
      const lateral = open
        ? (0.62 + random() * 0.38) * halfW
        : (config.PLACE_LATERAL + (random() - 0.5) * 2 * config.PLACE_LATERAL_JITTER) * halfW
      const x = isExit ? centreX + (random() - 0.5) * 0.2 * halfW : Math.min(maxX, Math.max(minX, centreX + side * lateral))
      const y = Math.min(inner.y + inner.h, Math.max(inner.y, slotY + jitterY))
      // In an open region the view takes in a lot: two places never share one view, so a text is always read alone.
      const apart = (p: Place) => !open || Math.abs(p.x - x) >= viewW * 0.85 || Math.abs(p.y - y) >= viewH * 0.75
      const ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minDistEff * (1 - relax * 0.5) && apart(p))
      if (ok) best = { x, y }
    }
    if (!best) throw new Error(`geography: could not place fragment ${fragment.n}`)
    side = -side
    const r = rng(hashSeed('stamp', cycle, fragment.n))
    placed.push({
      n: fragment.n,
      fragment,
      region,
      x: best.x,
      y: best.y,
      stamp: {
        rotation: (r() - 0.5) * 8,
        dx: (r() - 0.5) * 0.05 * short,
        dy: (r() - 0.5) * 0.06 * short,
        pressure: 0.82 + r() * 0.18,
      },
      seed: hashSeed('form', cycle, fragment.n) % 1000,
    })
  })
  return placed
}
