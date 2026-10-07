import { Seal } from '../components/Seal'
import { copy } from '../content/copy.es'
import { engine } from '../gestures/engine'

// The seal alone on a near-white screen. Touching it opens the Colofón.
export function SealAloneView({ seal }: { seal: string }) {
  return (
    <div className="seal-alone">
      <button
        type="button"
        className="seal-button"
        aria-label={copy.a11y.sealToColofon}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => engine.advance()}
      >
        <Seal numeral={seal} />
      </button>
    </div>
  )
}
