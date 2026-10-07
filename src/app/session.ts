// Session-only input facts. Nothing here is persisted or sent anywhere.
import { useSyncExternalStore } from 'react'

interface SessionState {
  /** True once the visitor navigated with the keyboard. Disables Cielo's auto-advance. */
  keyboardUser: boolean
  /** True while a pointer is down on the stage. */
  pointerDown: boolean
  /** True when the visitor has stalled on the current station long enough for the ink cue. */
  stalled: boolean
  /** Index of the station the visitor is on, mirrored for the cue. */
  reducedMotion: boolean
}

let state: SessionState = {
  keyboardUser: false,
  pointerDown: false,
  stalled: false,
  reducedMotion:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
}

const listeners = new Set<() => void>()

export const session = {
  get: () => state,
  patch(partial: Partial<SessionState>) {
    let changed = false
    for (const key of Object.keys(partial) as Array<keyof SessionState>) {
      if (state[key] !== partial[key]) changed = true
    }
    if (!changed) return
    state = { ...state, ...partial }
    for (const l of listeners) l()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    session.patch({ reducedMotion: e.matches })
  })
}

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, session.get)
}
