// Le clavier et les manettes.
import { AUCUNE_COMMANDE, type Commandes } from "../course/course";

const TOUCHES = {
  gauche: ["KeyA", "ArrowLeft"],
  droite: ["KeyD", "ArrowRight"],
  accelerer: ["KeyW", "ArrowUp"],
  freiner: ["KeyS", "ArrowDown"],
  derive: ["Space", "ShiftLeft", "ShiftRight"],
  objet: ["KeyE", "KeyX", "KeyL"],
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

const tenue = (codes: string[]) => codes.some((c) => enfoncees.has(c) || fronts.has(c));

/** Les commandes du joueur : clavier et première manette. */
export function commandesJoueur(): Commandes {
  const c: Commandes = { ...AUCUNE_COMMANDE };
  c.direction = (tenue(TOUCHES.droite) ? 1 : 0) - (tenue(TOUCHES.gauche) ? 1 : 0);
  c.accelerer = tenue(TOUCHES.accelerer);
  c.freiner = tenue(TOUCHES.freiner);
  c.derive = tenue(TOUCHES.derive);
  c.objet = tenue(TOUCHES.objet);
  const m = manettes()[0];
  if (m) {
    const b = (i: number) => !!m.buttons[i]?.pressed;
    const ax = m.axes[0] ?? 0;
    if (Math.abs(ax) > 0.15) c.direction = Math.max(-1, Math.min(1, (ax - Math.sign(ax) * 0.15) / 0.75));
    if (b(14)) c.direction = -1;
    if (b(15)) c.direction = 1;
    c.accelerer ||= b(0) || b(7);
    c.freiner ||= b(1) || b(6);
    c.derive ||= b(4) || b(5);
    c.objet ||= b(2) || b(3);
  }
  return c;
}

/** À appeler après chaque image simulée. */
export function oublierFronts() {
  fronts.clear();
}

/** Les appuis depuis la dernière lecture (menus). */
export function appuis() {
  const liste = pressees.splice(0);
  for (const [i, m] of manettes().entries()) {
    const ax = m.axes[0] ?? 0;
    const ay = m.axes[1] ?? 0;
    const etat = [ax < -0.5 || !!m.buttons[14]?.pressed, ax > 0.5 || !!m.buttons[15]?.pressed, ay < -0.5 || !!m.buttons[12]?.pressed, ay > 0.5 || !!m.buttons[13]?.pressed];
    const avant = precedent[i] ?? [false, false, false, false];
    const noms = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    etat.forEach((e, k) => {
      if (e && !avant[k]) liste.push(noms[k]);
    });
    precedent[i] = etat;
    const boutons = m.buttons.map((b) => b.pressed);
    const avantB = boutonsPrecedents[i] ?? [];
    if (boutons[0] && !avantB[0]) liste.push("Enter");
    if (boutons[1] && !avantB[1]) liste.push("Escape");
    if (boutons[9] && !avantB[9]) liste.push("KeyP");
    boutonsPrecedents[i] = boutons;
  }
  return liste;
}
const precedent: boolean[][] = [];
const boutonsPrecedents: boolean[][] = [];

export const TOUCHES_AFFICHEES =
  "Accélérer ↑ ou Z · Freiner ↓ ou S · Tourner ← → ou Q D · Sauter et déraper Espace ou Maj · Objet E";
