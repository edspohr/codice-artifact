// Cielo's air: wind streams cross the open sky and thermals rise. Inside a
// stream the visitor is carried; outside, almost nothing moves them. One
// stream (the main air) rises past every place of Cielo and ends at the
// exit; a few strays branch off and lead nowhere in particular. A pure
// function of the cycle; the shader shows the same field as moving smoke.
import { config } from '../gestures/config'
import { hashSeed, rng } from './rng'
import { regionScale } from './scale'
import type { Place, Rect, Vec2 } from './types'

export interface Stream {
  pts: Vec2[]
  /** Per segment: speed (world px/s), half width (world px) and gain (0..1, a stray peels off gradually). */
  speed: number[]
  width: number[]
  gain: number[]
}

export interface WindInput {
  cycle: number
  rect: Rect
  places: readonly Place[]
  short: number
  viewW: number
  viewH: number
}

function bezier(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

export function buildWind(input: WindInput): Stream[] {
  const { cycle, rect, short } = input
  const s = regionScale('cielo')
  const vw = input.viewW / s
  const vh = input.viewH / s
  const random = rng(hashSeed('wind', cycle))
  const width = (config.CIELO_WIND_WIDTH * short) / s
  const minX = rect.x + vw * 0.3
  const maxX = rect.x + rect.w - vw * 0.3
  const clampX = (x: number) => Math.min(maxX, Math.max(minX, x))
  const places = input.places.filter((p) => p.region === 'cielo').sort((a, b) => b.y - a.y) // bottom first
  const exit = places.find((p) => p.n === 22)
  const others = places.filter((p) => p.n !== 22)

  // The main air: from the entry, past each place (beside it: the text emerges, a small
  // drag or flick arrives), and up a last thermal to the exit.
  const pass = (p: Place, from: Vec2): Vec2 => {
    // On the side the air comes from (its momentum never carries the visitor through the text),
    // or the side with more sky when it comes from straight below.
    const dx = from.x - p.x
    const side = Math.abs(dx) > (short * 0.2) / s ? Math.sign(dx) : p.x < rect.x + rect.w / 2 ? 1 : -1
    return { x: clampX(p.x + side * (short * 0.42) / s), y: p.y + (short * 0.05) / s }
  }
  const way: Vec2[] = [{ x: rect.x + rect.w / 2, y: rect.y + rect.h - vh * 0.15 }]
  for (const p of others) way.push(pass(p, way[way.length - 1]!))
  if (exit) way.push({ x: exit.x, y: exit.y })
  else way.push({ x: rect.x + rect.w / 2, y: rect.y + vh * 0.5 })

  const main: Stream = { pts: [], speed: [], width: [], gain: [] }
  let entryPts = 0
  for (let i = 0; i + 1 < way.length; i++) {
    const a = way[i]!
    const b = way[i + 1]!
    // A thermal rises from a, then the air bends across to b.
    const c = { x: a.x + (random() - 0.5) * vw * 0.1, y: a.y + (b.y - a.y) * (0.65 + random() * 0.2) }
    const n = 8
    for (let k = i === 0 ? 0 : 1; k <= n; k++) main.pts.push(bezier(a, c, b, k / n))
    if (i === 0) entryPts = main.pts.length - 1
  }
  for (let i = 0; i + 1 < main.pts.length; i++) {
    const a = main.pts[i]!
    const b = main.pts[i + 1]!
    const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 1.5
    main.speed.push(vertical ? config.CIELO_THERMAL_SPEED : config.CIELO_WIND_SPEED)
    // The first rise is broad: wherever the visitor comes up from the massif, the air finds them.
    main.width.push(i < entryPts ? width * (2.6 - (1.6 * i) / Math.max(1, entryPts)) : width)
    main.gain.push(1)
  }
  const streams: Stream[] = [main]

  // Strays: branch off the main air, cross the sky sideways and thin out. They peel off
  // gradually (a still visitor stays in the main air), keep clear of every place and
  // never rejoin the main air.
  const strays = Math.max(0, Math.round(config.CIELO_STRAY_STREAMS))
  const clearOfPlaces = (short * config.EMERGE_DISTANCE * 1.2) / s
  const nearMain = (q: Vec2) => main.pts.some((m) => Math.hypot(m.x - q.x, m.y - q.y) < width * 2.2)
  for (let k = 0, tries = 0; k < strays && main.pts.length > 4 && tries < 40; tries++) {
    const from = main.pts[Math.floor((0.1 + 0.8 * random()) * (main.pts.length - 1))]!
    const dir = from.x < rect.x + rect.w / 2 ? 1 : -1
    const end = { x: clampX(from.x + dir * (0.4 + random() * 0.5) * (maxX - minX)), y: from.y - vh * (0.1 + random() * 0.5) }
    const ctrl = { x: (from.x + end.x) / 2, y: from.y + (random() - 0.6) * vh * 0.4 }
    const pts: Vec2[] = []
    for (let i = 0; i <= 8; i++) pts.push(bezier(from, ctrl, end, i / 8))
    if (pts.some((q) => places.some((p) => Math.hypot(p.x - q.x, p.y - q.y) < clearOfPlaces))) continue
    if (pts.slice(3).some(nearMain)) continue
    const stray: Stream = { pts, speed: [], width: [], gain: [] }
    for (let i = 0; i < 8; i++) {
      stray.speed.push(config.CIELO_WIND_SPEED * (0.9 - 0.06 * i))
      stray.width.push(width * 0.85)
      stray.gain.push(Math.min(0.85, i / 4))
    }
    streams.push(stray)
    k++
  }
  return streams
}

/**
 * The wind at a world point (world px/ms): along the nearest segment of each
 * stream, weighted by distance, with a pull toward the stream's centre line,
 * so an air current catches whoever drifts into it.
 */
export function windAt(streams: readonly Stream[], x: number, y: number): Vec2 {
  let wx = 0
  let wy = 0
  for (const st of streams) {
    let bestW = 0
    let bx = 0
    let by = 0
    for (let i = 0; i + 1 < st.pts.length; i++) {
      const a = st.pts[i]!
      const b = st.pts[i + 1]!
      const width = st.width[i] ?? 1
      const abx = b.x - a.x
      const aby = b.y - a.y
      const len2 = abx * abx + aby * aby || 1
      const raw = ((x - a.x) * abx + (y - a.y) * aby) / len2
      // A stream ends where it ends: no air beyond its last point (the exit is still air).
      if (i + 2 === st.pts.length && raw > 1) continue
      const t = Math.max(0, Math.min(1, raw))
      const px = a.x + abx * t
      const py = a.y + aby * t
      const d = Math.hypot(x - px, y - py)
      if (d > width * 2.5) continue
      const w = Math.exp(-((d / width) ** 2)) * (st.gain[i] ?? 1)
      if (w > bestW) {
        const len = Math.sqrt(len2)
        bestW = w
        const speed = (st.speed[i] ?? config.CIELO_WIND_SPEED) / 1000
        // Along the stream, and drawn toward its centre line.
        const pull = d > 1 ? (0.45 * speed * Math.min(1, d / width)) / d : 0
        bx = (abx / len) * speed + (px - x) * pull
        by = (aby / len) * speed + (py - y) * pull
      }
    }
    wx += bx * bestW
    wy += by * bestW
  }
  const max = Math.max(config.CIELO_WIND_SPEED, config.CIELO_THERMAL_SPEED) / 1000
  const m = Math.hypot(wx, wy)
  if (m > max) {
    wx *= max / m
    wy *= max / m
  }
  return { x: wx, y: wy }
}
