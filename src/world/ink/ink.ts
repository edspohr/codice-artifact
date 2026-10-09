// The ink field: ground, smear simulation and composite, in WebGL1.
// One simulation per region (four stay resident) at SIM_SCALE of world px;
// only the regions that touch the view are stepped and drawn. Nothing here
// touches React; the loop drives it.
import type { MovementId } from '../../content/canon'
import { config } from '../../gestures/config'
import type { Place, Rect, World } from '../types'
import { bindTexture, createProgram, createQuad, createTexture, drawQuad, PingPong, type Program, type Target } from './gl'
import { NOISE_SIZE, noiseTextureData } from './noise'
import { ADVECT_FRAG, BAKE_FRAG, COMPOSITE_FRAG, GROUND_FRAG, SCAR_FRAG, VEL_FRAG, VERT } from './shaders'

const VEL_MAX = 900 // texels per second, the encoding range of the velocity texture

export interface ClearBox {
  cx: number
  cy: number
  hw: number
  hh: number
}

export interface PlaceUniform {
  x: number
  y: number
  radius: number
  reveal: number
}

export interface InkColors {
  paper: [number, number, number]
  ink: [number, number, number]
  accent: [number, number, number]
}

export interface InkAssets {
  grounds: Map<MovementId, HTMLImageElement>
  formations: Map<number, HTMLImageElement>
}

export interface Brush {
  ax: number
  ay: number
  bx: number
  by: number
  vx: number
  vy: number
}

export interface HelpUniform {
  x: number
  y: number
  bias: number
  boost: number
}

interface RegionSim {
  id: MovementId
  rect: Rect
  ground: PingPong
  density: PingPong
  vi: PingPong
  simW: number
  simH: number
}

export class Ink {
  readonly gl: WebGLRenderingContext
  private quad: WebGLBuffer
  private progGround: Program
  private progBake: Program
  private progScar: Program
  private progVel: Program
  private progAdvect: Program
  private progComposite: Program
  private noise: WebGLTexture
  private groundImg = new Map<MovementId, WebGLTexture>()
  private formTex = new Map<number, WebGLTexture>()
  private sims: RegionSim[] = []
  private lost = false
  readonly canvas: HTMLCanvasElement
  private world: World
  private colors: InkColors

  constructor(canvas: HTMLCanvasElement, world: World, assets: InkAssets, colors: InkColors) {
    this.canvas = canvas
    this.world = world
    this.colors = colors
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false })
    if (!gl) throw new Error('webgl unavailable')
    this.gl = gl
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.lost = true
    })
    this.quad = createQuad(gl)
    this.progGround = createProgram(gl, VERT, GROUND_FRAG, ['uImage', 'uWorld', 'uRegion'])
    this.progBake = createProgram(gl, VERT, BAKE_FRAG, ['uBase', 'uImage', 'uWorld', 'uPlace'])
    this.progScar = createProgram(gl, VERT, SCAR_FRAG, ['uBase', 'uNoise', 'uWorld', 'uScar', 'uStrength', 'uNoiseScale'])
    this.progVel = createProgram(gl, VERT, VEL_FRAG, [
      'uVI', 'uSim', 'uDt', 'uVelDecay', 'uVelMax', 'uBrushOn', 'uBrush', 'uBrushVel', 'uBrushRadius', 'uBrushStrength', 'uInsRate', 'uInsDecay',
    ])
    this.progAdvect = createProgram(gl, VERT, ADVECT_FRAG, [
      'uDensity', 'uVI', 'uGround', 'uSim', 'uDt', 'uVelMax', 'uDryRate', 'uBrushOn', 'uBrush', 'uBrushRadius', 'uFurrow', 'uDeposit',
    ])
    this.progComposite = createProgram(gl, VERT, COMPOSITE_FRAG, [
      'uDensity', 'uGround', 'uVI', 'uNoise', 'uForm0', 'uForm1', 'uForm2', 'uForm3',
      'uPlace[0]', 'uView', 'uWorld', 'uOpen', 'uPaper', 'uInk', 'uAccentColor', 'uAccent',
      'uClear[0]', 'uClearCount', 'uClearParams', 'uClearResidual', 'uNoiseScale', 'uHelp', 'uGrain', 'uShort', 'uBandA', 'uBandB',
    ])
    this.noise = createTexture(gl, NOISE_SIZE, NOISE_SIZE, noiseTextureData(), gl.REPEAT)
    for (const [id, img] of assets.grounds) this.groundImg.set(id, createTexture(gl, 0, 0, img))
    for (const [n, img] of assets.formations) this.formTex.set(n, createTexture(gl, 0, 0, img))

    const scale = Math.max(0.05, Math.min(1, config.SIM_SCALE))
    for (const region of world.regions) {
      const simW = Math.min(2048, Math.max(8, Math.round(region.rect.w * scale)))
      const simH = Math.min(2048, Math.max(8, Math.round(region.rect.h * scale)))
      const sim: RegionSim = {
        id: region.id,
        rect: region.rect,
        ground: new PingPong(gl, simW, simH),
        density: new PingPong(gl, simW, simH),
        vi: new PingPong(gl, simW, simH),
        simW,
        simH,
      }
      this.sims.push(sim)
      this.initGround(sim)
      this.initVI(sim)
    }
  }

  get isLost() {
    return this.lost
  }

  /** Simulation sizes per region (dev/test). */
  get simSizes() {
    return this.sims.map((s) => ({ id: s.id, w: s.simW, h: s.simH }))
  }

  private regionVec(sim: RegionSim): [number, number, number, number] {
    return [sim.rect.x, sim.rect.y, sim.rect.w, sim.rect.h]
  }

  private simFor(y: number): RegionSim | null {
    for (const s of this.sims) if (y >= s.rect.y && y < s.rect.y + s.rect.h) return s
    return null
  }

  private simsTouching(view: Rect): RegionSim[] {
    return this.sims.filter((s) => view.y < s.rect.y + s.rect.h && view.y + view.h > s.rect.y)
  }

  private target(t: Target) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
    gl.viewport(0, 0, t.width, t.height)
  }

  private initGround(sim: RegionSim) {
    const gl = this.gl
    const img = this.groundImg.get(sim.id)
    for (const pp of [sim.ground, sim.density]) {
      this.target(pp.read)
      if (!img) {
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        continue
      }
      gl.useProgram(this.progGround.program)
      bindTexture(gl, 0, img, this.progGround.uniforms.uImage ?? null)
      gl.uniform4f(this.progGround.uniforms.uWorld ?? null, ...this.regionVec(sim))
      gl.uniform4f(this.progGround.uniforms.uRegion ?? null, ...this.regionVec(sim))
      drawQuad(gl, this.quad, this.progGround.attrib)
    }
  }

  private initVI(sim: RegionSim) {
    const gl = this.gl
    this.target(sim.vi.read)
    gl.clearColor(0.5, 0.5, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.target(sim.vi.write)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** A stamped place becomes part of the ground: from now on it can be smeared and it dries like the rest. */
  bake(place: Place, radius: number) {
    const gl = this.gl
    const img = this.formTex.get(place.n)
    const sim = this.simFor(place.y)
    if (!img || !sim) return
    for (const pp of [sim.ground, sim.density]) {
      this.target(pp.write)
      gl.useProgram(this.progBake.program)
      bindTexture(gl, 0, pp.read.tex, this.progBake.uniforms.uBase ?? null)
      bindTexture(gl, 1, img, this.progBake.uniforms.uImage ?? null)
      gl.uniform4f(this.progBake.uniforms.uWorld ?? null, ...this.regionVec(sim))
      gl.uniform3f(this.progBake.uniforms.uPlace ?? null, place.x, place.y, radius)
      drawQuad(gl, this.quad, this.progBake.attrib)
      pp.swap()
    }
  }

  /** The cost of finding: scar the ground (and the current ink) around a stamped place. */
  scar(place: Place) {
    const gl = this.gl
    const short = this.world.short
    const sim = this.simFor(place.y)
    if (!sim) return
    for (const pp of [sim.ground, sim.density]) {
      this.target(pp.write)
      gl.useProgram(this.progScar.program)
      bindTexture(gl, 0, pp.read.tex, this.progScar.uniforms.uBase ?? null)
      bindTexture(gl, 1, this.noise, this.progScar.uniforms.uNoise ?? null)
      gl.uniform4f(this.progScar.uniforms.uWorld ?? null, ...this.regionVec(sim))
      gl.uniform4f(this.progScar.uniforms.uScar ?? null, place.x, place.y, config.SCAR_RADIUS * short, config.SCAR_WIDTH * short)
      gl.uniform1f(this.progScar.uniforms.uStrength ?? null, config.SCAR_STRENGTH)
      gl.uniform1f(this.progScar.uniforms.uNoiseScale ?? null, short * 0.5)
      drawQuad(gl, this.quad, this.progScar.attrib)
      pp.swap()
    }
  }

  /**
   * One simulation step for the regions touching `view`. `brush` is the
   * finger's slip segment in world px with its velocity in world px/s, or
   * null when nothing is touching. `dirt` is the number of stamps so far.
   */
  step(dtSeconds: number, brush: Brush | null, dirt: number, view: Rect) {
    const dt = Math.min(0.05, Math.max(0.0005, dtSeconds))
    for (const sim of this.simsTouching(view)) this.stepRegion(sim, dt, brush, dirt)
  }

  private stepRegion(sim: RegionSim, dt: number, brush: Brush | null, dirt: number) {
    const gl = this.gl
    const sx = sim.simW / sim.rect.w
    const sy = sim.simH / sim.rect.h
    const local = (x: number, y: number): [number, number] => [(x - sim.rect.x) * sx, (y - sim.rect.y) * sy]
    const u = this.progVel.uniforms

    this.target(sim.vi.write)
    gl.useProgram(this.progVel.program)
    bindTexture(gl, 0, sim.vi.read.tex, u.uVI ?? null)
    gl.uniform2f(u.uSim ?? null, sim.simW, sim.simH)
    gl.uniform1f(u.uDt ?? null, dt)
    gl.uniform1f(u.uVelDecay ?? null, config.VEL_DECAY)
    gl.uniform1f(u.uVelMax ?? null, VEL_MAX)
    gl.uniform1f(u.uBrushOn ?? null, brush ? 1 : 0)
    if (brush) {
      const a = local(brush.ax, brush.ay)
      const b = local(brush.bx, brush.by)
      gl.uniform4f(u.uBrush ?? null, a[0], a[1], b[0], b[1])
      gl.uniform2f(u.uBrushVel ?? null, brush.vx * sx, brush.vy * sy)
    } else {
      gl.uniform4f(u.uBrush ?? null, 0, 0, 0, 0)
      gl.uniform2f(u.uBrushVel ?? null, 0, 0)
    }
    gl.uniform1f(u.uBrushRadius ?? null, config.BRUSH_RADIUS * this.world.short * sx)
    gl.uniform1f(u.uBrushStrength ?? null, config.BRUSH_STRENGTH)
    gl.uniform1f(u.uInsRate ?? null, config.INSISTENCE_RATE * (1 + config.DIRT_ACCENT * dirt))
    gl.uniform1f(u.uInsDecay ?? null, config.INSISTENCE_DECAY)
    drawQuad(gl, this.quad, this.progVel.attrib)
    sim.vi.swap()

    const a = this.progAdvect.uniforms
    this.target(sim.density.write)
    gl.useProgram(this.progAdvect.program)
    bindTexture(gl, 0, sim.density.read.tex, a.uDensity ?? null)
    bindTexture(gl, 1, sim.vi.read.tex, a.uVI ?? null)
    bindTexture(gl, 2, sim.ground.read.tex, a.uGround ?? null)
    gl.uniform2f(a.uSim ?? null, sim.simW, sim.simH)
    gl.uniform1f(a.uDt ?? null, dt)
    gl.uniform1f(a.uVelMax ?? null, VEL_MAX)
    gl.uniform1f(a.uDryRate ?? null, config.INK_DRY_S > 0 ? 1 / config.INK_DRY_S : 0)
    gl.uniform1f(a.uBrushOn ?? null, brush ? 1 : 0)
    if (brush) {
      const p = local(brush.ax, brush.ay)
      const q = local(brush.bx, brush.by)
      gl.uniform4f(a.uBrush ?? null, p[0], p[1], q[0], q[1])
    } else gl.uniform4f(a.uBrush ?? null, 0, 0, 0, 0)
    gl.uniform1f(a.uBrushRadius ?? null, config.BRUSH_RADIUS * this.world.short * sx)
    gl.uniform1f(a.uFurrow ?? null, config.FURROW_STRENGTH)
    gl.uniform1f(a.uDeposit ?? null, Math.min(0.6, config.DIRT_PER_STAMP * dirt))
    drawQuad(gl, this.quad, this.progAdvect.attrib)
    sim.density.swap()
  }

  /**
   * Draw the viewport, one pass per region touching it (scissored to its
   * rows). `view` is the camera rect in world px; `help` is the nearest
   * unfound place with the effective bias and the grain boost.
   */
  render(view: Rect, open: number, places: PlaceUniform[], clears: ClearBox[], help: HelpUniform | null) {
    const gl = this.gl
    const canvas = this.canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.enable(gl.SCISSOR_TEST)
    // Paper everywhere first: beyond the top and the bottom of the world nothing is drawn.
    gl.scissor(0, 0, canvas.width, canvas.height)
    gl.clearColor(this.colors.paper[0], this.colors.paper[1], this.colors.paper[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const pxPerWorld = canvas.height / view.h
    for (const sim of this.simsTouching(view)) {
      // Screen rows of this region (GL's origin is the bottom-left).
      const topPx = Math.max(0, Math.floor((sim.rect.y - view.y) * pxPerWorld))
      const bottomPx = Math.min(canvas.height, Math.ceil((sim.rect.y + sim.rect.h - view.y) * pxPerWorld))
      if (bottomPx <= topPx) continue
      gl.scissor(0, canvas.height - bottomPx, canvas.width, bottomPx - topPx)
      this.composite(sim, view, open, places, clears, help)
    }
    gl.disable(gl.SCISSOR_TEST)
  }

  private composite(sim: RegionSim, view: Rect, open: number, places: PlaceUniform[], clears: ClearBox[], help: HelpUniform | null) {
    const gl = this.gl
    const u = this.progComposite.uniforms
    gl.useProgram(this.progComposite.program)
    bindTexture(gl, 0, sim.density.read.tex, u.uDensity ?? null)
    bindTexture(gl, 1, sim.ground.read.tex, u.uGround ?? null)
    bindTexture(gl, 2, sim.vi.read.tex, u.uVI ?? null)
    bindTexture(gl, 3, this.noise, u.uNoise ?? null)
    // The four nearest revealing places of this region get a formation sampler.
    const formNames = ['uForm0', 'uForm1', 'uForm2', 'uForm3'] as const
    const cx = view.x + view.w / 2
    const cy = view.y + view.h / 2
    const candidates = this.world.places
      .filter((p) => p.region === sim.id)
      .map((p) => ({ p, u: places.find((x) => x.x === p.x && x.y === p.y), d: Math.hypot(p.x - cx, p.y - cy) }))
      .filter((c) => c.u && c.u.reveal > 0)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
    const placeData = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      const c = candidates[i]
      const tex = c ? (this.formTex.get(c.p.n) ?? this.noise) : this.noise
      bindTexture(gl, 4 + i, tex, u[formNames[i] as string] ?? null)
      if (c && c.u) placeData.set([c.p.x, c.p.y, c.u.radius, c.u.reveal], i * 4)
    }
    gl.uniform4fv(u['uPlace[0]'] ?? null, placeData)
    gl.uniform4f(u.uView ?? null, view.x, view.y, view.w, view.h)
    gl.uniform4f(u.uWorld ?? null, ...this.regionVec(sim))
    gl.uniform1f(u.uOpen ?? null, open)
    gl.uniform3f(u.uPaper ?? null, ...this.colors.paper)
    gl.uniform3f(u.uInk ?? null, ...this.colors.ink)
    gl.uniform3f(u.uAccentColor ?? null, ...this.colors.accent)
    gl.uniform1f(u.uAccent ?? null, config.ACCENT_STRENGTH)
    const clearData = new Float32Array(32)
    const count = Math.min(8, clears.length)
    for (let i = 0; i < count; i++) {
      const c = clears[i] as ClearBox
      clearData.set([c.cx, c.cy, c.hw, c.hh], i * 4)
    }
    gl.uniform4fv(u['uClear[0]'] ?? null, clearData)
    gl.uniform1i(u.uClearCount ?? null, count)
    const short = this.world.short
    gl.uniform3f(u.uClearParams ?? null, config.CLEAR_MARGIN * short, config.CLEAR_SOFT * short, config.CLEAR_IRREGULARITY)
    gl.uniform1f(u.uClearResidual ?? null, config.CLEAR_RESIDUAL)
    gl.uniform1f(u.uNoiseScale ?? null, short * 0.9)
    gl.uniform4f(u.uHelp ?? null, help ? help.x : 0, help ? help.y : 0, help ? help.bias : 0, help ? 1 : 0)
    gl.uniform3f(u.uGrain ?? null, config.GRAIN_STRENGTH + (help ? help.boost : 0), config.MAR_CURRENT_WIGGLE, Math.max(50, config.MAR_CURRENT_SCALE))
    gl.uniform1f(u.uShort ?? null, short)
    // The thresholds touching this region: below (from this region) and above (into it).
    const below = this.world.thresholds.find((t) => t.from === sim.id)
    const above = this.world.thresholds.find((t) => t.to === sim.id)
    const on = config.THRESHOLD_MASS > 0
    gl.uniform4f(u.uBandA ?? null, below ? below.band.y : 0, below ? below.band.h : 1, config.THRESHOLD_MASS, below && on ? 1 : 0)
    gl.uniform4f(u.uBandB ?? null, above ? above.band.y : 0, above ? above.band.h : 1, config.THRESHOLD_MASS, above && on ? 1 : 0)
    drawQuad(gl, this.quad, this.progComposite.attrib)
  }

  /** Reads one pixel of the last render (call right after render, same task). Screen px, top-down. */
  readPixel(sx: number, sy: number): [number, number, number] {
    const gl = this.gl
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth)
    const px = Math.round(sx * dpr)
    const py = Math.round(this.canvas.height - sy * dpr)
    const out = new Uint8Array(4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return [out[0] as number, out[1] as number, out[2] as number]
  }

  dispose() {
    const ext = this.gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}
