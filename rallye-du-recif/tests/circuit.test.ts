// Le circuit tient debout : une boucle sans chevauchement, des objets posés sur la route,
// un raccourci qui rejoint bien la route et qui fait vraiment gagner du chemin.
import { describe, expect, test } from "bun:test";
import { Circuit } from "../src/course/circuit";

const c = new Circuit();
const P = c.principal;

describe("le circuit", () => {
  test("la boucle fait entre 600 et 1200 mètres", () => {
    expect(P.longueur).toBeGreaterThan(600);
    expect(P.longueur).toBeLessThan(1200);
  });

  test("deux bouts de route éloignés ne se touchent pas (bas-côtés compris)", () => {
    const E = P.echantillons;
    const L = P.longueur;
    for (let i = 0; i < E.length; i += 2)
      for (let j = i + 2; j < E.length; j += 2) {
        const ds = Math.min(Math.abs(E[i].s - E[j].s), L - Math.abs(E[i].s - E[j].s));
        if (ds < 60) continue;
        const d = Math.hypot(E[i].x - E[j].x, E[i].z - E[j].z);
        const marge = (E[i].largeur + E[j].largeur) / 2 + 6;
        if (d < marge) throw new Error(`la route se chevauche vers s=${E[i].s.toFixed(0)} et s=${E[j].s.toFixed(0)} (${d.toFixed(1)} m)`);
      }
  });

  test("la grille de départ, les perles et les bandes sont sur la route", () => {
    for (const g of c.grille) expect(c.lieu(g.x, g.z).surface).toBe("route");
    for (const p of c.perles) expect(c.lieu(p.x, p.z).surface).toBe("route");
    for (const b of c.bandes) {
      const q = P.point(b.s, b.d);
      const l = c.lieu(q.x, q.z);
      expect(l.surface).toBe("route");
      expect(l.bande).toBe(true);
    }
  });

  test("la grille est derrière la ligne, dans l'axe de la route", () => {
    for (const g of c.grille) expect(g.s).toBeGreaterThan(P.longueur - 40);
  });

  test("le raccourci part de la route et y revient, et il est plus court que le bout qu'il évite", () => {
    const R = c.raccourci;
    for (const e of [R.echantillons[0], R.echantillons[R.echantillons.length - 1]]) {
      const l = P.projeter(e.x, e.z);
      expect(Math.abs(l.d)).toBeLessThan(P.echantillons[l.i].largeur / 2);
    }
    expect(c.sFin).toBeGreaterThan(c.sDebut);
    expect(R.longueur).toBeLessThan((c.sFin - c.sDebut) * 0.8);
  });

  test("on tombe à l'eau à côté du ponton, pas dessus", () => {
    const R = c.raccourci;
    const milieu = R.point(R.longueur / 2);
    expect(c.lieu(milieu.x, milieu.z).surface).toBe("route");
    const cote = R.point(R.longueur / 2, 6);
    expect(c.lieu(cote.x, cote.z).surface).toBe("eau");
  });
});
