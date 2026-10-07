import { beforeEach, describe, expect, it } from 'vitest'
import { cieloDwellMs, config, resetConfig, setConfig } from '../../src/gestures/config'
import { createDriftRecognizer } from '../../src/gestures/drift'
import { createFractureRecognizer } from '../../src/gestures/fracture'
import { createPullRecognizer, progressForPull } from '../../src/gestures/pull'
import { createStillnessRecognizer } from '../../src/gestures/stillness'
import { fakeContext, s } from './harness'

beforeEach(() => resetConfig())

describe('config', () => {
  it('computes the Cielo dwell from base and per-word time', () => {
    setConfig('CIELO_DWELL_BASE_MS', 1000)
    setConfig('CIELO_DWELL_PER_WORD_MS', 50)
    expect(cieloDwellMs(40)).toBe(3000)
    expect(cieloDwellMs(0)).toBe(1000)
  })
  it('rejects unknown keys and non-finite values', () => {
    expect(() => setConfig('NOPE' as never, 1)).toThrow()
    expect(() => setConfig('STALL_CUE_MS', Number.NaN)).toThrow()
  })
})

describe('Mar: drift', () => {
  it('commits when the drift covers the commit fraction', () => {
    const ctx = fakeContext()
    const r = createDriftRecognizer()
    r.start!(ctx, s(300, 400, 0))
    r.move!(ctx, s(250, 400, 50), [])
    expect(ctx.progress).toBeCloseTo(50 / (390 * config.DRIFT_COMMIT_FRACTION), 3)
    expect(ctx.commits).toBe(0)
    r.move!(ctx, s(300 - 390 * config.DRIFT_COMMIT_FRACTION, 400, 200), [])
    expect(ctx.commits).toBe(1)
  })
  it('snaps back on a short slow release, commits on a flick', () => {
    const ctx = fakeContext()
    const r = createDriftRecognizer()
    r.start!(ctx, s(300, 400, 0))
    r.move!(ctx, s(280, 400, 100), [])
    r.end!(ctx, s(280, 400, 120), [], { vx: -0.1, vy: 0 })
    expect(ctx.snaps).toBe(1)
    expect(ctx.commits).toBe(0)

    r.start!(ctx, s(300, 400, 500))
    r.move!(ctx, s(260, 400, 540), [])
    r.end!(ctx, s(260, 400, 560), [], { vx: -1.5, vy: 0 })
    expect(ctx.commits).toBe(1)
  })
  it('ignores rightward motion', () => {
    const ctx = fakeContext()
    const r = createDriftRecognizer()
    r.start!(ctx, s(100, 400, 0))
    r.move!(ctx, s(300, 400, 100), [])
    expect(ctx.progress).toBe(0)
  })
})

describe('Tierra: fracture by insistence', () => {
  it('never breaks with a single stroke, however long', () => {
    const ctx = fakeContext()
    const r = createFractureRecognizer()
    r.mount!(ctx, 0)
    r.start!(ctx, s(10, 400, 0))
    for (let i = 1; i <= 100; i++) r.move!(ctx, s(10 + i * 30, 400 + (i % 2) * 20, i * 10), [])
    expect(ctx.progress).toBeLessThanOrEqual(config.FRACTURE_STROKE_CAP)
    r.end!(ctx, s(3010, 400, 1010), [], { vx: 0, vy: 0 })
    expect(ctx.commits).toBe(0)
    expect(ctx.progress).toBeCloseTo(config.FRACTURE_STROKE_CAP, 5)
  })
  it('accumulates across strokes and commits when the view gives way', () => {
    const ctx = fakeContext()
    const r = createFractureRecognizer()
    r.mount!(ctx, 0)
    const stroke = (t0: number) => {
      r.start!(ctx, s(20, 300, t0))
      for (let i = 1; i <= 40; i++) r.move!(ctx, s(20 + i * 20, 300 + (i % 3) * 10, t0 + i * 8), [])
      r.end!(ctx, s(820, 300, t0 + 340), [], { vx: 0, vy: 0 })
    }
    stroke(0)
    expect(ctx.commits).toBe(0)
    stroke(400)
    expect(ctx.commits).toBe(0)
    stroke(800)
    expect(ctx.commits).toBe(1)
  })
  it('heals slowly after the finger lifts, after a grace delay', () => {
    const ctx = fakeContext()
    const r = createFractureRecognizer()
    r.mount!(ctx, 0)
    r.start!(ctx, s(20, 300, 0))
    for (let i = 1; i <= 40; i++) r.move!(ctx, s(20 + i * 20, 300, i * 8), [])
    r.end!(ctx, s(820, 300, 340), [], { vx: 0, vy: 0 })
    const before = ctx.progress
    expect(before).toBeGreaterThan(0)
    r.tick!(ctx, 340 + 100, 100)
    expect(ctx.progress).toBe(before) // inside the grace delay
    r.tick!(ctx, 340 + config.FRACTURE_HEAL_DELAY_MS + 1000, 1000)
    expect(ctx.progress).toBeCloseTo(before - config.FRACTURE_HEAL_PER_S, 5)
  })
})

describe('Cordillera: pull with resistance', () => {
  it('maps distance sub-linearly', () => {
    const r = config.PULL_RESISTANCE_PX
    expect(progressForPull(0)).toBe(0)
    expect(progressForPull(r)).toBeCloseTo(1 - Math.E ** -1, 5)
    expect(progressForPull(2 * r) - progressForPull(r)).toBeLessThan(progressForPull(r))
  })
  it('commits on a long pull and snaps back on a short one', () => {
    const ctx = fakeContext()
    const r = createPullRecognizer()
    r.mount!(ctx, 0)
    r.start!(ctx, s(200, 700, 0))
    r.move!(ctx, s(200, 600, 100), [])
    r.end!(ctx, s(200, 600, 120), [], { vx: 0, vy: 0 })
    expect(ctx.snaps).toBe(1)
    expect(ctx.commits).toBe(0)

    r.start!(ctx, s(200, 800, 500))
    const needed = -config.PULL_RESISTANCE_PX * Math.log(1 - config.PULL_COMMIT_PROGRESS)
    r.move!(ctx, s(200, 800 - needed - 1, 900), [])
    expect(ctx.commits).toBe(1)
  })
  it('carries inertia after release and can crest', () => {
    const ctx = fakeContext()
    const r = createPullRecognizer()
    r.mount!(ctx, 0)
    r.start!(ctx, s(200, 800, 0))
    r.move!(ctx, s(200, 500, 150), [])
    r.end!(ctx, s(200, 500, 160), [], { vx: 0, vy: -2.5 })
    let now = 160
    for (let i = 0; i < 120 && ctx.commits === 0 && ctx.snaps === 0; i++) {
      now += 16
      r.tick!(ctx, now, 16)
    }
    expect(ctx.commits).toBe(1)
  })
})

describe('Cielo: stillness', () => {
  it('never counts stillness before the dwell, then fades and commits', () => {
    setConfig('CIELO_DWELL_BASE_MS', 1000)
    setConfig('CIELO_DWELL_PER_WORD_MS', 50)
    setConfig('CIELO_STILL_MS', 1000)
    setConfig('CIELO_FADE_MS', 1000)
    const ctx = fakeContext()
    const r = createStillnessRecognizer(40) // dwell = 3000
    r.mount!(ctx, 0)
    r.tick!(ctx, 2999, 16)
    expect(ctx.progress).toBe(0)
    r.tick!(ctx, 3001, 16) // dwell passed; stillness since 0 already > 1000 → fade starts
    r.tick!(ctx, 3501, 16)
    expect(ctx.progress).toBeCloseTo(0.5, 1)
    r.tick!(ctx, 4001, 16)
    expect(ctx.commits).toBe(1)
  })
  it('a touch during the dwell restarts the stillness timer, never the dwell', () => {
    setConfig('CIELO_DWELL_BASE_MS', 3000)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 500)
    setConfig('CIELO_FADE_MS', 1000)
    const ctx = fakeContext()
    const r = createStillnessRecognizer(10)
    r.mount!(ctx, 0)
    // Touches at 1000 and 2800 ms, well inside the dwell.
    r.start!(ctx, s(50, 50, 1000))
    r.end!(ctx, s(50, 50, 1050), [], { vx: 0, vy: 0 })
    r.start!(ctx, s(50, 50, 2800))
    r.end!(ctx, s(50, 50, 2850), [], { vx: 0, vy: 0 })
    r.tick!(ctx, 2999, 16)
    expect(ctx.progress).toBe(0)
    // Dwell ends at 3000 from mount; stillness since the last touch (2850) reaches 500 at 3350.
    r.tick!(ctx, 3300, 16)
    expect(ctx.progress).toBe(0)
    r.tick!(ctx, 3351, 16)
    r.tick!(ctx, 3851, 16)
    expect(ctx.progress).toBeCloseTo(0.5, 1)
    // Had the touches restarted the dwell, nothing would move before 2850 + 3000.
    expect(ctx.commits).toBe(0)
    r.tick!(ctx, 4351, 16)
    expect(ctx.commits).toBe(1)
  })

  it('restarts stillness after a touch and cancels a fade on touch', () => {
    setConfig('CIELO_DWELL_BASE_MS', 100)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 1000)
    setConfig('CIELO_FADE_MS', 2000)
    const ctx = fakeContext()
    const r = createStillnessRecognizer(1)
    r.mount!(ctx, 0)
    r.start!(ctx, s(100, 100, 500))
    r.end!(ctx, s(100, 100, 600), [], { vx: 0, vy: 0 })
    r.tick!(ctx, 1500, 16) // still 900 ms since touch: not yet
    expect(ctx.progress).toBe(0)
    r.tick!(ctx, 1601, 16) // fade starts
    r.tick!(ctx, 2601, 16)
    expect(ctx.progress).toBeCloseTo(0.5, 1)
    r.start!(ctx, s(100, 100, 2650)) // touch during the fade
    expect(ctx.snaps).toBe(1)
    expect(ctx.progress).toBe(0)
    r.end!(ctx, s(100, 100, 2700), [], { vx: 0, vy: 0 })
    r.tick!(ctx, 3600, 16)
    expect(ctx.progress).toBe(0) // only 900 ms still
    r.tick!(ctx, 3701, 16)
    r.tick!(ctx, 5701, 16)
    expect(ctx.commits).toBe(1)
  })
  it('never auto-advances a keyboard user', () => {
    setConfig('CIELO_DWELL_BASE_MS', 10)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 10)
    setConfig('CIELO_FADE_MS', 10)
    const ctx = fakeContext()
    ctx._keyboardUser = true
    const r = createStillnessRecognizer(1)
    r.mount!(ctx, 0)
    r.tick!(ctx, 10_000, 16)
    r.tick!(ctx, 20_000, 16)
    expect(ctx.progress).toBe(0)
    expect(ctx.commits).toBe(0)
  })
})
