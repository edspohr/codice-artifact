// Journey position. A tiny external store so that the gesture engine
// (outside React) and the views (inside React) share one source of truth.
import { useSyncExternalStore } from 'react'
import { journey, type Station } from '../content/journey'

type Listener = () => void

let index = 0
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

export const journeyStore = {
  getIndex: () => index,
  getStation: (): Station => journey[index] as Station,
  getNext: (): Station | null => journey[index + 1] ?? null,
  isLast: () => index >= journey.length - 1,
  advance() {
    if (index >= journey.length - 1) return
    index += 1
    emit()
  },
  jumpTo(i: number) {
    const clamped = Math.max(0, Math.min(journey.length - 1, Math.floor(i)))
    if (clamped === index) return
    index = clamped
    emit()
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export function useJourneyIndex(): number {
  return useSyncExternalStore(journeyStore.subscribe, journeyStore.getIndex, journeyStore.getIndex)
}
