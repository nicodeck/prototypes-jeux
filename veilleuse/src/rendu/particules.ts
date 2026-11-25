// Les particules : poussière qui flotte dans la lumière, gouttes qui tombent des plafonds,
// étincelles des lanternes, lucioles, phalènes autour de la lanterne de Veilleuse, bulles,
// éclaboussures. Toutes dans un seul nuage de points, additif.
import * as THREE from "three";
import { ROCHE, PLANCHE, caseEn, eauEn, type Mine } from "../monde/mine";
import { graine } from "./bruit";
import { lumiereEn, type Lumiere } from "./lumieres";

const MAX = 3000;

type Sorte = "poussiere" | "etincelle" | "goutte" | "eclat" | "luciole" | "phalene" | "bulle" | "nuage" | "pollen";

type P = {
  sorte: Sorte;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
  taille: number;
  couleur: THREE.Color;
  force: number;
  phase: number;
};

export type Vue = { x: number; y: number; l: number; h: number };

export function creerParticules(mine: Mine) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const taille = new Float32Array(MAX);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("couleur", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("taille", new THREE.BufferAttribute(taille, 1));
  const uniforms = { uEchelle: { value: 60 } };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 couleur;
        attribute float taille;
        uniform float uEchelle;
        varying vec3 vCouleur;
        void main() {
          vCouleur = couleur;
          gl_PointSize = max(1.0, taille * uEchelle);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCouleur;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vCouleur * a * a, 1.0);
        }
      `,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = -15;

  const h = graine(77);
  const liste: P[] = [];
  const ajouter = (p: Partial<P> & { sorte: Sorte; x: number; y: number }) => {
    if (liste.length >= MAX) return;
    liste.push({ vx: 0, vy: 0, vie: 0, duree: 1, taille: 0.06, couleur: new THREE.Color(1, 1, 1), force: 1, phase: h.entre(0, 100), ...p });
  };

  // Les endroits d'où tombent des gouttes : des plafonds au-dessus d'un vide assez haut
  const gouttieres: { x: number; y: number; prochaine: number; periode: number }[] = [];
  for (let l = 1; l < mine.hauteur - 4; l++) {
    for (let c = 1; c < mine.largeur - 1; c++) {
      if (caseEn(mine, c, l) === ROCHE || caseEn(mine, c, l - 1) !== ROCHE) continue;
      if (caseEn(mine, c, l + 1) === ROCHE || caseEn(mine, c, l + 2) === ROCHE) continue;
      if (h.suivant() < 0.12) gouttieres.push({ x: c + h.entre(0.2, 0.8), y: -l, prochaine: h.entre(0, 8), periode: h.entre(3, 9) });
    }
  }

  const solide = (x: number, y: number) => {
    const c = Math.floor(x);
    const l = Math.floor(-y);
    const k = caseEn(mine, c, l);
    return k === ROCHE || (k === PLANCHE && -y - l < 0.3);
  };
  const mouille = (x: number, y: number) => eauEn(mine, Math.floor(x), Math.floor(-y + 0.12));

  const blanc = new THREE.Color("#fff3e0");
  const orange = new THREE.Color("#ffb35c");
  const eauClaire = new THREE.Color("#9fd6e0");

  let poussieres = 0;
  let lucioles = 0;
  let phalenes = 0;
  let accumEtincelles = 0;

  return {
    points,
    uniforms,
    /** Une gerbe d'étincelles (allumage d'une lanterne). */
    gerbe(x: number, y: number, n: number, couleur = orange) {
      for (let i = 0; i < n; i++) {
        const a = h.entre(0, Math.PI * 2);
        const v = h.entre(0.5, 4);
        ajouter({ sorte: "etincelle", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1.5, duree: h.entre(0.8, 2.2), taille: h.entre(0.04, 0.1), couleur: couleur.clone().multiplyScalar(h.entre(2, 5)) });
      }
    },
    eclaboussure(x: number, y: number, force: number) {
      for (let i = 0; i < 10 * force + 4; i++) {
        ajouter({ sorte: "eclat", x: x + h.entre(-0.3, 0.3), y, vx: h.entre(-2, 2) * force, vy: h.entre(2, 6) * force, duree: h.entre(0.4, 0.9), taille: h.entre(0.03, 0.07), couleur: eauClaire.clone().multiplyScalar(0.8) });
      }
    },
    nuage(x: number, y: number, force: number) {
      for (let i = 0; i < 6 * force + 2; i++) {
        ajouter({ sorte: "nuage", x: x + h.entre(-0.3, 0.3), y: y + 0.05, vx: h.entre(-1.2, 1.2), vy: h.entre(0.1, 0.6), duree: h.entre(0.5, 1), taille: h.entre(0.12, 0.25), couleur: blanc.clone().multiplyScalar(0.06) });
      }
    },
    bulle(x: number, y: number) {
      ajouter({ sorte: "bulle", x, y, vx: h.entre(-0.2, 0.2), vy: h.entre(0.8, 1.5), duree: 3, taille: h.entre(0.04, 0.09), couleur: eauClaire.clone().multiplyScalar(0.5) });
    },
    /** Le Cœur se rallume : des milliers de lueurs montent. */
    envol(x: number, y: number, n: number, couleur: THREE.Color) {
      for (let i = 0; i < n; i++) {
        ajouter({ sorte: "pollen", x: x + h.entre(-20, 20), y: y + h.entre(-2, 30), vx: h.entre(-0.3, 0.3), vy: h.entre(0.3, 1.5), duree: h.entre(4, 10), taille: h.entre(0.04, 0.12), couleur: couleur.clone().lerp(orange, h.suivant() * 0.5).multiplyScalar(h.entre(1, 3)) });
      }
    },

    mettreAJour(dt: number, temps: number, vue: Vue, lumieres: Lumiere[], heros: { x: number; y: number; lx: number; ly: number }, zone: string, lanternes: { x: number; y: number }[], allumees: boolean[], surGoutte: (x: number, y: number, dansLEau: boolean) => void) {
      const marge = 3;
      const dedans = (x: number, y: number, m = marge) => Math.abs(x - vue.x) < vue.l + m && Math.abs(y - vue.y) < vue.h + m;

      // La poussière : toujours environ 260 grains autour de la caméra
      while (poussieres < 260) {
        poussieres++;
        ajouter({ sorte: "poussiere", x: vue.x + h.entre(-vue.l - marge, vue.l + marge), y: vue.y + h.entre(-vue.h - marge, vue.h + marge), duree: 1e9, taille: h.entre(0.025, 0.07), couleur: new THREE.Color() });
      }
      const veutLucioles = zone === "noyees" || zone === "coeur" ? 36 : zone === "crevasse" ? 14 : 0;
      while (lucioles < veutLucioles) {
        lucioles++;
        ajouter({ sorte: "luciole", x: vue.x + h.entre(-vue.l, vue.l), y: vue.y + h.entre(-vue.h, vue.h), duree: 1e9, taille: h.entre(0.05, 0.09), couleur: new THREE.Color() });
      }
      while (phalenes < 3) {
        phalenes++;
        ajouter({ sorte: "phalene", x: heros.lx, y: heros.ly, duree: 1e9, taille: 0.06, couleur: new THREE.Color() });
      }

      // Les étincelles des lanternes allumées
      accumEtincelles += dt;
      while (accumEtincelles > 0.12) {
        accumEtincelles -= 0.12;
        lanternes.forEach((l, i) => {
          if (!allumees[i] || !dedans(l.x, l.y) || h.suivant() > 0.35) return;
          ajouter({ sorte: "etincelle", x: l.x + h.entre(-0.08, 0.08), y: l.y + 0.15, vx: h.entre(-0.15, 0.15), vy: h.entre(0.4, 1.1), duree: h.entre(1, 2.5), taille: h.entre(0.03, 0.06), couleur: orange.clone().multiplyScalar(h.entre(2, 4)) });
        });
      }

      // Les gouttes
      for (const g of gouttieres) {
        if (!dedans(g.x, g.y, 1)) continue;
        g.prochaine -= dt;
        if (g.prochaine <= 0) {
          g.prochaine = g.periode * h.entre(0.6, 1.4);
          ajouter({ sorte: "goutte", x: g.x, y: g.y - 0.1, duree: 8, taille: 0.05, couleur: eauClaire.clone() });
        }
      }

      const accent = zone === "noyees" ? new THREE.Color("#a6ffcf") : zone === "coeur" ? new THREE.Color("#ffc4e4") : new THREE.Color("#8ff4ff");

      let n = 0;
      for (let i = liste.length - 1; i >= 0; i--) {
        const p = liste[i];
        p.vie += dt;
        let alpha = 1;
        switch (p.sorte) {
          case "poussiere": {
            p.x += (Math.sin(temps * 0.21 + p.phase) * 0.08 + Math.sin(temps * 0.5 + p.phase * 3) * 0.03) * dt;
            p.y += (Math.cos(temps * 0.17 + p.phase * 2) * 0.06 - 0.02) * dt;
            if (!dedans(p.x, p.y)) {
              p.x = vue.x + h.entre(-vue.l - marge, vue.l + marge);
              p.y = vue.y + h.entre(-vue.h - marge, vue.h + marge);
              if (h.suivant() < 0.5) p.x = vue.x + Math.sign(p.x - vue.x) * (vue.l + marge * h.entre(0.3, 1));
            }
            const l = lumiereEn(lumieres, p.x, p.y);
            const scintille = 0.7 + 0.3 * Math.sin(temps * 2 + p.phase * 7);
            p.couleur.setRGB(1, 0.92, 0.8).multiplyScalar((0.025 + Math.min(1.6, l) * 0.9) * scintille);
            break;
          }
          case "luciole": {
            const a = temps * 0.4 + p.phase;
            p.vx += (Math.sin(a * 1.3) * 0.6 - p.vx) * dt;
            p.vy += (Math.cos(a * 0.9 + p.phase) * 0.4 - p.vy) * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (!dedans(p.x, p.y) || veutLucioles === 0) {
              if (veutLucioles === 0) {
                liste.splice(i, 1);
                lucioles--;
                continue;
              }
              p.x = vue.x + h.entre(-vue.l, vue.l);
              p.y = vue.y + h.entre(-vue.h, vue.h);
            }
            const clignote = Math.pow(Math.max(0, Math.sin(temps * 0.9 + p.phase * 5)), 3);
            p.couleur.copy(accent).multiplyScalar(0.3 + clignote * 2.5);
            break;
          }
          case "phalene": {
            const a = temps * (1.6 + (p.phase % 1)) + p.phase;
            const r = 0.35 + 0.15 * Math.sin(temps * 0.7 + p.phase);
            const cx = heros.lx + Math.cos(a) * r + Math.sin(temps * 13 + p.phase) * 0.03;
            const cy = heros.ly + 0.15 + Math.sin(a * 1.4) * r * 0.6;
            p.x += (cx - p.x) * Math.min(1, dt * 6);
            p.y += (cy - p.y) * Math.min(1, dt * 6);
            const aile = 0.5 + 0.5 * Math.abs(Math.sin(temps * 30 + p.phase));
            p.couleur.setRGB(1, 0.85, 0.6).multiplyScalar(0.35 * aile);
            break;
          }
          case "etincelle": {
            p.vx += Math.sin(temps * 5 + p.phase) * 0.6 * dt;
            p.vy -= 0.6 * dt;
            p.vx *= 1 - dt * 1.2;
            p.vy *= 1 - dt * 1.2;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            alpha = (1 - p.vie / p.duree) * (0.6 + 0.4 * Math.sin(temps * 30 + p.phase));
            break;
          }
          case "goutte": {
            p.vy -= 22 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (solide(p.x, p.y) || mouille(p.x, p.y)) {
              const eau = mouille(p.x, p.y);
              surGoutte(p.x, p.y, eau);
              for (let k = 0; k < 4; k++) ajouter({ sorte: "eclat", x: p.x, y: p.y + 0.05, vx: h.entre(-1.2, 1.2), vy: h.entre(1, 2.5), duree: 0.35, taille: 0.025, couleur: eauClaire.clone().multiplyScalar(0.6) });
              p.vie = p.duree;
            }
            const l = lumiereEn(lumieres, p.x, p.y);
            alpha = 0.25 + Math.min(1.5, l);
            p.taille = 0.04 + Math.min(0.03, -p.vy * 0.003);
            break;
          }
          case "eclat": {
            p.vy -= 14 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            alpha = 1 - p.vie / p.duree;
            break;
          }
          case "nuage": {
            p.vx *= 1 - dt * 3;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            alpha = 1 - p.vie / p.duree;
            break;
          }
          case "bulle": {
            p.x += (p.vx + Math.sin(temps * 6 + p.phase) * 0.3) * dt;
            p.y += p.vy * dt;
            if (!mouille(p.x, p.y + 0.15)) p.vie = p.duree;
            break;
          }
          case "pollen": {
            p.x += (p.vx + Math.sin(temps * 0.8 + p.phase) * 0.3) * dt;
            p.y += p.vy * dt;
            const t = p.vie / p.duree;
            alpha = Math.min(1, t * 5) * (1 - t);
            break;
          }
        }
        if (p.vie >= p.duree) {
          liste.splice(i, 1);
          continue;
        }
        if (!dedans(p.x, p.y, 4)) continue;
        if (n >= MAX) continue;
        pos[n * 3] = p.x;
        pos[n * 3 + 1] = p.y;
        pos[n * 3 + 2] = 0;
        col[n * 3] = p.couleur.r * alpha;
        col[n * 3 + 1] = p.couleur.g * alpha;
        col[n * 3 + 2] = p.couleur.b * alpha;
        taille[n] = p.taille * (p.sorte === "poussiere" || p.sorte === "luciole" ? 1 : 1);
        n++;
      }
      geo.setDrawRange(0, n);
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute("couleur") as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute("taille") as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}
