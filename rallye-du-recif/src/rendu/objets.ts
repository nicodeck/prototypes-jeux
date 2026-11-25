// Les objets posés sur la piste : l'oursin qui roule et la méduse qui flotte.
// Et leurs icônes, dessinées en SVG pour le HUD.
import * as THREE from "three";
import type { NomObjet } from "../course/course";
import { ellipsoide, meche } from "./formes";
import { matToon, piece } from "./toon";

export function fabriquerOursin() {
  const g = new THREE.Group();
  const corps = matToon("#7a3fb8", { ombre: "#2c1250", rim: 1.2, brillance: 0.6 });
  const pique = matToon("#2a1840", { ombre: "#0f0818" });
  const boule = new THREE.Group();
  boule.add(piece(ellipsoide(0.55, 0.55, 0.55, 18, 14), corps, 1.1));
  // Des piquants répartis sur la sphère (spirale de Fibonacci)
  const n = 26;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const p = piece(new THREE.ConeGeometry(0.1, 0.65, 6), pique, 0.7);
    p.position.copy(dir).multiplyScalar(0.62);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    boule.add(p);
  }
  // Deux yeux en colère
  for (const s of [-1, 1]) {
    const oeil = piece(ellipsoide(0.13, 0.15, 0.06), matToon("#ffffff", { trame: 0 }), 0.6);
    oeil.position.set(s * 0.18, 0.12, 0.52);
    boule.add(oeil);
    const pupille = new THREE.Mesh(ellipsoide(0.06, 0.08, 0.03), new THREE.MeshBasicMaterial({ color: "#1b1220" }));
    pupille.position.set(s * 0.16, 0.1, 0.57);
    boule.add(pupille);
  }
  boule.name = "boule";
  boule.position.y = 0.7;
  g.add(boule);
  return g;
}

export function fabriquerMeduse() {
  const g = new THREE.Group();
  const corps = new THREE.Group();
  const rose = matToon("#ff8fd0", { ombre: "#b3407a", rim: 1.4, brillance: 0.8 });
  const clair = matToon("#ffd1ec", { ombre: "#d47aa8" });
  const dome = piece(new THREE.SphereGeometry(0.7, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), rose, 1.1);
  dome.scale.y = 0.85;
  corps.add(dome);
  const jupe = piece(new THREE.TorusGeometry(0.66, 0.1, 8, 20), clair, 0.8);
  jupe.rotation.x = Math.PI / 2;
  corps.add(jupe);
  // Les tentacules, qui ondulent
  const tentacules: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = piece(
      meche(
        [
          [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45],
          [Math.cos(a) * 0.55, -0.35, Math.sin(a) * 0.55],
          [Math.cos(a) * 0.45, -0.7, Math.sin(a) * 0.45],
        ],
        0.07,
        0.2,
        6,
      ),
      i % 2 ? rose : clair,
      0.7,
    );
    corps.add(t);
    tentacules.push(t);
  }
  // Un visage endormi
  for (const s of [-1, 1]) {
    const oeil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: "#1b1220" }));
    oeil.position.set(s * 0.22, 0.3, 0.58);
    oeil.rotation.z = Math.PI;
    corps.add(oeil);
  }
  corps.name = "corps";
  corps.position.y = 0.95;
  g.add(corps);
  return g;
}

/** Les icônes du HUD, en SVG. */
export const ICONES: Record<NomObjet, string> = {
  piment: `<svg viewBox="0 0 100 100"><path d="M62 18 q10 -8 18 -2" stroke="#1b1220" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M58 22 q16 4 14 22 q-4 30 -46 44 q-8 2 -6 -6 q20 -14 26 -40 q4 -18 12 -20z" fill="#e8322f" stroke="#1b1220" stroke-width="6" stroke-linejoin="round"/><path d="M52 30 q12 0 10 14 q-2 14 -10 22 l-8 -8 q8 -12 8 -28z" fill="#3fbf6a" stroke="#1b1220" stroke-width="5" stroke-linejoin="round" transform="translate(4 -14) scale(0.6) translate(38 10)"/><path d="M40 42 q4 -10 10 -12" stroke="#ffb3a8" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  oursin: `<svg viewBox="0 0 100 100"><g stroke="#1b1220" stroke-width="5" stroke-linejoin="round">${Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const x1 = 50 + Math.cos(a - 0.15) * 26;
    const y1 = 52 + Math.sin(a - 0.15) * 26;
    const x2 = 50 + Math.cos(a) * 46;
    const y2 = 52 + Math.sin(a) * 46;
    const x3 = 50 + Math.cos(a + 0.15) * 26;
    const y3 = 52 + Math.sin(a + 0.15) * 26;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)}z" fill="#2a1840"/>`;
  }).join("")}<circle cx="50" cy="52" r="28" fill="#7a3fb8"/></g><circle cx="41" cy="48" r="6" fill="#fff" stroke="#1b1220" stroke-width="3"/><circle cx="59" cy="48" r="6" fill="#fff" stroke="#1b1220" stroke-width="3"/><path d="M34 38 l12 6 M66 38 l-12 6" stroke="#1b1220" stroke-width="4" stroke-linecap="round"/></svg>`,
  meduse: `<svg viewBox="0 0 100 100"><g stroke="#1b1220" stroke-width="5" stroke-linecap="round" fill="none"><path d="M30 56 q-4 14 2 26"/><path d="M42 58 q4 14 -2 28"/><path d="M58 58 q-4 14 2 28"/><path d="M70 56 q4 14 -2 26"/></g><g stroke="#ff8fd0" stroke-width="2.5" stroke-linecap="round" fill="none"><path d="M30 56 q-4 14 2 26"/><path d="M42 58 q4 14 -2 28"/><path d="M58 58 q-4 14 2 28"/><path d="M70 56 q4 14 -2 26"/></g><path d="M16 58 q0 -42 34 -42 q34 0 34 42 q-8 6 -17 0 q-8 6 -17 0 q-8 6 -17 0 q-8 6 -17 0z" fill="#ff8fd0" stroke="#1b1220" stroke-width="6" stroke-linejoin="round"/><path d="M28 34 q6 -10 16 -12" stroke="#ffd1ec" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M38 44 q4 -4 8 0 M54 44 q4 -4 8 0" stroke="#1b1220" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  bulle: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="#bff3ff" fill-opacity="0.55" stroke="#1b1220" stroke-width="6"/><circle cx="50" cy="50" r="30" fill="none" stroke="#7fdcff" stroke-width="4"/><path d="M30 38 q6 -12 18 -14" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="64" cy="66" r="5" fill="#fff"/></svg>`,
};

export const NOMS_OBJETS: Record<NomObjet, string> = {
  piment: "Piment",
  oursin: "Oursin",
  meduse: "Méduse",
  bulle: "Bulle",
};
