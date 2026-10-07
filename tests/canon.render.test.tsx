// Character-exact rendering. Every station is mounted and the DOM text of
// its canon nodes is compared, with strict equality, against the canon file.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { journey } from '../src/content/journey'
import { StationView } from '../src/views/StationView'

function mount(id: string) {
  const station = journey.find((s) => s.id === id)
  if (!station) throw new Error(id)
  return render(<StationView station={station} role="current" focusOnEnter={false} />)
}

function linesOf(container: HTMLElement, scope: string): string[] {
  const root = container.querySelector(`[data-canon="${scope}"]`)
  if (!root) throw new Error(`no [data-canon="${scope}"]`)
  return Array.from(root.querySelectorAll('[data-canon-line]')).map((el) => el.textContent ?? '')
}

describe('canon renders character-exact', () => {
  it('epigraph', () => {
    const { container } = mount('epigraph')
    expect(linesOf(container, 'epigraph')).toEqual(canon.epigraph)
  })

  it('reprise', () => {
    const { container } = mount('reprise')
    expect(linesOf(container, 'reprise')).toEqual(canon.reprise)
  })

  for (const movement of canon.movements) {
    it(`divider ${movement.id} shows the title verbatim and no seal`, () => {
      const { container } = mount(`divider:${movement.id}`)
      const title = container.querySelector('[data-canon="movement-title"]')
      expect(title?.textContent).toBe(movement.title)
      expect(container.querySelector('[data-seal]')).toBeNull()
      // The lámina is decorative: no caption, no alt text.
      const img = container.querySelector('img')
      expect(img?.getAttribute('alt')).toBe('')
    })
  }

  for (const fragment of canon.fragments) {
    it(`fragment ${fragment.n}`, () => {
      const { container } = mount(`frag:${fragment.n}`)
      const lines = linesOf(container, 'fragment')
      // Line by line, and as one block: order, count and content.
      expect(lines).toEqual(fragment.lines)
      expect(lines.join('\n')).toBe(fragment.lines.join('\n'))
      // Each canon line is its own block element, so breaks render as given.
      for (const el of container.querySelectorAll('[data-canon-line]')) {
        expect(el.tagName).toBe('P')
      }
      // The seal carries exactly the canon numeral.
      expect(container.querySelector('[data-seal]')?.textContent).toBe(fragment.seal)
      // The lámina cue never reaches the DOM (text or attributes).
      expect(container.innerHTML.includes(fragment.laminaCue)).toBe(false)
    })
  }

  it('renders no canon text outside canon nodes', () => {
    for (const station of journey) {
      const { container, unmount } = render(<StationView station={station} role="current" focusOnEnter={false} />)
      const all = (container.textContent ?? '').trim()
      const canonText = Array.from(container.querySelectorAll('[data-canon]'))
        .map((el) => el.textContent ?? '')
        .join('')
        .trim()
      if (station.kind === 'fragment' || station.kind === 'divider' || station.kind === 'epigraph' || station.kind === 'reprise') {
        // Fragment views also contain the seal numeral; everything else is canon.
        const sealText = container.querySelector('[data-seal]')?.textContent ?? ''
        expect(all.replace(sealText, '').trim()).toBe(canonText)
      }
      unmount()
    }
  })
})
