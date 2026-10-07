# Códice del tiempo roto — the artifact

Interactive web artwork for the 22 micro-stories of *Códice del tiempo roto* by Edmundo Spohr.
`CLAUDE.md` is the contract for the whole build; read it first.

## Phase 2 — prototype: Mar as territory

The territory prototype lives beside the Phase 1 journey until the author passes the gate.

```bash
pnpm dev            # then open http://localhost:5173/?proto=territory (or the LAN address on a phone)
```

- `?proto=territory` selects the prototype; without it the old paged journey loads.
- `?reveal=1` reveals all places (dev builds only).
- `?place=3` glides to place 3; `?stop=5` jumps the linear path (0 epigraph, 1–4 places, 5 threshold, 6 stub).
- `?cfg.KEY=value` overrides any value of `src/gestures/config.ts`: traction, lag, friction, currents, help bias,
  emergence and arrival distances, brush, drying, accent, clearing, sway, stamp, sound. `window.__codice.territory`
  exposes the live `Territory` and `LinearPath`.
- Sound: `?cfg.SOUND_ENABLED=1` (off by default, always off in tests).

Firebase is not installed in this phase. `.env.local` (gitignored) holds the project's web config; `.env.example`
lists the same keys empty. Never add a measurement ID; the piece has no analytics.

## Phase 1 — static journey (kept until the Phase 2 gate)

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
- `src/world/` the territory outside React: geography (seeded), camera, Mar physics (traction), places, pointer input,
  the WebGL ink field (`ink/`), the loop, the linear accessible path, sound.
- `src/territory/` the React shell of the territory: world-positioned text, seals, tally, titles, controls.
- `src/gestures/` Phase 1 engine and recognizers; `config.ts` holds every threshold, timer and physics value.
- `src/views/`, `src/components/`, `src/styles/` the views, the seal, the movement titles, the tokens.
- `scripts/` placeholder lámina renderer and the author-only canon seal.
- `tests/` Vitest, `e2e/` Playwright.
