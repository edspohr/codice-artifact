# Códice del tiempo roto — the artifact

Interactive web artwork for the 22 micro-stories of *Códice del tiempo roto* by Edmundo Spohr.
`CLAUDE.md` is the contract for the whole build; read it first.

## Phase 1 — static journey

Vite + React + TypeScript (strict). No backend, no AI. Placeholder láminas are rendered at build time.

```bash
pnpm install
pnpm dev            # renders placeholder láminas, then serves on http://localhost:5173
pnpm test           # unit tests (canon seal, character-exact render, appendix guard, recognizers)
pnpm test:e2e       # Playwright at 360x740 and 390x844 with touch emulation
pnpm build          # production build (dev tooling is stripped)
```

### Author-only

- `pnpm canon:seal` recomputes `src/content/codice.canon.sha256` after an intentional edit of the canon.
  Agents never run it; the test suite fails on any canon change until the author re-seals.
- `src/content/copy.es.ts` holds every visitor-facing string. `TODO-AUTHOR:` values are rendered literally until replaced.

### Dev tooling (dev builds only)

- `?station=frag:7` or `?station=12` jumps to a station (`epigraph`, `divider:mar`, `frag:n`, `dissolution`, `reprise`, `seal`, `colofon`).
- `?cfg.KEY=value` overrides any key of `src/gestures/config.ts` (e.g. `?cfg.STALL_CUE_MS=3000`).
- `window.__codice` exposes `config`, `setConfig`, `resetConfig`, `jumpTo`, `stations`, `store`, `session` for live tuning.

### Layout of the source

- `src/content/` canon loader and seal, copy, journey stations, lámina paths.
- `src/gestures/` engine (outside React) and one recognizer per movement; `config.ts` holds every threshold and timer.
- `src/views/`, `src/components/`, `src/styles/` the views, the seal, the movement titles, the tokens.
- `scripts/` placeholder lámina renderer and the author-only canon seal.
- `tests/` Vitest, `e2e/` Playwright.
