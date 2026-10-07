import { copy } from '../content/copy.es'

// The linear path's two controls, visually hidden, always available to
// assistive technology. They never depend on gestures or stillness.
export function Controls({ onNext, onBack, canNext, canBack }: { onNext: () => void; onBack: () => void; canNext: boolean; canBack: boolean }) {
  return (
    <div className="controls">
      <button type="button" className="sr-only" onClick={onBack} disabled={!canBack}>
        {copy.a11y.back}
      </button>
      <button type="button" className="sr-only" onClick={onNext} disabled={!canNext}>
        {copy.a11y.advance}
      </button>
    </div>
  )
}
