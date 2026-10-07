import type { World } from '../world/types'

// Phase 2: placeholder terrain rendered at build time (see scripts/).
const BASE = '/laminas/placeholder/terrain'

export function groundSrc(region: string): string {
  return `${BASE}/ground-${region}.webp`
}

export function formationSrc(n: number): string {
  return `${BASE}/formation-${n}.webp`
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image failed: ${src}`))
    img.src = src
  })
}

export async function loadAssets(world: World) {
  const ground = await loadImage(groundSrc(world.regions[0]?.id ?? 'mar'))
  const formations = new Map<number, HTMLImageElement>()
  await Promise.all(
    world.places.map(async (p) => {
      formations.set(p.n, await loadImage(formationSrc(p.n)))
    }),
  )
  return { ground, formations }
}

export function cssColor(name: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const m = /^#([0-9a-f]{6})$/i.exec(raw)
  if (!m) return [0, 0, 0]
  const v = parseInt(m[1] as string, 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
