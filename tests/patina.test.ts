import { describe, expect, it } from 'vitest'
import { PatinaCollector } from '../src/patina/collector'
import { CELLS, cellOf, COLS, ROWS } from '../src/patina/grid'
import { buildWorld } from '../src/world/world'

describe('patina grid and collector', () => {
  const world = buildWorld(390, 844, 1)
  const mar = world.regions.find((r) => r.id === 'mar')!.rect

  it('maps world points to the same normalized cells on any screen', () => {
    expect(cellOf(mar, mar.x, mar.y)).toBe(0)
    expect(cellOf(mar, mar.x + mar.w - 1, mar.y + mar.h - 1)).toBe(CELLS - 1)
    expect(cellOf(mar, mar.x + mar.w / 2, mar.y + mar.h / 2)).toBe((ROWS / 2) * COLS + COLS / 2)
    expect(cellOf(mar, mar.x - 1, mar.y)).toBeNull()
    const wide = buildWorld(1280, 800, 1).regions.find((r) => r.id === 'mar')!.rect
    expect(cellOf(wide, wide.x + wide.w / 2, wide.y + wide.h / 2)).toBe(cellOf(mar, mar.x + mar.w / 2, mar.y + mar.h / 2))
  })

  it('aggregates handling and lingering per cell, takes once, restores on failure', () => {
    const c = new PatinaCollector(world, 844)
    expect(c.sessionId).toMatch(/^[0-9a-f]{32}$/)
    const y = mar.y + mar.h / 2
    c.handled(100, y, 100 + 422, y) // half a screen of slip
    c.lingered(100, y, 3)
    expect(c.isEmpty).toBe(false)
    const p = c.take(1)!
    expect(p.cycle).toBe(1)
    expect(p.sessionId).toBe(c.sessionId)
    const [cell, h] = p.regions.mar!.h![0]!
    expect(h).toBeCloseTo(0.5, 3)
    expect(p.regions.mar!.l![0]![1]).toBe(3)
    expect(c.take(1)).toBeNull()
    c.restore(p)
    expect(c.take(1)!.regions.mar!.h!.find(([k]) => k === cell)![1]).toBeCloseTo(0.5, 3)
  })

  it('sends nothing for a visit that did nothing, and nothing that is not aggregated', () => {
    const c = new PatinaCollector(world, 844)
    expect(c.take(1)).toBeNull()
    c.handled(10, mar.y + 10, 30, mar.y + 10)
    const p = c.take(1)!
    // Only cells and amounts: no coordinates, no times, no order of events.
    expect(Object.keys(p)).toEqual(['cycle', 'sessionId', 'regions'])
    expect(Object.keys(p.regions.mar!)).toEqual(['h'])
  })
})
