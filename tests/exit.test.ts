import { beforeEach, describe, expect, it } from 'vitest'
import { resetConfig, setConfig } from '../src/gestures/config'
import { Exit, type ExitSnapshot } from '../src/world/exit'

beforeEach(() => resetConfig())

function make() {
  const log: ExitSnapshot[] = []
  const exit = new Exit((s) => log.push(s))
  return { exit, log }
}

describe('the exit and the Return', () => {
  it('dwell by words, then stillness, then the dissolution whitens and the reprise follows', () => {
    setConfig('CIELO_DWELL_BASE_MS', 1000)
    setConfig('CIELO_DWELL_PER_WORD_MS', 50)
    setConfig('CIELO_STILL_MS', 500)
    setConfig('CIELO_FADE_MS', 1000)
    setConfig('REPRISE_MS', 2000)
    const { exit } = make()
    exit.arrive(0, 40) // dwell = 3000
    exit.tick(2999, false, false)
    expect(exit.current).toBe('dwelling')
    exit.tick(3001, false, false) // dwell over, stillness since 0 already > 500
    expect(exit.current).toBe('dissolving')
    exit.tick(3501, false, false)
    expect(exit.whiteness).toBeCloseTo(0.5, 1)
    exit.tick(4001, false, false)
    expect(exit.current).toBe('reprise')
    expect(exit.whiteness).toBe(1)
    exit.tick(6002, false, false)
    expect(exit.current).toBe('seal')
    exit.openColofon()
    expect(exit.current).toBe('colofon')
  })

  it('a touch during the dwell restarts stillness, a touch during the dissolution cancels and restores', () => {
    setConfig('CIELO_DWELL_BASE_MS', 100)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 1000)
    setConfig('CIELO_FADE_MS', 2000)
    setConfig('RESTORE_MS', 400)
    const { exit } = make()
    exit.arrive(0, 10)
    exit.touch(600)
    exit.tick(1500, false, false) // 900 ms still: not yet
    expect(exit.current).toBe('dwelling')
    exit.tick(1601, false, false)
    expect(exit.current).toBe('dissolving')
    exit.tick(2601, false, false)
    expect(exit.whiteness).toBeCloseTo(0.5, 1)
    exit.touch(2650)
    expect(exit.current).toBe('dwelling')
    exit.tick(2850, false, false)
    expect(exit.whiteness).toBeLessThan(0.5)
    exit.tick(3100, false, false)
    expect(exit.whiteness).toBe(0)
    // Stillness counts again from the touch.
    exit.tick(3600, false, false)
    expect(exit.current).toBe('dwelling')
    exit.tick(3651, false, false)
    expect(exit.current).toBe('dissolving')
  })

  it('never dissolves for a keyboard user; Avanzar steps the Return', () => {
    setConfig('CIELO_DWELL_BASE_MS', 10)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 10)
    const { exit } = make()
    exit.arrive(0, 5)
    exit.tick(10_000, false, true)
    expect(exit.current).toBe('dwelling')
    exit.advance(10_000)
    expect(exit.current).toBe('dissolving')
    exit.advance(10_100)
    expect(exit.current).toBe('reprise')
    expect(exit.whiteness).toBe(1)
    exit.tick(60_000, false, true)
    expect(exit.current).toBe('reprise') // the reprise waits for the keyboard user
    exit.advance(60_000)
    expect(exit.current).toBe('seal')
    exit.advance(60_001)
    expect(exit.current).toBe('colofon')
  })

  it('a pointer held down keeps the stillness from counting', () => {
    setConfig('CIELO_DWELL_BASE_MS', 10)
    setConfig('CIELO_DWELL_PER_WORD_MS', 0)
    setConfig('CIELO_STILL_MS', 100)
    const { exit } = make()
    exit.arrive(0, 1)
    for (let t = 20; t < 2000; t += 20) exit.tick(t, true, false)
    expect(exit.current).toBe('dwelling')
    exit.tick(2101, false, false)
    expect(exit.current).toBe('dissolving')
  })
})
