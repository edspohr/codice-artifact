// Gesture thresholds and timers. Starting hypotheses to be tuned in the
// browser with the author (CLAUDE.md §3.2 and §8). The object is mutable on
// purpose: dev tooling overrides values at runtime without a rebuild, and
// every recognizer reads it live.

export const defaultConfig = {
  /** Pointer downs closer than this to the left/right edges are ignored (iOS edge swipes). */
  EDGE_INSET_PX: 24,

  // --- Mar: lateral drift ---
  /** Fraction of the stage width a drift must cover to commit. */
  DRIFT_COMMIT_FRACTION: 0.45,
  /** Horizontal flick velocity (px/ms) that commits even if the distance is short. */
  DRIFT_FLICK_VELOCITY: 0.9,
  /** Minimum progress for a flick to count. */
  DRIFT_FLICK_MIN_PROGRESS: 0.12,

  // --- Tierra: fracture by insistence ---
  /** Maximum progress a single stroke can add. Below 1, one swipe can never break the view. */
  FRACTURE_STROKE_CAP: 0.4,
  /** Path length, in stage widths, that would add a full unit of progress. */
  FRACTURE_PATH_PER_UNIT: 1.1,
  /** Progress lost per second while no stroke is being drawn (the view heals). */
  FRACTURE_HEAL_PER_S: 0.06,
  /** Grace before healing starts after a stroke ends (ms). */
  FRACTURE_HEAL_DELAY_MS: 600,

  // --- Cordillera: upward pull with resistance ---
  /** Resistance scale in px: progress = 1 - exp(-dy / R). Larger is heavier. */
  PULL_RESISTANCE_PX: 320,
  /** Progress at which the pull commits. */
  PULL_COMMIT_PROGRESS: 0.8,
  /** Inertia friction per ms (velocity decays as exp(-k * dt)). */
  PULL_FRICTION: 0.0045,
  /** Downward "gravity" on the released view, px/ms². */
  PULL_GRAVITY: 0.0012,

  // --- Cielo: stillness ---
  /** Minimum dwell before stillness starts counting: base margin (ms). */
  CIELO_DWELL_BASE_MS: 2500,
  /** Reading time added per canon word (ms). */
  CIELO_DWELL_PER_WORD_MS: 400,
  /** Continuous stillness required after the dwell (ms). */
  CIELO_STILL_MS: 4000,
  /** Duration of the slow fade that advances the view (ms). */
  CIELO_FADE_MS: 5000,

  // --- The Return ---
  /** Length of the dissolution before the reprise (ms). */
  DISSOLUTION_MS: 4000,

  // --- Stall cue ---
  /** Idle time on a station before the faint ink cue shows (ms). */
  STALL_CUE_MS: 15000,

  // --- Transitions ---
  /** Settle time when a gesture commits (ms). */
  COMMIT_SETTLE_MS: 420,
  /** Settle time when a keyboard or a11y control advances (ms). */
  KEYBOARD_SETTLE_MS: 260,
  /** Snap-back time when a gesture is released early (ms). */
  SNAPBACK_MS: 360,

  // =====================================================================
  // Territory (Phase 2 prototype: Mar). Every value is a live override.
  // Distances marked "× short" are fractions of the viewport's short side.
  // =====================================================================

  // --- world ---
  /** Mar region size in screens. */
  MAR_SCREENS_W: 3,
  MAR_SCREENS_H: 3,
  /** White stub above Mar's threshold (the next region's stand-in), in screens. */
  STUB_SCREENS_H: 1.5,
  /** Places keep this distance from the region edges (× short). */
  PLACE_EDGE_MARGIN: 0.45,
  /** Minimum distance between places (× short). */
  PLACE_MIN_DIST: 1.1,
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
  /** Inertia: velocity decays as exp(-k·dt) with k per ms. */
  MAR_FRICTION: 0.0012,
  /** Currents after release: speed (px/s), wavelength (px) and how fast the camera adopts them (per s). */
  MAR_CURRENT_SPEED: 14,
  MAR_CURRENT_SCALE: 900,
  MAR_CURRENT_ADOPT: 0.6,
  /** Currents fade this many seconds after the last touch. 0 = never fade. */
  MAR_CURRENT_FADE_S: 25,
  /** Subtle help: bias of the current toward the nearest unfound place. 0 disables. */
  MAR_HELP_BIAS: 0.15,
  /** Current multiplier inside the threshold band. */
  THRESHOLD_CURRENT_MULT: 2,
  /** The camera may overshoot the world edge by this many px (0 = hard edge). */
  CAMERA_EDGE_SOFT: 0,
  /** Threshold band height (screens). */
  THRESHOLD_BAND_SCREENS: 0.6,

  // --- ink simulation ---
  /** Simulation resolution as a fraction of world px. */
  SIM_SCALE: 0.25,
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

  // --- clearing under text (the ink parts around it) ---
  /** Margin around a text block (× short), softness (× short) and edge irregularity (0..1). */
  CLEAR_MARGIN: 0.12,
  CLEAR_SOFT: 0.24,
  CLEAR_IRREGULARITY: 0.9,
  /** Residual ink allowed under text (0 = pure paper). Keep low for the contrast floor. */
  CLEAR_RESIDUAL: 0.08,

  // --- text as matter ---
  /** Sway in px per 1000 px/s of camera velocity, and max rotation (deg). */
  SWAY_AMPLITUDE: 8,
  SWAY_ROTATION: 0.6,
  /** Sway smoothing (per s). */
  SWAY_SMOOTH: 4,

  // --- seal ---
  STAMP_MS: 480,
  STAMP_VIBRATE_MS: 18,

  // --- entry and titles ---
  /** The white opens into the territory over this time (ms). */
  OPEN_MS: 1600,
  TITLE_FADE_MS: 1400,

  // --- linear accessible path ---
  GLIDE_MS: 900,

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
