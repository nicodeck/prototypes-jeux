// Du hasard reproductible (en JS) et du bruit (en GLSL), partagés par tout le rendu.

/** Un générateur pseudo-aléatoire à graine : le même décor à chaque partie. */
export function graine(n: number) {
  let s = n >>> 0 || 1;
  const suivant = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  return {
    suivant,
    entre: (a: number, b: number) => a + (b - a) * suivant(),
    entier: (a: number, b: number) => Math.floor(a + (b - a + 1) * suivant()),
    choix: <T>(liste: T[]) => liste[Math.floor(suivant() * liste.length)],
  };
}
export type Hasard = ReturnType<typeof graine>;

export const GLSL_BRUIT = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float bruit(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * bruit(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;
