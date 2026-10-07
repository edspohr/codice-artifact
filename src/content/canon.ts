// Typed, validated access to the canon. The JSON file itself is read-only
// for everyone except the author; this module only reads it.
import raw from './codice.canon.json'

export type MovementId = 'mar' | 'tierra' | 'cordillera' | 'cielo'

export interface Movement {
  id: MovementId
  order: number
  title: string
  fragments: number[]
}

export interface Fragment {
  n: number
  seal: string
  movement: MovementId
  laminaCue: string
  lines: string[]
}

export interface Canon {
  title: string
  author: string
  epigraph: string[]
  reprise: string[]
  movements: Movement[]
  fragments: Fragment[]
}

const MOVEMENT_IDS: readonly MovementId[] = ['mar', 'tierra', 'cordillera', 'cielo']

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === 'string' && s.length > 0)
}

/** Structural validation. Throws with a precise message on any violation. */
export function assertCanon(input: unknown): asserts input is Canon {
  if (typeof input !== 'object' || input === null) throw new Error('canon: not an object')
  const c = input as Record<string, unknown>
  if (typeof c.title !== 'string' || !c.title) throw new Error('canon: missing title')
  if (typeof c.author !== 'string' || !c.author) throw new Error('canon: missing author')
  if (!isStringArray(c.epigraph) || c.epigraph.length === 0) throw new Error('canon: bad epigraph')
  if (!isStringArray(c.reprise) || c.reprise.length === 0) throw new Error('canon: bad reprise')
  if (!Array.isArray(c.movements) || c.movements.length !== 4) throw new Error('canon: expected 4 movements')
  if (!Array.isArray(c.fragments) || c.fragments.length !== 22) throw new Error('canon: expected 22 fragments')

  const movements = c.movements as Movement[]
  movements.forEach((m, i) => {
    if (m.id !== MOVEMENT_IDS[i]) throw new Error(`canon: movement ${i} has id ${m.id}`)
    if (m.order !== i + 1) throw new Error(`canon: movement ${m.id} order ${m.order}`)
    if (typeof m.title !== 'string' || !m.title) throw new Error(`canon: movement ${m.id} title`)
    if (!Array.isArray(m.fragments) || m.fragments.length === 0) throw new Error(`canon: movement ${m.id} fragments`)
  })
  const covered = movements.flatMap((m) => m.fragments)
  if (covered.join(',') !== Array.from({ length: 22 }, (_, i) => i + 1).join(',')) {
    throw new Error('canon: movements must cover fragments 1..22 in order')
  }

  const fragments = c.fragments as Fragment[]
  fragments.forEach((f, i) => {
    const n = i + 1
    if (f.n !== n) throw new Error(`canon: fragment at index ${i} has n=${f.n}`)
    const expectedSeal = n === 22 ? '0' : toRoman(n)
    if (f.seal !== expectedSeal) throw new Error(`canon: fragment ${n} seal ${f.seal}, expected ${expectedSeal}`)
    const movement = movements.find((m) => m.id === f.movement)
    if (!movement) throw new Error(`canon: fragment ${n} unknown movement ${f.movement}`)
    if (!movement.fragments.includes(n)) throw new Error(`canon: fragment ${n} not listed under ${f.movement}`)
    if (typeof f.laminaCue !== 'string') throw new Error(`canon: fragment ${n} laminaCue`)
    if (!isStringArray(f.lines) || f.lines.length === 0) throw new Error(`canon: fragment ${n} lines`)
  })
}

export function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  let rest = n
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph
      rest -= value
    }
  }
  return out
}

assertCanon(raw)

export const canon: Canon = raw

export function fragmentByN(n: number): Fragment {
  const f = canon.fragments[n - 1]
  if (!f || f.n !== n) throw new Error(`fragment ${n} not found`)
  return f
}

export function movementById(id: MovementId): Movement {
  const m = canon.movements.find((x) => x.id === id)
  if (!m) throw new Error(`movement ${id} not found`)
  return m
}
