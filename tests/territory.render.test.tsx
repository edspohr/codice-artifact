// The territory's DOM surfaces render the canon character-exact and keep
// the seal rules: numeral per fragment on a stamped place, blind
// impressions in the tally, no numeral when blind.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Seal } from '../src/components/Seal'
import { canon } from '../src/content/canon'
import { Cover } from '../src/territory/Cover'
import { PlaceText } from '../src/territory/PlaceText'
import { RegionTitle } from '../src/territory/RegionTitle'
import { Return } from '../src/territory/Return'
import { Tally } from '../src/territory/Tally'
import { ThresholdMark } from '../src/territory/ThresholdMark'
import { placePlaces } from '../src/world/geography'

const rect = { x: 0, y: 0, w: 546, h: 3376 }

describe('territory renders the canon character-exact', () => {
  for (const movement of canon.movements) {
    const fragments = movement.fragments.map((n) => canon.fragments[n - 1]!)
    const places = placePlaces({ cycle: 1, region: movement.id, rect, fragments, short: 390, viewH: 844, viewW: 390 })
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
    const places = placePlaces({ cycle: 1, region: 'mar', rect, fragments: canon.fragments.slice(0, 4), short: 390, viewH: 844, viewW: 390 })
    const { container } = render(
      <PlaceText place={places[0]!} status={{ n: 1, state: 'present', reveal: 1, found: false, stampedAt: null }} />,
    )
    expect(container.querySelector('[data-seal]')).toBeNull()
    expect(container.querySelectorAll('[data-canon-line]')).toHaveLength(canon.fragments[0]!.lines.length)
  })

  it('the tally inks found fragments with their numeral and leaves the rest blind', () => {
    const threshold = { from: 'mar' as const, to: 'tierra' as const, band: { x: 0, y: 0, w: 1170, h: 500 }, fragments: [1, 2, 3, 4] }
    const { container } = render(<Tally threshold={threshold} found={new Set([2, 4])} />)
    const impressions = container.querySelectorAll('.tally__impression')
    expect(impressions).toHaveLength(4)
    expect(container.querySelectorAll('[data-inked]')).toHaveLength(2)
    expect(Array.from(container.querySelectorAll('[data-seal]')).map((el) => el.textContent)).toEqual(['II', 'IV'])
    expect(container.querySelectorAll('.seal--blind')).toHaveLength(2)
    expect(container.textContent).toBe('IIIV')
  })

  it('the closing of a region shows its title verbatim with the tally beneath', () => {
    const threshold = { from: 'mar' as const, to: 'tierra' as const, band: { x: 0, y: 0, w: 546, h: 500 }, fragments: [1, 2, 3, 4] }
    const { container } = render(<ThresholdMark threshold={threshold} found={new Set([1, 4])} />)
    expect(container.querySelector('[data-canon="movement-title"]')?.textContent).toBe(canon.movements[0]!.title)
    expect(container.querySelectorAll('.tally__impression')).toHaveLength(4)
    expect(Array.from(container.querySelectorAll('[data-seal]')).map((el) => el.textContent)).toEqual(['I', 'IV'])
    expect(container.querySelector('.threshold-mark')?.hasAttribute('data-clear')).toBe(true)
  })

  it('the cover carries the title of the work and the signature named after the author', () => {
    const { container } = render(<Cover dismissed={false} />)
    expect(container.querySelector('[data-canon="work-title"]')?.textContent).toBe(canon.title)
    const img = container.querySelector('img.cover__signature')
    expect(img?.getAttribute('alt')).toBe(canon.author)
    expect(container.textContent).toBe(canon.title)
  })

  it('the Return: the reprise verbatim in italics, the lone seal with no numeral, then the Colofón', () => {
    const reprise = render(<Return stage="reprise" onSeal={() => {}} />)
    const lines = Array.from(reprise.container.querySelectorAll('[data-canon="reprise"] [data-canon-line]')).map((el) => el.textContent ?? '')
    expect(lines).toEqual(canon.reprise)
    expect(reprise.container.querySelector('.reprise-line')).not.toBeNull()
    reprise.unmount()
    const seal = render(<Return stage="seal" onSeal={() => {}} />)
    expect(seal.container.querySelector('button')?.getAttribute('aria-label')).toBe('Colofón')
    expect(seal.container.querySelector('[data-seal]')).toBeNull()
    expect(seal.container.textContent).toBe('')
    seal.unmount()
    const colofon = render(<Return stage="colofon" onSeal={() => {}} />)
    expect(colofon.container.querySelector('a[href^="https://www.linkedin.com/"]')).not.toBeNull()
    expect(colofon.container.querySelector('[data-cycle]')?.getAttribute('data-cycle')).toBe('1')
    colofon.unmount()
    expect(render(<Return stage="idle" onSeal={() => {}} />).container.textContent).toBe('')
  })

  it('a blind seal never carries a numeral', () => {
    const { container } = render(<Seal numeral="VII" blind />)
    expect(container.querySelector('[data-seal]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('region titles keep the canon title verbatim', () => {
    for (const m of canon.movements) {
      const { container, unmount } = render(<RegionTitle region={m.id} />)
      expect(container.querySelector('[data-canon="movement-title"]')?.textContent).toBe(m.title)
      unmount()
    }
  })
})
