// The territory's single loop: input → physics → camera → places → ink →
// render → DOM sync. Sleeps when nothing moves. Nothing in React runs per
// frame; React only receives place and phase changes through the store.
import { session } from '../app/session'
import { config } from '../gestures/config'
import { Camera } from './camera'
import { blockingLine, buildCrust, CrustState } from './crust'
import { Exit } from './exit'
import { Ink, type ClearBox, type InkAssets, type InkColors } from './ink/ink'
import { MarPhysics, type Slip } from './physics'
import { Places } from './places'
import { Sound } from './sound'
import { territoryStore } from './territoryStore'
import { PointerInput, type DragSample } from './input'
import type { MovementId } from '../content/canon'
import type { Place, Rect, Vec2, World } from './types'
import { fragmentWords } from './reading'
import { hashSeed, rng } from './rng'
import { regionAt } from './world'

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
  /** Live instances (dev/test): there must be exactly one. */
  static live = 0
  readonly world: World
  readonly camera: Camera
  readonly physics: MarPhysics
  readonly places: Places
  readonly ink: Ink
  readonly sound = new Sound()
  readonly exit = new Exit((s) => territoryStore.patch({ exit: s }))
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
  // The title is an event: nothing emerges until it has dissolved.
  private titleEndsAt = 0
  private titlesShown = new Set<MovementId>()
  private deferredArrivals: number[] = []
  // Composure: the current deposits the visitor at a place; leaving takes a deliberate drag.
  private pendingSettle: number | null = null
  private settleTries = 0
  private resting = false
  private departAccum = 0
  /** The stamp lands with a short dip of the viewpoint. */
  private dipStart = -Infinity
  // Tierra's crust: fracture lines that block the way up until broken by insistence.
  private crust: CrustState | null = null
  private crustSvg: SVGSVGElement | null = null
  private crustDirty = true
  private screenH = 1
  // Active help: holding the finger still gathers the grain toward the nearest unfound place.
  private holdStart: number | null = null
  private holdMoved = 0
  private help = 0 // 0..1, rises while invoked, falls after
  // The cost of finding.
  private dirt = 0
  // The look back: a brief pull-back when a threshold is first crossed upward.
  private lookback: { start: number; k: number; threshold: number } | null = null
  private lookedBack = new Set<string>()
  private zoom = 1
  private pendingTitle: MovementId | null = null

  constructor(els: TerritoryElements, opts: TerritoryOptions) {
    Territory.live += 1
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
    const tierra = this.world.regions.find((r) => r.id === 'tierra')
    if (tierra) {
      this.screenH = tierra.rect.h / config.TIERRA_SCREENS_H
      const avoid = this.world.places.filter((p) => p.region === 'tierra').map((p) => p.y)
      this.crust = new CrustState(buildCrust(tierra.rect, this.screenH, this.world.cycle, avoid))
      this.buildCrustSvg()
    }
    this.resize()
    this.input.attach(els.stage, {
      onStart: (s) => this.onStart(s),
      onMove: (s, prev) => this.onMove(s, prev),
      onEnd: () => this.onEnd(),
      onCancel: () => this.onEnd(),
    })
    window.addEventListener('resize', this.onResize)
    els.stage.addEventListener('wheel', this.onWheel, { passive: false })
    for (const p of this.world.places) territoryStore.setPlace(this.places.get(p.n))
    territoryStore.patch({ world: this.world, revealAll: this.revealAll })
    this.syncDom()
    this.render()
  }

  private readonly onResize = () => this.resize()

  /** Desktop: the wheel or trackpad drifts the viewpoint along the channel. No smear without a finger. */
  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (territoryStore.get().phase !== 'territory' || this.glide) return
    const dy = e.deltaY * config.WHEEL_GAIN
    if (this.resting) {
      this.departAccum += Math.abs(dy)
      if (this.departAccum < config.DEPART_PX) return
      this.resting = false
    }
    this.physics.touchStart(performance.now())
    const yBefore = this.camera.y
    this.camera.moveBy(0, dy)
    this.applyCrustFloor(yBefore, true)
    this.physics.touchEnd(performance.now())
    this.wake()
  }

  /**
   * A standing fracture line holds the viewpoint below it: the way up is closed until it breaks.
   * When the visitor is pushing (a drag or the wheel), the blocked push damages the line: insistence.
   */
  private applyCrustFloor(yBefore: number, pushing = false) {
    if (!this.crust) return
    const block = blockingLine(this.crust.crust, yBefore, this.screenH)
    if (block && this.camera.y < block.limit) {
      const blocked = block.limit - this.camera.y
      this.camera.y = block.limit
      if (this.camera.vy < 0) this.camera.vy = 0
      if (pushing && this.crust.push(block.line, blocked, performance.now())) {
        this.crustDirty = true
        if (block.line.broken) this.onLineBroken()
      }
    }
  }

  /** A line gives way: a short vibration and a low note, if available. */
  private onLineBroken() {
    if (!session.get().reducedMotion && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(30)
      } catch {
        // unsupported
      }
    }
    this.sound.stamp(this.height() * 0.5)
  }

  private buildCrustSvg() {
    if (!this.crust) return
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('class', 'crust')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', String(this.world.width))
    svg.setAttribute('height', String(this.world.height))
    const add = (g: Element, cls: string, d: string) => {
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', d)
      path.setAttribute('class', cls)
      g.appendChild(path)
    }
    for (const line of this.crust.crust.lines) {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('class', 'crust__line')
      const shape = this.fracture(line.y, line.seed)
      add(g, 'crust__halo', shape.center)
      add(g, 'crust__body', shape.body)
      for (const branch of shape.branches) add(g, 'crust__body', branch)
      add(g, 'crust__crack', shape.center)
      svg.appendChild(g)
    }
    this.els.textLayer.insertBefore(svg, this.els.textLayer.firstChild)
    this.crustSvg = svg
  }

  /**
   * A fracture across the channel, seeded: a centreline that advances in
   * irregular steps with sudden kinks, a body whose thickness swells and
   * thins, and a few short tapered branches. Broken, not smooth.
   */
  private fracture(y: number, seed: number): { center: string; body: string; branches: string[] } {
    const random = rng(hashSeed('fracture', this.world.cycle, seed))
    const w = this.world.width
    const maxOff = this.screenH * 0.045
    const pts: Array<{ x: number; y: number; t: number }> = []
    let x = -8
    let off = 0
    let thick = 4
    while (x < w + 8) {
      pts.push({ x, y: y + off, t: thick })
      x += 5 + random() * 18
      const kink = random() < 0.16
      off += (random() - 0.5) * (kink ? 26 : 7)
      off -= off * 0.08 // drift back toward the line
      off = Math.max(-maxOff, Math.min(maxOff, off))
      thick = Math.max(1.2, Math.min(9, thick + (random() - 0.5) * 3.2))
    }
    const f = (n: number) => n.toFixed(1)
    const center = 'M' + pts.map((p) => `${f(p.x)},${f(p.y)}`).join(' L')
    const upper = pts.map((p) => `${f(p.x)},${f(p.y - p.t / 2)}`)
    const lower = pts.map((p) => `${f(p.x)},${f(p.y + p.t / 2)}`).reverse()
    const body = `M${upper.join(' L')} L${lower.join(' L')} Z`
    const branches: string[] = []
    const count = 2 + Math.floor(random() * 3)
    for (let i = 0; i < count; i++) {
      const base = pts[Math.floor(random() * pts.length)]!
      const dir = random() < 0.5 ? -1 : 1
      const len = 18 + random() * 46
      const ang = (random() - 0.5) * 1.6
      const ex = base.x + Math.sin(ang) * len
      const ey = base.y + dir * Math.cos(ang) * len
      const mx = (base.x + ex) / 2 + (random() - 0.5) * 10
      const my = (base.y + ey) / 2 + (random() - 0.5) * 6
      const t = Math.max(1, base.t * 0.6)
      branches.push(`M${f(base.x - t)},${f(base.y)} L${f(mx)},${f(my)} L${f(ex)},${f(ey)} L${f(mx + 0.8)},${f(my + 0.4)} L${f(base.x + t)},${f(base.y)} Z`)
    }
    return { center, body, branches }
  }

  private syncCrustSvg() {
    if (!this.crust || !this.crustSvg || !this.crustDirty) return
    this.crustDirty = false
    const groups = this.crustSvg.querySelectorAll<SVGGElement>('.crust__line')
    this.crust.crust.lines.forEach((line, i) => {
      const g = groups[i]
      if (!g) return
      g.style.setProperty('--damage', (1 - line.integrity).toFixed(3))
      if (line.broken) g.setAttribute('data-broken', '')
      else g.removeAttribute('data-broken')
    })
  }

  /** Dev/test: the crust lines (y, integrity, broken). */
  crustLines() {
    return this.crust ? this.crust.crust.lines.map((l) => ({ y: l.y, integrity: l.integrity, broken: l.broken })) : []
  }

  /** Dev/test: one screen height in world px. */
  screenHeight() {
    return this.screenH
  }

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
    Territory.live -= 1
    this.destroyed = true
    this.input.detach()
    window.removeEventListener('resize', this.onResize)
    this.els.stage.removeEventListener('wheel', this.onWheel)
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
    this.showTitle(regionAt(this.world, this.camera.y).id, now)
  }

  /** The title is an event: it appears alone on entering a region and dissolves before any place can emerge. */
  private showTitle(region: MovementId, now: number) {
    if (this.titlesShown.has(region)) return
    this.titlesShown.add(region)
    this.titleEndsAt = now + config.TITLE_IN_MS + config.TITLE_HOLD_MS + config.TITLE_OUT_MS
    territoryStore.setTitle({ region, startedAt: now })
  }

  get titleActive() {
    return performance.now() < this.titleEndsAt
  }

  // --- input ------------------------------------------------------------------

  /** The cover dissolves into the epigraph. */
  dismissCover() {
    if (territoryStore.get().phase !== 'cover') return
    territoryStore.patch({ phase: 'epigraph' })
    this.wake()
  }

  private onStart(s: DragSample) {
    const now = performance.now()
    const phase = territoryStore.get().phase
    if (phase === 'cover') {
      // A touch on the cover only dissolves it: no mark yet.
      this.sound.unlock()
      this.dismissCover()
      return
    }
    // The exit: a touch during the dissolution cancels it; after it nothing moves the world.
    const stage = this.exit.current
    if (stage !== 'idle') {
      this.exit.touch(now)
      this.wake()
      if (stage !== 'dwelling') return
    }
    this.glide = null
    this.pendingSettle = null
    this.sound.unlock()
    if (phase === 'epigraph') this.openTerritory(now)
    this.departAccum = 0
    this.holdStart = now
    this.holdMoved = 0
    this.crust?.strokeStart()
    if (!this.resting) this.physics.touchStart(now)
    this.lastDragT = s.t
    this.sound.noteOn(this.height())
    this.wake()
  }

  private onMove(s: DragSample, prev: DragSample) {
    if (territoryStore.get().phase === 'cover') return
    if (this.lookback) return
    const stage = this.exit.current
    if (stage !== 'idle' && stage !== 'dwelling') return
    if (stage === 'dwelling') this.exit.touch(s.t)
    this.holdMoved += Math.hypot(s.x - prev.x, s.y - prev.y)
    if (this.holdMoved > config.HOLD_TOLERANCE_PX) this.holdStart = null
    const dt = Math.max(1, s.t - prev.t)
    if (this.resting) {
      // At a place the world is still: a stray touch does not move it. A deliberate drag does.
      this.departAccum += Math.hypot(s.x - prev.x, s.y - prev.y)
      if (this.departAccum < config.DEPART_PX) return
      this.resting = false
      this.physics.touchStart(s.t)
    }
    const yBefore = this.camera.y
    const slip = this.physics.drag(s.x, s.y, s.x - prev.x, s.y - prev.y, dt, s.t)
    // Tierra: a finger stroke that crosses a fracture line damages it; a standing line holds the way up.
    if (this.crust) {
      const hit = this.crust.strokeSegment(slip.from, slip.to, s.t)
      if (hit.length > 0) {
        this.crustDirty = true
        if (hit.some((l) => l.broken)) this.onLineBroken()
      }
      this.applyCrustFloor(yBefore, true)
    }
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
    if (territoryStore.get().phase === 'cover') return
    this.holdStart = null
    this.crust?.strokeEnd(performance.now())
    if (!this.resting) this.physics.touchEnd(performance.now())
    this.sound.noteOff()
    this.wake()
  }

  /** 0 at the bottom of the territory, 1 at the top (the sound's register). */
  private height(): number {
    return 1 - Math.max(0, Math.min(1, this.camera.y / this.world.height))
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
    this.dipStart = performance.now()
    this.ink.bake(place, config.FORMATION_RADIUS * this.world.short)
    // The cost of finding: the ground scars around the place, the hands get dirtier.
    if (config.SCAR_STRENGTH > 0) this.ink.scar(place)
    this.dirt += 1
    this.onStampCb?.(place)
    // The current deposits the visitor: come to rest with the whole text block and the seal in view.
    // Not while a glide is in flight: the linear path settles at its own destination.
    if (!this.glide) this.settleAt(place.n)
    this.wake()
  }

  /** Measure the mounted place (text + seal) and glide so it sits inside the safe margins. */
  private trySettle(now: number) {
    const n = this.pendingSettle
    if (n === null) return
    const el = this.els.stage.querySelector<HTMLElement>(`.place[data-n="${n}"]`)
    const seal = el?.querySelector<HTMLElement>('.place__seal')
    const text = el?.querySelector<HTMLElement>('[data-canon="fragment"]')
    const exitTally = n === 22 ? this.els.stage.querySelector<HTMLElement>('.exit-tally') : null
    if (!el || !text || (!seal && this.settleTries < 12) || (n === 22 && !exitTally && this.settleTries < 12)) {
      this.settleTries++
      return
    }
    this.pendingSettle = null
    const stage = this.els.stage.getBoundingClientRect()
    const rects = [text.getBoundingClientRect(), ...(seal ? [seal.getBoundingClientRect()] : []), ...(exitTally ? [exitTally.getBoundingClientRect()] : [])]
    const left = Math.min(...rects.map((r) => r.left)) - stage.left
    const right = Math.max(...rects.map((r) => r.right)) - stage.left
    const top = Math.min(...rects.map((r) => r.top)) - stage.top
    const bottom = Math.max(...rects.map((r) => r.bottom)) - stage.top
    const m = config.SAFE_MARGIN_PX
    let dx = 0
    let dy = 0
    if (right - left > this.camera.viewW - 2 * m) {
      // The block cannot fit with both margins: centre it, the text keeps its margins first.
      dx = (left + right) / 2 - this.camera.viewW / 2
    } else if (left < m) dx = left - m
    else if (right > this.camera.viewW - m) dx = right - (this.camera.viewW - m)
    if (top < m) dy = top - m
    else if (bottom > this.camera.viewH - m) dy = bottom - (this.camera.viewH - m)
    // Prefer centring the block vertically when there is room.
    const blockH = bottom - top
    if (blockH < this.camera.viewH - 2 * m) {
      const wantTop = (this.camera.viewH - blockH) / 2
      dy = top - wantTop
    }
    const reduced = session.get().reducedMotion
    const from = { x: this.camera.x, y: this.camera.y }
    const to = { x: this.camera.x + dx, y: this.camera.y + dy }
    this.glide = {
      from,
      to,
      start: now,
      duration: reduced ? 0 : config.SETTLE_MS,
      onDone: () => {
        this.resting = true
        // Fragment 22 is the exit: at rest there, the reading dwell begins.
        const exitPlace = this.world.places.find((p) => p.n === 22)
        if (exitPlace && n === exitPlace.n) this.exit.arrive(performance.now(), fragmentWords(exitPlace.fragment))
      },
    }
  }

  // --- linear path -------------------------------------------------------------

  /** Glide the viewpoint to a world point (instant with reduced motion). Waits for a title event to end. */
  glideTo(to: Vec2, onDone?: () => void) {
    const now = performance.now()
    // The linear path may travel before the territory is open: the cover dissolves and the white opens.
    const phase = territoryStore.get().phase
    if (phase !== 'territory') {
      if (phase === 'cover') this.dismissCover()
      this.openTerritory(now)
    }
    this.camera.vx = 0
    this.camera.vy = 0
    this.resting = false
    this.pendingSettle = null
    const reduced = session.get().reducedMotion
    const start = Math.max(now, this.titleEndsAt)
    this.glide = { from: { x: this.camera.x, y: this.camera.y }, to, start, duration: reduced ? 0 : config.GLIDE_MS, onDone }
    this.wake()
  }

  /** Arrive at a place through the linear path. Deferred while a title is on screen. */
  arriveAt(n: number) {
    if (this.titleActive) {
      if (!this.deferredArrivals.includes(n)) this.deferredArrivals.push(n)
      this.wake()
      return
    }
    this.places.arrive(n, performance.now())
    this.settleAt(n)
    this.wake()
  }

  /** Stillness: the world does not move until a deliberate drag. */
  rest() {
    this.camera.vx = 0
    this.camera.vy = 0
    this.resting = true
  }

  /** Come to rest at a place (even one stamped earlier, or stamped while gliding in). */
  settleAt(n: number) {
    this.camera.vx = 0
    this.camera.vy = 0
    this.pendingSettle = n
    this.settleTries = 0
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
    try {
      this.tick(now)
    } catch (err) {
      // A frame must never kill the loop. Log once per second at most.
      if (now - this.lastErrorAt > 1000) {
        console.error('[territory] frame error', err)
        this.lastErrorAt = now
      }
      this.running = false
      this.idleTimer = window.setTimeout(() => this.wake(), 250)
    }
  }

  private lastErrorAt = -Infinity

  private tick(now: number) {
    const dt = Math.min(64, Math.max(1, now - this.lastFrame))
    this.lastFrame = now
    let active = false

    // Opening.
    if (this.opening) {
      this.open = Math.min(1, (now - this.openStart) / Math.max(1, config.OPEN_MS))
      if (this.open >= 1) this.opening = false
      active = true
    }

    // The title event ends: remove it, release deferred arrivals.
    const title = territoryStore.get().title
    if (title && now >= this.titleEndsAt) {
      territoryStore.setTitle(null)
      for (const n of this.deferredArrivals.splice(0)) this.places.arrive(n, now)
    }
    if (title) active = true

    // Settle at a stamped place once its text and seal are mounted.
    if (this.pendingSettle !== null) {
      this.trySettle(now)
      active = true
    }

    // The exit: dwell, stillness, dissolution (the territory whitens), the Return.
    if (this.exit.current !== 'idle') {
      if (this.exit.tick(now, this.input.down, session.get().keyboardUser)) active = true
      if (this.exit.current === 'dwelling' || this.exit.current === 'dissolving') this.open = 1 - this.exit.whiteness
      else this.open = 0
      if (this.exit.current === 'dwelling') active = true
    }

    // Glide (linear path or settle), stillness at a place, or physics.
    if (this.glide) {
      const g = this.glide
      if (now < g.start) {
        active = true
      } else {
        const t = g.duration > 0 ? Math.min(1, (now - g.start) / g.duration) : 1
        const e = 1 - Math.pow(1 - t, 3)
        this.camera.x = g.from.x + (g.to.x - g.from.x) * e
        this.camera.y = g.from.y + (g.to.y - g.from.y) * e
        this.camera.clamp()
        if (t >= 1) {
          this.glide = null
          g.onDone?.()
        } else active = true
      }
    } else if (this.resting || this.lookback) {
      // Stillness at the place, or the look back: nothing moves until a deliberate drag.
    } else if (this.input.down) {
      active = true
    } else {
      const nearest = this.physics.helpBias > 0 ? this.places.nearestUnfound({ x: this.camera.x, y: this.camera.y }) : null
      const yBefore = this.camera.y
      if (this.physics.step(dt, now, nearest)) active = true
      this.applyCrustFloor(yBefore)
    }

    // The crust heals slowly where it still stands.
    if (this.crust && this.crust.tick(now, dt)) {
      this.crustDirty = true
      active = true
    }

    // Active help: hold the finger still to gather the grain toward the nearest unfound place.
    const invoked = this.holdStart !== null && this.input.down && now - this.holdStart >= config.HOLD_HELP_MS
    const helpTarget = invoked ? 1 : 0
    const helpRate = dt / Math.max(1, invoked ? config.HELP_RISE_MS : config.HELP_FALL_MS)
    const prevHelp = this.help
    this.help = helpTarget > this.help ? Math.min(1, this.help + helpRate) : Math.max(0, this.help - helpRate)
    if (this.help !== prevHelp || this.holdStart !== null) active = true
    this.physics.helpBias = config.MAR_HELP_BIAS + (config.MAR_HELP_ACTIVE_BIAS - config.MAR_HELP_BIAS) * this.help

    // Entering a region is a title event; crossing a threshold upward for the first
    // time is a look back down the channel just crossed.
    const region = regionAt(this.world, this.camera.y).id
    const previous = territoryStore.get().region
    if (previous !== region) {
      territoryStore.patch({ region })
      const crossed = this.world.thresholds.findIndex((t) => t.from === previous && t.to === region)
      // Only the visitor's own crossing looks back; a glide of the linear path does not.
      if (crossed >= 0 && !this.glide && !this.lookedBack.has(previous) && config.LOOKBACK_ZOOM > 0 && config.LOOKBACK_MS > 0 && !session.get().reducedMotion) {
        this.lookedBack.add(previous)
        this.lookback = { start: now, k: 0, threshold: crossed }
        this.camera.vx = 0
        this.camera.vy = 0
        // The new region's title waits for the look back to end.
        this.pendingTitle = region
      } else {
        this.showTitle(region, now)
      }
    }

    // The look back: zoom out over the channel just crossed, hold, zoom in. Nothing else moves meanwhile.
    if (this.lookback) {
      const t = (now - this.lookback.start) / Math.max(1, config.LOOKBACK_MS)
      if (t >= 1) {
        this.lookback = null
        this.zoom = 1
        if (this.pendingTitle) {
          this.showTitle(this.pendingTitle, now)
          this.pendingTitle = null
        }
      } else {
        const ease = (x: number) => 1 - Math.pow(1 - x, 3)
        const k = t < 0.28 ? ease(t / 0.28) : t > 0.72 ? 1 - ease((t - 0.72) / 0.28) : 1
        this.zoom = 1 + (config.LOOKBACK_ZOOM - 1) * k
        this.lookback.k = k
        active = true
      }
    }

    if (now - this.dipStart < config.STAMP_DIP_MS + 50) active = true

    // Places: nothing emerges while a title is on screen.
    if ((this.open > 0 || this.revealAll) && !this.titleActive) {
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
    this.ink.step(dt / 1000, brush, this.dirt, this.viewRect())
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
        this.ink.step(0.25, null, this.dirt, this.viewRect())
        this.render()
        if (!this.destroyed) this.idleTimer = window.setTimeout(() => this.wake(), 250)
      }, 250)
    }
  }

  /** Current dip offset in px (down, then back), zero outside the stamp moment or with reduced motion. */
  private dip(now: number): number {
    if (session.get().reducedMotion || config.STAMP_DIP_PX <= 0) return 0
    const t = (now - this.dipStart) / Math.max(1, config.STAMP_DIP_MS)
    if (t < 0 || t >= 1) return 0
    return Math.sin(t * Math.PI) * config.STAMP_DIP_PX
  }

  /** The viewpoint's centre, shifted down the channel while looking back (the band near the top of the view). */
  private viewCentre(): Vec2 {
    const lb = this.lookback
    const band = lb ? this.world.thresholds[lb.threshold]?.band : undefined
    if (!lb || !band || this.zoom >= 1) return { x: this.camera.x, y: this.camera.y }
    const visibleH = this.camera.viewH / this.zoom
    const lookY = band.y - band.h * 0.5 + visibleH * 0.5 - this.camera.viewH * 0.12
    return { x: this.camera.x, y: this.camera.y + (lookY - this.camera.y) * lb.k }
  }

  private syncDom() {
    const layer = this.els.textLayer
    const dip = this.dip(performance.now())
    const z = this.zoom
    if (z === 1) {
      layer.style.transform = `translate3d(${(-this.camera.left).toFixed(2)}px, ${(-(this.camera.top + dip)).toFixed(2)}px, 0)`
    } else {
      const c = this.viewCentre()
      const cx = this.camera.viewW / 2
      const cy = this.camera.viewH / 2
      layer.style.transform = `translate(${cx}px, ${cy}px) scale(${z.toFixed(4)}) translate(${(-c.x).toFixed(2)}px, ${(-(c.y + dip)).toFixed(2)}px)`
    }
    const reduced = session.get().reducedMotion
    layer.style.setProperty('--sway-x', reduced ? '0px' : `${this.sway.x.toFixed(2)}px`)
    layer.style.setProperty('--sway-r', reduced ? '0deg' : `${this.sway.r.toFixed(3)}deg`)
    layer.style.setProperty('--open', (this.revealAll && this.open <= 0 ? 1 : this.open).toFixed(3))
    this.syncCrustSvg()
    this.syncShear(reduced)
    this.syncThinning()
  }

  /** Cielo: the text's ink thins with height, never below the contrast floor. */
  private syncThinning() {
    const cielo = this.world.regions.find((r) => r.id === 'cielo')?.rect
    if (!cielo) return
    const min = Math.max(0, Math.min(1, config.CIELO_TEXT_MIN_ALPHA))
    for (const el of this.els.textLayer.querySelectorAll<HTMLElement>('.place[data-region="cielo"]')) {
      const y = Number(el.dataset.y)
      const height = 1 - Math.max(0, Math.min(1, (y - cielo.y) / cielo.h)) // 0 at Cielo's floor, 1 at its top
      el.style.setProperty('--thin', (1 - (1 - min) * height).toFixed(3))
    }
  }

  /** Tierra: a text block shears along the damaged line nearest to it. */
  private syncShear(reduced: boolean) {
    if (!this.crust) return
    const lines = this.crust.crust.lines
    for (const el of this.els.textLayer.querySelectorAll<HTMLElement>('.place[data-region="tierra"]')) {
      const y = Number(el.dataset.y)
      let shear = 0
      for (const line of lines) {
        const d = Math.abs(line.y - y)
        if (d > this.screenH * 0.8) continue
        const damage = line.broken ? 1 : 1 - line.integrity
        const s = damage * (1 - d / (this.screenH * 0.8)) * config.TIERRA_SHEAR_DEG * (line.y < y ? -1 : 1)
        if (Math.abs(s) > Math.abs(shear)) shear = s
      }
      el.style.setProperty('--shear', reduced ? '0deg' : `${shear.toFixed(2)}deg`)
    }
  }

  private render() {
    if (this.ink.isLost) return
    const placeUniforms = this.world.places.map((p) => {
      const s = this.places.get(p.n)
      return { x: p.x, y: p.y, radius: config.FORMATION_RADIUS * this.world.short, reveal: s.found ? 0 : s.reveal }
    })
    const bias = this.physics.helpBias
    const nearest = bias > 0 ? this.places.nearestUnfound({ x: this.camera.x, y: this.camera.y }) : null
    const help = nearest ? { x: nearest.x, y: nearest.y, bias, boost: config.GRAIN_HELP_BOOST * this.help } : null
    const now = performance.now()
    if (now - this.dipStart < config.STAMP_DIP_MS + 50) this.wake()
    const z = this.zoom
    const w = this.camera.viewW / z
    const h = this.camera.viewH / z
    const c = this.viewCentre()
    this.ink.render(
      { x: c.x - w / 2, y: c.y + this.dip(now) - h / 2, w, h },
      this.revealAll && this.open <= 0 ? 1 : this.open,
      placeUniforms,
      this.clears,
      help,
    )
  }

  /** The camera rect in world px, widened so neighbouring regions keep simulating near a threshold. */
  private viewRect(): Rect {
    const margin = this.camera.viewH * 0.5
    return { x: this.camera.left, y: this.camera.top - margin, w: this.camera.viewW, h: this.camera.viewH + 2 * margin }
  }

  /** The linear path at the exit: step the Return without stillness. */
  advanceReturn() {
    const now = performance.now()
    if (this.exit.current === 'idle') {
      const exitPlace = this.world.places.find((p) => p.n === 22)
      if (exitPlace) this.exit.arrive(now, fragmentWords(exitPlace.fragment))
    }
    this.exit.advance(now)
    this.wake()
  }

  /** Dev/test: strength of the invoked help (0..1). */
  helpStrength() {
    return this.help
  }

  /** Dev/test: stamps so far (dirty hands). */
  dirtLevel() {
    return this.dirt
  }

  /** Dev/test: whether the look back is playing, and the current zoom. */
  isLookingBack() {
    return this.lookback !== null
  }

  currentZoom() {
    return this.zoom
  }

  /** Dev/test: whether the viewpoint is at rest at a place. */
  isResting() {
    return this.resting
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
