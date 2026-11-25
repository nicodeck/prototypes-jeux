// Les sons et la musique d'Aurea, entièrement synthétisés : aucun fichier audio.
//
// Trois couches :
// - le paysage sonore, qui suit la caméra : la houle et les vagues sur les galets, le vent dans
//   les pins, le chœur des cigales, les oiseaux de l'aube, les martinets du soir, les grillons et
//   le petit-duc la nuit, la rumeur du forum et les crieurs, les ateliers (hache, ciseau, meule,
//   scie), le port (coques qui craquent, cordages, cris), les sonnailles des chèvres, les
//   clochettes des portes, la pluie et l'orage ;
// - une musique générative à l'antique : lyre pincée (Karplus-Strong), aulos à deux tuyaux dont un
//   bourdon, tambour sur cadre, crotales, orgue hydraulique. Un « chef » compose une phrase après
//   l'autre dans les modes dorien, phrygien ou mixolydien : elle ne se répète jamais ;
// - les sons d'interface, faits de bois, de terre cuite, de bronze et de cordes.
//
// Tout baigne dans une réverbération de plein air générée (courte et claire le jour, longue et
// sombre la nuit), puis passe par un compresseur doux et un limiteur. Rien n'est créé au
// chargement du module, et aucune fonction exportée ne lève d'exception, même sans Web Audio.

export interface EcouteAmbiance {
  /** 0..24 (aube vers 6 h, crépuscule vers 19 h 30) */
  heure: number;
  pluie: number;
  orage: number;
  vent: number;
  /** 0 = caméra au ras des rues, 1 = vue lointaine */
  zoom: number;
  /** Part de mer et de côte autour du point visé */
  mer: number;
  /** Champs, forêts et collines autour du point visé */
  nature: number;
  /** Densité de maisons et de passants autour du point visé */
  ville: number;
  /** Ateliers proches (bûcheron, carrière, boulangerie, moulin, pressoir) */
  ateliers: number;
  /** Proximité du port */
  port: number;
  /** Habitants au total : la musique s'enrichit */
  population: number;
  /** Niveau atteint (Liberti, Plebeii, Equites) : la musique gagne des instruments */
  palier: 0 | 1 | 2;
  /** La grande fête après la consécration du temple */
  fete: boolean;
  titre: boolean;
  /** Jeu en pause : tout s'assourdit, la musique continue */
  pause: boolean;
}

export type Son =
  | "clic"
  | "survol"
  | "ouvrir"
  | "fermer"
  | "poser"
  | "route"
  | "demolir"
  | "refus"
  | "construit"
  | "evolution"
  | "palier"
  | "temple"
  | "tonnerre"
  | "vague"
  | "navire"
  | "cloche";

const VOLUME = 0.62;
/** Les pistes programment leurs événements jusqu'à cette avance, en secondes. */
const AVANCE = 1.2;
/** Durée de la fête à plein régime, puis du retour au calme (constante de temps), en secondes. */
const FETE_PLEINE = 90;
const FETE_RETOUR = 20;

const ETAT_INITIAL: EcouteAmbiance = {
  heure: 9,
  pluie: 0,
  orage: 0,
  vent: 0.3,
  zoom: 0.5,
  mer: 0.3,
  nature: 0.3,
  ville: 0.3,
  ateliers: 0,
  port: 0,
  population: 0,
  palier: 0,
  fete: false,
  titre: true,
  pause: false,
};

let ctx: AudioContext | null = null;
let muet = false;
let etat: EcouteAmbiance = { ...ETAT_INITIAL };

let sortie!: GainNode;
let filtrePause!: BiquadFilterNode;
let pauseGain!: GainNode;
let mix!: GainNode;
let reverbEntree!: GainNode;
let envoiJour!: GainNode;
let envoiNuit!: GainNode;
let envoiMusique!: GainNode;
let echoEntree!: GainNode;
let busAmbiance!: GainNode;
let busMusique!: GainNode;
let musiqueNiveau!: GainNode;
let busSfx!: GainNode;
/** L'entrée de la caisse de résonance de la lyre */
let lyreCorps!: AudioNode;
let lyreEcho!: GainNode;

let blanc!: AudioBuffer;
let rose!: AudioBuffer;
let brun!: AudioBuffer;
/** Des galets qui roulent : de petits chocs épars */
let crepitement!: AudioBuffer;
/** Des gouttes de pluie, sur la terre et sur les tuiles */
let gouttes!: AudioBuffer;
/** Une stridulation de grillon : trois impulsions */
let stridulation!: AudioBuffer;

const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);
function borne(v: number, min = -1, max = 1) {
  if (!Number.isFinite(v)) return Math.min(max, Math.max(min, 0));
  return Math.min(max, Math.max(min, v));
}
const hasard = (a: number, b: number) => a + Math.random() * (b - a);
const entier = (a: number, b: number) => Math.floor(hasard(a, b + 1));
const choisir = <T>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)] as T;
function lisse(a: number, b: number, x: number) {
  const t = borne((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Une attente au hasard pour un événement qui arrive en moyenne `parSeconde` fois par seconde. */
function attente(parSeconde: number, minimum = 0.1) {
  if (parSeconde <= 1e-4) return 1;
  return Math.max(minimum, -Math.log(1 - Math.random()) / parSeconde);
}
function tirer<T>(poids: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, p] of poids) total += p;
  let r = Math.random() * total;
  for (const [v, p] of poids) {
    r -= p;
    if (r <= 0) return v;
  }
  return poids[poids.length - 1]![0];
}

// Les moments de la journée, de 0 à 1
const jour = (h: number) => lisse(5.2, 7.2, h) * (1 - lisse(19.3, 21, h));
const aube = (h: number) => lisse(4.6, 5.8, h) * (1 - lisse(7.4, 9, h));
const chaleur = (h: number) => lisse(8.5, 11, h) * (1 - lisse(18.6, 19.9, h));
const crepuscule = (h: number) => lisse(18, 19.2, h) * (1 - lisse(20.5, 21.8, h));

// ---------------------------------------------------------------------------------------------
// Le contexte, les bus et les tampons
// ---------------------------------------------------------------------------------------------

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  let c: AudioContext;
  try {
    c = new Ctor();
    construire(c);
  } catch {
    return null;
  }
  ctx = c;
  return c;
}

function gain(c: BaseAudioContext, v = 1) {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

function filtre(c: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7, g = 0) {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = g;
  return b;
}

function panneau(c: BaseAudioContext, pan: number) {
  const p = c.createStereoPanner();
  p.pan.value = borne(pan);
  return p;
}

/** Une source de tampon, en boucle par défaut, qui démarre à un endroit au hasard. */
function source(c: BaseAudioContext, buf: AudioBuffer, boucle = true, vitesse = 1) {
  const s = c.createBufferSource();
  s.buffer = buf;
  s.loop = boucle;
  s.playbackRate.value = vitesse;
  return s;
}

/** Un bruit en boucle qui tourne en permanence (les couches de fond). */
function continu(c: BaseAudioContext, buf: AudioBuffer, vitesse = 1) {
  const s = source(c, buf, true, vitesse);
  s.start(0, Math.random() * (buf.duration - 0.1));
  return s;
}

function oscillateur(c: BaseAudioContext, type: OscillatorType, f: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  return o;
}

/** Un oscillateur lent qui module un paramètre. */
function lfo(c: BaseAudioContext, f: number, profondeur: number, cible: AudioParam, type: OscillatorType = "sine") {
  const o = oscillateur(c, type, f);
  const g = gain(c, profondeur);
  o.connect(g).connect(cible);
  o.start();
  return o;
}

/** Un départ vers la réverbération. */
function envoi(depuis: AudioNode, niveau: number, vers: AudioNode = reverbEntree) {
  const g = gain(depuis.context, niveau);
  depuis.connect(g).connect(vers);
  return g;
}

function construire(c: AudioContext) {
  // La sortie : volume général, compresseur doux, puis un limiteur qui rattrape les crêtes
  sortie = gain(c, muet ? 0 : VOLUME);
  const doux = c.createDynamicsCompressor();
  doux.threshold.value = -20;
  doux.knee.value = 14;
  doux.ratio.value = 2.5;
  doux.attack.value = 0.02;
  doux.release.value = 0.3;
  const limiteur = c.createDynamicsCompressor();
  limiteur.threshold.value = -5;
  limiteur.knee.value = 0;
  limiteur.ratio.value = 20;
  limiteur.attack.value = 0.002;
  limiteur.release.value = 0.12;
  const marge = gain(c, 0.86);
  sortie.connect(doux).connect(limiteur).connect(marge).connect(c.destination);

  // En pause, tout passe derrière ce filtre
  filtrePause = filtre(c, "lowpass", 20000, 0.5);
  // Rien sous 35 Hz : inaudible, mais ça mange la marge
  const coupeBas = filtre(c, "highpass", 35, 0.6);
  pauseGain = gain(c, 1);
  filtrePause.connect(coupeBas).connect(pauseGain).connect(sortie);
  mix = gain(c, 1);
  mix.connect(filtrePause);

  // Deux réverbérations de plein air : le jour, des murs proches et un air sec ; la nuit, une
  // grande queue sombre, comme si l'île entière résonnait
  reverbEntree = gain(c, 1);
  const coupeGraves = filtre(c, "highpass", 170, 0.6);
  reverbEntree.connect(coupeGraves);
  envoiJour = gain(c, 1);
  envoiNuit = gain(c, 0);
  const convJour = c.createConvolver();
  convJour.buffer = reponse(c, 1.9, 0.72, 0.014, 8);
  const convNuit = c.createConvolver();
  convNuit.buffer = reponse(c, 5.2, 0.3, 0.035, 3);
  const retour = gain(c, 0.7);
  coupeGraves.connect(envoiJour).connect(convJour).connect(retour);
  coupeGraves.connect(envoiNuit).connect(convNuit).connect(retour);
  retour.connect(filtrePause);

  // Un écho lointain, pour la lyre la nuit et quelques sons d'interface : comme une colline en face
  echoEntree = gain(c, 1);
  const delai = c.createDelay(2);
  delai.delayTime.value = 0.43;
  const echoFiltre = filtre(c, "lowpass", 2300, 0.5);
  const echoRetour = gain(c, 0.34);
  echoEntree.connect(delai).connect(echoFiltre).connect(echoRetour).connect(delai);
  const echoSortie = gain(c, 0.42);
  echoFiltre.connect(echoSortie);
  echoSortie.connect(mix);
  echoSortie.connect(reverbEntree);

  busAmbiance = gain(c, 1);
  busAmbiance.connect(mix);
  envoi(busAmbiance, 0.2);

  busMusique = gain(c, 1);
  musiqueNiveau = gain(c, 0.85);
  busMusique.connect(musiqueNiveau).connect(mix);
  envoiMusique = envoi(musiqueNiveau, 0.5);

  busSfx = gain(c, 1);
  busSfx.connect(mix);
  envoi(busSfx, 0.18);

  // La caisse de la lyre : deux résonances de bois, et un aigu adouci
  const r1 = filtre(c, "peaking", 205, 1.3, 4);
  const r2 = filtre(c, "peaking", 540, 1.7, 2.5);
  const adoucir = filtre(c, "highshelf", 5200, 0.7, -6);
  r1.connect(r2).connect(adoucir).connect(busMusique);
  lyreCorps = r1;
  lyreEcho = gain(c, 0.12);
  adoucir.connect(lyreEcho).connect(echoEntree);

  tampons(c);

  // Pour les tests de mixage : si la page a préparé cet objet, on y range les bus.
  const sonde = (globalThis as unknown as { __aureaSons?: Record<string, unknown> }).__aureaSons;
  if (sonde) Object.assign(sonde, { ctx: c, ambiance: busAmbiance, musique: musiqueNiveau, sfx: busSfx });
}

/** Une réponse impulsionnelle : du bruit stéréo qui décroît et s'assombrit, plus quelques échos de murs. */
function reponse(c: BaseAudioContext, duree: number, ouverture: number, predelai: number, reflexions: number) {
  const sr = c.sampleRate;
  const n = Math.max(1, Math.floor(sr * (duree + predelai)));
  const ir = c.createBuffer(2, n, sr);
  for (let canal = 0; canal < 2; canal++) {
    const d = ir.getChannelData(canal);
    let f = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr - predelai;
      if (t < 0) continue;
      const env = Math.exp((-6.9 * t) / duree) * Math.min(1, t / 0.012);
      const a = Math.min(0.95, ouverture * (0.2 + 0.8 * Math.exp((-t * 4) / duree)));
      f += a * (Math.random() * 2 - 1 - f);
      d[i] = f * env;
    }
    for (let k = 0; k < reflexions; k++) {
      const i = Math.floor((predelai + hasard(0.005, 0.085)) * sr);
      if (i < n) d[i] += (Math.random() - 0.5) * 0.8 * (1 - k / reflexions);
    }
  }
  return ir;
}

function tampons(c: BaseAudioContext) {
  const sr = c.sampleRate;
  const n = Math.floor(sr * 4);
  blanc = c.createBuffer(1, n, sr);
  rose = c.createBuffer(1, n, sr);
  brun = c.createBuffer(1, n, sr);
  const b = blanc.getChannelData(0);
  const r = rose.getChannelData(0);
  const u = brun.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, dernier = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b[i] = w;
    // Bruit rose (méthode de Paul Kellet)
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    r[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
    // Bruit brun : du blanc intégré, qui fuit lentement
    dernier = (dernier + 0.02 * w) / 1.02;
    u[i] = dernier * 3.5;
  }
  // Pour boucler sans claquement, on retire la dérive du bruit brun
  const derive = u[n - 1]! - u[0]!;
  for (let i = 0; i < n; i++) u[i] -= (derive * i) / (n - 1);

  // Les galets : des chocs brefs, irréguliers
  crepitement = c.createBuffer(1, Math.floor(sr * 3), sr);
  const cr = crepitement.getChannelData(0);
  for (let i = 0; i < cr.length; ) {
    i += Math.floor((-Math.log(1 - Math.random()) * sr) / 420) + 1;
    const a = Math.random() ** 2;
    const l = 25 + Math.floor(Math.random() * 150);
    for (let k = 0; k < l && i + k < cr.length; k++) cr[i + k] += a * (Math.random() * 2 - 1) * Math.exp((-k * 4) / l);
  }

  // La pluie : des gouttes fines sur la terre et quelques plic plus graves dans les flaques
  gouttes = c.createBuffer(1, Math.floor(sr * 4), sr);
  const go = gouttes.getChannelData(0);
  const goutte = (debut: number, f: number, duree: number, a: number) => {
    const l = Math.floor(duree * sr);
    for (let k = 0; k < l && debut + k < go.length; k++) {
      const t = k / sr;
      go[debut + k] += a * Math.sin(2 * Math.PI * f * t * (1 + t * 8)) * Math.exp((-t * 5) / duree);
    }
  };
  for (let i = 0; i < go.length; ) {
    i += Math.floor((-Math.log(1 - Math.random()) * sr) / 170) + 1;
    goutte(i, hasard(1800, 5600), hasard(0.004, 0.011), Math.random() ** 3 * 0.8);
    if (Math.random() < 0.08) goutte(i, hasard(600, 1300), hasard(0.02, 0.05), Math.random() ** 2 * 0.35);
  }

  // Le grillon : trois impulsions vers 4,6 kHz
  stridulation = c.createBuffer(1, Math.floor(sr * 0.12), sr);
  const st = stridulation.getChannelData(0);
  for (let p = 0; p < 3; p++) {
    const debut = Math.floor((p * 0.03 + 0.004) * sr);
    const l = Math.floor(0.017 * sr);
    for (let k = 0; k < l; k++) {
      const t = k / sr;
      const env = Math.sin((Math.PI * k) / l) ** 2;
      st[debut + k] = env * (Math.sin(2 * Math.PI * 4600 * t) + 0.18 * Math.sin(2 * Math.PI * 9200 * t)) * 0.8;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Les briques des sons ponctuels (toutes prennent un temps absolu de l'horloge audio)
// ---------------------------------------------------------------------------------------------

/** Une sortie pour un son ponctuel : éloignement (passe-bas), panoramique et part de réverbération. */
function sortieSon(pan: number, vers: AudioNode, humide = 0, lointain = 20000): AudioNode {
  const c = ctx!;
  const p = panneau(c, pan);
  p.connect(vers);
  if (humide > 0) envoi(p, humide);
  if (lointain < 18000) {
    const f = filtre(c, "lowpass", lointain, 0.5);
    f.connect(p);
    return f;
  }
  return p;
}

/** Un oscillateur bref dont la hauteur glisse de f0 à f1. */
function ton(t: number, f0: number, f1: number, duree: number, onde: OscillatorType, volume: number, vers: AudioNode, attaque = 0.004) {
  const c = ctx!;
  const o = oscillateur(c, onde, f0);
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duree);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(attaque, duree * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(vers);
  o.start(t);
  o.stop(t + duree + 0.05);
}

/** Du bruit filtré, bref, dont le filtre glisse de f0 à f1. */
function souffle(
  t: number,
  buf: AudioBuffer,
  duree: number,
  volume: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  vers: AudioNode,
  attaque = 0.004,
) {
  const c = ctx!;
  const s = source(c, buf);
  const f = filtre(c, type, f0, q);
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duree);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(attaque, duree * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(vers);
  s.start(t, Math.random() * (buf.duration - 0.5));
  s.stop(t + duree + 0.05);
}

type Partiel = readonly [rapport: number, niveau: number, duree: number];

/** Une somme de partiels qui s'éteignent chacun à leur rythme : cloches, crotales, métal. */
function partiels(t: number, f: number, liste: readonly Partiel[], volume: number, vers: AudioNode) {
  const c = ctx!;
  for (const [rapport, niveau, duree] of liste) {
    const fr = f * rapport;
    if (fr > 16000) continue;
    const o = oscillateur(c, "sine", fr);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(volume * niveau, 0.0002), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(vers);
    o.start(t);
    o.stop(t + duree + 0.05);
  }
}

const CLOCHETTE: readonly Partiel[] = [[1, 1, 1.7], [2.0, 0.35, 1.1], [2.76, 0.32, 0.8], [4.07, 0.14, 0.45], [5.4, 0.09, 0.3]];
const SONNAILLE: readonly Partiel[] = [[1, 1, 0.9], [2.32, 0.5, 0.5], [3.96, 0.3, 0.32], [5.48, 0.18, 0.2]];
const CROTALE: readonly Partiel[] = [[1, 1, 1.6], [1.58, 0.6, 1.2], [2.42, 0.45, 0.9], [3.3, 0.3, 0.6], [4.6, 0.2, 0.4]];
const CISEAU: readonly Partiel[] = [[1, 1, 0.16], [2.76, 0.5, 0.09], [4.13, 0.3, 0.05], [5.9, 0.15, 0.03]];
const TERRE_CUITE: readonly Partiel[] = [[1, 1, 0.14], [2.13, 0.45, 0.08], [3.4, 0.2, 0.05]];
const BOIS: readonly Partiel[] = [[1, 1, 0.09], [2.57, 0.4, 0.05], [4.3, 0.15, 0.03]];

/** Les voyelles : deux formants (Hz). */
const VOYELLES: readonly (readonly [number, number, number])[] = [
  [730, 1090, 2440], // a
  [530, 1840, 2480], // è
  [390, 2000, 2550], // é
  [300, 870, 2240], // ou
  [570, 840, 2410], // o
  [270, 2290, 3010], // i
];

/** Une voix humaine synthétique : une dent de scie dans trois formants. Renvoie de quoi la piloter. */
function voixFormants(t: number, base: number, vers: AudioNode) {
  const c = ctx!;
  const o = oscillateur(c, "sawtooth", base);
  const pre = filtre(c, "lowpass", 3200, 0.5);
  const env = gain(c, 0);
  const formants = [0, 1, 2].map((i) => {
    const f = filtre(c, "bandpass", VOYELLES[0]![i]!, [7, 9, 12][i]!);
    const g = gain(c, [1.6, 0.9, 0.45][i]!);
    pre.connect(f).connect(g).connect(env);
    return f;
  });
  o.connect(pre);
  env.connect(vers);
  o.start(t);
  return { o, env, formants };
}

// ---------------------------------------------------------------------------------------------
// Le paysage sonore
// ---------------------------------------------------------------------------------------------

/** Les niveaux de chaque famille de sons, de 0 à 1, recalculés à chaque réglage. */
const niv = {
  vagues: 0,
  merFond: 0,
  vent: 0,
  sifflement: 0,
  cigales: 0,
  grillons: 0,
  hibou: 0,
  oiseaux: 0,
  martinets: 0,
  mouettes: 0,
  foule: 0,
  rue: 0,
  ateliers: 0,
  port: 0,
  chevres: 0,
  pluie: 0,
  orage: 0,
  carillons: 0,
  pop: 0,
};
type Famille = Exclude<keyof typeof niv, "pop">;

/** Le volume de chaque famille quand son niveau vaut 1. */
const BASE: Record<Famille, number> = {
  vagues: 1.1,
  merFond: 0.11,
  vent: 0.38,
  sifflement: 0.06,
  cigales: 1.0,
  grillons: 0.17,
  hibou: 0.16,
  oiseaux: 0.38,
  martinets: 0.14,
  mouettes: 0.26,
  foule: 0.2,
  rue: 0.55,
  ateliers: 0.6,
  port: 0.42,
  chevres: 0.24,
  pluie: 0.6,
  orage: 0.5,
  carillons: 0.1,
};

interface Voix {
  o: OscillatorNode;
  f1: BiquadFilterNode;
  f2: BiquadFilterNode;
  syll: GainNode;
  base: number;
  active: boolean;
}

interface Aulos {
  a: OscillatorNode;
  b: OscillatorNode;
  bourdon: OscillatorNode;
  bourdonGain: GainNode;
  env: GainNode;
  vib: GainNode;
}

interface Couches {
  bus: Record<Famille, GainNode>;
  rafale: GainNode;
  ventFiltres: BiquadFilterNode[];
  cigales: { env: GainNode; poids: number }[];
  voix: Voix[];
  aulos: Aulos;
}
let couches: Couches | null = null;

function creerCouches(c: AudioContext): Couches {
  const bus = {} as Record<Famille, GainNode>;
  for (const f of Object.keys(BASE) as Famille[]) {
    bus[f] = gain(c, 0);
    bus[f].connect(busAmbiance);
  }
  // Certaines familles résonnent plus loin
  envoi(bus.hibou, 0.7);
  envoi(bus.chevres, 0.5);
  envoi(bus.orage, 0.6);
  envoi(bus.ateliers, 0.25);
  envoi(bus.mouettes, 0.3);

  // La houle au loin : un bruit brun qui respire, et le chuintement de la surface
  {
    const houle = gain(c, 0.65);
    lfo(c, 0.083, 0.3, houle.gain);
    lfo(c, 0.031, 0.12, houle.gain);
    continu(c, brun).connect(filtre(c, "highpass", 55, 0.6)).connect(filtre(c, "lowpass", 480, 0.6)).connect(houle);
    const surface = gain(c, 0.6);
    continu(c, rose).connect(filtre(c, "bandpass", 950, 0.5)).connect(surface).connect(houle);
    houle.connect(bus.merFond);
  }

  // Le vent : deux bandes de bruit rose qui ondulent, le froissement des aiguilles de pin et,
  // dans l'orage, un sifflement
  const rafale = gain(c, 1);
  rafale.connect(bus.vent);
  const ventFiltres: BiquadFilterNode[] = [];
  for (const [pan, f, vitesse] of [[-0.55, 360, 0.047], [0.55, 700, 0.031]] as const) {
    const bp = filtre(c, "bandpass", f, 0.9);
    lfo(c, vitesse, f * 0.35, bp.frequency);
    lfo(c, vitesse * 2.7, f * 0.12, bp.frequency);
    const g = gain(c, 0.7);
    lfo(c, vitesse * 1.7, 0.3, g.gain);
    continu(c, rose).connect(bp).connect(g).connect(panneau(c, pan)).connect(rafale);
    ventFiltres.push(bp);
  }
  {
    const aiguilles = gain(c, 0.05);
    continu(c, blanc).connect(filtre(c, "highpass", 2600, 0.5)).connect(filtre(c, "lowpass", 6500, 0.5)).connect(aiguilles).connect(rafale);
    const bp = filtre(c, "bandpass", 1500, 9);
    lfo(c, 0.07, 450, bp.frequency);
    lfo(c, 0.19, 160, bp.frequency);
    continu(c, blanc).connect(bp).connect(gain(c, 0.6)).connect(bus.sifflement);
  }

  // Les cigales : quatre individus, chacun un bruit étroit haché par une impulsion rapide, puis
  // par une pulsation plus lente, dans une enveloppe de chant qui monte et retombe
  const ondeCigale = (() => {
    const nb = 14;
    const re = new Float32Array(nb);
    const im = new Float32Array(nb);
    for (let k = 1; k < nb; k++) im[k] = 1 / k ** 0.35;
    return c.createPeriodicWave(re, im);
  })();
  const cigales: { env: GainNode; poids: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const f = hasard(4300, 6400);
    const bp1 = filtre(c, "bandpass", f, 4.5);
    const bp2 = filtre(c, "bandpass", f * hasard(0.98, 1.03), 2.5);
    const hache = gain(c, 0.5);
    const imp = c.createOscillator();
    imp.setPeriodicWave(ondeCigale);
    imp.frequency.value = hasard(170, 240);
    imp.connect(gain(c, 0.5)).connect(hache.gain);
    imp.start();
    const pulse = gain(c, 0.62);
    lfo(c, hasard(7, 13), 0.38, pulse.gain);
    const env = gain(c, 0);
    continu(c, blanc).connect(bp1).connect(bp2).connect(hache).connect(pulse).connect(env).connect(panneau(c, hasard(-0.85, 0.85))).connect(bus.cigales);
    cigales.push({ env, poids: k === 0 ? 1 : hasard(0.35, 0.85) });
  }

  // La pluie : un rideau de bruit, les gouttes sur la terre et, plus sourdes, sur les tuiles
  {
    continu(c, rose).connect(filtre(c, "highpass", 450, 0.5)).connect(filtre(c, "lowpass", 7500, 0.5)).connect(gain(c, 0.55)).connect(bus.pluie);
    continu(c, gouttes).connect(gain(c, 0.55)).connect(panneau(c, -0.3)).connect(bus.pluie);
    continu(c, gouttes, 0.68).connect(filtre(c, "lowpass", 2600, 0.5)).connect(gain(c, 0.45)).connect(panneau(c, 0.35)).connect(bus.pluie);
  }

  // Le port : l'eau qui clapote contre les coques et le quai
  {
    const clapotis = gain(c, 0.5);
    lfo(c, 0.7, 0.25, clapotis.gain);
    lfo(c, 0.23, 0.15, clapotis.gain);
    continu(c, rose).connect(filtre(c, "bandpass", 380, 1.1)).connect(clapotis).connect(bus.port);
  }

  // La foule : sept voix synthétiques qui bavardent, sur un brouhaha de fond
  const voix: Voix[] = [];
  {
    const lp = filtre(c, "lowpass", 2400, 0.5);
    lp.connect(bus.foule);
    const brouhaha = gain(c, 0.55);
    lfo(c, 0.4, 0.15, brouhaha.gain);
    continu(c, rose).connect(filtre(c, "bandpass", 560, 0.7)).connect(brouhaha).connect(lp);
    for (let k = 0; k < 7; k++) {
      const base = choisir([105, 118, 132, 175, 200, 215, 235]) * hasard(0.95, 1.05);
      const o = oscillateur(c, "sawtooth", base);
      const pre = filtre(c, "lowpass", 2800, 0.5);
      const f1 = filtre(c, "bandpass", 600, 6);
      const f2 = filtre(c, "bandpass", 1500, 9);
      const syll = gain(c, 0);
      o.connect(pre);
      pre.connect(f1).connect(gain(c, 1.4)).connect(syll);
      pre.connect(f2).connect(gain(c, 0.9)).connect(syll);
      syll.connect(panneau(c, hasard(-0.8, 0.8))).connect(lp);
      o.start();
      voix.push({ o, f1, f2, syll, base, active: false });
    }
  }

  return { bus, rafale, ventFiltres, cigales, voix, aulos: creerAulos(c) };
}

// --- Les événements du paysage -----------------------------------------------------------------

/** Une vague : la masse d'eau qui enfle, la déferlante, puis les galets qui roulent au retrait. */
function vague(t: number, force: number, pan: number, vers: AudioNode) {
  const c = ctx!;
  const montee = hasard(1.1, 2.3);
  const retrait = hasard(2.4, 4.2);
  const crete = t + montee;
  const fin = crete + retrait;
  const p = panneau(c, pan);
  p.connect(vers);

  const s = source(c, rose);
  const lp = filtre(c, "lowpass", 260, 0.6);
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.exponentialRampToValueAtTime(700 + 1800 * force, crete);
  lp.frequency.exponentialRampToValueAtTime(330, fin);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6 * force, crete);
  g.gain.setTargetAtTime(0.0001, crete + 0.2, retrait / 3.5);
  s.connect(lp).connect(g).connect(p);
  s.start(t, Math.random() * 3);
  s.stop(fin + 0.3);

  const s2 = source(c, blanc);
  const bp = filtre(c, "bandpass", 2100, 0.45);
  const g2 = gain(c, 0);
  g2.gain.setValueAtTime(0.0001, crete - 0.18);
  g2.gain.exponentialRampToValueAtTime(0.16 * force, crete + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.0001, crete + 1.5);
  s2.connect(bp).connect(g2).connect(p);
  s2.start(crete - 0.2, Math.random() * 3);
  s2.stop(crete + 1.6);

  const s3 = source(c, crepitement, true, hasard(0.8, 1.2));
  const hp = filtre(c, "highpass", 1300, 0.6);
  const g3 = gain(c, 0);
  g3.gain.setValueAtTime(0, crete + 0.25);
  g3.gain.linearRampToValueAtTime(0.5 * force, crete + 0.9);
  g3.gain.exponentialRampToValueAtTime(0.0001, fin);
  s3.connect(hp).connect(g3).connect(p);
  s3.start(crete + 0.2, Math.random() * 2);
  s3.stop(fin + 0.1);
}

/** Le chant d'un oiseau : merle flûté, trille de pinson ou notes fines de rouge-gorge. */
function chantOiseau(t: number, vers: AudioNode) {
  const c = ctx!;
  const o = oscillateur(c, "sine", 2000);
  const g = gain(c, 0);
  const vol = hasard(0.08, 0.3);
  o.connect(g).connect(sortieSon(hasard(-0.9, 0.9), vers, 0.25, hasard(5000, 12000)));
  let x = t;
  const note = (f0: number, f1: number, d: number, v: number) => {
    o.frequency.setValueAtTime(f0, x);
    o.frequency.exponentialRampToValueAtTime(f1, x + d);
    g.gain.setValueAtTime(0, x);
    g.gain.linearRampToValueAtTime(v, x + Math.min(0.012, d * 0.3));
    g.gain.setValueAtTime(v, x + d * 0.7);
    g.gain.linearRampToValueAtTime(0, x + d);
  };
  const espece = Math.random();
  if (espece < 0.4) {
    // Merle : des notes flûtées qui glissent, puis un gazouillis
    for (let i = entier(3, 6); i > 0; i--) {
      const f0 = hasard(1500, 3000);
      const d = hasard(0.09, 0.24);
      note(f0, f0 * hasard(0.7, 1.45), d, vol * hasard(0.6, 1));
      x += d + hasard(0.03, 0.12);
    }
    for (let i = entier(3, 8); i > 0; i--) {
      const f0 = hasard(3500, 6500);
      note(f0, f0 * hasard(0.6, 1.3), 0.03, vol * 0.45);
      x += hasard(0.035, 0.06);
    }
  } else if (espece < 0.7) {
    // Pinson : une trille qui descend, puis une fioriture
    const n = entier(9, 16);
    for (let i = 0; i < n; i++) {
      const f0 = 5200 - (i / n) * 2300;
      note(f0, f0 * 0.85, 0.035, vol * (0.5 + 0.5 * (i / n)));
      x += 0.06;
    }
    note(3200, 5400, 0.12, vol);
    x += 0.14;
    note(5000, 2600, 0.1, vol * 0.7);
    x += 0.1;
  } else {
    // Rouge-gorge : des notes fines et hésitantes, très aiguës
    for (let i = entier(4, 8); i > 0; i--) {
      const f0 = hasard(3800, 7400);
      const d = hasard(0.05, 0.18);
      note(f0, f0 * hasard(0.8, 1.25), d, vol * hasard(0.4, 0.8));
      x += d + hasard(0.02, 0.15);
    }
  }
  o.start(t);
  o.stop(x + 0.05);
}

/** Les martinets du soir : une bande de cris stridents qui traverse le ciel. */
function martinets(t: number, vers: AudioNode) {
  const c = ctx!;
  const sens = Math.random() < 0.5 ? -1 : 1;
  for (let i = entier(2, 5); i > 0; i--) {
    const x = t + hasard(0, 0.6);
    const d = hasard(0.3, 0.6);
    const o = oscillateur(c, "square", hasard(3300, 4300));
    o.frequency.setValueAtTime(o.frequency.value, x);
    o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.82, x + d);
    const mod = oscillateur(c, "sine", hasard(38, 56));
    const prof = gain(c, hasard(350, 650));
    mod.connect(prof).connect(o.frequency);
    const bp = filtre(c, "bandpass", 5200, 2.5);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0, x);
    g.gain.linearRampToValueAtTime(hasard(0.08, 0.18), x + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, x + d);
    const p = panneau(c, -0.8 * sens);
    p.pan.setValueAtTime(-0.8 * sens, x);
    p.pan.linearRampToValueAtTime(0.8 * sens, x + d);
    o.connect(bp).connect(g).connect(p).connect(vers);
    o.start(x);
    mod.start(x);
    o.stop(x + d + 0.05);
    mod.stop(x + d + 0.05);
  }
}

/** Le cri d'une mouette : une plainte qui monte et retombe, rauque. */
function mouette(t: number, vers: AudioNode) {
  const c = ctx!;
  const pan = hasard(-0.85, 0.85);
  const base = hasard(780, 980);
  const out = sortieSon(pan, vers, 0.3, hasard(3500, 6000));
  let x = t;
  for (let i = entier(1, 4); i > 0; i--) {
    const d = hasard(0.26, 0.45);
    const o = oscillateur(c, "sawtooth", base);
    o.frequency.setValueAtTime(base * 0.8, x);
    o.frequency.linearRampToValueAtTime(base * hasard(1.35, 1.6), x + 0.07);
    o.frequency.exponentialRampToValueAtTime(base * 0.72, x + d);
    const vib = oscillateur(c, "sine", hasard(24, 34));
    const vp = gain(c, 28);
    vib.connect(vp).connect(o.frequency);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0, x);
    g.gain.linearRampToValueAtTime(hasard(0.18, 0.32), x + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, x + d);
    for (const [f, q, v] of [[1800, 2, 1], [3100, 3, 0.6]] as const) o.connect(filtre(c, "bandpass", f, q)).connect(gain(c, v)).connect(g);
    g.connect(out);
    o.start(x);
    vib.start(x);
    o.stop(x + d + 0.05);
    vib.stop(x + d + 0.05);
    x += d + hasard(0.08, 0.3);
  }
}

/** Le petit-duc : un « tiou » doux et flûté. */
function tiou(t: number, f: number, pan: number, vers: AudioNode) {
  const c = ctx!;
  const o = oscillateur(c, "sine", f);
  o.frequency.setValueAtTime(f * 1.03, t);
  o.frequency.linearRampToValueAtTime(f, t + 0.05);
  o.frequency.linearRampToValueAtTime(f * 0.96, t + 0.24);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.04);
  g.gain.setValueAtTime(0.5, t + 0.13);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
  const out = sortieSon(pan, vers, 0.4, 2600);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
  souffle(t, blanc, 0.2, 0.03, "bandpass", f, f * 0.96, 8, out, 0.04);
}

/** Un grillon : il stridule régulièrement, avec ses pauses. */
function creerGrillon(vers: AudioNode) {
  const c = ctx!;
  const entree = gain(c, hasard(0.35, 1));
  entree.connect(panneau(c, hasard(-0.85, 0.85))).connect(vers);
  const vitesse = hasard(0.93, 1.07);
  const periode = hasard(0.48, 0.85);
  return (t: number) => {
    if (niv.grillons < 0.02) return t + 1.5;
    if (Math.random() < 0.025) return t + hasard(2, 8);
    const s = source(c, stridulation, false, vitesse * hasard(0.996, 1.004));
    s.connect(entree);
    s.start(t);
    return t + periode * hasard(0.97, 1.03);
  };
}

/** Le bavardage de la foule : chaque voix change de syllabe, de voyelle et d'intonation. */
function animerFoule(t: number) {
  const C = couches!;
  const voulues = Math.round(borne(niv.foule * 1.3, 0, 1) * C.voix.length);
  let actives = C.voix.filter((v) => v.active).length;
  for (const v of C.voix) {
    if (!v.active && actives < voulues && Math.random() < 0.15) {
      v.active = true;
      actives++;
    } else if (v.active && (actives > voulues || Math.random() < 0.025)) {
      v.active = false;
      actives--;
      v.syll.gain.setTargetAtTime(0, t, 0.08);
      continue;
    }
    if (!v.active) continue;
    if (Math.random() < 0.2) {
      v.syll.gain.setTargetAtTime(0, t, 0.04);
      continue;
    }
    const [f1, f2] = choisir(VOYELLES);
    v.syll.gain.setTargetAtTime(hasard(0.25, 1), t, 0.03);
    v.o.frequency.setTargetAtTime(v.base * hasard(0.88, 1.24), t, 0.05);
    v.f1.frequency.setTargetAtTime(f1, t, 0.03);
    v.f2.frequency.setTargetAtTime(f2, t, 0.03);
  }
  return t + hasard(0.1, 0.17);
}

/** Un crieur qui vante sa marchandise : deux à quatre syllabes chantées, la dernière tenue. */
function crieur(t: number, vers: AudioNode) {
  const base = hasard(140, 230);
  const v = voixFormants(t, base, sortieSon(hasard(-0.8, 0.8), vers, 0.5, hasard(2200, 3200)));
  const vib = oscillateur(ctx!, "sine", 5.5);
  vib.connect(gain(ctx!, base * 0.02)).connect(v.o.frequency);
  vib.start(t);
  const vol = hasard(0.12, 0.28);
  let x = t;
  const n = entier(2, 4);
  for (let i = 0; i < n; i++) {
    const derniere = i === n - 1;
    const d = derniere ? hasard(0.6, 1.1) : hasard(0.16, 0.42);
    const voy = choisir(VOYELLES);
    v.o.frequency.setTargetAtTime(base * (derniere ? hasard(0.85, 1.1) : hasard(1, 1.35)), x, 0.04);
    if (derniere) v.o.frequency.setTargetAtTime(base * 0.8, x + d * 0.7, 0.1);
    v.formants.forEach((f, k) => f.frequency.setTargetAtTime(voy[k]!, x, 0.03));
    v.env.gain.setTargetAtTime(vol, x, 0.03);
    v.env.gain.setTargetAtTime(vol * 0.15, x + d - 0.05, 0.025);
    x += d;
  }
  v.env.gain.setTargetAtTime(0, x, 0.08);
  v.o.stop(x + 0.8);
  vib.stop(x + 0.8);
}

/** Les sabots d'un âne sur les pavés, et la roue de sa charrette qui grince. */
function sabots(t: number, vers: AudioNode) {
  const c = ctx!;
  const p = panneau(c, 0);
  const sens = Math.random() < 0.5 ? -1 : 1;
  p.pan.setValueAtTime(-0.7 * sens, t);
  const n = entier(8, 14);
  const pas = hasard(0.24, 0.32);
  p.pan.linearRampToValueAtTime(0.7 * sens, t + n * pas);
  p.connect(vers);
  for (let i = 0; i < n; i++) {
    const x = t + i * pas + (i % 2 ? pas * 0.38 : 0) + hasard(-0.01, 0.01);
    const v = hasard(0.12, 0.22);
    souffle(x, blanc, 0.04, v, "bandpass", hasard(1200, 1700), 900, 3, p, 0.002);
    ton(x, hasard(480, 560), 300, 0.05, "sine", v * 0.4, p, 0.002);
  }
  if (Math.random() < 0.6) grincement(t + 0.3, p, n * pas * 0.8, false, 0.4);
}

/** Du bois qui travaille : coque, roue, poutre. Une dent de scie hésitante dans un filtre résonant. */
function grincement(t: number, vers: AudioNode, duree = hasard(0.8, 2.2), aigu = false, volume = 1) {
  const c = ctx!;
  const o = oscillateur(c, "sawtooth", 80);
  const courbe = new Float32Array(24);
  let v = aigu ? hasard(160, 260) : hasard(55, 120);
  for (let i = 0; i < courbe.length; i++) {
    v = Math.max(30, v + hasard(-14, 14) * (aigu ? 2 : 1));
    courbe[i] = v;
  }
  o.frequency.setValueCurveAtTime(courbe, t, duree);
  const f = filtre(c, "bandpass", aigu ? hasard(1600, 2600) : hasard(600, 1200), 7);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(hasard(0.06, 0.12) * volume, t + duree * 0.35);
  g.gain.linearRampToValueAtTime(0, t + duree);
  o.connect(f).connect(g).connect(vers);
  o.start(t);
  o.stop(t + duree + 0.05);
}

/** Un coup de hache, avec l'écho de la colline. */
function coupHache(t: number, vers: AudioNode, vol: number) {
  souffle(t, blanc, 0.1, vol * 0.5, "bandpass", 650, 420, 1.2, vers, 0.002);
  ton(t, 190, 90, 0.13, "sine", vol * 0.5, vers, 0.002);
  souffle(t, blanc, 0.015, vol * 0.25, "highpass", 3200, 3200, 0.7, vers, 0.001);
}

function atelier(t: number, vers: AudioNode) {
  const c = ctx!;
  const pan = hasard(-0.8, 0.8);
  const out = sortieSon(pan, vers, 0.2, hasard(3500, 9000));
  const quoi = Math.random();
  if (quoi < 0.32) {
    // Le bûcheron
    let x = t;
    const echo = sortieSon(-pan * 0.6, vers, 0.6, 1500);
    for (let i = entier(3, 6); i > 0; i--) {
      const v = hasard(0.5, 0.9);
      coupHache(x, out, v);
      coupHache(x + hasard(0.25, 0.4), echo, v * 0.22);
      x += hasard(1.0, 1.5);
    }
  } else if (quoi < 0.62) {
    // Le tailleur de pierre : le marteau sur le ciseau
    let x = t;
    for (let i = entier(4, 10); i > 0; i--) {
      const v = hasard(0.06, 0.12);
      const f = hasard(2100, 2900);
      partiels(x, f, CISEAU, v, out);
      souffle(x, blanc, 0.02, v * 1.2, "highpass", 4000, 4000, 0.7, out, 0.001);
      if (Math.random() < 0.3) partiels(x + 0.11, f * 1.02, CISEAU, v * 0.6, out);
      x += hasard(0.3, 0.55);
    }
  } else if (quoi < 0.8) {
    // La meule qui tourne, et son bois qui grince à chaque tour
    const d = hasard(4, 7);
    const s = source(c, brun);
    const bp = filtre(c, "bandpass", 230, 1.5);
    const tour = gain(c, 0.6);
    const rot = lfo(c, hasard(0.45, 0.65), 0.4, tour.gain);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.8);
    g.gain.setValueAtTime(0.35, t + d - 0.8);
    g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(bp).connect(tour).connect(g).connect(out);
    s.start(t, Math.random() * 3);
    s.stop(t + d + 0.1);
    rot.stop(t + d + 0.1);
    for (let x = t + 0.5; x < t + d - 1; x += hasard(1.5, 2.2)) grincement(x, out, hasard(0.5, 0.9), false, 0.6);
  } else {
    // La scie qui va et vient
    const d = hasard(3, 5);
    const s = source(c, blanc);
    const bp = filtre(c, "bandpass", 3000, 2);
    lfo(c, 1.8, 900, bp.frequency, "triangle").stop(t + d + 0.1);
    const va = gain(c, 0.5);
    lfo(c, 1.8, 0.45, va.gain, "triangle").stop(t + d + 0.1);
    const g = gain(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.3);
    g.gain.setValueAtTime(0.12, t + d - 0.3);
    g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(bp).connect(va).connect(g).connect(out);
    s.start(t, Math.random() * 3);
    s.stop(t + d + 0.1);
  }
}

/** Le port : bois des coques, cordages, cris de marins, eau qui claque contre le quai. */
function bruitDePort(t: number, vers: AudioNode) {
  const pan = hasard(-0.85, 0.85);
  const quoi = Math.random();
  if (quoi < 0.35) grincement(t, sortieSon(pan, vers, 0.3, 4000));
  else if (quoi < 0.55) grincement(t, sortieSon(pan, vers, 0.25, 6000), hasard(0.3, 0.7), true, 0.7);
  else if (quoi < 0.75) {
    // Un marin hèle quelqu'un, loin sur le quai
    const base = hasard(160, 240);
    const v = voixFormants(t, base, sortieSon(pan, vers, 0.6, 2400));
    const vol = hasard(0.12, 0.22);
    const [d1, d2] = [hasard(0.18, 0.3), hasard(0.4, 0.7)];
    v.o.frequency.setValueAtTime(base, t);
    v.o.frequency.setTargetAtTime(base * 1.3, t + d1, 0.04);
    v.o.frequency.setTargetAtTime(base * 1.1, t + d1 + d2 * 0.6, 0.1);
    VOYELLES[4]!.forEach((f, k) => v.formants[k]!.frequency.setValueAtTime(f, t));
    VOYELLES[1]!.forEach((f, k) => v.formants[k]!.frequency.setTargetAtTime(f, t + d1, 0.03));
    v.env.gain.setValueAtTime(0, t);
    v.env.gain.linearRampToValueAtTime(vol, t + 0.04);
    v.env.gain.setTargetAtTime(vol * 0.3, t + d1 - 0.04, 0.02);
    v.env.gain.setTargetAtTime(vol, t + d1, 0.03);
    v.env.gain.setTargetAtTime(0, t + d1 + d2, 0.08);
    v.o.stop(t + d1 + d2 + 0.6);
  } else {
    // L'eau qui claque contre le quai
    const out = sortieSon(pan, vers, 0.15, 3000);
    for (let i = entier(2, 5); i > 0; i--) {
      const x = t + hasard(0, 0.9);
      souffle(x, rose, hasard(0.08, 0.18), hasard(0.2, 0.4), "lowpass", 900, 260, 1, out, 0.005);
      ton(x, hasard(250, 380), hasard(500, 750), 0.06, "sine", 0.04, out, 0.005);
    }
  }
}

/** Les sonnailles d'un troupeau de chèvres, et parfois un bêlement. */
function chevres(t: number, vers: AudioNode) {
  const c = ctx!;
  const out = sortieSon(hasard(-0.9, 0.9), vers, 0.4, 3600);
  const cloches = [hasard(1300, 1700), hasard(1700, 2100), hasard(2100, 2500)];
  let x = t;
  for (let i = entier(3, 9); i > 0; i--) {
    partiels(x, choisir(cloches), SONNAILLE, hasard(0.04, 0.1), out);
    x += hasard(0.12, 0.6);
  }
  if (Math.random() < 0.3) {
    const y = t + hasard(0.2, 1.5);
    const d = hasard(0.45, 0.8);
    const base = hasard(330, 430);
    const v = voixFormants(y, base, out);
    const vib = oscillateur(c, "sine", hasard(6.5, 8));
    vib.connect(gain(c, 26)).connect(v.o.frequency);
    vib.start(y);
    VOYELLES[1]!.forEach((f, k) => v.formants[k]!.frequency.setValueAtTime(f, y));
    v.env.gain.setValueAtTime(0, y);
    v.env.gain.linearRampToValueAtTime(0.14, y + 0.06);
    v.env.gain.setTargetAtTime(0, y + d, 0.06);
    v.o.frequency.setTargetAtTime(base * 0.9, y + d * 0.5, 0.15);
    v.o.stop(y + d + 0.5);
    vib.stop(y + d + 0.5);
  }
}

/** Une clochette de bronze (tintinnabulum), frappée une ou deux fois par son battant. */
function clochette(t: number, f: number, vol: number, vers: AudioNode) {
  partiels(t, f, CLOCHETTE, vol, vers);
  if (Math.random() < 0.6) partiels(t + hasard(0.12, 0.22), f * 1.003, CLOCHETTE, vol * hasard(0.3, 0.6), vers);
}

/** Le tonnerre : un claquement (s'il est proche), puis un grondement qui roule longtemps. */
function tonnerre(t: number, vol: number, pan: number, proche: boolean, vers: AudioNode) {
  const c = ctx!;
  const p = panneau(c, pan);
  p.connect(vers);
  envoi(p, 0.7);
  if (proche) {
    for (const [dt, v] of [[0, 0.55], [0.06, 0.35], [0.13, 0.2]] as const) {
      const s = source(c, blanc);
      const g = gain(c, 0);
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(v * vol, t + dt + 0.004);
      g.gain.setTargetAtTime(0.0001, t + dt + 0.01, 0.07);
      s.connect(filtre(c, "highpass", 900, 0.5)).connect(g).connect(p);
      s.start(t + dt, Math.random() * 3);
      s.stop(t + dt + 0.6);
    }
  }
  const duree = hasard(5, 9);
  const s = source(c, brun);
  const lp = filtre(c, "lowpass", 280, 0.8);
  lp.frequency.setValueAtTime(proche ? 420 : 240, t);
  lp.frequency.exponentialRampToValueAtTime(110, t + duree);
  const roule = gain(c, 0);
  const courbe = new Float32Array(64);
  let a = 0.5;
  for (let i = 0; i < courbe.length; i++) {
    const x = i / (courbe.length - 1);
    a = borne(a + hasard(-0.25, 0.25), 0.15, 1);
    courbe[i] = Math.min(1, x * 12) * Math.exp(-x * 2.6) * a * vol * 0.9;
  }
  courbe[courbe.length - 1] = 0;
  roule.gain.setValueCurveAtTime(courbe, t + 0.02, duree);
  s.connect(lp).connect(roule).connect(p);
  s.start(t, Math.random() * 3);
  s.stop(t + duree + 0.2);
  ton(t + 0.05, 52, 36, 2, "sine", 0.3 * vol, p, 0.03);
}

/** Une foule qui acclame : des voix « a » qui montent ensemble. */
function acclamation(t: number, duree: number, vol: number, vers: AudioNode) {
  for (let i = 0; i < 10; i++) {
    const x = t + hasard(0, 0.6);
    const base = choisir([120, 140, 190, 220, 250]) * hasard(0.9, 1.15);
    const v = voixFormants(x, base, sortieSon(hasard(-0.9, 0.9), vers, 0.5, 2800));
    const voy = choisir([VOYELLES[0]!, VOYELLES[1]!, VOYELLES[4]!]);
    voy.forEach((f, k) => v.formants[k]!.frequency.setValueAtTime(f, x));
    v.o.frequency.setValueAtTime(base, x);
    v.o.frequency.linearRampToValueAtTime(base * hasard(1.3, 1.6), x + duree * 0.4);
    v.o.frequency.linearRampToValueAtTime(base * 1.1, x + duree);
    v.env.gain.setValueAtTime(0, x);
    v.env.gain.linearRampToValueAtTime(vol * hasard(0.5, 1), x + duree * 0.35);
    v.env.gain.setTargetAtTime(0, x + duree * 0.7, duree * 0.15);
    v.o.stop(x + duree * 1.5);
  }
  souffle(t, rose, duree, vol * 0.6, "bandpass", 500, 900, 0.6, vers, duree * 0.3);
}

// ---------------------------------------------------------------------------------------------
// La musique
// ---------------------------------------------------------------------------------------------

/** Une corde pincée par l'algorithme de Karplus-Strong, calculée une fois par note. */
const cordes = new Map<number, AudioBuffer>();

function corde(c: BaseAudioContext, midi: number): AudioBuffer {
  const m = Math.round(borne(midi, 28, 100));
  const deja = cordes.get(m);
  if (deja) return deja;
  const sr = c.sampleRate;
  const f = hz(m);
  // Les cordes graves de boyau résonnent plus longtemps que les aiguës
  const t60 = borne(5.5 * Math.pow(110 / f, 0.55), 1.1, 6);
  const duree = Math.min(t60 * 0.9 + 0.2, 5.5);
  const n = Math.floor(sr * duree);
  const buf = c.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // Délai total = une période : une ligne entière, plus 0,5 échantillon de la moyenne, plus un passe-tout fractionnaire
  const D = sr / f;
  const N = Math.max(2, Math.floor(D - 0.5 - 0.15));
  const frac = D - 0.5 - N;
  const C = (1 - frac) / (1 + frac);
  const ligne = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += 0.55 * (Math.random() * 2 - 1 - lp);
    ligne[i] = lp;
  }
  // Pincée au huitième de la corde : certaines harmoniques s'éteignent
  const pos = Math.max(1, Math.round(N * 0.12));
  const excitation = ligne.slice();
  let moyenne = 0;
  for (let i = 0; i < N; i++) {
    ligne[i] = excitation[i]! - 0.9 * excitation[(i - pos + N) % N]!;
    moyenne += ligne[i]!;
  }
  moyenne /= N;
  for (let i = 0; i < N; i++) ligne[i] -= moyenne;
  const rho = Math.pow(10, -3 / (t60 * f));
  let ptr = 0;
  let prec = 0;
  let apx = 0;
  let apy = 0;
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    const y = ligne[ptr]!;
    d[i] = y;
    if (Math.abs(y) > max) max = Math.abs(y);
    const moy = 0.5 * (y + prec);
    prec = y;
    const ap = C * moy + apx - C * apy;
    apx = moy;
    apy = ap;
    ligne[ptr] = ap * rho;
    ptr = ptr + 1 === N ? 0 : ptr + 1;
  }
  const k = 0.9 / max;
  const fondu = Math.floor(0.08 * sr);
  for (let i = 0; i < n; i++) d[i] *= k * (i > n - fondu ? (n - i) / fondu : 1);
  cordes.set(m, buf);
  return buf;
}

/** Une note de lyre, pincée au plectre. */
function lyre(t: number, midi: number, vel: number, pan: number) {
  const c = ctx!;
  const s = source(c, corde(c, midi), false);
  const lp = filtre(c, "lowpass", 1300 + 5600 * vel * vel, 0.5);
  const g = gain(c, 0.3 * vel);
  const p = panneau(c, pan);
  s.connect(lp).connect(g).connect(p).connect(lyreCorps);
  s.start(t);
  souffle(t, blanc, 0.008, 0.035 * vel, "bandpass", 3600, 3000, 1.2, p, 0.001);
}

/** Les cordes grattées ensemble, du grave à l'aigu. */
function gratter(t: number, midis: readonly number[], vel: number, pan: number) {
  midis.forEach((m, i) => lyre(t + i * hasard(0.022, 0.034), m, vel * (1 - i * 0.08), pan));
}

/** L'onde d'anche de l'aulos : toutes les harmoniques, décroissantes, un peu nasillardes. */
function creerAulos(c: AudioContext): Aulos {
  const nb = 16;
  const re = new Float32Array(nb);
  const im = new Float32Array(nb);
  const niveaux = [0, 1, 0.75, 0.6, 0.5, 0.42, 0.3, 0.26, 0.18, 0.14, 0.11, 0.08, 0.06, 0.05, 0.04, 0.03];
  for (let k = 1; k < nb; k++) im[k] = niveaux[k]!;
  const onde = c.createPeriodicWave(re, im);
  const a = c.createOscillator();
  const b = c.createOscillator();
  const bourdon = c.createOscillator();
  for (const o of [a, b, bourdon]) {
    o.setPeriodicWave(onde);
    o.frequency.value = 293.66;
  }
  const melange = gain(c, 1);
  a.connect(gain(c, 0.5)).connect(melange);
  b.connect(gain(c, 0.4)).connect(melange);
  const bourdonGain = gain(c, 0);
  bourdon.connect(bourdonGain).connect(melange);
  const souffleAulos = gain(c, 0.05);
  continu(c, blanc).connect(filtre(c, "bandpass", 2300, 0.8)).connect(souffleAulos).connect(melange);
  const env = gain(c, 0);
  melange
    .connect(filtre(c, "highpass", 230, 0.7))
    .connect(filtre(c, "peaking", 1150, 1.6, 7))
    .connect(filtre(c, "peaking", 2700, 2.5, 4))
    .connect(filtre(c, "lowpass", 4600, 0.6))
    .connect(env)
    .connect(panneau(c, 0.3))
    .connect(busMusique);
  const vib = gain(c, 0);
  const vibrato = oscillateur(c, "sine", 5.3);
  vibrato.connect(vib);
  vib.connect(a.detune);
  vib.connect(b.detune);
  for (const o of [a, b, bourdon, vibrato]) o.start();
  return { a, b, bourdon, bourdonGain, env, vib };
}

interface NoteAulos {
  midi: number;
  t: number;
  d: number;
}

/** Une phrase d'aulos, liée, avec coups de langue, appoggiatures et vibrato sur les notes tenues. */
function phraseAulos(A: Aulos, notes: readonly NoteAulos[], bourdon: number, vol: number, vif: boolean) {
  if (notes.length === 0) return 0;
  const t0 = notes[0]!.t;
  A.env.gain.setTargetAtTime(vol, t0, 0.05);
  A.bourdon.frequency.setValueAtTime(hz(bourdon), t0);
  A.bourdonGain.gain.setTargetAtTime(0.3, t0, 0.25);
  notes.forEach((n, i) => {
    const f = hz(n.midi);
    if (i === 0) {
      A.a.frequency.setValueAtTime(f, n.t);
      A.b.frequency.setValueAtTime(f * 1.0035, n.t);
    } else {
      const glisse = Math.random() < 0.22 ? 0.05 : 0.012;
      A.a.frequency.setTargetAtTime(f, n.t, glisse);
      A.b.frequency.setTargetAtTime(f * 1.0035, n.t, glisse);
      if (Math.random() < (vif ? 0.75 : 0.5)) {
        A.env.gain.setTargetAtTime(vol * 0.4, n.t - 0.03, 0.008);
        A.env.gain.setTargetAtTime(vol, n.t + 0.008, 0.02);
      }
    }
    // Une appoggiature : on attaque la note du dessus, puis on retombe
    if (n.d > 0.4 && Math.random() < (vif ? 0.4 : 0.25)) {
      A.a.frequency.setTargetAtTime(f * 2 ** (2 / 12), n.t, 0.006);
      A.a.frequency.setTargetAtTime(f, n.t + 0.075, 0.012);
      A.b.frequency.setTargetAtTime(f * 1.0035 * 2 ** (2 / 12), n.t, 0.006);
      A.b.frequency.setTargetAtTime(f * 1.0035, n.t + 0.075, 0.012);
    }
    A.vib.gain.setTargetAtTime(0, n.t, 0.03);
    if (n.d > 0.38) A.vib.gain.setTargetAtTime(hasard(12, vif ? 16 : 24), n.t + 0.2, 0.15);
  });
  const der = notes[notes.length - 1]!;
  const fin = der.t + der.d;
  A.env.gain.setTargetAtTime(0, fin, 0.08);
  A.bourdonGain.gain.setTargetAtTime(0, fin, 0.12);
  A.vib.gain.setTargetAtTime(0, fin, 0.1);
  return fin;
}

/** Le tambour sur cadre : « dum » au centre de la peau, « tek » au bord, « pa » claqué. */
function tympanum(t: number, type: "dum" | "tek" | "pa", vel: number) {
  const out = sortieSon(0.12, busMusique, 0.15);
  if (type === "dum") {
    ton(t, 98, 58, 0.42, "sine", 0.45 * vel, out, 0.003);
    souffle(t, brun, 0.07, 0.4 * vel, "lowpass", 420, 200, 0.8, out, 0.002);
  } else if (type === "tek") {
    souffle(t, blanc, 0.06, 0.2 * vel, "bandpass", 2500, 2000, 1.5, out, 0.001);
    ton(t, 390, 330, 0.08, "sine", 0.08 * vel, out, 0.001);
  } else {
    souffle(t, blanc, 0.1, 0.28 * vel, "bandpass", 950, 700, 1, out, 0.002);
    ton(t, 190, 150, 0.15, "sine", 0.18 * vel, out, 0.002);
  }
}

function crotale(t: number, vel: number, pan = -0.15, vers: AudioNode = busMusique) {
  const out = sortieSon(pan, vers, 0.3);
  partiels(t, hasard(2550, 2950), CROTALE, 0.045 * vel, out);
  souffle(t, blanc, 0.3, 0.03 * vel, "highpass", 7000, 6000, 0.7, out, 0.002);
}

/** L'orgue hydraulique : des tuyaux doux qui s'ouvrent lentement. */
function orgue(t: number, midis: readonly number[], duree: number, vol: number, vers: AudioNode = busMusique) {
  const c = ctx!;
  const attaque = Math.min(2.5, duree * 0.4);
  const relache = 3;
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attaque);
  g.gain.setValueAtTime(vol, t + duree);
  g.gain.linearRampToValueAtTime(0, t + duree + relache);
  const lp = filtre(c, "lowpass", 1500, 0.4);
  g.connect(lp).connect(vers);
  const tremolo = lfo(c, hasard(4.5, 5.5), vol * 0.06, g.gain);
  const fin = t + duree + relache + 0.1;
  tremolo.stop(fin);
  for (const m of midis) {
    const f = hz(m);
    for (const [type, r, niveau] of [["sine", 1, 0.5], ["triangle", 2, 0.12], ["sine", 3, 0.05]] as const) {
      const o = oscillateur(c, type, f * r);
      o.detune.value = hasard(-4, 4);
      const og = gain(c, niveau);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(fin);
    }
  }
  souffle(t, rose, duree + relache, vol * 0.25, "bandpass", 1800, 1800, 1.5, g, attaque);
}

/** Le cornu (cor de bronze) : un cuivre dont le filtre s'ouvre à l'attaque, la note légèrement prise par en dessous. */
function cornu(t: number, midi: number, duree: number, vol: number, pan: number, vers: AudioNode = busSfx) {
  const c = ctx!;
  const f = hz(midi);
  const lp = filtre(c, "lowpass", 350, 1.2);
  lp.frequency.setValueAtTime(350, t);
  lp.frequency.exponentialRampToValueAtTime(2700, t + 0.08);
  lp.frequency.setTargetAtTime(1500, t + 0.12, 0.2);
  lp.frequency.setTargetAtTime(400, t + duree, 0.05);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);
  g.gain.setTargetAtTime(vol * 0.75, t + 0.1, 0.2);
  g.gain.setTargetAtTime(0, t + duree, 0.06);
  lp.connect(g).connect(sortieSon(pan, vers, 0.45));
  for (const [desaccord, niveau] of [[0, 0.6], [7, 0.45], [-1200, 0.2]] as const) {
    const o = oscillateur(c, "sawtooth", f);
    o.detune.setValueAtTime(desaccord - 45, t);
    o.detune.linearRampToValueAtTime(desaccord, t + 0.06);
    o.connect(gain(c, niveau)).connect(lp);
    o.start(t);
    o.stop(t + duree + 0.5);
  }
}

/** Un chœur : des voix « a » qui s'épanouissent lentement. */
function choeur(t: number, midis: readonly number[], duree: number, vol: number, vers: AudioNode = busSfx) {
  const c = ctx!;
  for (const m of midis) {
    const f = hz(m);
    const env = gain(c, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 1.4);
    env.gain.setValueAtTime(vol, t + duree);
    env.gain.setTargetAtTime(0, t + duree, 1.2);
    env.connect(sortieSon(hasard(-0.6, 0.6), vers, 0.7));
    const somme = gain(c, 1);
    const fin = t + duree + 6;
    const vib = oscillateur(c, "sine", hasard(4.8, 5.6));
    const vibG = gain(c, 12);
    vib.connect(vibG);
    vib.start(t);
    vib.stop(fin);
    for (const desaccord of [-9, 0, 8]) {
      const o = oscillateur(c, "sawtooth", f);
      o.detune.value = desaccord;
      vibG.connect(o.detune);
      o.connect(somme);
      o.start(t);
      o.stop(fin);
    }
    for (const [ff, q, niveau] of [[730, 9, 2.2], [1090, 11, 1.2], [2440, 14, 0.6], [3400, 16, 0.25]] as const) {
      somme.connect(filtre(c, "bandpass", ff, q)).connect(gain(c, niveau)).connect(env);
    }
  }
}

// --- Le chef d'orchestre -----------------------------------------------------------------------

type Humeur = "solennel" | "aube" | "jour" | "soir" | "nuit" | "fete";

const DORIEN = [0, 2, 3, 5, 7, 9, 10] as const;
const PHRYGIEN = [0, 1, 3, 5, 7, 8, 10] as const;
const MIXOLYDIEN = [0, 2, 4, 5, 7, 9, 10] as const;

interface Caractere {
  mode: readonly number[];
  /** Durée d'un temps, en secondes */
  temps: number;
  notes: readonly [number, number];
  silence: number;
  registre: readonly [number, number];
  aulos: number;
  tambour: number;
  nappe: number;
  respiration: readonly [number, number];
  cellules: "lent" | "vif" | "danse";
}

const CARACTERES: Record<Humeur, Caractere> = {
  solennel: { mode: DORIEN, temps: 1.05, notes: [5, 8], silence: 0.06, registre: [-3, 8], aulos: 0, tambour: 0.7, nappe: 1, respiration: [1.5, 3], cellules: "lent" },
  aube: { mode: DORIEN, temps: 0.9, notes: [4, 7], silence: 0.28, registre: [-2, 9], aulos: 0.3, tambour: 0, nappe: 0.7, respiration: [2, 4], cellules: "lent" },
  jour: { mode: MIXOLYDIEN, temps: 0.6, notes: [5, 10], silence: 0.1, registre: [-3, 10], aulos: 0.6, tambour: 0.55, nappe: 0.4, respiration: [1, 2.5], cellules: "vif" },
  soir: { mode: DORIEN, temps: 0.76, notes: [4, 8], silence: 0.24, registre: [-3, 8], aulos: 0.45, tambour: 0.3, nappe: 0.6, respiration: [1.5, 3], cellules: "lent" },
  nuit: { mode: PHRYGIEN, temps: 1.15, notes: [2, 5], silence: 0.4, registre: [-2, 9], aulos: 0, tambour: 0, nappe: 0.3, respiration: [3, 7], cellules: "lent" },
  fete: { mode: MIXOLYDIEN, temps: 0.46, notes: [6, 11], silence: 0, registre: [0, 11], aulos: 0.95, tambour: 1, nappe: 0.3, respiration: [0.5, 1], cellules: "danse" },
};

const CELLULES: Record<Caractere["cellules"], readonly (readonly number[])[]> = {
  lent: [[2], [1, 1], [1.5, 0.5], [1, 0.5, 0.5], [3], [0.5, 0.5, 1]],
  vif: [[1], [0.5, 0.5], [0.75, 0.25], [0.5, 0.5, 1], [1.5, 0.5], [0.25, 0.25, 0.5], [1, 1]],
  danse: [[1, 0.5], [0.5, 0.5, 0.5], [1.5], [0.5, 1], [0.25, 0.25, 0.5, 0.5]],
};

type Frappe = readonly [pos: number, type: "dum" | "tek" | "pa" | "crot", vel: number];
const RYTHMES: Record<"fete" | "jour" | "soir" | "solennel", { cycle: number; motifs: readonly (readonly Frappe[])[] }> = {
  fete: {
    cycle: 3,
    motifs: [
      [[0, "dum", 1], [1, "tek", 0.6], [1.5, "tek", 0.5], [2, "dum", 0.8], [2.5, "tek", 0.65], [1, "crot", 0.5], [2.5, "crot", 0.35]],
      [[0, "dum", 1], [0.5, "tek", 0.4], [1, "pa", 0.7], [2, "dum", 0.75], [2.5, "tek", 0.6], [0, "crot", 0.4]],
      [[0, "dum", 1], [1, "pa", 0.6], [1.5, "dum", 0.6], [2, "tek", 0.6], [2.5, "tek", 0.5], [1.5, "crot", 0.45]],
    ],
  },
  jour: {
    cycle: 4,
    motifs: [
      [[0, "dum", 0.7], [1.5, "tek", 0.35], [2, "pa", 0.45], [3, "tek", 0.35], [3.5, "tek", 0.25]],
      [[0, "dum", 0.7], [2, "dum", 0.45], [2.5, "tek", 0.3], [3, "pa", 0.4]],
    ],
  },
  soir: { cycle: 4, motifs: [[[0, "dum", 0.55], [2, "pa", 0.35], [3, "tek", 0.25]]] },
  solennel: { cycle: 4, motifs: [[[0, "dum", 0.7], [0.4, "dum", 0.4]]] },
};

const TONIQUES = [62, 60, 64, 57] as const;

const musique = {
  tonique: 62,
  mode: DORIEN as readonly number[],
  humeur: "solennel" as Humeur,
  changement: 0,
  motif: null as { pas: number[]; durees: number[] } | null,
};

let feteDebut = -Infinity;
let feteAvant = false;

/** L'intensité de la fête : 1 pendant 90 s, puis un retour progressif au calme. */
function intensiteFete() {
  if (!ctx) return 0;
  const dt = ctx.currentTime - feteDebut;
  if (dt < 0 || !Number.isFinite(dt)) return 0;
  if (dt < FETE_PLEINE) return 1;
  return Math.exp(-(dt - FETE_PLEINE) / FETE_RETOUR);
}

function humeurActuelle(): Humeur {
  if (etat.titre) return "solennel";
  if (intensiteFete() > 0.5) return "fete";
  const h = etat.heure;
  if (aube(h) > 0.5) return "aube";
  if (jour(h) < 0.35) return "nuit";
  if (crepuscule(h) > 0.5) return "soir";
  return "jour";
}

/** La hauteur MIDI d'un degré du mode (0 = tonique, 7 = octave, négatif = plus grave). */
function noteDuDegre(deg: number) {
  const o = Math.floor(deg / 7);
  const i = ((deg % 7) + 7) % 7;
  return musique.tonique + 12 * o + musique.mode[i]!;
}

interface NoteM {
  deg: number;
  dur: number;
}

function tirerPas() {
  return tirer([[-1, 30], [1, 30], [-2, 12], [2, 12], [0, 5], [3, 5], [-3, 5], [4, 2], [-4, 2]] as const);
}

/** Compose une phrase : un rythme fait de cellules, une marche mélodique, une cadence sur un degré stable. */
function composer(K: Caractere, nb: number): NoteM[] {
  const [bas, haut] = K.registre;
  let durees: number[];
  let pasListe: number[];
  const m = musique.motif;
  if (m && Math.random() < 0.35) {
    // On reprend le motif d'avant, un peu varié, ailleurs dans le mode
    durees = m.durees.slice();
    pasListe = m.pas.map((p) => (Math.random() < 0.2 ? p + choisir([-1, 1]) : p));
  } else {
    durees = [];
    while (durees.length < nb) durees.push(...choisir(CELLULES[K.cellules]));
    durees.length = Math.max(1, nb);
    pasListe = [];
    for (let i = 0; i < durees.length - 1; i++) pasListe.push(tirerPas());
    musique.motif = { pas: pasListe, durees };
  }
  let deg = choisir([0, 2, 4, 4, 7, 7]);
  const notes: NoteM[] = [];
  for (let i = 0; i < durees.length; i++) {
    notes.push({ deg, dur: durees[i]! });
    if (i < pasListe.length) {
      deg += pasListe[i]!;
      if (deg < bas) deg = bas + (bas - deg);
      if (deg > haut) deg = haut - (deg - haut);
      deg = Math.max(bas, Math.min(haut, deg));
    }
  }
  // La cadence : la dernière note rejoint le degré stable le plus proche, et dure
  const der = notes[notes.length - 1]!;
  const stables = [-7, -3, 0, 2, 4, 7, 9, 11].filter((s) => s >= bas - 1 && s <= haut + 1);
  der.deg = stables.reduce((a, b) => (Math.abs(b - der.deg) < Math.abs(a - der.deg) ? b : a), stables[0] ?? 0);
  der.dur = Math.max(der.dur, choisir([2, 2, 3]));
  return notes;
}

/** Le tambour joue un motif en boucle sur la durée de la phrase. */
function tambours(debut: number, fin: number, beat: number, H: Humeur, volume: number) {
  const R = H === "fete" ? RYTHMES.fete : H === "jour" ? RYTHMES.jour : H === "soir" ? RYTHMES.soir : RYTHMES.solennel;
  let motif = choisir(R.motifs);
  let x = debut;
  let cycle = 0;
  while (x < fin - 0.01) {
    if (cycle > 0 && Math.random() < 0.25) motif = choisir(R.motifs);
    for (const [pos, type, vel] of motif) {
      const t = x + pos * beat + hasard(-0.006, 0.006);
      if (t >= fin) continue;
      const v = vel * volume * hasard(0.88, 1.06);
      if (type === "crot") crotale(t, v);
      else tympanum(t, type, v);
    }
    x += R.cycle * beat;
    cycle++;
  }
}

/** Le chef : compose une phrase (ou un silence), la programme, et dit quand revenir. */
function chef(t: number): number {
  if (!couches) return t + 1;
  const H = humeurActuelle();
  const K = CARACTERES[H];
  if (H !== musique.humeur) {
    musique.humeur = H;
    musique.motif = null;
    if (H === "solennel") musique.tonique = 62;
    else if (Math.random() < 0.5) musique.tonique = choisir(TONIQUES);
    musique.changement = t;
  } else if (t - musique.changement > 200 && H !== "solennel") {
    musique.tonique = choisir(TONIQUES.filter((x) => x !== musique.tonique));
    musique.changement = t;
    musique.motif = null;
  }
  musique.mode = K.mode;
  const fete = intensiteFete();
  const richesse = H === "solennel" || H === "fete" ? 1 : 0.35 + 0.65 * niv.pop;
  const beat = K.temps * hasard(0.97, 1.03);
  viser(lyreEcho.gain, H === "nuit" ? 0.38 : H === "solennel" ? 0.22 : 0.1, 2);

  if (Math.random() < K.silence) {
    if (K.nappe > 0 && Math.random() < 0.5 * K.nappe) orgue(t, [noteDuDegre(-7), noteDuDegre(-3)], hasard(5, 8), 0.035 * K.nappe * richesse);
    return t + hasard(4, 10) * (H === "nuit" ? 1.6 : 1);
  }

  const nb = Math.floor(hasard(K.notes[0], K.notes[1] + 0.99) * (H === "nuit" ? 1 : 0.75 + 0.25 * richesse));
  const melodie = composer(K, Math.max(1, nb));
  const panLyre = hasard(-0.38, -0.18);
  let x = t;

  // L'accompagnement : une basse au début, un accord gratté, l'orgue en fond
  if (H !== "nuit" || Math.random() < 0.4) lyre(t, noteDuDegre(choisir([-7, -7, -3])), 0.55, panLyre - 0.1);
  if (H === "fete" || (H === "jour" && Math.random() < 0.3 * richesse) || H === "solennel") {
    gratter(t, [noteDuDegre(-7), noteDuDegre(-3), noteDuDegre(0), noteDuDegre(4)], H === "fete" ? 0.6 : 0.42, panLyre);
  }
  const dureeMelodie = melodie.reduce((s, n) => s + n.dur, 0) * beat;
  if (K.nappe * richesse > 0.12 && Math.random() < 0.6) {
    orgue(t, [noteDuDegre(-7), noteDuDegre(-3), noteDuDegre(0)], dureeMelodie, 0.04 * K.nappe * richesse);
  }

  // Sous la mélodie, la lyre marque doucement les basses tous les deux temps
  if (H !== "nuit" && H !== "solennel") {
    for (let b = t + 2 * beat; b < t + dureeMelodie - beat; b += 2 * beat) {
      if (Math.random() < 0.3 + 0.4 * richesse) lyre(b, noteDuDegre(choisir([-7, -3, -5])), 0.34, panLyre - 0.12);
    }
  }

  // La mélodie à la lyre
  for (let i = 0; i < melodie.length; i++) {
    const n = melodie[i]!;
    const vel = i === 0 ? 0.88 : i === melodie.length - 1 ? 0.72 : hasard(0.48, 0.8);
    lyre(x + hasard(0, 0.012), noteDuDegre(n.deg), vel, panLyre);
    if (n.dur >= 2 && Math.random() < 0.5) lyre(x + 0.025, noteDuDegre(n.deg - 4), vel * 0.55, panLyre - 0.05);
    x += n.dur * beat;
  }
  let fin = x;

  // L'aulos répond, si la cité a grandi (ou pendant la fête)
  const aulosPossible = etat.palier >= 1 || H === "fete";
  if (aulosPossible && Math.random() < K.aulos * (0.5 + 0.5 * richesse)) {
    const debut = fin + beat * hasard(0.25, 0.75);
    const reponse = composer(K, Math.max(3, Math.floor(hasard(K.notes[0], K.notes[1] + 0.99))));
    let y = debut;
    const notes: NoteAulos[] = reponse.map((n) => {
      const note = { midi: noteDuDegre(n.deg), t: y, d: n.dur * beat };
      y += n.dur * beat;
      return note;
    });
    const finAulos = phraseAulos(couches.aulos, notes, noteDuDegre(0) - 12, H === "fete" ? 0.13 : 0.09, H === "fete" || H === "jour");
    for (let b = debut; b < finAulos - beat; b += 2 * beat) {
      if (Math.random() < 0.6) lyre(b, noteDuDegre(choisir([-7, -3])), 0.38, panLyre - 0.1);
    }
    fin = finAulos;
  }

  // Le tambour
  const avecTambour =
    H === "fete" ||
    H === "solennel" ||
    ((H === "jour" || H === "soir") && etat.palier >= 2 && Math.random() < K.tambour) ||
    (H === "jour" && etat.palier === 1 && Math.random() < K.tambour * 0.3);
  if (avecTambour) tambours(t, fin, beat, H, H === "fete" ? 0.9 * Math.max(0.5, fete) : H === "solennel" ? 0.6 : 0.5 * richesse);

  return fin + beat * hasard(K.respiration[0], K.respiration[1]);
}

// ---------------------------------------------------------------------------------------------
// Les pistes : chacune programme ses événements un peu en avance sur l'horloge audio
// ---------------------------------------------------------------------------------------------

interface Piste {
  prochain: number;
  jouer: (t: number) => number;
}
const pistes: Piste[] = [];
let minuterie: ReturnType<typeof setInterval> | null = null;

function ajouterPiste(jouer: (t: number) => number, premier: number) {
  pistes.push({ prochain: (ctx?.currentTime ?? 0) + premier, jouer });
}

function boucle() {
  const c = ctx;
  if (!c || c.state !== "running") return;
  const maintenant = c.currentTime;
  const horizon = maintenant + AVANCE;
  for (const p of pistes) {
    // Après un long sommeil de l'onglet, on ne rattrape pas le retard : on repart de maintenant
    if (p.prochain < maintenant - 0.3) p.prochain = maintenant + Math.random() * 0.3;
    let garde = 0;
    while (p.prochain < horizon && garde++ < 40) {
      let suivant: number;
      try {
        suivant = p.jouer(Math.max(p.prochain, maintenant + 0.02));
      } catch {
        suivant = p.prochain + 1;
      }
      if (!(suivant > p.prochain)) suivant = p.prochain + 0.1;
      p.prochain = suivant;
    }
  }
}

function lancerPistes() {
  const C = couches!;
  const B = C.bus;

  // La mer
  ajouterPiste((t) => {
    if (niv.vagues < 0.02) return t + 1;
    vague(t, hasard(0.5, 1) * (0.75 + 0.45 * etat.orage), hasard(-0.75, 0.75), B.vagues);
    return t + hasard(2.2, 6.5) * (1.1 - 0.35 * etat.orage);
  }, 0.1);

  // Les rafales de vent
  ajouterPiste((t) => {
    const r = hasard(0.55, 1.35) + etat.orage * hasard(0, 0.6);
    C.rafale.gain.setTargetAtTime(r, t, hasard(0.6, 1.8));
    C.ventFiltres.forEach((f, i) => f.frequency.setTargetAtTime((i ? 700 : 360) * (0.8 + 0.5 * r), t, 1.5));
    return t + hasard(1.5, 5);
  }, 0.5);

  // Les cigales, chacune son chant
  for (const cig of C.cigales) {
    let muette = true;
    ajouterPiste((t) => {
      const L = niv.cigales;
      if (L < 0.02) {
        if (!muette) cig.env.gain.setTargetAtTime(0, t, 0.6);
        muette = true;
        return t + 2;
      }
      muette = false;
      const duree = hasard(3, 12);
      const crete = hasard(0.5, 1) * cig.poids;
      cig.env.gain.setTargetAtTime(crete, t, hasard(0.4, 1.2));
      cig.env.gain.setTargetAtTime(crete * hasard(0.6, 0.95), t + duree * 0.5, 0.8);
      cig.env.gain.setTargetAtTime(0, t + duree, hasard(0.4, 1.4));
      return t + duree + hasard(0.5, 6) / (0.4 + L);
    }, hasard(0, 3));
  }

  // Les grillons
  for (let i = 0; i < 3; i++) ajouterPiste(creerGrillon(B.grillons), hasard(0, 1));

  // Le petit-duc : une série de « tiou », puis un long silence
  {
    let restants = 0;
    let f = 1250;
    let pan = 0;
    ajouterPiste((t) => {
      if (niv.hibou < 0.05) {
        restants = 0;
        return t + 3;
      }
      if (restants <= 0) {
        if (Math.random() < 0.5) {
          restants = entier(5, 14);
          f = hasard(1150, 1350);
          pan = hasard(-0.7, 0.7);
        }
        return t + hasard(8, 35);
      }
      restants--;
      tiou(t, f, pan, B.hibou);
      return t + hasard(2.5, 2.9);
    }, 2);
  }

  // Les oiseaux, les martinets et les mouettes
  ajouterPiste((t) => {
    if (niv.oiseaux < 0.02) return t + 2;
    chantOiseau(t, B.oiseaux);
    return t + attente(0.25 + 1.8 * niv.oiseaux, 0.3);
  }, 1);
  ajouterPiste((t) => {
    if (niv.martinets < 0.03) return t + 3;
    martinets(t, B.martinets);
    return t + attente(0.08 + 0.4 * niv.martinets, 1.2);
  }, 3);
  ajouterPiste((t) => {
    if (niv.mouettes < 0.03) return t + 3;
    mouette(t, B.mouettes);
    return t + attente(0.05 + 0.3 * niv.mouettes, 1.5);
  }, 2);

  // La ville : la foule qui bavarde, les crieurs, les ânes, les clochettes des portes
  ajouterPiste((t) => (niv.foule < 0.01 ? t + 0.5 : animerFoule(t)), 0.2);
  ajouterPiste((t) => {
    if (niv.rue < 0.03) return t + 2;
    if (Math.random() < 0.65) crieur(t, B.rue);
    else sabots(t, B.rue);
    return t + attente(0.04 + 0.16 * niv.rue, 1.5);
  }, 4);
  ajouterPiste((t) => {
    if (niv.carillons < 0.03) return t + 3;
    const out = sortieSon(hasard(-0.8, 0.8), B.carillons, 0.4);
    const base = hasard(1900, 2600);
    let x = t;
    for (let i = entier(2, 6); i > 0; i--) {
      clochette(x, base * choisir([1, 1.12, 1.25, 1.5]), hasard(0.05, 0.12), out);
      x += hasard(0.08, 0.5);
    }
    return t + attente(0.03 + 0.15 * niv.carillons, 2);
  }, 5);

  // Les ateliers, le port, les chèvres
  ajouterPiste((t) => {
    if (niv.ateliers < 0.03) return t + 2;
    atelier(t, B.ateliers);
    return t + attente(0.06 + 0.22 * niv.ateliers, 2);
  }, 2);
  ajouterPiste((t) => {
    if (niv.port < 0.03) return t + 2;
    bruitDePort(t, B.port);
    return t + attente(0.1 + 0.5 * niv.port, 0.6);
  }, 1.5);
  ajouterPiste((t) => {
    if (niv.chevres < 0.03) return t + 3;
    chevres(t, B.chevres);
    return t + attente(0.04 + 0.14 * niv.chevres, 3);
  }, 6);

  // Le tonnerre qui gronde au loin pendant l'orage
  ajouterPiste((t) => {
    if (niv.orage < 0.05) return t + 3;
    tonnerre(t, hasard(0.25, 0.55), hasard(-0.9, 0.9), false, B.orage);
    return t + attente(0.02 + 0.06 * niv.orage, 6);
  }, 8);

  // La fête : des acclamations de temps en temps
  ajouterPiste((t) => {
    const f = intensiteFete();
    if (f < 0.3 || etat.titre) return t + 2;
    if (Math.random() < 0.5) acclamation(t, hasard(1.5, 3), 0.05 * f, B.foule);
    return t + hasard(8, 20);
  }, 3);

  // La musique
  ajouterPiste(chef, 0.4);
}

// ---------------------------------------------------------------------------------------------
// Les réglages
// ---------------------------------------------------------------------------------------------

/** Les cibles déjà demandées : on ne relance une transition que si la cible change vraiment. */
const cibles = new Map<AudioParam, number>();

function viser(p: AudioParam, v: number, temps: number) {
  if (!ctx || !Number.isFinite(v)) return;
  const ancienne = cibles.get(p);
  if (ancienne !== undefined && Math.abs(ancienne - v) <= 0.004 * Math.max(0.05, Math.abs(v)) + 1e-5) return;
  cibles.set(p, v);
  p.setTargetAtTime(v, ctx.currentTime, Math.max(0.005, temps));
}

function calculerNiveaux() {
  const e = etat;
  const h = e.heure;
  const J = jour(h);
  const Nt = 1 - J;
  const A = aube(h);
  const CH = chaleur(h);
  const CR = crepuscule(h);
  const proche = 1 - e.zoom;
  const sec = 1 - e.pluie;
  const calme = 1 - e.orage;
  const fete = intensiteFete();
  const pop = borne(Math.log10(1 + e.population) / Math.log10(3000), 0, 1);
  niv.pop = pop;
  niv.vagues = borne(e.mer * (0.25 + 0.75 * proche) * (1 + 0.4 * e.orage), 0, 1.3);
  niv.merFond = borne((0.08 + 0.92 * e.mer) * (0.35 + 0.65 * e.zoom) + 0.3 * e.orage, 0, 1.2);
  niv.vent = borne(0.12 + 0.4 * e.vent + 0.25 * e.zoom + 0.6 * e.orage, 0, 1.4);
  niv.sifflement = borne(e.orage * 0.85 + e.vent * e.zoom * 0.3, 0, 1);
  niv.cigales = CH * sec * calme * (0.2 + 0.8 * e.nature) * (0.45 + 0.55 * proche) * (1 - 0.5 * e.ville * proche);
  niv.grillons = Nt * (1 - 0.8 * e.pluie) * calme * (0.25 + 0.75 * e.nature) * (0.5 + 0.5 * proche);
  niv.hibou = lisse(0.6, 0.95, Nt) * sec * calme * (0.3 + 0.7 * e.nature);
  niv.oiseaux = (A + 0.15 * J) * (1 - 0.85 * e.pluie) * calme * (0.3 + 0.7 * e.nature) * (0.5 + 0.5 * proche);
  niv.martinets = (CR + 0.15 * J) * e.ville * sec * (0.4 + 0.6 * proche);
  niv.mouettes = J * sec * borne(e.port + e.mer * 0.45, 0, 1) * (0.5 + 0.5 * proche);
  niv.foule = borne(e.ville * (0.12 + 0.88 * J) * (0.2 + 0.8 * pop) * (0.25 + 0.75 * proche) * (1 - 0.6 * e.pluie) + 0.5 * fete * e.ville, 0, 1.2);
  niv.rue = borne(e.ville * J * (0.3 + 0.7 * pop) * proche * sec + 0.3 * fete * e.ville, 0, 1);
  niv.ateliers = e.ateliers * J * (1 - 0.5 * e.pluie) * (0.3 + 0.7 * proche);
  niv.port = e.port * (0.3 + 0.7 * proche) * (0.4 + 0.6 * J);
  niv.chevres = e.nature * (1 - e.ville) * J * sec * (0.3 + 0.7 * proche);
  niv.pluie = e.pluie;
  niv.orage = e.orage;
  niv.carillons = e.ville * borne(e.vent + e.orage, 0, 1) * proche;
}

function appliquer(immediat: boolean) {
  if (!ctx) return;
  const T = immediat ? 0.02 : 1.2;
  viser(filtrePause.frequency, etat.pause ? 650 : 20000, immediat ? 0.02 : 0.25);
  viser(pauseGain.gain, etat.pause ? 0.7 : 1, immediat ? 0.02 : 0.25);
  const Nt = 1 - jour(etat.heure);
  viser(envoiJour.gain, 0.3 + 0.7 * (1 - Nt), immediat ? 0.02 : 3);
  viser(envoiNuit.gain, 0.12 + 0.88 * Nt, immediat ? 0.02 : 3);
  viser(envoiMusique.gain, 0.45 + 0.45 * Nt, immediat ? 0.02 : 3);
  viser(musiqueNiveau.gain, etat.titre ? 1.2 : 1.05 + 0.1 * intensiteFete() - 0.15 * etat.pluie, immediat ? 0.02 : 2);
  if (!couches) return;
  calculerNiveaux();
  for (const f of Object.keys(BASE) as Famille[]) viser(couches.bus[f].gain, BASE[f] * niv[f], T);
}

function nettoyer(a: Partial<EcouteAmbiance> | null | undefined): EcouteAmbiance {
  const x = a ?? {};
  const nombre = (v: unknown, defaut: number, min = 0, max = 1) => (typeof v === "number" && Number.isFinite(v) ? borne(v, min, max) : defaut);
  const heure = typeof x.heure === "number" && Number.isFinite(x.heure) ? ((x.heure % 24) + 24) % 24 : ETAT_INITIAL.heure;
  const palier = x.palier === 1 || x.palier === 2 ? x.palier : 0;
  return {
    heure,
    pluie: nombre(x.pluie, 0),
    orage: nombre(x.orage, 0),
    vent: nombre(x.vent, 0.3),
    zoom: nombre(x.zoom, 0.5),
    mer: nombre(x.mer, 0),
    nature: nombre(x.nature, 0),
    ville: nombre(x.ville, 0),
    ateliers: nombre(x.ateliers, 0),
    port: nombre(x.port, 0),
    population: nombre(x.population, 0, 0, 1e7),
    palier,
    fete: x.fete === true,
    titre: x.titre === true,
    pause: x.pause === true,
  };
}

// ---------------------------------------------------------------------------------------------
// L'interface publique
// ---------------------------------------------------------------------------------------------

/** À appeler au premier geste de l'utilisateur : crée (ou réveille) le contexte audio. */
export function reveillerAudio(): void {
  try {
    const c = audio();
    if (c && c.state === "suspended") void c.resume().catch(() => undefined);
  } catch {
    // Pas de son, tant pis
  }
}

/** Lance le paysage sonore et la musique (une seule fois). */
export function demarrerAmbiance(): void {
  try {
    const c = audio();
    if (!c || couches) return;
    couches = creerCouches(c);
    const sonde = (globalThis as unknown as { __aureaSons?: Record<string, unknown> }).__aureaSons;
    if (sonde) sonde.familles = couches.bus;
    appliquer(true);
    lancerPistes();
    minuterie = setInterval(boucle, 90);
    boucle();
  } catch {
    // Pas de son, tant pis
  }
}

/** Règle l'ambiance selon ce que voit la caméra ; les transitions sont lissées. */
export function reglerAmbiance(a: EcouteAmbiance): void {
  try {
    etat = nettoyer(a);
    if (ctx) {
      if (etat.fete && !feteAvant && ctx.currentTime - feteDebut > FETE_PLEINE) feteDebut = ctx.currentTime;
    }
    feteAvant = etat.fete;
    appliquer(false);
  } catch {
    // Pas de son, tant pis
  }
}

let dernierSurvol = 0;

/** Un son ponctuel. `pan` de -1 (gauche) à 1 (droite), `volume` autour de 1. */
export function son(nom: Son, pan = 0, volume = 1): void {
  try {
    const c = ctx;
    if (!c) return;
    jouerSon(c, nom, borne(pan), borne(volume, 0, 2));
  } catch {
    // Pas de son, tant pis
  }
}

/** Coupe ou rétablit le son ; renvoie true si muet. */
export function basculerMuet(): boolean {
  muet = !muet;
  try {
    if (ctx) {
      sortie.gain.cancelScheduledValues(ctx.currentTime);
      sortie.gain.setTargetAtTime(muet ? 0 : VOLUME, ctx.currentTime, 0.05);
    }
  } catch {
    // Pas de son, tant pis
  }
  return muet;
}

// ---------------------------------------------------------------------------------------------
// Les sons d'interface
// ---------------------------------------------------------------------------------------------

/** Un coup de bois : maillet, cheville, planche. */
function coupBois(t: number, f: number, vol: number, out: AudioNode) {
  partiels(t, f, BOIS, vol, out);
  souffle(t, blanc, 0.05, vol * 0.8, "bandpass", f * 1.8, f * 1.2, 2.5, out, 0.001);
}

/** Une pierre posée sur une autre. */
function pierre(t: number, vol: number, out: AudioNode) {
  souffle(t, blanc, 0.045, vol, "bandpass", hasard(1900, 2600), 1500, 5, out, 0.001);
  ton(t, hasard(700, 900), 500, 0.04, "sine", vol * 0.3, out, 0.001);
}

function jouerSon(c: AudioContext, nom: Son, pan: number, v: number) {
  const t = c.currentTime + 0.015;
  switch (nom) {
    case "clic": {
      const out = sortieSon(pan, busSfx, 0.1);
      souffle(t, blanc, 0.02, 0.09 * v, "bandpass", 2800, 2400, 3, out, 0.001);
      ton(t, 1500, 1150, 0.035, "sine", 0.03 * v, out, 0.001);
      break;
    }
    case "survol": {
      if (c.currentTime - dernierSurvol < 0.05) return;
      dernierSurvol = c.currentTime;
      const out = sortieSon(pan, busSfx, 0.1);
      ton(t, 2600, 2500, 0.03, "sine", 0.01 * v, out, 0.002);
      souffle(t, blanc, 0.012, 0.015 * v, "highpass", 5000, 5000, 0.7, out, 0.001);
      break;
    }
    case "ouvrir": {
      const out = sortieSon(pan, busSfx, 0.2);
      souffle(t, rose, 0.2, 0.06 * v, "bandpass", 700, 2400, 1.2, out, 0.06);
      lyre(t + 0.04, noteDuDegre(7), 0.4 * v, pan);
      lyre(t + 0.1, noteDuDegre(11), 0.32 * v, pan + 0.1);
      break;
    }
    case "fermer": {
      const out = sortieSon(pan, busSfx, 0.2);
      souffle(t, rose, 0.18, 0.05 * v, "bandpass", 2200, 700, 1.2, out, 0.03);
      lyre(t + 0.03, noteDuDegre(4), 0.35 * v, pan);
      break;
    }
    case "poser": {
      // Une poutre posée sur la terre : un choc mat, la terre qui tasse, le bois qui sonne
      const out = sortieSon(pan, busSfx, 0.15);
      ton(t, 140, 62, 0.2, "sine", 0.3 * v, out, 0.003);
      souffle(t, brun, 0.22, 0.25 * v, "lowpass", 900, 180, 0.7, out, 0.003);
      coupBois(t + 0.012, hasard(380, 440), 0.12 * v, out);
      for (let i = 0; i < 4; i++) pierre(t + 0.06 + i * hasard(0.03, 0.07), 0.03 * v, out);
      break;
    }
    case "route": {
      const out = sortieSon(pan, busSfx, 0.12);
      pierre(t, 0.12 * v, out);
      pierre(t + hasard(0.07, 0.1), 0.09 * v, out);
      souffle(t, brun, 0.12, 0.08 * v, "lowpass", 500, 200, 0.7, out, 0.003);
      break;
    }
    case "demolir": {
      const out = sortieSon(pan, busSfx, 0.3);
      souffle(t, brun, 0.9, 0.35 * v, "lowpass", 2000, 220, 0.7, out, 0.01);
      souffle(t + 0.05, blanc, 0.7, 0.06 * v, "bandpass", 3000, 900, 1, out, 0.02);
      ton(t, 90, 40, 0.5, "sine", 0.3 * v, out, 0.005);
      for (let i = 0; i < 10; i++) pierre(t + hasard(0.02, 0.8), hasard(0.03, 0.09) * v, out);
      break;
    }
    case "refus": {
      // De la terre cuite, sourde, deux fois en descendant
      const out = sortieSon(pan, busSfx, 0.1, 1800);
      partiels(t, 262, TERRE_CUITE, 0.14 * v, out);
      partiels(t + 0.11, 247, TERRE_CUITE, 0.11 * v, out);
      break;
    }
    case "construit": {
      const out = sortieSon(pan, busSfx, 0.25);
      for (let i = 0; i < 3; i++) coupBois(t + i * 0.17, 330 * hasard(0.97, 1.03), (0.16 - i * 0.02) * v, out);
      souffle(t + 0.4, blanc, 0.7, 0.035 * v, "highpass", 1800, 3500, 0.6, out, 0.15);
      lyre(t + 0.55, noteDuDegre(4), 0.42 * v, pan);
      lyre(t + 0.66, noteDuDegre(7), 0.5 * v, pan);
      break;
    }
    case "evolution": {
      // Un petit arpège de lyre qui monte dans le mode du moment
      [0, 2, 4, 7].forEach((d, i) => lyre(t + i * 0.085, noteDuDegre(d), (0.42 + i * 0.06) * v, pan + i * 0.05));
      crotale(t + 0.34, 0.5 * v, pan, busSfx);
      break;
    }
    case "palier": {
      // Fanfare de cornua sur les harmoniques naturelles de ré, roulement de tambour, lyre qui ruisselle
      for (let i = 0; i < 10; i++) tympanum(t + i * 0.06, "tek", (0.2 + i * 0.06) * v);
      tympanum(t + 0.6, "dum", 0.9 * v);
      const A: readonly (readonly [number, number, number])[] = [[62, 0.6, 0.26], [69, 0.9, 0.26], [74, 1.2, 0.5], [69, 1.75, 0.2], [74, 2.0, 1.4]];
      const B: readonly (readonly [number, number, number])[] = [[57, 1.2, 0.5], [62, 1.75, 0.2], [66, 2.0, 1.4]];
      for (const [m, x, d] of A) cornu(t + x, m, d, 0.11 * v, -0.2);
      for (const [m, x, d] of B) cornu(t + x, m, d, 0.08 * v, 0.25);
      tympanum(t + 2.0, "dum", v);
      crotale(t + 2.0, 0.8 * v, 0.1, busSfx);
      const gamme = [62, 64, 66, 67, 69, 71, 72, 74, 76, 78];
      gamme.forEach((m, i) => lyre(t + 2.05 + i * 0.045, m, 0.4 + i * 0.03, -0.3 + i * 0.06));
      break;
    }
    case "temple": {
      // La consécration : roulement, cuivres, chœur, orgue, crotales, et la foule qui acclame
      for (let i = 0; i < 28; i++) tympanum(t + i * 0.07, i % 4 === 0 ? "pa" : "tek", (0.15 + i * 0.03) * v);
      const T0 = t + 2;
      tympanum(T0, "dum", v);
      tympanum(T0 + 0.4, "dum", 0.7 * v);
      const fanfare: readonly (readonly [number, number, number, number])[] = [
        [62, 0, 0.3, -0.25], [69, 0.32, 0.3, -0.25], [74, 0.64, 0.9, -0.25], [74, 1.6, 0.25, -0.25], [78, 1.9, 0.25, -0.25], [81, 2.2, 2.4, -0.25],
        [57, 0.64, 0.9, 0.25], [62, 1.6, 0.25, 0.25], [66, 1.9, 0.25, 0.25], [69, 2.2, 2.4, 0.25],
        [50, 0.64, 0.9, 0], [50, 2.2, 2.4, 0],
      ];
      for (const [m, x, d, p] of fanfare) cornu(T0 + x, m, d, 0.1 * v, p);
      choeur(T0 + 0.6, [50, 57, 62, 66, 69], 6, 0.045 * v);
      orgue(T0, [38, 45, 50, 57], 7, 0.06 * v, busSfx);
      crotale(T0 + 2.2, v, -0.3, busSfx);
      crotale(T0 + 2.25, 0.8 * v, 0.3, busSfx);
      [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86].forEach((m, i) => lyre(T0 + 2.2 + i * 0.05, m, 0.45 + i * 0.03, -0.4 + i * 0.07));
      if (couches) acclamation(T0 + 2.6, 3.5, 0.06 * v, busSfx);
      feteDebut = c.currentTime + 7;
      break;
    }
    case "tonnerre":
      tonnerre(t, 0.8 * v, pan, v > 0.55, busSfx);
      break;
    case "vague":
      vague(t, Math.min(1.3, v), pan, busSfx);
      break;
    case "navire": {
      // Une corne grave, deux fois, très loin sur l'eau
      const out = sortieSon(pan, busSfx, 0.8, 500);
      for (const [x, f, d] of [[0, 98, 1.6], [2.2, 92.5, 2.2]] as const) {
        const g = gain(c, 0);
        g.gain.setValueAtTime(0, t + x);
        g.gain.linearRampToValueAtTime(0.28 * v, t + x + 0.4);
        g.gain.setValueAtTime(0.28 * v, t + x + d);
        g.gain.linearRampToValueAtTime(0, t + x + d + 0.7);
        const lp = filtre(c, "lowpass", 650, 1.5);
        g.connect(out);
        lp.connect(g);
        for (const [type, r, niveau] of [["sawtooth", 1, 0.5], ["sine", 0.5, 0.6]] as const) {
          const o = oscillateur(c, type, f * r);
          lfo(c, 0.8, 4, o.detune).stop(t + x + d + 1);
          o.connect(gain(c, niveau)).connect(lp);
          o.start(t + x);
          o.stop(t + x + d + 1);
        }
      }
      break;
    }
    case "cloche": {
      const out = sortieSon(pan, busSfx, 0.35);
      clochette(t, hasard(1500, 1800), 0.12 * v, out);
      break;
    }
  }
}
