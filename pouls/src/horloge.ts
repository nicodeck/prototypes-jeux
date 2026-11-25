// L'horloge du jeu dit « où en est la musique que l'on entend », en secondes depuis le début du morceau.
// Elle suit l'horloge audio (et non l'horloge de l'écran) : c'est elle qui fait foi pour le rythme.

export interface Horloge {
  /** Instant du morceau entendu à l'instant `perf` (millisecondes de performance.now()). */
  lire(perf: number): number;
  /** Instant d'un appui daté `perf`, cohérent avec la dernière lecture (ne modifie pas l'horloge). */
  aInstant(perf: number): number;
  pause(): void;
  reprendre(): void;
}

export class HorlogeAudio implements Horloge {
  private estimation = 0;
  private dernierePerf = -1;
  private enPause = false;

  constructor(
    private readonly ctx: AudioContext,
    /** Instant de l'horloge audio qui correspond au début du morceau. */
    private readonly t0: number,
  ) {}

  private brut(perf: number): number {
    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (perf - ts.performanceTime) / 1000 - this.t0;
    }
    const latence = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return this.ctx.currentTime - latence - this.t0;
  }

  lire(perf: number): number {
    if (this.enPause || this.ctx.state !== "running") return this.estimation;
    const brut = this.brut(perf);
    if (this.dernierePerf < 0) {
      this.estimation = brut;
    } else {
      // L'horloge audio avance par paquets : on la suit en douceur, sans jamais reculer.
      const prevu = this.estimation + Math.max(0, perf - this.dernierePerf) / 1000;
      const ecart = brut - prevu;
      this.estimation = Math.abs(ecart) > 0.05 ? brut : prevu + ecart * 0.08;
    }
    this.dernierePerf = perf;
    return this.estimation;
  }

  aInstant(perf: number): number {
    if (this.enPause || this.dernierePerf < 0) return this.estimation;
    return this.estimation + (perf - this.dernierePerf) / 1000;
  }

  pause() {
    this.enPause = true;
  }

  reprendre() {
    this.enPause = false;
    this.dernierePerf = -1;
  }
}

/** Horloge sans son, éventuellement accélérée : pour les vérifications automatiques. */
export class HorlogeSimulee implements Horloge {
  private debutPerf = -1;
  private cumul = 0;
  private enPause = false;

  constructor(
    private readonly debut: number,
    private readonly vitesse: number,
  ) {}

  lire(perf: number): number {
    if (this.debutPerf < 0) this.debutPerf = perf;
    if (this.enPause) return this.debut + this.cumul;
    return this.debut + this.cumul + ((perf - this.debutPerf) / 1000) * this.vitesse;
  }

  aInstant(perf: number): number {
    return this.lire(perf);
  }

  pause() {
    const p = performance.now();
    this.cumul += ((p - this.debutPerf) / 1000) * this.vitesse;
    this.enPause = true;
  }

  reprendre() {
    this.debutPerf = performance.now();
    this.enPause = false;
  }
}
