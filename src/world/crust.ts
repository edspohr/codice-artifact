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

/** Lines evenly spaced along the region with seeded jitter, clear of the bottom entry and the top threshold. */
export function buildCrust(region: Rect, viewH: number, cycle: number): Crust {
  const random = rng(hashSeed('crust', cycle))
  const count = Math.max(1, Math.round((region.h / viewH) * config.TIERRA_LINES_PER_SCREEN))
  const top = region.y + viewH * 0.9
  const bottom = region.y + region.h - viewH * 1.1
  const span = Math.max(0, bottom - top)
  const lines: CrustLine[] = []
  for (let i = 0; i < count; i++) {
    const slot = count > 1 ? bottom - (i * span) / (count - 1) : (top + bottom) / 2
    const jitter = (random() - 0.5) * viewH * 0.2
    lines.push({ y: Math.min(bottom, Math.max(top, slot + jitter)), seed: Math.floor(random() * 1000), integrity: 1, broken: false })
  }
  lines.sort((a, b) => b.y - a.y) // bottom first
  return { lines }
}

/** The lowest y the viewpoint may reach: the first standing line below, offset so the line stays in view. */
export function blockingFloor(crust: Crust, cameraY: number, viewH: number): number | null {
  let floor: number | null = null
  for (const line of crust.lines) {
    if (line.broken) continue
    const limit = line.y + viewH * config.TIERRA_BLOCK_OFFSET
    // A line blocks only from below: once the viewpoint is above it, it does not catch it on the way down.
    if (cameraY >= limit - 1 && (floor === null || limit > floor)) floor = limit
  }
  return floor
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
