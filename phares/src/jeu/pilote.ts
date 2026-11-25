// Pilote automatique (debug, ?auto) : vise le prochain phare, louvoie face au vent,
// et contourne les obstacles en sondant quelques caps autour du cap idéal.

import { PHARES, getRochers, hauteurTerrain } from "../monde/archipel";
import { Meteo } from "../monde/meteo";
import { REGLAGES } from "../reglages";
import { angleNormalise, clamp } from "../outils/maths";
import { Commandes, Voilier, rendementAllure } from "./navigation";

function degagement(x: number, z: number, cap: number, portee: number) {
  const dx = Math.sin(cap);
  const dz = -Math.cos(cap);
  for (let d = 4; d <= portee; d += 4) {
    const px = x + dx * d;
    const pz = z + dz * d;
    if (hauteurTerrain(px, pz) > -2) return d;
    for (const r of getRochers()) if (Math.hypot(px - r.x, pz - r.z) < r.r + 5) return d;
  }
  return portee;
}

export class Pilote {
  private bord = 1;
  private changement = 0;

  commander(b: Voilier, meteo: Meteo, cible: number, dt: number): Commandes {
    const p = PHARES[cible];
    if (!p) return { barre: 0, voile: 1 };
    const capCible = Math.atan2(p.x - b.x, -(p.z - b.z));
    const distance = Math.hypot(p.x - b.x, p.z - b.z);
    this.changement -= dt;
    let meilleur = capCible;
    let score = -Infinity;
    for (let k = -12; k <= 12; k++) {
      const cap = capCible + (k * Math.PI) / 18;
      const auVent = Math.abs(angleNormalise(meteo.ventDirection - cap));
      const r = rendementAllure(auVent);
      const vmg = r * Math.cos(angleNormalise(cap - capCible)); // vitesse utile vers le phare
      const libre = degagement(b.x, b.z, cap, Math.min(70, distance));
      let s = vmg * 2 + (libre / 70) * 2.2 - Math.abs(k) * 0.01;
      if (auVent < (REGLAGES.bateau.angleMort + 6) * (Math.PI / 180)) s -= 3;
      // garder le même bord un moment pour éviter d'hésiter
      if (Math.sign(angleNormalise(cap - meteo.ventDirection)) === this.bord) s += 0.25;
      if (s > score) {
        score = s;
        meilleur = cap;
      }
    }
    const bordChoisi = Math.sign(angleNormalise(meilleur - meteo.ventDirection));
    if (bordChoisi !== this.bord && this.changement <= 0) {
      this.bord = bordChoisi;
      this.changement = 12;
    }
    const ecart = angleNormalise(meilleur - b.cap);
    return { barre: clamp(ecart * 2.5, -1, 1), voile: distance < 40 ? -0.3 : 1 };
  }
}
