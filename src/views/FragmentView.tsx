import { CanonLines } from '../components/CanonLines'
import { Lamina } from '../components/Lamina'
import { laminaSrc } from '../content/laminas'
import { Seal } from '../components/Seal'
import type { Fragment } from '../content/canon'

// One fragment: text in the upper region, one lámina in the middle-lower
// zone, the seal alone in the reserved bottom band.
export function FragmentView({ fragment }: { fragment: Fragment }) {
  return (
    <>
      <div className="fragment__text" data-canon="fragment" data-n={fragment.n}>
        <CanonLines lines={fragment.lines} />
      </div>
      <div className="fragment__lamina">
        <Lamina className="fragment__lamina-img" src={laminaSrc(fragment.n)} />
      </div>
      <div className="seal-band">
        <Seal numeral={fragment.seal} />
      </div>
      <svg className="fracture-overlay" data-gesture-overlay aria-hidden="true" />
    </>
  )
}
