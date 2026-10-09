// The territory's physics: traction. The world follows the finger only
// partially and with a lag; the rest of the finger's motion is slip over
// the ink, and slip is what smears. Each region is a traction profile:
// - Mar: slippery, long inertia, then a current up the channel.
// - Tierra: short inertia, no current (its crust blocks the way, see crust.ts).
// - Cordillera: no inertia, no current; you climb by stretches: pull up
//   (the rock barely gives), let go, and the viewpoint rises one stretch
//   with weight. Stretches without rest shorten (fatigue); rest recovers.
// - Cielo: little traction; a flick sets a drift that stillness sustains,
//   slowing to a minimum, and only a touch stops it.
import { config } from '../gestures/config'
import type { Camera } from './camera'
import type { Rect, Vec2, World } from './types'
import { regionAt } from './world'

export interface Slip {
  /** Finger position in world px at the start and end of the step. */
  from: Vec2
  to: Vec2
  /** Slip vector in world px for this step (finger motion the world did not follow). */
  dx: number
  dy: number
}

export class MarPhysics {
  private lastTouchAt = 0
  private touching = false
  private world: World
  private camera: Camera
  /** Effective help bias (0..1): the passive bias at rest, the active one while the help is invoked. */
  helpBias = config.MAR_HELP_BIAS
  /** Set by the loop when an emerged place is near: Mar's current calms so the text is not carried away. */
  calm = false
  /** Cordillera's fatigue (0 rested, 1 exhausted), the pull of the current touch, and the stretch still to rise. */
  fatigue = 0
  private pull = 0
  private rung = 0
  private restSince = 0

  constructor(world: World, camera: Camera) {
    this.world = world
    this.camera = camera
  }

  touchStart(now: number) {
    this.touching = true
    this.lastTouchAt = now
    const region = this.regionId()
    // Cielo: touching again stops the drift.
    if (region === 'cielo') {
      this.camera.vx = 0
      this.camera.vy = 0
    }
    // Cordillera: grabbing the rock stops a stretch; rest since the last release recovers.
    if (region === 'cordillera') {
      this.rung = 0
      this.fatigue = Math.max(0, this.fatigue - (config.CORDILLERA_RECOVER_PER_S * Math.max(0, now - this.restSince)) / 1000)
    }
    this.pull = 0
  }

  /**
   * One drag step. `fdx, fdy` is the finger's screen delta (px). Returns the
   * slip of the finger over the ink, in world px, at the finger's position.
   */
  drag(fingerX: number, fingerY: number, fdx: number, fdy: number, dt: number, now: number): Slip {
    this.lastTouchAt = now
    const from = this.camera.toWorld(fingerX - fdx, fingerY - fdy)
    // Target world velocity: the world moves opposite to the finger, scaled by traction.
    const safeDt = Math.max(1, dt)
    // Banks: lateral traction fades toward the edges of the channel.
    // The threshold: a mass of ink with less traction, crossed by the current.
    const region = this.regionId()
    const base =
      region === 'cordillera' ? config.CORDILLERA_TRACTION : region === 'cielo' ? config.CIELO_TRACTION : config.MAR_TRACTION
    const inBand = this.inThreshold(this.camera.y) ? config.THRESHOLD_TRACTION / Math.max(0.01, config.MAR_TRACTION) : 1
    const lateralTraction = base * inBand * (1 - config.BANK_RESISTANCE * this.bankFactor(this.camera.x))
    let verticalTraction = base * inBand
    // Cordillera: pulling up (a finger moving down) meets tension; the climb comes on release.
    if (region === 'cordillera' && fdy > 0) {
      verticalTraction *= config.CORDILLERA_TENSION
      this.pull += fdy
    }
    const targetVx = (-fdx * lateralTraction) / safeDt
    const targetVy = (-fdy * verticalTraction) / safeDt
    const lag = Math.max(0, config.MAR_LAG_MS)
    const k = lag > 0 ? 1 - Math.exp(-safeDt / lag) : 1
    this.camera.vx += (targetVx - this.camera.vx) * k
    this.camera.vy += (targetVy - this.camera.vy) * k
    const wdx = this.camera.vx * safeDt
    const wdy = this.camera.vy * safeDt
    this.camera.moveBy(wdx, wdy)
    const to = this.camera.toWorld(fingerX, fingerY)
    // Slip: how far the finger travelled relative to the ink.
    return { from, to, dx: to.x - from.x, dy: to.y - from.y }
  }

  touchEnd(now: number) {
    this.touching = false
    this.lastTouchAt = now
    const region = this.regionId()
    // Cordillera: no inertia; a pull long enough lifts one stretch. Cielo: the flick becomes a drift.
    if (region === 'cordillera') {
      this.camera.vx = 0
      this.camera.vy = 0
      if (this.pull >= config.CORDILLERA_PULL_MIN_PX) {
        this.rung = config.CORDILLERA_RUNG_SCREENS * this.camera.viewH * (1 - config.CORDILLERA_FATIGUE_MAX * this.fatigue)
        this.fatigue = Math.min(1, this.fatigue + config.CORDILLERA_FATIGUE_PER_RUNG)
      }
      this.pull = 0
      this.restSince = now
    } else if (region === 'cielo') {
      this.camera.vx *= config.CIELO_FLICK_GAIN
      this.camera.vy *= config.CIELO_FLICK_GAIN
    }
  }

  /** Free motion: inertia and currents. Returns true while still moving. */
  step(dt: number, now: number, nearestUnfound: Vec2 | null): boolean {
    if (this.touching) return true
    const region = this.regionId()
    if (region === 'cordillera' || this.rung > 0) {
      this.camera.vx = 0
      this.camera.vy = 0
      // The stretch rises with weight: fast at first, settling at the end.
      // Rest (and recovery) begins when the stretch has settled.
      if (this.rung <= 1) {
        if (this.rung > 0) this.restSince = now
        this.rung = 0
        return false
      }
      const d = this.rung * (1 - Math.exp(-dt / Math.max(1, config.CORDILLERA_RUNG_MS)))
      const y = this.camera.y
      this.camera.moveBy(0, -d)
      this.rung = this.camera.y === y ? 0 : this.rung - d
      if (this.rung <= 0) this.restSince = now
      return this.rung > 0
    }
    if (region === 'cielo') {
      const speed = Math.hypot(this.camera.vx, this.camera.vy)
      if (speed === 0) return false
      const decayed = speed * Math.exp(-config.CIELO_FRICTION * dt)
      const next = Math.max(decayed, config.CIELO_MIN_SPEED / 1000)
      this.camera.vx *= next / speed
      this.camera.vy *= next / speed
      this.camera.moveBy(this.camera.vx * dt, this.camera.vy * dt)
      return this.camera.vx !== 0 || this.camera.vy !== 0
    }
    const friction = this.regionId() === 'tierra' ? config.TIERRA_FRICTION : config.MAR_FRICTION
    const decay = Math.exp(-friction * dt)
    this.camera.vx *= decay
    this.camera.vy *= decay

    const current = this.currentAt(this.camera.x, this.camera.y, now, nearestUnfound)
    const adopt = 1 - Math.exp((-config.MAR_CURRENT_ADOPT * dt) / 1000)
    this.camera.vx += (current.x - this.camera.vx) * adopt
    this.camera.vy += (current.y - this.camera.vy) * adopt

    const speed = Math.hypot(this.camera.vx, this.camera.vy)
    // At rest: nothing left to carry (the bank's return current alone, once slow, does not keep the loop alive).
    const carried = this.currentSpeed(now, this.camera.y)
    if ((speed < 0.0005 && Math.hypot(current.x, current.y) < 0.0005) || (carried <= 0 && speed < 0.01)) {
      this.camera.vx = 0
      this.camera.vy = 0
      return false
    }
    this.camera.moveBy(this.camera.vx * dt, this.camera.vy * dt)
    return true
  }

  /**
   * 0 on the centre line, 1 when the viewport touches the edge of the channel.
   * Measured over the camera's reachable lateral play, so a narrow channel
   * still has banks.
   */
  /** The rect of the region the viewpoint is in. */
  private regionRect(): Rect {
    return regionAt(this.world, this.camera.y).rect
  }

  bankFactor(x: number): number {
    const region = this.regionRect()
    const halfRange = Math.max(1, region.w / 2 - this.camera.viewW / 2)
    const u = Math.abs(x - (region.x + region.w / 2)) / halfRange
    const start = Math.min(0.99, Math.max(0, config.BANK_START))
    return Math.max(0, Math.min(1, (u - start) / (1 - start)))
  }

  inThreshold(y: number): boolean {
    return this.world.thresholds.some((th) => y >= th.band.y && y <= th.band.y + th.band.h)
  }

  /** Direction of the current (unit vector): up the channel, wiggling, bent toward the nearest unfound place. */
  currentDirection(x: number, y: number, nearestUnfound: Vec2 | null): Vec2 {
    const scale = Math.max(50, config.MAR_CURRENT_SCALE)
    const wiggle = config.MAR_CURRENT_WIGGLE * Math.sin((y / scale) * 2.1 + 0.7 + Math.cos((x / scale) * 1.3))
    let cx = wiggle
    let cy = -1
    const bias = this.helpBias
    if (bias > 0 && nearestUnfound) {
      const dx = nearestUnfound.x - x
      const dy = nearestUnfound.y - y
      const d = Math.hypot(dx, dy) || 1
      cx = cx * (1 - bias) + (dx / d) * bias
      cy = cy * (1 - bias) + (dy / d) * bias
    }
    const m = Math.hypot(cx, cy) || 1
    return { x: cx / m, y: cy / m }
  }

  /** The id of the region the viewpoint is in. */
  regionId() {
    return regionAt(this.world, this.camera.y).id
  }

  /** Speed of the carrying current (px/ms) at a height, after its fade since the last touch. Tierra has none. */
  currentSpeed(now: number, y: number = this.camera.y): number {
    if (regionAt(this.world, y).id !== 'mar') return 0
    let speed = (config.MAR_CURRENT_SPEED / 1000) * (this.calm ? config.CURRENT_NEAR_PLACE : 1)
    const fade = config.MAR_CURRENT_FADE_S
    if (fade > 0) {
      const t = (now - this.lastTouchAt) / 1000
      speed *= Math.max(0, 1 - t / fade)
    }
    return speed
  }

  /** Current velocity (px/ms) at a world position. */
  currentAt(x: number, y: number, now: number, nearestUnfound: Vec2 | null): Vec2 {
    const speed = this.currentSpeed(now, y)
    const dir = this.currentDirection(x, y, nearestUnfound)
    let vx = dir.x * speed
    let vy = dir.y * speed
    // Threshold band: Mar at full expression.
    for (const th of this.world.thresholds) {
      if (y >= th.band.y && y <= th.band.y + th.band.h) {
        vx *= config.THRESHOLD_CURRENT_MULT
        vy *= config.THRESHOLD_CURRENT_MULT
      }
    }
    // Banks: a return current toward the centre line, so nobody drifts into nothing.
    const region = regionAt(this.world, y).rect
    const bank = this.bankFactor(x)
    if (bank > 0) {
      const toCentre = Math.sign(region.x + region.w / 2 - x)
      vx += (toCentre * config.BANK_RETURN * bank) / 1000
    }
    return { x: vx, y: vy }
  }
}
