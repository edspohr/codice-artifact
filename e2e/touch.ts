import type { CDPSession, Page } from '@playwright/test'

// Real touch events through the Chrome DevTools Protocol, so touch-action,
// pointer capture and pointercancel behave as they would on a phone.

export async function cdp(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page)
}

export interface Point {
  x: number
  y: number
}

export async function swipe(session: CDPSession, from: Point, to: Point, steps = 12, stepDelayMs = 16) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await new Promise((r) => setTimeout(r, stepDelayMs))
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

export async function tap(session: CDPSession, p: Point) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] })
  await new Promise((r) => setTimeout(r, 40))
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** A multi-point stroke (polyline) with the finger down the whole time. */
export async function stroke(session: CDPSession, points: Point[], stepDelayMs = 12) {
  const first = points[0]
  if (!first) return
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x, y: first.y }] })
  for (const p of points.slice(1)) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] })
    await new Promise((r) => setTimeout(r, stepDelayMs))
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
