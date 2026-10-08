// The spec's private appendices (arcana, Hebrew letters) must never surface
// in the artifact. Terms are read from the spec at test time, never
// hard-coded, and checked against everything that is NOT canon text: copy,
// attributes, alt, aria, metadata, title, and non-canon DOM text.
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canon } from '../src/content/canon'
import { copy } from '../src/content/copy.es'
import { journey } from '../src/content/journey'
import { PlaceText } from '../src/territory/PlaceText'
import { RegionTitle } from '../src/territory/RegionTitle'
import { Tally } from '../src/territory/Tally'
import { StationView } from '../src/views/StationView'
import { placePlaces } from '../src/world/geography'

const root = resolve(__dirname, '..')
const spec = readFileSync(resolve(root, 'docs/CODICE_R4_SPEC_DISENO.md'), 'utf8')

interface Term {
  text: string
  caseSensitive: boolean
}

/** Pulls the reserved terms out of appendices A and B of the spec. */
function appendixTerms(): Term[] {
  const start = spec.indexOf('\n## A.')
  const end = spec.indexOf('\n## C.')
  if (start < 0 || end < 0) throw new Error('spec: appendices A/B not found')
  const section = spec.slice(start, end)
  const terms = new Map<string, Term>()
  const add = (text: string, caseSensitive = false) => {
    const t = text.trim()
    if (t.length < 2) return
    terms.set(t, { text: t, caseSensitive })
  }

  // Heading of A: "(arcanos + hebreo)" → each word, singular too.
  const headingA = section.match(/\n## A\.[^\n]*\(([^)]*)\)/)
  for (const w of headingA?.[1]?.split('+') ?? []) {
    const word = w.trim()
    add(word)
    if (word.endsWith('s')) add(word.slice(0, -1))
  }
  // Heading of B: the name after the dash.
  const headingB = section.match(/\n## B\.[^\n]*—\s*([^(\n]+)/)
  if (headingB?.[1]) add(headingB[1])
  // First word of A's body (the tarot tradition).
  const bodyA = section.slice(section.indexOf('\n', 1)).trim()
  const firstWord = bodyA.match(/^([A-ZÁÉÍÓÚ][a-záéíóú]+)\b/)
  if (firstWord?.[1]) add(firstWord[1])

  // Table rows: | n | relato | <roman> <Arcana name> — meaning | <glyph> <Letter> — meaning |
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split("|").map((c: string) => c.trim())
    if (cells.length < 6) continue
    const arcana = cells[3]?.match(/^(?:[IVXL]+|0)\s+(.+?)\s+—/)
    if (arcana?.[1]) add(arcana[1])
    const hebrew = cells[4]?.match(/^(\S+)\s+([^\s—]+)\s+—/)
    if (hebrew) {
      add(hebrew[1] ?? '', true) // the glyph
      add(hebrew[2] ?? '', true) // the letter name: short proper nouns, case-sensitive
    }
  }
  return Array.from(terms.values())
}

function matcher(term: Term): RegExp {
  const escaped = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const isWordy = /^[\p{L}\p{N}\s]+$/u.test(term.text)
  const pattern = isWordy ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])` : escaped
  return new RegExp(pattern, term.caseSensitive ? 'u' : 'iu')
}

function flatten(obj: unknown, path = 'copy'): Array<[string, string]> {
  if (typeof obj === 'string') return [[path, obj]]
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => flatten(v, `${path}.${k}`))
  }
  return []
}

/** Non-canon surfaces of a rendered station: text outside data-canon nodes and all attributes. */
function surfacesOf(container: HTMLElement, label: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const el = node.parentElement
      if (el && !el.closest('[data-canon]')) out.push([`${label} text`, node.textContent ?? ''])
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const attr of (node as Element).attributes) out.push([`${label} @${attr.name}`, attr.value])
    }
    node = walker.nextNode()
  }
  return out
}

describe('appendix terms never surface', () => {
  const terms = appendixTerms()

  it('extracts a meaningful set of terms from the spec', () => {
    expect(terms.length).toBeGreaterThan(40)
  })

  it('are absent from copy, metadata, title and every non-canon DOM surface', () => {
    const surfaces: Array<[string, string]> = [...flatten(copy)]
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    surfaces.push(['index.html', html])
    for (const station of journey) {
      const { container, unmount } = render(<StationView station={station} role="current" focusOnEnter={false} />)
      surfaces.push(...surfacesOf(container, station.id))
      unmount()
    }
    // Territory surfaces: every place (stamped), every region title, a tally.
    const rect = { x: 0, y: 0, w: 546, h: 3376 }
    for (const m of canon.movements) {
      const fragments = m.fragments.map((n) => canon.fragments[n - 1]!)
      for (const place of placePlaces({ cycle: 1, region: m.id, rect, fragments, short: 390, viewH: 844 })) {
        const { container, unmount } = render(
          <PlaceText place={place} status={{ n: place.n, state: 'found', reveal: 1, found: true, stampedAt: 0 }} />,
        )
        surfaces.push(...surfacesOf(container, `place:${place.n}`))
        unmount()
      }
      const title = render(<RegionTitle region={m.id} />)
      surfaces.push(...surfacesOf(title.container, `title:${m.id}`))
      title.unmount()
    }
    const tally = render(<Tally threshold={{ from: 'mar', band: rect, fragments: [1, 2, 3, 4] }} found={new Set([1, 3])} />)
    surfaces.push(...surfacesOf(tally.container, 'tally'))
    tally.unmount()
    const offending: string[] = []
    for (const term of terms) {
      const re = matcher(term)
      for (const [where, value] of surfaces) {
        if (re.test(value)) offending.push(`"${term.text}" in ${where}: ${value.slice(0, 80)}`)
      }
    }
    expect(offending, offending.join('\n')).toEqual([])
  })
})
