import { canon } from '../content/canon'
import { Signature } from '../components/Signature'
import { config } from '../gestures/config'

// The cover: the title of the work in Archivo Light, and the author's
// signature stamped onto the paper with an ink impact. A touch dissolves
// it into the epigraph. The stamp happens once.
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
      }}
    >
      <h1 className="cover__title" data-canon="work-title">
        {canon.title}
      </h1>
      <div className="cover__stamp">
        <span className="cover__bloom" aria-hidden="true" />
        <Signature className="cover__signature" />
      </div>
    </div>
  )
}
