// L'état d'une partie : obstacles à venir, jugements, score, combo, jauge de pouls, élan musical,
// et les gestes du coureur. Aucune dépendance au son ni au dessin : tout passe par des événements.

import { juger, multiplicateur, type Jugement } from "./jugement";
import type { Obstacle, Partition } from "./partition";
import { REGLAGES, type Action } from "./reglages";

export interface EtatObstacle {
  o: Obstacle;
  jugement: Jugement | null;
  /** Instant (morceau) où le jugement est tombé. */
  tJugement: number;
  ecart: number;
}

export type Evenement =
  | { type: "jugement"; obstacle: EtatObstacle; jugement: Jugement; ecart: number; t: number; tropTot: boolean }
  | { type: "geste"; action: Action; t: number }
  | { type: "cran"; multiplicateur: number; t: number }
  | { type: "palier"; niveau: number; t: number };

export interface Coureur {
  saut: number;
  dureeSaut: number;
  glisse: number;
  dureeGlisse: number;
  frappe: number;
  blessure: number;
  /** Saut lancé sur un « parfait » : il fait une vrille. */
  vrille: boolean;
}

export class Jeu {
  readonly obstacles: EtatObstacle[];
  score = 0;
  combo = 0;
  comboMax = 0;
  compte = { parfait: 0, bien: 0, rate: 0 };
  vie: number = REGLAGES.vie.max;
  elan = 0;
  niveau = 0;
  fini = false;
  echec = false;
  /** Instant de la fin (morceau) pour l'animation de l'écran final. */
  tFin = 0;
  readonly evenements: Evenement[] = [];
  readonly coureur: Coureur = { saut: -99, dureeSaut: 0.5, glisse: -99, dureeGlisse: 0.4, frappe: -99, blessure: -99, vrille: false };
  /** Premier obstacle pas encore jugé (tout ce qui précède l'est). */
  private premier = 0;

  constructor(
    readonly partition: Partition,
    debut = 0,
  ) {
    this.obstacles = partition.obstacles.map((o) => ({ o, jugement: null, tJugement: 0, ecart: 0 }));
    // Démarrer au milieu du morceau : ce qui précède ne compte pas.
    while (this.premier < this.obstacles.length && this.obstacles[this.premier].o.t < debut + 0.3) {
      const e = this.obstacles[this.premier++];
      e.jugement = "parfait";
      e.tJugement = -99;
    }
    this.niveau = this.calculerNiveau(debut);
  }

  get multiplicateur() {
    return multiplicateur(this.combo);
  }

  get total() {
    return this.compte.parfait + this.compte.bien + this.compte.rate;
  }

  /** Un appui du joueur (ou du pilote automatique), `t` étant l'instant corrigé de la latence. */
  appuyer(action: Action, t: number) {
    if (this.fini) return;
    this.geste(action, t);
    let meilleur: EtatObstacle | null = null;
    for (let i = this.premier; i < this.obstacles.length; i++) {
      const e = this.obstacles[i];
      if (e.o.t - t > REGLAGES.fenetres.tropTot) break;
      if (e.jugement || e.o.action !== action) continue;
      if (!meilleur || Math.abs(e.o.t - t) < Math.abs(meilleur.o.t - t)) meilleur = e;
    }
    if (!meilleur) return;
    const ecart = t - meilleur.o.t;
    const j = juger(ecart);
    if (j) this.resoudre(meilleur, j, ecart, t, j === "rate");
  }

  mettreAJour(t: number, pilote = false) {
    if (this.fini) return;
    for (let i = this.premier; i < this.obstacles.length; i++) {
      const e = this.obstacles[i];
      if (e.o.t > t + 0.001) break;
      if (pilote && !e.jugement) this.appuyer(e.o.action, e.o.t);
    }
    // Ce qui est passé sans être joué est raté.
    for (let i = this.premier; i < this.obstacles.length; i++) {
      const e = this.obstacles[i];
      if (e.o.t + REGLAGES.fenetres.bien >= t) break;
      if (!e.jugement) this.resoudre(e, "rate", t - e.o.t, t, false);
    }
    while (this.premier < this.obstacles.length && this.obstacles[this.premier].jugement) this.premier++;
    // Le plancher d'intensité change avec la section.
    const niveau = this.calculerNiveau(t);
    if (niveau !== this.niveau) {
      this.niveau = niveau;
      this.evenements.push({ type: "palier", niveau, t });
    }

    if (t >= this.partition.duree) this.terminer(t, false);
  }

  private geste(action: Action, t: number) {
    const bpm = this.partition.bpmA(t);
    const c = this.coureur;
    if (action === "saut") {
      c.saut = t;
      c.dureeSaut = (REGLAGES.coureur.sautTemps * 60) / bpm;
      c.glisse = -99;
      c.vrille = false;
    } else if (action === "glisse") {
      c.glisse = t;
      c.dureeGlisse = (REGLAGES.coureur.glisseTemps * 60) / bpm;
      c.saut = -99;
    } else {
      c.frappe = t;
    }
    this.evenements.push({ type: "geste", action, t });
  }

  private resoudre(e: EtatObstacle, j: Jugement, ecart: number, t: number, tropTot: boolean) {
    e.jugement = j;
    e.tJugement = t;
    e.ecart = ecart;
    this.compte[j]++;
    const ancienMult = this.multiplicateur;
    const V = REGLAGES.vie;
    if (j === "rate") {
      this.combo = 0;
      this.vie = Math.max(0, this.vie + V.rate);
      this.elan *= REGLAGES.elan.conserveApresRate;
      this.coureur.blessure = t;
    } else {
      this.combo++;
      this.comboMax = Math.max(this.comboMax, this.combo);
      this.score += REGLAGES.points[j] * this.multiplicateur;
      this.vie = Math.min(V.max, this.vie + V[j]);
      this.elan += REGLAGES.elan[j];
      if (j === "parfait" && e.o.action === "saut") this.coureur.vrille = true;
    }
    this.evenements.push({ type: "jugement", obstacle: e, jugement: j, ecart, t, tropTot });
    if (this.multiplicateur > ancienMult) this.evenements.push({ type: "cran", multiplicateur: this.multiplicateur, t });
    const niveau = this.calculerNiveau(t);
    if (niveau !== this.niveau) {
      this.niveau = niveau;
      this.evenements.push({ type: "palier", niveau, t });
    }
    if (this.vie <= 0) this.terminer(t, true);
  }

  /** Niveau d'intensité musicale (0 à 4) : paliers d'élan, avec un plancher par section. */
  calculerNiveau(t: number): number {
    let n = 0;
    for (const p of REGLAGES.elan.paliers) if (this.elan >= p) n++;
    const s = this.partition.sections[this.partition.sectionALaSeconde(t)];
    return Math.max(n, s.elanMin);
  }

  private terminer(t: number, echec: boolean) {
    if (this.fini) return;
    this.fini = true;
    this.echec = echec;
    this.tFin = t;
  }
}
