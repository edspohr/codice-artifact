// Builds the territory for a viewport and a cycle: four channels stacked
// from the bottom up (Mar → Tierra → Cordillera → Cielo), a threshold
// between each pair, the places of each region, the exit at the far top.
import { canon, type MovementId } from '../content/canon'
import { config } from '../gestures/config'
import { minOpenHeight, placePlaces } from './geography'
import { buildHolds } from './holds'
import { regionScale } from './scale'
import { buildWind } from './wind'
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

function widthOf(id: MovementId): number {
  switch (id) {
    case 'mar':
      return config.MAR_SCREENS_W
    case 'tierra':
      return config.TIERRA_SCREENS_W
    case 'cordillera':
      return config.CORDILLERA_SCREENS_W
    case 'cielo':
      return config.CIELO_SCREENS_W
  }
}

export function buildWorld(viewportW: number, viewportH: number, cycle: number): World {
  // The territory is measured in portrait "screens": on a phone the viewport itself,
  // on a wide screen a portrait unit fitted to the viewport height. A region is never
  // narrower than the view it is seen with, so ink always covers the whole view.
  // Regions share a centre line: Mar and Tierra are channels, Cordillera and Cielo open wide.
  const unitW = Math.min(viewportW, Math.round(viewportH * 0.5))
  const short = Math.min(unitW, viewportH)
  // An open region stays open on a wide screen too: at least OPEN_MIN_VIEW_WIDTHS views wide.
  const widths = ORDER.map((id) => {
    const views = id === 'cordillera' || id === 'cielo' ? Math.max(config.WORLD_MIN_VIEW_WIDTHS, config.OPEN_MIN_VIEW_WIDTHS) : config.WORLD_MIN_VIEW_WIDTHS
    return Math.max(Math.round(unitW * widthOf(id)), Math.round((viewportW * views) / regionScale(id)))
  })
  const width = Math.max(...widths)

  // Stack from the top down so y grows downward: Cielo first.
  // An open region also grows tall enough for its places to stay one view apart.
  const heights = ORDER.map((id) => {
    const h = Math.round(viewportH * screensOf(id))
    if (id !== 'cordillera' && id !== 'cielo') return h
    const movement = canon.movements.find((m) => m.id === id)!
    return Math.max(h, minOpenHeight(movement.fragments.length, movement.fragments.includes(22), viewportH, regionScale(id)))
  })
  const height = heights.reduce((a, b) => a + b, 0)
  const regions: Region[] = []
  let y = height
  ORDER.forEach((id, i) => {
    const h = heights[i] as number
    const w = widths[i] as number
    y -= h
    regions.push({ id, rect: { x: Math.round((width - w) / 2), y, w, h } })
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
        scale: regionScale(region.id),
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
  const view = { short, viewW: viewportW, viewH: viewportH }
  const holds = buildHolds({ cycle, rect: regions.find((r) => r.id === 'cordillera')!.rect, places, ...view })
  const wind = buildWind({ cycle, rect: regions.find((r) => r.id === 'cielo')!.rect, places, ...view })
  return {
    holds,
    wind,
    width,
    height,
    short,
    viewW: viewportW,
    viewH: viewportH,
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
