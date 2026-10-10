import { canon } from '../content/canon'
import { Signature } from '../components/Signature'
import { config } from '../gestures/config'
import { groundSrc } from './assets'

// The fracture across the title: a jagged diagonal (in % of the title box),
// fixed so the cover is the same for everyone. Broken, not smooth.
const CRACK: Array<[number, number]> = [
  [0, 27], [7, 31], [13, 29], [19, 36], [26, 38], [31, 35], [38, 44], [44, 46], [50, 52],
  [57, 50], [62, 58], [69, 60], [75, 57], [81, 66], [88, 68], [94, 72], [100, 75],
]
const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x}% ${y}%`).join(', ')
const ABOVE = `polygon(0% 0%, 100% 0%, ${pts([...CRACK].reverse())})`
const BELOW = `polygon(${pts(CRACK)}, 100% 100%, 0% 100%)`

// The cover: the title of the work broken by a fracture, its two halves out
// of register; the author's signature stamped onto the paper; and, below,
// the ink of Mar waiting. A touch makes the ink rise and swallow the cover:
// the ascent begins. The stamp happens once.
export function Cover({ dismissed }: { dismissed: boolean }) {
  return (
    <div
      className="cover"
      data-dismissed={dismissed ? '' : undefined}
      aria-hidden={dismissed}
      style={{
        ['--cover-stamp-delay' as string]: `${config.COVER_STAMP_DELAY_MS}ms`,
        ['--cover-stamp-ms' as string]: `${config.COVER_STAMP_MS}ms`,
        ['--cover-dissolve-ms' as string]: `${config.COVER_DISSOLVE_MS}ms`,
        ['--cover-above' as string]: ABOVE,
        ['--cover-below' as string]: BELOW,
      }}
    >
      <div className="cover__ink" aria-hidden="true">
        <img src={groundSrc('mar')} alt="" draggable={false} />
      </div>
      <div className="cover__body">
        <h1 className="cover__title" data-canon="work-title" data-title={canon.title}>
          {canon.title}
          <svg className="cover__crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={CRACK.map(([x, y]) => `${x},${y}`).join(' ')} />
          </svg>
        </h1>
        <div className="cover__stamp">
          <span className="cover__bloom" aria-hidden="true" />
          <Signature className="cover__signature" />
        </div>
      </div>
    </div>
  )
}
