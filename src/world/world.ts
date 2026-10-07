// Builds the territory for a viewport and a cycle. Phase 2: Mar only, with
// a white stub above its threshold standing in for Tierra.
import { canon, movementById } from '../content/canon'
import { config } from '../gestures/config'
import { placePlaces } from './geography'
import type { Rect, World } from './types'

export function buildWorld(viewportW: number, viewportH: number, cycle: number): World {
  const short = Math.min(viewportW, viewportH)
  const marW = Math.round(viewportW * config.MAR_SCREENS_W)
  const marH = Math.round(viewportH * config.MAR_SCREENS_H)
  const stubH = Math.round(viewportH * config.STUB_SCREENS_H)
  const width = marW
  const height = stubH + marH

  const mar = movementById('mar')
  const marRect: Rect = { x: 0, y: stubH, w: marW, h: marH }
  const places = placePlaces({
    cycle,
    region: 'mar',
    rect: marRect,
    fragments: mar.fragments.map((n) => canon.fragments[n - 1]!),
    short,
  })

  const bandH = Math.round(viewportH * config.THRESHOLD_BAND_SCREENS)
  return {
    width,
    height,
    short,
    cycle,
    regions: [{ id: 'mar', rect: marRect }],
    places,
    thresholds: [
      {
        from: 'mar',
        band: { x: 0, y: stubH - bandH / 2, w: width, h: bandH },
        fragments: mar.fragments,
      },
    ],
    start: { x: marW / 2, y: stubH + marH - viewportH / 2 },
  }
}
