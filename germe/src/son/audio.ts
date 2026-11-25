// Le moteur audio : tout est synthétisé avec la Web Audio API, aucun fichier.
// Une sortie générale, une réverbération (réponse impulsionnelle fabriquée avec du bruit), un écho,
// et des petites fabriques de sons (notes, cloches, bruits filtrés).

export const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export class Audio {
  readonly ctx: AudioContext;
  readonly sortie: GainNode;
  /** Bus de la musique et des effets. */
  readonly musique: GainNode;
  readonly effets: GainNode;
  readonly reverb: GainNode;
  readonly echo: GainNode;
  readonly bruit: AudioBuffer;
  private muet = false;

  constructor() {
    this.ctx = new AudioContext();
    const c = this.ctx;
    this.sortie = c.createGain();
    this.sortie.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.sortie.connect(comp).connect(c.destination);

    // Réverbération : du bruit stéréo qui décroît
    const duree = 3.2;
    const ir = c.createBuffer(2, Math.floor(c.sampleRate * duree), c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length;
        d[i] = (Math.random() * 2 - 1) * (1 - t) ** 2.6 * (t < 0.01 ? t / 0.01 : 1);
      }
    }
    const conv = c.createConvolver();
    conv.buffer = ir;
    this.reverb = c.createGain();
    this.reverb.gain.value = 0.55;
    this.reverb.connect(conv).connect(this.sortie);

    // Écho ping-pong doux
    const dl = c.createDelay(2);
    dl.delayTime.value = 0.395 * 1.5;
    const fb = c.createGain();
    fb.gain.value = 0.32;
    const filtre = c.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = 2600;
    this.echo = c.createGain();
    this.echo.gain.value = 0.35;
    this.echo.connect(dl);
    dl.connect(filtre).connect(fb).connect(dl);
    filtre.connect(this.sortie);
    filtre.connect(this.reverb);

    this.musique = c.createGain();
    this.musique.gain.value = 0.55;
    this.musique.connect(this.sortie);
    this.effets = c.createGain();
    this.effets.gain.value = 0.9;
    this.effets.connect(this.sortie);

    this.bruit = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.bruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  get t() {
    return this.ctx.currentTime;
  }

  basculerMuet() {
    this.muet = !this.muet;
    this.sortie.gain.setTargetAtTime(this.muet ? 0 : 0.8, this.t, 0.05);
    return this.muet;
  }

  /** Une note simple avec enveloppe percussive. */
  note(o: {
    freq: number;
    t?: number;
    duree?: number;
    attaque?: number;
    volume?: number;
    onde?: OscillatorType;
    filtre?: number;
    vers?: AudioNode;
    reverb?: number;
    echo?: number;
    glisse?: number;
    pan?: number;
  }) {
    const c = this.ctx;
    const t = o.t ?? c.currentTime;
    const duree = o.duree ?? 0.5;
    const osc = c.createOscillator();
    osc.type = o.onde ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.glisse) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glisse), t + duree);
    const g = c.createGain();
    const att = o.attaque ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.volume ?? 0.1), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + duree);
    let fin: AudioNode = g;
    osc.connect(g);
    if (o.filtre) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.filtre;
      g.connect(f);
      fin = f;
    }
    if (o.pan !== undefined) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      fin.connect(p);
      fin = p;
    }
    fin.connect(o.vers ?? this.effets);
    if (o.reverb) {
      const r = c.createGain();
      r.gain.value = o.reverb;
      fin.connect(r).connect(this.reverb);
    }
    if (o.echo) {
      const e = c.createGain();
      e.gain.value = o.echo;
      fin.connect(e).connect(this.echo);
    }
    osc.start(t);
    osc.stop(t + att + duree + 0.05);
  }

  /** Une cloche : quelques partiels inharmoniques qui s'éteignent lentement. */
  cloche(freq: number, t: number, volume: number, vers?: AudioNode, reverb = 0.6, duree = 2.4) {
    const partiels = [
      [1, 1, duree],
      [2.0, 0.35, duree * 0.6],
      [2.76, 0.22, duree * 0.45],
      [5.4, 0.08, duree * 0.25],
    ];
    for (const [r, v, d] of partiels) {
      this.note({ freq: freq * r, t, duree: d, volume: volume * v, vers, reverb, echo: 0.25 });
    }
  }

  /** Un souffle de bruit filtré. */
  souffle(o: {
    t?: number;
    duree: number;
    volume: number;
    freq: number;
    freqFin?: number;
    q?: number;
    type?: BiquadFilterType;
    attaque?: number;
    vers?: AudioNode;
    reverb?: number;
    pan?: number;
  }) {
    const c = this.ctx;
    const t = o.t ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.bruit;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type ?? "bandpass";
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqFin) f.frequency.exponentialRampToValueAtTime(o.freqFin, t + o.duree);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    const att = o.attaque ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.volume), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + att + o.duree);
    src.connect(f).connect(g);
    let fin: AudioNode = g;
    if (o.pan !== undefined) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      fin = p;
    }
    fin.connect(o.vers ?? this.effets);
    if (o.reverb) {
      const r = c.createGain();
      r.gain.value = o.reverb;
      fin.connect(r).connect(this.reverb);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + att + o.duree + 0.05);
  }

  /** Une boucle de bruit filtré permanente (vent, eau), dont on règle le volume. */
  boucle(freq: number, q: number, type: BiquadFilterType = "bandpass") {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.bruit;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.effets);
    src.start();
    return { filtre: f, gain: g };
  }
}
