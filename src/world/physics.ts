// Mar's physics: traction. The world follows the finger only partially and
// with a lag; the rest of the finger's motion is slip over the ink, and
// slip is what smears. After release: long inertia, then slow currents
// that carry the viewpoint, faintly biased toward the nearest unfound
// place (subtle help, zero disables).
import { config } from '../gestures/config'
import type { Camera } from './camera'
import type { Vec2, World } from './types'

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

  constructor(world: World, camera: Camera) {
    this.world = world
    this.camera = camera
  }

  touchStart(now: number) {
    this.touching = true
    this.lastTouchAt = now
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
    const targetVx = (-fdx * config.MAR_TRACTION) / safeDt
    const targetVy = (-fdy * config.MAR_TRACTION) / safeDt
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
  }

  /** Free motion: inertia and currents. Returns true while still moving. */
  step(dt: number, now: number, nearestUnfound: Vec2 | null): boolean {
    if (this.touching) return true
    const decay = Math.exp(-config.MAR_FRICTION * dt)
    this.camera.vx *= decay
    this.camera.vy *= decay

    const current = this.currentAt(this.camera.x, this.camera.y, now, nearestUnfound)
    const adopt = 1 - Math.exp((-config.MAR_CURRENT_ADOPT * dt) / 1000)
    this.camera.vx += (current.x - this.camera.vx) * adopt
    this.camera.vy += (current.y - this.camera.vy) * adopt

    const speed = Math.hypot(this.camera.vx, this.camera.vy)
    if (speed < 0.0005 && Math.hypot(current.x, current.y) < 0.0005) {
      this.camera.vx = 0
      this.camera.vy = 0
      return false
    }
    this.camera.moveBy(this.camera.vx * dt, this.camera.vy * dt)
    return true
  }

  /** Current velocity (px/ms) at a world position. */
  currentAt(x: number, y: number, now: number, nearestUnfound: Vec2 | null): Vec2 {
    let speed = config.MAR_CURRENT_SPEED / 1000
    const fade = config.MAR_CURRENT_FADE_S
    if (fade > 0) {
      const t = (now - this.lastTouchAt) / 1000
      speed *= Math.max(0, 1 - t / fade)
    }
    if (speed <= 0) return { x: 0, y: 0 }
    const scale = Math.max(50, config.MAR_CURRENT_SCALE)
    // A smooth, divergence-free-ish field from two sine terms.
    const a = Math.sin((y / scale) * 2.1 + 0.7) + 0.5 * Math.cos((x / scale) * 1.3 - 0.4)
    const b = Math.cos((x / scale) * 1.7 - 1.1) - 0.5 * Math.sin((y / scale) * 0.9 + 0.2)
    let cx = a
    let cy = b
    // Threshold band: Mar at full expression.
    for (const th of this.world.thresholds) {
      if (y >= th.band.y && y <= th.band.y + th.band.h) {
        cx *= config.THRESHOLD_CURRENT_MULT
        cy *= config.THRESHOLD_CURRENT_MULT
      }
    }
    // Subtle help: lean toward the nearest unfound place.
    const bias = config.MAR_HELP_BIAS
    if (bias > 0 && nearestUnfound) {
      const dx = nearestUnfound.x - x
      const dy = nearestUnfound.y - y
      const d = Math.hypot(dx, dy) || 1
      // The camera moves opposite to the world, so to bring the place toward the
      // centre the viewpoint must move toward it.
      cx = cx * (1 - bias) + (dx / d) * bias * 1.5
      cy = cy * (1 - bias) + (dy / d) * bias * 1.5
    }
    const m = Math.hypot(cx, cy) || 1
    return { x: (cx / m) * speed, y: (cy / m) * speed }
  }
}
