import { useRef } from 'react'
import { journeyStore, useJourneyIndex } from './app/journeyStore'
import { AdvanceControl } from './components/AdvanceControl'
import { StallCue } from './components/StallCue'
import { journey, type Station } from './content/journey'
import { useGestureEngine } from './gestures/useGestureEngine'
import { StationView } from './views/StationView'

export default function App() {
  const index = useJourneyIndex()
  const station = journey[index] as Station
  const next = journeyStore.getNext()
  const stageRef = useRef<HTMLElement>(null)
  useGestureEngine(stageRef, station)

  const movement = station.kind === 'divider' || station.kind === 'fragment' ? station.movement.id : undefined

  return (
    <main
      ref={stageRef}
      className="stage"
      data-gesture={station.gesture}
      data-station={station.id}
      data-movement={movement}
    >
      <AdvanceControl disabled={station.gesture === 'none'} />
      {next ? <StationView key={next.id} station={next} role="next" focusOnEnter={false} /> : null}
      <StationView key={station.id} station={station} role="current" focusOnEnter={index > 0} />
      <StallCue gesture={station.gesture} />
    </main>
  )
}
