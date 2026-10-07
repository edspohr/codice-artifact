// Accessible fallback: arrow keys, space, Enter and PageDown advance in
// every movement, Cielo included. The first navigation key marks the
// session as keyboard-driven, which disables Cielo's auto-advance.
import { session } from '../app/session'
import type { GestureEngine } from './engine'

const ADVANCE_KEYS = new Set(['ArrowRight', 'ArrowDown', ' ', 'Spacebar', 'Enter', 'PageDown'])

export function installKeyboard(engine: GestureEngine): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    if (!ADVANCE_KEYS.has(e.key)) return
    const target = e.target as HTMLElement | null
    // Buttons and links handle Enter/space themselves.
    if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT')) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') return
    }
    e.preventDefault()
    session.patch({ keyboardUser: true })
    engine.advance()
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
