// Derives the linear sequence of stations from the canon. Nothing here is
// hand-ordered: the order comes from `movements` and `fragments`.
import { canon, type Canon, type Fragment, type Movement, type MovementId } from './canon'

/** How a station is left behind. */
export type GestureKind =
  | 'tap' // epigraph: a touch, or a lateral drift
  | 'drift' // Mar: lateral drift
  | 'fracture' // Tierra: insistence, strokes that accumulate
  | 'pull' // Cordillera: upward pull with resistance and inertia
  | 'stillness' // Cielo: not touching
  | 'auto' // dissolution: unfolds on its own
  | 'seal' // the seal alone: touching it opens the Colofón
  | 'none' // the Colofón: the end

export const GESTURE_BY_MOVEMENT: Record<MovementId, GestureKind> = {
  mar: 'drift',
  tierra: 'fracture',
  cordillera: 'pull',
  cielo: 'stillness',
}

export type Station =
  | { id: 'epigraph'; kind: 'epigraph'; gesture: 'tap'; lines: string[] }
  | { id: `divider:${MovementId}`; kind: 'divider'; gesture: GestureKind; movement: Movement }
  | { id: `frag:${number}`; kind: 'fragment'; gesture: GestureKind; movement: Movement; fragment: Fragment }
  | { id: 'dissolution'; kind: 'dissolution'; gesture: 'auto' }
  | { id: 'reprise'; kind: 'reprise'; gesture: 'stillness'; lines: string[] }
  | { id: 'seal'; kind: 'seal'; gesture: 'seal'; seal: string }
  | { id: 'colofon'; kind: 'colofon'; gesture: 'none' }

export type StationId = Station['id']

export function buildJourney(c: Canon): Station[] {
  const stations: Station[] = []
  stations.push({ id: 'epigraph', kind: 'epigraph', gesture: 'tap', lines: c.epigraph })
  for (const movement of c.movements) {
    const gesture = GESTURE_BY_MOVEMENT[movement.id]
    stations.push({ id: `divider:${movement.id}`, kind: 'divider', gesture, movement })
    for (const n of movement.fragments) {
      const fragment = c.fragments[n - 1]
      if (!fragment || fragment.n !== n) throw new Error(`journey: fragment ${n} missing`)
      stations.push({ id: `frag:${n}`, kind: 'fragment', gesture, movement, fragment })
    }
  }
  stations.push({ id: 'dissolution', kind: 'dissolution', gesture: 'auto' })
  stations.push({ id: 'reprise', kind: 'reprise', gesture: 'stillness', lines: c.reprise })
  const last = c.fragments[c.fragments.length - 1]
  stations.push({ id: 'seal', kind: 'seal', gesture: 'seal', seal: last ? last.seal : '0' })
  stations.push({ id: 'colofon', kind: 'colofon', gesture: 'none' })
  return stations
}

/** Number of canon lines a visitor reads on a station (drives the Cielo dwell). */
export function readingLines(station: Station): number {
  switch (station.kind) {
    case 'epigraph':
    case 'reprise':
      return station.lines.length
    case 'fragment':
      return station.fragment.lines.length
    case 'divider':
      return 1
    default:
      return 0
  }
}

export const journey: readonly Station[] = buildJourney(canon)

export function stationIndex(id: StationId): number {
  const i = journey.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`journey: unknown station ${id}`)
  return i
}
