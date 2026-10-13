import { CanonLines } from '../components/CanonLines'
import { Seal } from '../components/Seal'
import { canon } from '../content/canon'
import { copy } from '../content/copy.es'
import type { ExitStage } from '../world/exit'
import type { World } from '../world/types'
import { Colofon } from './Colofon'
import { CieloClosing } from './ExitTally'

// The Return: Cielo's closing alone on the white, the reprise in italics,
// then the lone seal with no numeral on near-white, then the Colofón.
// Screen-anchored; the territory has dissolved beneath.
export function Return({
  stage,
  onSeal,
  world = null,
  found = new Set(),
}: {
  stage: ExitStage
  onSeal: () => void
  world?: World | null
  found?: ReadonlySet<number>
}) {
  if (stage === 'closing') {
    return world ? (
      <div className="return return--closing">
        <CieloClosing world={world} found={found} />
      </div>
    ) : null
  }
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
