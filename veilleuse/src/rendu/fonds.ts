// Les fonds : le lointain (un dégradé où dérive la brume), trois plans peints par salle qui
// glissent en parallaxe, et des nappes de brume entre les plans.
import * as THREE from "three";
import type { Salle } from "../monde/mine";
import type { Zone } from "../monde/zones";
import { AMBIANCES } from "./ambiances";
import { GLSL_BRUIT, graine, type Hasard } from "./bruit";
import { arche, cable, cadre, chevalement, cristaux, echelle, lueur, onde, paroi, pilier, poutre, racine, rgba, type Pinceau } from "./peinture";

const ECRAN = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Le lointain, collé à l'écran. */
export function creerCiel() {
  const uniforms = {
    uHaut: { value: new THREE.Color() },
    uBas: { value: new THREE.Color() },
    uBrume: { value: new THREE.Color() },
    uCam: { value: new THREE.Vector2() },
    uVue: { value: new THREE.Vector2(26, 15) },
    uTemps: { value: 0 },
    uLueur: { value: new THREE.Vector3(0.5, 1.2, 0) },
  };
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: ECRAN,
      fragmentShader: /* glsl */ `
        ${GLSL_BRUIT}
        uniform vec3 uHaut;
        uniform vec3 uBas;
        uniform vec3 uBrume;
        uniform vec2 uCam;
        uniform vec2 uVue;
        uniform float uTemps;
        uniform vec3 uLueur;
        varying vec2 vUv;
        void main() {
          vec2 q = (vUv - 0.5) * uVue * 0.6 + uCam * 0.12;
          vec3 col = mix(uBas, uHaut, smoothstep(0.0, 1.0, vUv.y + (fbm(q * 0.15) - 0.5) * 0.4));
          float b = fbm(q * 0.22 + vec2(uTemps * 0.012, 0.0));
          float b2 = fbm(q * 0.5 - vec2(uTemps * 0.02, uTemps * 0.004));
          col = mix(col, uBrume, smoothstep(0.35, 0.9, b * 0.7 + b2 * 0.5) * 0.55);
          // Une grande lueur lointaine (la surface, le Cœur…)
          vec2 d = (vUv - uLueur.xy) * vec2(uVue.x / uVue.y, 1.0);
          col += uBrume * uLueur.z * exp(-dot(d, d) * 2.2) * 1.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  m.frustumCulled = false;
  m.renderOrder = -100;
  return { mesh: m, uniforms };
}

/** Une nappe de brume, collée à l'écran, qui dérive avec une parallaxe donnée. */
export function creerBrume(facteur: number, force: number, ordre: number, basse: number) {
  const uniforms = {
    uCouleur: { value: new THREE.Color() },
    uCam: { value: new THREE.Vector2() },
    uVue: { value: new THREE.Vector2(26, 15) },
    uTemps: { value: 0 },
    uForce: { value: force },
    uFacteur: { value: facteur },
    uBasse: { value: basse },
  };
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: ECRAN,
      fragmentShader: /* glsl */ `
        ${GLSL_BRUIT}
        uniform vec3 uCouleur;
        uniform vec2 uCam;
        uniform vec2 uVue;
        uniform float uTemps;
        uniform float uForce;
        uniform float uFacteur;
        uniform float uBasse;
        varying vec2 vUv;
        void main() {
          vec2 q = (vUv - 0.5) * uVue + uCam * uFacteur;
          float a = fbm(q * vec2(0.09, 0.2) + vec2(uTemps * 0.03 * uFacteur, 0.0));
          float b = fbm(q * vec2(0.2, 0.35) - vec2(uTemps * 0.05 * uFacteur, uTemps * 0.01));
          float d = smoothstep(0.38, 0.85, a * 0.75 + b * 0.45);
          // Plus épaisse vers le bas de l'image
          d *= mix(1.0, smoothstep(0.85, 0.0, vUv.y), uBasse);
          gl_FragColor = vec4(uCouleur, d * uForce);
        }
      `,
    }),
  );
  m.frustumCulled = false;
  m.renderOrder = ordre;
  return { mesh: m, uniforms };
}

/** Facteurs de parallaxe des trois plans peints, du plus lointain au plus proche */
export const FACTEURS = [0.22, 0.42, 0.62, 1.35];
const RESOLUTION = [9, 12, 16, 10];
const FLOUS = [2.2, 1.2, 0.5, 3.5];

export type PlanPeint = { mesh: THREE.Mesh; facteur: number; salle: Salle };

/** Peint les trois plans de fond d'une salle. demiVue : la moitié de la vue, en cases. */
export function peindreSalle(salle: Salle, numero: number, demiVue: { l: number; h: number }, ordres: number[]): PlanPeint[] {
  const plans: PlanPeint[] = [];
  const a = AMBIANCES[salle.zone];
  FACTEURS.forEach((f, k) => {
    const marge = 4;
    const lw = 2 * (Math.max(0, salle.largeur / 2 - demiVue.l) * f + demiVue.l + marge);
    const lh = 2 * (Math.max(0, salle.hauteur / 2 - demiVue.h) * f + demiVue.h + marge);
    const ppc = RESOLUTION[k];
    const toile = document.createElement("canvas");
    toile.width = Math.ceil(lw * ppc);
    toile.height = Math.ceil(lh * ppc);
    const brut = document.createElement("canvas");
    brut.width = toile.width;
    brut.height = toile.height;
    const c = brut.getContext("2d")!;
    c.scale(ppc, ppc);
    const h = graine(numero * 977 + k * 131 + 7);
    const couleur = k === 3 ? "#020203" : a.lointains[k];
    c.fillStyle = couleur;
    c.strokeStyle = couleur;
    if (k === 3) premierPlan(c, h, lw, lh, salle.zone);
    else PEINTRES[salle.zone](c, h, lw, lh, k, a.accent, a.brume, couleur);
    // Un voile de brume vers le bas de chaque plan
    const g = c.createLinearGradient(0, lh * 0.55, 0, lh * (k === 3 ? 4 : 1));
    g.addColorStop(0, rgba(a.brume).replace("ALPHA", "0"));
    g.addColorStop(1, rgba(a.brume).replace("ALPHA", String(0.22 - k * 0.06)));
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = g;
    c.fillRect(0, 0, lw, lh);
    c.globalCompositeOperation = "source-over";

    const fin = toile.getContext("2d")!;
    if ("filter" in fin) fin.filter = `blur(${FLOUS[k] * (ppc / 10)}px)`;
    fin.drawImage(brut, 0, 0);
    const tex = new THREE.CanvasTexture(toile);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(lw, lh),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
    );
    mesh.renderOrder = ordres[k];
    mesh.frustumCulled = false;
    mesh.visible = false;
    plans.push({ mesh, facteur: f, salle });
  });
  return plans;
}

/** Le premier plan : des rochers et des racines noirs, en haut et en bas, rarement au milieu. */
function premierPlan(c: Pinceau, h: Hasard, l: number, ht: number, zone: Zone) {
  // Des amas de roche qui montent du bas, espacés pour laisser respirer l'image
  for (let x = h.entre(-4, 8); x < l; x += h.entre(16, 30)) {
    const larg = h.entre(4, 9);
    const haut = h.entre(2.5, 6);
    c.beginPath();
    c.moveTo(x - larg, ht + 1);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = ht - haut * Math.sin(t * Math.PI) * h.entre(0.75, 1.1);
      c.lineTo(x - larg + t * larg * 2, y);
    }
    c.lineTo(x + larg, ht + 1);
    c.fill();
    if (zone !== "crevasse") for (let i = 0; i < 6; i++) poutre(c, x + h.entre(-larg, larg) * 0.6, ht - haut * 0.8, x + h.entre(-larg, larg) * 0.6 + h.entre(-0.4, 0.4), ht - haut - h.entre(0.6, 1.8), 0.08);
  }
  // Des stalactites et des racines qui pendent du haut
  for (let x = h.entre(0, 10); x < l; x += h.entre(12, 24)) {
    const larg = h.entre(2, 5);
    const long = h.entre(2, 5);
    c.beginPath();
    c.moveTo(x - larg, -1);
    c.quadraticCurveTo(x - larg * 0.3, long * 0.5, x, long);
    c.quadraticCurveTo(x + larg * 0.3, long * 0.5, x + larg, -1);
    c.fill();
    if (zone === "noyees" || zone === "coeur" || zone === "galeries") for (let i = 0; i < 3; i++) racine(c, h, x + h.entre(-larg, larg) * 0.5, long * 0.4, h.entre(2, 5), 0.18);
  }
  // Parfois, une chaîne au tout premier plan
  if (zone === "puits" || zone === "galeries") for (let i = 0; i < 2; i++) cable(c, h.entre(0, l), -1, h.entre(0, l), -1, h.entre(4, 9), 0.18);
}

type Peintre = (c: Pinceau, h: Hasard, l: number, ht: number, plan: number, accent: string, brume: string, couleur: string) => void;

function lueurs(c: Pinceau, h: Hasard, l: number, ht: number, n: number, couleur: string, force: number, taille: number) {
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) lueur(c, h.entre(0, l), h.entre(ht * 0.2, ht * 0.85), h.entre(taille * 0.5, taille), rgba(couleur), force * h.entre(0.4, 1));
  c.restore();
}

const PEINTRES: Record<Zone, Peintre> = {
  puits(c, h, l, ht, plan, accent, brume) {
    if (plan === 0) {
      // Des puits verticaux où tombe la lumière de la surface
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i++) {
        const x = h.entre(0, l);
        const g = c.createLinearGradient(0, 0, 0, ht * 0.9);
        g.addColorStop(0, rgba(accent).replace("ALPHA", "0.16"));
        g.addColorStop(1, rgba(accent).replace("ALPHA", "0"));
        c.fillStyle = g;
        c.beginPath();
        const w = h.entre(1.5, 4);
        c.moveTo(x - w * 0.3, 0);
        c.lineTo(x + w * 0.3, 0);
        c.lineTo(x + w * 1.6 + 3, ht);
        c.lineTo(x - w * 0.6 + 3, ht);
        c.fill();
      }
      c.restore();
      for (let i = 0; i < 3; i++) pilier(c, h, h.entre(0, l), h.entre(1.5, 3), ht);
      paroi(c, h, l, ht * 0.1, 2, 1, 30, ht);
      paroi(c, h, l, ht * 0.08, 1.5, -1, 10, ht);
      for (let i = 0; i < 3; i++) chevalement(c, h.entre(0, l), ht * h.entre(0.75, 0.95), h.entre(8, 13), h.entre(3, 5));
    } else if (plan === 1) {
      paroi(c, h, l, ht * 0.06, 2.5, 1, 40, ht);
      paroi(c, h, l, ht * 0.06, 2, -1, 14, ht);
      chevalement(c, l * h.entre(0.3, 0.7), ht * 0.88, ht * 0.5, ht * 0.18);
      for (let i = 0; i < 4; i++) {
        const x = h.entre(0, l);
        echelle(c, x, h.entre(0, ht * 0.4), ht, 0.7, 0.12);
      }
      for (let i = 0; i < 6; i++) cable(c, h.entre(0, l), h.entre(0, ht * 0.3), h.entre(0, l), h.entre(0, ht * 0.4), h.entre(1, 5), 0.08);
      pilier(c, h, h.entre(0, l), h.entre(2, 3), ht);
    } else {
      paroi(c, h, l, 1, 2.5, 1, 26, ht);
      paroi(c, h, l, 0.5, 1.5, -1, 8, ht);
      // Des échafaudages accrochés aux parois
      for (let i = 0; i < 3; i++) {
        const x = h.entre(0, l);
        const y = h.entre(ht * 0.2, ht * 0.7);
        poutre(c, x - 3, y, x + 3, y, 0.25);
        poutre(c, x - 2.5, y, x - 2.5, y + 6, 0.2);
        poutre(c, x + 2.5, y, x + 2.5, y + 6, 0.2);
        poutre(c, x - 2.5, y + 3, x + 2.5, y, 0.12);
        cable(c, x, y - 12, x, y - 1, 0, 0.06);
      }
    }
  },

  galeries(c, h, l, ht, plan, accent) {
    if (plan === 0) {
      // Des galeries qui s'enfoncent : des cadres de plus en plus petits vers un point de fuite
      for (let t = 0; t < 3; t++) {
        const fx = h.entre(l * 0.15, l * 0.85);
        const fy = h.entre(ht * 0.45, ht * 0.6);
        for (let i = 0; i < 9; i++) {
          const k = Math.pow(0.78, i);
          cadre(c, fx, fy + 4 * k, 6 * k, 6 * k, 0.4 * k);
        }
        c.save();
        c.globalCompositeOperation = "lighter";
        lueur(c, fx, fy + 1.5, 7, rgba(accent), 0.45);
        lueur(c, fx, fy + 1.5, 2, rgba("#ffe2b0"), 0.6);
        c.restore();
      }
      paroi(c, h, l, ht * 0.15, 2, 1, 20, ht);
      paroi(c, h, l, ht * 0.12, 1.5, -1, 6, ht);
    } else if (plan === 1) {
      paroi(c, h, l, ht * 0.12, 2, 1, 30, ht);
      paroi(c, h, l, ht * 0.1, 1.5, -1, 8, ht);
      const sol = ht * 0.88;
      for (let x = h.entre(0, 6); x < l; x += h.entre(7, 10)) cadre(c, x, sol, 6.5, 7, 0.45);
      poutre(c, 0, sol - 0.15, l, sol - 0.15, 0.12);
      for (let i = 0; i < 4; i++) cable(c, h.entre(0, l), sol - 6.5, h.entre(0, l), sol - 6.5, h.entre(0.5, 2), 0.06);
    } else {
      paroi(c, h, l, 0.8, 2, 1, 20, ht);
      for (let x = h.entre(0, 10); x < l; x += h.entre(12, 18)) {
        poutre(c, x, 0, x + h.entre(-0.4, 0.4), ht, 0.7);
        poutre(c, x - 2, ht * 0.15, x + 2, ht * 0.15, 0.4);
      }
      for (let i = 0; i < 5; i++) cable(c, h.entre(0, l), h.entre(0, 3), h.entre(0, l), h.entre(0, 3), h.entre(2, 4), 0.07);
    }
  },

  crevasse(c, h, l, ht, plan, accent) {
    if (plan === 0) {
      for (let i = 0; i < 9; i++) {
        const x = h.entre(0, l);
        c.beginPath();
        const larg = h.entre(2, 6);
        const haut = h.entre(ht * 0.3, ht * 0.9);
        c.moveTo(x - larg, ht);
        c.lineTo(x - larg * 0.2, ht - haut);
        c.lineTo(x + larg * 0.3, ht - haut * 0.95);
        c.lineTo(x + larg, ht);
        c.fill();
      }
      paroi(c, h, l, ht * 0.12, 3, 1, 40, ht);
      lueurs(c, h, l, ht, 14, accent, 0.18, 4);
    } else if (plan === 1) {
      for (let i = 0; i < 5; i++) pilier(c, h, h.entre(0, l), h.entre(2, 4), ht);
      paroi(c, h, l, ht * 0.06, 3, 1, 30, ht);
      paroi(c, h, l, ht * 0.06, 2, -1, 14, ht);
      for (let i = 0; i < 10; i++) {
        const haut = h.suivant() < 0.5;
        cristaux(c, h, h.entre(0, l), haut ? h.entre(1, 4) : ht - h.entre(1, 4), h.entre(1.5, 3.5), haut ? Math.PI : 0, h.entier(3, 6));
      }
      lueurs(c, h, l, ht, 8, accent, 0.12, 3);
    } else {
      paroi(c, h, l, 0.6, 2, 1, 22, ht);
      paroi(c, h, l, 0.4, 1, -1, 6, ht);
      for (let i = 0; i < 6; i++) cristaux(c, h, h.entre(0, l), h.entre(0.5, 2), h.entre(1, 2.5), Math.PI, h.entier(2, 5));
    }
  },

  noyees(c, h, l, ht, plan, accent, brume) {
    const eau = ht * 0.72;
    if (plan === 0) {
      paroi(c, h, l, ht * 0.14, 2, 1, 26, ht);
      for (let x = h.entre(0, 4); x < l; x += h.entre(8, 12)) arche(c, x, eau, h.entre(4, 6), h.entre(7, 10), 0.9);
      // Les reflets : la même chose à l'envers, en bandes tremblées
      c.save();
      c.globalAlpha = 0.35;
      c.drawImage(c.canvas, 0, 0, c.canvas.width, eau * (c.canvas.height / ht), 0, eau, l, ht - eau);
      c.restore();
      c.save();
      c.globalCompositeOperation = "destination-out";
      for (let y = eau; y < ht; y += 0.35) {
        c.fillStyle = `rgba(0,0,0,${0.2 + h.suivant() * 0.5})`;
        c.fillRect(0, y, l, 0.12);
      }
      c.restore();
      lueurs(c, h, l, ht, 8, accent, 0.1, 3);
    } else if (plan === 1) {
      paroi(c, h, l, ht * 0.08, 2.5, 1, 30, ht);
      for (let i = 0; i < 4; i++) {
        const x = h.entre(0, l);
        pilier(c, h, x, h.entre(1.5, 2.5), ht);
      }
      for (let i = 0; i < 18; i++) racine(c, h, h.entre(0, l), h.entre(0, ht * 0.1), h.entre(3, 9), 0.12);
    } else {
      paroi(c, h, l, 0.6, 2, 1, 16, ht);
      for (let i = 0; i < 14; i++) racine(c, h, h.entre(0, l), h.entre(0, 1.5), h.entre(3, 8), 0.16);
    }
    void brume;
  },

  coeur(c, h, l, ht, plan, accent) {
    if (plan === 0) {
      c.save();
      c.globalCompositeOperation = "lighter";
      lueur(c, l / 2, ht * 0.8, ht * 0.5, rgba(accent), 0.22);
      c.restore();
      // De grandes racines qui convergent vers le centre
      const o = onde(h);
      for (let i = 0; i < 14; i++) {
        const x0 = h.entre(-l * 0.2, l * 1.2);
        c.beginPath();
        c.moveTo(x0, -1);
        const cx = (x0 + l / 2) / 2 + (o(i) - 0.5) * 10;
        c.quadraticCurveTo(cx, ht * 0.5, l / 2 + h.entre(-4, 4), ht * 0.85);
        c.lineWidth = h.entre(0.5, 1.6);
        c.stroke();
      }
      paroi(c, h, l, ht * 0.1, 3, 1, 30, ht);
      paroi(c, h, l, ht * 0.1, 2, -1, 10, ht);
    } else if (plan === 1) {
      paroi(c, h, l, ht * 0.05, 3, 1, 30, ht);
      paroi(c, h, l, ht * 0.05, 2, -1, 10, ht);
      for (let i = 0; i < 4; i++) pilier(c, h, h.entre(0, l), h.entre(1.5, 3.5), ht);
      for (let i = 0; i < 20; i++) racine(c, h, h.entre(0, l), h.entre(0, ht * 0.1), h.entre(4, 12), 0.14);
      lueurs(c, h, l, ht, 10, accent, 0.1, 2.5);
    } else {
      paroi(c, h, l, 0.6, 2, 1, 16, ht);
      for (let i = 0; i < 16; i++) racine(c, h, h.entre(0, l), h.entre(0, 1.5), h.entre(4, 10), 0.18);
    }
  },
};
