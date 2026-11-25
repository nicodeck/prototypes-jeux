// Clavier et toucher. Chaque appui est daté au moment où il arrive, pour le jugement.

import type { Action } from "./reglages";

export type Commande = Action | "valider" | "retour" | "calibrer" | "plus" | "moins";

const TOUCHES: Record<string, Commande[]> = {
  Space: ["saut", "valider"],
  ArrowUp: ["saut"],
  KeyW: ["saut"],
  KeyX: ["frappe"],
  KeyJ: ["frappe"],
  KeyK: ["frappe"],
  ArrowRight: ["frappe", "plus"],
  KeyD: ["frappe"],
  ArrowDown: ["glisse"],
  KeyS: ["glisse"],
  ArrowLeft: ["moins"],
  Enter: ["valider"],
  Escape: ["retour"],
  KeyP: ["retour"],
  KeyC: ["calibrer"],
};

export function ecouterEntrees(canvas: HTMLCanvasElement, rappel: (c: Commande[], perf: number) => void) {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const c = TOUCHES[e.code];
    if (!c) return;
    e.preventDefault();
    rappel(c, e.timeStamp || performance.now());
  });

  // Au doigt : moitié gauche haut = sauter, moitié gauche bas = glisser, moitié droite = frapper.
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const action: Action = x > 0.5 ? "frappe" : y < 0.6 ? "saut" : "glisse";
    rappel([action, "valider"], e.timeStamp || performance.now());
  });
}
