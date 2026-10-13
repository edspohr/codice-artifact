import { config } from '../gestures/config'
import { lateralRange, scaleAt } from './scale'
import type { Vec2, World } from './types'

/**
 * The viewpoint: centre in world px, the viewport size in screen px, and the
 * view scale (screen px per world px), which is a function of the height:
 * the view takes in more of the world as the territory opens.
 */
export class Camera {
  x = 0
  y = 0
  vx = 0 // world px/ms
  vy = 0
  viewW = 1
  viewH = 1
  scale = 1
  private world: World

  constructor(world: World) {
    this.world = world
    this.x = world.start.x
    this.y = world.start.y
    this.scale = scaleAt(world, this.y)
  }

  setViewport(w: number, h: number) {
    this.viewW = w
    this.viewH = h
    this.clamp()
  }

  /** The view in world px. */
  get worldW() {
    return this.viewW / this.scale
  }
  get worldH() {
    return this.viewH / this.scale
  }

  get left() {
    return this.x - this.worldW / 2
  }
  get top() {
    return this.y - this.worldH / 2
  }

  /** Move by a world-space delta, clamped to the world. */
  moveBy(dx: number, dy: number) {
    this.x += dx
    this.y += dy
    this.clamp()
  }

  clamp() {
    const soft = config.CAMERA_EDGE_SOFT
    // Vertical first: the scale (and so the size of the view) depends on the height.
    const topScale = scaleAt(this.world, 0)
    const bottomScale = scaleAt(this.world, this.world.height)
    const minY = this.viewH / topScale / 2 - soft
    const maxY = this.world.height - this.viewH / bottomScale / 2 + soft
    if (this.y < minY) {
      this.y = minY
      this.vy = 0
    }
    if (this.y > maxY) {
      this.y = maxY
      this.vy = 0
    }
    this.scale = scaleAt(this.world, this.y)
    const range = lateralRange(this.world, this.y, this.worldW)
    const minX = range.min - soft
    const maxX = range.max + soft
    if (this.x < minX) {
      this.x = minX
      this.vx = 0
    }
    if (this.x > maxX) {
      this.x = maxX
      this.vx = 0
    }
  }

  toWorld(sx: number, sy: number): Vec2 {
    return { x: this.left + sx / this.scale, y: this.top + sy / this.scale }
  }

  toScreen(wx: number, wy: number): Vec2 {
    return { x: (wx - this.left) * this.scale, y: (wy - this.top) * this.scale }
  }
}
