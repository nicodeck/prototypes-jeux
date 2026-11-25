// La synchro : chaque obstacle tombe exactement sur un temps de la partition, là où la musique joue.
import { describe, expect, test } from "bun:test";
import { Partition } from "../src/partition";

const p = new Partition();
const percussions = new Set(["grosse", "caisse", "claque", "charley", "charleyOuvert"]);
const instantsPercussions = p.notes.filter((n) => percussions.has(n.instr)).map((n) => n.t);

function procheDe(liste: number[], t: number, tolerance = 1e-6): boolean {
  let lo = 0;
  let hi = liste.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (liste[mid] < t - tolerance) lo = mid + 1;
    else hi = mid;
  }
  return Math.abs(liste[lo] - t) <= tolerance;
}

describe("la partition", () => {
  test("une partie dure entre 3 et 5 minutes", () => {
    expect(p.duree).toBeGreaterThan(180);
    expect(p.duree).toBeLessThan(300);
  });

  test("chaque obstacle est posé sur une croche de la grille", () => {
    for (const o of p.obstacles) {
      expect(Number.isInteger(o.temps * 2)).toBe(true);
      const m = p.mesures[o.mesure];
      expect(o.temps).toBe(m.debutTemps + o.pas * 0.5);
    }
  });

  test("l'instant de chaque obstacle est celui de son temps sur la carte des tempos", () => {
    for (const o of p.obstacles) expect(Math.abs(o.t - p.tempsVersSecondes(o.temps))).toBeLessThan(1e-9);
  });

  test("chaque obstacle tombe sur un coup de percussion du morceau", () => {
    const orphelins = p.obstacles.filter((o) => !procheDe(instantsPercussions, o.t));
    expect(orphelins.map((o) => `mesure ${o.mesure + 1}, croche ${o.pas + 1}`)).toEqual([]);
  });

  test("les obstacles sont dans l'ordre et jamais plus serrés qu'une croche", () => {
    for (let i = 1; i < p.obstacles.length; i++) {
      const ecart = p.obstacles[i].t - p.obstacles[i - 1].t;
      expect(ecart).toBeGreaterThan(0.2);
    }
  });

  test("l'introduction et le final laissent respirer", () => {
    const debut = p.tempsVersSecondes(16);
    const fin = p.mesures[p.mesures.length - 2].debutS;
    for (const o of p.obstacles) {
      expect(o.t).toBeGreaterThanOrEqual(debut);
      expect(o.t).toBeLessThan(fin);
    }
  });

  test("chaque section utilise les trois gestes et accélère", () => {
    p.sections.forEach((s, i) => {
      const actions = new Set(p.obstacles.filter((o) => o.section === i).map((o) => o.action));
      expect(actions.size).toBe(3);
      if (i > 0) expect(s.bpm).toBeGreaterThan(p.sections[i - 1].bpm);
    });
  });

  test("temps → secondes → temps retombe sur ses pieds, même aux changements de tempo", () => {
    for (let temps = 0; temps < p.tempsTotal; temps += 0.37) {
      expect(Math.abs(p.secondesVersTemps(p.tempsVersSecondes(temps)) - temps)).toBeLessThan(1e-9);
    }
    for (const d of p.debutsSections) expect(Math.abs(p.tempsVersSecondes(d.temps) - d.t)).toBeLessThan(1e-9);
  });
});
