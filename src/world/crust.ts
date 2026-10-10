// Tierra's crust: seeded fracture lines across the channel that block the
// way up. A stroke of the finger that crosses a line damages it, one stroke
// is never enough, lines heal slowly while they stand, and a broken line
// stays broken for the session. What you broke stays broken.
import { config } from '../gestures/config'
import { hashSeed, rng } from './rng'
import type { Rect, Vec2 } from './types'

export interface CrustLine {
  /** World y of the line. */
  y: number
  /** Seeded jaggedness phase for rendering. */
  seed: number
  /** 1 intact, 0 broken. */
  integrity: number
  broken: boolean
}

export interface Crust {
  lines: CrustLine[]
}

/**
 * One fracture in the middle of each gap between consecutive places,
 * starting after the region's first place, so the rhythm is even: a place,
 * a wall, a place, a wall. Seeded jitter keeps it from reading as a grid,
 * and never brings a line within the clearance of a text block.
 */
export function buildCrust(region: Rect, viewH: number, cycle: number, placeYs: readonly number[] = []): Crust {
  const random = rng(hashSeed('crust', cycle))
  const ys = [...placeYs].sort((a, b) => b - a) // bottom first
  const clearance = viewH * config.TIERRA_PLACE_CLEARANCE
  const lines: CrustLine[] = []
  for (let i = 0; i + 1 < ys.length; i++) {
    const lower = ys[i]!
    const upper = ys[i + 1]!
    const mid = (lower + upper) / 2
    const room = Math.max(0, (lower - upper) / 2 - clearance)
    const y = mid + (random() - 0.5) * 2 * Math.min(room, viewH * 0.1)
    if (lower - upper < 2 * clearance) continue
    lines.push({ y, seed: Math.floor(random() * 1000), integrity: 1, broken: false })
  }
  if (ys.length === 0) {
    // No places given (tests): evenly spaced lines.
    const count = Math.max(1, Math.round((region.h / viewH) * config.TIERRA_LINES_PER_SCREEN))
    const top = region.y + viewH * 0.9
    const bottom = region.y + region.h - viewH * config.TIERRA_ENTRY_CLEAR
    for (let i = 0; i < count; i++) {
      const slot = count > 1 ? bottom - (i * (bottom - top)) / (count - 1) : (top + bottom) / 2
      const y = Math.min(bottom, Math.max(top, slot + (random() - 0.5) * viewH * 0.2))
      lines.push({ y, seed: Math.floor(random() * 1000), integrity: 1, broken: false })
    }
  }
  lines.sort((a, b) => b.y - a.y)
  return { lines }
}

/** The standing line that holds the viewpoint from below, with the lowest y the viewpoint may reach. */
export function blockingLine(crust: Crust, cameraY: number, viewH: number): { line: CrustLine; limit: number } | null {
  let best: { line: CrustLine; limit: number } | null = null
  for (const line of crust.lines) {
    if (line.broken) continue
    const limit = line.y + viewH * config.TIERRA_BLOCK_OFFSET
    // A line blocks only from below: once the viewpoint is above it, it does not catch it on the way down.
    if (cameraY >= limit - 1 && (best === null || limit > best.limit)) best = { line, limit }
  }
  return best
}

/** The lowest y the viewpoint may reach (see blockingLine). */
export function blockingFloor(crust: Crust, cameraY: number, viewH: number): number | null {
  return blockingLine(crust, cameraY, viewH)?.limit ?? null
}

export class CrustState {
  readonly crust: Crust
  /** Damage dealt by the live stroke to each line (capped per stroke). */
  private strokeDamage = new Map<CrustLine, number>()
  private healAfter = 0

  constructor(crust: Crust) {
    this.crust = crust
  }

  strokeStart() {
    this.strokeDamage.clear()
  }

  /** A finger segment in world px (the finger, not the world). Damages every standing line it crosses. */
  strokeSegment(from: Vec2, to: Vec2, now: number): CrustLine[] {
    const hit: CrustLine[] = []
    for (const line of this.crust.lines) {
      if (line.broken) continue
      const crosses = (from.y - line.y) * (to.y - line.y) <= 0 && from.y !== to.y
      if (!crosses) continue
      const dealt = this.strokeDamage.get(line) ?? 0
      const add = Math.min(config.TIERRA_STROKE_CAP - dealt, config.TIERRA_DAMAGE_PER_CROSS)
      if (add <= 0) continue
      this.strokeDamage.set(line, dealt + add)
      line.integrity = Math.max(0, line.integrity - add)
      if (line.integrity <= 0) line.broken = true
      hit.push(line)
    }
    this.healAfter = now + config.TIERRA_HEAL_DELAY_MS
    return hit
  }

  /** Pushing against a standing line: blocked push in px becomes damage, within the per-stroke cap. */
  push(line: CrustLine, px: number, now: number): boolean {
    if (line.broken || px <= 0) return false
    const dealt = this.strokeDamage.get(line) ?? 0
    const add = Math.min(config.TIERRA_STROKE_CAP - dealt, px / Math.max(1, config.TIERRA_PUSH_PX_PER_UNIT))
    if (add <= 0) return false
    this.strokeDamage.set(line, dealt + add)
    line.integrity = Math.max(0, line.integrity - add)
    if (line.integrity <= 0) line.broken = true
    this.healAfter = now + config.TIERRA_HEAL_DELAY_MS
    return true
  }

  strokeEnd(now: number) {
    this.strokeDamage.clear()
    this.healAfter = now + config.TIERRA_HEAL_DELAY_MS
  }

  /** Standing lines heal slowly. Returns true while anything is healing. */
  tick(now: number, dtMs: number): boolean {
    if (now < this.healAfter) return false
    let healing = false
    for (const line of this.crust.lines) {
      if (line.broken || line.integrity >= 1) continue
      line.integrity = Math.min(1, line.integrity + (config.TIERRA_HEAL_PER_S * dtMs) / 1000)
      healing = true
    }
    return healing
  }
}
