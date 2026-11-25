// Les instruments, tous synthétisés : oscillateurs, bruit, filtres et enveloppes.
// Chaque fonction programme un son à l'instant `t` de l'horloge audio.

import type { Note } from "../partition";
import { midiVersHz } from "../outils";
import type { MoteurAudio } from "./moteur";
import type { Action } from "../reglages";

type Sortie = AudioNode;

function env(m: MoteurAudio, t: number, pic: number, attaque: number, chute: number, dest: Sortie): GainNode {
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pic, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + chute);
  g.connect(dest);
  return g;
}

function osc(m: MoteurAudio, type: OscillatorType, f: number, t: number, fin: number, dest: AudioNode, detune = 0) {
  const o = m.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(fin);
  return o;
}

function bruit(m: MoteurAudio, t: number, duree: number, dest: AudioNode) {
  const s = m.ctx.createBufferSource();
  s.buffer = m.bruit;
  s.connect(dest);
  s.start(t, Math.random() * 1.2);
  s.stop(t + duree);
  return s;
}

function filtre(m: MoteurAudio, type: BiquadFilterType, f: number, q: number, dest: AudioNode) {
  const b = m.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(dest);
  return b;
}

function pan(m: MoteurAudio, p: number, dest: AudioNode) {
  const s = m.ctx.createStereoPanner();
  s.pan.value = p;
  s.connect(dest);
  return s;
}

function envoi(m: MoteurAudio, source: AudioNode, reverb: number, echo = 0) {
  if (reverb > 0) {
    const g = m.ctx.createGain();
    g.gain.value = reverb;
    source.connect(g).connect(m.envoiReverb);
  }
  if (echo > 0) {
    const g = m.ctx.createGain();
    g.gain.value = echo;
    source.connect(g).connect(m.envoiEcho);
  }
}

// ------------------------------------------------------------------ percussions

export function grosse(m: MoteurAudio, t: number, vel: number, dest: Sortie) {
  const g = env(m, t, 0.95 * vel, 0.002, 0.42, dest);
  const o = osc(m, "sine", 165, t, t + 0.5, g);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
  const clic = env(m, t, 0.25 * vel, 0.001, 0.02, dest);
  bruit(m, t, 0.03, filtre(m, "highpass", 2500, 0.7, clic));
  m.creuser(t, vel);
}

export function caisse(m: MoteurAudio, t: number, vel: number, dest: Sortie) {
  const g = env(m, t, 0.42 * vel, 0.001, 0.2, dest);
  bruit(m, t, 0.25, filtre(m, "bandpass", 1900, 0.6, g));
  const corps = env(m, t, 0.35 * vel, 0.001, 0.12, dest);
  const o = osc(m, "triangle", 210, t, t + 0.15, corps);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
  envoi(m, g, 0.25);
}

export function claque(m: MoteurAudio, t: number, vel: number, dest: Sortie) {
  const f = filtre(m, "bandpass", 1300, 1.1, dest);
  for (const [d, a] of [
    [0, 0.5],
    [0.011, 0.45],
    [0.023, 0.6],
  ]) {
    const g = env(m, t + d, a * vel, 0.001, d === 0.023 ? 0.22 : 0.012, f);
    bruit(m, t + d, 0.3, g);
  }
  envoi(m, f, 0.6);
}

export function charley(m: MoteurAudio, t: number, vel: number, ouvert: boolean, dest: Sortie) {
  const p = pan(m, ouvert ? 0.25 : -0.2, dest);
  const g = env(m, t, (ouvert ? 0.16 : 0.13) * vel, 0.001, ouvert ? 0.28 : 0.045, p);
  bruit(m, t, ouvert ? 0.32 : 0.06, filtre(m, "highpass", ouvert ? 6500 : 8000, 0.8, g));
  if (ouvert) envoi(m, g, 0.2);
}

export function shaker(m: MoteurAudio, t: number, vel: number, dest: Sortie) {
  const p = pan(m, 0.4, dest);
  const g = env(m, t, 0.07 * vel, 0.012, 0.05, p);
  bruit(m, t, 0.08, filtre(m, "bandpass", 6500, 1.6, g));
}

export function tom(m: MoteurAudio, t: number, midi: number, vel: number, dest: Sortie) {
  const g = env(m, t, 0.5 * vel, 0.002, 0.35, dest);
  const f = midiVersHz(midi);
  const o = osc(m, "sine", f * 1.6, t, t + 0.4, g);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.2);
  envoi(m, g, 0.35);
}

// ------------------------------------------------------------------ notes

export function basse(m: MoteurAudio, t: number, midi: number, duree: number, vel: number, dest: Sortie) {
  const f = midiVersHz(midi);
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.17 * vel, t + 0.008);
  g.gain.setTargetAtTime(0.1 * vel, t + 0.01, 0.15);
  g.gain.setTargetAtTime(0.0001, t + duree, 0.04);
  g.connect(dest);
  const lp = filtre(m, "lowpass", 900, 6, g);
  lp.frequency.setValueAtTime(1600, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.35, duree));
  osc(m, "sawtooth", f, t, t + duree + 0.3, lp);
  osc(m, "sine", f, t, t + duree + 0.3, g);
}

export function nappe(m: MoteurAudio, t: number, notes: number[], duree: number, vel: number, section: number, dest: Sortie) {
  const g = m.ctx.createGain();
  const pic = (0.095 * vel) / Math.sqrt(notes.length);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pic, t + Math.min(0.6, duree * 0.3));
  g.gain.setValueAtTime(pic, t + duree * 0.75);
  g.gain.linearRampToValueAtTime(0.0001, t + duree + 0.5);
  g.connect(dest);
  const ouverture = [1100, 900, 1600, 2400, 1800][section] ?? 1400;
  const lp = filtre(m, "lowpass", ouverture, 1.5, g);
  lp.frequency.setValueAtTime(ouverture * 0.6, t);
  lp.frequency.linearRampToValueAtTime(ouverture * 1.3, t + duree * 0.6);
  lp.frequency.linearRampToValueAtTime(ouverture * 0.8, t + duree);
  notes.forEach((n, i) => {
    const p = pan(m, ((i % 3) - 1) * 0.5, lp);
    for (const d of [-9, 0, 9]) osc(m, "sawtooth", midiVersHz(n), t, t + duree + 0.6, p, d + i * 2);
  });
  envoi(m, g, 0.7);
}

export function arpege(m: MoteurAudio, t: number, midi: number, duree: number, vel: number, section: number, dest: Sortie) {
  const p = pan(m, Math.sin(t * 3.1) * 0.6, dest);
  const g = env(m, t, 0.18 * vel, 0.003, Math.max(0.12, duree * 1.6), p);
  const lp = filtre(m, "lowpass", 3000, 3, g);
  lp.frequency.setValueAtTime(section === 1 ? 4200 : 3200, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.18);
  osc(m, section === 2 ? "triangle" : "square", midiVersHz(midi), t, t + duree * 2 + 0.2, lp);
  envoi(m, g, 0.25, 0.5);
}

/** Cloche FM : une sinusoïde modulée par une autre, dont la brillance s'éteint. */
export function cloche(m: MoteurAudio, t: number, midi: number, duree: number, vel: number, dest: Sortie, eclat = 1) {
  const f = midiVersHz(midi);
  const g = env(m, t, 0.22 * vel, 0.003, duree, dest);
  const porteuse = osc(m, "sine", f, t, t + duree + 0.1, g);
  const mod = m.ctx.createOscillator();
  mod.frequency.value = f * 3.5;
  const indice = m.ctx.createGain();
  indice.gain.setValueAtTime(f * 2.2 * eclat, t);
  indice.gain.exponentialRampToValueAtTime(f * 0.05, t + duree * 0.7);
  mod.connect(indice).connect(porteuse.frequency);
  mod.start(t);
  mod.stop(t + duree + 0.1);
  envoi(m, g, 0.5, 0.45);
}

export function flute(m: MoteurAudio, t: number, midi: number, duree: number, vel: number, dest: Sortie) {
  const f = midiVersHz(midi);
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.19 * vel, t + 0.035);
  g.gain.setTargetAtTime(0.12 * vel, t + 0.04, 0.1);
  g.gain.setTargetAtTime(0.0001, t + duree, 0.08);
  g.connect(dest);
  const o = osc(m, "triangle", f, t, t + duree + 0.5, g);
  osc(m, "sine", f * 2, t, t + duree + 0.5, g).detune.value = 4;
  const vib = m.ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vg = m.ctx.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
  vib.connect(vg).connect(o.frequency);
  vib.start(t);
  vib.stop(t + duree + 0.5);
  const souffle = env(m, t, 0.03 * vel, 0.01, 0.08, g);
  bruit(m, t, 0.1, filtre(m, "bandpass", f * 2, 2, souffle));
  envoi(m, g, 0.55, 0.35);
}

export function choeur(m: MoteurAudio, t: number, notes: number[], duree: number, vel: number, dest: Sortie) {
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.7);
  g.gain.setValueAtTime(0.09 * vel, t + duree * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + duree + 0.8);
  g.connect(dest);
  // Deux formants de voyelle « a » : la scie devient une voix.
  const f1 = filtre(m, "bandpass", 780, 6, g);
  const f2 = filtre(m, "bandpass", 1180, 7, g);
  for (const n of notes) {
    for (const d of [-6, 6]) {
      const o = osc(m, "sawtooth", midiVersHz(n), t, t + duree + 1, f1, d);
      o.connect(f2);
    }
  }
  envoi(m, g, 1);
}

export function souffle(m: MoteurAudio, t: number, duree: number, vel: number, dest: Sortie) {
  const g = m.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * vel, t + duree * 0.97);
  g.gain.linearRampToValueAtTime(0.0001, t + duree + 0.02);
  g.connect(dest);
  const bp = filtre(m, "bandpass", 300, 2.5, g);
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(7000, t + duree);
  bruit(m, t, duree + 0.05, bp);
  envoi(m, g, 0.5);
}

export function impact(m: MoteurAudio, t: number, midi: number, dest: Sortie) {
  grosse(m, t, 1.2, dest);
  const g = env(m, t, 0.5, 0.005, 2.2, dest);
  const o = osc(m, "sine", midiVersHz(midi + 12), t, t + 2.5, g);
  o.frequency.exponentialRampToValueAtTime(midiVersHz(midi), t + 0.6);
  const b = env(m, t, 0.35, 0.002, 1.2, dest);
  bruit(m, t, 1.3, filtre(m, "lowpass", 3000, 0.5, b));
  envoi(m, b, 1);
}

// ------------------------------------------------------------------ lecture d'une note de partition

export function jouerNote(m: MoteurAudio, n: Note, t: number) {
  // Les sons tenus de la couche de base « respirent » avec la grosse caisse.
  const tenu = n.instr === "nappe" || n.instr === "choeur";
  const dest = tenu && n.couche === "base" ? m.respiration : m.couches[n.couche];
  const d = n.duree ?? 0.3;
  switch (n.instr) {
    case "grosse":
      return grosse(m, t, n.vel, dest);
    case "caisse":
      return caisse(m, t, n.vel, dest);
    case "claque":
      return claque(m, t, n.vel, dest);
    case "charley":
      return charley(m, t, n.vel, false, dest);
    case "charleyOuvert":
      return charley(m, t, n.vel, true, dest);
    case "shaker":
      return shaker(m, t, n.vel, dest);
    case "tom":
      return tom(m, t, n.midi ?? 45, n.vel, dest);
    case "basse":
      return basse(m, t, n.midi!, d, n.vel, dest);
    case "nappe":
      return nappe(m, t, n.accord!, d, n.vel, n.section, dest);
    case "arpege":
      return arpege(m, t, n.midi!, d, n.vel, n.section, dest);
    case "cloche":
      return cloche(m, t, n.midi!, d, n.vel, dest);
    case "flute":
      return flute(m, t, n.midi!, d, n.vel, dest);
    case "souffle":
      return souffle(m, t, d, n.vel, dest);
    case "impact":
      return impact(m, t, n.midi ?? 33, dest);
    case "choeur":
      return choeur(m, t, n.accord!, d, n.vel, dest);
  }
}

// ------------------------------------------------------------------ sons des gestes du joueur

export function sonGeste(m: MoteurAudio, action: Action, t: number, midi: number, accord: number[], parfait: boolean) {
  const dest = m.actions;
  if (action === "saut") {
    cloche(m, t, midi, 0.9, parfait ? 1.1 : 0.8, dest, parfait ? 1.4 : 0.8);
    const g = env(m, t, 0.12, 0.002, 0.25, dest);
    osc(m, "triangle", midiVersHz(midi - 12), t, t + 0.3, g);
    if (parfait) cloche(m, t + 0.002, midi + 12, 0.5, 0.45, dest, 2);
  } else if (action === "frappe") {
    claque(m, t, 1.1, dest);
    const g = env(m, t, 0.5, 0.001, 0.18, dest);
    const o = osc(m, "sine", 140, t, t + 0.25, g);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    // Un accord bref et brillant, accordé sur la mesure.
    const s = env(m, t, parfait ? 0.1 : 0.07, 0.002, 0.3, dest);
    const lp = filtre(m, "lowpass", parfait ? 5200 : 3000, 2, s);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    for (const n of accord) osc(m, "sawtooth", midiVersHz(n), t, t + 0.4, lp, 5);
    envoi(m, s, 0.4, 0.3);
  } else {
    const g = m.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    g.connect(dest);
    const bp = filtre(m, "bandpass", 3000, 1.5, g);
    bp.frequency.setValueAtTime(4500, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.4);
    bruit(m, t, 0.5, bp);
    const sub = env(m, t, 0.4, 0.01, 0.4, dest);
    const o = osc(m, "sine", midiVersHz(midi + 12), t, t + 0.5, sub);
    o.frequency.exponentialRampToValueAtTime(midiVersHz(midi), t + 0.3);
    envoi(m, g, 0.5);
    if (parfait) cloche(m, t, midi + 48, 0.6, 0.4, dest, 1.2);
  }
}

export function sonRate(m: MoteurAudio, t: number) {
  const g = env(m, t, 0.35, 0.002, 0.25, m.actions);
  const o = osc(m, "square", 92, t, t + 0.3, filtre(m, "lowpass", 600, 2, g));
  o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
  const b = env(m, t, 0.15, 0.001, 0.1, m.actions);
  bruit(m, t, 0.12, filtre(m, "lowpass", 900, 1, b));
}

/** Petit clic de métronome pour la calibration. */
export function clic(m: MoteurAudio, t: number, fort: boolean) {
  const g = env(m, t, fort ? 0.5 : 0.35, 0.001, 0.06, m.actions);
  osc(m, "sine", fort ? 1760 : 1320, t, t + 0.08, g);
}
