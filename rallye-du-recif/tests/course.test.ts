// La simulation : la conduite, le dérapage, les objets, les chutes, les tours.
import { describe, expect, test } from "bun:test";
import { AUCUNE_COMMANDE, Course, type Commandes } from "../src/course/course";
import { REGLAGES } from "../src/reglages";

const gaz: Commandes = { ...AUCUNE_COMMANDE, accelerer: true };

/** Une course déjà lancée, sans objets sur la piste. */
function lancee(pilotes = ["tao", "tao"] as const) {
  const c = new Course([...pilotes], { objets: false, decompte: 0 });
  return c;
}

/** Pose un kart à un endroit de la piste. */
function poser(c: Course, i: number, s: number, d = 0) {
  const k = c.karts[i];
  const q = c.circuit.principal.point(s, d);
  k.x = q.x;
  k.z = q.z;
  k.cap = q.cap;
  k.memo.iP = undefined;
  k.lieu = c.circuit.lieu(k.x, k.z, k.memo);
  k.y = k.lieu.y;
  k.sPrec = k.lieu.s;
  return k;
}

describe("la conduite", () => {
  test("on accélère jusqu'à la vitesse de pointe, moins vite dans l'herbe", () => {
    const c = lancee();
    const k = poser(c, 0, 20);
    poser(c, 1, 20, 40);
    for (let i = 0; i < 60 * 5; i++) c.pas([gaz, AUCUNE_COMMANDE]);
    expect(k.v).toBeGreaterThan(REGLAGES.vitesseMax * k.stats.vitesse * 0.95);
    expect(k.lieu.surface).toBe("route");
  });

  test("le turbo de départ récompense un appui juste avant le top, pas un appui trop tôt", () => {
    const c = new Course(["tao", "tao"], { objets: false, decompte: 3 });
    for (let i = 0; i < c.depart + 1; i++) {
      const juste = c.depart - c.image < 20;
      c.pas([{ ...AUCUNE_COMMANDE, accelerer: juste }, gaz]);
    }
    expect(c.karts[0].turbo).toBeGreaterThan(0);
    expect(c.karts[1].turbo).toBe(0);
  });

  test("le dérapage charge un mini-turbo", () => {
    const c = lancee();
    const k = poser(c, 0, 10);
    poser(c, 1, 300);
    for (let i = 0; i < 60 * 2; i++) c.pas([gaz, AUCUNE_COMMANDE]);
    let turbo = false;
    // Un dérapage à gauche, en contre-braquant pour ne pas tourner trop.
    for (let i = 0; i < 60 * 2 && !turbo; i++) {
      c.pas([{ ...gaz, derive: i < 75, direction: i < 8 ? -1 : 1 }, AUCUNE_COMMANDE]);
      turbo = c.evenements.some((e) => e.type === "miniTurbo");
    }
    expect(turbo).toBe(true);
    expect(k.turbo).toBeGreaterThan(0);
    expect(k.chutes).toBe(0);
  });

  test("on ne traverse pas la rambarde du pont", () => {
    const c = lancee();
    const s = c.circuit.sDeU(12.5);
    const k = poser(c, 0, s);
    poser(c, 1, 100);
    k.cap += 1.2;
    for (let i = 0; i < 60 * 3; i++) c.pas([gaz, AUCUNE_COMMANDE]);
    expect(k.chutes).toBe(0);
    expect(Math.abs(k.lieu.proj.d)).toBeLessThan(k.lieu.mur!);
  });

  test("tomber à l'eau fait perdre du temps, puis on repart de la route", () => {
    const c = lancee();
    const k = poser(c, 0, 30);
    poser(c, 1, 300);
    k.cap += 1.3; // vers la mer, à droite
    let plouf = false;
    for (let i = 0; i < 60 * 4 && !plouf; i++) {
      c.pas([gaz, AUCUNE_COMMANDE]);
      plouf = c.evenements.some((e) => e.type === "plouf");
    }
    expect(plouf).toBe(true);
    for (let i = 0; i < 60 * REGLAGES.chute + 2; i++) c.pas([AUCUNE_COMMANDE, AUCUNE_COMMANDE]);
    expect(k.chute).toBe(0);
    expect(k.lieu.surface).toBe("route");
  });

  test("on compte les tours et l'arrivée", () => {
    const c = lancee(["tao"] as any);
    const k = c.karts[0];
    k.distance = c.longueur * REGLAGES.tours - 3;
    k.tour = REGLAGES.tours;
    for (let i = 0; i < 60; i++) c.pas([gaz]);
    expect(k.fini).toBe(true);
  });
});

describe("les objets", () => {
  function avecObjet(objet: "oursin" | "meduse" | "bulle" | "piment") {
    const c = new Course(["tao", "tao"], { objets: false, decompte: 0 });
    const a = poser(c, 0, 40);
    const b = poser(c, 1, 60);
    a.objet = objet;
    return { c, a, b };
  }

  test("un oursin lancé vers un kart devant le sonne", () => {
    const { c, b } = avecObjet("oursin");
    c.pas([{ ...AUCUNE_COMMANDE, objet: true }, AUCUNE_COMMANDE]);
    let touche = false;
    for (let i = 0; i < 60 && !touche; i++) {
      c.pas([AUCUNE_COMMANDE, AUCUNE_COMMANDE]);
      touche = c.evenements.some((e) => e.type === "touche" && e.kart === 1);
    }
    expect(touche).toBe(true);
    expect(b.sonne).toBeGreaterThan(0);
  });

  test("une méduse posée derrière sonne le kart qui suit", () => {
    const c = new Course(["tao", "tao"], { objets: false, decompte: 0 });
    const a = poser(c, 0, 60);
    const b = poser(c, 1, 35);
    a.objet = "meduse";
    c.pas([{ ...AUCUNE_COMMANDE, objet: true }, AUCUNE_COMMANDE]);
    expect(c.objets.length).toBe(1);
    let touche = false;
    for (let i = 0; i < 60 * 4 && !touche; i++) {
      c.pas([AUCUNE_COMMANDE, gaz]);
      touche = c.evenements.some((e) => e.type === "touche" && e.kart === 1);
    }
    expect(touche).toBe(true);
    expect(c.objets.length).toBe(0);
  });

  test("la bulle protège d'un coup", () => {
    const { c, a, b } = avecObjet("oursin");
    b.bulle = 600;
    c.pas([{ ...AUCUNE_COMMANDE, objet: true }, AUCUNE_COMMANDE]);
    for (let i = 0; i < 60; i++) c.pas([AUCUNE_COMMANDE, AUCUNE_COMMANDE]);
    expect(b.sonne).toBe(0);
    expect(b.bulle).toBe(0);
    expect(a.sonne).toBe(0);
  });

  test("le piment donne un turbo", () => {
    const { c, a } = avecObjet("piment");
    c.pas([{ ...gaz, objet: true }, AUCUNE_COMMANDE]);
    expect(a.turbo).toBeGreaterThan(60);
  });

  test("une perle lance la roulette, puis donne un objet", () => {
    const c = new Course(["tao"], { decompte: 0, graine: 4 });
    const k = c.karts[0];
    const p = c.perles[0];
    k.x = p.x - 3;
    k.z = p.z;
    k.memo.iP = undefined;
    for (let i = 0; i < 20; i++) {
      k.x = p.x;
      k.z = p.z;
      c.pas([AUCUNE_COMMANDE]);
    }
    expect(k.roulette).toBeGreaterThan(0);
    for (let i = 0; i < 60 * REGLAGES.objets.roulette + 1; i++) c.pas([AUCUNE_COMMANDE]);
    expect(k.objet).not.toBeNull();
  });
});
