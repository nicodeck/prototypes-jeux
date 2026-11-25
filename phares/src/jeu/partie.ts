// L'état de la partie : huile, coque, phares rallumés, tonneaux, naufrage, fin.

import { REGLAGES } from "../reglages";
import { DEPART, PHARES, getRochers, getTonneaux, hauteurTerrain } from "../monde/archipel";
import { Voilier, Choc } from "./navigation";

export type Evenement =
  | { type: "allumage-debut"; phare: number }
  | { type: "phare-allume"; phare: number }
  | { type: "tonneau"; index: number }
  | { type: "choc"; choc: Choc; degats: number }
  | { type: "huile-faible" }
  | { type: "lanterne-eteinte" }
  | { type: "naufrage" }
  | { type: "renfloue" }
  | { type: "zone-sure"; phare: number }
  | { type: "victoire" };

export class Partie {
  huile = REGLAGES.huile.max;
  coque = REGLAGES.coque.max;
  allumes: boolean[] = PHARES.map((_, i) => i === 0);
  progression: number[] = PHARES.map(() => 0); // allumage en cours
  tonneauxPris: boolean[] = [];
  temps = 0;
  chocs = 0;
  naufrages = 0;
  naufrage = 0; // > 0 : en train de couler (secondes)
  victoire = false;
  tempsVictoire = 0;
  dernierPhare = 0;
  dansZoneSure = -1;
  invincible = false;
  private huileFaibleSignalee = false;
  private evenements: Evenement[] = [];

  constructor(private bateau: Voilier) {
    this.tonneauxPris = getTonneaux().map(() => false);
  }

  get nbAllumes() {
    return this.allumes.filter(Boolean).length;
  }

  /** Prochain phare éteint dans l'ordre de la route. */
  get prochainPhare() {
    const i = this.allumes.findIndex((a) => !a);
    return i;
  }

  get lanterne() {
    if (this.huile <= 0) return 0;
    const faible = this.huile < REGLAGES.huile.seuilFaible;
    if (!faible) return 1;
    // la flamme vacille quand l'huile manque
    const t = this.temps;
    const v = 0.55 + 0.45 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1));
    return Math.min(1, (this.huile / REGLAGES.huile.seuilFaible) * 0.5 + 0.5) * v;
  }

  sortirEvenements() {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  maj(dt: number, choc: Choc | null) {
    if (!this.victoire) this.temps += dt;
    const b = this.bateau;

    if (this.naufrage > 0) {
      this.naufrage += dt;
      if (this.naufrage > 3.2) this.renflouer();
      return;
    }

    // huile
    if (this.huile > 0) {
      this.huile = Math.max(0, this.huile - REGLAGES.huile.consommation * dt);
      if (this.huile === 0) this.evenements.push({ type: "lanterne-eteinte" });
    }
    if (this.huile < REGLAGES.huile.seuilFaible && !this.huileFaibleSignalee && this.huile > 0) {
      this.huileFaibleSignalee = true;
      this.evenements.push({ type: "huile-faible" });
    }
    if (this.huile > REGLAGES.huile.seuilFaible + 10) this.huileFaibleSignalee = false;

    // chocs
    if (choc && !this.invincible) {
      const degats = Math.max(REGLAGES.coque.degatsMin, choc.force * REGLAGES.coque.degatsParVitesse) * (choc.rocher ? 1 : 0.6);
      this.coque = Math.max(0, this.coque - degats);
      this.chocs++;
      this.evenements.push({ type: "choc", choc, degats });
      if (this.coque <= 0) {
        this.naufrage = 0.001;
        this.naufrages++;
        this.evenements.push({ type: "naufrage" });
        return;
      }
    } else if (choc) {
      this.evenements.push({ type: "choc", choc, degats: 0 });
    }

    // phares : allumage et zones sûres
    let zone = -1;
    PHARES.forEach((p, i) => {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (this.allumes[i]) {
        if (d < REGLAGES.phares.rayonZoneSure * 0.75) zone = i;
        return;
      }
      if (d < REGLAGES.phares.rayonAllumage) {
        if (this.progression[i] === 0) this.evenements.push({ type: "allumage-debut", phare: i });
        this.progression[i] = Math.min(1, this.progression[i] + dt / REGLAGES.phares.dureeAllumage);
        if (this.progression[i] >= 1) {
          this.allumes[i] = true;
          this.dernierPhare = i;
          zone = i; // pas d'annonce de zone sûre par-dessus celle de l'allumage
          this.evenements.push({ type: "phare-allume", phare: i });
          if (this.allumes.every(Boolean)) {
            this.victoire = true;
            this.tempsVictoire = this.temps;
            this.evenements.push({ type: "victoire" });
          }
        }
      } else {
        this.progression[i] = Math.max(0, this.progression[i] - dt * 0.5);
      }
    });
    const vientDAllumer = this.evenements.some((e) => e.type === "phare-allume");
    if (zone >= 0 && zone !== this.dansZoneSure && !vientDAllumer) this.evenements.push({ type: "zone-sure", phare: zone });
    this.dansZoneSure = zone;
    if (zone >= 0) {
      this.huile = Math.min(REGLAGES.huile.max, this.huile + REGLAGES.huile.remplissageAuPhare * dt);
      this.coque = Math.min(REGLAGES.coque.max, this.coque + REGLAGES.coque.reparationAuPhare * dt);
    }

    // tonneaux d'huile
    getTonneaux().forEach((t, i) => {
      if (this.tonneauxPris[i]) return;
      if (Math.hypot(b.x - t.x, b.z - t.z) < 6.5) {
        this.tonneauxPris[i] = true;
        this.huile = Math.min(REGLAGES.huile.max, this.huile + REGLAGES.huile.tonneau);
        this.evenements.push({ type: "tonneau", index: i });
      }
    });
  }

  /** Le bateau repart du dernier phare allumé, coque réparée. */
  private renflouer() {
    this.naufrage = 0;
    this.coque = REGLAGES.coque.max;
    this.huile = Math.max(this.huile, 60);
    const p = PHARES[this.dernierPhare];
    const point = pointDeMouillage(p.x, p.z);
    this.bateau.placer(point.x, point.y, point.cap);
    this.evenements.push({ type: "renfloue" });
  }
}

/** Un point d'eau libre à ~50 m d'un phare, cap vers le large. */
export function pointDeMouillage(x: number, z: number) {
  if (x === PHARES[0].x && z === PHARES[0].z) return { x: DEPART.x, y: DEPART.z, cap: DEPART.cap };
  let meilleur = { x: x + 50, y: z, cap: 0, score: -1e9 };
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const px = x + Math.cos(a) * 55;
    const pz = z + Math.sin(a) * 55;
    let libre = -hauteurTerrain(px, pz);
    for (const r of getRochers()) libre = Math.min(libre, Math.hypot(px - r.x, pz - r.z) - r.r - 4);
    // on préfère regarder vers le centre de l'archipel
    const score = Math.min(libre, 12) - Math.hypot(px, pz) * 0.01;
    if (score > meilleur.score) meilleur = { x: px, y: pz, cap: Math.atan2(px - x, -(pz - z)), score };
  }
  return { x: meilleur.x, y: meilleur.y, cap: meilleur.cap };
}
