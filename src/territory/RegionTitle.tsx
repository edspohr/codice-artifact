import { MovementTitle } from '../components/MovementTitle'
import { movementById, type MovementId } from '../content/canon'
import { config } from '../gestures/config'

// A movement title is an event, not an object: it appears alone over the
// ground on entering a region and dissolves before any place can emerge.
// Screen-anchored, positioned per spec §5.1 (see territory.css).
export function RegionTitle({ region }: { region: MovementId }) {
  return (
    <div
      className="region-title"
      data-movement={region}
      data-clear
      style={{
        ['--title-in-ms' as string]: `${config.TITLE_IN_MS}ms`,
        ['--title-hold-ms' as string]: `${config.TITLE_HOLD_MS}ms`,
        ['--title-out-ms' as string]: `${config.TITLE_OUT_MS}ms`,
      }}
    >
      <MovementTitle movement={movementById(region)} />
    </div>
  )
}
