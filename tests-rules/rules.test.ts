// Security rules, against the Firestore emulator (pnpm test:rules).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'codice-tiempo-roto',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'state/current'), { cycle: 1, wear: 0, phase: 'living' })
    await setDoc(doc(db, 'patina/1_mar'), { cycle: 1, region: 'mar', h: { '3': 1 }, l: {} })
    await setDoc(doc(db, 'sessions/abcdefghijklmnop1234'), { spent: 1 })
    await setDoc(doc(db, 'metrics/1'), { visits: 1 })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('firestore rules', () => {
  it('anyone reads the current state and the patina', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(db, 'state/current')))
    await assertSucceeds(getDoc(doc(db, 'patina/1_mar')))
  })

  it('nobody writes, even signed in', async () => {
    for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('someone')]) {
      const db = ctx.firestore()
      await assertFails(setDoc(doc(db, 'state/current'), { cycle: 2 }))
      await assertFails(updateDoc(doc(db, 'patina/1_mar'), { 'h.3': 99 }))
      await assertFails(setDoc(doc(db, 'patina/1_tierra'), { h: {} }))
      await assertFails(deleteDoc(doc(db, 'patina/1_mar')))
    }
  })

  it('sessions, metrics and anything else are closed to reads too', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'sessions/abcdefghijklmnop1234')))
    await assertFails(getDoc(doc(db, 'metrics/1')))
    await assertFails(getDoc(doc(db, 'config/cycle')))
  })
})
