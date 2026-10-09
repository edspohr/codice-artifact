// Author-only utility: traces a photo of the author's signature into a
// single-colour SVG path. The photo itself is not committed; only the SVG.
//
//   node scripts/trace-signature.mjs <photo> [out.svg]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import potrace from 'potrace'
import sharp from 'sharp'

const [, , input, output = 'src/assets/signature.svg'] = process.argv
if (!input) throw new Error('usage: node scripts/trace-signature.mjs <photo> [out.svg]')

// Flatten uneven lighting: divide by a heavily blurred copy, then threshold.
const img = sharp(input).rotate().grayscale()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const blur = await sharp(input).rotate().grayscale().blur(40).raw().toBuffer()
const norm = Buffer.alloc(data.length)
for (let i = 0; i < data.length; i++) {
  const ratio = data[i] / Math.max(1, blur[i])
  norm[i] = Math.max(0, Math.min(255, Math.round(ratio * 235)))
}
// Crop to the ink's bounding box with a margin.
let minX = info.width, minY = info.height, maxX = 0, maxY = 0
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (norm[y * info.width + x] < 150) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
const pad = 40
const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad)
const width = Math.min(info.width - left, maxX - minX + 2 * pad), height = Math.min(info.height - top, maxY - minY + 2 * pad)
const cropped = await sharp(norm, { raw: { width: info.width, height: info.height, channels: 1 } })
  .extract({ left, top, width, height })
  .png()
  .toBuffer()

const svg = await new Promise((res, rej) => {
  potrace.trace(cropped, { threshold: 150, turdSize: 12, optTolerance: 0.3, color: '#161616', background: 'transparent' }, (err, out) => (err ? rej(err) : res(out)))
})
writeFileSync(resolve(output), svg)
console.log(`traced → ${output} (${width}×${height} px source crop)`)
