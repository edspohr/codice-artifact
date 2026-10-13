// The view takes in more of the world as the territory opens: Mar and
// Tierra are seen close, Cordillera from further off, Cielo wide. The scale
// (screen px per world px) is a pure function of the viewpoint's height, so
// going back down closes the view again exactly. It changes gradually
// across each threshold, never as a pulled-back view. DOM text is never
// scaled: only its position follows the world.
import type { MovementId } from '../content/canon'
import { config } from '../gestures/config'
import type { Rect, World } from './types'

export function regionScale(id: MovementId): number {
  const s =
    id === 'mar'
      ? config.MAR_VIEW_SCALE
      : id === 'tierra'
        ? config.TIERRA_VIEW_SCALE
        : id === 'cordillera'
          ? config.CORDILLERA_VIEW_SCALE
          : config.CIELO_VIEW_SCALE
  return Math.max(0.3, Math.min(1.5, s))
}

function smooth(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/**
 * Weight of the region above a boundary at height y: 0 well below it, 1 well
 * above, smooth across the transition. `boundary` is the world y where the
 * region above ends (its rect bottom).
 */
function blendAt(y: number, boundary: number, span: number): number {
  return smooth((boundary + span / 2 - y) / Math.max(1, span))
}

/** The pair of regions a height belongs to and the weight of the upper one (0..1). */
export function regionBlend(world: World, y: number): { below: MovementId; above: MovementId; w: number } {
  const span = config.VIEW_SCALE_TRANSITION_SCREENS * world.viewH
  const regions = world.regions // bottom first
  for (let i = 0; i < regions.length - 1; i++) {
    const lower = regions[i]!
    const upper = regions[i + 1]!
    const boundary = upper.rect.y + upper.rect.h
    if (y > boundary + span / 2) return { below: lower.id, above: lower.id, w: 0 }
    if (y >= boundary - span / 2) return { below: lower.id, above: upper.id, w: blendAt(y, boundary, span) }
  }
  const top = regions[regions.length - 1]!.id
  return { below: top, above: top, w: 0 }
}

/** Screen px per world px at a height. */
export function scaleAt(world: World, y: number): number {
  const b = regionBlend(world, y)
  const lo = regionScale(b.below)
  const hi = regionScale(b.above)
  return lo + (hi - lo) * b.w
}

function rectOf(world: World, id: MovementId): Rect {
  return world.regions.find((r) => r.id === id)!.rect
}

/**
 * The lateral room of the viewpoint's centre at a height, for a view of
 * `viewWorldW` world px: the view stays inside the region, and across a
 * threshold the room widens gradually from the narrow channel to the open
 * region above (a mouth, not a step).
 */
export function lateralRange(world: World, y: number, viewWorldW: number): { min: number; max: number } {
  const b = regionBlend(world, y)
  const room = (r: Rect) => {
    const half = viewWorldW / 2
    const min = r.x + half
    const max = r.x + r.w - half
    if (min > max) return { min: r.x + r.w / 2, max: r.x + r.w / 2 }
    return { min, max }
  }
  const lo = room(rectOf(world, b.below))
  const hi = room(rectOf(world, b.above))
  return { min: lo.min + (hi.min - lo.min) * b.w, max: lo.max + (hi.max - lo.max) * b.w }
}
