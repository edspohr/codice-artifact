import { config } from '../gestures/config'
import type { Vec2, World } from './types'

/** The viewpoint: centre in world px, plus the viewport size. */
export class Camera {
  x = 0
  y = 0
  vx = 0 // px/ms
  vy = 0
  viewW = 1
  viewH = 1
  private world: World

  constructor(world: World) {
    this.world = world
    this.x = world.start.x
    this.y = world.start.y
  }

  setViewport(w: number, h: number) {
    this.viewW = w
    this.viewH = h
    this.clamp()
  }

  get left() {
    return this.x - this.viewW / 2
  }
  get top() {
    return this.y - this.viewH / 2
  }

  /** Move by a world-space delta, clamped to the world. */
  moveBy(dx: number, dy: number) {
    this.x += dx
    this.y += dy
    this.clamp()
  }

  clamp() {
    const soft = config.CAMERA_EDGE_SOFT
    const minX = this.viewW / 2 - soft
    const maxX = this.world.width - this.viewW / 2 + soft
    const minY = this.viewH / 2 - soft
    const maxY = this.world.height - this.viewH / 2 + soft
    if (this.x < minX) {
      this.x = minX
      this.vx = 0
    }
    if (this.x > maxX) {
      this.x = maxX
      this.vx = 0
    }
    if (this.y < minY) {
      this.y = minY
      this.vy = 0
    }
    if (this.y > maxY) {
      this.y = maxY
      this.vy = 0
    }
  }

  toWorld(sx: number, sy: number): Vec2 {
    return { x: this.left + sx, y: this.top + sy }
  }

  toScreen(wx: number, wy: number): Vec2 {
    return { x: wx - this.left, y: wy - this.top }
  }
}
