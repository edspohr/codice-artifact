import { describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { buildJourney, journey, readingWords, stationIndex } from '../src/content/journey'

describe('journey', () => {
  it('derives 31 stations in canon order', () => {
    const ids = journey.map((s) => s.id)
    expect(ids).toEqual([
      'epigraph',
      'divider:mar', 'frag:1', 'frag:2', 'frag:3', 'frag:4',
      'divider:tierra', 'frag:5', 'frag:6', 'frag:7', 'frag:8', 'frag:9', 'frag:10',
      'divider:cordillera', 'frag:11', 'frag:12', 'frag:13', 'frag:14', 'frag:15', 'frag:16',
      'divider:cielo', 'frag:17', 'frag:18', 'frag:19', 'frag:20', 'frag:21', 'frag:22',
      'dissolution', 'reprise', 'seal', 'colofon',
    ])
  })

  it('assigns each movement its gesture', () => {
    const gestureOf = (id: string) => journey[stationIndex(id as never)]?.gesture
    expect(gestureOf('divider:mar')).toBe('drift')
    expect(gestureOf('frag:4')).toBe('drift')
    expect(gestureOf('frag:5')).toBe('fracture')
    expect(gestureOf('frag:11')).toBe('pull')
    expect(gestureOf('divider:cielo')).toBe('stillness')
    expect(gestureOf('frag:22')).toBe('stillness')
    expect(gestureOf('reprise')).toBe('stillness')
    expect(gestureOf('dissolution')).toBe('auto')
    expect(gestureOf('seal')).toBe('seal')
    expect(gestureOf('colofon')).toBe('none')
  })

  it('is a pure function of the canon', () => {
    expect(buildJourney(canon).map((s) => s.id)).toEqual(journey.map((s) => s.id))
  })

  it('counts reading words for the Cielo dwell', () => {
    const words = (lines: string[]) => lines.join(' ').split(/\s+/).filter(Boolean).length
    expect(readingWords(journey[stationIndex('frag:22')]!)).toBe(words(canon.fragments[21]!.lines))
    expect(readingWords(journey[stationIndex('frag:17')]!)).toBe(words(canon.fragments[16]!.lines))
    expect(readingWords(journey[stationIndex('divider:cielo')]!)).toBe(2)
    expect(readingWords(journey[stationIndex('reprise')]!)).toBe(words(canon.reprise))
    expect(readingWords(journey[stationIndex('dissolution')]!)).toBe(0)
  })

  it('the lone seal carries no numeral', () => {
    const seal = journey[stationIndex('seal')]!
    expect('seal' in seal).toBe(false)
  })
})
