// The territory's single loop: input → physics → camera → places → ink →
// render → DOM sync. Sleeps when nothing moves. Nothing in React runs per
// frame; React only receives place and phase changes through the store.
import { session } from '../app/session'
import { config } from '../gestures/config'
import { Camera } from './camera'
import { Ink, type ClearBox, type InkAssets, type InkColors } from './ink/ink'
import { MarPhysics, type Slip } from './physics'
import { Places } from './places'
import { Sound } from './sound'
import { territoryStore } from './territoryStore'
import { PointerInput, type DragSample } from './input'
import type { Place, Vec2, World } from './types'

export interface TerritoryElements {
  stage: HTMLElement
  canvas: HTMLCanvasElement
  /** The DOM layer holding world-positioned text; receives the camera transform. */
  textLayer: HTMLElement
}

export interface TerritoryOptions {
  world: World
  assets: InkAssets
  colors: InkColors
  revealAll: boolean
  onStamp?: (place: Place) => void
}

interface Glide {
  from: Vec2
  to: Vec2
  start: number
  duration: number
  onDone?: () => void
}

export class Territory {
  readonly world: World
  readonly camera: Camera
  readonly physics: MarPhysics
  readonly places: Places
  readonly ink: Ink
  readonly sound = new Sound()
  private input = new PointerInput()
  private els: TerritoryElements
  private raf = 0
  private idleTimer = 0
  private lastFrame = 0
  private running = false
  private open = 0
  private opening = false
  private openStart = 0
  private pendingSlip: Slip | null = null
  private lastDragT = 0
  private glide: Glide | null = null
  private sway = { x: 0, r: 0 }
  private clears: ClearBox[] = []
  private clearElements: HTMLElement[] = []
  private revealAll: boolean
  private onStampCb: ((place: Place) => void) | undefined
  private dpr = 1
  private destroyed = false

  constructor(els: TerritoryElements, opts: TerritoryOptions) {
    this.els = els
    this.world = opts.world
    this.revealAll = opts.revealAll
    this.onStampCb = opts.onStamp
    this.camera = new Camera(this.world)
    this.physics = new MarPhysics(this.world, this.camera)
    this.places = new Places(this.world, {
      onChange: (s) => territoryStore.setPlace(s),
      onStamp: (p) => this.stamp(p),
    })
    this.ink = new Ink(els.canvas, this.world, opts.assets, opts.colors)
    this.resize()
    this.input.attach(els.stage, {
      onStart: (s) => this.onStart(s),
      onMove: (s, prev) => this.onMove(s, prev),
      onEnd: () => this.onEnd(),
      onCancel: () => this.onEnd(),
    })
    window.addEventListener('resize', this.onResize)
    for (const p of this.world.places) territoryStore.setPlace(this.places.get(p.n))
    territoryStore.patch({ world: this.world, revealAll: this.revealAll })
    this.syncDom()
    this.render()
  }

  private readonly onResize = () => this.resize()

  private resize() {
    const w = this.els.stage.clientWidth || window.innerWidth
    const h = this.els.stage.clientHeight || window.innerHeight
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.els.canvas.width = Math.round(w * this.dpr)
    this.els.canvas.height = Math.round(h * this.dpr)
    this.camera.setViewport(w, h)
    this.wake()
  }

  destroy() {
    this.destroyed = true
    this.input.detach()
    window.removeEventListener('resize', this.onResize)
    if (this.raf) cancelAnimationFrame(this.raf)
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.sound.noteOff(true)
    this.ink.dispose()
  }

  // --- entry ----------------------------------------------------------------

  /** The first touch on the epigraph: the first mark, then the white opens. */
  private openTerritory(now: number) {
    if (this.opening || this.open >= 1) return
    this.opening = true
    this.openStart = now
    territoryStore.patch({ phase: 'territory' })
    this.showTitle('mar', now)
  }

  private showTitle(region: 'mar', now: number) {
    // World-anchored where the visitor entered: left and high in the viewport (spec §5.1, Mar).
    const x = this.camera.left + this.world.short * 0.08
    const y = this.camera.top + this.camera.viewH * 0.09
    territoryStore.addTitle(region, x, y, now)
  }

  // --- input ------------------------------------------------------------------

  private onStart(s: DragSample) {
    const now = performance.now()
    this.glide = null
    this.sound.unlock()
    if (territoryStore.get().phase === 'epigraph') this.openTerritory(now)
    this.physics.touchStart(now)
    this.lastDragT = s.t
    this.sound.noteOn(this.height())
    this.wake()
  }

  private onMove(s: DragSample, prev: DragSample) {
    const dt = Math.max(1, s.t - prev.t)
    const slip = this.physics.drag(s.x, s.y, s.x - prev.x, s.y - prev.y, dt, s.t)
    // Accumulate slip into one brush segment per frame.
    if (this.pendingSlip) {
      this.pendingSlip.to = slip.to
      this.pendingSlip.dx += slip.dx
      this.pendingSlip.dy += slip.dy
    } else {
      this.pendingSlip = slip
    }
    this.lastDragT = s.t
    this.wake()
  }

  private onEnd() {
    this.physics.touchEnd(performance.now())
    this.sound.noteOff()
    this.wake()
  }

  private height(): number {
    const mar = this.world.regions[0]?.rect
    if (!mar) return 0
    return 1 - Math.max(0, Math.min(1, (this.camera.y - mar.y) / mar.h))
  }

  // --- places ------------------------------------------------------------------

  private stamp(place: Place) {
    if (session.get().reducedMotion === false && typeof navigator.vibrate === 'function' && config.STAMP_VIBRATE_MS > 0) {
      try {
        navigator.vibrate(config.STAMP_VIBRATE_MS)
      } catch {
        // unsupported
      }
    }
    this.sound.stamp(this.height())
    this.ink.bake(place, config.FORMATION_RADIUS * this.world.short)
    this.onStampCb?.(place)
    this.wake()
  }

  // --- linear path -------------------------------------------------------------

  /** Glide the viewpoint to a world point (instant with reduced motion). */
  glideTo(to: Vec2, onDone?: () => void) {
    const now = performance.now()
    if (territoryStore.get().phase === 'epigraph') this.openTerritory(now)
    this.camera.vx = 0
    this.camera.vy = 0
    const reduced = session.get().reducedMotion
    this.glide = { from: { x: this.camera.x, y: this.camera.y }, to, start: now, duration: reduced ? 0 : config.GLIDE_MS, onDone }
    this.wake()
  }

  /** Arrive at a place through the linear path. */
  arriveAt(n: number) {
    this.places.arrive(n, performance.now())
    this.wake()
  }

  // --- clearing boxes ---------------------------------------------------------------

  /** Text elements whose world rect the ink must part around. */
  setClearElements(els: HTMLElement[]) {
    this.clearElements = els
    this.wake()
  }

  private measureClears() {
    const out: ClearBox[] = []
    for (const el of this.clearElements) {
      if (!el.isConnected) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const stage = this.els.stage.getBoundingClientRect()
      const w = this.camera.toWorld(r.left - stage.left + r.width / 2, r.top - stage.top + r.height / 2)
      out.push({ cx: w.x, cy: w.y, hw: r.width / 2, hh: r.height / 2 })
    }
    this.clears = out
  }

  // --- loop ----------------------------------------------------------------------------

  wake() {
    if (this.destroyed || this.running) return
    this.running = true
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = 0
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number) => {
    if (this.destroyed) return
    const dt = Math.min(64, Math.max(1, now - this.lastFrame))
    this.lastFrame = now
    let active = false

    // Opening.
    if (this.opening) {
      this.open = Math.min(1, (now - this.openStart) / Math.max(1, config.OPEN_MS))
      if (this.open >= 1) this.opening = false
      active = true
    }

    // Glide (linear path) or physics.
    if (this.glide) {
      const g = this.glide
      const t = g.duration > 0 ? Math.min(1, (now - g.start) / g.duration) : 1
      const e = 1 - Math.pow(1 - t, 3)
      this.camera.x = g.from.x + (g.to.x - g.from.x) * e
      this.camera.y = g.from.y + (g.to.y - g.from.y) * e
      this.camera.clamp()
      if (t >= 1) {
        this.glide = null
        g.onDone?.()
      } else active = true
    } else if (this.input.down) {
      active = true
    } else {
      const nearest = config.MAR_HELP_BIAS > 0 ? this.places.nearestUnfound({ x: this.camera.x, y: this.camera.y }) : null
      if (this.physics.step(dt, now, nearest)) active = true
    }

    // Region (stub above the threshold).
    const mar = this.world.regions[0]?.rect
    const region = mar && this.camera.y < mar.y ? 'stub' : 'mar'
    if (territoryStore.get().region !== region) territoryStore.patch({ region })

    // Places.
    if (this.open > 0 || this.revealAll) {
      if (this.places.update({ x: this.camera.x, y: this.camera.y }, dt, now, this.revealAll)) active = true
    }

    // Ink.
    const slip = this.pendingSlip
    this.pendingSlip = null
    const brush = slip
      ? { ax: slip.from.x, ay: slip.from.y, bx: slip.to.x, by: slip.to.y, vx: (slip.dx / dt) * 1000, vy: (slip.dy / dt) * 1000 }
      : null
    if (brush && this.open <= 0 && !this.opening) {
      // The first mark before the white opens still lands in the field.
    }
    this.ink.step(dt / 1000, brush)
    if (brush || now - this.lastDragT < 1500) active = true

    // Sway from camera velocity (text as matter in Mar).
    const speed = Math.hypot(this.camera.vx, this.camera.vy) * 1000 // px/s
    const targetX = -this.camera.vx * 1000 * (config.SWAY_AMPLITUDE / 1000)
    const targetR = Math.max(-config.SWAY_ROTATION, Math.min(config.SWAY_ROTATION, -this.camera.vx * 1000 * (config.SWAY_ROTATION / 600)))
    const k = 1 - Math.exp((-config.SWAY_SMOOTH * dt) / 1000)
    this.sway.x += (targetX - this.sway.x) * k
    this.sway.r += (targetR - this.sway.r) * k
    if (Math.abs(this.sway.x) > 0.05 || speed > 1) active = true

    this.measureClears()
    this.syncDom()
    this.render()

    if (active) {
      this.raf = requestAnimationFrame(this.frame)
    } else {
      this.running = false
      // Drying continues at a low cadence while idle.
      this.idleTimer = window.setTimeout(() => {
        this.idleTimer = 0
        this.lastFrame = performance.now()
        this.ink.step(0.25, null)
        this.render()
        if (!this.destroyed) this.idleTimer = window.setTimeout(() => this.wake(), 250)
      }, 250)
    }
  }

  private syncDom() {
    const layer = this.els.textLayer
    layer.style.transform = `translate3d(${(-this.camera.left).toFixed(2)}px, ${(-this.camera.top).toFixed(2)}px, 0)`
    const reduced = session.get().reducedMotion
    layer.style.setProperty('--sway-x', reduced ? '0px' : `${this.sway.x.toFixed(2)}px`)
    layer.style.setProperty('--sway-r', reduced ? '0deg' : `${this.sway.r.toFixed(3)}deg`)
    layer.style.setProperty('--open', (this.revealAll && this.open <= 0 ? 1 : this.open).toFixed(3))
  }

  private render() {
    if (this.ink.isLost) return
    const placeUniforms = this.world.places.map((p) => {
      const s = this.places.get(p.n)
      return { x: p.x, y: p.y, radius: config.FORMATION_RADIUS * this.world.short, reveal: s.found ? 0 : s.reveal }
    })
    this.ink.render(
      { x: this.camera.left, y: this.camera.top, w: this.camera.viewW, h: this.camera.viewH },
      this.revealAll && this.open <= 0 ? 1 : this.open,
      placeUniforms,
      this.clears,
    )
  }

  /** Dev/test: render now and read a screen pixel (top-down CSS px). */
  readPixel(sx: number, sy: number): [number, number, number] {
    this.measureClears()
    this.render()
    return this.ink.readPixel(sx, sy)
  }

  getOpen() {
    return this.open
  }
}
