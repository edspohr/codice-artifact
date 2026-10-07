import type { MovementId } from './canon'

// Phase 1: neutral procedural placeholders rendered at build time into
// public/laminas/placeholder/. Later phases swap the base path for the
// current cycle's generated set.
const BASE = '/laminas/placeholder'

export function laminaSrc(n: number): string {
  return `${BASE}/${n}.webp`
}

export function motherLaminaSrc(movement: MovementId): string {
  return `${BASE}/mother-${movement}.webp`
}
