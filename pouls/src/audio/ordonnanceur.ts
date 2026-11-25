// L'ordonnanceur : toutes les 25 ms, il programme sur l'horloge audio les notes des 150 ms à venir.
// Le minuteur ne sert qu'à se réveiller ; la précision vient de l'horloge audio (« A Tale of Two Clocks »).

import type { Partition } from "../partition";
import { REGLAGES } from "../reglages";
import { jouerNote } from "./instruments";
import type { MoteurAudio } from "./moteur";

export class Ordonnanceur {
  /** Instant de l'horloge audio qui correspond au début du morceau. */
  t0 = 0;
  private prochaine = 0;
  private minuterie: ReturnType<typeof setInterval> | undefined;
  private sectionEcho = -1;

  constructor(
    private readonly m: MoteurAudio,
    private readonly p: Partition,
  ) {}

  demarrer(debut: number) {
    this.t0 = this.m.ctx.currentTime + REGLAGES.audio.attenteDepart - debut;
    this.prochaine = this.p.notes.findIndex((n) => n.t >= debut - 1e-6);
    if (this.prochaine < 0) this.prochaine = this.p.notes.length;
    this.tic();
    this.minuterie = setInterval(() => this.tic(), REGLAGES.audio.periode * 1000);
  }

  arreter() {
    if (this.minuterie !== undefined) clearInterval(this.minuterie);
    this.minuterie = undefined;
  }

  /** Programme tout ce qui tombe avant `horizon` (en secondes de morceau). Sert aussi au rendu hors ligne. */
  programmerJusqua(horizon: number) {
    const notes = this.p.notes;
    const maintenant = this.m.ctx.currentTime;
    while (this.prochaine < notes.length && notes[this.prochaine].t < horizon) {
      const n = notes[this.prochaine++];
      const t = this.t0 + n.t;
      if (n.section !== this.sectionEcho) {
        this.sectionEcho = n.section;
        this.m.regleEcho(this.p.sections[n.section].bpm, Math.max(t, maintenant));
      }
      // Une note déjà passée (onglet en veille) n'est pas jouée en retard.
      if (t < maintenant - 0.02 || t < 0) continue;
      jouerNote(this.m, n, t);
    }
  }

  private tic() {
    this.programmerJusqua(this.m.ctx.currentTime + REGLAGES.audio.avance - this.t0);
  }
}
