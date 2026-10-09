import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cdp, stroke, swipe, tap } from './touch.ts'

interface Canon {
  title: string
  author: string
  epigraph: string[]
  movements: Array<{ id: string; title: string; fragments: number[] }>
  fragments: Array<{ n: number; seal: string; lines: string[] }>
}

const canon: Canon = JSON.parse(
  readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../src/content/codice.canon.json'), 'utf8'),
)

const BASE = '/?proto=territory&cfg.SOUND_ENABLED=0'

async function ready(page: Page) {
  await expect(page.locator('.territory[data-ready]')).toHaveCount(1, { timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
}

/** Cover → epigraph with one click (mouse works on every project). */
async function toEpigraph(page: Page) {
  const v = page.viewportSize()!
  await page.mouse.click(v.width / 2, v.height * 0.7)
  await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'epigraph')
  await page.waitForTimeout(300)
}

/** Cover → epigraph → territory, by mouse. */
async function enter(page: Page) {
  await toEpigraph(page)
  const v = page.viewportSize()!
  await page.mouse.click(v.width / 2, v.height * 0.7)
  await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'territory')
}

async function expectNoPageScroll(page: Page) {
  const r = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollX: window.scrollX,
    overflowH: document.documentElement.scrollHeight - window.innerHeight,
    overflowW: document.documentElement.scrollWidth - window.innerWidth,
  }))
  expect(r.scrollY).toBe(0)
  expect(r.scrollX).toBe(0)
  expect(r.overflowH).toBeLessThanOrEqual(0)
  expect(r.overflowW).toBeLessThanOrEqual(0)
}

const cameraOf = (page: Page) =>
  page.evaluate(() => {
    const t = window.__codice!.territory!.territory
    return { x: t.camera.x, y: t.camera.y }
  })

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a: [number, number, number], b: [number, number, number]) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

test.describe('territory: entry and the linear path', () => {
  test('the cover: the title of the work and the stamped signature; a touch dissolves it', async ({ page }) => {
    await page.goto(BASE)
    await ready(page)
    expect(await page.locator('.territory').getAttribute('data-phase')).toBe('cover')
    await expect(page.locator('.cover [data-canon="work-title"]')).toHaveText(canon.title)
    await expect(page.locator('.cover img.cover__signature')).toHaveAttribute('alt', canon.author)
    // Nothing else is on screen: no place, no title event, the epigraph hidden.
    await expect(page.locator('.place')).toHaveCount(0)
    await expect(page.locator('.region-title')).toHaveCount(0)
    await expect(page.locator('.epigraph-veil')).toHaveAttribute('aria-hidden', 'true')
    await toEpigraph(page)
    await expect(page.locator('.cover')).toHaveCount(0, { timeout: 5000 })
  })

  test('the epigraph alone on white; a touch opens the territory', async ({ page, viewport }) => {
    await page.goto(BASE)
    await ready(page)
    await toEpigraph(page)
    const lines = await page.locator('.epigraph-veil [data-canon-line]').allTextContents()
    expect(lines).toEqual(canon.epigraph)
    expect(await page.locator('.territory').getAttribute('data-phase')).toBe('epigraph')
    // White: the canvas shows paper before the first touch.
    const px = await page.evaluate(() => window.__codice!.territory!.territory.readPixel(100, 600))
    expect(px[0]).toBeGreaterThan(245)
    const s = await cdp(page)
    await tap(s, { x: viewport!.width / 2, y: viewport!.height * 0.7 })
    await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'territory')
    // Mar's title appears alone on entering, then dissolves.
    await expect(page.locator('.region-title[data-movement="mar"] [data-canon="movement-title"]')).toHaveText(
      canon.movements[0]!.title,
    )
    // No place is in view at the start: dense ink, nothing scattered.
    await page.waitForTimeout(800)
    await expect(page.locator('.place')).toHaveCount(0)
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.place')).toHaveCount(0)
    await expectNoPageScroll(page)
  })

  test('a title and a fragment are never on screen together', async ({ page }) => {
    await page.goto(BASE)
    await ready(page)
    await enter(page)
    // Ask for the first place immediately: it must wait for the title to dissolve.
    await page.keyboard.press('ArrowRight')
    let sawTitle = false
    let sawPlace = false
    for (let i = 0; i < 70; i++) {
      const [titles, places] = await Promise.all([page.locator('.region-title').count(), page.locator('.place').count()])
      if (titles > 0) sawTitle = true
      if (places > 0) sawPlace = true
      expect(titles > 0 && places > 0, 'title and fragment co-present').toBe(false)
      await page.waitForTimeout(100)
    }
    expect(sawTitle).toBe(true)
    expect(sawPlace).toBe(true)
  })

  test('on arrival the world comes to rest with the whole text block and the seal inside safe margins', async ({ page, viewport }) => {
    await page.goto(BASE)
    await ready(page)
    await enter(page)
    for (const n of [1, 2]) {
      await page.keyboard.press('ArrowRight')
      const place = page.locator(`.place[data-n="${n}"]`)
      await expect(place).toHaveAttribute('data-state', 'found', { timeout: 8000 })
      await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.isResting()), { timeout: 5000 }).toBe(true)
      const text = (await place.locator('[data-canon="fragment"]').boundingBox())!
      const seal = (await place.locator('.place__seal').boundingBox())!
      const m = 27
      for (const box of [text, seal]) {
        expect(box.x).toBeGreaterThanOrEqual(m)
        expect(box.y).toBeGreaterThanOrEqual(m)
        expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width - m)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height - m)
      }
    }
  })

  test('the ascent is readable in any still screenshot: lighter toward the top', async ({ page, viewport }) => {
    // No places emerge in this test so the ground alone is measured.
    await page.goto(`${BASE}&cfg.EMERGE_DISTANCE=0&cfg.ARRIVE_DISTANCE=0&cfg.MAR_CURRENT_SPEED=0`)
    await ready(page)
    await enter(page)
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    const w = viewport!.width
    const h = viewport!.height
    // Inside the channel, below the threshold's colossus (which is a mass of ink by design).
    for (const f of [0.95, 0.75, 0.5, 0.3, 0.16]) {
      const bands = await page.evaluate(
        ([f, w, h]) => {
          const t = window.__codice!.territory!.territory
          const region = t.world.regions[0]!.rect
          t.camera.x = region.x + region.w / 2
          t.camera.y = region.y + region.h * f
          t.camera.clamp()
          t.glideTo({ x: t.camera.x, y: t.camera.y })
          const mean = (yFrac: number) => {
            let sum = 0
            for (let i = 1; i <= 16; i++) sum += t.readPixel((w * i) / 17, h * yFrac)[0]
            return sum / 16
          }
          const band = (a: number, b: number, c: number) => (mean(a) + mean(b) + mean(c)) / 3
          return { top: band(0.04, 0.1, 0.16), bottom: band(0.84, 0.9, 0.96) }
        },
        [f, w, h] as const,
      )
      expect(bands.top, `camera at ${f} of the channel`).toBeGreaterThan(bands.bottom + 6)
    }
  })

  test('Avanzar travels place by place in canonical order, character-exact, then to the threshold', async ({ page }) => {
    await page.goto(BASE)
    await ready(page)
    const advance = page.getByRole('button', { name: 'Avanzar' })
    const back = page.getByRole('button', { name: 'Volver' })
    await expect(advance).toHaveCount(1)
    await expect(back).toHaveCount(1)
    await expect(back).toBeDisabled()
    // Hidden places do not exist in the DOM.
    await expect(page.locator('.place')).toHaveCount(0)
    // Cover → epigraph by the linear path.
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'epigraph')

    for (const n of canon.movements[0]!.fragments) {
      await page.keyboard.press('ArrowRight')
      const place = page.locator(`.place[data-n="${n}"]`)
      await expect(place).toHaveAttribute('data-state', 'found', { timeout: 5000 })
      const lines = await place.locator('[data-canon="fragment"] [data-canon-line]').allTextContents()
      expect(lines).toEqual(canon.fragments[n - 1]!.lines)
      await expect(place.locator('[data-seal]')).toHaveText(canon.fragments[n - 1]!.seal, { timeout: 8000 })
      // Focus moved to the text for assistive tech.
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-n'))).toBe(String(n))
      // Whatever is mounted is emerging, present or found: never a hidden place.
      for (const state of await page.locator('.place').evaluateAll((els) => els.map((el) => el.getAttribute('data-state')))) {
        expect(state).not.toBe('hidden')
      }
    }
    // The closing of Mar: its title with four inked impressions beneath, in order, nothing blind.
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1200)
    const mark = page.locator('.threshold-mark[data-threshold="mar"]')
    await expect(mark.locator('[data-canon="movement-title"]')).toHaveText(canon.movements[0]!.title)
    const tally = mark.locator('.tally')
    await expect(tally.locator('.tally__impression')).toHaveCount(4)
    await expect(tally.locator('[data-inked]')).toHaveCount(4)
    expect(await tally.locator('[data-seal]').allTextContents()).toEqual(['I', 'II', 'III', 'IV'])
    // Beyond: the stub with Tierra's title only.
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1200)
    expect(await page.locator('.territory').getAttribute('data-region')).toBe('stub')
    await expect(page.locator('.region-title[data-movement="tierra"] [data-canon="movement-title"]')).toHaveText(
      canon.movements[1]!.title,
    )
    // Volver goes back down (after Tierra's title event has dissolved).
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => page.locator('.territory').getAttribute('data-region'), { timeout: 10_000 }).toBe('mar')
    await expectNoPageScroll(page)
  })

  test('the tally shows blind impressions for places not found', async ({ page }) => {
    await page.goto(`${BASE}&stop=6`)
    await ready(page)
    await page.waitForTimeout(1500)
    const tally = page.locator('.tally[data-threshold="mar"]')
    await expect(tally.locator('.tally__impression')).toHaveCount(4)
    await expect(tally.locator('.seal--blind')).toHaveCount(4)
    await expect(tally.locator('[data-seal]')).toHaveCount(0)
  })
})

test.describe('territory: touch', () => {
  test('dragging moves the world partially (traction) and never scrolls the page', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0`)
    await ready(page)
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await tap(s, { x: w / 2, y: h / 2 })
    await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'epigraph')
    await page.waitForTimeout(300)
    await tap(s, { x: w / 2, y: h / 2 })
    await expect(page.locator('.territory')).toHaveAttribute('data-phase', 'territory')
    await page.waitForTimeout(300)
    const before = await cameraOf(page)
    await swipe(s, { x: w * 0.8, y: h * 0.5 }, { x: w * 0.2, y: h * 0.5 }, 20, 16)
    await page.waitForTimeout(100)
    const after = await cameraOf(page)
    // The finger went left 0.6·w; the world followed to the right by roughly traction × that
    // (less toward the bank), plus inertia.
    expect(after.x - before.x).toBeGreaterThan(w * 0.6 * 0.25)
    expect(after.x - before.x).toBeLessThan(w * 0.6 * 1.6)
    await swipe(s, { x: w * 0.5, y: h * 0.3 }, { x: w * 0.5, y: h * 0.9 }, 20, 16)
    await page.waitForTimeout(300)
    await expectNoPageScroll(page)
  })

  test('scrubbing smears the ink of the territory', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0&cfg.MAR_TRACTION=0.3`)
    await ready(page)
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await enter(page)
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    // Sample a row across the dense lower ink before and after scrubbing it.
    const sampleRow = () =>
      page.evaluate(([w, h]) => {
        const t = window.__codice!.territory!.territory
        const out: number[] = []
        for (let i = 1; i <= 8; i++) out.push(t.readPixel((w * i) / 9, h * 0.62)[0])
        return out
      }, [w, h] as const)
    const before = await sampleRow()
    const zig = []
    for (let i = 0; i <= 40; i++) zig.push({ x: w * 0.15 + (w * 0.7 * (i % 2)), y: h * 0.55 + (i / 40) * h * 0.14 })
    await stroke(s, zig, 10)
    await page.waitForTimeout(150)
    const after = await sampleRow()
    const diff = before.reduce((sum, v, i) => sum + Math.abs(v - (after[i] as number)), 0) / before.length
    expect(diff).toBeGreaterThan(4)
  })

  test('the ink parts around text: contrast under a place stays above 4.5:1 even after scrubbing it', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0&cfg.MAR_TRACTION=0.2`)
    await ready(page)
    await enter(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const place = page.locator('.place[data-n="2"]')
    await expect(place).toHaveAttribute('data-state', 'found', { timeout: 12000 })
    await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.isResting()), { timeout: 5000 }).toBe(true)
    const box = (await place.locator('[data-canon="fragment"]').boundingBox())!
    const s = await cdp(page)
    const w = viewport!.width
    // Scrub back and forth across the text block.
    const zig = []
    for (let i = 0; i <= 30; i++) zig.push({ x: box.x + (box.width * (i % 2)), y: box.y + (i / 30) * box.height })
    await stroke(s, zig, 10)
    await page.waitForTimeout(200)
    const ink: [number, number, number] = [22, 22, 22]
    const samples = await page.evaluate(
      ([x, y, bw, bh]) => {
        const t = window.__codice!.territory!.territory
        const out: Array<[number, number, number]> = []
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) out.push(t.readPixel(x + (bw * (i + 0.5)) / 6, y + (bh * (j + 0.5)) / 4))
        return out
      },
      [box.x, box.y, box.width, box.height] as const,
    )
    for (const px of samples) expect(contrast(ink, px)).toBeGreaterThanOrEqual(4.5)
    void w
  })

  test('help is invoked by holding still, and dispelled on release', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0`)
    await ready(page)
    await enter(page)
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    const strength = () => page.evaluate(() => window.__codice!.territory!.territory.helpStrength())
    expect(await strength()).toBe(0)
    // Hold the finger still: the help rises.
    await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2, y: h / 2 }] })
    await page.waitForTimeout(1800)
    const held = await strength()
    expect(held).toBeGreaterThan(0.5)
    // Release: it falls.
    await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(1800)
    expect(await strength()).toBeLessThan(held * 0.5)
    // A drag is not a hold.
    await swipe(s, { x: w * 0.3, y: h * 0.6 }, { x: w * 0.7, y: h * 0.6 }, 20, 40)
    expect(await strength()).toBeLessThan(0.2)
  })

  test('finding has a cost: a scar around the place and dirtier hands after each stamp', async ({ page }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0`)
    await ready(page)
    await enter(page)
    const dirt = () => page.evaluate(() => window.__codice!.territory!.territory.dirtLevel())
    expect(await dirt()).toBe(0)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.place[data-n="1"]')).toHaveAttribute('data-state', 'found', { timeout: 10_000 })
    await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.isResting()), { timeout: 5000 }).toBe(true)
    expect(await dirt()).toBe(1)
    // The scar: a jagged ring of broken ink around the place, outside the clearing. Sample the ring
    // above and below the place (in view after settling); some of it falls on broken ink.
    const samples = await page.evaluate(() => {
      const t = window.__codice!.territory!.territory
      const p = t.world.places.find((x) => x.n === 1)!
      const short = t.world.short
      const r = (window.__codice!.config as { SCAR_RADIUS: number }).SCAR_RADIUS * short
      const cx = p.x - t.camera.x + window.innerWidth / 2
      const cy = p.y - t.camera.y + window.innerHeight / 2
      const out: number[] = []
      for (const k of [0.9, 0.95, 1, 1.05, 1.1]) {
        for (const sy of [cy - r * k, cy + r * k]) {
          for (const dx of [-30, -15, 0, 15, 30]) {
            const sx = cx + dx
            if (sx > 4 && sx < window.innerWidth - 4 && sy > 4 && sy < window.innerHeight - 4) out.push(t.readPixel(sx, sy)[0])
          }
        }
      }
      return out
    })
    expect(samples.length).toBeGreaterThan(0)
    expect(Math.min(...samples)).toBeLessThan(120)
  })

  test('the threshold is a colossus: a mass of ink across the band, and a look back when first crossed', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0&cfg.LOOKBACK_MS=1500`)
    await ready(page)
    await enter(page)
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    // Frame the band from inside Mar; sample the band away from the closing mark's clearing.
    const dark = await page.evaluate(
      ([w]) => {
        const t = window.__codice!.territory!.territory
        const th = (t.world as unknown as { thresholds: Array<{ band: { x: number; y: number; w: number; h: number } }> }).thresholds[0]!
        t.camera.x = th.band.x + th.band.w / 2
        t.camera.y = th.band.y + th.band.h / 2 + 250
        t.glideTo({ x: t.camera.x, y: t.camera.y })
        const y = window.innerHeight / 2 - 250
        return [t.readPixel(w * 0.06, y)[0], t.readPixel(w * 0.94, y)[0]]
      },
      [viewport!.width] as const,
    )
    for (const v of dark) expect(v).toBeLessThan(110)
    // Cross upward: the look back plays once, zooming out and back.
    await page.evaluate(() => {
      const t = window.__codice!.territory!.territory
      t.glideTo({ x: t.camera.x, y: t.camera.y - 900 })
    })
    await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.isLookingBack()), { timeout: 5000 }).toBe(true)
    await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.currentZoom()), { timeout: 3000 }).toBeLessThan(0.6)
    await expect.poll(() => page.evaluate(() => window.__codice!.territory!.territory.isLookingBack()), { timeout: 5000 }).toBe(false)
    expect(await page.evaluate(() => window.__codice!.territory!.territory.currentZoom())).toBe(1)
    expect(await page.locator('.territory').getAttribute('data-region')).toBe('stub')
  })

  test('edge touches are ignored', async ({ page, viewport }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0`)
    await ready(page)
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await enter(page)
    await page.waitForTimeout(300)
    const before = await cameraOf(page)
    await swipe(s, { x: w - 6, y: h * 0.5 }, { x: w * 0.2, y: h * 0.5 })
    await page.waitForTimeout(300)
    const after = await cameraOf(page)
    expect(after.x).toBeCloseTo(before.x, 0)
  })

  test('a place that emerges and is left disperses; a stamped one stays', async ({ page }) => {
    await page.goto(`${BASE}&cfg.MAR_CURRENT_SPEED=0&cfg.EMERGE_MS=100&cfg.DISPERSE_MS=100`)
    await ready(page)
    await enter(page)
    // Jump the viewpoint near place 3 (outside the arrival radius, inside emergence) without
    // crossing it on the way, then glide away, then onto it.
    // Approach from the side with room, so the clamped camera cannot land inside the arrival radius.
    await page.evaluate(() => {
      const t = window.__codice!.territory!.territory
      const p = t.world.places.find((x) => x.n === 3)!
      t.camera.x = p.x
      t.camera.y = p.y + t.world.short * 0.4
      t.glideTo({ x: p.x, y: t.camera.y })
    })
    await expect(page.locator('.region-title')).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.place[data-n="3"]')).toHaveAttribute('data-state', 'present', { timeout: 5000 })
    const farFrom3 = () => {
      const t = window.__codice!.territory!.territory
      const p = t.world.places.find((x) => x.n === 3)!
      // The camera clamps to the world, so pick the reachable corner farthest from the place.
      const corners = [
        { x: 0, y: 0 },
        { x: 1e6, y: 0 },
        { x: 0, y: 1e6 },
        { x: 1e6, y: 1e6 },
      ]
      let best = corners[0]!
      let bestD = -1
      for (const c of corners) {
        const d = Math.hypot(Math.min(c.x, 1e6) - p.x, Math.min(c.y, 1e6) - p.y)
        if (d > bestD) {
          bestD = d
          best = c
        }
      }
      t.glideTo(best)
    }
    await page.evaluate(farFrom3)
    await expect(page.locator('.place[data-n="3"]')).toHaveCount(0, { timeout: 5000 })
    await page.evaluate(() => {
      const t = window.__codice!.territory!.territory
      const p = t.world.places.find((x) => x.n === 3)!
      t.camera.x = p.x
      t.camera.y = p.y + t.world.short * 0.4
      t.glideTo({ x: p.x, y: p.y })
    })
    await expect(page.locator('.place[data-n="3"]')).toHaveAttribute('data-state', 'found', { timeout: 5000 })
    await page.evaluate(farFrom3)
    await page.waitForTimeout(1500)
    await expect(page.locator('.place[data-n="3"]')).toHaveAttribute('data-state', 'found')
  })
})
