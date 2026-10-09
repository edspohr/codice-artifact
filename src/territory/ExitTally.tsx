import type { Place, World } from '../world/types'
import { Tally } from './Tally'

// Cielo has no threshold above it: its tally sits beside the exit, fragment 22,
// with one impression per fragment 17–21.
export function ExitTally({ world, exit, found }: { world: World; exit: Place; found: ReadonlySet<number> }) {
  const fragments = world.places.filter((p) => p.region === exit.region && p.n !== exit.n).map((p) => p.n).sort((a, b) => a - b)
  const threshold = { from: exit.region, to: exit.region, band: { x: exit.x, y: exit.y, w: 0, h: 0 }, fragments }
  return (
    <div className="exit-tally" data-clear style={{ left: `${exit.x}px`, top: `${exit.y}px` }}>
      <Tally threshold={threshold} found={found} />
    </div>
  )
}
