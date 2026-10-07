// The smallest WebGL1 helper that covers the ink field: programs with
// uniform lookup, RGBA8 textures, framebuffers and ping-pong pairs.

export interface Program {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
  attrib: number
}

export function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('gl: createShader failed')
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`gl: shader compile failed: ${log}\n${src}`)
  }
  return shader
}

export function createProgram(gl: WebGLRenderingContext, vs: string, fs: string, uniformNames: string[]): Program {
  const program = gl.createProgram()
  if (!program) throw new Error('gl: createProgram failed')
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`gl: link failed: ${gl.getProgramInfoLog(program)}`)
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {}
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name)
  return { program, uniforms, attrib: gl.getAttribLocation(program, 'aPos') }
}

export function createTexture(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
  source: Uint8Array | TexImageSource | null,
  wrap: number = gl.CLAMP_TO_EDGE,
): WebGLTexture {
  const tex = gl.createTexture()
  if (!tex) throw new Error('gl: createTexture failed')
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  if (source instanceof Uint8Array || source === null) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source)
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
  }
  return tex
}

export interface Target {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
  width: number
  height: number
}

export function createTarget(gl: WebGLRenderingContext, width: number, height: number): Target {
  const tex = createTexture(gl, width, height, null)
  const fbo = gl.createFramebuffer()
  if (!fbo) throw new Error('gl: createFramebuffer failed')
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`gl: framebuffer incomplete (${status})`)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { tex, fbo, width, height }
}

export class PingPong {
  read: Target
  write: Target
  constructor(gl: WebGLRenderingContext, width: number, height: number) {
    this.read = createTarget(gl, width, height)
    this.write = createTarget(gl, width, height)
  }
  swap() {
    const t = this.read
    this.read = this.write
    this.write = t
  }
}

/** Fullscreen quad: two triangles in clip space. */
export function createQuad(gl: WebGLRenderingContext): WebGLBuffer {
  const buf = gl.createBuffer()
  if (!buf) throw new Error('gl: createBuffer failed')
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  return buf
}

export function drawQuad(gl: WebGLRenderingContext, quad: WebGLBuffer, attrib: number) {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.enableVertexAttribArray(attrib)
  gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

export function bindTexture(gl: WebGLRenderingContext, unit: number, tex: WebGLTexture, location: WebGLUniformLocation | null) {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.uniform1i(location, unit)
}
