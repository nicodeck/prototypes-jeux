// Le temps qu'il fait et l'heure qu'il est.
//
// Une journée dure environ six minutes à vitesse normale : le jour prend son temps, la nuit passe
// plus vite pour qu'on puisse continuer à bâtir. Le temps change toutes les quelques heures,
// d'un ciel pur à l'orage, en passant par les voiles et les nuages.
import { REGLAGES } from "../reglages";
import type { Hasard } from "./hasard";

export type Meteo = "clair" | "voile" | "nuageux" | "pluie" | "orage";

export interface EtatCiel {
  /** Couverture nuageuse, 0 à 1 */
  nuages: number;
  pluie: number;
  /** Force du vent, 0 à 1 */
  vent: number;
  orage: number;
  /** La brume du matin, 0 à 1 */
  brume: number;
}

const CIBLES: Record<Meteo, Omit<EtatCiel, "brume">> = {
  clair: { nuages: 0.1, pluie: 0, vent: 0.22, orage: 0 },
  voile: { nuages: 0.36, pluie: 0, vent: 0.32, orage: 0 },
  nuageux: { nuages: 0.6, pluie: 0, vent: 0.48, orage: 0 },
  pluie: { nuages: 0.86, pluie: 0.8, vent: 0.6, orage: 0 },
  orage: { nuages: 0.97, pluie: 1, vent: 0.95, orage: 1 },
};

const SUITES: Record<Meteo, [Meteo, number][]> = {
  clair: [["clair", 0.5], ["voile", 0.38], ["nuageux", 0.12]],
  voile: [["clair", 0.4], ["voile", 0.25], ["nuageux", 0.35]],
  nuageux: [["voile", 0.35], ["clair", 0.15], ["pluie", 0.3], ["orage", 0.12], ["nuageux", 0.08]],
  pluie: [["nuageux", 0.45], ["voile", 0.35], ["orage", 0.2]],
  orage: [["pluie", 0.6], ["nuageux", 0.4]],
};

export const LEVER = 6.0;
export const COUCHER = 19.6;

export class Horloge {
  heure: number;
  jour = 1;
  meteo: Meteo = "clair";
  /** Heures de jeu avant le prochain changement de temps */
  prochainChangement = 5;
  ciel: EtatCiel = { nuages: 0.1, pluie: 0, vent: 0.22, orage: 0, brume: 0 };
  /** Ce matin, la brume se lève-t-elle ? */
  matinBrumeux = true;
  /** Un éclair vient de tomber (pendant ce pas) */
  eclair = false;
  /** On peut figer l'heure (touche H) */
  figee = false;

  constructor(
    private readonly alea: Hasard,
    heure = 6.2,
  ) {
    this.heure = heure;
  }

  /** Heures de jeu par seconde réelle (à vitesse normale) */
  static vitesse(h: number) {
    const nuit = h > 20.6 || h < 4.6;
    return nuit ? 1 / REGLAGES.secondesParHeureNuit : 1 / REGLAGES.secondesParHeureJour;
  }

  imposer(meteo: Meteo, immediat = false) {
    this.meteo = meteo;
    this.prochainChangement = 6;
    if (immediat) Object.assign(this.ciel, CIBLES[meteo]);
  }

  avancer(dt: number) {
    this.eclair = false;
    if (!this.figee) {
      const avant = this.heure;
      const dh = Horloge.vitesse(this.heure) * dt;
      this.heure += dh;
      this.prochainChangement -= dh;
      if (this.heure >= 24) {
        this.heure -= 24;
        this.jour++;
      }
      // Chaque nuit, on décide si le matin sera brumeux
      if (avant < 3 && this.heure >= 3) this.matinBrumeux = this.alea() < 0.65;
    }
    if (this.prochainChangement <= 0) {
      let r = this.alea();
      for (const [suite, p] of SUITES[this.meteo]) {
        r -= p;
        if (r <= 0) {
          this.meteo = suite;
          break;
        }
      }
      this.prochainChangement = 2.5 + this.alea() * 4;
    }
    // Le ciel suit le temps qu'il fait, lentement
    const cible = CIBLES[this.meteo];
    const k = 1 - Math.exp(-dt / 25);
    this.ciel.nuages += (cible.nuages - this.ciel.nuages) * k;
    this.ciel.pluie += (cible.pluie - this.ciel.pluie) * k * 1.3;
    this.ciel.vent += (cible.vent - this.ciel.vent) * k;
    this.ciel.orage += (cible.orage - this.ciel.orage) * k;
    // La brume du matin : elle monte avant l'aube et se dissipe vers neuf heures, si l'air est calme
    const h = this.heure;
    const matin = h > 3.5 && h < 10 ? Math.exp(-((h - 6.3) ** 2) / (2 * 1.2 ** 2)) : 0;
    const calme = 1 - Math.min(1, this.ciel.vent * 1.4);
    const brume = (this.matinBrumeux ? 1 : 0.15) * matin * calme;
    this.ciel.brume += (brume - this.ciel.brume) * (1 - Math.exp(-dt / 8));
    if (this.ciel.orage > 0.55 && this.alea() < dt * 0.22 * this.ciel.orage) this.eclair = true;
  }

  /** 0 en plein jour, 1 en pleine nuit */
  get nuit() {
    const h = this.heure;
    if (h > LEVER + 0.8 && h < COUCHER - 0.6) return 0;
    if (h >= COUCHER + 1.1 || h <= LEVER - 0.9) return 1;
    if (h < 12) return 1 - (h - (LEVER - 0.9)) / 1.7;
    return (h - (COUCHER - 0.6)) / 1.7;
  }
}

export function formatHeure(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${hh}h${mm.toString().padStart(2, "0")}`;
}

/** Les heures romaines : la première heure commence au lever du soleil. */
export function heureRomaine(h: number): string {
  const ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  if (h >= LEVER && h < COUCHER) {
    const n = Math.min(11, Math.floor(((h - LEVER) / (COUCHER - LEVER)) * 12));
    return `hora ${ROMAINS[n]}`;
  }
  const nuit = h >= COUCHER ? h - COUCHER : h + 24 - COUCHER;
  const veille = Math.min(3, Math.floor((nuit / (24 - COUCHER + LEVER)) * 4));
  return `vigilia ${ROMAINS[veille]}`;
}
