// WebGL 2D Rigging Shader for 2B (themes/nier-2b/assets/2b-full.png, 260x440).
// Animates head tilt, silver bob hair sway, gothic combat skirt wind, both arms rotating
// independently around her shoulders (for Pod Glide, petting Pod 042, katana slash, and crossed arms),
// thigh foreshortening and dangling lower-leg swings when sitting on desktop window frames,
// and YoRHa Bunker monochrome digital dematerialization.

const VERT = `
attribute vec2 aPos;
uniform vec2 uView;
uniform float uPad;
varying vec2 vPx;
void main() {
  vec2 uv = aPos * 0.5 + 0.5;
  vPx = vec2(uv.x, 1.0 - uv.y) * uView - uPad;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vPx;

uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uSeed;
uniform float uBoil;
uniform float uHair;
uniform float uSkirt;
uniform float uHead;
uniform float uArmL;
uniform float uArmR;
uniform float uLongL;
uniform float uLongR;
uniform float uSit;
uniform float uKickL;
uniform float uKickR;
uniform vec2 uSmear;
uniform vec2 uEcho;
uniform float uGlitch;
uniform float uGlitchSeed;
uniform float uSplit;
uniform float uCollapse;
uniform float uDissolve;
uniform float uBunker;
uniform vec4 uSil;
uniform vec2 uMisreg;
uniform vec3 uRim;
uniform float uAlpha;

const vec2 NECK = vec2(130.0, 82.0);
const vec2 SHOULDER_L = vec2(90.0, 102.0);
const vec2 SHOULDER_R = vec2(170.0, 102.0);
const float AXIS = 130.0;
const float HIP = 250.0;
const float KNEE = 320.0;
const float KNEE_LX = 92.0;
const float KNEE_RX = 168.0;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec2 rot(vec2 p, vec2 c, float a) {
  float s = sin(a), k = cos(a);
  p -= c;
  return c + vec2(k * p.x - s * p.y, s * p.x + k * p.y);
}

vec4 tex(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x > uSize.x || p.y > uSize.y) return vec4(0.0);
  return texture2D(uTex, p / uSize);
}

vec4 cel(vec2 s) {
  vec4 c = tex(s);
  if (c.a <= 0.0) return vec4(0.0);
  if (uBunker > 0.0) {
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 mono = step(0.45, lum) * vec3(0.95, 0.93, 0.86);
    c.rgb = mix(c.rgb, mono, uBunker);
  }
  return vec4(c.rgb * c.a, c.a);
}

float legL(vec2 s) { return smoothstep(KNEE - 10.0, KNEE + 2.0, s.y) * (1.0 - step(AXIS, s.x)); }
float legR(vec2 s) { return smoothstep(KNEE - 10.0, KNEE + 2.0, s.y) * step(AXIS, s.x); }

float thighScale() { return mix(1.0, 0.42, uSit); }

vec2 unsit(vec2 q) {
  if (uSit <= 0.0 || q.y <= HIP) return q;
  float c = thighScale();
  if (q.y <= HIP + (KNEE - HIP) * c) q.y = HIP + (q.y - HIP) / c;
  else q.y += (KNEE - HIP) * (1.0 - c);
  return q;
}

// Precise arm masks tailored to 2B's gothic silhouette (y=90..244):
// Follows the gap between her outer arms/gloves and her wide flared gothic skirt (x=62..198 at y=220+)
// so rotating her arms never slices into her skirt or torso.
float armLMask(vec2 s) {
  if (s.y < 90.0 || s.y > 244.0) return 0.0;
  float inner;
  if (s.y < 130.0) {
    inner = 96.0;
  } else if (s.y < 180.0) {
    inner = mix(98.0, 85.0, (s.y - 130.0) / 50.0);
  } else {
    inner = mix(85.0, 54.0, (s.y - 180.0) / 64.0);
  }
  return step(s.x, inner);
}

float armRMask(vec2 s) {
  if (s.y < 90.0 || s.y > 244.0) return 0.0;
  float inner;
  if (s.y < 130.0) {
    inner = 164.0;
  } else if (s.y < 180.0) {
    inner = mix(162.0, 175.0, (s.y - 130.0) / 50.0);
  } else {
    inner = mix(175.0, 206.0, (s.y - 180.0) / 64.0);
  }
  return step(inner, s.x);
}

const vec2 ARM_DIR_L = vec2(-0.34, 0.94);
const vec2 ARM_DIR_R = vec2(0.34, 0.94);

vec2 stretchArm(vec2 s, vec2 sh, vec2 dir, float k) {
  if (k == 1.0) return s;
  vec2 v = s - sh;
  float along = dot(v, dir);
  return sh + dir * (along / k) + (v - dir * along);
}

vec2 armLeftCoord(vec2 q) { return stretchArm(rot(q, SHOULDER_L, -uArmL), SHOULDER_L, ARM_DIR_L, uLongL); }
vec2 armRightCoord(vec2 q) { return stretchArm(rot(q, SHOULDER_R, uArmR), SHOULDER_R, ARM_DIR_R, uLongR); }

vec2 bend(vec2 q) {
  q = rot(q, NECK, -uHead * smoothstep(92.0, 72.0, q.y));
  float hw = smoothstep(88.0, 12.0, q.y) * smoothstep(14.0, 38.0, abs(q.x - AXIS));
  q.x -= uHair * hw * (0.7 + 0.3 * sin(q.y * 0.08));
  float sw = smoothstep(155.0, 242.0, q.y) * (1.0 - smoothstep(242.0, 262.0, q.y));
  q.x -= uSkirt * sw * (0.65 + 0.35 * cos(q.x * 0.06));
  return q;
}

vec4 torso(vec2 q) {
  if (uSit <= 0.0 && uKickL == 0.0 && uKickR == 0.0) {
    return (armLMask(q) + armRMask(q)) > 0.0 ? vec4(0.0) : cel(q);
  }
  float kneeY = HIP + (KNEE - HIP) * thighScale();
  vec2 qB = unsit(q);
  vec2 qL = unsit(rot(q, vec2(KNEE_LX, kneeY), -uKickL));
  vec2 qR = unsit(rot(q, vec2(KNEE_RX, kneeY), uKickR));
  float maskB = clamp(legL(qB) + legR(qB) + armLMask(qB) + armRMask(qB), 0.0, 1.0);
  vec4 b = cel(qB) * (1.0 - maskB);
  vec4 l = cel(qL) * legL(qL);
  vec4 r = cel(qR) * legR(qR);
  vec4 c = l + b * (1.0 - l.a);
  return r + c * (1.0 - r.a);
}

vec4 rig(vec2 q) {
  vec2 qL = armLeftCoord(q);
  vec2 qR = armRightCoord(q);
  vec4 l = armLMask(qL) > 0.0 ? cel(qL) : vec4(0.0);
  vec4 r = armRMask(qR) > 0.0 ? cel(qR) : vec4(0.0);
  vec4 arms = l + r * (1.0 - l.a);
  vec4 b = torso(bend(q));
  bool joint = distance(q, SHOULDER_L) < 16.0 || distance(q, SHOULDER_R) < 16.0;
  if (joint) return b + arms * (1.0 - b.a);
  return arms + b * (1.0 - arms.a);
}

// Rig-aware silhouette alpha sample so motion smears/echoes always match 2B's exact animated pose
float fastAlpha(vec2 q) {
  return rig(q).a;
}

vec2 settle(vec2 p) {
  vec2 q = p;
  q.x = AXIS + (q.x - AXIS) / max(1.0 - uCollapse, 0.025);
  q.y = 220.0 + (q.y - 220.0) / (1.0 + uCollapse * 0.35);

  if (uGlitch > 0.0) {
    float bh = mix(6.0, 24.0, hash(vec2(uGlitchSeed, 7.0)));
    float band = floor(q.y / bh);
    float on = step(1.0 - uGlitch * 0.6, hash(vec2(band, uGlitchSeed)));
    q.x += on * (hash(vec2(band + 3.0, uGlitchSeed)) - 0.5) * 64.0 * uGlitch;
  }

  q += (vec2(vnoise(q * 0.08 + uSeed * 11.3), vnoise(q * 0.08 + uSeed * 7.1 + 19.0)) - 0.5) * 1.4 * uBoil;
  return q;
}

void main() {
  vec2 p = vPx;

  if (uDissolve > 0.0) {
    vec2 cell = floor(p / vec2(10.0, 10.0));
    if (hash(cell + floor(uGlitchSeed)) < uDissolve) discard;
  }

  vec2 q = settle(p);
  vec4 c = rig(q);
  vec3 col = c.rgb;
  float a = c.a;

  if (uSplit > 0.0) {
    float ar = fastAlpha(q + vec2(uSplit, 0.0));
    float ab = fastAlpha(q - vec2(uSplit, uSplit * 0.25));
    col = vec3(max(col.r, ar * 0.8), col.g, max(col.b, ab * 0.8));
    a = max(a, max(ar, ab));
  }

  if (uSmear != vec2(0.0)) {
    float hw = smoothstep(110.0, 70.0, q.y);
    float m1 = fastAlpha(q - uSmear * hw * 0.5) * (1.0 - a) * 0.55;
    col += vec3(0.85, 0.82, 0.72) * m1;
    a += m1;
  }

  col = mix(col, uSil.rgb * a, uSil.a);

  if (uEcho != vec2(0.0)) {
    float e1 = fastAlpha(q - uEcho) * (1.0 - a) * 0.65;
    col += vec3(0.88, 0.85, 0.74) * e1;
    a += e1;
  }

  if (uMisreg != vec2(0.0)) {
    float rim = fastAlpha(q - uMisreg) * (1.0 - a);
    col += uRim * rim;
    a += rim;
  }

  gl_FragColor = vec4(col, a) * uAlpha;
}`;

const UNIFORMS = [
  'uView', 'uPad', 'uTex', 'uSize', 'uSeed', 'uBoil', 'uHair', 'uSkirt', 'uHead',
  'uArmL', 'uArmR', 'uLongL', 'uLongR', 'uSit', 'uKickL', 'uKickR',
  'uSmear', 'uEcho', 'uGlitch', 'uGlitchSeed', 'uSplit', 'uCollapse', 'uDissolve',
  'uBunker', 'uSil', 'uMisreg', 'uRim', 'uAlpha',
];

export const SPRITE = {
  width: 260,
  height: 440,
  pad: 56,
  head: { x: 130, y: 54 },
  feet: { x: 130, y: 434 },
  hip: 250,
  shoulderL: { x: 90, y: 102 },
  shoulderR: { x: 170, y: 102 },
  handL: { x: 48, y: 230 },
  handR: { x: 212, y: 230 },
};

export class SpriteRenderer {
  constructor(canvas, image) {
    this.canvas = canvas;
    this.image = image;
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;

    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    for (const name of UNIFORMS) this.u[name] = gl.getUniformLocation(prog, name);

    this.tex = gl.createTexture();
    this.setTexture(image);

    gl.uniform1i(this.u.uTex, 0);
    gl.uniform2f(this.u.uSize, SPRITE.width, SPRITE.height);
    gl.uniform1f(this.u.uPad, SPRITE.pad);
    gl.uniform2f(this.u.uView, SPRITE.width + SPRITE.pad * 2, SPRITE.height + SPRITE.pad * 2);
    gl.clearColor(0, 0, 0, 0);
  }

  setTexture(image) {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  static cssSize(scale) {
    return {
      width: Math.round((SPRITE.width + SPRITE.pad * 2) * scale),
      height: Math.round((SPRITE.height + SPRITE.pad * 2) * scale),
    };
  }

  resize(scale) {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = SpriteRenderer.cssSize(scale);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(s) {
    const { gl, u } = this;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uSeed, s.seed);
    gl.uniform1f(u.uBoil, s.boil);
    gl.uniform1f(u.uHair, s.hair);
    gl.uniform1f(u.uSkirt, s.skirt);
    gl.uniform1f(u.uHead, s.head);
    gl.uniform1f(u.uArmL, s.armL);
    gl.uniform1f(u.uArmR, s.armR);
    gl.uniform1f(u.uLongL, s.longL);
    gl.uniform1f(u.uLongR, s.longR);
    gl.uniform1f(u.uSit, s.sit);
    gl.uniform1f(u.uKickL, s.kickL);
    gl.uniform1f(u.uKickR, s.kickR);
    gl.uniform2f(u.uSmear, s.smear[0], s.smear[1]);
    gl.uniform2f(u.uEcho, s.echo[0], s.echo[1]);
    gl.uniform1f(u.uGlitch, s.glitch);
    gl.uniform1f(u.uGlitchSeed, s.glitchSeed);
    gl.uniform1f(u.uSplit, s.split);
    gl.uniform1f(u.uCollapse, s.collapse);
    gl.uniform1f(u.uDissolve, s.dissolve);
    gl.uniform1f(u.uBunker, s.bunker || 0);
    gl.uniform4f(u.uSil, s.sil[0], s.sil[1], s.sil[2], s.silAmount);
    gl.uniform2f(u.uMisreg, s.misreg[0], s.misreg[1]);
    gl.uniform3f(u.uRim, 0.85, 0.82, 0.72);
    gl.uniform1f(u.uAlpha, s.alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
