// The patina delta: what a visit sends, and its strict validation. Pure, no
// Firebase imports, so it is unit-tested directly.
//
// The grid is the same for every visitor whatever their screen: each region
// is COLS × ROWS cells over normalized coordinates (u across, v down).
// Two layers per cell: `h` (handled: how much the ink was worked there, in
// screens of finger slip) and `l` (lingered: seconds spent at rest there).

export const REGIONS = ['mar', 'tierra', 'cordillera', 'cielo'] as const
export type RegionId = (typeof REGIONS)[number]
export const COLS = 8
export const ROWS = 64
export const CELLS = COLS * ROWS

/** Caps: per cell per call, per call in total, per session in total. */
export const CELL_CAP = 4
export const CALL_CAP = 60
export const SESSION_CAP = 400
/** Rate limits per session. */
export const MIN_INTERVAL_MS = 2000
export const MAX_CALLS = 40

export interface RegionDelta {
  h: Array<[number, number]>
  l: Array<[number, number]>
}

export interface PatinaDelta {
  cycle: number
  sessionId: string
  regions: Partial<Record<RegionId, RegionDelta>>
}

export interface Validated {
  cycle: number
  sessionId: string
  /** Per region, per layer: cell → amount (clamped). */
  regions: Partial<Record<RegionId, { h: Map<number, number>; l: Map<number, number> }>>
  total: number
}

export class DeltaError extends Error {}

const SESSION_RE = /^[A-Za-z0-9-]{16,40}$/

function layer(raw: unknown, name: string): Map<number, number> {
  const out = new Map<number, number>()
  if (raw === undefined) return out
  if (!Array.isArray(raw)) throw new DeltaError(`${name}: not an array`)
  if (raw.length > CELLS) throw new DeltaError(`${name}: too many cells`)
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new DeltaError(`${name}: bad pair`)
    const [cell, value] = pair as [unknown, unknown]
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= CELLS) throw new DeltaError(`${name}: bad cell`)
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new DeltaError(`${name}: bad value`)
    out.set(cell, Math.min(CELL_CAP, (out.get(cell) ?? 0) + value))
  }
  return out
}

/** Validates and clamps a raw payload. Throws DeltaError on anything malformed. */
export function validateDelta(raw: unknown): Validated {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new DeltaError('payload: not an object')
  const p = raw as Record<string, unknown>
  const allowed = new Set(['cycle', 'sessionId', 'regions'])
  for (const k of Object.keys(p)) if (!allowed.has(k)) throw new DeltaError(`payload: unknown key ${k}`)
  if (typeof p.cycle !== 'number' || !Number.isInteger(p.cycle) || p.cycle < 1) throw new DeltaError('cycle: bad')
  if (typeof p.sessionId !== 'string' || !SESSION_RE.test(p.sessionId)) throw new DeltaError('sessionId: bad')
  if (typeof p.regions !== 'object' || p.regions === null || Array.isArray(p.regions)) throw new DeltaError('regions: bad')
  const regions: Validated['regions'] = {}
  let total = 0
  for (const [id, value] of Object.entries(p.regions as Record<string, unknown>)) {
    if (!(REGIONS as readonly string[]).includes(id)) throw new DeltaError(`regions: unknown ${id}`)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DeltaError(`${id}: bad`)
    const v = value as Record<string, unknown>
    for (const k of Object.keys(v)) if (k !== 'h' && k !== 'l') throw new DeltaError(`${id}: unknown layer ${k}`)
    const h = layer(v.h, `${id}.h`)
    const l = layer(v.l, `${id}.l`)
    for (const m of [h, l]) for (const x of m.values()) total += x
    regions[id as RegionId] = { h, l }
  }
  // The call cap scales every amount down proportionally rather than rejecting.
  if (total > CALL_CAP) {
    const k = CALL_CAP / total
    for (const r of Object.values(regions)) for (const m of [r!.h, r!.l]) for (const [c, x] of m) m.set(c, x * k)
    total = CALL_CAP
  }
  return { cycle: p.cycle, sessionId: p.sessionId, regions, total }
}

/** Scales a validated delta to what the session still has room for. Returns the scale applied. */
export function capToSession(delta: Validated, sessionSpent: number): number {
  const room = Math.max(0, SESSION_CAP - sessionSpent)
  if (delta.total <= room) return 1
  const k = delta.total > 0 ? room / delta.total : 0
  for (const r of Object.values(delta.regions)) for (const m of [r!.h, r!.l]) for (const [c, x] of m) m.set(c, x * k)
  delta.total = room
  return k
}
