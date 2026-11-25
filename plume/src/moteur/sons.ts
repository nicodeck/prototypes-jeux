// Les sons et la musique, synthétisés : aucun fichier audio.
let ctx: AudioContext | null = null;
let sortie: GainNode;
let musique: GainNode;
let muet = false;

function audio() {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  sortie = ctx.createGain();
  sortie.gain.value = 0.45;
  sortie.connect(ctx.destination);
  musique = ctx.createGain();
  musique.gain.value = 0.3;
  musique.connect(sortie);
  return ctx;
}

export function reveillerAudio() {
  const a = audio();
  if (a?.state === "suspended") void a.resume();
}

export function basculerMuet() {
  muet = !muet;
  if (ctx) sortie.gain.value = muet ? 0 : 0.45;
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
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  o.connect(g).connect(vers ?? sortie);
  o.start(t);
  o.stop(t + duree + 0.02);
}

function souffle(duree: number, volume: number, filtre: number) {
  const c = audio();
  if (!c) return;
  const tampon = c.createBuffer(1, Math.ceil(c.sampleRate * duree), c.sampleRate);
  const donnees = tampon.getChannelData(0);
  for (let i = 0; i < donnees.length; i++) donnees[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = tampon;
  const f = c.createBiquadFilter();
  f.frequency.value = filtre;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duree);
  s.connect(f).connect(g).connect(sortie);
  s.start();
}

const arpege = (notes: number[], pas: number, onde: OscillatorType = "square", volume = 0.14) =>
  notes.forEach((n, i) => ton(hz(n), hz(n), pas * 1.5, onde, volume, i * pas));

export const SONS: Record<string, () => void> = {
  saut: () => ton(300, 680, 0.13, "square", 0.12),
  doubleSaut: () => ton(500, 1100, 0.15, "triangle", 0.25),
  atterrissage: () => souffle(0.05, 0.12, 700),
  graine: () => arpege([88, 95], 0.055),
  oeuf: () => arpege([79, 83, 86, 91, 95, 98], 0.06, "triangle", 0.28),
  plume: () => arpege([72, 76, 79, 84, 88], 0.05, "triangle", 0.25),
  ecrase: () => ton(420, 110, 0.12, "square", 0.18),
  ejecte: () => ton(700, 200, 0.2, "square", 0.15),
  brique: () => souffle(0.22, 0.35, 1100),
  bloc: () => ton(160, 100, 0.08, "square", 0.2),
  ressort: () => ton(200, 1000, 0.32, "sine", 0.35),
  nuage: () => souffle(0.3, 0.08, 3000),
  drapeau: () => arpege([67, 72, 76, 79], 0.07, "triangle", 0.28),
  perdPlume: () => ton(800, 200, 0.35, "sawtooth", 0.12),
  mort: () => arpege([72, 67, 64, 60, 55, 48], 0.09, "square", 0.15),
  victoire: () => arpege([60, 64, 67, 72, 67, 72, 76, 79, 84], 0.1, "square", 0.16),
};

// Une petite musique en boucle : mélodie, basse et un léger tic de percussion.
const MELODIE = [
  72, 0, 76, 79, 81, 0, 79, 76, 77, 0, 74, 0, 72, 0, 0, 0, 74, 0, 77, 81, 84, 0, 81, 77, 79, 0, 0, 76, 74, 0, 0, 0,
  72, 0, 76, 79, 81, 0, 84, 81, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 76, 77, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0,
];
const BASSE = [
  48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 48, 0, 0, 0, 50, 0, 0, 0, 57, 0, 0, 0, 55, 0, 0, 0, 43, 0, 0, 0,
  48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 52, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0, 48, 0, 43, 0, 48, 0, 0, 0,
];
let horloge: number | null = null;

export function lancerMusique() {
  const c = audio();
  if (!c || horloge !== null) return;
  let pas = 0;
  let prochain = c.currentTime + 0.1;
  horloge = window.setInterval(() => {
    while (prochain < c.currentTime + 0.2) {
      const i = pas % MELODIE.length;
      if (MELODIE[i]) ton(hz(MELODIE[i]), hz(MELODIE[i]), 0.16, "square", 0.07, prochain - c.currentTime, musique);
      if (BASSE[i]) ton(hz(BASSE[i]), hz(BASSE[i]), 0.4, "triangle", 0.22, prochain - c.currentTime, musique);
      if (i % 4 === 2) ton(5000, 3000, 0.02, "square", 0.012, prochain - c.currentTime, musique);
      pas++;
      prochain += 0.14;
    }
  }, 40);
}

export function arreterMusique() {
  if (horloge !== null) clearInterval(horloge);
  horloge = null;
}
