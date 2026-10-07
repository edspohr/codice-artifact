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
  /** Reading time added per canon line (ms). */
  CIELO_DWELL_PER_LINE_MS: 2200,
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

/** Dwell a visitor gets on a Cielo station before stillness counts, by canon lines. */
export function cieloDwellMs(lines: number): number {
  return config.CIELO_DWELL_BASE_MS + config.CIELO_DWELL_PER_LINE_MS * Math.max(0, lines)
}
