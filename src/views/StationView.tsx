import { useEffect, useRef } from 'react'
import type { Station } from '../content/journey'
import { ColofonView } from './ColofonView'
import { DividerView } from './DividerView'
import { EpigraphView } from './EpigraphView'
import { FragmentView } from './FragmentView'
import { RepriseView } from './RepriseView'
import { SealAloneView } from './SealAloneView'

function movementOf(station: Station): string | undefined {
  return station.kind === 'divider' || station.kind === 'fragment' ? station.movement.id : undefined
}

function body(station: Station) {
  switch (station.kind) {
    case 'epigraph':
      return <EpigraphView lines={station.lines} />
    case 'divider':
      return <DividerView movement={station.movement} />
    case 'fragment':
      return <FragmentView fragment={station.fragment} />
    case 'dissolution':
      return null
    case 'reprise':
      return <RepriseView lines={station.lines} />
    case 'seal':
      return <SealAloneView />
    case 'colofon':
      return <ColofonView />
  }
}

export function StationView({
  station,
  role,
  focusOnEnter,
}: {
  station: Station
  role: 'current' | 'next'
  focusOnEnter: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const isCurrent = role === 'current'

  useEffect(() => {
    if (isCurrent && focusOnEnter) ref.current?.focus({ preventScroll: true })
  }, [isCurrent, focusOnEnter])

  return (
    <article
      ref={ref}
      className={`view view--${role} view--${station.kind}`}
      data-station={station.id}
      data-movement={movementOf(station)}
      tabIndex={isCurrent ? -1 : undefined}
      aria-hidden={isCurrent ? undefined : true}
      inert={isCurrent ? undefined : true}
    >
      {body(station)}
    </article>
  )
}
