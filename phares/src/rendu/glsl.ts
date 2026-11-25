// Morceaux de GLSL partagés entre les shaders.

export const GLSL_BRUIT = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float bruit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    s += a * bruit(p);
    p = m * p;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    s += a * bruit(p);
    p = m * p;
    a *= 0.5;
  }
  return s;
}
`;

/** Couleur du ciel de tempête et de l'aube, partagée entre le ciel et les reflets de l'océan. */
export const GLSL_CIEL = /* glsl */ `
uniform float uAube;
uniform float uFlash;
uniform vec3 uFlashDir;
uniform vec3 uBrume;

// une lune voilée, basse au nord-ouest : son reflet dessine la houle à contre-jour
const vec3 LUNE = vec3(-0.4423, 0.1573, -0.8650);

float halo(vec3 d) {
  float l = max(dot(normalize(d), LUNE), 0.0);
  return pow(l, 10.0) * 0.5 + pow(l, 80.0) * 0.7 + pow(l, 3000.0) * 1.5;
}

vec3 couleurCielSimple(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 nuitHaut = vec3(0.0035, 0.0055, 0.011);
  vec3 nuitHorizon = uBrume;
  vec3 aubeHaut = vec3(0.02, 0.06, 0.2);
  vec3 c = mix(nuitHorizon, mix(nuitHaut, aubeHaut, uAube), pow(h, mix(0.45, 0.3, uAube)));
  // l'éclair illumine tout le ciel, et plus fort dans sa direction
  float proche = pow(max(dot(normalize(d), uFlashDir), 0.0), 6.0);
  c += uFlash * vec3(0.4, 0.45, 0.7) * (0.1 + 0.7 * proche) * (1.0 - h * 0.5);
  c += vec3(0.05, 0.06, 0.08) * halo(d) * (1.0 - uAube);
  return c;
}
`;
