// The only bridge from the world (outside React) to React. React renders
// the epigraph, the text of emerged places, seals, the tally, titles and
// the accessible controls from this snapshot.
import { useSyncExternalStore } from 'react'
import type { MovementId } from '../content/canon'
import type { PlaceStatus } from './places'
import type { World } from './types'

export type Phase = 'epigraph' | 'territory'

export interface TerritorySnapshot {
  phase: Phase
  world: World | null
  places: Record<number, PlaceStatus>
  /** Regions whose title has been shown, with the world position where it appeared. */
  titles: Array<{ region: MovementId; x: number; y: number; at: number }>
  /** Which region the viewpoint is in ('stub' above Mar's threshold). */
  region: MovementId | 'stub'
  revealAll: boolean
  /** Linear path position, for the controls. */
  linearIndex: number
}

let snapshot: TerritorySnapshot = {
  phase: 'epigraph',
  world: null,
  places: {},
  titles: [],
  region: 'mar',
  revealAll: false,
  linearIndex: 0,
}

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export const territoryStore = {
  get: () => snapshot,
  patch(partial: Partial<TerritorySnapshot>) {
    snapshot = { ...snapshot, ...partial }
    emit()
  },
  setPlace(status: PlaceStatus) {
    snapshot = { ...snapshot, places: { ...snapshot.places, [status.n]: status } }
    emit()
  },
  addTitle(region: MovementId, x: number, y: number, at: number) {
    if (snapshot.titles.some((t) => t.region === region)) return
    snapshot = { ...snapshot, titles: [...snapshot.titles, { region, x, y, at }] }
    emit()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  reset() {
    snapshot = { phase: 'epigraph', world: null, places: {}, titles: [], region: 'mar', revealAll: false, linearIndex: 0 }
    emit()
  },
}

export function useTerritory(): TerritorySnapshot {
  return useSyncExternalStore(territoryStore.subscribe, territoryStore.get, territoryStore.get)
}
