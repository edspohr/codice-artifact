import { useEffect, type RefObject } from 'react'
import { journeyStore } from '../app/journeyStore'
import type { Station } from '../content/journey'
import { engine } from './engine'
import { installKeyboard } from './keyboard'
import { createRecognizer } from './recognizers'

/** Attaches the singleton engine to the stage and swaps recognizers per station. */
export function useGestureEngine(stageRef: RefObject<HTMLElement | null>, station: Station) {
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    engine.attach(stage, { onCommit: () => journeyStore.advance() })
    const removeKeyboard = installKeyboard(engine)
    return () => {
      removeKeyboard()
      engine.detach()
    }
  }, [stageRef])

  useEffect(() => {
    engine.setRecognizer(createRecognizer(station))
  }, [station])
}
