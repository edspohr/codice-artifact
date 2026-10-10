// Cloud Functions (2nd gen). Mutations only through callables with App
// Check, strict validation, per-session caps and rate limits. Nothing a
// visitor sends is stored as theirs: the session id is random per visit and
// its bookkeeping doc expires.
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { capToSession, DeltaError, MAX_CALLS, MIN_INTERVAL_MS, validateDelta } from './delta.js'

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })

const db = getFirestore()
const EMULATED = process.env.FUNCTIONS_EMULATOR === 'true'

/** The current cycle; created as cycle 1 on first use. */
async function currentCycle(): Promise<number> {
  const ref = db.doc('state/current')
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists) return (snap.get('cycle') as number) ?? 1
    tx.set(ref, { cycle: 1, wear: 0, phase: 'living', updatedAt: FieldValue.serverTimestamp() })
    return 1
  })
}

export const patinaDelta = onCall({ enforceAppCheck: !EMULATED, consumeAppCheckToken: false, cors: true }, async (request) => {
  let delta
  try {
    delta = validateDelta(request.data)
  } catch (err) {
    if (err instanceof DeltaError) throw new HttpsError('invalid-argument', err.message)
    throw err
  }
  const cycle = await currentCycle()
  // A delta from a cycle that has ended (the Burst came mid-visit) is dropped quietly.
  if (delta.cycle !== cycle) return { accepted: 0, cycle }

  const sessionRef = db.doc(`sessions/${delta.sessionId}`)
  const accepted = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef)
    const now = Date.now()
    const spent = snap.exists ? ((snap.get('spent') as number) ?? 0) : 0
    const calls = snap.exists ? ((snap.get('calls') as number) ?? 0) : 0
    const last = snap.exists ? ((snap.get('lastAt') as number) ?? 0) : 0
    if (calls >= MAX_CALLS) throw new HttpsError('resource-exhausted', 'too many calls')
    if (now - last < MIN_INTERVAL_MS) throw new HttpsError('resource-exhausted', 'too soon')
    capToSession(delta, spent)
    tx.set(sessionRef, {
      spent: spent + delta.total,
      calls: calls + 1,
      lastAt: now,
      // TTL policy on this field deletes the bookkeeping after a day.
      expireAt: Timestamp.fromMillis(now + 24 * 3600 * 1000),
    })
    if (delta.total <= 0) return 0
    for (const [region, layers] of Object.entries(delta.regions)) {
      const h: Record<string, FieldValue> = {}
      const l: Record<string, FieldValue> = {}
      for (const [c, x] of layers!.h) if (x > 0) h[String(c)] = FieldValue.increment(x)
      for (const [c, x] of layers!.l) if (x > 0) l[String(c)] = FieldValue.increment(x)
      tx.set(
        db.doc(`patina/${cycle}_${region}`),
        { cycle, region, h, l, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
    return delta.total
  })
  return { accepted, cycle }
})
