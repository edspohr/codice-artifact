// GLSL ES 1.00. All sim textures share one convention: uv = world
// fraction, top-down (u right, v down). Only the composite flips for the
// screen.

export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

/** Writes the ground ink of the region into the sim (R = ink). White elsewhere. */
export const GROUND_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec4 uWorld;   // origin x, origin y, width, height (world px)
uniform vec4 uRegion;  // x, y, w, h of the region the image covers
void main() {
  vec2 p = uWorld.xy + vUv * uWorld.zw;
  vec2 r = (p - uRegion.xy) / uRegion.zw;
  float ink = 0.0;
  if (r.x >= 0.0 && r.x <= 1.0 && r.y >= 0.0 && r.y <= 1.0) {
    ink = 1.0 - texture2D(uImage, r).r;
  }
  gl_FragColor = vec4(ink, 0.0, 0.0, 1.0);
}
`

/** Bakes a formation (image, centre, radius) into a texture (R = ink), multiplying transparencies. */
export const BAKE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uImage;
uniform vec4 uWorld;
uniform vec3 uPlace;   // x, y, radius (world px)
void main() {
  vec4 base = texture2D(uBase, vUv);
  vec2 p = uWorld.xy + vUv * uWorld.zw;
  vec2 f = (p - uPlace.xy) / (2.0 * uPlace.z) + 0.5;
  float ink = 0.0;
  if (f.x >= 0.0 && f.x <= 1.0 && f.y >= 0.0 && f.y <= 1.0) {
    ink = 1.0 - texture2D(uImage, f).r;
  }
  float d = 1.0 - (1.0 - base.r) * (1.0 - ink);
  gl_FragColor = vec4(d, base.gba);
}
`

/**
 * Velocity + insistence. RG = velocity encoded around 0.5 (texels/s over
 * uVelMax), B = insistence. The brush is the finger's slip segment.
 */
export const VEL_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uVI;
uniform vec2 uSim;        // sim size in texels
uniform float uDt;        // seconds
uniform float uVelDecay;  // per second
uniform float uVelMax;    // texels/s
uniform float uBrushOn;
uniform vec4 uBrush;      // segment a.xy b.xy in texels
uniform vec2 uBrushVel;   // texels/s
uniform float uBrushRadius; // texels
uniform float uBrushStrength;
uniform float uInsRate;
uniform float uInsDecay;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len2 = max(dot(ab, ab), 1e-4);
  float t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + ab * t));
}

void main() {
  vec4 s = texture2D(uVI, vUv);
  vec2 v = (s.rg - 0.5) * 2.0 * uVelMax;
  float ins = s.b;
  v *= exp(-uVelDecay * uDt);
  ins *= exp(-uInsDecay * uDt);
  if (uBrushOn > 0.5) {
    vec2 p = vUv * uSim;
    float d = segDist(p, uBrush.xy, uBrush.zw);
    float k = exp(-(d * d) / (uBrushRadius * uBrushRadius));
    v += uBrushVel * k * uBrushStrength;
    float speed = min(1.0, length(uBrushVel) / uVelMax * 4.0);
    ins += k * speed * uInsRate * uDt;
  }
  v = clamp(v, vec2(-uVelMax), vec2(uVelMax));
  gl_FragColor = vec4(v / (2.0 * uVelMax) + 0.5, clamp(ins, 0.0, 1.0), 1.0);
}
`

/**
 * Semi-Lagrangian advection of ink along the velocity, displacement under
 * the brush (a paler furrow, darker ridges beside it, so a mark reads even
 * in dense ink), then slow drying back to the ground.
 */
export const ADVECT_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uDensity;
uniform sampler2D uVI;
uniform sampler2D uGround;
uniform vec2 uSim;
uniform float uDt;
uniform float uVelMax;
uniform float uDryRate; // per second
uniform float uBrushOn;
uniform vec4 uBrush;        // segment a.xy b.xy in texels
uniform float uBrushRadius; // texels
uniform float uFurrow;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len2 = max(dot(ab, ab), 1e-4);
  float t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + ab * t));
}

void main() {
  vec4 s = texture2D(uVI, vUv);
  vec2 v = (s.rg - 0.5) * 2.0 * uVelMax;      // texels/s
  vec2 back = vUv - (v * uDt) / uSim;
  float d = texture2D(uDensity, back).r;
  float g = texture2D(uGround, vUv).r;
  if (uBrushOn > 0.5 && uFurrow > 0.0) {
    vec2 p = vUv * uSim;
    float dist = segDist(p, uBrush.xy, uBrush.zw);
    float r = max(1.0, uBrushRadius);
    float furrow = exp(-(dist * dist) / (r * r * 0.45));
    float ring = exp(-pow((dist - 1.25 * r) / (0.55 * r), 2.0));
    d += uFurrow * (ring * 0.35 * g - furrow * 0.5 * d);
  }
  d = mix(d, g, 1.0 - exp(-uDryRate * uDt));
  gl_FragColor = vec4(clamp(d, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`

/** Composite to the screen: ground + smears + formations + clearing + accent. */
export const COMPOSITE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uDensity;
uniform sampler2D uGround;
uniform sampler2D uVI;
uniform sampler2D uNoise;
uniform sampler2D uForm0;
uniform sampler2D uForm1;
uniform sampler2D uForm2;
uniform sampler2D uForm3;
uniform vec4 uPlace[4];    // x, y, radius, reveal
uniform vec4 uView;        // left, top, width, height (world px)
uniform vec4 uWorld;       // origin, size
uniform float uOpen;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccentColor;
uniform float uAccent;
uniform vec4 uClear[8];    // cx, cy, hw, hh (world px)
uniform int uClearCount;
uniform vec3 uClearParams; // margin px, soft px, irregularity
uniform float uClearResidual;
uniform float uNoiseScale; // world px per noise tile
uniform vec4 uHelp;        // target x, y, bias, active
uniform vec3 uGrain;       // strength, wiggle, wavelength (px)
uniform float uShort;

float formation(sampler2D img, vec4 place, vec2 p) {
  if (place.w <= 0.001) return 0.0;
  float spread = 1.7 - 0.7 * place.w;  // ink gathers as it reveals
  vec2 f = (p - place.xy) / (2.0 * place.z * spread) + 0.5;
  if (f.x < 0.0 || f.x > 1.0 || f.y < 0.0 || f.y > 1.0) return 0.0;
  return (1.0 - texture2D(img, f).r) * place.w;
}

void main() {
  vec2 screen = vec2(vUv.x, 1.0 - vUv.y);
  vec2 p = uView.xy + screen * uView.zw;
  vec2 uv = (p - uWorld.xy) / uWorld.zw;
  vec4 n = texture2D(uNoise, p / uNoiseScale);

  float d = texture2D(uDensity, uv).r;
  float g = texture2D(uGround, uv).r;
  float ins = texture2D(uVI, uv).b;

  // The grain of the ink runs up the channel and bends, faintly, toward the
  // nearest unfound place: the same direction as the current.
  if (uGrain.x > 0.0) {
    float wiggle = uGrain.y * sin((p.y / uGrain.z) * 2.1 + 0.7 + cos((p.x / uGrain.z) * 1.3));
    vec2 dir = vec2(wiggle, -1.0);
    if (uHelp.w > 0.5 && uHelp.z > 0.0) {
      vec2 to = normalize(uHelp.xy - p + vec2(1e-3));
      dir = dir * (1.0 - uHelp.z) + to * uHelp.z;
    }
    dir = normalize(dir);
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(p, perp) / (uShort * 0.022), dot(p, dir) / (uShort * 0.55));
    float streak = texture2D(uNoise, q / 64.0).a;
    d = clamp(d + (streak - 0.5) * uGrain.x * d, 0.0, 1.0);
  }

  float f = 0.0;
  f = 1.0 - (1.0 - f) * (1.0 - formation(uForm0, uPlace[0], p));
  f = 1.0 - (1.0 - f) * (1.0 - formation(uForm1, uPlace[1], p));
  f = 1.0 - (1.0 - f) * (1.0 - formation(uForm2, uPlace[2], p));
  f = 1.0 - (1.0 - f) * (1.0 - formation(uForm3, uPlace[3], p));
  d = 1.0 - (1.0 - d) * (1.0 - f);

  // The ink parts around present text: an irregular, soft void.
  float clear = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uClearCount) break;
    vec4 c = uClear[i];
    vec2 q = abs(p - c.xy) - c.zw;
    float dist = length(max(q, 0.0));
    float irregular = 1.0 + uClearParams.z * (n.g * 2.0 - 1.0) * 0.9;
    float margin = uClearParams.x * max(0.15, irregular);
    float soft = uClearParams.y * (0.7 + 0.6 * n.b);
    clear = max(clear, 1.0 - smoothstep(margin - soft, margin + soft, dist));
  }
  d *= 1.0 - clear * (1.0 - uClearResidual);

  // Accent: burgundy through insistence, on the drying deviation of a mark.
  float deviation = abs(d - g);
  float accent = uAccent * clamp(ins * 1.6, 0.0, 1.0) * clamp(deviation * 3.0, 0.0, 1.0) * (0.6 + 0.4 * n.r);
  accent *= 1.0 - clear;

  vec3 color = mix(uPaper, uInk, d);
  color = mix(color, uAccentColor, accent * (0.35 + 0.65 * d));
  color = mix(uPaper, color, uOpen);
  gl_FragColor = vec4(color, 1.0);
}
`
