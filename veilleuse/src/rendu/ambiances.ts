// La lumière et les couleurs de chaque zone. On passe de l'une à l'autre en douceur.
import * as THREE from "three";
import type { Zone } from "../monde/zones";

export type Ambiance = {
  /** Le haut et le bas du fond, tout au loin */
  cielHaut: string;
  cielBas: string;
  /** La brume qui flotte entre les plans */
  brume: string;
  /** Les trois plans de fond, du plus lointain au plus proche */
  lointains: [string, string, string];
  roche: string;
  /** Le liseré clair sur le dessus des roches (lichen, poussière de cristal…) */
  mousse: string;
  /** La lumière qui baigne tout, même loin des lanternes */
  ambiant: string;
  /** La couleur des cristaux et des lueurs de la zone */
  accent: string;
  /** La densité de la brume (0 à 1) */
  densite: number;
};

export const AMBIANCES: Record<Zone, Ambiance> = {
  puits: {
    cielHaut: "#0b1824",
    cielBas: "#2b4c68",
    brume: "#3d6383",
    lointains: ["#1f374d", "#142437", "#0a1521"],
    roche: "#1b2635",
    mousse: "#8fb4c8",
    ambiant: "#1a2838",
    accent: "#bfe3ff",
    densite: 0.75,
  },
  galeries: {
    cielHaut: "#120d0a",
    cielBas: "#3e2c1f",
    brume: "#664a33",
    lointains: ["#2b1f16", "#1c140e", "#110b07"],
    roche: "#241b15",
    mousse: "#b89c70",
    ambiant: "#2a1d13",
    accent: "#ffb35c",
    densite: 0.6,
  },
  crevasse: {
    cielHaut: "#070820",
    cielBas: "#262a6a",
    brume: "#323a8c",
    lointains: ["#1c2057", "#13163a", "#0a0c22"],
    roche: "#161830",
    mousse: "#8f9cff",
    ambiant: "#13153a",
    accent: "#7ff0ff",
    densite: 0.7,
  },
  noyees: {
    cielHaut: "#04110f",
    cielBas: "#14494a",
    brume: "#1d6260",
    lointains: ["#113a3a", "#0a2626", "#051616"],
    roche: "#0e1e1e",
    mousse: "#6cc3a8",
    ambiant: "#0b1f1f",
    accent: "#8affc8",
    densite: 0.85,
  },
  coeur: {
    cielHaut: "#10050e",
    cielBas: "#4a1a3c",
    brume: "#64264f",
    lointains: ["#3a1532", "#240c20", "#140611"],
    roche: "#1c1019",
    mousse: "#d88cb2",
    ambiant: "#1e0d1a",
    accent: "#ffb6dc",
    densite: 0.8,
  },
};

/** L'ambiance en cours, sous forme de couleurs Three, que l'on fait glisser vers une cible. */
export class AmbianceCourante {
  readonly cielHaut = new THREE.Color();
  readonly cielBas = new THREE.Color();
  readonly brume = new THREE.Color();
  readonly lointains = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  readonly roche = new THREE.Color();
  readonly mousse = new THREE.Color();
  readonly ambiant = new THREE.Color();
  readonly accent = new THREE.Color();
  densite = 0.7;

  constructor(depart: Zone) {
    this.viser(depart, 1);
  }

  /** Avance vers l'ambiance de la zone (t = 1 : immédiatement). */
  viser(zone: Zone, t: number) {
    const a = AMBIANCES[zone];
    const tmp = new THREE.Color();
    const vers = (c: THREE.Color, hex: string) => c.lerp(tmp.set(hex), t);
    vers(this.cielHaut, a.cielHaut);
    vers(this.cielBas, a.cielBas);
    vers(this.brume, a.brume);
    a.lointains.forEach((h, i) => vers(this.lointains[i], h));
    vers(this.roche, a.roche);
    vers(this.mousse, a.mousse);
    vers(this.ambiant, a.ambiant);
    vers(this.accent, a.accent);
    this.densite += (a.densite - this.densite) * t;
  }
}
