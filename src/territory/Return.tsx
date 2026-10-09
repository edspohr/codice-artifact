import { CanonLines } from '../components/CanonLines'
import { Seal } from '../components/Seal'
import { canon } from '../content/canon'
import { copy } from '../content/copy.es'
import type { ExitStage } from '../world/exit'
import { Colofon } from './Colofon'

// The Return: the reprise in italics on white, then the lone seal with no
// numeral on near-white, then the Colofón. Screen-anchored; the territory
// has dissolved beneath.
export function Return({ stage, onSeal }: { stage: ExitStage; onSeal: () => void }) {
  if (stage === 'reprise') {
    return (
      <div className="return return--reprise" data-canon="reprise">
        <CanonLines lines={canon.reprise} className="reprise-line" />
      </div>
    )
  }
  if (stage === 'seal') {
    return (
      <div className="return return--seal">
        <button
          type="button"
          className="seal-button"
          aria-label={copy.a11y.sealToColofon}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onSeal}
        >
          <Seal />
        </button>
      </div>
    )
  }
  if (stage === 'colofon') {
    return (
      <div className="return return--colofon">
        <Colofon />
      </div>
    )
  }
  return null
}
