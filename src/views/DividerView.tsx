import { Lamina } from '../components/Lamina'
import { motherLaminaSrc } from '../content/laminas'
import { MovementTitle } from '../components/MovementTitle'
import type { Movement } from '../content/canon'

// A movement opens with its title and its mother lámina at full
// expression. No seal, no other text.
export function DividerView({ movement }: { movement: Movement }) {
  return (
    <>
      <Lamina className="divider__lamina" src={motherLaminaSrc(movement.id)} />
      <MovementTitle movement={movement} />
    </>
  )
}
