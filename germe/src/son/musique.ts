// La musique générative : elle s'enrichit à mesure que la planète revit.
//   planète morte : un bourdon grave, du vent, une cloche lointaine de temps en temps
//   puis, par paliers : nappe d'accords qui s'éclaircit, arpèges pincés, basse, mélodie de cloches,
//   percussions douces, et pour finir un chœur.
// Le tempo est lent (76 battements par minute), en ré majeur pentatonique.
import { type Audio, hz } from "./audio";

const TEMPO = 76;
const CROCHE = 60 / TEMPO / 2;
/** Accords (notes MIDI) : Ré maj9, Si m7, Sol maj7(#11), La sus4. Deux mesures chacun. */
const ACCORDS = [
  { basse: 38, notes: [50, 57, 64, 66, 69, 73] },
  { basse: 35, notes: [47, 54, 57, 62, 64, 66] },
  { basse: 31, notes: [43, 50, 54, 59, 61, 66] },
  { basse: 33, notes: [45, 52, 57, 62, 64, 69] },
];
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];

export class Musique {
  private croche = 0;
  private prochaine = 0;
  vie = 0;
  nuit = 0;
  /** Intensité générale (0 pendant le titre, 1 en jeu). */
  intensite = 1;
  final = false;
  private melodie = 4;
  private bourdon: { gain: GainNode; filtre: BiquadFilterNode } | null = null;
  private minuterie: number | null = null;

  constructor(private readonly a: Audio) {}

  demarrer() {
    const c = this.a.ctx;
    // Le bourdon : deux dents de scie graves, très filtrées
    const filtre = c.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = 220;
    filtre.Q.value = 2;
    const gain = c.createGain();
    gain.gain.value = 0;
    for (const [n, det] of [[26, -6], [38, 5], [45, 3]]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = hz(n);
      o.detune.value = det;
      o.connect(filtre);
      o.start();
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = c.createGain();
    lg.gain.value = 90;
    lfo.connect(lg).connect(filtre.frequency);
    lfo.start();
    filtre.connect(gain).connect(this.a.musique);
    const r = c.createGain();
    r.gain.value = 0.5;
    gain.connect(r).connect(this.a.reverb);
    this.bourdon = { gain, filtre };
    this.prochaine = c.currentTime + 0.2;
    this.minuterie = window.setInterval(() => this.planifier(), 30);
  }

  arreter() {
    if (this.minuterie) clearInterval(this.minuterie);
  }

  private planifier() {
    const c = this.a.ctx;
    if (this.bourdon) {
      const v = (0.05 * (1 - this.vie * 0.6) + 0.015) * this.intensite;
      this.bourdon.gain.gain.setTargetAtTime(v, c.currentTime, 1.5);
    }
    while (this.prochaine < c.currentTime + 0.15) {
      this.jouerCroche(this.croche, this.prochaine);
      this.croche++;
      this.prochaine += CROCHE;
    }
  }

  private jouerCroche(k: number, t: number) {
    const a = this.a;
    const vie = this.final ? 1 : this.vie;
    const I = this.intensite;
    if (I < 0.01) return;
    const mesure = Math.floor(k / 8);
    const temps = k % 8;
    const accord = ACCORDS[Math.floor(mesure / 2) % ACCORDS.length];
    const nuit = this.nuit;
    const M = a.musique;

    // Nappe : à chaque changement d'accord
    if (k % 16 === 0) {
      const ouverture = 350 + vie * 2400 - nuit * 300;
      const vol = (0.018 + vie * 0.03) * I;
      const nb = vie < 0.15 ? 3 : accord.notes.length;
      for (let i = 0; i < nb; i++) this.nappe(hz(accord.notes[i]), t, CROCHE * 16, vol, ouverture);
    }

    // Cloche lointaine quand tout est mort
    if (vie < 0.1 && temps === 0 && mesure % 3 === 0 && Math.random() < 0.6) {
      a.cloche(hz(PENTA[Math.floor(Math.random() * 5)] + 12), t, 0.03 * I, M, 1.2, 3.5);
    }

    // Arpèges pincés
    if (vie > 0.05) {
      const prob = Math.min(0.85, 0.2 + vie * 0.9) * (1 - nuit * 0.35);
      if (Math.random() < prob) {
        const notes = accord.notes;
        const idx = (temps * 3 + mesure) % notes.length;
        const oct = vie > 0.5 && Math.random() < 0.3 ? 12 : 0;
        a.note({
          freq: hz(notes[idx] + 12 + oct),
          t,
          duree: 0.5 + nuit * 0.6,
          volume: (0.03 + vie * 0.02) * I,
          onde: "triangle",
          filtre: 1800 + vie * 2500,
          vers: M,
          reverb: 0.4 + nuit * 0.3,
          echo: 0.4,
        });
      }
    }

    // Basse
    if (vie > 0.2 && (temps === 0 || (temps === 5 && vie > 0.5))) {
      a.note({ freq: hz(accord.basse + 12), t, duree: CROCHE * 3.5, attaque: 0.02, volume: 0.09 * I, onde: "sine", vers: M });
      a.note({ freq: hz(accord.basse + 12), t, duree: CROCHE * 2, attaque: 0.02, volume: 0.025 * I, onde: "triangle", filtre: 500, vers: M });
    }

    // Mélodie de cloches : une marche au hasard dans la gamme
    if (vie > 0.35 && (temps === 0 || temps === 3 || temps === 6) && Math.random() < 0.45 + vie * 0.2) {
      this.melodie = Math.max(0, Math.min(PENTA.length - 1, this.melodie + Math.floor(Math.random() * 5) - 2));
      a.cloche(hz(PENTA[this.melodie]), t, 0.045 * I, M, 0.5, 1.8);
    }

    // Percussions douces
    if (vie > 0.55 && nuit < 0.7) {
      const p = (1 - nuit) * I;
      if (temps === 0 || temps === 4) a.note({ freq: 110, glisse: 42, t, duree: 0.28, volume: 0.16 * p, vers: M });
      if (temps % 2 === 1) a.souffle({ t, duree: 0.05, volume: 0.025 * p, freq: 7000, type: "highpass", vers: M });
      if (temps === 4 && vie > 0.7) a.souffle({ t, duree: 0.1, volume: 0.03 * p, freq: 1800, q: 3, vers: M, reverb: 0.3 });
    }

    // Chœur : une voix aiguë qui tient les notes de l'accord
    if (vie > 0.75 && k % 16 === 8) {
      for (const n of [accord.notes[2], accord.notes[4]]) this.choeur(hz(n + 12), t, CROCHE * 8, 0.018 * I);
    }
  }

  private nappe(f: number, t: number, duree: number, volume: number, ouverture: number) {
    const c = this.a.ctx;
    const g = c.createGain();
    const filtre = c.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = ouverture;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 1.6);
    g.gain.setValueAtTime(volume, t + duree - 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree + 2);
    for (const det of [-7, 7]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filtre);
      o.start(t);
      o.stop(t + duree + 2.1);
    }
    filtre.connect(g).connect(this.a.musique);
    const r = c.createGain();
    r.gain.value = 0.6;
    g.connect(r).connect(this.a.reverb);
  }

  private choeur(f: number, t: number, duree: number, volume: number) {
    const c = this.a.ctx;
    const g = c.createGain();
    const filtre = c.createBiquadFilter();
    filtre.type = "bandpass";
    filtre.frequency.value = 900;
    filtre.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree + 1.5);
    const vib = c.createOscillator();
    vib.frequency.value = 5;
    const vg = c.createGain();
    vg.gain.value = 6;
    vib.connect(vg);
    for (const det of [-10, 0, 10]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      vg.connect(o.detune);
      o.connect(filtre);
      o.start(t);
      o.stop(t + duree + 1.6);
    }
    vib.start(t);
    vib.stop(t + duree + 1.6);
    filtre.connect(g).connect(this.a.musique);
    const r = c.createGain();
    r.gain.value = 0.8;
    g.connect(r).connect(this.a.reverb);
  }
}
