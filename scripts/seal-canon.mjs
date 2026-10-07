// AUTHOR-ONLY. Recomputes the SHA-256 seal of the canon file.
//
// The canon (src/content/codice.canon.json) is inviolable: no agent or
// contributor edits it. The seal file lets the test suite detect any
// accidental change. Only the author runs this script, after an
// intentional edit of the canon:
//
//   pnpm canon:seal
//
// Agents must never run it.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const canonPath = resolve(root, 'src/content/codice.canon.json')
const sealPath = resolve(root, 'src/content/codice.canon.sha256')

const bytes = readFileSync(canonPath)
const digest = createHash('sha256').update(bytes).digest('hex')
writeFileSync(sealPath, `${digest}\n`)
console.log(`Sealed canon: ${digest}`)
