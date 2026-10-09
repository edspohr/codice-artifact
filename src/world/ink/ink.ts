// The ink field: ground, smear simulation and composite, in WebGL1.
// World-space simulation at SIM_SCALE of world px. Nothing here touches
// React; the loop drives it.
import { config } from '../../gestures/config'
import type { Place, Rect, World } from '../types'
import { bindTexture, createProgram, createQuad, createTarget, createTexture, drawQuad, PingPong, type Program, type Target } from './gl'
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
  ground: HTMLImageElement
  formations: Map<number, HTMLImageElement>
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
  private groundImg: WebGLTexture
  private formTex = new Map<number, WebGLTexture>()
  private ground: PingPong
  private density: PingPong
  private vi: PingPong
  private simW: number
  private simH: number
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
      'uClear[0]', 'uClearCount', 'uClearParams', 'uClearResidual', 'uNoiseScale', 'uHelp', 'uGrain', 'uShort', 'uBand',
    ])
    this.noise = createTexture(gl, NOISE_SIZE, NOISE_SIZE, noiseTextureData(), gl.REPEAT)
    this.groundImg = createTexture(gl, 0, 0, assets.ground)
    for (const [n, img] of assets.formations) this.formTex.set(n, createTexture(gl, 0, 0, img))

    const scale = Math.max(0.05, Math.min(1, config.SIM_SCALE))
    this.simW = Math.min(2048, Math.max(8, Math.round(world.width * scale)))
    this.simH = Math.min(2048, Math.max(8, Math.round(world.height * scale)))
    this.ground = new PingPong(gl, this.simW, this.simH)
    this.density = new PingPong(gl, this.simW, this.simH)
    this.vi = new PingPong(gl, this.simW, this.simH)
    this.initGround()
    this.initVI()
  }

  get isLost() {
    return this.lost
  }

  get simSize() {
    return { w: this.simW, h: this.simH }
  }

  private worldVec(): [number, number, number, number] {
    return [0, 0, this.world.width, this.world.height]
  }

  private target(t: Target) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
    gl.viewport(0, 0, t.width, t.height)
  }

  private initGround() {
    const gl = this.gl
    const region: Rect = this.world.regions[0]?.rect ?? { x: 0, y: 0, w: 1, h: 1 }
    for (const pp of [this.ground, this.density]) {
      this.target(pp.read)
      gl.useProgram(this.progGround.program)
      bindTexture(gl, 0, this.groundImg, this.progGround.uniforms.uImage ?? null)
      gl.uniform4f(this.progGround.uniforms.uWorld ?? null, ...this.worldVec())
      gl.uniform4f(this.progGround.uniforms.uRegion ?? null, region.x, region.y, region.w, region.h)
      drawQuad(gl, this.quad, this.progGround.attrib)
    }
  }

  private initVI() {
    const gl = this.gl
    this.target(this.vi.read)
    gl.clearColor(0.5, 0.5, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.target(this.vi.write)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** A stamped place becomes part of the ground: from now on it can be smeared and it dries like the rest. */
  bake(place: Place, radius: number) {
    const gl = this.gl
    const img = this.formTex.get(place.n)
    if (!img) return
    for (const pp of [this.ground, this.density]) {
      this.target(pp.write)
      gl.useProgram(this.progBake.program)
      bindTexture(gl, 0, pp.read.tex, this.progBake.uniforms.uBase ?? null)
      bindTexture(gl, 1, img, this.progBake.uniforms.uImage ?? null)
      gl.uniform4f(this.progBake.uniforms.uWorld ?? null, ...this.worldVec())
      gl.uniform3f(this.progBake.uniforms.uPlace ?? null, place.x, place.y, radius)
      drawQuad(gl, this.quad, this.progBake.attrib)
      pp.swap()
    }
  }

  /** The cost of finding: scar the ground (and the current ink) around a stamped place. */
  scar(place: Place) {
    const gl = this.gl
    const short = this.world.short
    for (const pp of [this.ground, this.density]) {
      this.target(pp.write)
      gl.useProgram(this.progScar.program)
      bindTexture(gl, 0, pp.read.tex, this.progScar.uniforms.uBase ?? null)
      bindTexture(gl, 1, this.noise, this.progScar.uniforms.uNoise ?? null)
      gl.uniform4f(this.progScar.uniforms.uWorld ?? null, ...this.worldVec())
      gl.uniform4f(this.progScar.uniforms.uScar ?? null, place.x, place.y, config.SCAR_RADIUS * short, config.SCAR_WIDTH * short)
      gl.uniform1f(this.progScar.uniforms.uStrength ?? null, config.SCAR_STRENGTH)
      gl.uniform1f(this.progScar.uniforms.uNoiseScale ?? null, short * 0.5)
      drawQuad(gl, this.quad, this.progScar.attrib)
      pp.swap()
    }
  }

  /**
   * One simulation step. `brush` is the finger's slip segment in world px
   * with its velocity in world px/s, or null when nothing is touching.
   * `dirt` is the number of stamps so far: dirty hands deposit more ink.
   */
  step(dtSeconds: number, brush: { ax: number; ay: number; bx: number; by: number; vx: number; vy: number } | null, dirt = 0) {
    const gl = this.gl
    const dt = Math.min(0.05, Math.max(0.0005, dtSeconds))
    const sx = this.simW / this.world.width
    const sy = this.simH / this.world.height
    const u = this.progVel.uniforms

    this.target(this.vi.write)
    gl.useProgram(this.progVel.program)
    bindTexture(gl, 0, this.vi.read.tex, u.uVI ?? null)
    gl.uniform2f(u.uSim ?? null, this.simW, this.simH)
    gl.uniform1f(u.uDt ?? null, dt)
    gl.uniform1f(u.uVelDecay ?? null, config.VEL_DECAY)
    gl.uniform1f(u.uVelMax ?? null, VEL_MAX)
    gl.uniform1f(u.uBrushOn ?? null, brush ? 1 : 0)
    if (brush) {
      gl.uniform4f(u.uBrush ?? null, brush.ax * sx, brush.ay * sy, brush.bx * sx, brush.by * sy)
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
    this.vi.swap()

    const a = this.progAdvect.uniforms
    this.target(this.density.write)
    gl.useProgram(this.progAdvect.program)
    bindTexture(gl, 0, this.density.read.tex, a.uDensity ?? null)
    bindTexture(gl, 1, this.vi.read.tex, a.uVI ?? null)
    bindTexture(gl, 2, this.ground.read.tex, a.uGround ?? null)
    gl.uniform2f(a.uSim ?? null, this.simW, this.simH)
    gl.uniform1f(a.uDt ?? null, dt)
    gl.uniform1f(a.uVelMax ?? null, VEL_MAX)
    gl.uniform1f(a.uDryRate ?? null, config.INK_DRY_S > 0 ? 1 / config.INK_DRY_S : 0)
    gl.uniform1f(a.uBrushOn ?? null, brush ? 1 : 0)
    if (brush) gl.uniform4f(a.uBrush ?? null, brush.ax * sx, brush.ay * sy, brush.bx * sx, brush.by * sy)
    else gl.uniform4f(a.uBrush ?? null, 0, 0, 0, 0)
    gl.uniform1f(a.uBrushRadius ?? null, config.BRUSH_RADIUS * this.world.short * sx)
    gl.uniform1f(a.uFurrow ?? null, config.FURROW_STRENGTH)
    gl.uniform1f(a.uDeposit ?? null, Math.min(0.6, config.DIRT_PER_STAMP * dirt))
    drawQuad(gl, this.quad, this.progAdvect.attrib)
    this.density.swap()
  }

  /**
   * Draw the viewport. `view` is the camera rect in world px. `help` is the
   * nearest unfound place with the effective bias and the grain boost.
   */
  render(view: Rect, open: number, places: PlaceUniform[], clears: ClearBox[], help: { x: number; y: number; bias: number; boost: number } | null) {
    const gl = this.gl
    const canvas = this.canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    const u = this.progComposite.uniforms
    gl.useProgram(this.progComposite.program)
    bindTexture(gl, 0, this.density.read.tex, u.uDensity ?? null)
    bindTexture(gl, 1, this.ground.read.tex, u.uGround ?? null)
    bindTexture(gl, 2, this.vi.read.tex, u.uVI ?? null)
    bindTexture(gl, 3, this.noise, u.uNoise ?? null)
    const formNames = ['uForm0', 'uForm1', 'uForm2', 'uForm3'] as const
    const placeData = new Float32Array(16)
    const marPlaces = this.world.places.slice(0, 4)
    marPlaces.forEach((p, i) => {
      const tex = this.formTex.get(p.n) ?? this.noise
      bindTexture(gl, 4 + i, tex, u[formNames[i] as string] ?? null)
      const pu = places.find((x) => x.x === p.x && x.y === p.y)
      placeData.set([p.x, p.y, pu ? pu.radius : 1, pu ? pu.reveal : 0], i * 4)
    })
    for (let i = marPlaces.length; i < 4; i++) {
      bindTexture(gl, 4 + i, this.noise, u[formNames[i] as string] ?? null)
    }
    gl.uniform4fv(u['uPlace[0]'] ?? null, placeData)
    gl.uniform4f(u.uView ?? null, view.x, view.y, view.w, view.h)
    gl.uniform4f(u.uWorld ?? null, ...this.worldVec())
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
    const band = this.world.thresholds[0]?.band
    gl.uniform4f(u.uBand ?? null, band ? band.y : 0, band ? band.h : 1, config.THRESHOLD_MASS, band && config.THRESHOLD_MASS > 0 ? 1 : 0)
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

export { createTarget }
