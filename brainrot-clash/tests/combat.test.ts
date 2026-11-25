// La simulation du combat : déplacements, sauts, coups et éjections.
import { describe, expect, test } from "bun:test";
import { ARENE } from "../src/combat/arene";
import { AUCUNE_COMMANDE, Combat, type Commandes } from "../src/combat/combat";
import { PERSOS, type NomPerso } from "../src/combat/persos";

const rien = (): Commandes => ({ ...AUCUNE_COMMANDE });
const avec = (c: Partial<Commandes>): Commandes => ({ ...AUCUNE_COMMANDE, ...c });

/** Fait avancer le combat de n images avec les mêmes commandes. */
function attendre(combat: Combat, n: number, j1: Commandes = rien(), j2: Commandes = rien()) {
  for (let i = 0; i < n; i++) combat.pas([j1, j2]);
}

describe("sauts et plateformes", () => {
  for (const nom of ["ballerina", "tung"] as NomPerso[]) {
    test(`${nom} atteint une plateforme basse d'un seul saut`, () => {
      const combat = new Combat([nom, "ballerina"]);
      const c = combat.combattants[0];
      c.x = -3.7; // sous la plateforme de gauche
      attendre(combat, 1, avec({ haut: true }));
      attendre(combat, 80, avec({ haut: true }));
      expect(c.auSol).toBe(true);
      expect(c.y).toBeCloseTo(ARENE.plateformes[0].y, 5);
    });

    test(`${nom} redescend d'une plateforme avec la flèche du bas`, () => {
      const combat = new Combat([nom, "ballerina"]);
      const c = combat.combattants[0];
      Object.assign(c, { x: -3.7, y: ARENE.plateformes[0].y, auSol: true });
      attendre(combat, 2);
      attendre(combat, 1, avec({ bas: true }));
      attendre(combat, 80);
      expect(c.auSol).toBe(true);
      expect(c.y).toBe(0);
    });
  }

  test("un saut court (relâché tout de suite) monte moins haut qu'un saut tenu", () => {
    const hauteur = (tenir: boolean) => {
      const combat = new Combat(["ballerina", "ballerina"]);
      const c = combat.combattants[0];
      let max = 0;
      combat.pas([avec({ haut: true }), rien()]);
      for (let i = 0; i < 60; i++) {
        combat.pas([avec({ haut: tenir }), rien()]);
        max = Math.max(max, c.y);
      }
      return max;
    };
    expect(hauteur(false)).toBeLessThan(hauteur(true) * 0.7);
  });

  test("on ne traverse pas le récif par le côté", () => {
    const combat = new Combat(["ballerina", "ballerina"]);
    const c = combat.combattants[0];
    Object.assign(c, { x: ARENE.bord + 1, y: -1.5, auSol: false });
    attendre(combat, 20, avec({ gauche: true }));
    expect(c.x - c.perso.largeur / 2).toBeGreaterThanOrEqual(ARENE.bord - 1e-3);
  });
});

describe("coups et éjections", () => {
  /** Tung frappe Ballerina (coup de batte) à un pourcentage donné, depuis le centre du récif. Ballerina est-elle éjectée ? */
  function batteSur(degats: number) {
    const combat = new Combat(["tung", "ballerina"]);
    const [g, r] = combat.combattants;
    Object.assign(g, { x: -1, dir: 1 });
    Object.assign(r, { x: 0.3, dir: -1, degats });
    combat.pas([avec({ attaque: true }), rien()]);
    for (let i = 0; i < 400 && r.etat !== "ko" && !(r.auSol && r.etat === "libre" && i > 60); i++) combat.pas([rien(), rien()]);
    return { ko: r.etat === "ko", degats: r.degats };
  }

  test("le coup de batte de Tung inflige ses dégâts", () => {
    expect(batteSur(0).degats).toBe(PERSOS.tung.coups.sol.frappes[0].degats);
  });

  test("plus on a de dégâts, plus on vole loin : Ballerina résiste à 20 %, pas à 160 %", () => {
    expect(batteSur(20).ko).toBe(false);
    expect(batteSur(160).ko).toBe(true);
  });

  test("la garde bloque le coup, sans dégâts", () => {
    const combat = new Combat(["tung", "ballerina"]);
    const [g, r] = combat.combattants;
    Object.assign(g, { x: -1, dir: 1 });
    Object.assign(r, { x: 0.3, dir: -1 });
    combat.pas([avec({ attaque: true }), avec({ garde: true })]);
    attendre(combat, 30, rien(), avec({ garde: true }));
    expect(r.degats).toBe(0);
    expect(r.bouclier).toBeLessThan(1);
  });

  test("l'enchaînement de Ballerina : trois coups en appuyant trois fois", () => {
    const combat = new Combat(["ballerina", "tung"]);
    const [r, g] = combat.combattants;
    Object.assign(r, { x: -0.5, dir: 1 });
    Object.assign(g, { x: 0.5, dir: -1 });
    const coups: string[] = [];
    for (let i = 0; i < 60; i++) {
      combat.pas([avec({ attaque: i % 6 === 0 }), rien()]);
      for (const e of combat.evenements) if (e.type === "coup") coups.push(e.nom);
    }
    expect(coups.slice(0, 3)).toEqual(["battement", "battement2", "pirouette"]);
  });

  test("tomber hors de l'écran coûte une vie, puis on réapparaît au-dessus du récif", () => {
    const combat = new Combat(["ballerina", "tung"]);
    const r = combat.combattants[0];
    Object.assign(r, { x: 0, y: ARENE.limites.bas - 1, auSol: false });
    combat.pas([rien(), rien()]);
    expect(r.vies).toBe(2);
    expect(r.etat).toBe("ko");
    attendre(combat, 80);
    expect(r.etat).toBe("reapparition");
    expect(r.degats).toBe(0);
  });

  test("la dernière vie perdue termine le combat", () => {
    const combat = new Combat(["ballerina", "tung"], 1);
    Object.assign(combat.combattants[1], { x: ARENE.limites.droite + 1, auSol: false });
    combat.pas([rien(), rien()]);
    expect(combat.fini).toBe(true);
    expect(combat.gagnant).toBe(0);
  });
});
