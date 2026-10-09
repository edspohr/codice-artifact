// Every physics and timing value of the territory. Starting hypotheses to
// be tuned in the browser with the author (CLAUDE.md §3 and §8). The object
// is mutable on purpose: dev tooling overrides values at runtime without a
// rebuild, and everything reads it live.

export const defaultConfig = {
  /** Pointer downs closer than this to the left/right edges are ignored (iOS edge swipes). */
  EDGE_INSET_PX: 24,

  // =====================================================================
  // Territory (Phase 2 prototype: Mar). Every value is a live override.
  // Distances marked "× short" are fractions of the viewport's short side.
  // =====================================================================

  // --- world ---
  /** Each region is a channel: lateral play, but the way is up. Width and heights in screens. */
  MAR_SCREENS_W: 1.4,
  MAR_SCREENS_H: 5.5,
  TIERRA_SCREENS_H: 5,
  CORDILLERA_SCREENS_H: 5,
  CIELO_SCREENS_H: 4.5,
  /** On wide screens the world is at least this many viewport widths, so ink covers the whole view. */
  WORLD_MIN_VIEW_WIDTHS: 1.15,
  /** Wheel / trackpad: world px per wheel px (desktop drift). */
  WHEEL_GAIN: 0.9,
  /** Places keep this distance from the region edges (× short). */
  PLACE_EDGE_MARGIN: 0.35,
  /** Minimum distance between places (× short). */
  PLACE_MIN_DIST: 0.9,
  /** Channel ordering: lateral offset of places from the centre line (× half width), its jitter (× half width). */
  PLACE_LATERAL: 0.3,
  PLACE_LATERAL_JITTER: 0.2,
  /** Vertical jitter of a place around its slot along the ascent (× screen height). */
  PLACE_JITTER: 0.1,
  /** The first place lies this many screens above the start (centre to centre). */
  FIRST_PLACE_SCREENS: 0.85,
  /** A place emerges when the screen centre comes this close (× short). */
  EMERGE_DISTANCE: 0.6,
  /** Arrival (the stamp) at this distance (× short). */
  ARRIVE_DISTANCE: 0.2,
  /** Emergence and dispersion times (ms). */
  EMERGE_MS: 700,
  DISPERSE_MS: 900,
  /** Local formation radius of a place (× short). */
  FORMATION_RADIUS: 0.55,

  // --- Mar physics: traction ---
  /** Fraction of the finger's motion the world follows. The rest is slip, and slip smears. */
  MAR_TRACTION: 0.7,
  /** The world's velocity lags the finger with this time constant (ms). Scrubbing slips; steady drags carry. */
  MAR_LAG_MS: 120,
  /** Banks: beyond this fraction of the half width the ink thins and resistance grows (0..1). */
  BANK_START: 0.5,
  /** How much lateral traction is lost at the very edge (0..1). */
  BANK_RESISTANCE: 0.85,
  /** Return current from the banks toward the centre line (px/s at the edge). */
  BANK_RETURN: 40,
  /** Inertia: velocity decays as exp(-k·dt) with k per ms. */
  MAR_FRICTION: 0.0012,
  /** The current runs up the channel: speed (px/s), lateral wiggle (0..1), wavelength (px), adoption (per s). */
  MAR_CURRENT_SPEED: 18,
  MAR_CURRENT_WIGGLE: 0.35,
  MAR_CURRENT_SCALE: 700,
  MAR_CURRENT_ADOPT: 0.6,
  /** Currents fade this many seconds after the last touch. 0 = never fade. */
  MAR_CURRENT_FADE_S: 0,
  /** Passive help: bias of the current (and of the ink's grain) toward the nearest unfound place at rest. 0 disables. */
  MAR_HELP_BIAS: 0.08,
  /** Active help: holding the finger still on the ground gathers the grain toward the nearest unfound place. */
  MAR_HELP_ACTIVE_BIAS: 0.9,
  /** Hold this long without moving more than the tolerance to invoke it (ms, px). */
  HOLD_HELP_MS: 450,
  HOLD_TOLERANCE_PX: 10,
  /** The help rises while held and falls after release (ms). */
  HELP_RISE_MS: 900,
  HELP_FALL_MS: 1400,
  /** Extra grain contrast while the help is invoked. */
  GRAIN_HELP_BOOST: 0.35,
  /** The threshold is a colossus: the current at full expression, less traction, a mass of ink to cross. */
  THRESHOLD_CURRENT_MULT: 3,
  THRESHOLD_TRACTION: 0.5,
  THRESHOLD_MASS: 0.9,
  /** Crossing a threshold upward for the first time: a brief look back down the channel (zoom, ms). 0 disables. */
  LOOKBACK_ZOOM: 0.42,
  LOOKBACK_MS: 3200,
  /** The camera may overshoot the world edge by this many px (0 = hard edge). */
  CAMERA_EDGE_SOFT: 0,
  /** Threshold band height (screens). */
  THRESHOLD_BAND_SCREENS: 0.6,

  // --- ink simulation ---
  /** Simulation resolution as a fraction of world px (per region; four regions stay resident). */
  SIM_SCALE: 0.3,
  /** Brush radius (× short). */
  BRUSH_RADIUS: 0.07,
  /** How much slip becomes ink velocity. */
  BRUSH_STRENGTH: 1.0,
  /** Ink velocity decay per second. */
  VEL_DECAY: 7,
  /** Seconds for a smear to dry back toward the ground. */
  INK_DRY_S: 120,
  /** Insistence: how fast repeated handling accumulates, and decays per second. */
  INSISTENCE_RATE: 0.35,
  INSISTENCE_DECAY: 0.03,
  /** Accent strength (burgundy through insistence and drying). 0 disables. */
  ACCENT_STRENGTH: 0.7,
  /** Displaced ink: paler furrow under the finger, darker ridges beside it. 0 disables. */
  FURROW_STRENGTH: 0.5,
  /** Grain of the ink running up the channel, bent by the help bias. 0 disables. */
  GRAIN_STRENGTH: 0.16,
  /** The cost of finding: a stamp scars the ground around the place (strength, radius × short, width × short). */
  SCAR_STRENGTH: 0.4,
  SCAR_RADIUS: 0.85,
  SCAR_WIDTH: 0.12,
  /** Dirty hands: after each stamp the finger deposits more ink and the accent comes sooner. */
  DIRT_PER_STAMP: 0.08,
  DIRT_ACCENT: 0.5,

  // --- clearing under text (the ink parts around it) ---
  /** Margin around a text block (× short), softness (× short) and edge irregularity (0..1). */
  CLEAR_MARGIN: 0.12,
  CLEAR_SOFT: 0.24,
  CLEAR_IRREGULARITY: 0.9,
  /** Residual ink allowed under text (0 = pure paper). Keep low for the contrast floor. */
  CLEAR_RESIDUAL: 0.08,

  // --- text as matter ---
  /** Sway in px per 1000 px/s of camera velocity, and max rotation (deg). Off by default (motion budget). */
  SWAY_AMPLITUDE: 0,
  SWAY_ROTATION: 0,
  /** Sway smoothing (per s). */
  SWAY_SMOOTH: 4,

  // --- arrival: the current deposits the visitor ---
  /** Settle glide that frames the text block and its seal (ms), and the safe margin (px). */
  SETTLE_MS: 700,
  SAFE_MARGIN_PX: 28,
  /** Leaving a place takes a deliberate drag of at least this many px. */
  DEPART_PX: 36,
  /** The arrival sequence: the clearing opens, the text settles, the stamp lands (ms). */
  CLEAR_OPEN_MS: 900,
  TEXT_SETTLE_MS: 500,
  STAMP_DELAY_MS: 250,
  /** The stamp lands with a short dip of the viewpoint (px, ms). 0 disables. */
  STAMP_DIP_PX: 5,
  STAMP_DIP_MS: 220,

  // --- seal ---
  STAMP_MS: 480,
  STAMP_VIBRATE_MS: 18,

  // --- entry and titles ---
  /** Cover: the signature is stamped onto the paper after this delay, then a touch dissolves the cover (ms). */
  COVER_STAMP_DELAY_MS: 700,
  COVER_STAMP_MS: 520,
  COVER_DISSOLVE_MS: 1200,
  /** The white opens into the territory over this time (ms). */
  OPEN_MS: 1600,
  /** The title is an event: in, hold, out (ms). No place can emerge until it is gone. */
  TITLE_IN_MS: 700,
  TITLE_HOLD_MS: 1800,
  TITLE_OUT_MS: 900,

  // --- linear accessible path ---
  GLIDE_MS: 900,

  // --- the exit (fragment 22) ---
  /** Reading dwell before stillness counts: base margin plus time per canon word (ms). */
  CIELO_DWELL_BASE_MS: 2500,
  CIELO_DWELL_PER_WORD_MS: 400,
  /** Continuous stillness after the dwell that begins the dissolution (ms), and its length (ms). */
  CIELO_STILL_MS: 4000,
  CIELO_FADE_MS: 5000,
  /** A touch during the dissolution restores the place over this time (ms). */
  RESTORE_MS: 600,
  /** The Return: reprise shown for this long before the lone seal (ms). */
  REPRISE_MS: 7000,

  // --- sound (experimental) ---
  SOUND_ENABLED: 0,
  SOUND_BASE_HZ: 110,
  SOUND_GAIN: 0.1,
}

export type GestureConfig = typeof defaultConfig
export type ConfigKey = keyof GestureConfig

/** Live configuration. Read it at use time, never copy it at module load. */
export const config: GestureConfig = { ...defaultConfig }

export function setConfig(key: ConfigKey, value: number) {
  if (!(key in defaultConfig)) throw new Error(`config: unknown key ${key}`)
  if (!Number.isFinite(value)) throw new Error(`config: ${key} must be a finite number`)
  config[key] = value
}

export function resetConfig() {
  Object.assign(config, defaultConfig)
}

/** Dwell a visitor gets on a Cielo station before stillness counts, by canon words. */
export function cieloDwellMs(words: number): number {
  return config.CIELO_DWELL_BASE_MS + config.CIELO_DWELL_PER_WORD_MS * Math.max(0, words)
}
