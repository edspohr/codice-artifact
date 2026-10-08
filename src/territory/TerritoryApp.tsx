import { useEffect, useRef, useState } from 'react'
import { CURRENT_CYCLE } from '../app/cycle'
import { CanonLines } from '../components/CanonLines'
import { canon } from '../content/canon'
import { installLinearKeyboard, LinearPath } from '../world/linearPath'
import { Territory } from '../world/loop'
import { territoryStore, useTerritory } from '../world/territoryStore'
import { buildWorld } from '../world/world'
import { cssColor, loadAssets } from './assets'
import { Controls } from './Controls'
import { PlaceText } from './PlaceText'
import { RegionTitle } from './RegionTitle'
import { Tally } from './Tally'
import './territory.css'

export interface TerritoryHandles {
  territory: Territory
  path: LinearPath
}

export default function TerritoryApp({
  revealAll = false,
  onReady,
}: {
  revealAll?: boolean
  onReady?: (handles: TerritoryHandles) => void
}) {
  const snap = useTerritory()
  const stageRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const handlesRef = useRef<TerritoryHandles | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    const layer = layerRef.current
    if (!stage || !canvas || !layer) return
    let cancelled = false
    let cleanup: (() => void) | null = null
    territoryStore.reset()
    const world = buildWorld(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight, CURRENT_CYCLE)
    loadAssets(world)
      .then((assets) => {
        if (cancelled) return
        const territory = new Territory(
          { stage, canvas, textLayer: layer },
          {
            world,
            assets,
            revealAll,
            colors: { paper: cssColor('--paper'), ink: cssColor('--ink'), accent: cssColor('--accent') },
          },
        )
        const path = new LinearPath(territory)
        const removeKeyboard = installLinearKeyboard(path)
        handlesRef.current = { territory, path }
        cleanup = () => {
          removeKeyboard()
          territory.destroy()
        }
        setReady(true)
        onReady?.({ territory, path })
      })
      .catch((err: unknown) => {
        console.error(err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      cleanup?.()
      handlesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After every render, tell the loop which text blocks the ink must part around.
  useEffect(() => {
    const stage = stageRef.current
    const handles = handlesRef.current
    if (!stage || !handles) return
    handles.territory.setClearElements(Array.from(stage.querySelectorAll<HTMLElement>('[data-clear]')))
  })

  const world = snap.world
  const found = new Set<number>()
  for (const s of Object.values(snap.places)) if (s.found) found.add(s.n)
  const stops = handlesRef.current?.path.stops.length ?? 0

  return (
    <main
      ref={stageRef}
      className="stage territory"
      data-phase={snap.phase}
      data-region={snap.region}
      data-ready={ready ? '' : undefined}
      data-failed={failed ? '' : undefined}
    >
      <Controls
        onBack={() => handlesRef.current?.path.back()}
        onNext={() => handlesRef.current?.path.next()}
        canBack={ready && snap.linearIndex > 0}
        canNext={ready && snap.linearIndex < stops - 1}
      />
      <canvas ref={canvasRef} className="ink" aria-hidden="true" />
      {snap.title ? <RegionTitle key={snap.title.region} region={snap.title.region} /> : null}
      <div ref={layerRef} className="world-text">
        {world
          ? world.places.map((p) => {
              const s = snap.places[p.n]
              if (!s || s.state === 'hidden') return null
              return <PlaceText key={p.n} place={p} status={s} />
            })
          : null}
        {world ? world.thresholds.map((th) => <Tally key={th.from} threshold={th} found={found} />) : null}
      </div>
      <div className="epigraph-veil" data-canon="epigraph" aria-hidden={snap.phase !== 'epigraph'}>
        <CanonLines lines={canon.epigraph} />
      </div>
    </main>
  )
}
