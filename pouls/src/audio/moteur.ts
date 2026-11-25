// La chaîne audio : couches → (nappes ducées par la grosse caisse) → filtre → compresseur → sortie.
// Réverbération et écho sont des envois partagés. Rien n'est chargé : tout est synthétisé.

import { COUCHES, type Couche } from "../partition";
import { REGLAGES } from "../reglages";

export class MoteurAudio {
  readonly ctx: BaseAudioContext;
  readonly sortie: GainNode;
  readonly filtre: BiquadFilterNode;
  readonly couches: Record<Couche, GainNode>;
  /** Bus des sons tenus (nappes, chœurs) : il « respire » avec la grosse caisse. */
  readonly respiration: GainNode;
  readonly actions: GainNode;
  readonly envoiReverb: GainNode;
  readonly envoiEcho: GainNode;
  readonly bruit: AudioBuffer;
  /** Analyse du signal pour faire pulser l'image avec le son réel. */
  readonly analyse: AnalyserNode;
  private readonly echo: DelayNode;

  /** On peut passer un OfflineAudioContext pour rendre le morceau sans l'écouter (vérifications). */
  constructor(contexte?: BaseAudioContext) {
    this.ctx = contexte ?? new AudioContext({ latencyHint: "interactive" });
    const ctx = this.ctx;

    const compresseur = ctx.createDynamicsCompressor();
    compresseur.threshold.value = -14;
    compresseur.knee.value = 8;
    compresseur.ratio.value = 4;
    compresseur.attack.value = 0.004;
    compresseur.release.value = 0.18;

    this.sortie = ctx.createGain();
    this.sortie.gain.value = REGLAGES.audio.volume;
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = "lowpass";
    this.filtre.frequency.value = 18000;
    this.filtre.Q.value = 0.8;

    this.filtre.connect(compresseur).connect(this.sortie).connect(ctx.destination);
    this.analyse = ctx.createAnalyser();
    this.analyse.fftSize = 256;
    this.sortie.connect(this.analyse);

    // Réverbération : une réponse impulsionnelle fabriquée avec du bruit qui s'éteint.
    const reverb = ctx.createConvolver();
    reverb.buffer = this.reponseImpulsionnelle(3.2, 2.6);
    this.envoiReverb = ctx.createGain();
    this.envoiReverb.gain.value = 0.55;
    this.envoiReverb.connect(reverb).connect(this.filtre);

    // Écho en croche pointée, assourdi à chaque retour.
    const echo = (this.echo = ctx.createDelay(2));
    echo.delayTime.value = 0.45;
    const retour = ctx.createGain();
    retour.gain.value = 0.38;
    const sourdine = ctx.createBiquadFilter();
    sourdine.type = "lowpass";
    sourdine.frequency.value = 3200;
    this.envoiEcho = ctx.createGain();
    this.envoiEcho.gain.value = 0.5;
    this.envoiEcho.connect(echo);
    echo.connect(sourdine).connect(retour).connect(echo);
    sourdine.connect(this.filtre);
    sourdine.connect(this.envoiReverb);

    this.respiration = ctx.createGain();
    this.respiration.connect(this.filtre);

    this.couches = {} as Record<Couche, GainNode>;
    for (const c of COUCHES) {
      const g = ctx.createGain();
      g.gain.value = c === "base" ? 1 : 0;
      g.connect(this.filtre);
      this.couches[c] = g;
    }
    this.actions = ctx.createGain();
    this.actions.gain.value = 1;
    this.actions.connect(compresseur);

    this.bruit = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.bruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Cale l'écho sur la croche pointée du tempo courant. */
  regleEcho(bpm: number, t: number) {
    this.echo.delayTime.setValueAtTime((0.75 * 60) / bpm, t);
  }

  /** Fréquence de coupure du filtre général : le son s'éclaircit quand l'intensité monte. */
  private ouverture = 18000;

  /** Ouvre ou ferme les couches selon le niveau d'intensité (0 à 4). */
  intensite(niveau: number) {
    const now = this.ctx.currentTime;
    this.ouverture = [4500, 7000, 11000, 15000, 19000][Math.max(0, Math.min(4, niveau))];
    this.filtre.frequency.cancelScheduledValues(now);
    this.filtre.frequency.setValueAtTime(this.filtre.frequency.value, now);
    this.filtre.frequency.setTargetAtTime(this.ouverture, now, 0.4);
    COUCHES.forEach((c, i) => {
      if (i === 0) return;
      const cible = niveau >= i ? 1 : 0;
      this.couches[c].gain.setTargetAtTime(cible, now, cible ? 0.35 : 0.12);
    });
  }

  /** Le son s'étouffe une demi-seconde après un raté. */
  etouffer() {
    const f = this.filtre.frequency;
    const now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.setTargetAtTime(700, now, 0.03);
    f.setTargetAtTime(this.ouverture, now + 0.3, 0.25);
  }

  /** La nappe se creuse à chaque coup de grosse caisse : c'est le pouls du morceau. */
  creuser(t: number, force: number) {
    const g = this.respiration.gain;
    g.setValueAtTime(1 - 0.6 * force, t);
    g.setTargetAtTime(1, t + 0.02, 0.11);
  }

  private reponseImpulsionnelle(duree: number, decroissance: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * duree);
    const b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const x = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decroissance) * (i < 200 ? i / 200 : 1);
      }
    }
    return b;
  }
}
