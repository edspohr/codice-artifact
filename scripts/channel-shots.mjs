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
// Open with a touch, let the title dissolve.
const cdp = await ctx.newCDPSession(page)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 600 }] })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/1-start-title.png` })
await page.waitForSelector('.region-title', { state: 'detached', timeout: 8000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/2-start-ink.png` })
// Travel to the first place with the linear path: the arrival sequence.
await page.keyboard.press('ArrowRight')
await page.waitForFunction(() => window.__codice?.territory?.territory.isResting())
await page.waitForTimeout(1600)
await page.screenshot({ path: `${out}/3-first-place.png` })
// Mid channel, free drift.
await page.evaluate(() => {
  const t = window.__codice.territory.territory
  const r = t.world.regions[0].rect
  t.camera.x = r.x + r.w / 2
  t.camera.y = r.y + r.h * 0.45
  t.glideTo({ x: t.camera.x, y: t.camera.y })
})
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/4-mid-channel.png` })
// Near the top: the threshold and its tally.
await page.evaluate(() => {
  const t = window.__codice.territory.territory
  const r = t.world.regions[0].rect
  t.camera.x = r.x + r.w / 2
  t.camera.y = r.y + r.h * 0.06
  t.glideTo({ x: t.camera.x, y: t.camera.y })
})
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/5-top-threshold.png` })
await browser.close()
console.log('done')
