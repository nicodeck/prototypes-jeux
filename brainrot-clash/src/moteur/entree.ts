// Le clavier et les manettes. Deux jeux de touches pour jouer à deux sur un clavier.
import { AUCUNE_COMMANDE, type Commandes } from "../combat/combat";

type Touches = Record<keyof Commandes, string[]>;

/** Seul contre le bot : toutes les touches marchent. */
const SOLO: Touches = {
  gauche: ["KeyA", "ArrowLeft"],
  droite: ["KeyD", "ArrowRight"],
  haut: ["KeyW", "ArrowUp", "Space"],
  bas: ["KeyS", "ArrowDown"],
  attaque: ["KeyJ", "KeyF"],
  special: ["KeyK", "KeyG"],
  garde: ["KeyL", "KeyH", "ShiftLeft", "ShiftRight"],
};

/** À deux : J1 à gauche du clavier (ZQSD + F G H), J2 à droite (flèches + K L M, ou 1 2 3 du pavé). */
const J1: Touches = {
  gauche: ["KeyA"],
  droite: ["KeyD"],
  haut: ["KeyW"],
  bas: ["KeyS"],
  attaque: ["KeyF"],
  special: ["KeyG"],
  garde: ["KeyH"],
};
const J2: Touches = {
  gauche: ["ArrowLeft"],
  droite: ["ArrowRight"],
  haut: ["ArrowUp"],
  bas: ["ArrowDown"],
  attaque: ["KeyK", "Numpad1"],
  special: ["KeyL", "Numpad2"],
  garde: ["Semicolon", "Numpad3"],
};

const enfoncees = new Set<string>();
/** Les touches appuyées depuis la dernière image simulée : un appui très bref compte quand même. */
const fronts = new Set<string>();
const pressees: string[] = [];

export function ecouterClavier(surAppui: () => void) {
  window.addEventListener("keydown", (e) => {
    if (!e.repeat) {
      pressees.push(e.code);
      fronts.add(e.code);
    }
    enfoncees.add(e.code);
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    surAppui();
  });
  window.addEventListener("keyup", (e) => enfoncees.delete(e.code));
  window.addEventListener("blur", () => enfoncees.clear());
}

function manettes() {
  return (navigator.getGamepads?.() ?? []).filter((m): m is Gamepad => !!m);
}

function lireManette(m: Gamepad | undefined): Commandes {
  if (!m) return { ...AUCUNE_COMMANDE };
  const b = (i: number) => !!m.buttons[i]?.pressed;
  const ax = m.axes[0] ?? 0;
  const ay = m.axes[1] ?? 0;
  return {
    gauche: ax < -0.4 || b(14),
    droite: ax > 0.4 || b(15),
    haut: ay < -0.65 || b(12) || b(0) || b(3),
    bas: ay > 0.6 || b(13),
    attaque: b(2),
    special: b(1),
    garde: b(4) || b(5) || b(6) || b(7),
  };
}

function lireTouches(t: Touches): Commandes {
  const c = { ...AUCUNE_COMMANDE };
  for (const k of Object.keys(t) as (keyof Commandes)[]) c[k] = t[k].some((code) => enfoncees.has(code) || fronts.has(code));
  return c;
}

/** À appeler après chaque image simulée. */
export function oublierFronts() {
  fronts.clear();
}

const ou = (a: Commandes, b: Commandes): Commandes => {
  const c = { ...a };
  for (const k of Object.keys(c) as (keyof Commandes)[]) c[k] = a[k] || b[k];
  return c;
};

export function commandesJoueur(joueur: 0 | 1, deuxJoueurs: boolean): Commandes {
  const pads = manettes();
  if (!deuxJoueurs) return ou(lireTouches(SOLO), lireManette(pads[0]));
  return ou(lireTouches(joueur === 0 ? J1 : J2), lireManette(pads[joueur]));
}

/** Les appuis depuis la dernière lecture (menus). */
export function appuis() {
  const liste = pressees.splice(0);
  // Les manettes, pour les menus : on détecte les fronts.
  for (const [i, m] of manettes().entries()) {
    const etat = lireManette(m);
    const avant = precedentManette[i] ?? { ...AUCUNE_COMMANDE };
    if (etat.gauche && !avant.gauche) liste.push("ArrowLeft");
    if (etat.droite && !avant.droite) liste.push("ArrowRight");
    if (etat.haut && !avant.haut && !m.buttons[0]?.pressed) liste.push("ArrowUp");
    if (etat.bas && !avant.bas) liste.push("ArrowDown");
    if (m.buttons[0]?.pressed && !boutonsPrecedents[i]?.[0]) liste.push("Enter");
    if (m.buttons[1]?.pressed && !boutonsPrecedents[i]?.[1]) liste.push("Escape");
    if (m.buttons[9]?.pressed && !boutonsPrecedents[i]?.[9]) liste.push("KeyP");
    precedentManette[i] = etat;
    boutonsPrecedents[i] = m.buttons.map((b) => b.pressed);
  }
  return liste;
}
const precedentManette: Commandes[] = [];
const boutonsPrecedents: boolean[][] = [];

export const TOUCHES_AFFICHEES = {
  solo: "Bouger ZQSD ou flèches · Sauter Z, ↑ ou Espace · Attaque J · Spécial K · Garde L ou Maj",
  j1: "ZQSD · F attaque · G spécial · H garde",
  j2: "Flèches · K attaque · L spécial · M garde (ou 1 2 3 du pavé)",
};
