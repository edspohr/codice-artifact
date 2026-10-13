import { Seal } from '../components/Seal'
import { fragmentByN } from '../content/canon'
import type { Threshold } from '../world/types'

// The tally at a threshold: one impression per fragment of the region
// being left. Inked with its numeral if found, blind if not. No numbers,
// no words. Always two rows (six as 2×3, four as 2×2): the squareness of the work.
export function Tally({ threshold, found }: { threshold: Threshold; found: ReadonlySet<number> }) {
  return (
    <div className="tally" data-threshold={threshold.from} style={{ ['--cols' as string]: Math.max(1, Math.ceil(threshold.fragments.length / 2)) }}>
      {threshold.fragments.map((n) => {
        const isFound = found.has(n)
        return (
          <span className="tally__impression" data-n={n} data-inked={isFound ? '' : undefined} key={n}>
            <Seal numeral={isFound ? fragmentByN(n).seal : undefined} blind={!isFound} />
          </span>
        )
      })}
    </div>
  )
}
