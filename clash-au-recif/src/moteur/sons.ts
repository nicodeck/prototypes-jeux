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
  musique.gain.value = 0.22;
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
  g.gain.exponentialRampToValueAtTime(volume, t + 0.005);
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
  g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(vers ?? bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + duree + 0.05);
}

export const SONS: Record<string, (force?: number) => void> = {
  coup: () => {
    souffle(0.09, 0.5, "bandpass", 2500, 900, 0, 1.2);
    ton(180, 60, 0.1, "sine", 0.6);
  },
  lourd: (f = 30) => {
    const k = Math.min(1, f / 50);
    souffle(0.25 + k * 0.2, 0.8, "lowpass", 3000, 200);
    ton(120, 35, 0.35 + k * 0.2, "sine", 0.9);
    ton(260, 60, 0.12, "square", 0.25);
  },
  tranche: () => {
    souffle(0.18, 0.5, "highpass", 3000, 8000, 0, 2);
    ton(1800, 900, 0.25, "triangle", 0.12);
    ton(160, 60, 0.1, "sine", 0.5);
  },
  garde: () => {
    ton(1400, 1300, 0.18, "triangle", 0.2);
    ton(2100, 2000, 0.12, "sine", 0.12);
    souffle(0.05, 0.25, "highpass", 4000, 4000);
  },
  armure: () => {
    ton(220, 110, 0.2, "square", 0.25);
    souffle(0.12, 0.4, "bandpass", 1200, 600, 0, 3);
  },
  whoosh: () => souffle(0.16, 0.22, "bandpass", 900, 3200, 0, 2),
  whooshLourd: () => souffle(0.3, 0.3, "bandpass", 300, 1400, 0, 2),
  saut: () => {
    souffle(0.1, 0.15, "bandpass", 600, 1800, 0, 1.5);
    ton(260, 420, 0.08, "triangle", 0.1);
  },
  doubleSaut: () => {
    souffle(0.18, 0.25, "bandpass", 1200, 4000, 0, 3);
    ton(500, 900, 0.12, "triangle", 0.1);
  },
  atterrit: () => souffle(0.07, 0.18, "lowpass", 900, 300),
  atterritFort: () => {
    souffle(0.2, 0.4, "lowpass", 1200, 150);
    ton(90, 40, 0.2, "sine", 0.5);
  },
  ko: () => {
    ton(90, 25, 1.2, "sine", 1);
    souffle(1.2, 0.9, "lowpass", 5000, 100);
    ton(400, 1600, 0.5, "sawtooth", 0.08, 0.05);
    souffle(0.6, 0.4, "bandpass", 3000, 800, 0.1, 4);
  },
  brise: () => {
    for (let i = 0; i < 6; i++) ton(2000 + Math.random() * 2000, 800, 0.3, "triangle", 0.1, i * 0.03);
    souffle(0.4, 0.4, "highpass", 2000, 6000);
  },
  reapparait: () => [76, 79, 84, 88].forEach((n, i) => ton(hz(n), hz(n), 0.25, "triangle", 0.12, i * 0.06)),
  decompte: () => ton(hz(72), hz(72), 0.18, "square", 0.15),
  partez: () => {
    [72, 76, 79, 84].forEach((n) => ton(hz(n), hz(n), 0.5, "square", 0.09));
    souffle(0.5, 0.3, "highpass", 2000, 6000);
  },
  fin: () => {
    ton(140, 40, 1.5, "sine", 1);
    souffle(1.5, 0.6, "lowpass", 4000, 100);
  },
  victoire: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => ton(hz(n), hz(n), 0.4, "square", 0.1, i * 0.09)),
  menu: () => ton(hz(84), hz(84), 0.05, "square", 0.08),
  valider: () => {
    ton(hz(79), hz(79), 0.08, "square", 0.1);
    ton(hz(86), hz(86), 0.12, "square", 0.1, 0.07);
  },
  retour: () => ton(hz(72), hz(67), 0.1, "square", 0.08),
};

export function jouer(nom: string, force?: number) {
  if (muet) return;
  SONS[nom]?.(force);
}

// ——— Une musique en boucle : basse, accords et batterie, un peu rock. ———
const BASSE = [40, 40, 52, 40, 43, 43, 55, 43, 45, 45, 57, 45, 43, 43, 47, 50];
const ACCORDS = [
  [64, 67, 71],
  [67, 71, 74],
  [69, 72, 76],
  [67, 71, 74],
];
const MELODIE = [
  76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 0, 79, 0, 0, 0, 76, 0, 79, 0, 83, 81, 79, 0, 81, 0, 79, 76, 74, 0, 0, 0,
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
  souffle(0.03, 0.12, "highpass", 7000, 7000, t, 1, musique);
}

export function lancerMusique(calme = false) {
  const c = audio();
  if (!c) return;
  arreterMusique();
  let pas = 0;
  let prochain = c.currentTime + 0.1;
  const tempo = calme ? 0.2 : 0.135;
  horloge = window.setInterval(() => {
    while (prochain < c.currentTime + 0.25) {
      const d = prochain - c.currentTime;
      const i = pas % 16;
      const mesure = Math.floor(pas / 16) % 4;
      if (i % 2 === 0) ton(hz(BASSE[(mesure * 4 + i / 2) % 16]), hz(BASSE[(mesure * 4 + i / 2) % 16]), tempo * 1.6, "sawtooth", 0.18, d, musique);
      if (!calme) {
        if (i % 8 === 0 || i === 10) grosse(d);
        if (i % 8 === 4) caisse(d);
        charley(d);
        const n = MELODIE[pas % MELODIE.length];
        if (n && mesure >= 2) ton(hz(n), hz(n), tempo * 1.4, "square", 0.07, d, musique);
      }
      if (i === 0) for (const n of ACCORDS[mesure]) ton(hz(n), hz(n), tempo * 14, "triangle", calme ? 0.06 : 0.04, d, musique);
      pas++;
      prochain += tempo;
    }
  }, 50);
}

export function arreterMusique() {
  if (horloge !== null) clearInterval(horloge);
  horloge = null;
}
