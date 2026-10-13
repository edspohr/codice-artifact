// The territory's physics: traction. The world follows the finger only
// partially and with a lag; the rest of the finger's motion is slip over
// the ink, and slip is what smears. Each region is a traction profile:
// - Mar: slippery, long inertia, then a current up the channel.
// - Tierra: short inertia, no current (its crust blocks the way, see crust.ts).
// - Cordillera: you climb from hold to hold. Touch a hold and you grip it:
//   the world follows the finger with weight, pulling it down lifts you.
//   Bare rock barely gives, and letting go off a hold slips you back to
//   the last one. Hanging and lifting tire the grip (never shown); on a
//   ledge (a place, the entry, the threshold) it recovers; spent, you slip
//   down to the last ledge.
// - Cielo: little traction; the air carries you. Inside a wind stream or a
//   thermal you drift with it, outside almost nothing moves you. A flick
//   sets a drift that slows to a minimum and only a touch stops it.
// Drags are in screen px; the world moves in world px (divided by the view scale).
import { config } from '../gestures/config'
import type { Camera } from './camera'
import { holdAt, type Hold } from './holds'
import type { Rect, Vec2, World } from './types'
import { windAt } from './wind'
import { regionAt } from './world'

export interface Slip {
  /** Finger position in world px at the start and end of the step. */
  from: Vec2
  to: Vec2
  /** Slip vector in world px for this step (finger motion the world did not follow). */
  dx: number
  dy: number
}

interface Fall {
  /** A slide back to the last hold can be caught by grabbing the rock; a fall to the last ledge cannot. */
  kind: 'slide' | 'fall'
  from: Vec2
  to: Vec2
  start: number
  duration: number
}

export class MarPhysics {
  private lastTouchAt = 0
  private touching = false
  private world: World
  private camera: Camera
  /** Effective help bias (0..1): the passive bias at rest, the active one while the help is invoked. */
  helpBias = config.MAR_HELP_BIAS
  /** Set by the loop when an emerged place is near: Mar's current and Cielo's air calm so the text is not carried away. */
  calm = false

  // Cordillera.
  /** The grip (1 fresh, 0 spent). Never shown. */
  grip = 1
  /** The hold being gripped, and the height where the grip began (reach is measured from there). */
  private held: Hold | null = null
  private heldFromY = 0
  /** Where the visitor hangs (the last hold let go), and the last ledge they stood on. */
  private anchor: Vec2 | null = null
  private ledge: Vec2 | null = null
  private fall: Fall | null = null

  // Cielo.
  private drift = { x: 0, y: 0 }
  private air = { x: 0, y: 0 }

  constructor(world: World, camera: Camera) {
    this.world = world
    this.camera = camera
  }

  /** `fingerX, fingerY` (screen px) let Cordillera find the hold under the finger. */
  touchStart(now: number, fingerX?: number, fingerY?: number) {
    this.touching = true
    this.lastTouchAt = now
    const region = this.regionId()
    // Cielo: touching again stops the drift and holds against the air.
    if (region === 'cielo') {
      this.camera.vx = 0
      this.camera.vy = 0
      this.drift = { x: 0, y: 0 }
      this.air = { x: 0, y: 0 }
    }
    if (region === 'cordillera') {
      this.camera.vx = 0
      this.camera.vy = 0
      this.ensureAnchor()
      // Grabbing the rock interrupts a slide back to the last hold, never a fall.
      if (this.fall?.kind === 'slide') this.fall = null
      this.held = null
      if (fingerX !== undefined && fingerY !== undefined && !this.fall) {
        const p = this.camera.toWorld(fingerX, fingerY)
        const radius = (config.CORDILLERA_GRIP_RADIUS * this.world.short) / this.camera.scale
        this.held = holdAt(this.world.holds, p, radius)
        this.heldFromY = this.camera.y
      }
    }
  }

  /** Dev/test: whether the visitor is slipping back or falling. */
  get slipping(): 'slide' | 'fall' | null {
    return this.fall?.kind ?? null
  }

  /** Dev/test: the hold being gripped. */
  get holding(): Hold | null {
    return this.held
  }

  /**
   * One drag step. `fdx, fdy` is the finger's screen delta (px). Returns the
   * slip of the finger over the ink, in world px, at the finger's position.
   */
  drag(fingerX: number, fingerY: number, fdx: number, fdy: number, dt: number, now: number): Slip {
    this.lastTouchAt = now
    const from = this.camera.toWorld(fingerX - fdx, fingerY - fdy)
    const safeDt = Math.max(1, dt)
    const s = this.camera.scale
    const region = this.regionId()
    let lateralTraction: number
    let verticalTraction: number
    let lag = Math.max(0, config.MAR_LAG_MS)
    if (region === 'cordillera') {
      if (this.fall) {
        lateralTraction = 0
        verticalTraction = 0
      } else if (this.held) {
        // Gripping: the hold follows the finger with weight. A tired grip pulls less,
        // and beyond the reach of one pull the rock barely gives.
        lag = Math.max(0, config.CORDILLERA_GRIP_LAG_MS)
        const low = Math.max(0.01, config.CORDILLERA_LOW_GRIP)
        const strength = this.grip >= low ? 1 : 0.35 + 0.65 * (this.grip / low)
        lateralTraction = strength
        verticalTraction = strength
        const rise = this.heldFromY - this.camera.y
        if (fdy > 0 && rise > config.CORDILLERA_REACH_SCREENS * this.camera.worldH) verticalTraction *= 0.08
      } else {
        lateralTraction = config.CORDILLERA_TRACTION
        verticalTraction = config.CORDILLERA_TRACTION
      }
    } else {
      // Banks (in the channels): lateral traction fades toward the edges.
      // The threshold: a mass of ink with less traction, crossed by the current.
      const base = region === 'cielo' ? config.CIELO_TRACTION : config.MAR_TRACTION
      const inBand = this.inThreshold(this.camera.y) ? config.THRESHOLD_TRACTION / Math.max(0.01, config.MAR_TRACTION) : 1
      lateralTraction = base * inBand * (1 - config.BANK_RESISTANCE * this.bankFactor(this.camera.x))
      verticalTraction = base * inBand
    }
    const targetVx = (-fdx * lateralTraction) / s / safeDt
    const targetVy = (-fdy * verticalTraction) / s / safeDt
    const k = lag > 0 ? 1 - Math.exp(-safeDt / lag) : 1
    this.camera.vx += (targetVx - this.camera.vx) * k
    this.camera.vy += (targetVy - this.camera.vy) * k
    const wdx = this.camera.vx * safeDt
    const wdy = this.camera.vy * safeDt
    const yBefore = this.camera.y
    this.camera.moveBy(wdx, wdy)
    // Lifting costs grip.
    if (region === 'cordillera' && this.camera.y < yBefore) {
      this.grip = Math.max(0, this.grip - (config.CORDILLERA_CLIMB_COST_PER_SCREEN * (yBefore - this.camera.y)) / this.camera.worldH)
    }
    const to = this.camera.toWorld(fingerX, fingerY)
    // Slip: how far the finger travelled relative to the ink.
    return { from, to, dx: to.x - from.x, dy: to.y - from.y }
  }

  touchEnd(now: number) {
    this.touching = false
    this.lastTouchAt = now
    const region = this.regionId()
    if (region === 'cordillera') {
      this.camera.vx = 0
      this.camera.vy = 0
      this.ensureAnchor()
      const anchor = this.anchor!
      if (this.held) {
        // Let go of a hold: you hang where it left you.
        this.anchor = { x: this.camera.x, y: this.camera.y }
      } else if (!this.fall && this.camera.y < anchor.y - 1) {
        // Off a hold, bare rock does not hold you: you slip back to the last one.
        this.slide(anchor, now, Math.min(600, 250 + (anchor.y - this.camera.y) * 0.8))
      } else if (this.camera.y > anchor.y) {
        // Climbing down holds wherever you stop.
        this.anchor = { x: this.camera.x, y: this.camera.y }
      }
      this.held = null
    } else if (region === 'cielo') {
      // The flick becomes a drift.
      this.drift = { x: this.camera.vx * config.CIELO_FLICK_GAIN, y: this.camera.vy * config.CIELO_FLICK_GAIN }
      this.air = { x: 0, y: 0 }
      this.camera.vx = this.drift.x
      this.camera.vy = this.drift.y
    }
  }

  /** At rest at a place (a ledge): the grip recovers. Returns true while it is still recovering. */
  recover(dt: number): boolean {
    if (this.grip >= 1) return false
    this.grip = Math.min(1, this.grip + (config.CORDILLERA_RECOVER_PER_S * dt) / 1000)
    return true
  }

  /** The viewpoint was placed (a glide, a rest at a place): that is where the visitor now holds. */
  secure() {
    this.fall = null
    this.held = null
    this.anchor = { x: this.camera.x, y: this.camera.y }
    if (this.regionId() === 'cordillera' && this.onLedge()) this.ledge = { ...this.anchor }
    this.drift = { x: 0, y: 0 }
    this.air = { x: 0, y: 0 }
  }

  private ensureAnchor() {
    if (!this.anchor || regionAt(this.world, this.anchor.y).id !== 'cordillera') this.anchor = { x: this.camera.x, y: this.camera.y }
    if (!this.ledge || regionAt(this.world, this.ledge.y).id !== 'cordillera') this.ledge = { x: this.camera.x, y: this.camera.y }
  }

  private slide(to: Vec2, now: number, duration: number, kind: Fall['kind'] = 'slide') {
    this.fall = { kind, from: { x: this.camera.x, y: this.camera.y }, to: { ...to }, start: now, duration }
  }

  /** A ledge: near a place, at the region's entry, or in a threshold band. */
  onLedge(): boolean {
    const y = this.camera.y
    const region = regionAt(this.world, y)
    if (region.id !== 'cordillera') return true
    if (this.inThreshold(y)) return true
    if (y > region.rect.y + region.rect.h - this.camera.worldH * 0.6) return true
    const limit = (config.CORDILLERA_LEDGE_DISTANCE * this.world.short) / this.camera.scale
    return this.world.places.some((p) => p.region === 'cordillera' && Math.hypot(p.x - this.camera.x, p.y - y) <= limit)
  }

  /** Free motion: inertia, currents, the air, the grip. Returns true while still moving (or the grip is wearing). */
  step(dt: number, now: number, nearestUnfound: Vec2 | null): boolean {
    const region = this.regionId()
    if (region === 'cordillera') return this.stepCordillera(dt, now)
    if (this.touching) return true
    if (region === 'cielo') return this.stepCielo(dt)
    const friction = region === 'tierra' ? config.TIERRA_FRICTION : config.MAR_FRICTION
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

  private stepCordillera(dt: number, now: number): boolean {
    this.ensureAnchor()
    this.camera.vx = this.touching ? this.camera.vx : 0
    this.camera.vy = this.touching ? this.camera.vy : 0
    if (this.fall) {
      const f = this.fall
      const t = Math.min(1, (now - f.start) / Math.max(1, f.duration))
      // A slip accelerates, then catches.
      const e = t < 1 ? t * t * (3 - 2 * t) : 1
      this.camera.x = f.from.x + (f.to.x - f.from.x) * e
      this.camera.y = f.from.y + (f.to.y - f.from.y) * e
      this.camera.clamp()
      if (t >= 1) {
        this.fall = null
        this.anchor = { x: this.camera.x, y: this.camera.y }
      }
      return true
    }
    if (this.onLedge()) {
      this.grip = Math.min(1, this.grip + (config.CORDILLERA_RECOVER_PER_S * dt) / 1000)
      if (!this.touching) {
        this.ledge = { x: this.camera.x, y: this.camera.y }
        this.anchor = { ...this.ledge }
      }
      return this.grip < 1
    }
    // Hanging off a ledge wears the grip.
    this.grip = Math.max(0, this.grip - (config.CORDILLERA_HANG_DRAIN_PER_S * dt) / 1000)
    if (this.grip <= 0) {
      // Spent: the visitor slips down to the last ledge.
      this.held = null
      this.grip = Math.max(0.15, config.CORDILLERA_LOW_GRIP * 0.5)
      this.slide(this.ledge!, now, config.CORDILLERA_FALL_MS, 'fall')
      return true
    }
    const low = Math.max(0.01, config.CORDILLERA_LOW_GRIP)
    if (!this.touching && this.grip < low) {
      // A tired hand creeps down.
      const creep = (config.CORDILLERA_CREEP_PX_S * (1 - this.grip / low) * dt) / 1000
      this.camera.moveBy(0, creep)
      this.anchor = { x: this.camera.x, y: this.camera.y }
    }
    return true
  }

  private stepCielo(dt: number): boolean {
    // The flick's drift slows to a minimum and never stops on its own.
    const speed = Math.hypot(this.drift.x, this.drift.y)
    if (speed > 0) {
      const decayed = speed * Math.exp(-config.CIELO_FRICTION * dt)
      const next = Math.max(decayed, config.CIELO_MIN_SPEED / 1000)
      this.drift.x *= next / speed
      this.drift.y *= next / speed
    }
    // The air: adopted gradually, calmer near an emerged text.
    const wind = windAt(this.world.wind, this.camera.x, this.camera.y)
    const calm = this.calm ? config.CIELO_WIND_NEAR_PLACE : 1
    const adopt = 1 - Math.exp((-config.CIELO_WIND_ADOPT * dt) / 1000)
    this.air.x += (wind.x * calm - this.air.x) * adopt
    this.air.y += (wind.y * calm - this.air.y) * adopt
    if (Math.hypot(this.air.x, this.air.y) < 0.002 && Math.hypot(wind.x, wind.y) < 0.002) this.air = { x: 0, y: 0 }
    this.camera.vx = this.drift.x + this.air.x
    this.camera.vy = this.drift.y + this.air.y
    if (this.camera.vx === 0 && this.camera.vy === 0) return false
    const x = this.camera.x
    const y = this.camera.y
    this.camera.moveBy(this.camera.vx * dt, this.camera.vy * dt)
    // Stopped by the edge of the sky with no air left to carry: at rest.
    if (this.camera.x === x && this.camera.y === y) {
      this.drift = { x: 0, y: 0 }
      return Math.hypot(this.air.x, this.air.y) > 0.002
    }
    return true
  }

  /** The rect of the region the viewpoint is in. */
  private regionRect(): Rect {
    return regionAt(this.world, this.camera.y).rect
  }

  /**
   * 0 on the centre line, 1 when the viewport touches the edge of the channel.
   * Measured over the camera's reachable lateral play, so a narrow channel
   * still has banks. Only the channels (Mar, Tierra) have banks: Cordillera
   * and Cielo are open.
   */
  bankFactor(x: number): number {
    const id = this.regionId()
    if (id === 'cordillera' || id === 'cielo') return 0
    const region = this.regionRect()
    const halfRange = Math.max(1, region.w / 2 - this.camera.worldW / 2)
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

  /** Speed of the carrying current (px/ms) at a height, after its fade since the last touch. Only Mar has one. */
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
