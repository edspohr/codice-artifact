import { MovementTitle } from '../components/MovementTitle'
import { movementById } from '../content/canon'
import type { World } from '../world/types'
import { Tally } from './Tally'

// Cielo has no threshold above it: the exit, fragment 22, is its last place.
// Cielo closes after the dissolution, alone on the white, like every region:
// its title with its tally of 17–22, the 0 included.
export function CieloClosing({ world, found }: { world: World; found: ReadonlySet<number> }) {
  const fragments = world.places.filter((p) => p.region === 'cielo').map((p) => p.n).sort((a, b) => a - b)
  const threshold = { from: 'cielo' as const, to: 'cielo' as const, band: { x: 0, y: 0, w: 0, h: 0 }, fragments }
  return (
    <div className="exit-tally" data-movement="cielo">
      <MovementTitle movement={movementById('cielo')} />
      <Tally threshold={threshold} found={found} />
    </div>
  )
}
