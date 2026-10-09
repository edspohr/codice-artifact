# CÓDICE DEL TIEMPO ROTO — The Artifact

Project memory for Claude Code. Read this fully before any task. It is the contract for the whole build.

**Version 2 (territory).** This replaces the paged "static journey" concept. After walking Phase 1 on a phone, the author judged it an animated book. The piece is now a territory to wander. Sections 3, 4, 6 and 9 changed completely; read them as new.

## 1. What this is

An interactive web artwork that contains the 22 micro-stories of *Códice del tiempo roto* by Edmundo Spohr. It is not a reader app, not a landing page and not a product. The app **is** the artwork: a territory of ink that visitors wander, handle and wear down, until it bursts and begins again as a different world.

Language rule: code, comments, commits and docs in **English**. Everything a visitor sees is in **Spanish**.

## 2. Governing principles (non-negotiable)

1. **Every element opens a void; none closes one.** Nothing explains, interprets or instructs. No tooltips, no onboarding, no captions, no hints in words.
2. **The canon is inviolable.** The 22 fragments live in `src/content/codice.canon.json`. Never edit, reorder lines, reflow, translate or "fix" a character of it. Only the author changes that file and re-seals it.
3. **The text may react, but it is always legible.** Its presentation can behave like matter (float, shear, settle, thin). Once a fragment is present it is never obscured, never below WCAG AA contrast (4.5:1) and never rendered as anything but real DOM text.
4. **Not a book.** No pages, no cards, no framed or boxed images, no page-turn transitions, no template repeated 22 times. If something looks like an illustrated page, it is wrong.
5. **Never illustrate the text.** Behaviours belong to regions, never to individual fragments. Nothing may respond to what a specific fragment says (no red where a text says blood, no smoke where it says smoke).
6. **No generated text, ever.** And do not write visitor-facing copy yourself: all Spanish copy lives in `src/content/copy.es.ts`; missing copy is a `"TODO-AUTHOR: <what is needed>"` value listed in your summary.
7. **Ephemeral by design.** Nothing a single visitor does is stored as theirs. No accounts, no cookies beyond the technically required, no third-party analytics or trackers. **Never import `firebase/analytics`.**
8. **AI lives only in the Return.** It generates the ink plates once per cycle, server-side. It never runs during a visit.
9. **Restraint over spectacle.** Ink greys on white, slow, quiet. One accent only (section 4). When in doubt, remove.
10. **Cultural guardrail.** Generated imagery is abstract ink only: no human figures, faces, text, numerals, or symbols, patterns or iconography of any culture or people.

## 3. The experience

### 3.1 Entry

- **The cover.** White. The title of the work in Archivo Light 300, and beneath it the author's real signature (traced once from paper, never a handwriting typeface), stamped onto the paper with an ink impact. A touch dissolves the cover. The cover appears once per visit.
- **The epigraph** alone on white, read before it gives way: after a minimum time, a tap or a deliberate drag (never a stray brush) is the first mark (and, if sound is on, the first note); the white opens into the territory at the bottom of Mar.

### 3.2 The territory

- One continuous field of ink, larger than the screen, with **four regions stacked from bottom to top: Mar Primigenio → Tierra Herida → Cordillera Silente → Cielo Inconquistable.** This is the Ascent made into a place: ink is dense and dark low in Mar and rises, lightens and dissolves into smoke toward Cielo.
- The visitor moves by dragging the world. There are no views, no stations, no menu, no map, no index and no URLs.
- **A region is a channel, not a field.** About 1.4 screens wide by 4 tall on a phone (tunable). There is lateral play, but the way is up. The channel has banks: toward the sides the ink thins and resistance grows, and a return current keeps the visitor in. There is no white void beyond the field.
- **The ascent is readable without words.** Ink is darkest at the bottom and lighter toward the top, and its grain runs up the channel. A single still screenshot taken anywhere must tell which way is up. The current runs up the channel: letting go carries the visitor slowly upward.
- **Ink is the ground; places are clearings.** In Mar the ink covers the field with true near-blacks. White exists only as the clearings where places live and as the lightening toward the top. Procedural or generated ink has pooled blacks, dry-brush streaks, granulation, hard and soft edges: never blurred noise, never uniform mid-grey. A visitor's mark must read even in dense ink: displaced ink leaves paler furrows with darker ridges.
- The start is at the bottom, in dense dark ink, with no place in view.
- **Geography belongs to the cycle.** The positions of the 22 places are derived deterministically from the cycle number (seeded), so every Return rearranges the world. Constraints: places stay inside their region, keep a minimum distance from each other and from edges, and fragment 22 always sits at the far top of Cielo.
- **Soft canonical bias.** Within a region, places are loosely ordered along the ascent by canonical number, with seeded jitter, alternating sides of the channel. The first place of a region lies within about one screen of its entry. Order stays free: nothing forces the sequence.

### 3.3 Each region has its own physics

The four gestures of the old concept become four ways of moving. **Starting hypotheses to be tuned in the browser with the author:**

| Region | How you move | Feeling |
|---|---|---|
| Mar | drag with long inertia; when you let go, slow currents keep carrying you | fluid, undivided |
| Tierra | the ground is crusted; fracture lines block the way and yield only to insistence (strokes accumulate, one stroke is never enough) | effort, rupture |
| Cordillera | climbing by stretches: pulling up meets tension, letting go lifts one stretch with weight; no inertia, no current | weight, ascent |
| Cielo | touch gives little traction; a light flick sets a direction and stillness sustains the drift, slowing to a minimum but never stopping on its own; touching again stops it | release |

Decided with the author: in Tierra, fracture lines across the channel close the way up; each finger stroke that crosses a line damages it, one stroke never breaks it, a standing line heals slowly, and a broken line stays broken for the session. In Tierra, pushing against a standing line also damages it, and no line stands before the region's first place. In Cordillera (revised after the phone walk, the continuous drag was too slow), stretches taken without rest shorten and resting recovers, with no indicator.

**You can go back, but you cannot undo.** Movement is free in every direction, including down into regions already crossed. What the visitor broke stays broken, what they smeared stays smeared, for the session.

### 3.4 Fragments are places

- A fragment is a location in its region, **hidden** until the visitor comes near. On approach the text emerges (its ink gathers); the transition is brief and resolves to fully legible. At rest a fragment is either absent or fully legible, never half-shown.
- On arrival **the seal is stamped**: it was not there before. One stamp, with weight (visual impact; a short vibration where the device supports it; a note if sound is on). Stamped seals persist for the session.
- **Finding has a cost.** A stamp scars the ground around the place, and the visitor's hands get dirtier: after each stamp the finger leaves more ink and the accent comes sooner. Progress is also loss.
- Each place has its own local ink formation (its lámina) blended into the ground, with no edges.
- **The text reacts as matter, by region and always legible:** in Mar it sways with the current; in Tierra the block shears along the cracks the visitor makes; in Cordillera it settles with weight; in Cielo its ink thins (never below the contrast floor). Text reactions stay within the motion budget below.
- Order is free inside a region.
- **Movement between places, stillness at them.** On arrival the current deposits the visitor: the world comes to rest with the whole text block inside safe margins and the seal in view. Text is never clipped at rest. Leaving takes a deliberate drag, not a stray touch.
- **One sequence on arrival and nothing else moving:** the clearing opens, the text settles, the stamp lands.
- **The text being read always has its clearing**, whatever was found before, and a faint halo of paper around its letters keeps the ink at a distance.
- An emerged text does not slip away: it disperses only when the viewpoint is clearly gone, and Mar's current calms near it.
- **A clearing never reads as a card.** No rectangles and no perfect circles anywhere: an irregular, soft-edged void shaped from the text block but not outlining it. Place formations use irregular masks, not radial blobs.
- **Motion budget.** Outside clearings only the drag and the current move. Text sway is off by default (kept behind an override).

### 3.5 Regions in order, thresholds and the tally

- Regions are crossed in order. The passage up to the next region is a **threshold** at the top of each region, crossed with that region's own physics at full expression. Entering a region shows its **movement title** over the ground (typography per spec §5.1).
- **The title is an event, not an object.** It appears alone on entering the region and dissolves before any place can emerge. A title and a fragment are never on screen together.
- **The closing of a region is an object.** At the threshold, anchored to the world, the region's title with the tally beneath it: the summary of what was done, and the passage. The ink parts around it.
- **The threshold is a colossus.** A mass of ink at full expression across the band, crossed with the region's physics at their strongest (in Mar: the current at its fastest, less traction). There is no pulled-back view anywhere in the piece (the author removed the look back: it broke immersion); the DOM text is never scaled.
- A threshold is **always passable**: the journey never requires completeness.
- **The tally** is the only indication of progress in the whole piece. At each threshold there is one seal impression per fragment of the region being left: **inked with its numeral if the visitor found it, blind (embossed, uninked, no numeral) if not.** No numbers, no words, no bar. A visitor who wants everything sees what is missing and goes back; anyone else walks on.

### 3.6 The exit and the Return

- **Fragment 22 (seal 0) is the exit.** It sits at the far top of Cielo with Cielo's tally beside it (impressions for 17 to 21). After the reading dwell, sustained stillness begins the dissolution; a touch during it cancels and restores the place.
- The dissolution is the only point of no return: everything the visitor left dissolves and the territory whitens. Then the reprise in italics, then the seal alone with **no numeral** on near-white. Touching it opens the Colofón.
- A visitor who leaves and comes back starts again.

### 3.7 Handling the ink

- The visitor's finger does not draw on a layer above the world: it **displaces and smears the ink of the territory itself**. This requires WebGL.
- **The accent:** a visitor's mark is born grey. Burgundy appears only through insistence (repeated handling of the same area) and as the oxidized edge of a mark as it dries. Very desaturated. It is never tied to a fragment and never appears in text, seals or generated plates.
- The session trail dries and lightens slowly. On exit it is gone; individual strokes are never sent to the server.

### 3.8 The patina is desire paths

- What persists for everyone is aggregated wear: a low-resolution grid **per region** of where the world has been handled and where visitors lingered. Rendered as worn trails, it draws paths toward the places people found.
- This is the piece's main help and it comes from other people. After a Burst the territory is virgin and the first visitors of a cycle are explorers.
- Sent in few batched deltas through a Cloud Function, never as individual strokes.

### 3.9 Subtle help

Demanding, with subtle help, and never in words. **Help is invoked, not given:** holding the finger still on the ground gathers the grain of the ink and bends the current toward the nearest unfound place; letting go dispels it. At rest the lean is faint, almost nothing. Never a pointer, never a word. When a visitor has found nothing for a long while (and especially in a virgin cycle, when there are no trails), the faint lean may grow. Tunable; zero disables it.

### 3.10 Motion grammar

The piece mixes the mechanics of a game with the pacing of film, through movement and transitions, never through rewards. The grammar is fixed; phases reuse it instead of inventing transitions:

- Cover stamped → dissolves. Epigraph alone → the first mark opens the white.
- Entering a region: its title as an event, alone, then gone.
- Between places: drag, inertia, current. Holding still: the help gathers. At a place: stillness, the arrival sequence (clearing, text, stamp with a short dip, the scar), a deliberate drag to leave.
- Leaving a region: the colossus at the threshold, the closing object.
- The exit: dwell, stillness, dissolution, reprise, the lone seal.
- The Burst: witnessed live by everyone, white, alpha.

### 3.11 Sound (experimental, behind a config flag)

Touching is playing a note (the epigraph says so). One sustained note per contact, low in Mar and progressively airier toward Cielo, synthesized with Web Audio, no audio files. Unlocked by the first touch on the epigraph. The piece must be complete with sound off. The author will decide after the prototype whether it stays.

### 3.12 Accessibility: the linear path

Keyboard and screen-reader users get a parallel path: "Avanzar" and "Volver" controls travel to the next and previous place in canonical order (the viewpoint glides there), thresholds included, and the full text of each place is exposed in order. This path never depends on gestures or on stillness. `prefers-reduced-motion` turns glides and physics into short fades. The canon tests run on this path.

### 3.13 Wear, the Exodus and the Burst (the cycle)

- Global `wear ∈ [0, 1]` = time erosion + touch erosion, both configurable in a Firestore config doc. Target cycle length: a few weeks to a few months.
- **Signals of approach** grow with wear: fissures lengthen across the territory, the ink loses cohesion, seals stamp more unevenly. Never a counter, a percentage or text.
- **Exodus** (`wear ≥ EXODUS_THRESHOLD`, start at 0.85): the notice email goes out once, and the next cycle's plates and geography are prepared in advance.
- **Burst** (`wear ≥ 1`): every connected client witnesses it in real time (the territory atomizes, goes white, returns to alpha). Server-side the patina is deleted, the cycle number increments, the new plates and the new geography become current. Only aggregate metrics survive.
- The Burst never waits on AI (procedural fallback), and no single visitor can cause it (per-session caps, rate limits).

### 3.14 The Colofón

Outside the territory, reached only through the lone seal. Contains: how it was made and credits (author copy); the author's LinkedIn as a plain external link; the current cycle number; a **free contribution** link to an external page (`VITE_DONATION_URL`), any amount, no tiers, no pressure; an optional **email** sign-up, independent of the contribution, for the Exodus notice and news of new releases (explicit consent, single purpose, double opt-in, one-click unsubscribe; sent straight to Brevo through a Cloud Function, never stored in Firestore). A contribution buys nothing inside the piece.

## 4. Visual system

`docs/CODICE_R4_SPEC_DISENO.md` is the author's design spec, written for the **book** edition. Read it with this filter:

- **Authoritative here:** its governing principle (§0), the seal numbering logic (§3.1), the four registers of the Ascent (§4), the type system (§5), the seal (§6), the lámina derivation method and the Mar micro-arc (§8), and the abstraction level (§10).
- **Does not apply:** product strategy (§1), the fragment page layout (§7) and everything about pages, the book apparatus (§9), print, Canva.
- **Never surface the appendices.** Appendix A and B are private reserve: never in the UI, metadata, alt text, tests or image prompts. A seal shows a Roman numeral and nothing else.
- **Where this file and the spec conflict, this file wins.**

Summary:

- **Ink greys on white, plus one accent.** The accent is the burgundy of section 3.7 and belongs only to the visitor's trace.
- **Type.** Movement titles in **Archivo**, uppercase, modulated per movement (Mar Light 300, Tierra Black 900, Cordillera SemiBold 600, Cielo Thin 100; details and the optional per-word mix in spec §5.1). Body in **Spectral**, natural tracking, generous line-height, left-aligned, sized in rem. Self-hosted.
- **The seal:** a brutalist, imperfectly hand-stamped solid rectangle (about 4:5) with the Roman numeral in negative, set in Archivo as real text. Fragments 1–21 carry I–XXI; fragment 22 carries 0; the final lone seal carries nothing. Blind impressions (the tally) are the same shape without ink or numeral.
- **Plates are terrain, never pictures.** The mother plate of a movement is the ground of its region; a fragment's plate is the local ink formation at its place. Everything blends with soft masks into one continuous field. No rectangle is ever visible.
- **Broken, not smooth.** Fractures, cut lines and misregistration are native vocabulary. No decorative flourishes.

## 5. The plates (AI, once per cycle)

- 26 images per cycle: **4 mother plates** (region grounds) and **22 fragment plates** (local formations), each fragment plate a subtle variation of its mother. Generate the mother first, validate it, then use it as the reference image for its fragments (spec §8).
- Model: the current Gemini image-generation model (the "Nano Banana" family). **Check the current model ID in the official docs at build time and keep it in config.**
- Prompts in English: a fixed style lock (abstract, textural, sumi-like ink on pure white, monochrome, **ink fading to pure white at every edge so the image can be blended into a larger field**, no recognizable objects, no literal landscape, no line art, no figures, no text, no symbols) + the movement register + the fragment's `laminaCue` + a per-cycle variation seed. Cues marked `PROVISIONAL` are placeholders the author will revise; a cue is never visitor-facing.
- Pipeline: generate → automated check with a vision model (rejects text, figures, colour, symbols, hard edges) → retries → WebP in mobile sizes → `laminas/{cycle}/…`. On repeated failure, procedural fallback for that plate.
- Cycle 1 is also AI-generated, through a seed script that lets the author regenerate any single plate before launch.

## 6. Architecture

- **Frontend:** Vite + React + TypeScript (strict). React holds the shell and the DOM text; **the world is a WebGL renderer outside React** (ink field, smear, patina, physics, camera). Propose the lightest approach that meets the budget and justify any library by its bundle cost; no game engine.
- **Text is DOM, positioned over the world** and kept in sync with the camera, so it stays selectable by assistive tech, testable character-exact and crisp at any zoom.
- **Responsive, mobile first.** The channel is measured in portrait screens: the viewport on a phone, a portrait unit fitted to the viewport height on a wide screen, where ink still covers the whole view and the cover and epigraph sit in a readable column. Desktop moves by mouse drag, wheel or trackpad and keyboard; the experience is the same territory, not a different layout. The test suite runs on phone and desktop viewports.
- **Firebase** (project `codice-tiempo-roto`, Blaze plan): Hosting, Firestore, Cloud Functions (2nd gen, TypeScript), Cloud Storage, App Check, a scheduled function. Web config comes from `VITE_FIREBASE_*` env vars. No Analytics. Emulator Suite for all local work.
- **Data model (starting point):** `state/current` `{ cycle, wear, phase, updatedAt }` (one realtime listener); `config/cycle`; `patina/{cycle}_{region}` (wear grid); `metrics/{cycle}` (aggregate counters only: visits started, exits through 22, furthest region reached, places found as totals, cycle duration, sign-ups, contribution clicks). Geography is computed from the cycle number, not stored.
- **Security:** rules deny all client writes; reads limited to `state/current`, `patina/*` and public plate files. Mutations only through callable functions with App Check, strict validation, per-session caps and rate limits.
- **Budgets:** smooth on a mid-range Android phone, degrading gracefully (lower simulation resolution before dropping frames); a handful of document reads and function calls per visit; image generation once per cycle; a billing budget alert. Flag anything that breaks these.
- **Dev tools** (dev builds only, stripped from production): jump to any place or threshold, live override of every physics and timing value, a toggle to reveal all places, and later a panel to set wear, force Exodus and Burst, and seed patina.

## 7. Non-goals

No accounts. No social sharing. No comments. No rewards: no scores, badges, streaks or completion screens. Game-like **mechanics** are welcome (consequence, physics per region, thresholds, hidden places, the gated exit, the shared wear); the tally is the only trace of progress. No map. No explanatory note. No AI chat, no AI text. No English UI in v1.

## 8. Open decisions (ask the author; do not decide)

- Every physics and timing value, the size of the territory and the emergence distance.
- Whether sound stays, and the exact tone of the accent.
- Whether a pulled-back overview of the territory exists at all.
- Payment provider and final domain; all copy for the Colofón, the consent line and the Exodus email; whether the printed glossary appears anywhere.
- Final `laminaCue` values for Cielo (17–22).
- Calibration: `CYCLE_MAX_DAYS`, `CYCLE_MAX_JOURNEYS`, `EXODUS_THRESHOLD`, per-session cap.

## 9. Build phases

One phase at a time. Each ends with: what was built, how to verify it, what could not be verified without a real device, open questions, and a commit. Do not start the next without the author's go-ahead.

1. **Static journey — done and retired.** What survived: canon loader and seal, integrity and appendix tests, fonts and tokens, the seal component, copy file, the dev-tooling pattern. The 31 stations, the paged views and the gesture recognizers were removed in Phase 3.
2. **Prototype: Mar as territory — done, gate passed.** WebGL ink field with placeholder terrain, traction physics, smear with the accent, hidden places, stamping, the closing at the threshold, the linear path, sound behind its flag, the cover, invoked help, the cost of finding, the colossus and the look back.
3. **The whole territory.** Tierra, Cordillera and Cielo with their physics and text behaviours, thresholds and titles, the exit at 22, the Return sequence, seeded geography, subtle help, full test suite on the linear path; old paged code removed.
4. **Patina.** Emulators, rules, App Check, batched deltas, desire-path rendering.
5. **The cycle.** Wear, time erosion, approach signals, Exodus, the Burst in real time, new geography on Return, debug panel.
6. **Plates by AI.** Generation pipeline, checks, fallback, seed script, pre-generation at Exodus.
7. **Colofón.** Contribution link, email with consent and double opt-in, Exodus notice.
8. **Measure and harden.** Aggregate metrics, abuse limits, budget alert, accessibility and cross-device passes, deploy.

## 10. Working agreements

- Plan before coding; surface ambiguities as questions instead of guessing, especially anything touching sections 2 and 8.
- Small commits, conventional messages, TypeScript strict. Tests for the canon, the linear path, geography constraints, the wear function, delta validation and security rules.
- When a principle in section 2 conflicts with a convenience, the principle wins. Say so and propose an alternative.
