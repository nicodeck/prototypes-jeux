// Les bots : ils finissent la course sans rester coincés, le dérapage leur fait gagner du temps,
// et le niveau difficile bat le niveau facile.
import { describe, expect, test } from "bun:test";
import type { Niveau } from "../src/course/bot";
import type { NomPilote } from "../src/course/pilotes";
import { courir, temps } from "./outils";

const PILOTES: NomPilote[] = ["rin", "tao", "mira", "ganzo"];

describe("les bots", () => {
  test("huit bots finissent la course avec les objets, sans rester coincés", () => {
    for (const graine of [1, 2, 3]) {
      const niveaux: Niveau[] = ["facile", "moyen", "difficile", "facile", "moyen", "difficile", "moyen", "difficile"];
      const r = courir(
        niveaux.map((n, i) => ({ pilote: PILOTES[i % 4], niveau: n })),
        { graine, limite: 200 },
      );
      expect(r.terminee).toBe(true);
      for (const k of r.course.karts) {
        if (r.arrets[k.numero] > 5) throw new Error(`graine ${graine} : ${k.pilote} n°${k.numero} n'avance plus pendant ${r.arrets[k.numero].toFixed(1)} s`);
      }
    }
  });

  test("chaque pilote finit seul en moins de 2 min 10, sans tomber à l'eau, au niveau moyen", () => {
    for (const pilote of PILOTES) {
      const r = courir([{ pilote, niveau: "moyen", raccourci: false }], { objets: false });
      const k = r.course.karts[0];
      expect(k.fini).toBe(true);
      expect(temps(k.temps)).toBeLessThan(130);
      expect(k.chutes).toBe(0);
    }
  });

  test("le dérapage fait gagner du temps", () => {
    for (const pilote of PILOTES) {
      const avec = courir([{ pilote, niveau: "difficile", raccourci: false }], { objets: false }).course.karts[0];
      const sans = courir([{ pilote, niveau: "difficile", raccourci: false, derive: false }], { objets: false }).course.karts[0];
      expect(avec.miniTurbos).toBeGreaterThan(6);
      expect(temps(sans.temps) - temps(avec.temps)).toBeGreaterThan(1.5);
    }
  });

  test("le raccourci fait gagner du temps à qui le réussit", () => {
    const sans = courir([{ pilote: "tao", niveau: "difficile", raccourci: false }], { objets: false }).course.karts[0];
    const avec = courir([{ pilote: "tao", niveau: "difficile", raccourci: true }], { objets: false }).course.karts[0];
    expect(avec.chutes).toBe(0);
    expect(temps(sans.temps) - temps(avec.temps)).toBeGreaterThan(1.5);
  });

  test("le niveau difficile bat le niveau facile au moins 8 fois sur 10", () => {
    let victoires = 0;
    for (let graine = 1; graine <= 10; graine++) {
      const engages = PILOTES.flatMap((p) => [
        { pilote: p, niveau: "facile" as Niveau },
        { pilote: p, niveau: "difficile" as Niveau },
      ]);
      const r = courir(engages, { graine, limite: 200 });
      const premier = r.course.classement()[0];
      if (engages[premier.numero].niveau === "difficile") victoires++;
    }
    expect(victoires).toBeGreaterThanOrEqual(8);
  });
});
