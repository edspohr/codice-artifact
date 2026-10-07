import { beforeEach, describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { config, resetConfig } from '../src/gestures/config'
import { placePlaces } from '../src/world/geography'
import { buildWorld } from '../src/world/world'

beforeEach(() => resetConfig())

const marFragments = canon.fragments.slice(0, 4)

describe('geography', () => {
  it('is a deterministic function of the cycle', () => {
    const a = placePlaces({ cycle: 1, region: 'mar', rect: { x: 0, y: 0, w: 1200, h: 2500 }, fragments: marFragments, short: 390 })
    const b = placePlaces({ cycle: 1, region: 'mar', rect: { x: 0, y: 0, w: 1200, h: 2500 }, fragments: marFragments, short: 390 })
    const c = placePlaces({ cycle: 2, region: 'mar', rect: { x: 0, y: 0, w: 1200, h: 2500 }, fragments: marFragments, short: 390 })
    expect(a.map((p) => [p.x, p.y])).toEqual(b.map((p) => [p.x, p.y]))
    expect(a.map((p) => [p.x, p.y])).not.toEqual(c.map((p) => [p.x, p.y]))
    expect(a.map((p) => p.stamp)).toEqual(b.map((p) => p.stamp))
  })

  it('keeps places inside the region, off the edges and apart from each other', () => {
    for (const cycle of [1, 2, 3, 7, 42]) {
      const rect = { x: 0, y: 1266, w: 1170, h: 2532 }
      const short = 390
      const places = placePlaces({ cycle, region: 'mar', rect, fragments: marFragments, short })
      const margin = config.PLACE_EDGE_MARGIN * short
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(rect.x + margin)
        expect(p.x).toBeLessThanOrEqual(rect.x + rect.w - margin)
        expect(p.y).toBeGreaterThanOrEqual(rect.y + margin)
        expect(p.y).toBeLessThanOrEqual(rect.y + rect.h - margin)
      }
      for (let i = 0; i < places.length; i++) {
        for (let j = i + 1; j < places.length; j++) {
          const a = places[i]!
          const b = places[j]!
          // The minimum distance may relax if the region is crowded, never below 85%^8 of it.
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(config.PLACE_MIN_DIST * short * 0.85 ** 8)
        }
      }
    }
  })

  it('puts fragment 22 at the far top of its region', () => {
    const cielo = canon.fragments.slice(16, 22)
    const rect = { x: 0, y: 0, w: 1170, h: 2532 }
    const places = placePlaces({ cycle: 1, region: 'cielo', rect, fragments: cielo, short: 390 })
    const exit = places.find((p) => p.n === 22)!
    const margin = config.PLACE_EDGE_MARGIN * 390
    expect(exit.y).toBeLessThanOrEqual(rect.y + margin + 390 * 0.25)
    for (const p of places) if (p.n !== 22) expect(p.y).toBeGreaterThanOrEqual(exit.y - 390 * 0.25)
  })

  it('builds Mar as 3×3 screens with a stub above and the start at the bottom centre', () => {
    const w = buildWorld(390, 844, 1)
    expect(w.regions[0]!.rect).toEqual({ x: 0, y: 1266, w: 1170, h: 2532 })
    expect(w.width).toBe(1170)
    expect(w.height).toBe(1266 + 2532)
    expect(w.places.map((p) => p.n)).toEqual([1, 2, 3, 4])
    expect(w.start).toEqual({ x: 585, y: 1266 + 2532 - 422 })
    expect(w.thresholds[0]!.fragments).toEqual([1, 2, 3, 4])
  })
})
