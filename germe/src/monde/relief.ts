// La forme de la planète : collines douces, cratères, et les buttes où dorment les sources.
// La première source est enfermée dans une cuvette dont l'échancrure est bouchée par une pierre ;
// un lit de rivière en descend jusqu'à un cratère qui deviendra un lac.
import * as THREE from "three";
import { REGLAGES } from "../reglages";
import { bruit3, hasard, lisse } from "./bruit";
import type { Sphere } from "./sphere";

export interface PlanRelief {
  /** Directions des sources (la première est éveillée dès le départ). */
  sources: THREE.Vector3[];
  /** Direction de l'échancrure de la première source, et position de la pierre qui la bouche. */
  pierreBouchon: THREE.Vector3;
  /** Autres pierres que l'on peut pousser. */
  pierres: THREE.Vector3[];
  /** Point d'apparition du petit être. */
  depart: THREE.Vector3;
  /** Direction du regard au départ (tangente). */
  regard: THREE.Vector3;
  /** Graines posées au sol au départ. */
  graines: THREE.Vector3[];
  /** Le lit de la rivière, de la source au lac. */
  lit: THREE.Vector3[];
  /** Rochers de décor (direction + taille). */
  rochers: { dir: THREE.Vector3; taille: number }[];
}

const R = REGLAGES.planete.rayon;

/** Tourne `v` autour de l'axe `axe` (unitaire) d'un angle donné. */
function tourner(v: THREE.Vector3, axe: THREE.Vector3, angle: number) {
  return v.clone().applyAxisAngle(axe, angle);
}

/** Point situé à `distance` mètres de `origine`, dans la direction tangente `vers`. */
export function avancer(origine: THREE.Vector3, vers: THREE.Vector3, distance: number) {
  const axe = new THREE.Vector3().crossVectors(origine, vers).normalize();
  return tourner(origine, axe, distance / R).normalize();
}

export function genererRelief(sphere: Sphere, sol: Float32Array): PlanRelief {
  const alea = hasard(REGLAGES.planete.graine);
  const b1 = bruit3(REGLAGES.planete.graine);
  const b2 = bruit3(REGLAGES.planete.graine + 11);
  const b3 = bruit3(REGLAGES.planete.graine + 23);

  const s0 = new THREE.Vector3(0.15, 1, 0.25).normalize();
  // Une tangente à s0 : la direction de l'échancrure et de la rivière.
  const est = new THREE.Vector3(1, 0, 0).sub(s0.clone().multiplyScalar(s0.x)).normalize();
  const sortie = tourner(est, s0, 0.6).normalize();
  const pierreBouchon = avancer(s0, sortie, 1.75);
  const lac = avancer(s0, sortie, 14);

  // Sources endormies : réparties loin de la première.
  const sources = [s0];
  const essais: THREE.Vector3[] = [
    new THREE.Vector3(-0.9, -0.35, 0.5),
    new THREE.Vector3(0.65, -0.55, -0.75),
    new THREE.Vector3(-0.25, -0.2, -1),
  ];
  for (let i = 0; i < REGLAGES.sources.endormies && i < essais.length; i++) sources.push(essais[i].normalize());

  // Cratères (évitent les sources)
  const crateres: { c: THREE.Vector3; r: number; p: number }[] = [{ c: lac, r: 3.4, p: 0.75 }];
  while (crateres.length < 7) {
    const c = new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize();
    if (sources.some((s) => s.angleTo(c) * R < 9)) continue;
    if (crateres.some((k) => k.c.angleTo(c) * R < k.r + 6)) continue;
    crateres.push({ c, r: 2 + alea() * 2.2, p: 0.4 + alea() * 0.4 });
  }

  // Le lit de la rivière : une suite de points qui serpente de l'échancrure au lac.
  const lit: THREE.Vector3[] = [];
  const cote = new THREE.Vector3().crossVectors(s0, sortie).normalize();
  for (let k = 0; k <= 40; k++) {
    const f = k / 40;
    const p = s0.clone().lerp(lac, f).normalize();
    const ecart = Math.sin(f * Math.PI * 2.2) * 1.4 * Math.sin(f * Math.PI) * lisse(0.15, 0.35, f);
    lit.push(p.add(cote.clone().multiplyScalar(ecart / R)).normalize());
  }

  const d = sphere.dir;
  const v = new THREE.Vector3();
  for (let i = 0; i < sphere.n; i++) {
    v.set(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
    // Le bruit s'apaise près des sources et du lit de la rivière, pour que l'eau suive le chemin prévu.
    let calme = 1;
    for (const src of sources) calme = Math.min(calme, 1 - 0.8 * Math.exp(-(((v.angleTo(src) * R) / 3.2) ** 2)));
    let dLit = Infinity;
    let fLit = 0;
    for (let k = 0; k < lit.length; k++) {
      const dd = v.angleTo(lit[k]) * R;
      if (dd < dLit) {
        dLit = dd;
        fLit = k / (lit.length - 1);
      }
    }
    calme = Math.min(calme, 1 - 0.6 * Math.exp(-((dLit / 2.5) ** 2)));
    let h =
      0.6 * b1(v.x * 1.1, v.y * 1.1, v.z * 1.1) +
      0.3 * b2(v.x * 2.7, v.y * 2.7, v.z * 2.7) +
      0.12 * b3(v.x * 6.5, v.y * 6.5, v.z * 6.5);
    h *= REGLAGES.planete.relief * calme;
    // Un grain fin de dunes
    h += 0.05 * b3(v.x * 18, v.y * 18, v.z * 18);

    for (const k of crateres) {
      const dist = v.angleTo(k.c) * R;
      if (dist < k.r * 1.8) {
        const x = dist / k.r;
        if (x < 1) h -= k.p * (1 - x * x);
        h += k.p * 0.45 * Math.exp(-(((x - 1) / 0.32) ** 2));
      }
    }

    // Les buttes des sources, avec leur cuvette bordée d'un bourrelet (profil dessiné, sans bruit)
    for (let s = 0; s < sources.length; s++) {
      const dist = v.angleTo(sources[s]) * R;
      if (dist > 9) continue;
      h += 1.3 * Math.exp(-((dist / 4.2) ** 2));
      const profil = dist < 1.65 ? 0.55 + 1.0 * (dist / 1.65) ** 2 : 1.55 - (dist - 1.65) * 0.45;
      const w = 1 - lisse(2.2, 3.4, dist);
      h += (profil - h) * w;
    }

    // Le lit de la rivière : il entaille le bourrelet (l'échancrure que bouche la pierre),
    // puis son fond descend régulièrement jusqu'au lac. Ses berges sont raides près de la source.
    {
      const dS0 = v.angleTo(s0) * R;
      if (dLit < 2.6 && dS0 > 0.7) {
        const fond = 0.55 - 1.15 * fLit;
        const raideur = 1.6 + (0.25 - 1.6) * lisse(0.1, 0.3, fLit);
        const berge = fond + raideur * dLit * dLit;
        const melange = lisse(0.7, 1.1, dS0) * (1 - lisse(1.9, 2.6, dLit));
        if (berge < h) h += (berge - h) * melange;
      }
    }

    sol[i] = h;
  }

  // Départ : un peu à l'écart de la source, face à elle.
  const depart = avancer(s0, tourner(sortie, s0, 2.2), 5.5);
  const regard = s0.clone().sub(depart.clone().multiplyScalar(depart.dot(s0))).normalize();

  // Graines : deux près du départ, les autres éparpillées (une près de chaque source endormie).
  const graines: THREE.Vector3[] = [
    avancer(depart, regard.clone().applyAxisAngle(depart, 0.9), 2.4),
  ];
  for (let s = 1; s < sources.length; s++) {
    const t = new THREE.Vector3(alea() - 0.5, alea() - 0.5, alea() - 0.5);
    t.sub(sources[s].clone().multiplyScalar(t.dot(sources[s]))).normalize();
    graines.push(avancer(sources[s], t, 5 + alea() * 2));
  }
  while (graines.length < REGLAGES.sources.grainesEparpillees + 1) {
    const c = new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize();
    if (graines.some((g) => g.angleTo(c) * R < 7)) continue;
    if (sources.some((s) => s.angleTo(c) * R < 3)) continue;
    graines.push(c);
  }

  // Pierres à pousser (décor jouable) et rochers.
  const pierres: THREE.Vector3[] = [];
  while (pierres.length < 6) {
    const c = new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize();
    if (sources.some((s) => s.angleTo(c) * R < 4)) continue;
    if (c.angleTo(depart) * R < 4) continue;
    pierres.push(c);
  }
  const rochers: { dir: THREE.Vector3; taille: number }[] = [];
  while (rochers.length < 70) {
    const c = new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize();
    if (sources.some((s) => s.angleTo(c) * R < 2.6)) continue;
    if (lit.some((l) => l.angleTo(c) * R < 1.8)) continue;
    if (c.angleTo(depart) * R < 2) continue;
    const t = alea();
    rochers.push({ dir: c, taille: 0.15 + t * t * 0.7 });
  }

  return { lit, sources, pierreBouchon, pierres, depart, regard, graines, rochers };
}
