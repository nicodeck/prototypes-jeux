// La physique du voilier : allures, vent, vagues, dérive, chocs contre les récifs.
// Cap en radians façon boussole : 0 = nord (-z), π/2 = est (+x).

import * as THREE from "three";
import { REGLAGES } from "../reglages";
import { Meteo } from "../monde/meteo";
import { Calme, hauteurMer, penteMer } from "../monde/vagues";
import { getRochers, hauteurTerrain } from "../monde/archipel";
import { amortir, angleNormalise, clamp, smoothstep } from "../outils/maths";

export interface Commandes {
  barre: number; // -1 bâbord (gauche) .. 1 tribord (droite)
  voile: number; // -1 affaler, 0, 1 hisser
}

export interface Choc {
  force: number; // vitesse d'impact
  x: number;
  z: number;
  rocher: boolean;
}

const DEG = Math.PI / 180;

/** Rendement de la voile selon l'angle entre le cap et le lit du vent (0 = face au vent). */
export function rendementAllure(angle: number) {
  const B = REGLAGES.bateau;
  const mort = B.angleMort * DEG;
  const meilleur = B.meilleurAngle * DEG;
  if (angle < mort) return 0;
  if (angle < meilleur) return 0.3 + 0.7 * smoothstep(mort, meilleur, angle);
  return THREE.MathUtils.lerp(1, B.rendementVentArriere, (angle - meilleur) / (Math.PI - meilleur));
}

export class Voilier {
  x = 0;
  z = 0;
  y = 0;
  cap = 0;
  vitesse = 0;
  hisse = 1; // voile hissée (0..1)
  tangage = 0;
  roulis = 0;
  gite = 0;
  angleBome = 0;
  creux = 0;
  faseye = 0;
  rendement = 0;
  angleAuVent = 0; // 0..π
  ventRelatif = 0; // direction du vent dans le repère du bateau (pour la flamme)
  derive = new THREE.Vector2();
  fantome = false; // debug : traverse les récifs
  private delaiChoc = 0;
  private pente = new THREE.Vector2();
  private souffle = new THREE.Vector2();
  vitesseSol = 0;

  get avant() {
    return new THREE.Vector2(Math.sin(this.cap), -Math.cos(this.cap));
  }

  placer(x: number, z: number, cap: number) {
    this.x = x;
    this.z = z;
    this.cap = cap;
    this.vitesse = 0;
    this.derive.set(0, 0);
  }

  maj(dt: number, cmd: Commandes, meteo: Meteo, calme: Calme, temps: number): Choc | null {
    const B = REGLAGES.bateau;
    const force = meteo.forceTotale;
    meteo.souffle(this.souffle);

    // voile
    this.hisse = clamp(this.hisse + cmd.voile * B.vitesseVoile * dt, 0, 1);

    // allure
    const rel = angleNormalise(meteo.ventDirection - this.cap); // > 0 : vent venant de tribord
    const angle = Math.abs(rel);
    this.angleAuVent = angle;
    const r = rendementAllure(angle);
    this.rendement = r;
    const cible = B.vitesseMax * force * r * this.hisse;
    if (angle < B.angleMort * DEG) {
      // face au vent : la voile faseye, le bateau s'arrête puis recule
      this.vitesse -= B.freinageVentDebout * dt * Math.sign(this.vitesse + 0.001);
      if (Math.abs(this.vitesse) < 0.3) this.vitesse = amortir(this.vitesse, -B.reculVentDebout * this.hisse * force * 0.5, 0.6, dt);
    } else {
      this.vitesse = amortir(this.vitesse, cible, B.acceleration, dt);
    }

    // barre : on tourne mieux avec de l'erre
    const virage = B.virageMin + B.virageParVitesse * Math.abs(this.vitesse);
    this.cap = angleNormalise(this.cap + cmd.barre * virage * dt);

    // vagues et dérive
    const ampli = meteo.houle * (1 - calme.facteur(this.x, this.z));
    penteMer(this.x, this.z, temps, ampli, this.pente);
    const cibleDerive = new THREE.Vector2(
      -this.pente.x * B.pousseeVagues * 2 + this.souffle.x * B.derive * force * (0.35 + 0.65 * this.hisse),
      -this.pente.y * B.pousseeVagues * 2 + this.souffle.y * B.derive * force * (0.35 + 0.65 * this.hisse),
    );
    this.derive.x = amortir(this.derive.x, cibleDerive.x, 1.5, dt);
    this.derive.y = amortir(this.derive.y, cibleDerive.y, 1.5, dt);

    const av = this.avant;
    const ancienX = this.x;
    const ancienZ = this.z;
    this.x += (av.x * this.vitesse + this.derive.x) * dt;
    this.z += (av.y * this.vitesse + this.derive.y) * dt;
    this.vitesseSol = Math.hypot(this.x - ancienX, this.z - ancienZ) / Math.max(dt, 1e-4);

    // bord du monde : la houle du large repousse
    const dc = Math.hypot(this.x, this.z);
    const R = REGLAGES.monde.rayon;
    if (dc > R) {
      const pousse = (dc - R) * 0.8;
      this.x -= (this.x / dc) * pousse * dt;
      this.z -= (this.z / dc) * pousse * dt;
    }

    // voilure : bôme sous le vent, creux, faseyement, gîte
    const cote = rel >= 0 ? -1 : 1; // la bôme part à l'opposé du vent
    const ouverture = clamp((angle - 25 * DEG) / (155 * DEG), 0, 1);
    const cibleBome = cote * (6 * DEG + ouverture * 78 * DEG) * (0.3 + 0.7 * this.hisse);
    const faseyeCible = 1 - smoothstep(B.angleMort * DEG - 4 * DEG, B.angleMort * DEG + 10 * DEG, angle);
    this.faseye = amortir(this.faseye, faseyeCible * this.hisse, 4, dt);
    if (this.faseye > 0.5) {
      // la bôme bat d'un bord à l'autre
      this.angleBome = amortir(this.angleBome, Math.sin(temps * 2.3) * 0.25, 3, dt);
    } else {
      this.angleBome = amortir(this.angleBome, cibleBome, 2.5, dt);
    }
    this.creux = amortir(this.creux, cote * 0.85 * clamp(force, 0.3, 1.6) * (1 - this.faseye), 3, dt);
    const cibleGite = -cote * force * this.hisse * Math.sin(angle) * (1 - this.faseye) * 0.12;
    this.gite = amortir(this.gite, cibleGite, 1.5, dt);

    // local : vent vers lequel il souffle, dans le repère du bateau (pour la flamme)
    const c = Math.cos(this.cap);
    const s = Math.sin(this.cap);
    const lx = this.souffle.x * c + this.souffle.y * s;
    const lz = -this.souffle.x * s + this.souffle.y * c;
    this.ventRelatif = Math.atan2(lx, lz);

    // flottaison : on lit la mer à l'étrave, à la poupe et sur les flancs
    const L = B.longueur * 0.45;
    const W = 1.4;
    const hc = hauteurMer(this.x, this.z, temps, ampli);
    const hav = hauteurMer(this.x + av.x * L, this.z + av.y * L, temps, ampli);
    const har = hauteurMer(this.x - av.x * L, this.z - av.y * L, temps, ampli);
    const hba = hauteurMer(this.x - av.y * W, this.z + av.x * W, temps, ampli);
    const htr = hauteurMer(this.x + av.y * W, this.z - av.x * W, temps, ampli);
    this.y = amortir(this.y, Math.max((hc * 2 + hav + har) / 4, (hav + har) / 2) + 0.22, 8, dt);
    this.tangage = amortir(this.tangage, Math.atan2(hav - har, L * 2) * 0.85, 6, dt);
    this.roulis = amortir(this.roulis, Math.atan2(hba - htr, W * 2) * 0.6, 5, dt);

    // collisions
    this.delaiChoc -= dt;
    if (this.fantome) return null;
    return this.collisions();
  }

  private collisions(): Choc | null {
    const av = this.avant;
    const points = [
      [this.x + av.x * 3.4, this.z + av.y * 3.4],
      [this.x, this.z],
      [this.x - av.x * 2.8, this.z - av.y * 2.8],
    ];
    let choc: Choc | null = null;
    for (const [px, pz] of points) {
      for (const r of getRochers()) {
        const dx = px - r.x;
        const dz = pz - r.z;
        const d = Math.hypot(dx, dz);
        const rayon = r.r + 1.1;
        if (d < rayon && r.h > -1.2) {
          const nx = dx / (d || 1);
          const nz = dz / (d || 1);
          this.x += nx * (rayon - d);
          this.z += nz * (rayon - d);
          choc = this.rebondir(nx, nz, px, pz, true) ?? choc;
        }
      }
      const h = hauteurTerrain(px, pz);
      if (h > -0.9) {
        const e = 2;
        const gx = hauteurTerrain(px + e, pz) - hauteurTerrain(px - e, pz);
        const gz = hauteurTerrain(px, pz + e) - hauteurTerrain(px, pz - e);
        const gl = Math.hypot(gx, gz) || 1;
        const nx = -gx / gl;
        const nz = -gz / gl;
        const enfonce = Math.min(3, (h + 0.9) * 0.6 + 0.3);
        this.x += nx * enfonce;
        this.z += nz * enfonce;
        choc = this.rebondir(nx, nz, px, pz, false) ?? choc;
      }
    }
    return choc;
  }

  private rebondir(nx: number, nz: number, px: number, pz: number, rocher: boolean): Choc | null {
    const av = this.avant;
    const vx = av.x * this.vitesse + this.derive.x;
    const vz = av.y * this.vitesse + this.derive.y;
    const impact = -(vx * nx + vz * nz);
    if (impact <= 0.3) return null;
    this.vitesse *= -REGLAGES.coque.rebond * Math.abs(av.x * nx + av.y * nz) + (1 - Math.abs(av.x * nx + av.y * nz)) * 0.6;
    this.derive.set(nx * impact * 0.5, nz * impact * 0.5);
    if (this.delaiChoc > 0) return null;
    this.delaiChoc = 0.7;
    return { force: impact, x: px, z: pz, rocher };
  }
}
