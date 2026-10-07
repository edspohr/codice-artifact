// The territory's DOM surfaces render the canon character-exact and keep
// the seal rules: numeral per fragment on a stamped place, blind
// impressions in the tally, no numeral when blind.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Seal } from '../src/components/Seal'
import { canon } from '../src/content/canon'
import { PlaceText } from '../src/territory/PlaceText'
import { RegionTitle } from '../src/territory/RegionTitle'
import { Tally } from '../src/territory/Tally'
import { placePlaces } from '../src/world/geography'

const rect = { x: 0, y: 0, w: 1170, h: 2532 }

describe('territory renders the canon character-exact', () => {
  for (const movement of canon.movements) {
    const fragments = movement.fragments.map((n) => canon.fragments[n - 1]!)
    const places = placePlaces({ cycle: 1, region: movement.id, rect, fragments, short: 390 })
    for (const place of places) {
      it(`place ${place.n} (${movement.id})`, () => {
        const { container } = render(
          <PlaceText place={place} status={{ n: place.n, state: 'found', reveal: 1, found: true, stampedAt: 0 }} />,
        )
        const lines = Array.from(container.querySelectorAll('[data-canon="fragment"] [data-canon-line]')).map((el) => el.textContent ?? '')
        expect(lines).toEqual(place.fragment.lines)
        expect(lines.join('\n')).toBe(place.fragment.lines.join('\n'))
        expect(container.querySelector('[data-seal]')?.textContent).toBe(place.fragment.seal)
        expect(container.innerHTML.includes(place.fragment.laminaCue)).toBe(false)
      })
    }
  }

  it('an unfound place shows its text and no seal', () => {
    const places = placePlaces({ cycle: 1, region: 'mar', rect, fragments: canon.fragments.slice(0, 4), short: 390 })
    const { container } = render(
      <PlaceText place={places[0]!} status={{ n: 1, state: 'present', reveal: 1, found: false, stampedAt: null }} />,
    )
    expect(container.querySelector('[data-seal]')).toBeNull()
    expect(container.querySelectorAll('[data-canon-line]')).toHaveLength(canon.fragments[0]!.lines.length)
  })

  it('the tally inks found fragments with their numeral and leaves the rest blind', () => {
    const threshold = { from: 'mar' as const, band: { x: 0, y: 0, w: 1170, h: 500 }, fragments: [1, 2, 3, 4] }
    const { container } = render(<Tally threshold={threshold} found={new Set([2, 4])} />)
    const impressions = container.querySelectorAll('.tally__impression')
    expect(impressions).toHaveLength(4)
    expect(container.querySelectorAll('[data-inked]')).toHaveLength(2)
    expect(Array.from(container.querySelectorAll('[data-seal]')).map((el) => el.textContent)).toEqual(['II', 'IV'])
    expect(container.querySelectorAll('.seal--blind')).toHaveLength(2)
    expect(container.textContent).toBe('IIIV')
  })

  it('a blind seal never carries a numeral', () => {
    const { container } = render(<Seal numeral="VII" blind />)
    expect(container.querySelector('[data-seal]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('region titles keep the canon title verbatim', () => {
    for (const m of canon.movements) {
      const { container, unmount } = render(<RegionTitle region={m.id} x={0} y={0} />)
      expect(container.querySelector('[data-canon="movement-title"]')?.textContent).toBe(m.title)
      unmount()
    }
  })
})
