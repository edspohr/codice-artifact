import { beforeEach, describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { config, resetConfig } from '../src/gestures/config'
import { placePlaces } from '../src/world/geography'
import { buildWorld } from '../src/world/world'

beforeEach(() => resetConfig())

const marFragments = canon.fragments.slice(0, 4)
const VIEW_W = 390
const VIEW_H = 844
const channel = { x: 0, y: 1266, w: Math.round(VIEW_W * 1.4), h: VIEW_H * 4 }

describe('geography', () => {
  it('is a deterministic function of the cycle', () => {
    const a = placePlaces({ cycle: 1, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H })
    const b = placePlaces({ cycle: 1, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H })
    const c = placePlaces({ cycle: 2, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H })
    expect(a.map((p) => [p.x, p.y])).toEqual(b.map((p) => [p.x, p.y]))
    expect(a.map((p) => [p.x, p.y])).not.toEqual(c.map((p) => [p.x, p.y]))
    expect(a.map((p) => p.stamp)).toEqual(b.map((p) => p.stamp))
  })

  it('keeps places inside the channel, off the edges and apart from each other', () => {
    for (const cycle of [1, 2, 3, 7, 42]) {
      const places = placePlaces({ cycle, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H })
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
      const places = placePlaces({ cycle, region: 'mar', rect: channel, fragments: marFragments, short: VIEW_W, viewH: VIEW_H })
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
      const first = w.places[0]!
      const d = Math.hypot(first.x - w.start.x, first.y - w.start.y)
      expect(d).toBeLessThanOrEqual(1.15 * VIEW_H)
      expect(d).toBeGreaterThan(config.EMERGE_DISTANCE * w.short)
      // Out of the starting viewport.
      expect(first.y).toBeLessThan(w.start.y - VIEW_H / 2)
      // No place is in view or emerged at the start.
      for (const p of w.places) {
        expect(Math.hypot(p.x - w.start.x, p.y - w.start.y)).toBeGreaterThan(config.EMERGE_DISTANCE * w.short)
      }
    }
  })

  it('puts fragment 22 at the far top of its region', () => {
    const cielo = canon.fragments.slice(16, 22)
    const rect = { x: 0, y: 0, w: 546, h: VIEW_H * 4 }
    const places = placePlaces({ cycle: 1, region: 'cielo', rect, fragments: cielo, short: VIEW_W, viewH: VIEW_H })
    const exit = places.find((p) => p.n === 22)!
    for (const p of places) if (p.n !== 22) expect(p.y).toBeGreaterThan(exit.y)
  })

  it('builds Mar as a 1.4×4 channel with a stub above and the start at the bottom centre, in dense ink', () => {
    const w = buildWorld(VIEW_W, VIEW_H, 1)
    expect(w.regions[0]!.rect).toEqual({ x: 0, y: 1266, w: 546, h: 3376 })
    expect(w.width).toBe(546)
    expect(w.height).toBe(1266 + 3376)
    expect(w.places.map((p) => p.n)).toEqual([1, 2, 3, 4])
    expect(w.start).toEqual({ x: 273, y: 1266 + 3376 - 422 })
    expect(w.thresholds[0]!.fragments).toEqual([1, 2, 3, 4])
  })
})
