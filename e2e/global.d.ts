import type { TerritoryHandles } from '../src/territory/TerritoryApp.tsx'

declare global {
  interface Window {
    __codice?: {
      territory: TerritoryHandles | null
    }
  }
}
export {}
