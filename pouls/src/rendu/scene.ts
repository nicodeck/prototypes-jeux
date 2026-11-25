// L'assemblage d'une image : décor, obstacles, coureur, particules, premier plan, lueur diffuse, interface.

import type { Coureur, Jeu } from "../jeu";
import type { Partition } from "../partition";
import { DessinCoureur } from "./coureur";
import { Decor } from "./decor";
import { Ecran } from "./ecran";
import { Effets } from "./effets";
import { dessinerPanneaux, Hud } from "./hud";
import { dessinerObstacles } from "./obstacles";
import type { Vue } from "./vue";

const COUREUR_REPOS: Coureur = { saut: -99, dureeSaut: 1, glisse: -99, dureeGlisse: 1, frappe: -99, blessure: -99, vrille: false };

export class Scene {
  readonly decor: Decor;
  readonly coureur = new DessinCoureur();
  readonly effets = new Effets();
  readonly hud = new Hud();

  constructor(readonly ecran: Ecran) {
    this.decor = new Decor(ecran);
  }

  reinitialiser() {
    this.coureur.reinitialiser();
    this.effets.reinitialiser();
    this.hud.reinitialiser();
  }

  dessiner(v: Vue, jeu: Jeu | null, partition: Partition, options: { hud: boolean; aide: boolean }) {
    const ecran = this.ecran;
    const ctx = ecran.ctx;
    ecran.repereLogique();
    this.effets.mettreAJour(v, !!jeu);

    ctx.save();
    const [sx, sy] = this.effets.decalageSecousse();
    // Le monde respire : un léger zoom sur chaque coup de grosse caisse, centré sur le coureur.
    const z = 1 + 0.006 * v.pouls + 0.025 * this.effets.zoom;
    ctx.translate(v.xCoureur + sx, v.ySol - 60 + sy);
    ctx.scale(z, z);
    ctx.translate(-v.xCoureur, -(v.ySol - 60));

    this.decor.dessinerFond(ctx, v);
    if (jeu) {
      dessinerPanneaux(ctx, v, partition);
      dessinerObstacles(ctx, v, jeu.obstacles, options.aide);
    }
    this.coureur.dessiner(ctx, v, jeu ? jeu.coureur : COUREUR_REPOS, !jeu);
    this.effets.dessinerParticules(ctx, v);
    this.decor.dessinerAvant(ctx, v);
    ctx.restore();

    ecran.bloom(0.62 + 0.08 * v.intensite + this.effets.flash * 0.6);
    ecran.repereLogique();
    ecran.dessinerVignette();
    this.effets.dessinerVoiles(ctx, v);
    this.effets.dessinerMots(ctx, v);
    if (jeu && options.hud) this.hud.dessiner(ctx, v, jeu, partition);
  }
}
