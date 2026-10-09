# Códice del tiempo roto — the artifact

Interactive web artwork for the 22 micro-stories of *Códice del tiempo roto* by Edmundo Spohr.
`CLAUDE.md` is the contract for the whole build; read it first.

## Phase 3 — the whole territory

The piece is the territory: four channels stacked (Mar, Tierra, Cordillera, Cielo), three thresholds, 22 places.

```bash
pnpm dev            # http://localhost:5173 (or the LAN address on a phone)
```

- `?reveal=1` reveals all places (dev builds only).
- `?place=3` glides to place 3; `?stop=N` jumps the linear path (0 cover, 1 epigraph, then places in order with each region's threshold after its last place).
- `?cfg.KEY=value` overrides any value of `src/gestures/config.ts`: traction, lag, friction, currents, help bias,
  emergence and arrival distances, brush, drying, accent, clearing, sway, stamp, sound. `window.__codice.territory`
  exposes the live `Territory` and `LinearPath`.
- Sound: `?cfg.SOUND_ENABLED=1` (off by default, always off in tests).

Firebase is not installed in this phase. `.env.local` (gitignored) holds the project's web config; `.env.example`
lists the same keys empty. Never add a measurement ID; the piece has no analytics.

### Author-only

- `pnpm canon:seal` recomputes `src/content/codice.canon.sha256` after an intentional edit of the canon.
  Agents never run it; the test suite fails on any canon change until the author re-seals.
- `src/content/copy.es.ts` holds every visitor-facing string. `TODO-AUTHOR:` values are rendered literally until replaced.

### Dev tooling (dev builds only)

- `?station=frag:7` or `?station=12` jumps to a station (`epigraph`, `divider:mar`, `frag:n`, `dissolution`, `reprise`, `seal`, `colofon`).
- `?cfg.KEY=value` overrides any key of `src/gestures/config.ts` (e.g. `?cfg.STALL_CUE_MS=3000`).
- `window.__codice` exposes `config`, `setConfig`, `resetConfig`, `jumpTo`, `stations`, `store`, `session` for live tuning.

### Layout of the source

- `src/content/` canon loader and seal, copy.
- `src/world/` the territory outside React: geography (seeded), camera, Mar physics (traction), places, pointer input,
  the WebGL ink field (`ink/`), the loop, the linear accessible path, sound.
- `src/territory/` the React shell of the territory: world-positioned text, seals, tally, titles, controls.
- `src/gestures/config.ts` holds every physics and timing value (the live overrides read it).
- `src/views/`, `src/components/`, `src/styles/` the views, the seal, the movement titles, the tokens.
- `scripts/` placeholder lámina renderer and the author-only canon seal.
- `tests/` Vitest, `e2e/` Playwright.
