// Dev utility: five still screenshots at different heights of the channel (390x844, touch).
// Usage: node scripts/channel-shots.mjs [baseUrl] [outDir]   (needs a running dev server)
import { chromium } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:5173'
const out = process.argv[3] || '.'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.goto(`${base}/?proto=territory&cfg.SOUND_ENABLED=0`)
await page.waitForSelector('.territory[data-ready]')
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(2200)
await page.screenshot({ path: `${out}/1-cover.png` })
const cdp = await ctx.newCDPSession(page)
const tap = async () => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 600 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
await tap()
await page.waitForSelector('.territory[data-phase="epigraph"]')
await page.waitForTimeout(2600)
await page.screenshot({ path: `${out}/2-epigraph.png` })
await tap()
await page.waitForSelector('.territory[data-phase="territory"]')
await page.waitForSelector('.region-title', { state: 'detached', timeout: 8000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/3-start-ink.png` })
// Travel to the first place with the linear path: the arrival sequence.
await page.keyboard.press('ArrowRight')
await page.waitForFunction(() => window.__codice?.territory?.territory.isResting())
await page.waitForTimeout(1600)
await page.screenshot({ path: `${out}/4-first-place.png` })
// The closing of Mar: title and tally at the threshold (places 1 found, others blind).
await page.evaluate(() => {
  const t = window.__codice.territory.territory
  const th = t.world.thresholds[0]
  t.camera.x = th.band.x + th.band.w / 2
  t.camera.y = th.band.y + th.band.h / 2 + 180
  t.glideTo({ x: t.camera.x, y: t.camera.y })
})
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/5-closing-mar.png` })
await browser.close()
console.log('done')
