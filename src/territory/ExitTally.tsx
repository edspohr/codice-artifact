import { MovementTitle } from '../components/MovementTitle'
import { movementById } from '../content/canon'
import type { Place, World } from '../world/types'
import { Tally } from './Tally'

// Cielo has no threshold above it: the exit, fragment 22, is its last place,
// and Cielo closes there like every region: its title with the tally beneath,
// one impression per fragment 17–22, the 0 included. Rendered inside the exit's
// place block, under its text and seal, so it follows its layout.
export function ExitTally({ world, exit, found }: { world: World; exit: Place; found: ReadonlySet<number> }) {
  const fragments = world.places.filter((p) => p.region === exit.region).map((p) => p.n).sort((a, b) => a - b)
  const threshold = { from: exit.region, to: exit.region, band: { x: exit.x, y: exit.y, w: 0, h: 0 }, fragments }
  return (
    <div className="exit-tally" data-movement={exit.region} data-clear>
      <MovementTitle movement={movementById(exit.region)} />
      <Tally threshold={threshold} found={found} />
    </div>
  )
}
