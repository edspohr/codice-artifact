# CÓDICE DEL TIEMPO ROTO — The Artifact

Project memory for Claude Code. Read this fully before any task. It is the contract for the whole build.

## 1. What this is

An interactive web artwork that contains the 22 micro-stories of *Códice del tiempo roto* by Edmundo Spohr. It is not a reader app, not a landing page and not a product. The app **is** the artwork: a living piece that visitors wear down by passing through it, until it bursts and begins again.

Language rule: code, comments, commits and docs in **English**. Everything a visitor sees is in **Spanish**.

## 2. Governing principles (non-negotiable)

1. **Every element opens a void; none closes one.** Nothing in the piece explains, interprets or comments on the fragments. No tooltips, no onboarding, no instructions, no captions, no "about this fragment".
2. **The canon is inviolable.** The 22 fragments live in `src/content/codice.canon.json`. Never edit, reorder, reflow, translate, paraphrase or "fix" a character of it. Render line breaks exactly as given. Only the author changes that file.
3. **No generated text, ever.** No AI-written verses, concepts, labels or hints anywhere in the journey.
4. **Do not write literary or visitor-facing copy on your own.** All Spanish copy lives in `src/content/copy.es.ts`. When copy is missing, add a key with the value `"TODO-AUTHOR: <what is needed>"` and list it in your summary. You may draft a suggestion in a code comment next to it.
5. **Ephemeral by design.** Nothing a single visitor does is stored as theirs. No accounts, no login, no cookies beyond what is technically required, no third-party analytics or trackers.
6. **AI lives only in the Return.** AI generates the ink plates (láminas) once per cycle, server-side. It never runs during a visitor's journey.
7. **Restraint over spectacle.** Monochrome, slow, quiet. When in doubt, remove.
8. **Cultural guardrail.** Generated imagery is abstract ink only: no human figures, no faces, no text, no numerals, no symbols, patterns or iconography of any culture or people.

## 3. The experience

### 3.1 The journey (one visitor)

- Entry: the epigraph, alone. Then the ascent through four movements: **Mar Primigenio (1–4) → Tierra Herida (5–10) → Cordillera Silente (11–16) → Cielo Inconquistable (17–22)**.
- Each movement opens with a **divider view**: the movement title and its mother lámina at full expression, no seal, no other text.
- Each fragment is one view: text, one lámina, the seal.
- After fragment 22: everything the visitor left behind dissolves; the reprise (first lines of fragment 1) appears in italics; then the seal alone on a near-white screen. Touching the seal opens the **Colofón**.
- The journey has no menu, no progress bar, no index. A visitor who leaves and returns starts again.

### 3.2 Navigation by discovery

Each movement asks for a different gesture. These are **starting hypotheses to be tuned in the browser with the author**, not final:

| Movement | Gesture to advance | Feeling |
|---|---|---|
| Mar | lateral drift (horizontal swipe / drag) | fluid, undivided |
| Tierra | press and drag across the view until it fractures | effort, rupture |
| Cordillera | upward pull with heavy resistance and inertia | weight, ascent |
| Cielo | stop touching; stillness advances the view | release |

Rules:
- No written instructions. Discovery is helped only by (a) the shared patina, which reveals where others have touched, and (b) after a long stall, a faint non-verbal ink cue. Cielo is exempt from the stall cue (stillness is its gesture).
- Accessible fallback always works: arrow keys / space / Enter on desktop, and a single focusable "advance" control exposed to screen readers. Respect `prefers-reduced-motion`.
- Mobile first. Handle `touch-action`, `overscroll-behavior`, pull-to-refresh and iOS edge-swipe so gestures never fight the browser. Keep interactive zones away from screen edges.

### 3.3 The ink trail (session only)

- Pointer, touch and scroll leave a soft ink shadow that "dirties" the view. It dries and lightens slowly during the session.
- It is procedural (Canvas 2D first; move to WebGL only if the performance budget demands it). It runs outside React's render loop.
- It never covers the text to the point of illegibility. The canon stays readable at all times, in every state of the piece.
- On exit, the visitor's trail is gone. Individual strokes are never sent to the server.

### 3.4 The patina (shared, accumulates)

- What persists for everyone is an aggregated **wear map per fragment**: a low-resolution grid (start with 24×32 cells) of how much each zone has been handled, plus which navigation gestures were used where.
- The client accumulates a session delta locally and sends it in few batched calls (on movement change and on `visibilitychange`/exit) to a Cloud Function. No direct client writes to Firestore.
- Rendered as subtle soiling, like the edge of a much-read book. Zones many have touched look more handled. On a fresh cycle the piece is clean and navigation is hardest; late in a cycle the worn paths show the way.

### 3.5 Wear, the Exodus and the Burst (the cycle)

- Global `wear ∈ [0, 1]` = time erosion + touch erosion, both configurable:
  - `timeWear = elapsed / CYCLE_MAX_DAYS` (time alone must eventually end a cycle).
  - `touchWear = weightedJourneys / CYCLE_MAX_JOURNEYS`.
- Target: a cycle lasts from a few weeks to a few months. Values live in a Firestore config doc so the author can calibrate without a deploy.
- **Signals of approach** grow continuously with wear: fissures lengthen across the views, lámina ink loses cohesion, the seal stamps more unevenly. Never a counter, never a percentage, never text.
- **Exodus** (`wear ≥ EXODUS_THRESHOLD`, start at 0.85): (1) the Exodus notice email is sent once to subscribers; (2) the next cycle's láminas are generated and stored in advance.
- **Burst** (`wear ≥ 1`): every connected client witnesses it in real time (the piece atomizes, goes white, returns to alpha). Server-side: patina docs of the cycle are deleted, the cycle number increments, the pre-generated láminas become current. Only aggregate metrics of the finished cycle survive.
- The Burst must never wait on AI. If lámina generation failed, fall back to procedural láminas for that cycle.
- No single visitor can burst the piece: cap each session's contribution and rate-limit per client.

### 3.6 The Colofón

Outside the journey, reached only through the seal after the dissolution. Contains:
- how the artifact was made and credits (author copy);
- the current cycle number;
- **free contribution**: a link to an external payment page (`VITE_DONATION_URL`), any amount, no suggested tiers, no pressure;
- **email**: optional, independent of the contribution, to receive the Exodus notice and news of new releases. Explicit consent checkbox, single stated purpose, double opt-in, one-click unsubscribe. Emails go straight to the mailing provider (Brevo) through a Cloud Function and are **not** stored in Firestore.
- A contribution buys nothing inside the piece. No perks, no special marks, no early access.

## 4. Visual system (from the R4 design spec)

`docs/CODICE_R4_SPEC_DISENO.md` is the author's design spec. It was written for the **book** edition (Canva, print), so read it with this filter:

- **Authoritative here:** its governing principle (§0), the seal numbering logic (§3.1), the four registers of the Ascent (§4), the type system (§5), the seal (§6), the fragment page layout (§7, excluding §7.1), the lámina derivation method and the Mar micro-arc (§8), and the abstraction level (§10).
- **Does not apply to the artifact:** product strategy (§1), single-side print rule and imposition (§7.1), the book apparatus (§9: cover, "Sobre este Códice", glossary, author page, legal pages), page counts, spine, trim and anything about Canva.
- **Never surface the appendices.** Appendix A (arcana names and meanings, Hebrew letters) and B are private reserve. They must never appear in the UI, in metadata, in alt text or in image prompts. The seal shows a Roman numeral and nothing else.
- **Where this file and the spec conflict, this file wins.** Known deliberate departures: the seal's stamping becomes more uneven as wear approaches the Burst (the spec keeps it identical); the láminas are regenerated every cycle (the spec fixes them once).

Summary of the system (the spec has the detail):

- **Concept: the Ascent.** Ink is born low, dense and dark (Mar) and through the book rises, lightens and dissolves into smoke (Cielo). Body text does the opposite: it floats high in Mar and descends movement by movement.
- **Monochrome.** Greys of ink on white. No colour.
- **Type.** Movement titles in **Archivo**, uppercase, modulated per movement in weight, tracking, alignment and position: Mar Light 300, Tierra Black 900, Cordillera SemiBold 600, Cielo Thin 100 (see spec §5.1, including the optional per-word mix for Tierra and Cielo and the note that Thin may need to become Light on small screens). Body in **Spectral**, natural tracking, generous line-height, left-aligned. Self-host both fonts.
- **Page layout (portrait, mobile first):** text in the upper region; lámina in the middle-lower zone, never touching the last line of text; a reserved bottom band that holds only the seal.
- **The seal (sello-carta):** a brutalist, imperfectly hand-stamped solid rectangle (about 4:5), bottom-centre, fixed position, with the Roman numeral in negative (white) set in Archivo. Fragments 1–21 carry I–XXI; **fragment 22 carries 0**. Same numeral cap-height on all 22. The numeral is real text (HTML/SVG), never part of a generated image.
- **Broken, not smooth.** Fractures, cut lines and misregistration are native vocabulary. Avoid soft continuous spirals and decorative flourishes.

## 5. The láminas (AI, once per cycle)

- 26 images per cycle, generated server-side with the current Gemini image-generation model (the "Nano Banana" family): **4 mother láminas** (one per movement, used on the divider views) and **22 fragment láminas**, each a subtle variation of its movement's mother. Generate the mother first, validate it, then pass it as the reference image for that movement's fragments (spec §8). **Check the current model ID in the official docs at build time and keep it in config; do not hard-code from memory.**
- Prompts are in English, built from: a fixed style lock (abstract, textural, sumi-like ink on pure white, monochrome, vertical 2:3, intentional empty zone where the text falls, no recognizable objects, no literal landscape, no line art, no figures, no text, no symbols) + the movement register + the fragment's `laminaCue` from the canon file + a per-cycle variation seed (ink behaviour: wetter, drier, more granular, more broken), so each cycle is a distinct universe inside the same system.
- `laminaCue` values marked `PROVISIONAL` (Cielo) are placeholders the author will revise. Never treat a cue as visitor-facing text.
- Pipeline: generate → automated check with a vision model (rejects text, figures, colour, symbols) → up to N retries → convert to WebP in mobile-appropriate sizes → store under `laminas/{cycle}/{n}.webp` (fragments) and `laminas/{cycle}/mother-{movement}.webp`. On repeated failure, mark that view to use the procedural fallback.
- Cycle 1 is also AI-generated. Provide a seed script that generates the first set and lets the author regenerate any single lámina before launch. From cycle 2 on, generation is unattended.

## 6. Architecture

- **Frontend:** Vite + React + TypeScript. React handles the shell, routing between views and state; the ink trail, patina and transitions run on canvas modules outside React rendering.
- **Firebase:** Hosting, Firestore, Cloud Functions (2nd gen, TypeScript), Cloud Storage, App Check, a scheduled function for time erosion. Use the Emulator Suite for all local work.
- **Data model (starting point):**
  - `state/current` — `{ cycle, wear, phase: 'living' | 'exodus' | 'bursting', updatedAt }`. Clients hold one realtime listener on this doc.
  - `config/cycle` — thresholds and calibration values.
  - `patina/{cycle}_{n}` — the wear grid for fragment `n`.
  - `metrics/{cycle}` — aggregate counters only: journeys started, journeys completed, furthest movement reached, cycle duration, email sign-ups, contribution-link clicks.
- **Security:** Firestore rules deny all client writes; reads limited to `state/current`, `patina/*` and public lámina files. All mutations go through callable functions with App Check enforced, strict input validation, per-session caps and rate limits.
- **Cost guardrails:** at most ~25 document reads and a handful of function calls per journey; image generation only once per cycle; set a budget alert. Flag anything that breaks these numbers.
- **Performance budget:** smooth interaction on a mid-range Android phone; first view usable quickly on a mobile connection; láminas lazy-loaded one view ahead.
- **Dev tools:** a debug panel available only on emulators (and behind an admin claim in production) to set wear, fast-forward time, force Exodus, force Burst and seed patina. Without it the cycle cannot be tested.

## 7. Non-goals

No accounts. No social sharing buttons. No comments. No gamification, badges or streaks. No explanatory note, no table of contents. No AI chat, no AI text. No dark mode toggle. No English UI in v1.

## 8. Open decisions (ask the author; do not decide)

- Payment provider for the free contribution, and the final domain.
- All copy for the Colofón, the consent line and the Exodus email.
- Whether the glossary of the printed book appears in the Colofón or nowhere.
- Final `laminaCue` values for Cielo (17–22).
- Calibration: `CYCLE_MAX_DAYS`, `CYCLE_MAX_JOURNEYS`, `EXODUS_THRESHOLD`, per-session cap.
- Final gesture per movement and the stall-cue timing.

## 9. Build phases

Work one phase at a time. Each phase ends with: what was built, how to verify it, open questions, and a commit. Do not start the next phase without the author's go-ahead.

1. **Static journey.** Scaffold, canon loading, the 22 fragment views and 4 divider views with final typography, layout and seal, placeholder láminas, gesture navigation per movement, keyboard/a11y fallback. *Done when* the whole ascent can be walked on a phone and the canon renders character-exact.
2. **Ink trail.** Session-only procedural ink from touch, pointer and scroll, drying over time. *Done when* it feels right to the author on mobile and holds the performance budget.
3. **Patina.** Emulators, data model, rules, App Check, batched delta function, rendering of shared wear. *Done when* two browsers see each other's accumulated wear and rules tests pass.
4. **The cycle.** Wear function, scheduled time erosion, approach signals, Exodus phase, the Burst in real time, cycle reset, debug panel. *Done when* a full cycle can be forced end to end on emulators.
5. **Láminas by AI.** Generation pipeline, automated check, retries, fallback, storage, seed script for cycle 1, pre-generation at Exodus. *Done when* a Burst swaps in a new set with no visitor-visible wait.
6. **Colofón.** Contribution link, email sign-up with consent and double opt-in, Exodus notice, unsubscribe. *Done when* a test subscriber receives the notice when Exodus is forced.
7. **Measure and harden.** Aggregate metrics, abuse limits, budget alert, accessibility pass, cross-device pass, deploy to Hosting.

## 10. Working agreements

- Plan before coding; surface ambiguities as questions instead of guessing, especially anything touching sections 2 and 8.
- Small commits, conventional messages. TypeScript strict. Tests for the wear function, the delta validation and the security rules.
- When a principle in section 2 conflicts with a convenience, the principle wins. Say so and propose an alternative.
