// The only place the client talks to Firebase. Loaded lazily, after the
// cover, so the first view does not wait on it. If the config is missing or
// anything fails, the piece goes on without a patina: it never blocks.
import type { MovementId } from '../content/canon'
import type { DeltaPayload } from './collector'
import { CELLS, REGIONS, type RegionGrid } from './grid'

export interface Remote {
  cycle: number
  grids: Map<MovementId, RegionGrid>
  send(delta: DeltaPayload): Promise<boolean>
}

export async function connectRemote(): Promise<Remote | null> {
  const env = import.meta.env
  if (!env.VITE_FIREBASE_PROJECT_ID || !env.VITE_FIREBASE_API_KEY) return null
  // Local work never touches the real project: in development only the emulators are used.
  if (env.DEV && env.VITE_USE_EMULATORS !== '1') return null
  try {
    const [{ initializeApp }, fs, fn] = await Promise.all([import('firebase/app'), import('firebase/firestore/lite'), import('firebase/functions')])
    const app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
    const emulated = env.VITE_USE_EMULATORS === '1'
    if (env.VITE_FIREBASE_APPCHECK_SITE_KEY && !emulated) {
      const ac = await import('firebase/app-check')
      ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(env.VITE_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: false })
    }
    const db = fs.getFirestore(app)
    const functions = fn.getFunctions(app, 'us-central1')
    if (emulated) {
      fs.connectFirestoreEmulator(db, '127.0.0.1', 8080)
      fn.connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    }
    // One read for the cycle, one per region for the patina.
    const state = await fs.getDoc(fs.doc(db, 'state/current'))
    const cycle = state.exists() ? Number(state.get('cycle')) || 1 : 1
    const grids = new Map<MovementId, RegionGrid>()
    await Promise.all(
      REGIONS.map(async (id) => {
        const snap = await fs.getDoc(fs.doc(db, `patina/${cycle}_${id}`))
        const g = { h: new Float32Array(CELLS), l: new Float32Array(CELLS) }
        if (snap.exists()) {
          for (const [k, v] of Object.entries((snap.get('h') as Record<string, number>) ?? {})) g.h[Number(k)] = Number(v) || 0
          for (const [k, v] of Object.entries((snap.get('l') as Record<string, number>) ?? {})) g.l[Number(k)] = Number(v) || 0
        }
        grids.set(id, g)
      }),
    )
    const call = fn.httpsCallable(functions, 'patinaDelta')
    return {
      cycle,
      grids,
      async send(delta) {
        try {
          await call(delta)
          return true
        } catch {
          return false
        }
      },
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[patina] unavailable', err)
    return null
  }
}
