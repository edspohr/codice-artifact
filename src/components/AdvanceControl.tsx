import { copy } from '../content/copy.es'
import { engine } from '../gestures/engine'
import { session } from '../app/session'

// The single focusable "advance" control exposed to assistive technology.
// Visually hidden; it exists so that screen-reader and switch users always
// have a way forward without discovering the gesture.
export function AdvanceControl({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="button"
      className="sr-only"
      disabled={disabled}
      onClick={() => {
        session.patch({ keyboardUser: true })
        engine.advance()
      }}
    >
      {copy.a11y.advance}
    </button>
  )
}
