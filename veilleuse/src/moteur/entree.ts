// Le clavier et la manette, lus à chaque image.
import type { Commandes } from "../monde/monde";

const TOUCHES: Record<keyof Commandes, string[]> = {
  gauche: ["ArrowLeft", "KeyA", "KeyQ"],
  droite: ["ArrowRight", "KeyD"],
  bas: ["ArrowDown", "KeyS"],
  saut: ["Space", "ArrowUp", "KeyW", "KeyZ", "KeyK", "KeyC"],
};

const enfoncees = new Set<string>();
const pressees = new Set<string>();
let manettePressee = false;
let boutonsAvant: boolean[] = [];

export function ecouterClavier(surAppui: () => void) {
  window.addEventListener("keydown", (e) => {
    if (!enfoncees.has(e.code)) pressees.add(e.code);
    enfoncees.add(e.code);
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    surAppui();
  });
  window.addEventListener("keyup", (e) => enfoncees.delete(e.code));
  window.addEventListener("blur", () => enfoncees.clear());
  window.addEventListener("pointerdown", surAppui);
}

function manette() {
  return navigator.getGamepads?.().find((m) => m) ?? null;
}

export function lireCommandes(): Commandes {
  const m = manette();
  const axe = m?.axes[0] ?? 0;
  const bouton = (i: number) => !!m?.buttons[i]?.pressed;
  const touche = (nom: keyof Commandes) => TOUCHES[nom].some((t) => enfoncees.has(t));
  const boutons = m ? m.buttons.map((b) => b.pressed) : [];
  manettePressee = boutons.some((b, i) => b && !boutonsAvant[i]);
  boutonsAvant = boutons;
  return {
    gauche: touche("gauche") || axe < -0.4 || bouton(14),
    droite: touche("droite") || axe > 0.4 || bouton(15),
    bas: touche("bas") || (m?.axes[1] ?? 0) > 0.6 || bouton(13),
    saut: touche("saut") || bouton(0),
  };
}

/** Une de ces touches vient-elle d'être appuyée depuis la dernière lecture ? */
export function vientDAppuyer(...codes: string[]) {
  return codes.some((c) => pressees.has(c));
}

/** N'importe quelle touche ou bouton vient-il d'être appuyé ? */
export function unAppui() {
  return pressees.size > 0 || manettePressee;
}

export function oublierAppuis() {
  pressees.clear();
}
