// Tout le son est synthétisé avec la Web Audio API : vent, pluie, mer, tonnerre,
// grincements du bois, chocs, cloches des phares et une musique d'ambiance générative.

const NOTE = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Accords (notes MIDI) : ré mineur, sombre et ouvert. À la fin : ré majeur.
const ACCORDS_NUIT = [
  [38, 50, 57, 62, 64],
  [34, 46, 53, 62, 65],
  [41, 48, 57, 60, 64],
  [36, 48, 55, 62, 67],
];
const ACCORDS_AUBE = [
  [38, 50, 57, 62, 66],
  [43, 50, 59, 62, 69],
  [45, 52, 57, 61, 64],
  [38, 50, 54, 62, 69],
];
const GAMME_NUIT = [62, 65, 67, 69, 72, 74, 77, 79];
const GAMME_AUBE = [62, 64, 66, 69, 71, 74, 76, 78];

export class Son {
  ctx: AudioContext | null = null;
  private maitre!: GainNode;
  private reverb!: ConvolverNode;
  private envoiReverb!: GainNode;
  private bruitBlanc!: AudioBuffer;
  private bruitBrun!: AudioBuffer;
  private ventGain!: GainNode;
  private ventFiltre!: BiquadFilterNode;
  private sifflementGain!: GainNode;
  private sifflementFiltre!: BiquadFilterNode;
  private pluieGain!: GainNode;
  private merGain!: GainNode;
  private merFiltre!: BiquadFilterNode;
  private musique!: GainNode;
  private echo!: DelayNode;
  muet = false;
  private prochainAccord = 0;
  private indexAccord = 0;
  private prochaineNote = 0;
  private prochainGrincement = 2;
  aube = false;
  intensiteMusique = 0;

  /** À appeler sur un geste de l'utilisateur. */
  demarrer() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const compresseur = ctx.createDynamicsCompressor();
    compresseur.threshold.value = -16;
    compresseur.ratio.value = 4;
    this.maitre = ctx.createGain();
    this.maitre.gain.value = 0;
    this.maitre.gain.setTargetAtTime(this.muet ? 0 : 0.9, ctx.currentTime, 1.5);
    this.maitre.connect(compresseur).connect(ctx.destination);

    this.bruitBlanc = this.creerBruit(false);
    this.bruitBrun = this.creerBruit(true);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.creerReponse(4.5);
    this.envoiReverb = ctx.createGain();
    this.envoiReverb.gain.value = 0.9;
    this.envoiReverb.connect(this.reverb).connect(this.maitre);

    // vent : bruit brun filtré dont la bande suit les rafales
    this.ventFiltre = ctx.createBiquadFilter();
    this.ventFiltre.type = "bandpass";
    this.ventFiltre.frequency.value = 500;
    this.ventFiltre.Q.value = 0.8;
    this.ventGain = ctx.createGain();
    this.ventGain.gain.value = 0.2;
    this.boucle(this.bruitBrun).connect(this.ventFiltre).connect(this.ventGain).connect(this.maitre);
    // sifflement dans le gréement
    this.sifflementFiltre = ctx.createBiquadFilter();
    this.sifflementFiltre.type = "bandpass";
    this.sifflementFiltre.frequency.value = 1400;
    this.sifflementFiltre.Q.value = 14;
    this.sifflementGain = ctx.createGain();
    this.sifflementGain.gain.value = 0.02;
    this.boucle(this.bruitBlanc).connect(this.sifflementFiltre).connect(this.sifflementGain).connect(this.maitre);

    // pluie : bruit blanc aigu
    const pluieHaut = ctx.createBiquadFilter();
    pluieHaut.type = "highpass";
    pluieHaut.frequency.value = 2500;
    const pluieBas = ctx.createBiquadFilter();
    pluieBas.type = "lowpass";
    pluieBas.frequency.value = 9000;
    this.pluieGain = ctx.createGain();
    this.pluieGain.gain.value = 0.07;
    this.boucle(this.bruitBlanc, 1.37).connect(pluieHaut).connect(pluieBas).connect(this.pluieGain).connect(this.maitre);

    // mer : grondement grave
    this.merFiltre = ctx.createBiquadFilter();
    this.merFiltre.type = "lowpass";
    this.merFiltre.frequency.value = 380;
    this.merGain = ctx.createGain();
    this.merGain.gain.value = 0.35;
    this.boucle(this.bruitBrun, 2.11).connect(this.merFiltre).connect(this.merGain).connect(this.maitre);

    // musique
    this.musique = ctx.createGain();
    this.musique.gain.value = 0.32;
    this.musique.connect(this.maitre);
    this.musique.connect(this.envoiReverb);
    this.echo = ctx.createDelay(2);
    this.echo.delayTime.value = 0.42;
    const retour = ctx.createGain();
    retour.gain.value = 0.38;
    const filtreEcho = ctx.createBiquadFilter();
    filtreEcho.type = "lowpass";
    filtreEcho.frequency.value = 2200;
    this.echo.connect(filtreEcho).connect(retour).connect(this.echo);
    retour.connect(this.envoiReverb);
    retour.connect(this.maitre);
    this.prochainAccord = ctx.currentTime + 0.5;
    this.prochaineNote = ctx.currentTime + 4;
  }

  basculerMuet() {
    this.muet = !this.muet;
    if (this.ctx) this.maitre.gain.setTargetAtTime(this.muet ? 0 : 0.9, this.ctx.currentTime, 0.1);
    return this.muet;
  }

  private creerBruit(brun: boolean) {
    const ctx = this.ctx!;
    const n = ctx.sampleRate * 4;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let dernier = 0;
    for (let i = 0; i < n; i++) {
      const blanc = Math.random() * 2 - 1;
      if (brun) {
        dernier = (dernier + 0.02 * blanc) / 1.02;
        d[i] = dernier * 3.5;
      } else d[i] = blanc;
    }
    return b;
  }

  private creerReponse(duree: number) {
    const ctx = this.ctx!;
    const n = Math.floor(ctx.sampleRate * duree);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return b;
  }

  private boucle(buffer: AudioBuffer, vitesse = 1) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = vitesse;
    s.start();
    return s;
  }

  private source(buffer: AudioBuffer, quand: number, duree: number) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(quand, Math.random() * 3);
    s.stop(quand + duree + 0.1);
    return s;
  }

  /** Mise à jour continue des ambiances. */
  maj(etat: { rafale: number; force: number; pluie: number; vitesse: number; tempete: number; gite: number; tangage: number; enJeu: boolean }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = etat.force * (0.6 + 0.4 * etat.tempete);
    this.ventGain.gain.setTargetAtTime(0.12 + 0.22 * v * (0.7 + etat.rafale * 0.8), t, 0.3);
    this.ventFiltre.frequency.setTargetAtTime(380 + etat.rafale * 600 + Math.sin(t * 0.7) * 80, t, 0.4);
    this.sifflementGain.gain.setTargetAtTime(etat.tempete * (0.008 + etat.rafale * 0.05), t, 0.3);
    this.sifflementFiltre.frequency.setTargetAtTime(1300 + etat.rafale * 700 + Math.sin(t * 1.3) * 150, t, 0.2);
    this.pluieGain.gain.setTargetAtTime(0.075 * etat.pluie, t, 0.5);
    const houle = 0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.23);
    this.merGain.gain.setTargetAtTime((0.18 + 0.25 * houle) * (0.4 + 0.6 * etat.tempete) + etat.vitesse * 0.012, t, 0.3);
    this.merFiltre.frequency.setTargetAtTime(260 + houle * 260 + etat.vitesse * 15, t, 0.3);

    // grincements du bois quand le bateau travaille
    if (etat.enJeu && t > this.prochainGrincement) {
      this.prochainGrincement = t + 1.5 + Math.random() * 4 / (0.5 + Math.abs(etat.gite) * 4 + etat.tempete);
      this.grincement(0.4 + Math.random() * 0.5);
    }
    this.musiqueMaj(t);
  }

  private musiqueMaj(t: number) {
    const ctx = this.ctx!;
    if (t > this.prochainAccord - 0.1) {
      const accords = this.aube ? ACCORDS_AUBE : ACCORDS_NUIT;
      const accord = accords[this.indexAccord % accords.length];
      this.indexAccord++;
      const duree = 11;
      for (const [k, m] of accord.entries()) {
        for (const desaccord of [-6, 5]) {
          const o = ctx.createOscillator();
          o.type = k === 0 ? "triangle" : "sawtooth";
          o.frequency.value = NOTE(m);
          o.detune.value = desaccord + Math.random() * 3;
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = this.aube ? 1100 : 520 + this.intensiteMusique * 300;
          f.Q.value = 0.7;
          const g = ctx.createGain();
          const volume = (k === 0 ? 0.05 : 0.022) * (0.75 + this.intensiteMusique * 0.35);
          g.gain.setValueAtTime(0, this.prochainAccord);
          g.gain.linearRampToValueAtTime(volume, this.prochainAccord + 3.5);
          g.gain.setValueAtTime(volume, this.prochainAccord + duree - 4);
          g.gain.linearRampToValueAtTime(0, this.prochainAccord + duree + 1.5);
          o.connect(f).connect(g).connect(this.musique);
          o.start(this.prochainAccord);
          o.stop(this.prochainAccord + duree + 2);
        }
      }
      this.prochainAccord += duree - 2;
    }
    if (t > this.prochaineNote) {
      const gamme = this.aube ? GAMME_AUBE : GAMME_NUIT;
      const n = gamme[Math.floor(Math.random() * gamme.length)];
      this.cloche(NOTE(n), t + 0.05, 0.05 + this.intensiteMusique * 0.04, 3.5);
      if (Math.random() < 0.3 + this.intensiteMusique * 0.4) {
        const n2 = gamme[Math.floor(Math.random() * gamme.length)];
        this.cloche(NOTE(n2), t + 0.45, 0.035, 3);
      }
      const densite = 0.5 + this.intensiteMusique;
      this.prochaineNote = t + (2.5 + Math.random() * 5) / densite;
    }
  }

  /** Cloche douce : une sinusoïde et ses partiels inharmoniques. */
  cloche(freq: number, quand: number, volume: number, duree: number, versEcho = true) {
    const ctx = this.ctx;
    if (!ctx) return;
    const partiels = [
      [1, 1],
      [2.01, 0.45],
      [2.76, 0.25],
      [5.4, 0.12],
    ];
    for (const [r, a] of partiels) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, quand);
      g.gain.linearRampToValueAtTime(volume * a, quand + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, quand + duree / r);
      o.connect(g).connect(this.musique);
      if (versEcho) g.connect(this.echo);
      o.start(quand);
      o.stop(quand + duree + 0.1);
    }
  }

  tonnerre(distance: number, force: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const delai = Math.min(3.2, distance / 340);
    const t = ctx.currentTime + delai;
    const proche = Math.max(0, 1 - distance / 700);
    // claquement
    if (proche > 0.3) {
      const s = this.source(this.bruitBlanc, t, 0.4);
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5 * proche * force, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      s.connect(f).connect(g).connect(this.maitre);
      g.connect(this.envoiReverb);
    }
    // roulement
    const duree = 3 + force * 3;
    const s = this.source(this.bruitBrun, t, duree);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500 * (0.4 + proche), t);
    f.frequency.exponentialRampToValueAtTime(90, t + duree);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    let tt = t;
    // plusieurs grondements successifs
    for (let i = 0; i < 5; i++) {
      tt += 0.15 + Math.random() * 0.6;
      g.gain.exponentialRampToValueAtTime((1.4 - i * 0.22) * force * (0.5 + proche), tt);
    }
    g.gain.exponentialRampToValueAtTime(0.0005, t + duree);
    s.connect(f).connect(g).connect(this.maitre);
    g.connect(this.envoiReverb);
  }

  /** Grincement du bois : friction en dents de scie, glissando, filtré. */
  grincement(force: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const duree = 0.35 + Math.random() * 0.6;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f0 = 55 + Math.random() * 60;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.8), t + duree);
    const accroche = ctx.createOscillator();
    accroche.frequency.value = 18 + Math.random() * 25;
    const accrocheGain = ctx.createGain();
    accrocheGain.gain.value = 0.5;
    const modulation = ctx.createGain();
    modulation.gain.value = 0.5;
    accroche.connect(accrocheGain).connect(modulation.gain);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 600 + Math.random() * 900;
    f.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * force, t + duree * 0.3);
    g.gain.linearRampToValueAtTime(0, t + duree);
    o.connect(modulation).connect(f).connect(g).connect(this.maitre);
    g.connect(this.envoiReverb);
    o.start(t);
    accroche.start(t);
    o.stop(t + duree + 0.05);
    accroche.stop(t + duree + 0.05);
  }

  /** Vague qui claque contre la coque. */
  clapot(force: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = this.source(this.bruitBlanc, t, 0.6);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 500 + Math.random() * 400;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * force, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    s.connect(f).connect(g).connect(this.maitre);
  }

  choc(force: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = Math.min(1, force / 10);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * (0.4 + f), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(this.maitre);
    o.start(t);
    o.stop(t + 0.7);
    // craquement du bordé
    const s = this.source(this.bruitBlanc, t, 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 350;
    bp.Q.value = 1.5;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.6 * (0.3 + f), t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    s.connect(bp).connect(g2).connect(this.maitre);
    g2.connect(this.envoiReverb);
    this.grincement(1);
    this.clapot(1);
  }

  /** Le phare s'embrase : souffle qui monte, puis accord de cloches. */
  allumage(numero: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = this.source(this.bruitBlanc, t, 2.6);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    s.connect(f).connect(g).connect(this.maitre);
    g.connect(this.envoiReverb);
    const base = 62 + (numero % 3) * 2;
    const arpege = [base - 12, base, base + 7, base + 12, base + 16, base + 19];
    arpege.forEach((m, i) => this.cloche(NOTE(m), t + 1.6 + i * 0.13, 0.11, 6));
    // basse chaude
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = NOTE(base - 24);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t + 1.6);
    g2.gain.linearRampToValueAtTime(0.18, t + 2.2);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 8);
    o.connect(g2).connect(this.musique);
    o.start(t + 1.6);
    o.stop(t + 8.2);
  }

  tonneau() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const o = ctx.createOscillator();
      const q = t + i * 0.09;
      o.frequency.setValueAtTime(220 + i * 40, q);
      o.frequency.exponentialRampToValueAtTime(520 + i * 60, q + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, q);
      g.gain.exponentialRampToValueAtTime(0.12, q + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, q + 0.09);
      o.connect(g).connect(this.maitre);
      o.start(q);
      o.stop(q + 0.1);
    }
    this.cloche(NOTE(81), t + 0.5, 0.06, 2);
  }

  alerte() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.cloche(NOTE(57), t, 0.09, 2, false);
    this.cloche(NOTE(56), t + 0.4, 0.09, 2.5, false);
  }

  naufrage() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 3);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3);
    o.connect(f).connect(g).connect(this.maitre);
    g.connect(this.envoiReverb);
    o.start(t);
    o.stop(t + 3.1);
  }

  victoire() {
    this.aube = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [50, 57, 62, 66, 69, 74, 78, 81].forEach((m, i) => this.cloche(NOTE(m), t + 2 + i * 0.22, 0.09, 8));
  }
}
