import { MovementTitle } from '../components/MovementTitle'
import { movementById, type MovementId } from '../content/canon'
import { config } from '../gestures/config'

// A movement title over the ground, anchored in world space where the
// visitor entered the region. Typography per spec §5.1 (see territory.css).
export function RegionTitle({ region, x, y }: { region: MovementId; x: number; y: number }) {
  return (
    <div
      className="region-title"
      data-movement={region}
      data-clear
      style={{ left: `${x}px`, top: `${y}px`, ['--title-fade-ms' as string]: `${config.TITLE_FADE_MS}ms` }}
    >
      <MovementTitle movement={movementById(region)} />
    </div>
  )
}
