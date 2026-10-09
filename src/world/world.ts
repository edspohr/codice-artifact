// Builds the territory for a viewport and a cycle: four channels stacked
// from the bottom up (Mar → Tierra → Cordillera → Cielo), a threshold
// between each pair, the places of each region, the exit at the far top.
import { canon, type MovementId } from '../content/canon'
import { config } from '../gestures/config'
import { placePlaces } from './geography'
import type { Place, Rect, Region, Threshold, World } from './types'

const ORDER: MovementId[] = ['mar', 'tierra', 'cordillera', 'cielo']

function screensOf(id: MovementId): number {
  switch (id) {
    case 'mar':
      return config.MAR_SCREENS_H
    case 'tierra':
      return config.TIERRA_SCREENS_H
    case 'cordillera':
      return config.CORDILLERA_SCREENS_H
    case 'cielo':
      return config.CIELO_SCREENS_H
  }
}

export function buildWorld(viewportW: number, viewportH: number, cycle: number): World {
  // The channel is measured in portrait "screens": on a phone the viewport itself,
  // on a wide screen a portrait unit fitted to the viewport height. The world is
  // never narrower than the viewport, so ink always covers the whole view.
  const unitW = Math.min(viewportW, Math.round(viewportH * 0.5))
  const short = Math.min(unitW, viewportH)
  const width = Math.max(Math.round(unitW * config.MAR_SCREENS_W), Math.round(viewportW * config.WORLD_MIN_VIEW_WIDTHS))

  // Stack from the top down so y grows downward: Cielo first.
  const heights = ORDER.map((id) => Math.round(viewportH * screensOf(id)))
  const height = heights.reduce((a, b) => a + b, 0)
  const regions: Region[] = []
  let y = height
  ORDER.forEach((id, i) => {
    const h = heights[i] as number
    y -= h
    regions.push({ id, rect: { x: 0, y, w: width, h } })
  })

  const places: Place[] = []
  for (const region of regions) {
    const movement = canon.movements.find((m) => m.id === region.id)
    if (!movement) throw new Error(`world: movement ${region.id} missing`)
    places.push(
      ...placePlaces({
        cycle,
        region: region.id,
        rect: region.rect,
        fragments: movement.fragments.map((n) => canon.fragments[n - 1]!),
        short,
        viewH: viewportH,
        viewW: viewportW,
      }),
    )
  }
  places.sort((a, b) => a.n - b.n)

  const bandH = Math.round(viewportH * config.THRESHOLD_BAND_SCREENS)
  const thresholds: Threshold[] = []
  for (let i = 0; i < ORDER.length - 1; i++) {
    const from = regions.find((r) => r.id === ORDER[i])!
    const to = regions.find((r) => r.id === ORDER[i + 1])!
    const movement = canon.movements.find((m) => m.id === from.id)!
    thresholds.push({
      from: from.id,
      to: to.id,
      band: { x: 0, y: from.rect.y - bandH / 2, w: width, h: bandH },
      fragments: movement.fragments,
    })
  }

  const mar = regions.find((r) => r.id === 'mar')!.rect
  return {
    width,
    height,
    short,
    cycle,
    regions,
    places,
    thresholds,
    start: { x: width / 2, y: mar.y + mar.h - viewportH / 2 },
  }
}

/** The region containing a world y (the lowest region for y beyond the bottom, the highest beyond the top). */
export function regionAt(world: World, y: number): Region {
  for (const r of world.regions) if (y >= r.rect.y && y < r.rect.y + r.rect.h) return r
  return y < 0 ? world.regions[world.regions.length - 1]! : world.regions[0]!
}

export function regionRect(world: World, id: MovementId): Rect {
  const r = world.regions.find((x) => x.id === id)
  if (!r) throw new Error(`world: region ${id} missing`)
  return r.rect
}

export { ORDER as REGION_ORDER }
