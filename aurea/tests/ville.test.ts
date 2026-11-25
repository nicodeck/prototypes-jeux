// La cité tient-elle debout ? Ces tests font tourner la simulation sans navigateur.
import { describe, expect, test } from "bun:test";
import { Architecte, batirEnAccelere } from "../src/ville/architecte";
import { fonderBourg } from "../src/ville/bourg";
import { FICHES } from "../src/ville/catalogue";
import { indice, TAILLE } from "../src/ville/ile";
import { Ville } from "../src/ville/ville";

function bourg() {
  const v = new Ville();
  fonderBourg(v);
  return v;
}

const secondes = (v: Ville, s: number) => {
  for (let n = 0; n < s * 10; n++) v.pas();
};

describe("l'île et le bourg", () => {
  test("le bourg est entièrement posé, et tout est relié au port", () => {
    const v = bourg();
    const types = [...v.batiments.values()].map((b) => b.type);
    expect(types.filter((t) => t === "maison").length).toBe(9);
    for (const t of ["port", "phare", "forum", "peche", "bucheron"]) expect(types).toContain(t as never);
    secondes(v, 1);
    for (const b of v.batiments.values()) if (b.type !== "phare") expect(b.relie).toBe(true);
  });

  test("il reste beaucoup de terrain à bâtir, et le promontoire peut porter le temple", () => {
    const v = bourg();
    let libres = 0;
    for (let j = 0; j < TAILLE; j++) for (let i = 0; i < TAILLE; i++) if (v.caseLibre(i, j)) libres++;
    expect(libres).toBeGreaterThan(3000);
    v.palierMax = 3;
    v.denarii = 1e6;
    v.stocks.bois = v.stocks.marbre = 1000;
    let surPromontoire = 0;
    for (let j = 60; j < 95; j++) for (let i = 96; i < 120; i++) for (const r of [0, 1, 2, 3]) if (v.peutPoser("temple", i, j, r).ok) surPromontoire++;
    expect(surPromontoire).toBeGreaterThan(0);
  });

  test("l'aqueduc descend des collines au château d'eau, et l'on ne bâtit pas dessus", () => {
    const v = bourg();
    expect(v.decor.aqueduc.length).toBeGreaterThan(20);
    expect(v.decor.castellum).not.toBeNull();
    const a = v.decor.aqueduc[10]!;
    expect(v.reserve[indice(a.i, a.j)]).toBe(2);
    expect(v.peutPoser("maison", a.i, a.j, 0).ok).toBe(false);
  });
});

describe("les règles", () => {
  test("une pêcherie sans route ne livre rien ; avec une route, sa charrette livre au port", () => {
    const v = bourg();
    const avant = v.stocks.poisson;
    const p = v.poser("peche", 51, 92, 0)!;
    expect(p).not.toBeNull();
    secondes(v, 60);
    expect(p.relie).toBe(false);
    expect(v.charrettes.some((c) => c.batiment === p.id)).toBe(false);
    // On la relie à la rue du port
    v.poserRoutes([{ i: 50, j: 92 }, { i: 50, j: 91 }, { i: 50, j: 90 }, { i: 50, j: 89 }, { i: 50, j: 88 }]);
    let livre = false;
    for (let n = 0; n < 900 && !livre; n++) {
      v.pas();
      livre = v.evenements.some((e) => e.sorte === "livraison" && e.id === p.id);
    }
    expect(p.relie).toBe(true);
    expect(livre).toBe(true);
    expect(v.stocks.poisson + 50).toBeGreaterThan(avant);
  });

  test("on ne bâtit ni dans l'eau, ni sur une route, ni sans le sou", () => {
    const v = bourg();
    expect(v.peutPoser("maison", 60, 100, 0).raison).toBe("Dans l'eau");
    expect(v.peutPoser("maison", 56, 76, 0).raison).toBe("Emplacement occupé");
    v.denarii = 10;
    expect(v.peutPoser("maison", 66, 70, 0).raison).toBe("Pas assez de denarii");
    expect(v.peutPoser("ferme", 30, 75, 0).raison).toBe("Pas encore débloqué");
  });

  test("le pain sort de la chaîne ferme, moulin, boulangerie", () => {
    const v = bourg();
    v.palierMax = 1;
    v.denarii = 1e5;
    v.stocks.bois = 200;
    // Une rue neuve à l'est du forum, et la chaîne le long
    v.poserRoutes(Array.from({ length: 14 }, (_, n) => ({ i: 66, j: 74 + n })));
    expect(v.poser("ferme", 67, 74, 1)).not.toBeNull();
    expect(v.poser("moulin", 67, 79, 1)).not.toBeNull();
    expect(v.poser("boulangerie", 67, 82, 1)).not.toBeNull();
    // Les Plebeii mangent le pain dès qu'il arrive : on guette la livraison
    let pain = false;
    for (let n = 0; n < 2400 && !pain; n++) {
      v.pas();
      pain = v.evenements.some((e) => e.sorte === "livraison" && e.marchandise === "pain");
    }
    expect(pain).toBe(true);
  });

  test("une maison comblée monte en Plebeii quand le niveau est débloqué", () => {
    const v = bourg();
    secondes(v, 20);
    expect([...v.batiments.values()].some((b) => b.type === "maison" && b.palier === 1)).toBe(false);
    v.palierMax = 1;
    let evolution = false;
    for (let n = 0; n < 600 && !evolution; n++) {
      v.pas();
      evolution = v.evenements.some((e) => e.sorte === "evolution");
    }
    expect(evolution).toBe(true);
  });
});

describe("la cité grandit jusqu'au temple", () => {
  test("l'architecte consacre le temple en moins de 40 minutes de jeu, sans s'endetter", () => {
    const v = bourg();
    const architecte = new Architecte(v);
    let temple = -1;
    let dette = 0;
    for (let n = 0; n < 40 * 600 && temple < 0; n++) {
      architecte.agir();
      v.pas();
      if (v.denarii < 0) dette += 0.1;
      if (v.templeConsacre) temple = v.temps;
    }
    expect(temple).toBeGreaterThan(0);
    expect(dette).toBeLessThan(30);
    expect(v.population().total).toBeGreaterThan(300);
  });

  test("la simulation est reproductible", () => {
    const a = bourg();
    const b = bourg();
    batirEnAccelere(a, 300);
    batirEnAccelere(b, 300);
    expect(a.population()).toEqual(b.population());
    expect(Math.round(a.denarii)).toBe(Math.round(b.denarii));
    expect(a.batiments.size).toBe(b.batiments.size);
  });

  test("toutes les fiches ont une emprise et un coût cohérents", () => {
    for (const [type, f] of Object.entries(FICHES)) {
      expect(f.l * f.p, type).toBeGreaterThan(0);
      if (f.produit) expect(f.duree, type).toBeGreaterThan(0);
    }
  });
});
