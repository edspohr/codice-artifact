// Structural view of the dev handles the territory exposes on window.__codice
// (dev builds only). Kept minimal and dependency-free for the e2e tsconfig.
declare global {
  interface Window {
    __codice?: {
      territory: {
        territory: {
          camera: { x: number; y: number }
          world: { short: number; places: Array<{ n: number; x: number; y: number }> }
          glideTo(to: { x: number; y: number }, onDone?: () => void): void
          readPixel(sx: number, sy: number): [number, number, number]
          getOpen(): number
        }
        path: { next(): void; back(): void; jump(i: number): void }
      } | null
    }
  }
}
export {}
