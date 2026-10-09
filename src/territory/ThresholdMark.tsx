import { MovementTitle } from '../components/MovementTitle'
import { movementById } from '../content/canon'
import type { Threshold } from '../world/types'
import { Tally } from './Tally'

// The closing of a region at its threshold: the region's title with the
// tally beneath it. Unlike the entry title (an event), this is an object
// anchored to the world; the ink parts around it.
export function ThresholdMark({ threshold, found }: { threshold: Threshold; found: ReadonlySet<number> }) {
  return (
    <div
      className="threshold-mark"
      data-threshold={threshold.from}
      data-movement={threshold.from}
      data-clear
      style={{ left: `${threshold.band.x + threshold.band.w / 2}px`, top: `${threshold.band.y + threshold.band.h / 2}px` }}
    >
      <MovementTitle movement={movementById(threshold.from)} />
      <Tally threshold={threshold} found={found} />
    </div>
  )
}
