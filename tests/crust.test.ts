import { beforeEach, describe, expect, it } from 'vitest'
import { config, resetConfig, setConfig } from '../src/gestures/config'
import { blockingFloor, buildCrust, CrustState } from '../src/world/crust'

beforeEach(() => resetConfig())

const region = { x: 0, y: 1000, w: 546, h: 4220 } // 5 screens of 844
const VIEW_H = 844

describe("Tierra's crust", () => {
  it('lays seeded fracture lines inside the region, deterministic per cycle, clear of the entry and the threshold', () => {
    const a = buildCrust(region, VIEW_H, 1)
    const b = buildCrust(region, VIEW_H, 1)
    const c = buildCrust(region, VIEW_H, 2)
    expect(a.lines.map((l) => l.y)).toEqual(b.lines.map((l) => l.y))
    expect(a.lines.map((l) => l.y)).not.toEqual(c.lines.map((l) => l.y))
    expect(a.lines.length).toBeGreaterThanOrEqual(3)
    for (const l of a.lines) {
      expect(l.y).toBeGreaterThanOrEqual(region.y + VIEW_H * 0.9)
      expect(l.y).toBeLessThanOrEqual(region.y + region.h - VIEW_H * config.TIERRA_ENTRY_CLEAR)
      expect(l.integrity).toBe(1)
      expect(l.broken).toBe(false)
    }
  })

  it('a standing line blocks the way up and keeps itself in view; a broken one does not', () => {
    const crust = buildCrust(region, VIEW_H, 1)
    const lowest = crust.lines[0]!
    const limit = lowest.y + VIEW_H * config.TIERRA_BLOCK_OFFSET
    expect(blockingFloor(crust, limit + 500, VIEW_H)).toBe(limit)
    // Already above the line: it does not catch the viewpoint on the way down.
    expect(blockingFloor(crust, limit - 50, VIEW_H)).not.toBe(limit)
    lowest.broken = true
    expect(blockingFloor(crust, limit + 500, VIEW_H)).not.toBe(limit)
  })

  it('one stroke never breaks a line; crossings accumulate across strokes; a broken line stays broken', () => {
    setConfig('TIERRA_STROKE_CAP', 0.4)
    setConfig('TIERRA_DAMAGE_PER_CROSS', 0.15)
    setConfig('TIERRA_HEAL_PER_S', 0)
    const crust = buildCrust(region, VIEW_H, 1)
    const state = new CrustState(crust)
    const line = crust.lines[0]!
    const cross = (t: number) => {
      state.strokeStart()
      for (let i = 0; i < 10; i++) state.strokeSegment({ x: 100 + i, y: line.y - 20 }, { x: 101 + i, y: line.y + 20 }, t + i)
      state.strokeEnd(t + 20)
    }
    cross(0)
    expect(line.integrity).toBeCloseTo(0.6, 5)
    expect(line.broken).toBe(false)
    cross(1000)
    expect(line.integrity).toBeCloseTo(0.2, 5)
    cross(2000)
    expect(line.integrity).toBe(0)
    expect(line.broken).toBe(true)
    cross(3000)
    expect(line.broken).toBe(true)
    // A stroke that does not cross a line leaves it alone.
    const other = crust.lines[1]!
    state.strokeStart()
    state.strokeSegment({ x: 10, y: other.y + 300 }, { x: 200, y: other.y + 300 }, 4000)
    expect(other.integrity).toBe(1)
  })

  it('pushing against a standing line damages it, within the per-stroke cap', () => {
    setConfig('TIERRA_STROKE_CAP', 0.4)
    setConfig('TIERRA_PUSH_PX_PER_UNIT', 1000)
    const crust = buildCrust(region, VIEW_H, 1)
    const state = new CrustState(crust)
    const line = crust.lines[0]!
    state.strokeStart()
    state.push(line, 200, 0)
    expect(line.integrity).toBeCloseTo(0.8, 5)
    state.push(line, 5000, 10)
    expect(line.integrity).toBeCloseTo(0.6, 5) // capped at 0.4 per stroke
    state.strokeEnd(20)
    state.strokeStart()
    state.push(line, 5000, 30)
    state.strokeEnd(40)
    state.strokeStart()
    state.push(line, 5000, 50)
    expect(line.broken).toBe(true)
  })

  it('standing lines heal slowly after a grace delay; broken lines never heal', () => {
    setConfig('TIERRA_STROKE_CAP', 1)
    setConfig('TIERRA_DAMAGE_PER_CROSS', 0.5)
    setConfig('TIERRA_HEAL_PER_S', 0.1)
    setConfig('TIERRA_HEAL_DELAY_MS', 500)
    const crust = buildCrust(region, VIEW_H, 1)
    const state = new CrustState(crust)
    const line = crust.lines[0]!
    state.strokeStart()
    state.strokeSegment({ x: 0, y: line.y - 5 }, { x: 1, y: line.y + 5 }, 0)
    state.strokeEnd(0)
    expect(line.integrity).toBe(0.5)
    expect(state.tick(400, 400)).toBe(false)
    expect(line.integrity).toBe(0.5)
    expect(state.tick(1500, 1000)).toBe(true)
    expect(line.integrity).toBeCloseTo(0.6, 5)
    const broken = crust.lines[1]!
    broken.integrity = 0
    broken.broken = true
    state.tick(3000, 1000)
    expect(broken.integrity).toBe(0)
  })
})
