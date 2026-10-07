import { useEffect, useRef } from 'react'
import { session } from '../app/session'
import { CanonLines } from '../components/CanonLines'
import { Seal } from '../components/Seal'
import { config } from '../gestures/config'
import type { PlaceStatus } from '../world/places'
import type { Place } from '../world/types'

// A place's text, in world space, as matter: it sways with the current
// (translation and a slight rotation only, never scale) and is always
// legible. On arrival the seal is stamped next to it, with its seeded
// variation. The ink parts around it (data-clear).
export function PlaceText({ place, status }: { place: Place; status: PlaceStatus }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (status.found && session.get().keyboardUser) ref.current?.focus({ preventScroll: true })
  }, [status.found])

  const stamp = place.stamp
  return (
    <div
      className="place"
      data-n={place.n}
      data-state={status.state}
      data-found={status.found ? '' : undefined}
      style={{
        left: `${place.x}px`,
        top: `${place.y}px`,
        ['--emerge-ms' as string]: `${config.EMERGE_MS}ms`,
        ['--disperse-ms' as string]: `${config.DISPERSE_MS}ms`,
      }}
    >
      <div className="place__text" data-canon="fragment" data-n={place.n} data-clear tabIndex={-1} ref={ref}>
        <CanonLines lines={place.fragment.lines} />
      </div>
      {status.found ? (
        <div
          className="place__seal"
          style={{
            transform: `translate(${stamp.dx.toFixed(1)}px, ${stamp.dy.toFixed(1)}px) rotate(${stamp.rotation.toFixed(2)}deg)`,
            ['--pressure' as string]: stamp.pressure.toFixed(2),
            ['--stamp-ms' as string]: `${config.STAMP_MS}ms`,
          }}
        >
          <Seal numeral={place.fragment.seal} />
        </div>
      ) : null}
    </div>
  )
}
