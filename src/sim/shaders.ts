// --- Shaders ---------------------------------------------------------------

export const EARTH_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const EARTH_FRAG = /* glsl */ `
precision highp float;
varying vec3 vPos;
varying vec3 vN;
uniform vec3 uSunDir;
uniform vec3 uMoonPos;
uniform float uMoonRad;
uniform float uEarthRad;
uniform float uTime;
uniform float uScar;
uniform vec3 uScarDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 n = normalize(vN);
  vec3 sp = normalize(vPos);
  float ndl = max(0.0, dot(n, uSunDir));
  float land = fbm(sp * 3.5);
  land = smoothstep(0.42, 0.58, land);
  vec3 ocean = vec3(0.02, 0.08, 0.22);
  vec3 landCol = mix(vec3(0.12, 0.28, 0.08), vec3(0.35, 0.28, 0.12), fbm(sp * 6.0));
  vec3 col = mix(ocean, landCol, land);
  float clouds = fbm(sp * 4.0 + vec3(uTime * 0.01, 0.0, 0.0));
  clouds = smoothstep(0.5, 0.75, clouds);
  col = mix(col, vec3(0.9, 0.92, 0.95), clouds * 0.55 * (0.4 + 0.6 * ndl));
  float night = smoothstep(0.15, -0.05, ndl);
  float cities = smoothstep(0.65, 0.85, fbm(sp * 18.0));
  col += vec3(1.0, 0.75, 0.35) * cities * night * land * 0.45;
  col *= 0.12 + 0.88 * ndl;
  vec3 halfV = normalize(uSunDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(0.0, dot(n, halfV)), 40.0) * (1.0 - land);
  col += vec3(0.6, 0.7, 0.9) * spec * 0.35;
  vec3 toMoon = uMoonPos;
  float distM = length(toMoon);
  if (distM > 1.0) {
    vec3 mDir = toMoon / distM;
    float cosA = dot(sp, mDir);
    float ang = acos(clamp(cosA, -1.0, 1.0));
    float mAng = atan(uMoonRad, distM);
    float shade = smoothstep(mAng * 1.1, mAng * 0.7, ang);
    float facing = smoothstep(0.2, -0.1, dot(sp, uSunDir));
    col *= 1.0 - shade * 0.85 * (1.0 - facing);
  }
  if (uScar > 0.01) {
    float scarAng = acos(clamp(dot(sp, normalize(uScarDir)), -1.0, 1.0));
    float scar = smoothstep(0.35, 0.05, scarAng) * uScar;
    col = mix(col, vec3(0.15, 0.08, 0.05), scar * 0.85);
    col += vec3(1.0, 0.4, 0.1) * scar * 0.3 * (1.0 - scarAng * 3.0);
  }
  float fres = pow(1.0 - max(0.0, dot(n, vec3(0.0, 0.0, 1.0))), 2.5);
  col += vec3(0.3, 0.5, 0.9) * fres * 0.25 * (0.3 + 0.7 * ndl);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const MOON_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MOON_FRAG = /* glsl */ `
precision highp float;
varying vec3 vPos;
varying vec3 vN;
uniform vec3 uSunDir;
uniform float uEclipse;
uniform float uTime;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  vec3 n = normalize(vN);
  vec3 sp = normalize(vPos);
  float ndl = max(0.0, dot(n, uSunDir));
  float crater = noise(sp * 8.0);
  float surface = 0.45 + 0.25 * noise(sp * 3.0) + 0.15 * crater;
  float rim = smoothstep(0.55, 0.65, crater) * smoothstep(0.75, 0.65, crater);
  surface += rim * 0.2;
  vec3 col = vec3(surface * 0.85, surface * 0.82, surface * 0.78);
  col *= 0.15 + 0.85 * ndl;
  if (uEclipse > 0.01) {
    vec3 copper = vec3(0.55, 0.18, 0.06);
    float dark = mix(1.0, 0.25, uEclipse);
    col = mix(col * dark, copper * (0.3 + 0.4 * ndl), uEclipse * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export const ATM_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const ATM_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vView;
uniform vec3 uSunDir;
void main() {
  float fres = pow(1.0 - max(0.0, dot(vN, vView)), 3.0);
  float ndl = max(0.0, dot(vN, uSunDir));
  vec3 col = vec3(0.25, 0.45, 0.95) * fres * (0.25 + 0.75 * ndl);
  gl_FragColor = vec4(col, fres * 0.55);
}
`;

export const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SUN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.15, d);
  float glow = exp(-d * 4.0) * 0.6;
  float corona = exp(-d * 2.2) * (0.4 + 0.2 * sin(uTime * 2.0 + d * 20.0));
  vec3 col = vec3(1.0, 0.95, 0.7) * core + vec3(1.0, 0.7, 0.2) * glow + vec3(1.0, 0.5, 0.1) * corona;
  float alpha = core + glow + corona * 0.5;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export const CONE_VERT = /* glsl */ `
varying float vT;
void main() {
  vT = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CONE_FRAG = /* glsl */ `
precision highp float;
varying float vT;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float a = uOpacity * (1.0 - vT) * 0.55;
  gl_FragColor = vec4(uColor, a);
}
`;
