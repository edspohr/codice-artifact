// Principle 3: text is never below WCAG AA contrast (4.5:1). The ink parts
// around text with a residual; this derives the worst case from the tokens
// and the default config, so a change to either that breaks the floor fails.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/gestures/config'

const tokens = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8')

function token(name: string): [number, number, number] {
  const m = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})`).exec(tokens)
  if (!m) throw new Error(`token ${name} missing`)
  const v = parseInt(m[1] as string, 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

describe('contrast floor', () => {
  const paper = token('--paper')
  const ink = token('--ink')
  const accent = token('--accent')

  it('ink on paper clears 4.5:1 by a wide margin', () => {
    expect(contrast(ink, paper)).toBeGreaterThan(12)
  })

  it('the worst ground left under text after clearing still gives 4.5:1', () => {
    // Full ink (density 1) attenuated to the residual, then mixed toward the accent at its strongest.
    const residual = defaultConfig.CLEAR_RESIDUAL
    const ground = mix(paper, ink, residual)
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5)
    const accented = mix(ground, accent, 0.35 + 0.65 * residual)
    // The accent is suppressed under clearing, but even unsuppressed it must not break the floor.
    expect(contrast(ink, accented)).toBeGreaterThanOrEqual(4.5)
  })

  it('reports the lightest text tone allowed on paper (for Cielo thinning in Phase 3)', () => {
    // Walk the ink→paper mix until the contrast drops below 4.5: that mix is the floor.
    let t = 0
    while (t < 1 && contrast(mix(ink, paper, t), paper) >= 4.5) t += 0.01
    const minAlpha = 1 - (t - 0.01)
    expect(minAlpha).toBeGreaterThan(0.45)
    expect(minAlpha).toBeLessThan(0.7)
  })
})
