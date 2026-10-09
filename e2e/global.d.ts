// Structural view of the dev handles the territory exposes on window.__codice
// (dev builds only). Kept minimal and dependency-free for the e2e tsconfig.
declare global {
  interface Window {
    __codice?: {
      config: Record<string, number>
      session: { patch(p: { keyboardUser?: boolean }): void }
      territory: {
        territory: {
          camera: { x: number; y: number; clamp(): void }
          world: {
            short: number
            places: Array<{ n: number; x: number; y: number }>
            regions: Array<{ id: string; rect: { x: number; y: number; w: number; h: number } }>
            thresholds: Array<{ from: string; to: string; band: { x: number; y: number; w: number; h: number } }>
          }
          isResting(): boolean
          helpStrength(): number
          crustLines(): Array<{ y: number; integrity: number; broken: boolean }>
          screenHeight(): number
          dirtLevel(): number

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
