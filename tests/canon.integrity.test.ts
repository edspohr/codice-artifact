// The canon is inviolable. These tests fail on any byte change of the file
// and on any structural drift. Only the author re-seals the canon with
// `pnpm canon:seal`; agents never run it.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertCanon, canon, toRoman } from '../src/content/canon'

const root = resolve(__dirname, '..')
const canonPath = resolve(root, 'src/content/codice.canon.json')
const sealPath = resolve(root, 'src/content/codice.canon.sha256')

describe('canon seal', () => {
  it('matches the SHA-256 sealed by the author', () => {
    const digest = createHash('sha256').update(readFileSync(canonPath)).digest('hex')
    const sealed = readFileSync(sealPath, 'utf8').trim()
    expect(
      digest,
      'src/content/codice.canon.json changed. The canon is read-only for agents; only the author may edit it and re-seal it with `pnpm canon:seal`.',
    ).toBe(sealed)
  })
})

describe('canon structure', () => {
  it('validates the shipped canon', () => {
    expect(() => assertCanon(JSON.parse(readFileSync(canonPath, 'utf8')))).not.toThrow()
  })

  it('has 4 movements covering fragments 1..22 in order', () => {
    expect(canon.movements.map((m) => m.id)).toEqual(['mar', 'tierra', 'cordillera', 'cielo'])
    expect(canon.movements.flatMap((m) => m.fragments)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
  })

  it('seals I..XXI for fragments 1..21 and 0 for fragment 22', () => {
    for (const f of canon.fragments) {
      expect(f.seal).toBe(f.n === 22 ? '0' : toRoman(f.n))
    }
  })

  it('has no empty lines and keeps typographic characters', () => {
    for (const f of canon.fragments) {
      for (const line of f.lines) expect(line.trim().length).toBeGreaterThan(0)
    }
    const f10 = canon.fragments[9]
    expect(f10?.lines.some((l) => l.includes('’'))).toBe(true)
    const f17 = canon.fragments[16]
    expect(f17?.lines.some((l) => l.includes('"No"'))).toBe(true)
  })

  it('rejects a reordered or altered canon', () => {
    const copy = JSON.parse(readFileSync(canonPath, 'utf8'))
    const swapped = { ...copy, fragments: [copy.fragments[1], copy.fragments[0], ...copy.fragments.slice(2)] }
    expect(() => assertCanon(swapped)).toThrow()
    const wrongSeal = { ...copy, fragments: copy.fragments.map((f: { n: number }) => (f.n === 22 ? { ...f, seal: 'XXII' } : f)) }
    expect(() => assertCanon(wrongSeal)).toThrow()
  })
})
