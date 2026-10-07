import type { Fragment, MovementId } from '../content/canon'

export interface Vec2 {
  x: number
  y: number
}

/** A rectangle in world px: x,y is the top-left corner. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Region {
  id: MovementId
  rect: Rect
}

export interface Place {
  n: number
  fragment: Fragment
  region: MovementId
  /** Centre in world px. */
  x: number
  y: number
  /** Seeded variation of the stamp: rotation (deg), offset (px), pressure (0..1). */
  stamp: { rotation: number; dx: number; dy: number; pressure: number }
  /** Seed for the irregular formation mask. */
  seed: number
}

export interface Threshold {
  /** Region being left. */
  from: MovementId
  /** Band in world px. */
  band: Rect
  /** Fragments tallied at this threshold. */
  fragments: number[]
}

export interface World {
  /** Whole world in px, including the stub above Mar. */
  width: number
  height: number
  regions: Region[]
  places: Place[]
  thresholds: Threshold[]
  /** Viewport short side used to scale distances. */
  short: number
  /** Where the visitor starts (camera centre). */
  start: Vec2
  cycle: number
}
