import { readingWords, type Station } from '../content/journey'
import { createAutoRecognizer } from './auto'
import { createDriftRecognizer } from './drift'
import { createFractureRecognizer } from './fracture'
import { createPullRecognizer } from './pull'
import { createStillnessRecognizer } from './stillness'
import { createTapRecognizer } from './tap'
import type { Recognizer } from './types'

export function createRecognizer(station: Station): Recognizer {
  switch (station.gesture) {
    case 'tap':
      return createTapRecognizer()
    case 'drift':
      return createDriftRecognizer()
    case 'fracture':
      return createFractureRecognizer()
    case 'pull':
      return createPullRecognizer()
    case 'stillness':
      return createStillnessRecognizer(readingWords(station))
    case 'auto':
      return createAutoRecognizer()
    case 'seal':
      return { kind: 'seal' }
    case 'none':
      return { kind: 'none' }
  }
}
