// A tileable value-noise texture (RGBA8, 256×256) generated once. The
// shaders sample it for irregular edges and grain instead of computing
// noise per pixel.
export const NOISE_SIZE = 256

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function value(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const w = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period, seed)
  const a = w(ix, iy)
  const b = w(ix + 1, iy)
  const c = w(ix, iy + 1)
  const d = w(ix + 1, iy + 1)
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
}

export function noiseTextureData(): Uint8Array {
  const size = NOISE_SIZE
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // Four independent channels at different scales, all tileable.
      const scales = [8, 16, 32, 64]
      for (let c = 0; c < 4; c++) {
        const period = scales[c] as number
        const u = (x / size) * period
        const v = (y / size) * period
        let sum = 0
        let amp = 1
        let norm = 0
        for (let o = 0; o < 3; o++) {
          const p = period * (1 << o)
          sum += amp * value((u * (1 << o)) % p, (v * (1 << o)) % p, p, 11 + c * 7 + o * 3)
          norm += amp
          amp *= 0.5
        }
        data[i + c] = Math.round((sum / norm) * 255)
      }
    }
  }
  return data
}
