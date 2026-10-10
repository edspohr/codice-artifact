import { describe, expect, it } from 'vitest'
import { CALL_CAP, capToSession, CELL_CAP, CELLS, DeltaError, SESSION_CAP, validateDelta } from './delta.js'

const sid = 'abcdefghijklmnop1234'

describe('patina delta validation', () => {
  it('accepts a well-formed delta and clamps cells', () => {
    const v = validateDelta({ cycle: 1, sessionId: sid, regions: { mar: { h: [[3, 1.5], [3, 9]], l: [[10, 2]] } } })
    expect(v.regions.mar!.h.get(3)).toBe(CELL_CAP)
    expect(v.regions.mar!.l.get(10)).toBe(2)
    expect(v.total).toBe(CELL_CAP + 2)
  })

  it('rejects anything malformed', () => {
    const bad: unknown[] = [
      null,
      [],
      { cycle: 0, sessionId: sid, regions: {} },
      { cycle: 1.5, sessionId: sid, regions: {} },
      { cycle: 1, sessionId: 'short', regions: {} },
      { cycle: 1, sessionId: 'has spaces in it 12345', regions: {} },
      { cycle: 1, sessionId: sid, regions: { atlantis: {} } },
      { cycle: 1, sessionId: sid, regions: { mar: { x: [] } } },
      { cycle: 1, sessionId: sid, regions: { mar: { h: [[CELLS, 1]] } } },
      { cycle: 1, sessionId: sid, regions: { mar: { h: [[-1, 1]] } } },
      { cycle: 1, sessionId: sid, regions: { mar: { h: [[1, -2]] } } },
      { cycle: 1, sessionId: sid, regions: { mar: { h: [[1, Number.NaN]] } } },
      { cycle: 1, sessionId: sid, regions: { mar: { h: [[1.2, 1]] } } },
      { cycle: 1, sessionId: sid, regions: {}, extra: true },
    ]
    for (const b of bad) expect(() => validateDelta(b), JSON.stringify(b)).toThrow(DeltaError)
  })

  it('scales a delta down to the call cap', () => {
    const h: Array<[number, number]> = Array.from({ length: 100 }, (_, i) => [i, 3])
    const v = validateDelta({ cycle: 1, sessionId: sid, regions: { tierra: { h } } })
    expect(v.total).toBe(CALL_CAP)
    const sum = [...v.regions.tierra!.h.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(CALL_CAP, 6)
  })

  it('no single session can exceed its cap', () => {
    const v = validateDelta({ cycle: 1, sessionId: sid, regions: { mar: { h: [[1, 4], [2, 4]] } } })
    expect(capToSession(v, SESSION_CAP - 2)).toBeCloseTo(0.25, 6)
    expect(v.total).toBe(2)
    const w = validateDelta({ cycle: 1, sessionId: sid, regions: { mar: { h: [[1, 4]] } } })
    capToSession(w, SESSION_CAP)
    expect(w.total).toBe(0)
  })
})
