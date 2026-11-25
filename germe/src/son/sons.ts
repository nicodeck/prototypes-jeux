// Les bruitages et l'ambiance : pas (différents sur la poussière, l'herbe, l'eau), graines, pelle,
// pierres, sources, oiseaux, grillons la nuit, vent et eau en continu.
// Tout passe par `Sons`, qui ne fait rien tant que le joueur n'a pas cliqué (règle des navigateurs).
import { Audio, hz } from "./audio";
import { Musique } from "./musique";

export class Sons {
  private a: Audio | null = null;
  musique: Musique | null = null;
  private boucleVent: { filtre: BiquadFilterNode; gain: GainNode } | null = null;
  private eau: { filtre: BiquadFilterNode; gain: GainNode } | null = null;
  private roule: { filtre: BiquadFilterNode; gain: GainNode } | null = null;
  private grillons = 0;
  private bulles = 0;
  private dernierCreuse = 0;
  muet = false;

  demarrer(muet: boolean) {
    if (this.a) {
      if (this.a.ctx.state === "suspended") void this.a.ctx.resume();
      return;
    }
    try {
      this.a = new Audio();
    } catch {
      return;
    }
    if (muet) {
      this.a.basculerMuet();
      this.muet = true;
    }
    this.musique = new Musique(this.a);
    this.musique.demarrer();
    this.boucleVent = this.a.boucle(500, 0.6);
    this.eau = this.a.boucle(1400, 0.5);
    this.roule = this.a.boucle(180, 1.2, "lowpass");
  }

  basculerMuet() {
    if (!this.a) return false;
    this.muet = this.a.basculerMuet();
    return this.muet;
  }

  /** Mise à jour de l'ambiance à chaque image. */
  ambiance(dt: number, o: { vie: number; nuit: number; eauProche: number; tempete: number; poussee: number; enJeu: boolean }) {
    const a = this.a;
    if (!a || !this.boucleVent || !this.eau || !this.roule) return;
    const t = a.t;
    if (this.musique) {
      this.musique.vie = o.vie;
      this.musique.nuit = o.nuit;
    }
    const souffleVent = 0.05 * (1 - o.vie * 0.6) + o.tempete * 0.35;
    this.boucleVent.gain.gain.setTargetAtTime(souffleVent, t, 0.4);
    this.boucleVent.filtre.frequency.setTargetAtTime(380 + Math.sin(t * 0.13) * 150 + o.tempete * 500, t, 0.5);
    this.eau.gain.gain.setTargetAtTime(o.eauProche * 0.11, t, 0.3);
    this.eau.filtre.frequency.setTargetAtTime(1100 + Math.sin(t * 0.7) * 300, t, 0.3);
    this.roule.gain.gain.setTargetAtTime(Math.min(0.25, o.poussee * 0.12), t, 0.08);
    // Glouglous près de l'eau
    this.bulles -= dt;
    if (o.eauProche > 0.2 && this.bulles <= 0) {
      this.bulles = 0.15 + Math.random() * 0.6 / o.eauProche;
      const f = 500 + Math.random() * 900;
      a.note({ freq: f, glisse: f * 1.8, duree: 0.06, volume: 0.025 * o.eauProche, reverb: 0.3, pan: Math.random() * 1.4 - 0.7 });
    }
    // Grillons, la nuit, quand l'herbe est là
    this.grillons -= dt;
    if (o.enJeu && o.nuit > 0.5 && o.vie > 0.25 && this.grillons <= 0) {
      this.grillons = 0.25 + Math.random() * 0.9;
      const pan = Math.random() * 2 - 1;
      const f = 4200 + Math.random() * 900;
      for (let k = 0; k < 3; k++) {
        a.note({ freq: f, t: t + k * 0.045, duree: 0.025, volume: 0.012 * o.nuit, pan, reverb: 0.2 });
      }
    }
  }

  pas(sol: "mort" | "herbe" | "eau") {
    const a = this.a;
    if (!a) return;
    const v = 0.85 + Math.random() * 0.3;
    if (sol === "mort") a.souffle({ duree: 0.06, volume: 0.07 * v, freq: 900 * v, q: 1.2 });
    else if (sol === "herbe") a.souffle({ duree: 0.09, volume: 0.05 * v, freq: 3200 * v, q: 0.8, attaque: 0.02 });
    else {
      a.souffle({ duree: 0.12, volume: 0.08 * v, freq: 1300 * v, freqFin: 600, q: 1.5 });
      a.note({ freq: 700 * v, glisse: 1300, duree: 0.07, volume: 0.03 });
    }
  }

  saut() {
    this.a?.note({ freq: 300, glisse: 520, duree: 0.12, volume: 0.04, onde: "triangle" });
  }

  atterrir() {
    this.a?.souffle({ duree: 0.1, volume: 0.08, freq: 600, q: 0.8 });
  }

  ramasser(combo: number) {
    const a = this.a;
    if (!a) return;
    const base = [74, 78, 81, 86][Math.min(3, combo)];
    [0, 4, 7, 12].forEach((d, k) => a.note({ freq: hz(base + d), t: a.t + k * 0.06, duree: 0.35, volume: 0.06, onde: "triangle", reverb: 0.4, echo: 0.3 }));
    a.souffle({ duree: 0.3, volume: 0.03, freq: 6000, freqFin: 9000, q: 2 });
  }

  planter() {
    const a = this.a;
    if (!a) return;
    a.note({ freq: 150, glisse: 60, duree: 0.2, volume: 0.15 });
    a.souffle({ duree: 0.15, volume: 0.06, freq: 700, q: 1 });
    [62, 69, 74, 78].forEach((n, k) => a.cloche(hz(n + 12), a.t + 0.08 + k * 0.09, 0.05, undefined, 0.6, 1.6));
  }

  refus() {
    const a = this.a;
    if (!a) return;
    a.note({ freq: 220, glisse: 180, duree: 0.12, volume: 0.06, onde: "triangle" });
    a.note({ freq: 175, glisse: 140, t: a.t + 0.1, duree: 0.15, volume: 0.05, onde: "triangle" });
  }

  creuser() {
    const a = this.a;
    if (!a || a.t - this.dernierCreuse < 0.11) return;
    this.dernierCreuse = a.t;
    a.souffle({ duree: 0.07, volume: 0.09, freq: 300 + Math.random() * 300, q: 0.7, type: "lowpass" });
    a.souffle({ duree: 0.04, volume: 0.04, freq: 2500, q: 2 });
  }

  source() {
    const a = this.a;
    if (!a) return;
    const t = a.t;
    a.note({ freq: 55, glisse: 40, duree: 2.5, volume: 0.25, attaque: 0.05 });
    a.souffle({ duree: 2.5, volume: 0.12, freq: 300, freqFin: 4000, q: 0.7, attaque: 0.6, reverb: 0.6 });
    [50, 57, 62, 66, 69, 74, 78, 81].forEach((n, k) => a.cloche(hz(n), t + 0.3 + k * 0.12, 0.06, undefined, 0.9, 3));
  }

  arbreAdulte(pan: number) {
    const a = this.a;
    if (!a) return;
    [69, 74, 78].forEach((n, k) => a.note({ freq: hz(n + 12), t: a.t + k * 0.1, duree: 0.8, volume: 0.03, onde: "sine", reverb: 0.7, echo: 0.3, pan }));
  }

  souffle() {
    const a = this.a;
    if (!a) return;
    a.souffle({ duree: 1.1, volume: 0.14, freq: 400, freqFin: 2500, q: 0.6, attaque: 0.15, reverb: 0.5 });
    [62, 66, 69, 74, 78].forEach((n, k) => a.note({ freq: hz(n + 12), t: a.t + 0.1 + k * 0.05, duree: 1.2, volume: 0.035, onde: "sine", reverb: 0.8, echo: 0.4 }));
  }

  oiseau(pan: number, distance: number) {
    const a = this.a;
    if (!a) return;
    const vol = 0.05 * Math.max(0.15, 1 - distance / 14);
    const base = 2400 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const t = a.t + k * (0.09 + Math.random() * 0.05);
      const f = base * (1 + (Math.random() - 0.5) * 0.3);
      a.note({ freq: f, glisse: f * (Math.random() < 0.5 ? 1.5 : 0.7), t, duree: 0.07, volume: vol, pan, reverb: 0.4 });
    }
  }

  vent() {
    this.a?.souffle({ duree: 3, volume: 0.15, freq: 200, freqFin: 900, q: 0.8, attaque: 1.5, reverb: 0.4 });
  }

  victoire() {
    const a = this.a;
    if (!a) return;
    if (this.musique) this.musique.final = true;
    const t = a.t;
    a.souffle({ duree: 4, volume: 0.1, freq: 200, freqFin: 6000, q: 0.5, attaque: 2, reverb: 0.8 });
    [38, 50, 57, 62, 66, 69, 73, 74, 78, 81, 85, 86].forEach((n, k) => a.cloche(hz(n), t + 1 + k * 0.15, 0.07, undefined, 1, 4));
  }

  titre(intensite: number) {
    if (this.musique) this.musique.intensite = intensite;
  }
}
