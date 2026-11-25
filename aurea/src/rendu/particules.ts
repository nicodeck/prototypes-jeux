// Les particules et les lumières : fumées des cheminées et du four, vapeur des thermes, poussière
// des chantiers, étincelles des feux, pluie, lucioles la nuit, poussières dorées dans la lumière
// du soir, pétales de la fête. Et, la nuit, de vraies lumières (quelques lampes ponctuelles
// attribuées aux torches et aux feux les plus proches du regard), plus un halo autour de chaque
// flamme.
import * as THREE from "three";
import { hachage } from "../ville/hasard";
import { hauteur } from "../ville/ile";
import type { Evenement, Ville } from "../ville/ville";
import { ATMO, GLSL_COMMUN } from "./atmosphere";
import type { EmetteurMonde } from "./batiments";
import { CRATERE } from "./lointain";

const MAX = 6000;

/** Sortes de particules : la couleur, le mélange et la façon de vivre en découlent */
const enum S {
  Fumee = 0,
  Vapeur = 1,
  Poussiere = 2,
  Etincelle = 3,
  Petale = 4,
  Luciole = 5,
  Paillette = 6,
  Ecume = 7,
}

const ADDITIVES = new Set([S.Etincelle, S.Luciole, S.Paillette]);

interface Particule {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  vie: number;
  taille: number;
  croissance: number;
  sorte: S;
  graine: number;
}

function systeme(additif: boolean) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aDonnees", new THREE.BufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...ATMO, uEchelle: { value: 800 } },
    transparent: true,
    depthWrite: false,
    blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      uniform float uEchelle;
      attribute vec4 aDonnees; // taille, âge relatif, sorte, graine
      varying vec4 vDonnees;
      varying vec3 vMonde;
      void main() {
        vDonnees = aDonnees;
        vMonde = position;
        vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aDonnees.x * uEchelle / max(-mv.z, 0.1), 0.0, 260.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMUN}
      varying vec4 vDonnees;
      varying vec3 vMonde;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        if (r > 1.0) discard;
        float age = vDonnees.y;
        float sorte = vDonnees.z;
        float graine = vDonnees.w;
        vec3 ambiance = couleurCiel(vec3(0.0, 1.0, 0.0));
        vec3 soleil = uLumiereCouleur * ombreNuages(vMonde);
        vec4 c;
        if (sorte < 0.5 || (sorte > 0.5 && sorte < 1.5) || (sorte > 6.5)) {
          // Fumée, vapeur, écume : une bouffée douce, bosselée, éclairée par le ciel et le soleil
          float bosses = bruitTex(q * 0.6 + graine * 3.0 + age * 0.15).a;
          float a = smoothstep(1.0, 0.25, r + (bosses - 0.5) * 0.6);
          vec3 albedo = sorte < 0.5 ? vec3(0.62, 0.6, 0.58) : vec3(0.92, 0.93, 0.95);
          float lumiere = 0.55 + 0.45 * clamp(dot(normalize(vec3(q.x, -q.y, 0.6)), normalize(uLumiereDir + vec3(0.0, 0.3, 0.0))), 0.0, 1.0);
          c.rgb = albedo * (ambiance * 0.9 + soleil * 0.3 * lumiere);
          float vieillesse = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.55, 1.0, age));
          c.a = a * vieillesse * (sorte < 0.5 ? 0.28 : sorte > 6.5 ? 0.7 : 0.22);
        } else if (sorte < 2.5) {
          // Poussière de chantier
          float a = smoothstep(1.0, 0.1, r);
          c.rgb = vec3(0.55, 0.45, 0.32) * (ambiance * 0.8 + soleil * 0.35);
          c.a = a * (1.0 - age) * 0.5;
        } else if (sorte < 3.5) {
          // Étincelle
          float a = smoothstep(1.0, 0.0, r);
          c.rgb = vec3(3.0, 1.2, 0.35) * a * (1.0 - age);
          c.a = 1.0;
        } else if (sorte < 4.5) {
          // Pétale de rose
          float a = smoothstep(1.0, 0.6, length(q * vec2(1.0, 1.8)) * 2.0);
          c.rgb = mix(vec3(0.9, 0.25, 0.35), vec3(1.0, 0.85, 0.4), step(0.7, graine)) * (ambiance * 0.6 + soleil * 0.5);
          c.a = a * (1.0 - smoothstep(0.8, 1.0, age));
        } else if (sorte < 5.5) {
          // Luciole : elle clignote
          float a = exp(-r * r * 6.0);
          float clignote = pow(max(sin(uTemps * (2.0 + graine * 3.0) + graine * 40.0), 0.0), 6.0);
          c.rgb = vec3(0.7, 1.0, 0.35) * a * clignote * 2.5 * uNuit;
          c.a = 1.0;
        } else {
          // Poussière dorée dans la lumière rasante
          float a = exp(-r * r * 5.0);
          float scintille = 0.5 + 0.5 * sin(uTemps * 3.0 + graine * 50.0);
          c.rgb = uLumiereCouleur * a * scintille * 0.25 * sin(age * 3.1416);
          c.a = 1.0;
        }
        c.rgb = brume(c.rgb, vMonde);
        gl_FragColor = c;
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return points;
}

/** Les halos des flammes : de grands disques additifs qui vacillent */
function halos() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(1200 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aDonnees", new THREE.BufferAttribute(new Float32Array(1200 * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...ATMO, uEchelle: { value: 800 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uEchelle;
      uniform float uTemps;
      uniform float uNuit;
      attribute vec2 aDonnees; // taille, graine
      varying float vGraine;
      varying float vVacille;
      void main() {
        vGraine = aDonnees.y;
        vVacille = 0.75 + 0.25 * sin(uTemps * (9.0 + vGraine * 7.0) + vGraine * 30.0) * sin(uTemps * 3.7 + vGraine * 11.0);
        vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aDonnees.x * (0.35 + 0.65 * uNuit) * uEchelle / max(-mv.z, 0.1), 0.0, 300.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNuit;
      varying float vGraine;
      varying float vVacille;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        float coeur = exp(-r * r * 40.0) * 1.4;
        float halo = exp(-r * r * 6.0) * 0.16;
        vec3 c = vec3(1.0, 0.55, 0.2) * (coeur + halo) * vVacille * (0.3 + 0.9 * uNuit);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  p.renderOrder = 4;
  return p;
}

export class Particules {
  readonly groupe = new THREE.Group();
  private readonly normales = systeme(false);
  private readonly additives = systeme(true);
  private readonly halos = halos();
  private readonly pluie: THREE.LineSegments;
  /** Les lumières de la nuit (position, portée) et leur force, pour l'éclairage de l'après-rendu */
  readonly lumieres: { pos: THREE.Vector3; portee: number; force: number }[] = [];
  private readonly liste: Particule[] = [];
  private accumulateurs = new Map<number, number>();
  private alea = 1;
  private volcan = 0;

  constructor() {
    this.groupe.add(this.normales, this.additives, this.halos);
    // La pluie : des traits qui tombent autour de la caméra
    const n = 3500;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.pluie = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.0, depthWrite: false }));
    this.pluie.frustumCulled = false;
    this.groupe.add(this.pluie);

  }

  private hasard() {
    this.alea = (this.alea * 16807) % 2147483647;
    return this.alea / 2147483647;
  }

  emettre(sorte: S, x: number, y: number, z: number, o: Partial<Particule> = {}) {
    if (this.liste.length >= MAX) return;
    const r = () => this.hasard() - 0.5;
    this.liste.push({
      x,
      y,
      z,
      vx: r() * 0.1,
      vy: 0.3,
      vz: r() * 0.1,
      age: 0,
      vie: 5,
      taille: 0.4,
      croissance: 0.25,
      sorte,
      graine: this.hasard(),
      ...o,
    });
  }

  /** Poussière d'un chantier ou d'une démolition, paillettes d'or d'une montée de niveau */
  evenements(evenements: Evenement[], v: Ville) {
    for (const e of evenements) {
      if (e.sorte === "pose" || e.sorte === "demoli" || e.sorte === "evolution") {
        const b = e.sorte === "demoli" ? e : v.batiments.get(e.id);
        if (!b) continue;
        const nb = Math.min(40, b.l * b.p * 4);
        for (let k = 0; k < nb; k++) {
          const x = b.i + this.hasard() * b.l;
          const z = b.j + this.hasard() * b.p;
          this.emettre(S.Poussiere, x, hauteur(x, z) + 0.15, z, { vy: 0.25 + this.hasard() * 0.3, vx: (this.hasard() - 0.5) * 0.6, vz: (this.hasard() - 0.5) * 0.6, vie: 2.2 + this.hasard(), taille: 0.6, croissance: 0.5 });
        }
        if (e.sorte === "evolution") {
          for (let k = 0; k < 30; k++) {
            const x = b.i + this.hasard() * b.l;
            const z = b.j + this.hasard() * b.p;
            this.emettre(S.Paillette, x, hauteur(x, z) + 1 + this.hasard() * 1.5, z, { vy: 0.4 + this.hasard() * 0.4, vie: 2.5, taille: 0.18, croissance: 0 });
          }
        }
      }
    }
  }

  mettreAJour(dt: number, v: Ville, emetteurs: EmetteurMonde[], camera: THREE.PerspectiveCamera, cible: THREE.Vector3, fete: boolean, lanternes: THREE.Vector3[] = []) {
    const h = v.horloge.heure;
    const nuit = ATMO.uNuit.value;
    const vent = ATMO.uVent.value;
    const pluie = v.horloge.ciel.pluie;
    // Les foyers fument surtout le matin et le soir
    const foyers = 0.25 + 0.75 * (Math.exp(-((h - 7.5) ** 2) / 3) + Math.exp(-((h - 19) ** 2) / 4));

    // Les émetteurs des bâtiments
    for (let n = 0; n < emetteurs.length; n++) {
      const e = emetteurs[n]!;
      let taux = 0;
      if (e.sorte === "fumee") taux = e.type === "boulangerie" ? 1.6 : e.type === "maison" ? (hachage(e.batiment, 3, 3) < 0.35 ? 0.7 * foyers : 0) : 0.8;
      else if (e.sorte === "vapeur") taux = 1.2;
      else if (e.sorte === "feu") taux = 3 + nuit * 4;
      if (!taux) continue;
      const acc = (this.accumulateurs.get(n) ?? hachage(n, 1, 1)) + taux * dt;
      let k = Math.floor(acc);
      this.accumulateurs.set(n, acc - k);
      while (k-- > 0) {
        const p = e.pos;
        if (e.sorte === "fumee") this.emettre(S.Fumee, p.x, p.y, p.z, { vy: 0.32 + this.hasard() * 0.15, vie: 5 + this.hasard() * 2.5, taille: 0.22, croissance: 0.22 });
        else if (e.sorte === "vapeur") this.emettre(S.Vapeur, p.x + (this.hasard() - 0.5) * 0.6, p.y, p.z + (this.hasard() - 0.5) * 0.6, { vy: 0.4, vie: 3.5, taille: 0.5, croissance: 0.45 });
        else {
          this.emettre(S.Etincelle, p.x, p.y + 0.1, p.z, { vy: 0.8 + this.hasard() * 0.8, vx: (this.hasard() - 0.5) * 0.3, vz: (this.hasard() - 0.5) * 0.3, vie: 0.9 + this.hasard() * 0.6, taille: 0.07, croissance: 0 });
          if (this.hasard() < 0.25) this.emettre(S.Fumee, p.x, p.y + 0.3, p.z, { vy: 0.5, vie: 4, taille: 0.3, croissance: 0.3 });
        }
      }
    }

    // Le panache du volcan, au loin
    this.volcan += dt * 0.5;
    while (this.volcan >= 1) {
      this.volcan--;
      this.emettre(S.Fumee, CRATERE.x + (this.hasard() - 0.5) * 8, CRATERE.y, CRATERE.z + (this.hasard() - 0.5) * 8, { vy: 2.6 + this.hasard(), vx: 0, vz: 0, vie: 70, taille: 18, croissance: 1.1 });
    }

    // Autour du regard : lucioles la nuit, poussières dorées au soleil couchant, pétales de fête
    const r = () => this.hasard() - 0.5;
    const rayon = Math.min(40, 6 + camera.position.distanceTo(cible) * 0.4);
    if (nuit > 0.5 && this.hasard() < dt * 12) {
      const x = cible.x + r() * rayon * 1.5;
      const z = cible.z + r() * rayon * 1.5;
      const y = hauteur(x, z);
      if (y > 0.3) this.emettre(S.Luciole, x, y + 0.3 + this.hasard() * 0.8, z, { vy: 0.02, vx: r() * 0.3, vz: r() * 0.3, vie: 8, taille: 0.12, croissance: 0 });
    }
    const dore = ATMO.uSoleilDir.value.y < 0.35 && ATMO.uSoleilDir.value.y > 0.02 ? 1 : 0;
    if (dore && camera.position.distanceTo(cible) < 18 && this.hasard() < dt * 25) {
      const x = cible.x + r() * 10;
      const z = cible.z + r() * 10;
      this.emettre(S.Paillette, x, hauteur(x, z) + 0.3 + this.hasard() * 2.5, z, { vy: 0.03, vx: r() * 0.15, vz: r() * 0.15, vie: 6, taille: 0.05, croissance: 0 });
    }
    if (fete) {
      for (let k = 0; k < 6; k++) {
        const x = cible.x + r() * rayon;
        const z = cible.z + r() * rayon;
        this.emettre(S.Petale, x, hauteur(x, z) + 6 + this.hasard() * 4, z, { vy: -0.6, vx: r() * 0.5, vz: r() * 0.5, vie: 9, taille: 0.13, croissance: 0 });
      }
    }

    // On fait vivre et on écrit les tampons
    const posN = this.normales.geometry.attributes.position as THREE.BufferAttribute;
    const donN = this.normales.geometry.attributes.aDonnees as THREE.BufferAttribute;
    const posA = this.additives.geometry.attributes.position as THREE.BufferAttribute;
    const donA = this.additives.geometry.attributes.aDonnees as THREE.BufferAttribute;
    let nN = 0;
    let nA = 0;
    const vivantes: Particule[] = [];
    for (const p of this.liste) {
      p.age += dt;
      if (p.age >= p.vie) continue;
      const ventFort = p.sorte === S.Fumee || p.sorte === S.Vapeur ? 0.9 : p.sorte === S.Petale ? 0.7 : 0.3;
      p.vx += vent.x * ventFort * dt * 0.6;
      p.vz += vent.y * ventFort * dt * 0.6;
      if (p.sorte === S.Etincelle) p.vy -= dt * 0.6;
      if (p.sorte === S.Petale) {
        p.vx += Math.sin(p.age * 2 + p.graine * 10) * dt * 0.8;
        p.vz += Math.cos(p.age * 1.7 + p.graine * 10) * dt * 0.8;
      }
      p.vx *= 1 - dt * 0.3;
      p.vz *= 1 - dt * 0.3;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.sorte === S.Petale && p.y < hauteur(p.x, p.z) + 0.03) {
        p.vy = 0;
        p.vx = p.vz = 0;
      }
      p.taille += p.croissance * dt;
      vivantes.push(p);
      const t = p.age / p.vie;
      if (ADDITIVES.has(p.sorte)) {
        if (nA >= MAX) continue;
        posA.setXYZ(nA, p.x, p.y, p.z);
        donA.setXYZW(nA, p.taille, t, p.sorte, p.graine);
        nA++;
      } else {
        if (nN >= MAX) continue;
        posN.setXYZ(nN, p.x, p.y, p.z);
        donN.setXYZW(nN, p.taille, t, p.sorte, p.graine);
        nN++;
      }
    }
    this.liste.length = 0;
    this.liste.push(...vivantes);
    this.normales.geometry.setDrawRange(0, nN);
    this.additives.geometry.setDrawRange(0, nA);
    posN.needsUpdate = donN.needsUpdate = posA.needsUpdate = donA.needsUpdate = true;
    const echelle = window.innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360)) * Math.min(2, window.devicePixelRatio);
    (this.normales.material as THREE.ShaderMaterial).uniforms.uEchelle!.value = echelle;
    (this.additives.material as THREE.ShaderMaterial).uniforms.uEchelle!.value = echelle;
    (this.halos.material as THREE.ShaderMaterial).uniforms.uEchelle!.value = echelle;

    // Les halos des flammes, et les vraies lumières des plus proches
    const posH = this.halos.geometry.attributes.position as THREE.BufferAttribute;
    const donH = this.halos.geometry.attributes.aDonnees as THREE.BufferAttribute;
    let nH = 0;
    const flammes: { e: EmetteurMonde; d: number; n: number }[] = [];
    emetteurs.forEach((e, n) => {
      if (e.sorte !== "torche" && e.sorte !== "feu") return;
      if (nH < 1200) {
        posH.setXYZ(nH, e.pos.x, e.pos.y + (e.sorte === "feu" ? 0.15 : 0.05), e.pos.z);
        donH.setXY(nH, e.sorte === "feu" ? (e.type === "phare" ? 3.2 : 1.1) : 0.42, hachage(n, 7, 7));
        nH++;
      }
      flammes.push({ e, d: e.pos.distanceToSquared(cible), n });
    });
    for (const l of lanternes) {
      if (nH >= 1200) break;
      posH.setXYZ(nH, l.x, l.y, l.z);
      donH.setXY(nH, 0.3, (l.x * 7.3 + l.z) % 1);
      nH++;
    }
    this.halos.geometry.setDrawRange(0, nH);
    posH.needsUpdate = donH.needsUpdate = true;
    flammes.sort((a, b) => a.d - b.d);
    const t = performance.now() / 1000;
    this.lumieres.length = 0;
    const allume = Math.max(nuit, 0.15 * ATMO.uLampes.value);
    if (allume > 0.05) {
      for (const f of flammes.slice(0, 44)) {
        const vacille = 0.8 + 0.2 * Math.sin(t * (9 + (f.n % 5)) + f.n) * Math.sin(t * 3.3 + f.n * 1.7);
        const phare = f.e.type === "phare";
        const feu = f.e.sorte === "feu";
        this.lumieres.push({
          pos: f.e.pos.clone().setY(f.e.pos.y + 0.2),
          portee: phare ? 20 : feu ? 6 : 3.6,
          force: (phare ? 4 : feu ? 1.6 : 0.85) * allume * vacille,
        });
      }
      for (const l of lanternes.slice(0, 48 - this.lumieres.length)) this.lumieres.push({ pos: l, portee: 2.0, force: 0.9 * nuit });
    }

    // La pluie
    const opacite = Math.min(1, pluie * 1.2) * 0.2;
    const mat = this.pluie.material as THREE.LineBasicMaterial;
    mat.opacity = opacite;
    this.pluie.visible = opacite > 0.01;
    if (this.pluie.visible) {
      const pos = this.pluie.geometry.attributes.position as THREE.BufferAttribute;
      const c = camera.position;
      const boite = 22;
      const chute = 26;
      const n = pos.count / 2;
      const actifs = Math.floor(n * Math.min(1, pluie));
      for (let k = 0; k < n; k++) {
        if (k >= actifs) {
          pos.setXYZ(k * 2, 0, -999, 0);
          pos.setXYZ(k * 2 + 1, 0, -999, 0);
          continue;
        }
        const gx = hachage(k, 1, 3);
        const gz = hachage(k, 2, 3);
        const phase = (hachage(k, 3, 3) + (t * chute) / boite) % 1;
        const x = c.x + (gx - 0.5) * boite * 2 + ((Math.floor(c.x / (boite * 2)) * boite * 2 - c.x) % 1) * 0;
        const z = c.z + (gz - 0.5) * boite * 2;
        const y = c.y + boite * 0.6 - phase * boite * 1.4;
        pos.setXYZ(k * 2, x, y, z);
        pos.setXYZ(k * 2 + 1, x + vent.x * 0.25, y - 0.55, z + vent.y * 0.25);
      }
      pos.needsUpdate = true;
    }
  }
}

export const SORTES = { Ecume: S.Ecume };
