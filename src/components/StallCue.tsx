import { useSession } from '../app/session'
import type { GestureKind } from '../content/journey'

// After a long stall, a faint non-verbal ink cue traces the expected
// gesture. Cielo is exempt: stillness is its gesture.
const CUE_KINDS: ReadonlySet<GestureKind> = new Set<GestureKind>(['tap', 'drift', 'fracture', 'pull'])

export function StallCue({ gesture }: { gesture: GestureKind }) {
  const { stalled, pointerDown } = useSession()
  if (!stalled || pointerDown || !CUE_KINDS.has(gesture)) return null
  return <span className="stall-cue" data-cue={gesture} aria-hidden="true" />
}
