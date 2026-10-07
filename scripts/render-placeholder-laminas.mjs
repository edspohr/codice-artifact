// Renders the neutral placeholder láminas as static WebP files.
//
// Phase 1 has no AI and no runtime filters: these images are procedural
// monochrome noise, shaped by each movement's register (where the ink
// lives on the page), rendered once here and served as plain files from
// public/laminas/placeholder/. They are deterministic (seeded), so every
// build produces the same bytes. They are not committed.
//
// Usage: node scripts/render-placeholder-laminas.mjs [--force]
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(new URL('..', import.meta.url).pathname)
const outDir = resolve(root, 'public/laminas/placeholder')
const canon = JSON.parse(readFileSync(resolve(root, 'src/content/codice.canon.json'), 'utf8'))
const force = process.argv.includes('--force')

const WIDTH = 720
const HEIGHT = 1080 // 2:3 vertical, as the spec requires
// Matches --paper in src/styles/tokens.css so the image edge is invisible.
const PAPER = 252

// --- deterministic value noise -------------------------------------------

function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

function fbm(x, y, seed, octaves, gain) {
  let sum = 0
  let amp = 1
  let norm = 0
  let fx = x
  let fy = y
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(fx, fy, seed + i * 101)
    norm += amp
    amp *= gain
    fx *= 2.03
    fy *= 1.97
  }
  return sum / norm
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// --- registers (where the ink lives) -------------------------------------
// Each returns ink density in [0, 1] for normalized coordinates u (0..1
// left to right) and v (0..1 top to bottom). `t` is a per-image variation
// in [0, 1]; `seed` keeps the mother and its fragments in one family.

const registers = {
  // Mass below, void above. Maximum density. A nascent crack.
  mar(u, v, seed, t) {
    const mass = smoothstep(0.4 + 0.08 * t, 0.78, v)
    const grain = fbm(u * 5, v * 5, seed, 6, 0.55)
    const vein = 1 - 0.7 * Math.exp(-Math.pow((u - 0.5 - 0.1 * fbm(v * 3, 0, seed + 7, 3, 0.5)) * 18, 2)) * smoothstep(0.55, 0.9, v) * (0.2 + 0.8 * t)
    return Math.min(1, mass * (0.55 + 0.5 * grain) * vein)
  },
  // A middle band, a horizon, broken by a hard fracture. Maximum contrast.
  tierra(u, v, seed, t) {
    const band = Math.exp(-Math.pow((v - 0.5) / (0.13 + 0.04 * t), 2))
    const grain = fbm(u * 7, v * 9, seed, 6, 0.5)
    const edge = 0.5 + 0.035 * (fbm(u * 4, 0, seed + 31, 4, 0.5) - 0.5) * 2 + 0.01 * (t - 0.5)
    const breakLine = Math.exp(-Math.pow((v - edge) / 0.012, 2))
    return Math.min(1, band * (0.65 + 0.35 * grain) * (1 - breakLine))
  },
  // Mineral mass, middle-high, with an immense void. Medium density, closed scar.
  cordillera(u, v, seed, t) {
    const mass = smoothstep(0.2, 0.42, v) * (1 - smoothstep(0.66, 0.84, v))
    const grain = fbm(u * 4, v * 4, seed, 5, 0.5)
    const scar = 1 - 0.35 * Math.exp(-Math.pow((v - 0.5 - 0.08 * (t - 0.5) - 0.06 * fbm(u * 2.5, 0, seed + 13, 3, 0.5)) * 30, 2))
    return Math.min(1, mass * (0.25 + 0.45 * grain) * scar)
  },
  // Smoke taking off, near-white. Minimum density, a cosmic tear.
  cielo(u, v, seed, t) {
    const lift = smoothstep(0.05, 0.4, v) * (1 - smoothstep(0.55, 0.92, v))
    const wisp = fbm(u * 2.2 + t, v * 3.5, seed, 5, 0.6)
    return Math.min(1, 0.22 * lift * Math.pow(wisp, 1.6) * (0.8 + 0.4 * t))
  },
}

const movementSeeds = { mar: 11, tierra: 23, cordillera: 37, cielo: 53 }

async function render(file, register, seed, t) {
  const buf = Buffer.alloc(WIDTH * HEIGHT)
  for (let y = 0; y < HEIGHT; y++) {
    const v = y / HEIGHT
    for (let x = 0; x < WIDTH; x++) {
      const u = x / WIDTH
      const ink = Math.max(0, Math.min(1, registers[register](u, v, seed, t)))
      buf[y * WIDTH + x] = Math.round(PAPER * (1 - 0.92 * ink))
    }
  }
  await sharp(buf, { raw: { width: WIDTH, height: HEIGHT, channels: 1 } })
    .webp({ quality: 62, effort: 4 })
    .toFile(file)
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const jobs = []
  for (const m of canon.movements) {
    jobs.push({ file: resolve(outDir, `mother-${m.id}.webp`), register: m.id, seed: movementSeeds[m.id], t: 0.5 })
  }
  for (const f of canon.fragments) {
    const m = canon.movements.find((x) => x.id === f.movement)
    const i = m.fragments.indexOf(f.n)
    const t = m.fragments.length > 1 ? i / (m.fragments.length - 1) : 0.5
    jobs.push({ file: resolve(outDir, `${f.n}.webp`), register: f.movement, seed: movementSeeds[f.movement] + 1000 + f.n, t })
  }
  const pending = force ? jobs : jobs.filter((j) => !existsSync(j.file))
  if (pending.length === 0) {
    console.log('Placeholder láminas up to date.')
    return
  }
  const started = Date.now()
  for (const job of pending) {
    await render(job.file, job.register, job.seed, job.t)
  }
  console.log(`Rendered ${pending.length} placeholder láminas in ${Date.now() - started} ms → public/laminas/placeholder/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
