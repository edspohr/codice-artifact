import { beforeEach, describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { config, resetConfig } from '../src/gestures/config'
import { placePlaces } from '../src/world/geography'
import { Camera } from '../src/world/camera'
import { regionScale } from '../src/world/scale'
import { buildWorld, regionAt } from '../src/world/world'

beforeEach(() => resetConfig())

const marFragments = canon.fragments.slice(0, 4)
const VIEW_W = 390
const VIEW_H = 844
const channel = { x: 0, y: 1266, w: Math.round(VIEW_W * 1.4), h: Math.round(VIEW_H * 5.5) }

describe('geography', () => {
  it('is a deterministic function of the cycle', () => {
    const a = placePlaces({ cycle: 1, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
    const b = placePlaces({ cycle: 1, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
    const c = placePlaces({ cycle: 2, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
    expect(a.map((p) => [p.x, p.y])).toEqual(b.map((p) => [p.x, p.y]))
    expect(a.map((p) => [p.x, p.y])).not.toEqual(c.map((p) => [p.x, p.y]))
    expect(a.map((p) => p.stamp)).toEqual(b.map((p) => p.stamp))
  })

  it('keeps places inside the channel, off the edges and apart from each other', () => {
    for (const cycle of [1, 2, 3, 7, 42]) {
      const places = placePlaces({ cycle, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
      const margin = config.PLACE_EDGE_MARGIN * VIEW_W
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(channel.x + margin)
        expect(p.x).toBeLessThanOrEqual(channel.x + channel.w - margin)
        expect(p.y).toBeGreaterThanOrEqual(channel.y + margin)
        expect(p.y).toBeLessThanOrEqual(channel.y + channel.h - margin)
      }
      for (let i = 0; i < places.length; i++) {
        for (let j = i + 1; j < places.length; j++) {
          const a = places[i]!
          const b = places[j]!
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(config.PLACE_MIN_DIST * VIEW_W * 0.5)
        }
      }
    }
  })

  it('orders places loosely along the ascent by canonical number, alternating sides', () => {
    for (const cycle of [1, 2, 3, 7, 42]) {
      const places = placePlaces({ cycle, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
      const centre = channel.x + channel.w / 2
      for (let i = 1; i < places.length; i++) {
        // Higher numbers sit higher (smaller y), with jitter well below the slot spacing.
        expect(places[i]!.y).toBeLessThan(places[i - 1]!.y)
        // Sides alternate.
        expect(Math.sign(places[i]!.x - centre)).toBe(-Math.sign(places[i - 1]!.x - centre))
      }
    }
  })

  it('puts the first place within about one screen of the start, out of view and beyond emergence', () => {
    for (const cycle of [1, 2, 3, 7, 42]) {
      const w = buildWorld(VIEW_W, VIEW_H, cycle)
      const first = w.places.find((p) => p.n === 1)!
      const d = Math.hypot(first.x - w.start.x, first.y - w.start.y)
      expect(d).toBeLessThanOrEqual(1.5 * VIEW_H)
      expect(d).toBeGreaterThan(config.EMERGE_DISTANCE * w.short)
      // Out of the starting viewport.
      expect(first.y).toBeLessThan(w.start.y - VIEW_H / 2)
      // No place is in view or emerged at the start.
      for (const p of w.places) {
        expect(Math.hypot(p.x - w.start.x, p.y - w.start.y)).toBeGreaterThan(config.EMERGE_DISTANCE * w.short)
      }
      // The exit sits at the far top of the world.
      const exit = w.places.find((p) => p.n === 22)!
      for (const p of w.places) if (p.n !== 22) expect(p.y).toBeGreaterThan(exit.y)
    }
  })

  it('puts fragment 22 at the far top of its region', () => {
    const cielo = canon.fragments.slice(16, 22)
    const rect = { x: 0, y: 0, w: 546, h: VIEW_H * 4 }
    const places = placePlaces({ cycle: 1, region: 'cielo', rect, fragments: cielo, short: VIEW_W, viewH: VIEW_H, viewW: VIEW_W })
    const exit = places.find((p) => p.n === 22)!
    for (const p of places) if (p.n !== 22) expect(p.y).toBeGreaterThan(exit.y)
  })

  it('stacks four channels, Mar at the bottom and Cielo at the top, with a threshold between each pair', () => {
    const w = buildWorld(VIEW_W, VIEW_H, 1)
    expect(w.regions.map((r) => r.id)).toEqual(['mar', 'tierra', 'cordillera', 'cielo'])
    // Channels have their height in screens; the open regions at least theirs (more if their places need it).
    const heights = [5.5, 8, 9, 9].map((s) => Math.round(VIEW_H * s))
    w.regions.forEach((r, i) => (i < 2 ? expect(r.rect.h).toBe(heights[i]) : expect(r.rect.h).toBeGreaterThanOrEqual(heights[i]!)))
    expect(w.height).toBe(w.regions.reduce((a, r) => a + r.rect.h, 0))
    // Mar and Tierra are channels; Cordillera and Cielo open wide, all on one centre line.
    expect(w.regions.map((r) => r.rect.w)).toEqual([546, 546, 1170, 1560])
    expect(w.width).toBe(1560)
    for (const r of w.regions) expect(r.rect.x + r.rect.w / 2).toBe(780)
    const mar = w.regions.find((r) => r.id === 'mar')!.rect
    const cielo = w.regions.find((r) => r.id === 'cielo')!.rect
    expect(mar.y + mar.h).toBe(w.height)
    expect(cielo.y).toBe(0)
    for (let i = 1; i < w.regions.length; i++) {
      const below = w.regions[i - 1]!.rect
      const above = w.regions[i]!.rect
      expect(above.y + above.h).toBe(below.y)
    }
    expect(w.places.map((p) => p.n)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
    for (const p of w.places) {
      const r = w.regions.find((x) => x.id === p.region)!.rect
      expect(p.y).toBeGreaterThanOrEqual(r.y)
      expect(p.y).toBeLessThanOrEqual(r.y + r.h)
    }
    expect(w.thresholds.map((t) => [t.from, t.to])).toEqual([
      ['mar', 'tierra'],
      ['tierra', 'cordillera'],
      ['cordillera', 'cielo'],
    ])
    expect(w.thresholds.map((t) => t.fragments)).toEqual([[1, 2, 3, 4], [5, 6, 7, 8, 9, 10], [11, 12, 13, 14, 15, 16]])
    expect(w.start).toEqual({ x: 780, y: w.height - 422 })
    expect(regionAt(w, w.start.y).id).toBe('mar')
    expect(regionAt(w, 10).id).toBe('cielo')
  })

  it('every place can be reached by the viewpoint: arrival distance from the clamped camera', () => {
    for (const [w, h] of [
      [390, 844],
      [360, 740],
      [430, 932],
      [1280, 800],
      [1920, 1080],
    ] as const) {
      for (const cycle of [1, 2, 3, 7, 42]) {
        const world = buildWorld(w, h, cycle)
        const camera = new Camera(world)
        camera.setViewport(w, h)
        for (const p of world.places) {
          camera.x = p.x
          camera.y = p.y
          camera.clamp()
          const d = Math.hypot(camera.x - p.x, camera.y - p.y)
          expect(d, `place ${p.n} on ${w}x${h}, cycle ${cycle}`).toBeLessThan(config.ARRIVE_DISTANCE * world.short * 0.5)
        }
      }
    }
  })

  it('in the open regions two places never share one view, so a text is always read alone', () => {
    for (const [w, h] of [
      [390, 844],
      [360, 740],
      [430, 932],
      [1280, 800],
    ] as const) {
      for (const cycle of [1, 2, 3, 7, 42]) {
        const world = buildWorld(w, h, cycle)
        for (const id of ['cordillera', 'cielo'] as const) {
          const s = regionScale(id)
          const ps = world.places.filter((p) => p.region === id)
          for (const a of ps)
            for (const b of ps) {
              if (a.n >= b.n) continue
              const together = Math.abs(a.x - b.x) < (w / s) * 0.85 && Math.abs(a.y - b.y) < (h / s) * 0.75
              expect(together, `${id} ${a.n}/${b.n} on ${w}x${h}, cycle ${cycle}`).toBe(false)
            }
        }
      }
    }
  })

  it('on a wide screen the world is never narrower than the viewport and places still fit the text block', () => {
    const w = buildWorld(1280, 800, 1)
    expect(w.width).toBeGreaterThanOrEqual(1280)
    expect(w.short).toBe(400)
    for (const p of w.places) {
      expect(p.x - 240).toBeGreaterThanOrEqual(0)
      expect(p.x + 240).toBeLessThanOrEqual(w.width)
    }
    // Still starts at the bottom centre with nothing in view.
    for (const p of w.places) expect(p.y).toBeLessThan(w.start.y - 400)
  })
})
