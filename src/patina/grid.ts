// The patina grid: the same for every visitor whatever their screen. Each
// region is COLS × ROWS cells over normalized coordinates. Mirrors
// functions/src/delta.ts (keep in sync).
import type { MovementId } from '../content/canon'
import type { Rect } from '../world/types'

export const COLS = 8
export const ROWS = 64
export const CELLS = COLS * ROWS
export const REGIONS: MovementId[] = ['mar', 'tierra', 'cordillera', 'cielo']

export function cellOf(rect: Rect, x: number, y: number): number | null {
  const u = (x - rect.x) / rect.w
  const v = (y - rect.y) / rect.h
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return null
  return Math.floor(v * ROWS) * COLS + Math.floor(u * COLS)
}

export interface RegionGrid {
  h: Float32Array
  l: Float32Array
}

export function emptyGrid(): RegionGrid {
  return { h: new Float32Array(CELLS), l: new Float32Array(CELLS) }
}
