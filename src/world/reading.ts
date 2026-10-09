import type { Fragment } from '../content/canon'

export function countWords(lines: readonly string[]): number {
  return lines.reduce((n, line) => n + line.split(/\s+/).filter(Boolean).length, 0)
}

/** Canon words of a fragment: the reading dwell at the exit is derived from it. */
export function fragmentWords(fragment: Fragment): number {
  return countWords(fragment.lines)
}
