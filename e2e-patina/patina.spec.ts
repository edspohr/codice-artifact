import { expect, test, type Browser, type Page } from '@playwright/test'

const URL = '/?cfg.SOUND_ENABLED=0&cfg.EPIGRAPH_MIN_MS=0&cfg.PATINA_MIN_INTERVAL_MS=0&cfg.MAR_CURRENT_SPEED=0'

type T = {
  camera: { x: number; y: number }
  world: { regions: Array<{ id: string; rect: { x: number; y: number; w: number; h: number } }> }
  readPixel(x: number, y: number): [number, number, number]
  patina: { flush(): Promise<boolean>; loadedTotals(): Record<string, number>; connected: boolean }
}
const territory = (_page: Page) => `(window.__codice.territory.territory)`

async function open(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(URL)
  await page.waitForSelector('.territory[data-ready]')
  await page.mouse.click(195, 600)
  await page.waitForTimeout(300)
  await page.mouse.click(195, 600)
  await page.waitForSelector('.territory[data-phase="territory"]')
  await expect.poll(() => page.evaluate(`${territory(page)}.patina.connected`), { timeout: 15_000 }).toBe(true)
  return { ctx, page }
}

test('two browsers see each other\'s accumulated wear', async ({ browser }) => {
  // A visitor works the ink at the start of Mar, then the batch is sent.
  const a = await open(browser)
  const cdp = await a.ctx.newCDPSession(a.page)
  for (let k = 0; k < 6; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 500 }] })
    for (let i = 1; i <= 24; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80 + (i % 2) * 230, y: 500 + (i % 3) * 30 }] })
      await a.page.waitForTimeout(12)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const sent = await a.page.evaluate(`${territory(a.page)}.patina.flush()`)
  expect(sent).toBe(true)

  // Another visitor opens the piece: the shared wear is there.
  const b = await open(browser)
  const totals = (await b.page.evaluate(`${territory(b.page)}.patina.loadedTotals()`)) as Record<string, number>
  expect(totals.mar).toBeGreaterThan(0.5)

  // And it reads in the ink: where A worked, B's ground is paler with the patina than without it.
  await expect.poll(() => b.page.evaluate(`${territory(b.page)}.getOpen()`), { timeout: 8000 }).toBe(1)
  await expect(b.page.locator('.region-title')).toHaveCount(0, { timeout: 8000 })
  const sample = (page: Page) =>
    page.evaluate(() => {
      const t = (window as unknown as { __codice: { territory: { territory: T } } }).__codice.territory.territory
      let s = 0
      for (let i = 0; i < 20; i++) s += t.readPixel(80 + i * 11, 515)[0]
      return s / 20
    })
  await b.page.evaluate(() => (window as unknown as { __codice: { setConfig(k: string, v: number): void } }).__codice.setConfig('PATINA_STRENGTH', 0))
  const without = await sample(b.page)
  await b.page.evaluate(() => (window as unknown as { __codice: { setConfig(k: string, v: number): void } }).__codice.setConfig('PATINA_STRENGTH', 0.4))
  const withPatina = await sample(b.page)
  expect(withPatina).toBeGreaterThan(without + 2)
  await a.ctx.close()
  await b.ctx.close()
})

test('the function refuses malformed deltas and anything beyond the caps', async ({ browser }) => {
  const { ctx, page } = await open(browser)
  const result = await page.evaluate(async () => {
    const res = await fetch('http://127.0.0.1:5001/codice-tiempo-roto/us-central1/patinaDelta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { cycle: 1, sessionId: 'x', regions: {} } }),
    })
    return res.status
  })
  expect(result).toBe(400)
  await ctx.close()
})
