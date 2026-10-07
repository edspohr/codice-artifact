import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cdp, stroke, swipe, tap } from './touch'

interface Canon {
  title: string
  epigraph: string[]
  reprise: string[]
  movements: Array<{ id: string; title: string; fragments: number[] }>
  fragments: Array<{ n: number; seal: string; movement: string; lines: string[] }>
}

const canon: Canon = JSON.parse(readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../src/content/codice.canon.json'), 'utf8'))

const stationOf = (page: Page) => page.locator('.stage').getAttribute('data-station')

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

test.describe('the ascent', () => {
  test('keyboard walk renders every station character-exact with sound layout', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(canon.title)
    expect(await page.locator('html').getAttribute('lang')).toBe('es')
    await page.evaluate(() => document.fonts.ready)

    const expectedIds = [
      'epigraph',
      ...canon.movements.flatMap((m) => [`divider:${m.id}`, ...m.fragments.map((n) => `frag:${n}`)]),
      'dissolution',
      'reprise',
      'seal',
      'colofon',
    ]

    for (const [i, id] of expectedIds.entries()) {
      await expect(page.locator('.stage')).toHaveAttribute('data-station', id, { timeout: 15_000 })
      const current = page.locator('.view--current')

      if (id === 'epigraph' || id === 'reprise') {
        const lines = await current.locator('[data-canon-line]').allTextContents()
        expect(lines).toEqual(id === 'epigraph' ? canon.epigraph : canon.reprise)
      }

      if (id.startsWith('divider:')) {
        const movement = canon.movements.find((m) => `divider:${m.id}` === id)!
        expect(await current.locator('[data-canon="movement-title"]').textContent()).toBe(movement.title)
        await expect(current.locator('[data-seal]')).toHaveCount(0)
        // Uppercase is CSS only; the DOM keeps the canon title.
        const tt = await current.locator('.movement-title').evaluate((el) => getComputedStyle(el).textTransform)
        expect(tt).toBe('uppercase')
      }

      if (id.startsWith('frag:')) {
        const n = Number(id.slice(5))
        const fragment = canon.fragments[n - 1]!
        const lines = await current.locator('[data-canon-line]').allTextContents()
        expect(lines).toEqual(fragment.lines)
        expect(await current.locator('[data-seal]').textContent()).toBe(fragment.seal)

        // CSS must not alter what is visible: no transform, no auto hyphens.
        const styles = await current.locator('[data-canon-line]').first().evaluate((el) => {
          const cs = getComputedStyle(el)
          return { textTransform: cs.textTransform, hyphens: cs.hyphens || (cs as unknown as { webkitHyphens: string }).webkitHyphens, fontFamily: cs.fontFamily }
        })
        expect(styles.textTransform).toBe('none')
        expect(['manual', 'none']).toContain(styles.hyphens)
        expect(styles.fontFamily.toLowerCase()).toContain('spectral')

        // Layout zones: text, then lámina, then the reserved seal band. No overlaps.
        const geo = await current.evaluate((el) => {
          const lines = Array.from(el.querySelectorAll('[data-canon-line]'))
          const lastLine = lines[lines.length - 1]!.getBoundingClientRect()
          const lamina = el.querySelector('.fragment__lamina-img')!.getBoundingClientRect()
          const band = el.querySelector('.seal-band')!.getBoundingClientRect()
          const seal = el.querySelector('.seal')!.getBoundingClientRect()
          return {
            lastLineBottom: lastLine.bottom,
            laminaTop: lamina.top,
            laminaBottom: lamina.bottom,
            laminaHeight: lamina.height,
            bandTop: band.top,
            bandBottom: band.bottom,
            sealTop: seal.top,
            sealBottom: seal.bottom,
            sealCenterX: (seal.left + seal.right) / 2,
            stageCenterX: (el.getBoundingClientRect().left + el.getBoundingClientRect().right) / 2,
            viewportH: window.innerHeight,
          }
        })
        expect(geo.laminaTop).toBeGreaterThanOrEqual(geo.lastLineBottom + 8)
        expect(geo.laminaBottom).toBeLessThanOrEqual(geo.bandTop + 0.5)
        expect(geo.laminaHeight).toBeGreaterThan(40)
        expect(geo.sealTop).toBeGreaterThanOrEqual(geo.bandTop)
        expect(geo.sealBottom).toBeLessThanOrEqual(geo.bandBottom + 0.5)
        expect(Math.abs(geo.sealCenterX - geo.stageCenterX)).toBeLessThan(1)
        expect(geo.bandBottom).toBeLessThanOrEqual(geo.viewportH + 0.5)
      }

      if (id === 'seal') {
        await expect(current.getByRole('button', { name: 'Colofón' })).toBeVisible()
      }

      await expectNoPageScroll(page)

      if (i < expectedIds.length - 1) {
        await page.keyboard.press('ArrowRight')
      }
    }
  })

  test('the accessible advance control exists once and advances', async ({ page }) => {
    await page.goto('/')
    const control = page.getByRole('button', { name: 'Avanzar' })
    await expect(control).toHaveCount(1)
    await control.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'divider:mar')
  })
})

test.describe('gestures on touch', () => {
  test('Mar: a lateral drift advances, a short drift does not', async ({ page, viewport }) => {
    await page.goto('/?station=divider:mar')
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await swipe(s, { x: w * 0.8, y: h * 0.5 }, { x: w * 0.7, y: h * 0.5 }, 6, 40)
    await page.waitForTimeout(500)
    expect(await stationOf(page)).toBe('divider:mar')
    await swipe(s, { x: w * 0.85, y: h * 0.5 }, { x: w * 0.25, y: h * 0.5 })
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'frag:1', { timeout: 3000 })
    await expectNoPageScroll(page)
  })

  test('Mar: a vertical swipe does not advance and does not scroll the page', async ({ page, viewport }) => {
    await page.goto('/?station=frag:1')
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await swipe(s, { x: w * 0.5, y: h * 0.7 }, { x: w * 0.5, y: h * 0.2 })
    await swipe(s, { x: w * 0.5, y: h * 0.2 }, { x: w * 0.5, y: h * 0.9 })
    await page.waitForTimeout(400)
    expect(await stationOf(page)).toBe('frag:1')
    await expectNoPageScroll(page)
  })

  test('Tierra: one long stroke cracks but does not break; insistence does', async ({ page, viewport }) => {
    await page.goto('/?station=frag:5')
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    const zig = (y0: number) => {
      const pts = []
      for (let i = 0; i <= 24; i++) pts.push({ x: w * 0.12 + (w * 0.76 * i) / 24, y: y0 + (i % 2) * 24 })
      return pts
    }
    await stroke(s, zig(h * 0.45))
    await page.waitForTimeout(200)
    expect(await stationOf(page)).toBe('frag:5')
    const progressAfterOne = Number(await page.locator('.stage').evaluate((el) => el.style.getPropertyValue('--progress')))
    expect(progressAfterOne).toBeGreaterThan(0.1)
    expect(progressAfterOne).toBeLessThan(1)
    await expect(page.locator('.view--current .fracture-overlay polyline')).toHaveCount(1)

    await stroke(s, zig(h * 0.55).reverse())
    await page.waitForTimeout(100)
    await stroke(s, zig(h * 0.35))
    await page.waitForTimeout(100)
    if ((await stationOf(page)) === 'frag:5') await stroke(s, zig(h * 0.6).reverse())
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'frag:6', { timeout: 3000 })
    await expectNoPageScroll(page)
  })

  test('Cordillera: a short pull falls back, a long pull crests', async ({ page, viewport }) => {
    await page.goto('/?station=frag:11')
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await swipe(s, { x: w * 0.5, y: h * 0.75 }, { x: w * 0.5, y: h * 0.65 }, 6, 40)
    await page.waitForTimeout(700)
    expect(await stationOf(page)).toBe('frag:11')
    expect(Number(await page.locator('.stage').evaluate((el) => el.style.getPropertyValue('--progress')))).toBe(0)
    await swipe(s, { x: w * 0.5, y: h * 0.9 }, { x: w * 0.5, y: h * 0.12 }, 20, 16)
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'frag:12', { timeout: 3000 })
    await expectNoPageScroll(page)
  })

  test('Cielo: stillness advances only after the dwell; a touch during the fade restores the view', async ({ page, viewport }) => {
    await page.goto(
      '/?station=frag:17&cfg.CIELO_DWELL_BASE_MS=600&cfg.CIELO_DWELL_PER_LINE_MS=100&cfg.CIELO_STILL_MS=1500&cfg.CIELO_FADE_MS=2500',
    )
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    // dwell = 600 + 4 lines × 100 = 1000 ms, stillness 1500 ms: the fade starts at ~1500 ms and lasts 2500 ms.
    await page.waitForTimeout(1200)
    expect(await stationOf(page)).toBe('frag:17')
    await page.waitForTimeout(900)
    const mid = Number(await page.locator('.stage').evaluate((el) => el.style.getPropertyValue('--progress')))
    expect(mid).toBeGreaterThan(0.05)
    expect(mid).toBeLessThan(1)
    await tap(s, { x: w * 0.5, y: h * 0.5 })
    await page.waitForTimeout(700)
    expect(await stationOf(page)).toBe('frag:17')
    expect(Number(await page.locator('.stage').evaluate((el) => el.style.getPropertyValue('--progress')))).toBe(0)
    // Left alone again, it advances.
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'frag:18', { timeout: 6000 })
  })

  test('Cielo: a keyboard user is never auto-advanced', async ({ page }) => {
    await page.goto('/?station=frag:17&cfg.CIELO_DWELL_BASE_MS=100&cfg.CIELO_DWELL_PER_LINE_MS=0&cfg.CIELO_STILL_MS=100&cfg.CIELO_FADE_MS=200')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'frag:18')
    await page.waitForTimeout(1500)
    expect(await stationOf(page)).toBe('frag:18')
  })

  test('edge touches are ignored (iOS edge-swipe zone)', async ({ page, viewport }) => {
    await page.goto('/?station=divider:mar')
    const s = await cdp(page)
    const w = viewport!.width
    const h = viewport!.height
    await swipe(s, { x: w - 8, y: h * 0.5 }, { x: w * 0.2, y: h * 0.5 })
    await page.waitForTimeout(500)
    expect(await stationOf(page)).toBe('divider:mar')
  })

  test('the seal opens the Colofón on touch', async ({ page }) => {
    await page.goto('/?station=seal')
    const s = await cdp(page)
    const box = (await page.getByRole('button', { name: 'Colofón' }).boundingBox())!
    await tap(s, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    await expect(page.locator('.stage')).toHaveAttribute('data-station', 'colofon', { timeout: 3000 })
  })

  test('the stall cue appears after idling and only where a gesture is expected', async ({ page }) => {
    await page.goto('/?station=frag:2&cfg.STALL_CUE_MS=400')
    await expect(page.locator('.stall-cue[data-cue="drift"]')).toBeVisible({ timeout: 3000 })
    await page.goto('/?station=frag:18&cfg.STALL_CUE_MS=400&cfg.CIELO_DWELL_BASE_MS=60000')
    await page.waitForTimeout(900)
    await expect(page.locator('.stall-cue')).toHaveCount(0)
  })
})
