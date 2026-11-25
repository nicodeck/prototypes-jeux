// Le temps qu'il fait : vent qui tourne, rafales, éclairs, et l'aube à la fin.

import * as THREE from "three";
import { REGLAGES } from "../reglages";
import { aleatoire, amortir, entre } from "../outils/maths";

export interface Eclair {
  direction: number; // angle horizontal depuis le bateau
  distance: number;
  force: number; // 0..1
}

export class Meteo {
  temps = 0;
  /** d'où vient le vent (radians, 0 = nord, sens horaire vu de dessus) */
  ventDirection = THREE.MathUtils.degToRad(REGLAGES.vent.directionDepart);
  ventForce = REGLAGES.vent.forceBase;
  rafale = 0; // 0..1, lissé
  private rafaleCible = 0;
  private prochaineRafale = 6;
  private finRafale = 0;

  flash = 0; // luminosité instantanée des éclairs
  private prochainEclair = 4;
  private flashes: { debut: number; force: number }[] = [];
  dernierEclair: Eclair | null = null;
  surEclair: ((e: Eclair) => void) | null = null;

  tempete = 1; // 1 = pleine tempête, 0 = calme de l'aube
  aube = 0; // 0 = nuit, 1 = lever du jour
  finale = false;

  private alea = aleatoire(77);
  private derive = 0;

  /** Vecteur vers lequel souffle le vent (x, z), normé. */
  souffle(sortie: THREE.Vector2) {
    // ventDirection = d'où vient le vent ; il souffle vers l'opposé
    return sortie.set(-Math.sin(this.ventDirection), Math.cos(this.ventDirection));
  }

  /** Amplitude globale de la houle (la zone sûre des phares s'y ajoute). */
  get houle() {
    return 0.4 + 0.6 * this.tempete;
  }

  /** Force totale (base + rafale), atténuée quand la tempête se calme. */
  get forceTotale() {
    return this.ventForce * (1 + this.rafale * REGLAGES.vent.rafaleForce) * (0.55 + 0.45 * this.tempete);
  }

  maj(dt: number) {
    this.temps += dt;
    const R = REGLAGES.vent;
    const r = this.alea;

    // direction : oscillation lente + dérive aléatoire
    this.derive += (r() - 0.5) * dt * 0.05;
    this.derive *= 1 - dt * 0.02;
    const base = THREE.MathUtils.degToRad(R.directionDepart);
    const osc = THREE.MathUtils.degToRad(R.rotationAmplitude) * Math.sin((this.temps / R.rotationPeriode) * Math.PI * 2);
    this.ventDirection = base + osc + this.derive;

    // rafales
    if (this.temps > this.prochaineRafale && this.rafaleCible === 0) {
      this.rafaleCible = entre(r, 0.6, 1) * this.tempete;
      this.finRafale = this.temps + entre(r, ...R.rafaleDuree);
    }
    if (this.rafaleCible > 0 && this.temps > this.finRafale) {
      this.rafaleCible = 0;
      this.prochaineRafale = this.temps + entre(r, ...R.rafaleIntervalle);
    }
    this.rafale = amortir(this.rafale, this.rafaleCible, this.rafaleCible > 0 ? 2.2 : 0.9, dt);

    // éclairs
    if (!this.finale && this.temps > this.prochainEclair) {
      this.prochainEclair = this.temps + entre(r, ...REGLAGES.meteo.eclairIntervalle);
      this.declencherEclair();
    }
    let f = 0;
    for (const e of this.flashes) {
      const t = this.temps - e.debut;
      // un éclair, c'est deux ou trois clignements rapides puis une traîne
      const pic = Math.exp(-t * 9) + 0.7 * Math.exp(-Math.abs(t - 0.16) * 30) + 0.5 * Math.exp(-Math.abs(t - 0.32) * 25);
      f += e.force * pic;
    }
    this.flashes = this.flashes.filter((e) => this.temps - e.debut < 1.5);
    this.flash = f;

    if (this.finale) {
      this.tempete = Math.max(0, this.tempete - dt / 14);
      this.aube = Math.min(1, this.aube + dt / 22);
    }
  }

  declencherEclair(force?: number, direction?: number, distance?: number) {
    const r = this.alea;
    const e: Eclair = {
      direction: direction ?? r() * Math.PI * 2,
      distance: distance ?? entre(r, 250, 900),
      force: force ?? entre(r, 0.55, 1),
    };
    this.flashes.push({ debut: this.temps, force: e.force });
    this.dernierEclair = e;
    this.surEclair?.(e);
  }
}
