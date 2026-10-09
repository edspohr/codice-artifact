// Renders the placeholder terrain as static WebP files: a ground per
// region and a local formation per place. Procedural ink shaped by each
// movement's register, rendered once here and served as plain files from
// public/laminas/placeholder/terrain/. Deterministic (seeded), not committed.
// The AI plates of Phase 6 replace them.
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

// --- terrain (Phase 2): grounds and formations that blend into one field ---
// A ground covers a whole region and fades to white at every edge. A
// formation is a place's local ink with an irregular, soft mask: never a
// radial blob, never a rectangle.

const GROUND_W = 640
const GROUND_H = 2560 // a channel, 1:4
const FORM_SIZE = 512

// Fine, hard speckle for granulation.
function speckle(x, y, seed) {
  return hash2(x, y, seed)
}

const grounds = {
  // Mar inverted: ink is the ground. Darkest at the bottom with true
  // near-blacks, lightening toward the top; pooled blacks with hard edges,
  // dry-brush streaks running up the channel, granulation; thinner ink
  // toward the banks. White exists only as the clearings where places
  // live, and as the lightening at the top.
  mar(u, v, seed, px, py) {
    const side = Math.abs(u - 0.5) * 2
    const gradient = 0.12 + 0.88 * v
    const bank = 1 - 0.5 * smoothstep(0.5, 1.0, side)
    const soft = 0.82 + 0.36 * fbm(u * 2.5 + 3, v * 9, seed + 1, 3, 0.5)
    const poolField = fbm(u * 3.2, v * 11, seed + 5, 4, 0.5)
    const pools = smoothstep(0.52, 0.56, poolField) * smoothstep(0.4, 0.95, v)
    const streakField = fbm(u * 70, v * 5, seed + 9, 3, 0.62)
    const streakLight = smoothstep(0.3, 0.42, 1 - streakField) * 0.55
    const streakDark = smoothstep(0.6, 0.72, streakField) * 0.25
    const grain = (speckle(px, py, seed + 13) - 0.5) * 0.1
    let d = gradient * bank * soft
    d = d * (1 - streakLight * (1 - v * 0.3)) + streakDark * d
    d = Math.max(d, gradient * 0.75 * bank)
    d = Math.max(d, pools * (0.42 + 0.56 * v) * bank)
    d += grain
    return Math.max(0, Math.min(1, d))
  },
  // Tierra: a wounded horizon. Crust strata broken by hard fractures,
  // maximum contrast, irregular; lighter than Mar, still darker low.
  tierra(u, v, seed, px, py) {
    const side = Math.abs(u - 0.5) * 2
    const gradient = 0.1 + 0.5 * v
    const bank = 1 - 0.5 * smoothstep(0.5, 1.0, side)
    // Irregular strata: a warped low-frequency field thresholded hard.
    const warp = fbm(u * 2.5, v * 7, seed + 3, 4, 0.55)
    const strata = fbm(u * 1.2 + warp * 1.6, v * 16 + warp * 2.2, seed + 5, 3, 0.5)
    const crust = smoothstep(0.5, 0.53, strata) * (0.35 + 0.45 * v)
    // Hard fractures: thin pale breaks across the crust, jagged.
    const crackField = Math.abs(fbm(u * 6 + warp, v * 30, seed + 7, 4, 0.5) - 0.5)
    const crack = 1 - (1 - smoothstep(0.008, 0.022, crackField)) * 0.8
    // Coarse grain of dry earth.
    const earth = 0.75 + 0.5 * fbm(u * 9, v * 26, seed + 1, 5, 0.5)
    const grain = (speckle(px, py, seed + 11) - 0.5) * 0.14
    let d = gradient * bank * earth
    d = Math.max(d, (gradient * 0.6 + crust) * bank * earth)
    d *= crack
    d = Math.max(d, gradient * 0.55 * bank)
    d += grain
    return Math.max(0, Math.min(1, d))
  },
  // Cordillera: mineral mass, middle-high, medium density, facets with hard
  // edges and a closed scar; an immense void above. Lighter than Tierra.
  cordillera(u, v, seed, px, py) {
    const side = Math.abs(u - 0.5) * 2
    const gradient = 0.06 + 0.38 * v
    const bank = 1 - 0.5 * smoothstep(0.5, 1.0, side)
    const mass = smoothstep(0.1, 0.5, v)
    // Facets: cellular-looking hard steps from quantised warped noise.
    const warp = fbm(u * 3, v * 9, seed + 2, 3, 0.5)
    const facetField = fbm(u * 4 + warp, v * 13 + warp, seed + 6, 2, 0.5)
    const facet = Math.floor(facetField * 5) / 5
    const edgeField = Math.abs(fbm(u * 4 + warp, v * 13 + warp, seed + 6, 2, 0.5) * 5 - Math.round(facetField * 5))
    const edge = 1 - (1 - smoothstep(0.01, 0.03, edgeField)) * 0.22
    const scar = 1 - 0.5 * Math.exp(-Math.pow((u - 0.5 - 0.12 * fbm(v * 5, 0, seed + 13, 3, 0.5)) * 16, 2)) * smoothstep(0.25, 0.8, v)
    const grain = (speckle(px, py, seed + 17) - 0.5) * 0.08
    let d = (gradient + 0.34 * mass * (0.3 + 0.7 * facet)) * bank * scar * edge
    d = Math.max(d, gradient * 0.6 * bank)
    d += grain
    return Math.max(0, Math.min(1, d))
  },
  // Cielo: smoke taking off, near-white. Minimum density, a cosmic tear.
  cielo(u, v, seed, px, py) {
    const side = Math.abs(u - 0.5) * 2
    const gradient = 0.02 + 0.2 * v
    const bank = 1 - 0.4 * smoothstep(0.5, 1.0, side)
    const wisp = fbm(u * 7, v * 2.2, seed + 4, 5, 0.62) // stretched upward
    const tear = smoothstep(0.49, 0.51, fbm(u * 1.5, v * 9, seed + 21, 3, 0.5)) * 0.06
    const grain = (speckle(px, py, seed + 19) - 0.5) * 0.05
    let d = (gradient * (0.6 + 0.8 * Math.pow(wisp, 1.6)) + tear) * bank
    d = Math.max(d, gradient * 0.7 * bank)
    d += grain
    return Math.max(0, Math.min(1, d))
  },
}

function irregularMask(u, v, seed) {
  const dx = u - 0.5
  const dy = v - 0.5
  const angle = Math.atan2(dy, dx)
  const r = Math.hypot(dx, dy) * 2 // 0 at centre, 1 at the edge of the inscribed circle
  // The boundary wobbles with angle and with position: no circle survives this.
  const wobble = 0.55 + 0.45 * fbm(Math.cos(angle) * 1.5 + 5, Math.sin(angle) * 1.5 + 5, seed, 3, 0.5)
  const bite = 0.75 + 0.5 * fbm(u * 3, v * 3, seed + 19, 3, 0.5)
  const radius = 0.86 * wobble * bite
  return 1 - smoothstep(radius * 0.45, radius, r)
}

function formation(register, u, v, seed, t) {
  const mask = irregularMask(u, v, seed)
  const base = registers[register](u, 0.35 + v * 0.45, seed, t)
  const grain = fbm(u * 6, v * 6, seed + 41, 5, 0.5)
  return Math.min(1, mask * (0.5 + 0.8 * base) * (0.55 + 0.45 * grain))
}

async function renderGround(file, register, seed) {
  const buf = Buffer.alloc(GROUND_W * GROUND_H)
  for (let y = 0; y < GROUND_H; y++) {
    const v = y / GROUND_H
    for (let x = 0; x < GROUND_W; x++) {
      const u = x / GROUND_W
      const ink = Math.max(0, Math.min(1, grounds[register](u, v, seed, x, y)))
      buf[y * GROUND_W + x] = Math.round(255 * (1 - 0.97 * ink))
    }
  }
  await sharp(buf, { raw: { width: GROUND_W, height: GROUND_H, channels: 1 } }).webp({ quality: 70, effort: 4 }).toFile(file)
}

async function renderFormation(file, register, seed, t) {
  const buf = Buffer.alloc(FORM_SIZE * FORM_SIZE)
  for (let y = 0; y < FORM_SIZE; y++) {
    const v = y / FORM_SIZE
    for (let x = 0; x < FORM_SIZE; x++) {
      const u = x / FORM_SIZE
      const ink = Math.max(0, Math.min(1, formation(register, u, v, seed, t)))
      buf[y * FORM_SIZE + x] = Math.round(255 * (1 - 0.92 * ink))
    }
  }
  await sharp(buf, { raw: { width: FORM_SIZE, height: FORM_SIZE, channels: 1 } }).webp({ quality: 70, effort: 4 }).toFile(file)
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  mkdirSync(resolve(outDir, 'terrain'), { recursive: true })
  const terrainJobs = []
  for (const m of canon.movements) {
    if (!grounds[m.id]) continue
    terrainJobs.push({ file: resolve(outDir, `terrain/ground-${m.id}.webp`), run: (f) => renderGround(f, m.id, movementSeeds[m.id] + 500) })
  }
  for (const f of canon.fragments) {
    const m = canon.movements.find((x) => x.id === f.movement)
    const i = m.fragments.indexOf(f.n)
    const t = m.fragments.length > 1 ? i / (m.fragments.length - 1) : 0.5
    terrainJobs.push({ file: resolve(outDir, `terrain/formation-${f.n}.webp`), run: (file) => renderFormation(file, f.movement, movementSeeds[f.movement] + 2000 + f.n, t) })
  }
  const pendingTerrain = force ? terrainJobs : terrainJobs.filter((j) => !existsSync(j.file))
  if (pendingTerrain.length) {
    const started = Date.now()
    for (const job of pendingTerrain) await job.run(job.file)
    console.log(`Rendered ${pendingTerrain.length} terrain placeholders in ${Date.now() - started} ms → public/laminas/placeholder/terrain/`)
  }

}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
