// Le jugement et une partie entière : le pilote automatique va au bout sans faute, l'absence de jeu perd.
import { describe, expect, test } from "bun:test";
import { Jeu } from "../src/jeu";
import { juger, lettre, precision } from "../src/jugement";
import { Partition } from "../src/partition";
import { REGLAGES } from "../src/reglages";

const p = new Partition();
const F = REGLAGES.fenetres;

describe("le jugement", () => {
  test("fenêtres parfait / bien / trop tôt", () => {
    expect(juger(0)).toBe("parfait");
    expect(juger(F.parfait * 0.9)).toBe("parfait");
    expect(juger(-F.bien * 0.9)).toBe("bien");
    expect(juger(F.bien * 0.9)).toBe("bien");
    expect(juger(-(F.bien + F.tropTot) / 2)).toBe("rate");
    expect(juger(F.bien * 1.5)).toBeNull();
    expect(juger(-F.tropTot * 1.5)).toBeNull();
  });

  test("la note suit la précision", () => {
    expect(lettre(precision(100, 0, 0))).toBe("S");
    expect(lettre(precision(0, 0, 10))).toBe("D");
  });
});

function partie(rappel: (jeu: Jeu, t: number) => void, pilote: boolean): Jeu {
  const jeu = new Jeu(p);
  for (let t = 0; t < p.duree + 1 && !jeu.fini; t += 1 / 60) {
    rappel(jeu, t);
    jeu.mettreAJour(t, pilote);
  }
  return jeu;
}

describe("une partie", () => {
  test("le pilote automatique joue tout parfaitement jusqu'au bout", () => {
    const jeu = partie(() => {}, true);
    expect(jeu.fini).toBe(true);
    expect(jeu.echec).toBe(false);
    expect(jeu.compte.parfait).toBe(p.obstacles.length);
    expect(jeu.compte.rate).toBe(0);
    expect(jeu.comboMax).toBe(p.obstacles.length);
    expect(jeu.niveau).toBe(4);
  });

  test("sans rien toucher, le pouls s'éteint avant la fin", () => {
    const jeu = partie(() => {}, false);
    expect(jeu.echec).toBe(true);
    expect(jeu.tFin).toBeLessThan(p.duree);
  });

  test("un joueur un peu en retard fait des « bien », pas des ratés", () => {
    const joues = new Set<number>();
    const jeu = partie((j, t) => {
      for (const e of j.obstacles) {
        if (!joues.has(e.o.id) && t >= e.o.t + 0.08 && !e.jugement) {
          joues.add(e.o.id);
          j.appuyer(e.o.action, e.o.t + 0.08);
        }
      }
    }, false);
    expect(jeu.echec).toBe(false);
    expect(jeu.compte.rate).toBe(0);
    expect(jeu.compte.bien).toBe(p.obstacles.length);
  });

  test("marteler toutes les touches ne suffit pas", () => {
    const jeu = partie((j, t) => {
      if (Math.round(t * 60) % 3 === 0) for (const a of ["saut", "frappe", "glisse"] as const) j.appuyer(a, t);
    }, false);
    // Chaque obstacle reçoit un appui trop tôt avant son temps : raté, et le pouls finit par s'éteindre.
    expect(jeu.compte.parfait + jeu.compte.bien).toBe(0);
    expect(jeu.echec).toBe(true);
  });
});
