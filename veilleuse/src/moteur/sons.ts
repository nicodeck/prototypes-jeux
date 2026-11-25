// Les sons et la musique de Veilleuse, synthétisés : aucun fichier audio.
//
// Tout baigne dans une grande réverbération de caverne : une réponse impulsionnelle générée
// (du bruit qui décroît en six secondes et s'assombrit en s'éteignant). Par-dessus, une
// ambiance qui ne s'arrête jamais : un drone grave qui respire, un vent souterrain, une nappe
// d'accords lents, des gouttes, des notes de verre et, rarement, du bois et du métal qui
// grincent au loin. Chaque zone a sa couleur ; on passe de l'une à l'autre sans coupure.

export type Zone = "puits" | "galeries" | "crevasse" | "noyees" | "coeur";

type Couleur = {
  /** Volume du vent et fréquence centrale de son filtre. */
  vent: number;
  ventFreq: number;
  /** Volume du drone et ouverture de son filtre. */
  drone: number;
  coupure: number;
  /** Une fondamentale très grave sous le drone. */
  sub: number;
  /** Gouttes, notes de verre et grincements : nombre moyen par seconde. */
  gouttes: number;
  celesta: number;
  grincements: number;
  /** Part des grincements qui sont du bois (le reste : du métal ou un grondement). */
  bois: number;
  /** Volume de la nappe et clarté de son filtre. */
  nappe: number;
  clarte: number;
};

const COULEURS: Record<Zone, Couleur> = {
  // Froid et aérien : le vent descend du haut du puits.
  puits: { vent: 0.16, ventFreq: 720, drone: 0.05, coupure: 230, sub: 0, gouttes: 0.35, celesta: 0.05, grincements: 0.012, bois: 0.3, nappe: 0.85, clarte: 1.1 },
  // Plus chaud, plus proche : le bois des étais travaille.
  galeries: { vent: 0.06, ventFreq: 430, drone: 0.07, coupure: 310, sub: 0.012, gouttes: 0.45, celesta: 0.04, grincements: 0.05, bois: 0.85, nappe: 0.85, clarte: 0.95 },
  // Cristallin : des notes de verre partout.
  crevasse: { vent: 0.09, ventFreq: 950, drone: 0.05, coupure: 260, sub: 0, gouttes: 0.35, celesta: 0.17, grincements: 0.015, bois: 0.4, nappe: 1, clarte: 1.35 },
  // Sourd et aquatique : ça goutte de partout.
  noyees: { vent: 0.04, ventFreq: 300, drone: 0.08, coupure: 180, sub: 0.02, gouttes: 1.4, celesta: 0.05, grincements: 0.02, bois: 0.3, nappe: 0.8, clarte: 0.7 },
  // Grave et solennel.
  coeur: { vent: 0.05, ventFreq: 250, drone: 0.1, coupure: 165, sub: 0.06, gouttes: 0.25, celesta: 0.05, grincements: 0.01, bois: 0.1, nappe: 1.05, clarte: 0.9 },
};

/** L'écran titre : la nappe seule, très calme. */
const TITRE: Couleur = { vent: 0.025, ventFreq: 400, drone: 0, coupure: 200, sub: 0, gouttes: 0.12, celesta: 0.025, grincements: 0, bois: 0, nappe: 0.7, clarte: 0.8 };

const VOLUME = 0.55;
/** Temps de transition entre deux zones (constante de temps, en secondes). */
const FONDU_ZONE = 2.5;

let ctx: AudioContext | null = null;
let sortie: GainNode;
let filtreEau: BiquadFilterNode;
let mix: GainNode;
let reverbEntree: GainNode;
let reverbSortie: GainNode;
let echoEntree: GainNode;
let busSfx: GainNode;
let busMusique: GainNode;
let glissGain: GainNode;
let bruit: AudioBuffer;
let muet = false;

let etat: { zone: Zone; sousLEau: boolean; eclat: number; titre: boolean } = { zone: "puits", sousLEau: false, eclat: 0, titre: true };

type Ambiance = {
  drone: GainNode;
  droneFiltre: BiquadFilterNode;
  sub: GainNode;
  vent: GainNode;
  ventFiltres: BiquadFilterNode[];
  nappe: GainNode;
  nappeFiltre: BiquadFilterNode;
};
let ambiance: Ambiance | null = null;

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const borne = (v: number, min = -1, max = 1) => Math.min(max, Math.max(min, v));
const hasard = (min: number, max: number) => min + Math.random() * (max - min);
const choisir = <T>(liste: readonly T[]) => liste[Math.floor(Math.random() * liste.length)]!;

// ---------------------------------------------------------------------------------------------
// Le contexte et les bus
// ---------------------------------------------------------------------------------------------

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === "undefined") return null;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  const c = ctx;

  // Sortie : volume général, puis un compresseur doux qui garde le tout à un niveau modéré.
  sortie = c.createGain();
  sortie.gain.value = muet ? 0 : VOLUME;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.35;
  sortie.connect(comp).connect(c.destination);

  // Sous l'eau, tout le mélange passe derrière ce filtre.
  filtreEau = c.createBiquadFilter();
  filtreEau.type = "lowpass";
  filtreEau.frequency.value = 20000;
  filtreEau.Q.value = 0.4;
  filtreEau.connect(sortie);

  mix = c.createGain();
  mix.connect(filtreEau);

  // La caverne
  const reverb = c.createConvolver();
  reverb.buffer = reponseImpulsionnelle(c);
  reverbEntree = c.createGain();
  reverbSortie = c.createGain();
  reverbSortie.gain.value = 0.8;
  reverbEntree.connect(reverb).connect(reverbSortie).connect(filtreEau);

  // L'écho, discret et de plus en plus sombre, pour les carillons
  echoEntree = c.createGain();
  const delai = c.createDelay(2);
  delai.delayTime.value = 0.43;
  const echoFiltre = c.createBiquadFilter();
  echoFiltre.type = "lowpass";
  echoFiltre.frequency.value = 2400;
  const echoRetour = c.createGain();
  echoRetour.gain.value = 0.38;
  echoEntree.connect(delai).connect(echoFiltre).connect(echoRetour).connect(delai);
  const echoSortie = c.createGain();
  echoSortie.gain.value = 0.5;
  echoFiltre.connect(echoSortie);
  echoSortie.connect(mix);
  echoSortie.connect(reverbEntree);

  // Les sons du héros : surtout secs, un peu de caverne
  busSfx = c.createGain();
  busSfx.connect(mix);
  const sfxReverb = c.createGain();
  sfxReverb.gain.value = 0.35;
  busSfx.connect(sfxReverb).connect(reverbEntree);

  // La musique : très réverbérée
  busMusique = c.createGain();
  const musiqueSeche = c.createGain();
  musiqueSeche.gain.value = 0.55;
  busMusique.connect(musiqueSeche).connect(mix);
  const musiqueReverb = c.createGain();
  musiqueReverb.gain.value = 0.9;
  busMusique.connect(musiqueReverb).connect(reverbEntree);

  bruit = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Le frottement contre un mur : une boucle de bruit toujours là, dont on règle le volume.
  const gliss = c.createBufferSource();
  gliss.buffer = bruit;
  gliss.loop = true;
  const glissPasseHaut = c.createBiquadFilter();
  glissPasseHaut.type = "highpass";
  glissPasseHaut.frequency.value = 900;
  const glissBande = c.createBiquadFilter();
  glissBande.type = "bandpass";
  glissBande.frequency.value = 2200;
  glissBande.Q.value = 0.6;
  glissGain = c.createGain();
  glissGain.gain.value = 0;
  gliss.connect(glissPasseHaut).connect(glissBande).connect(glissGain).connect(busSfx);
  gliss.start();

  return c;
}

/** Une grande caverne : du bruit stéréo qui décroît en six secondes, avec un grave qui dure plus que l'aigu. */
function reponseImpulsionnelle(c: BaseAudioContext, duree = 6.2) {
  const n = Math.floor(c.sampleRate * duree);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const d = ir.getChannelData(canal);
    let filtre = 0;
    for (let i = 0; i < n; i++) {
      const t = i / c.sampleRate;
      // -60 dB vers six secondes, et une montée d'une vingtaine de millisecondes
      const enveloppe = Math.exp(-t * 1.12) * Math.min(1, t / 0.02);
      // Un passe-bas à un pôle qui se ferme avec le temps : la queue s'assombrit
      const a = 0.07 + 0.7 * Math.exp(-t * 0.9);
      filtre += a * (Math.random() * 2 - 1 - filtre);
      d[i] = filtre * enveloppe;
    }
    // Quelques premières réflexions sur les parois
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(hasard(0.008, 0.11) * c.sampleRate);
      d[i]! += (Math.random() - 0.5) * 0.9 * (1 - k / 10);
    }
  }
  return ir;
}

// ---------------------------------------------------------------------------------------------
// Les briques de base
// ---------------------------------------------------------------------------------------------

type Options = { delai?: number; attaque?: number; q?: number; pan?: number; humide?: number; vers?: AudioNode };

/** Un point d'arrivée pour un son : un panoramique, une part sèche et une part dans la caverne. */
function arrivee(pan: number, humide: number, vers: AudioNode) {
  const c = ctx!;
  const p = c.createStereoPanner();
  p.pan.value = borne(pan);
  p.connect(vers);
  if (humide > 0) {
    const g = c.createGain();
    g.gain.value = humide;
    p.connect(g).connect(reverbEntree);
  }
  return p;
}

function ton(de: number, a: number, duree: number, onde: OscillatorType, volume: number, o: Options = {}) {
  const c = ctx!;
  const t = c.currentTime + (o.delai ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = onde;
  osc.frequency.setValueAtTime(de, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(a, 1), t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), t + (o.attaque ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(g).connect(arrivee(o.pan ?? 0, o.humide ?? 0, o.vers ?? busSfx));
  osc.start(t);
  osc.stop(t + duree + 0.05);
}

function souffle(duree: number, volume: number, type: BiquadFilterType, de: number, a: number, o: Options = {}) {
  const c = ctx!;
  const t = c.currentTime + (o.delai ?? 0);
  const s = c.createBufferSource();
  s.buffer = bruit;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(a, t + duree);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), t + (o.attaque ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(arrivee(o.pan ?? 0, o.humide ?? 0, o.vers ?? busSfx));
  s.start(t, Math.random() * 1.5);
  s.stop(t + duree + 0.05);
}

/** Une somme de partiels sinusoïdaux qui s'éteignent chacun à leur rythme : verre, célesta, cloche. */
function partiels(
  f: number,
  liste: readonly (readonly [rapport: number, niveau: number, duree: number])[],
  volume: number,
  t: number,
  pan: number,
  echo: number,
  humide: number,
  vers: AudioNode = mix,
) {
  const c = ctx!;
  const p = arrivee(pan, humide, vers);
  if (echo > 0) {
    const ge = c.createGain();
    ge.gain.value = echo;
    p.connect(ge).connect(echoEntree);
  }
  for (const [rapport, niveau, duree] of liste) {
    if (f * rapport > 15000) continue;
    const osc = c.createOscillator();
    osc.frequency.value = f * rapport;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(volume * niveau, 0.0002), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(g).connect(p);
    osc.start(t);
    osc.stop(t + duree + 0.05);
  }
}

const VERRE = [[1, 1, 2.4], [2, 0.22, 1.2], [2.76, 0.12, 0.6], [5.4, 0.05, 0.25]] as const;
const CELESTA = [[1, 1, 1.6], [2, 0.3, 0.7], [3, 0.08, 0.35], [4, 0.04, 0.2]] as const;
const CLOCHE = [[0.5, 0.45, 6], [1, 1, 4.5], [1.2, 0.35, 2.6], [1.5, 0.28, 3], [2, 0.32, 2.2], [2.76, 0.16, 1.3], [4.07, 0.07, 0.7]] as const;

function verre(note: number, volume: number, pan: number, t: number, echo = 0.45, humide = 0.9) {
  partiels(hz(note), VERRE, volume, t, pan, echo, humide);
}

/** Une voix de nappe : un sinus et un triangle à peine désaccordés, attaque et relâche lentes. */
function voix(note: number, t: number, attaque: number, tenue: number, relache: number, volume: number, vers: AudioNode, pan = 0) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + attaque);
  g.gain.setValueAtTime(volume, t + attaque + tenue);
  g.gain.linearRampToValueAtTime(0, t + attaque + tenue + relache);
  const p = c.createStereoPanner();
  p.pan.value = borne(pan);
  g.connect(p).connect(vers);
  const fin = t + attaque + tenue + relache + 0.1;
  const f = hz(note);
  for (const [onde, desaccord, niveau] of [["sine", -4, 1], ["triangle", 5, 0.35]] as const) {
    const osc = c.createOscillator();
    osc.type = onde;
    osc.frequency.value = f;
    osc.detune.value = desaccord + (Math.random() - 0.5) * 4;
    const n = c.createGain();
    n.gain.value = niveau;
    osc.connect(n).connect(g);
    osc.start(t);
    osc.stop(fin);
  }
}

function bulles(nombre: number, pan: number, volume = 0.02) {
  for (let i = 0; i < nombre; i++) {
    const f = hasard(260, 800);
    ton(f, f * hasard(1.8, 2.6), hasard(0.04, 0.09), "sine", volume * hasard(0.5, 1), {
      delai: i * 0.045 + Math.random() * 0.06,
      pan: borne(pan + hasard(-0.2, 0.2)),
      humide: 0.3,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// L'ambiance
// ---------------------------------------------------------------------------------------------

function couleur(): Couleur {
  return etat.titre ? TITRE : COULEURS[etat.zone];
}

/** Un oscillateur très lent qui module un paramètre. */
function lfo(c: AudioContext, frequence: number, profondeur: number, cible: AudioParam) {
  const o = c.createOscillator();
  o.frequency.value = frequence;
  const g = c.createGain();
  g.gain.value = profondeur;
  o.connect(g).connect(cible);
  o.start();
}

function bouclerBruit(c: AudioContext) {
  const s = c.createBufferSource();
  s.buffer = bruit;
  s.loop = true;
  s.start(0, Math.random() * 2);
  return s;
}

export function demarrerAmbiance() {
  const c = audio();
  if (!c || ambiance) return;

  // Le drone : ré grave, des dents de scie désaccordées derrière un passe-bas qui ondule.
  const droneFiltre = c.createBiquadFilter();
  droneFiltre.type = "lowpass";
  droneFiltre.frequency.value = 240;
  droneFiltre.Q.value = 0.8;
  lfo(c, 0.021, 70, droneFiltre.frequency);
  const respiration = c.createGain();
  lfo(c, 0.013, 0.25, respiration.gain);
  const drone = c.createGain();
  drone.gain.value = 0;
  droneFiltre.connect(respiration).connect(drone);
  drone.connect(mix);
  const droneReverb = c.createGain();
  droneReverb.gain.value = 0.5;
  drone.connect(droneReverb).connect(reverbEntree);
  for (const [note, onde, desaccord, niveau] of [
    [26, "sawtooth", 0, 0.35],
    [38, "sawtooth", 7, 0.3],
    [38, "sawtooth", -6, 0.3],
    [45, "triangle", -4, 0.22],
    [50, "triangle", 3, 0.08],
  ] as const) {
    const o = c.createOscillator();
    o.type = onde;
    o.frequency.value = hz(note);
    o.detune.value = desaccord;
    const g = c.createGain();
    g.gain.value = niveau;
    o.connect(g).connect(droneFiltre);
    o.start();
  }

  // Une fondamentale presque inaudible, qu'on sent plus qu'on ne l'entend
  const sub = c.createGain();
  sub.gain.value = 0;
  const subOsc = c.createOscillator();
  subOsc.frequency.value = hz(26);
  subOsc.connect(sub).connect(mix);
  subOsc.start();

  // Le vent : deux bruits filtrés, un de chaque côté, qui ondulent à des rythmes différents
  const vent = c.createGain();
  vent.gain.value = 0;
  vent.connect(mix);
  const ventReverb = c.createGain();
  ventReverb.gain.value = 0.6;
  vent.connect(ventReverb).connect(reverbEntree);
  const ventFiltres: BiquadFilterNode[] = [];
  for (const [pan, vitesse, profondeur] of [[-0.6, 0.047, 260], [0.6, 0.031, 200]] as const) {
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.3;
    f.frequency.value = 500;
    lfo(c, vitesse, profondeur, f.frequency);
    lfo(c, vitesse * 2.3, profondeur * 0.35, f.frequency);
    const houle = c.createGain();
    lfo(c, vitesse * 1.6, 0.45, houle.gain);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    bouclerBruit(c).connect(f).connect(houle).connect(p).connect(vent);
    ventFiltres.push(f);
  }

  // La nappe
  const nappeFiltre = c.createBiquadFilter();
  nappeFiltre.type = "lowpass";
  nappeFiltre.frequency.value = 700;
  nappeFiltre.Q.value = 0.5;
  const nappe = c.createGain();
  nappe.gain.value = 0;
  nappeFiltre.connect(nappe).connect(busMusique);

  ambiance = { drone, droneFiltre, sub, vent, ventFiltres, nappe, nappeFiltre };
  appliquer(true);

  planifier(() => {
    jouerAccord();
    return 10;
  }, 0.2);
  planifier(() => {
    const r = couleur().gouttes;
    if (r > 0) goutteAuLoin();
    return attente(r);
  }, 1);
  planifier(() => {
    const r = couleur().celesta * (1 + etat.eclat);
    if (r > 0) phraseDeVerre();
    return attente(r, 1.5);
  }, 4);
  planifier(() => {
    const r = couleur().grincements;
    if (r > 0) grincement();
    return attente(r, 4);
  }, 6);
}

/** Une attente au hasard pour un événement qui arrive en moyenne `parSeconde` fois par seconde. */
function attente(parSeconde: number, minimum = 0.15) {
  if (parSeconde <= 0) return 2;
  return Math.max(minimum, -Math.log(1 - Math.random()) / parSeconde);
}

function planifier(action: () => number, premier: number) {
  const suivant = () => {
    const delai = ctx ? action() : 2;
    setTimeout(suivant, delai * 1000);
  };
  setTimeout(suivant, premier * 1000);
}

// Des accords lents en ré mineur, de la basse vers l'aigu : on en joue plus quand la mine s'éclaire.
const ACCORDS: readonly (readonly number[])[] = [
  [38, 57, 60, 64, 65, 69], // Dm9
  [34, 53, 57, 62, 60, 65], // Bbmaj7(9)
  [41, 57, 60, 67, 64, 72], // Fadd9 (maj7)
  [36, 55, 57, 62, 64, 67], // C6/9
  [38, 57, 60, 65, 64, 69], // Dm9
  [43, 58, 62, 65, 69, 70], // Gm9
  [34, 53, 57, 62, 64, 69], // Bbmaj7(#11)
  [45, 55, 60, 64, 67, 71], // Am7(9)
];
let indiceAccord = 0;

function jouerAccord() {
  if (!ctx || !ambiance) return;
  const t = ctx.currentTime + 0.05;
  const accord = ACCORDS[indiceAccord++ % ACCORDS.length]!;
  const n = etat.titre ? 4 : 3 + Math.round(etat.eclat * 3);
  for (let i = 0; i < Math.min(n, accord.length); i++) {
    const basse = i === 0;
    voix(accord[i]!, t + i * 0.4 + Math.random() * 0.3, 4.5, 6, 7, basse ? 0.05 : 0.034, ambiance.nappeFiltre, basse ? 0 : hasard(-0.45, 0.45));
  }
  // Quand la mine s'est bien rallumée, une voix haute, comme un reflet
  if (!etat.titre && etat.eclat > 0.55) {
    voix(accord[accord.length - 1]! + 12, t + 2.5, 5, 4, 7, 0.012 * etat.eclat, ambiance.nappeFiltre, hasard(-0.6, 0.6));
  }
}

const PENTATONIQUE = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86];

/** Une, deux ou trois notes de verre, au loin. */
function phraseDeVerre() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  const nombre = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3;
  let i = Math.floor(Math.random() * PENTATONIQUE.length);
  const pan = hasard(-0.7, 0.7);
  for (let k = 0; k < nombre; k++) {
    const timbre = etat.zone === "crevasse" ? VERRE : CELESTA;
    partiels(hz(PENTATONIQUE[i]!), timbre, hasard(0.018, 0.04), t + k * hasard(0.35, 0.6), borne(pan + k * 0.15), 0.55, 1, busMusique);
    i = Math.max(0, Math.min(PENTATONIQUE.length - 1, i + choisir([-2, -1, -1, 1, 2])));
  }
}

/** Un « plic » : un sinus très court dont la hauteur remonte. */
function plic(volume: number, pan: number, humide: number, delai = 0) {
  const f = hasard(850, 2300);
  ton(f, f * hasard(1.8, 2.6), hasard(0.05, 0.09), "sine", volume, { delai, pan, humide, attaque: 0.002, vers: mix });
}

function goutteAuLoin() {
  const proche = Math.random() < 0.15;
  plic(proche ? hasard(0.025, 0.045) : hasard(0.006, 0.02), hasard(-0.9, 0.9), proche ? 0.6 : 1.3);
  // Sous terre noyée, une goutte en appelle parfois une autre
  if (etat.zone === "noyees" && Math.random() < 0.35) plic(hasard(0.006, 0.015), hasard(-0.9, 0.9), 1.2, hasard(0.15, 0.6));
}

/** Du bois ou du métal qui travaille quelque part dans la mine, ou un grondement très bas. */
function grincement() {
  const c = ctx!;
  const t = c.currentTime + 0.05;
  const pan = hasard(-0.8, 0.8);
  const tirage = Math.random();
  if (tirage < couleur().bois) {
    // Bois : une dent de scie très grave, hésitante, dans un filtre résonant
    const duree = hasard(1.2, 3);
    const o = c.createOscillator();
    o.type = "sawtooth";
    const base = hasard(55, 120);
    const courbe = new Float32Array(24);
    let v = base;
    for (let i = 0; i < courbe.length; i++) {
      v = Math.max(30, v + hasard(-14, 14));
      courbe[i] = v;
    }
    o.frequency.setValueCurveAtTime(courbe, t, duree);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = hasard(600, 1200);
    f.Q.value = 7;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(hasard(0.012, 0.025), t + duree * 0.35);
    g.gain.linearRampToValueAtTime(0, t + duree);
    o.connect(f).connect(g).connect(arrivee(pan, 1.4, mix));
    o.start(t);
    o.stop(t + duree + 0.05);
  } else if (tirage < couleur().bois + (1 - couleur().bois) * 0.6) {
    // Métal : du bruit dans trois résonances étroites qui glissent lentement vers le bas
    const duree = hasard(3, 5.5);
    const s = bouclerBruit(c);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(hasard(0.05, 0.09), t + duree * 0.4);
    g.gain.linearRampToValueAtTime(0, t + duree);
    const fond = hasard(260, 420);
    for (const r of [1, 1.47, 2.13]) {
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 40;
      f.frequency.setValueAtTime(fond * r, t);
      f.frequency.linearRampToValueAtTime(fond * r * 0.94, t + duree);
      s.connect(f).connect(g);
    }
    g.connect(arrivee(pan, 1.6, mix));
    s.stop(t + duree + 0.05);
  } else {
    // Un grondement : la montagne qui bouge, très loin
    souffle(hasard(3, 5), hasard(0.05, 0.08), "lowpass", 90, 160, { attaque: 1.5, q: 0.7, pan, humide: 1.2, vers: mix });
  }
}

// ---------------------------------------------------------------------------------------------
// Les réglages, appelés à chaque image
// ---------------------------------------------------------------------------------------------

/** Les cibles déjà demandées : on ne relance une transition que si la cible change. */
const cibles = new Map<AudioParam, number>();

function viser(p: AudioParam, v: number, temps: number) {
  const ancienne = cibles.get(p);
  if (ancienne !== undefined && Math.abs(ancienne - v) <= 1e-3 * Math.max(1, Math.abs(v))) return;
  cibles.set(p, v);
  p.setTargetAtTime(v, ctx!.currentTime, temps);
}

function appliquer(immediat = false) {
  if (!ctx) return;
  const eau = immediat ? 0.01 : 0.12;
  viser(filtreEau.frequency, etat.sousLEau ? 600 : 20000, eau);
  viser(reverbSortie.gain, etat.sousLEau ? 1.15 : 0.8, eau);
  if (!ambiance) return;
  const col = couleur();
  const t = immediat ? 0.05 : FONDU_ZONE;
  const eclat = etat.titre ? 0 : etat.eclat;
  viser(ambiance.drone.gain, col.drone, t);
  viser(ambiance.droneFiltre.frequency, col.coupure * (1 + 0.45 * eclat), t);
  viser(ambiance.sub.gain, col.sub, t);
  viser(ambiance.vent.gain, col.vent, t);
  viser(ambiance.ventFiltres[0]!.frequency, col.ventFreq * 0.8, t);
  viser(ambiance.ventFiltres[1]!.frequency, col.ventFreq * 1.25, t);
  viser(ambiance.nappe.gain, col.nappe * (0.85 + 0.3 * eclat), t);
  viser(ambiance.nappeFiltre.frequency, (550 + 2200 * eclat) * col.clarte, t);
}

export function reglerAmbiance(a: { zone: Zone; sousLEau: boolean; eclat: number; titre: boolean }) {
  etat = { zone: a.zone, sousLEau: a.sousLEau, eclat: borne(a.eclat, 0, 1), titre: a.titre };
  appliquer();
}

export function reveillerAudio() {
  const c = audio();
  if (c?.state === "suspended") void c.resume();
}

export function basculerMuet() {
  muet = !muet;
  if (ctx) {
    sortie.gain.cancelScheduledValues(ctx.currentTime);
    sortie.gain.setTargetAtTime(muet ? 0 : VOLUME, ctx.currentTime, 0.05);
  }
  return muet;
}

// ---------------------------------------------------------------------------------------------
// Les sons du héros
// ---------------------------------------------------------------------------------------------

export function son(
  nom: "pas" | "saut" | "sautMural" | "atterrit" | "atterritFort" | "plouf" | "sortieEau" | "brasse" | "lanterne" | "pause",
  pan = 0,
) {
  const c = audio();
  if (!c) return;
  pan = borne(pan);
  switch (nom) {
    case "pas":
      souffle(0.05, hasard(0.025, 0.04), "bandpass", hasard(1600, 3200), hasard(700, 1000), { q: 1.4, pan, humide: 0.15 });
      ton(hasard(120, 170), 60, 0.07, "sine", 0.03, { pan });
      break;
    case "saut":
      souffle(0.24, 0.035, "bandpass", 480, 1700, { q: 0.9, attaque: 0.03, pan, humide: 0.2 });
      break;
    case "sautMural":
      souffle(0.07, 0.03, "highpass", 3200, 2200, { pan, humide: 0.1 });
      souffle(0.24, 0.035, "bandpass", 650, 2000, { q: 0.9, attaque: 0.03, pan, humide: 0.2, delai: 0.02 });
      break;
    case "atterrit":
      souffle(0.14, 0.055, "lowpass", 650, 160, { pan, humide: 0.2 });
      ton(95, 45, 0.12, "sine", 0.05, { pan });
      break;
    case "atterritFort":
      souffle(0.3, 0.09, "lowpass", 900, 120, { pan, humide: 0.5 });
      ton(75, 32, 0.28, "sine", 0.09, { pan });
      // De petits cailloux qui roulent
      for (let i = 0; i < 4; i++) {
        souffle(0.04, hasard(0.01, 0.02), "bandpass", hasard(2000, 4000), 1500, { q: 2, pan: borne(pan + hasard(-0.4, 0.4)), humide: 0.4, delai: 0.08 + i * hasard(0.05, 0.12) });
      }
      break;
    case "plouf":
      souffle(0.55, 0.085, "lowpass", 2600, 280, { pan, humide: 0.5 });
      ton(420, 110, 0.2, "sine", 0.045, { pan });
      bulles(7, pan, 0.022);
      break;
    case "sortieEau":
      souffle(0.35, 0.045, "bandpass", 3200, 1400, { q: 0.7, pan, humide: 0.4 });
      for (let i = 0; i < 3; i++) plic(hasard(0.01, 0.02), borne(pan + hasard(-0.3, 0.3)), 0.6, 0.12 + i * hasard(0.08, 0.2));
      break;
    case "brasse":
      souffle(0.32, 0.03, "lowpass", 900, 260, { attaque: 0.06, pan, humide: 0.3 });
      bulles(3, pan, 0.016);
      break;
    case "lanterne": {
      const t = c.currentTime;
      // Le souffle de la flamme qui prend
      souffle(1.4, 0.05, "bandpass", 240, 1300, { attaque: 0.25, q: 0.8, pan, humide: 0.6 });
      souffle(0.9, 0.02, "highpass", 4000, 2500, { attaque: 0.2, pan, humide: 0.4, delai: 0.15 });
      // Une cloche chaude
      partiels(hz(62), CLOCHE, 0.08, t + 0.02, pan, 0.25, 0.9, busSfx);
      // Un accord qui s'épanouit, de bas en haut (Fmaj9 sur ré)
      [50, 53, 57, 60, 64, 67].forEach((note, i) =>
        voix(note, t + 0.12 + i * 0.11, 0.9, 1.4, 3.8, 0.026, busMusique, borne(pan + hasard(-0.3, 0.3))),
      );
      partiels(hz(81), VERRE, 0.025, t + 0.9, borne(pan + 0.2), 0.6, 1);
      break;
    }
    case "pause":
      partiels(hz(74), CELESTA, 0.04, c.currentTime + 0.01, 0, 0.2, 0.5);
      break;
  }
}

export function glissade(force: number) {
  if (!ctx) return;
  viser(glissGain.gain, borne(force, 0, 1) * 0.05, 0.05);
}

// Ré mineur pentatonique, dans l'aigu
const CRISTAL = [74, 77, 79, 81, 84, 86, 89, 91];

export function cristal(note: number, pan: number, volume: number) {
  const c = audio();
  if (!c) return;
  const n = CRISTAL[Math.max(0, Math.min(CRISTAL.length - 1, Math.round(note)))]!;
  const v = borne(volume, 0, 1);
  const t = c.currentTime + 0.01;
  partiels(hz(n), VERRE, 0.06 * v, t, borne(pan), 0.5, 1);
  // Un reflet à l'octave, plus doux, un souffle après
  partiels(hz(n + 12), VERRE, 0.015 * v, t + 0.07, borne(-pan * 0.5), 0.4, 1);
}

// ---------------------------------------------------------------------------------------------
// La finale : le Cœur se rallume
// ---------------------------------------------------------------------------------------------

export function finale() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.1;

  // Tout l'accord passe par un filtre qui s'ouvre lentement, puis se referme un peu
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = 0.6;
  f.frequency.setValueAtTime(220, t);
  f.frequency.exponentialRampToValueAtTime(5200, t + 9);
  f.frequency.setTargetAtTime(1600, t + 14, 3);
  const g = c.createGain();
  g.gain.value = 0.9;
  f.connect(g).connect(mix);
  const gr = c.createGain();
  gr.gain.value = 1;
  g.connect(gr).connect(reverbEntree);

  // Ré majeur : après tout ce mineur, la lumière revient
  const notes = [26, 38, 45, 50, 54, 57, 62, 64, 66, 69, 74, 78, 81];
  notes.forEach((note, i) => {
    const grave = note < 40;
    voix(note, t + i * 0.45, 5, 9.5 - i * 0.3, 6, grave ? 0.05 : 0.03, f, grave ? 0 : (i % 2 ? 1 : -1) * hasard(0.15, 0.6));
  });

  // Le souffle qui monte avec la lumière
  souffle(9, 0.04, "bandpass", 180, 2800, { attaque: 6, q: 0.7, humide: 1, vers: mix });

  // Une grosse cloche quand tout s'épanouit
  partiels(hz(50), CLOCHE, 0.12, t + 8, 0, 0.3, 1.2);

  // Une cascade de verre qui monte, puis redescend
  const majeure = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
  for (let k = 0; k < 26; k++) {
    const i = k < 13 ? k % majeure.length : (25 - k) % majeure.length;
    verre(majeure[i]!, hasard(0.02, 0.035), (k % 2 ? 1 : -1) * hasard(0.2, 0.75), t + 3 + k * 0.42 + Math.random() * 0.1, 0.5, 1);
  }
}
