// The accessible, linear path: "Avanzar" and "Volver" travel to the next
// and previous place in canonical order, thresholds included. It never
// depends on gestures or stillness.
import { session } from '../app/session'
import type { Territory } from './loop'
import { territoryStore } from './territoryStore'

export type Stop = { kind: 'epigraph' } | { kind: 'place'; n: number } | { kind: 'threshold'; from: 'mar' } | { kind: 'stub' }

export function stopsFor(t: Territory): Stop[] {
  const stops: Stop[] = [{ kind: 'epigraph' }]
  const ordered = [...t.world.places].sort((a, b) => a.n - b.n)
  for (const p of ordered) stops.push({ kind: 'place', n: p.n })
  stops.push({ kind: 'threshold', from: 'mar' })
  stops.push({ kind: 'stub' })
  return stops
}

export class LinearPath {
  private index = 0
  private territory: Territory
  constructor(territory: Territory) {
    this.territory = territory
  }

  get stops() {
    return stopsFor(this.territory)
  }

  /** A place whose glide is still in flight: moving on still counts as passing through it. */
  private pending: number | null = null

  private go(index: number) {
    const stops = this.stops
    const clamped = Math.max(0, Math.min(stops.length - 1, index))
    if (this.pending !== null) {
      this.territory.arriveAt(this.pending)
      this.pending = null
    }
    this.index = clamped
    session.patch({ keyboardUser: true })
    territoryStore.patch({ linearIndex: clamped })
    const stop = stops[clamped] as Stop
    const t = this.territory
    switch (stop.kind) {
      case 'epigraph':
        t.glideTo(t.world.start, () => t.rest())
        break
      case 'place': {
        const p = t.world.places.find((x) => x.n === stop.n)
        if (p) {
          this.pending = stop.n
          t.glideTo({ x: p.x, y: p.y }, () => {
            this.pending = null
            t.arriveAt(stop.n)
            focusPlace(stop.n)
          })
        }
        break
      }
      case 'threshold': {
        // Frame the tally from inside Mar: the band's centre is the region boundary.
        const th = t.world.thresholds[0]
        if (th) t.glideTo({ x: th.band.x + th.band.w / 2, y: th.band.y + th.band.h / 2 + t.camera.viewH * 0.22 }, () => t.rest())
        break
      }
      case 'stub': {
        const th = t.world.thresholds[0]
        if (th) t.glideTo({ x: th.band.x + th.band.w / 2, y: th.band.y - t.camera.viewH * 0.6 }, () => t.rest())
        break
      }
    }
  }

  next() {
    this.go(this.index + 1)
  }

  back() {
    this.go(this.index - 1)
  }

  /** Jump to a stop by index without counting as keyboard use (dev). */
  jump(index: number) {
    const keyboardUser = session.get().keyboardUser
    this.go(index)
    session.patch({ keyboardUser })
  }
}

/** Move focus to a place's text once React has mounted it (a place found earlier is focused again). */
function focusPlace(n: number) {
  const tryFocus = (attempt: number) => {
    const el = document.querySelector<HTMLElement>(`.place[data-n="${n}"] [data-canon="fragment"]`)
    if (el) el.focus({ preventScroll: true })
    else if (attempt < 10) requestAnimationFrame(() => tryFocus(attempt + 1))
  }
  requestAnimationFrame(() => tryFocus(0))
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', ' ', 'Spacebar', 'Enter', 'PageDown'])
const BACK_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp'])

export function installLinearKeyboard(path: LinearPath): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT')) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') return
    }
    if (NEXT_KEYS.has(e.key)) {
      e.preventDefault()
      path.next()
    } else if (BACK_KEYS.has(e.key)) {
      e.preventDefault()
      path.back()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
