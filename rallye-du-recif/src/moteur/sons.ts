// Les sons et la musique, synthétisés : aucun fichier audio.
let ctx: AudioContext | null = null;
let sortie: GainNode;
let bus: GainNode;
let musique: GainNode;
let muet = false;
let bruit: AudioBuffer | null = null;

function audio() {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  sortie = ctx.createGain();
  sortie.gain.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  sortie.connect(comp).connect(ctx.destination);
  bus = ctx.createGain();
  bus.connect(sortie);
  musique = ctx.createGain();
  musique.gain.value = 0.2;
  musique.connect(sortie);
  bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function reveillerAudio() {
  const a = audio();
  if (a?.state === "suspended") void a.resume();
}

export function basculerMuet() {
  muet = !muet;
  if (ctx) sortie.gain.value = muet ? 0 : 0.5;
  return muet;
}

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

function ton(de: number, a: number, duree: number, onde: OscillatorType, volume: number, delai = 0, vers?: AudioNode) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delai;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = onde;
  o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(a, 1), t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(vers ?? bus);
  o.start(t);
  o.stop(t + duree + 0.02);
}

function souffle(duree: number, volume: number, type: BiquadFilterType, de: number, a: number, delai = 0, q = 1, vers?: AudioNode) {
  const c = audio();
  if (!c || !bruit) return;
  const t = c.currentTime + delai;
  const s = c.createBufferSource();
  s.buffer = bruit;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(a, t + duree);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(vers ?? bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + duree + 0.05);
}

export const SONS: Record<string, (v: number) => void> = {
  decompte: () => ton(hz(69), hz(69), 0.25, "square", 0.16),
  partez: () => {
    [81, 85, 88, 93].forEach((n) => ton(hz(n), hz(n), 0.6, "square", 0.08));
    souffle(0.5, 0.3, "highpass", 2000, 6000);
  },
  saut: (v) => ton(300, 520, 0.08, "triangle", 0.12 * v),
  atterrit: (v) => {
    souffle(0.15, 0.35 * v, "lowpass", 1200, 200);
    ton(110, 50, 0.15, "sine", 0.4 * v);
  },
  derive: (v) => souffle(0.2, 0.25 * v, "bandpass", 2500, 1800, 0, 4),
  palier1: (v) => [88, 93].forEach((n, i) => ton(hz(n), hz(n), 0.08, "square", 0.08 * v, i * 0.05)),
  palier2: (v) => [91, 96, 100].forEach((n, i) => ton(hz(n), hz(n), 0.08, "square", 0.08 * v, i * 0.05)),
  turbo: (v) => {
    souffle(0.6, 0.45 * v, "bandpass", 400, 2400, 0, 1.5);
    ton(120, 320, 0.5, "sawtooth", 0.12 * v);
  },
  perle: (v) => [84, 88, 91, 96].forEach((n, i) => ton(hz(n), hz(n), 0.12, "triangle", 0.12 * v, i * 0.04)),
  objet: () => [79, 83, 86].forEach((n, i) => ton(hz(n), hz(n), 0.1, "square", 0.07, i * 0.06)),
  roulette: () => ton(hz(96), hz(96), 0.03, "square", 0.04),
  lance: (v) => {
    souffle(0.2, 0.3 * v, "bandpass", 900, 3000, 0, 2);
    ton(500, 200, 0.15, "triangle", 0.12 * v);
  },
  bulle: (v) => {
    ton(300, 900, 0.3, "sine", 0.25 * v);
    ton(600, 1400, 0.25, "sine", 0.12 * v, 0.05);
  },
  bulleEclate: (v) => {
    souffle(0.25, 0.5 * v, "highpass", 3000, 8000, 0, 2);
    ton(1400, 300, 0.2, "sine", 0.25 * v);
  },
  touche: (v) => {
    souffle(0.35, 0.7 * v, "lowpass", 4000, 300);
    ton(220, 60, 0.4, "square", 0.25 * v);
    [76, 72, 69, 64].forEach((n, i) => ton(hz(n), hz(n), 0.1, "square", 0.06 * v, 0.1 + i * 0.08));
  },
  choc: (v) => {
    souffle(0.1, 0.4 * v, "bandpass", 1800, 700, 0, 1.5);
    ton(180, 80, 0.12, "square", 0.2 * v);
  },
  mur: (v) => {
    souffle(0.18, 0.5 * v, "bandpass", 2400, 900, 0, 2);
    ton(140, 60, 0.15, "square", 0.2 * v);
  },
  plouf: (v) => {
    souffle(0.7, 0.8 * v, "lowpass", 3500, 250);
    ton(400, 90, 0.35, "sine", 0.4 * v);
    for (let i = 0; i < 5; i++) ton(800 + Math.random() * 900, 1600, 0.06, "sine", 0.06 * v, 0.2 + i * 0.07);
  },
  retour: (v) => [76, 79, 84, 88].forEach((n, i) => ton(hz(n), hz(n), 0.2, "triangle", 0.1 * v, i * 0.05)),
  tour: () => [84, 88].forEach((n, i) => ton(hz(n), hz(n), 0.2, "square", 0.08, i * 0.1)),
  dernierTour: () => [72, 76, 79, 84, 79, 84].forEach((n, i) => ton(hz(n), hz(n), 0.18, "square", 0.09, i * 0.1)),
  arrivee: () => [72, 76, 79, 84].forEach((n, i) => ton(hz(n), hz(n), 0.4, "square", 0.1, i * 0.12)),
  victoire: () => [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => ton(hz(n), hz(n), 0.45, "square", 0.1, i * 0.09)),
  menu: () => ton(hz(84), hz(84), 0.05, "square", 0.08),
  valider: () => {
    ton(hz(79), hz(79), 0.08, "square", 0.1);
    ton(hz(86), hz(86), 0.12, "square", 0.1, 0.07);
  },
  retourMenu: () => ton(hz(72), hz(67), 0.1, "square", 0.08),
};

export function jouer(nom: string, volume = 1) {
  if (muet || volume <= 0.01) return;
  SONS[nom]?.(volume);
}

// ——— Le moteur du joueur : un ronronnement qui monte avec la vitesse. ———
let moteur: { o1: OscillatorNode; o2: OscillatorNode; filtre: BiquadFilterNode; gain: GainNode; crisse: GainNode; filtreCrisse: BiquadFilterNode } | null = null;

export function demarrerMoteur() {
  const c = audio();
  if (!c || !bruit || moteur) return;
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = "sawtooth";
  o2.type = "square";
  const filtre = c.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 500;
  filtre.Q.value = 3;
  const gain = c.createGain();
  gain.gain.value = 0;
  o1.connect(filtre);
  o2.connect(filtre);
  filtre.connect(gain).connect(bus);
  o1.start();
  o2.start();
  // Le crissement des pneus en dérapage
  const s = c.createBufferSource();
  s.buffer = bruit;
  s.loop = true;
  const filtreCrisse = c.createBiquadFilter();
  filtreCrisse.type = "bandpass";
  filtreCrisse.frequency.value = 2200;
  filtreCrisse.Q.value = 5;
  const crisse = c.createGain();
  crisse.gain.value = 0;
  s.connect(filtreCrisse).connect(crisse).connect(bus);
  s.start();
  moteur = { o1, o2, filtre, gain, crisse, filtreCrisse };
}

/** `vitesse` de 0 à 1 (et plus en turbo), `derive` : 0 sans dérapage, sinon le palier + 1. */
export function regimeMoteur(vitesse: number, turbo: boolean, derive: number, enMarche: boolean) {
  if (!moteur || !ctx) return;
  const t = ctx.currentTime;
  const v = Math.max(0, vitesse);
  const f = 48 + v * 95 + (turbo ? 25 : 0);
  moteur.o1.frequency.setTargetAtTime(f, t, 0.05);
  moteur.o2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.05);
  moteur.filtre.frequency.setTargetAtTime(350 + v * 900 + (turbo ? 600 : 0), t, 0.05);
  moteur.gain.gain.setTargetAtTime(muet || !enMarche ? 0 : 0.08 + v * 0.07, t, 0.08);
  moteur.crisse.gain.setTargetAtTime(muet || derive === 0 ? 0 : 0.05 + derive * 0.015, t, 0.05);
  moteur.filtreCrisse.frequency.setTargetAtTime(1800 + derive * 500, t, 0.05);
}

export function arreterMoteur() {
  if (!moteur || !ctx) return;
  const t = ctx.currentTime;
  moteur.gain.gain.setTargetAtTime(0, t, 0.1);
  moteur.crisse.gain.setTargetAtTime(0, t, 0.05);
}

// ——— La musique : une boucle de surf rock, basse qui galope, guitare en trémolo, batterie. ———
const BASSE = [45, 45, 57, 45, 52, 45, 57, 45, 50, 50, 62, 50, 52, 52, 64, 52];
const ACCORDS = [
  [69, 73, 76],
  [69, 73, 76],
  [74, 78, 81],
  [76, 80, 83],
];
const MELODIE = [
  81, 0, 81, 83, 85, 0, 83, 81, 78, 0, 76, 0, 78, 81, 0, 0, 81, 0, 81, 83, 85, 88, 85, 83, 86, 0, 85, 0, 83, 0, 0, 0,
];
let horloge: number | null = null;

function caisse(t: number) {
  souffle(0.12, 0.35, "bandpass", 1800, 900, t, 0.8, musique);
  ton(220, 160, 0.08, "triangle", 0.25, t, musique);
}
function grosse(t: number) {
  ton(110, 40, 0.18, "sine", 0.9, t, musique);
}
function charley(t: number) {
  souffle(0.03, 0.1, "highpass", 7000, 7000, t, 1, musique);
}

export function lancerMusique(calme = false) {
  const c = audio();
  if (!c) return;
  arreterMusique();
  let pas = 0;
  let prochain = c.currentTime + 0.1;
  const tempo = calme ? 0.19 : 0.125;
  horloge = window.setInterval(() => {
    while (prochain < c.currentTime + 0.25) {
      const d = prochain - c.currentTime;
      const i = pas % 16;
      const mesure = Math.floor(pas / 16) % 4;
      const b = BASSE[(mesure * 4 + Math.floor(i / 2) * 2) % 16];
      if (i % 2 === 0) ton(hz(b), hz(b), tempo * 1.5, "sawtooth", 0.16, d, musique);
      if (!calme) {
        if (i % 8 === 0 || i === 11) grosse(d);
        if (i % 8 === 4) caisse(d);
        charley(d);
        const n = MELODIE[pas % MELODIE.length];
        // La guitare en trémolo : la note répétée très vite.
        if (n && mesure >= 1) for (let k = 0; k < 3; k++) ton(hz(n), hz(n), tempo * 0.3, "square", 0.045, d + (k * tempo) / 3, musique);
      }
      if (i === 0) for (const n of ACCORDS[mesure]) ton(hz(n), hz(n), tempo * 14, "triangle", calme ? 0.05 : 0.03, d, musique);
      pas++;
      prochain += tempo;
    }
  }, 50);
}

export function arreterMusique() {
  if (horloge !== null) clearInterval(horloge);
  horloge = null;
}
