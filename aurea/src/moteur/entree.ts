// Le clavier et la souris. On lit les touches par leur position physique (event.code) : ZQSD
// sur un clavier français, WASD sur un clavier anglais, c'est la même place.
const enfoncees = new Set<string>();
const appuis = new Set<string>();

export const souris = {
  x: 0,
  y: 0,
  /** Coordonnées normalisées (-1..1), y vers le haut */
  nx: 0,
  ny: 0,
  gauche: false,
  droite: false,
  milieu: false,
  /** Déplacement depuis la dernière image */
  dx: 0,
  dy: 0,
  molette: 0,
  /** La souris est sur l'interface (pas sur la scène) */
  surInterface: false,
  /** Un clic gauche vient d'être fait (appui et relâche sans trop bouger) */
  clic: false,
  appui: false,
  relache: false,
  glisse: 0,
};

export function ecouter(toile: HTMLCanvasElement, auPremierGeste: () => void) {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    enfoncees.add(e.code);
    appuis.add(e.code);
    auPremierGeste();
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => enfoncees.delete(e.code));
  window.addEventListener("blur", () => enfoncees.clear());
  window.addEventListener("mousemove", (e) => {
    souris.dx += e.clientX - souris.x;
    souris.dy += e.clientY - souris.y;
    if (souris.gauche || souris.droite || souris.milieu) souris.glisse += Math.abs(e.movementX) + Math.abs(e.movementY);
    souris.x = e.clientX;
    souris.y = e.clientY;
    souris.nx = (e.clientX / innerWidth) * 2 - 1;
    souris.ny = -(e.clientY / innerHeight) * 2 + 1;
    souris.surInterface = e.target !== toile;
  });
  toile.addEventListener("mousedown", (e) => {
    auPremierGeste();
    souris.glisse = 0;
    if (e.button === 0) {
      souris.gauche = true;
      souris.appui = true;
    }
    if (e.button === 1) {
      souris.milieu = true;
      e.preventDefault();
    }
    if (e.button === 2) souris.droite = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0 && souris.gauche) {
      souris.gauche = false;
      souris.relache = true;
      if (souris.glisse < 6) souris.clic = true;
    }
    if (e.button === 1) souris.milieu = false;
    if (e.button === 2) souris.droite = false;
  });
  toile.addEventListener("contextmenu", (e) => e.preventDefault());
  toile.addEventListener(
    "wheel",
    (e) => {
      souris.molette += e.deltaY * (e.deltaMode === 1 ? 30 : 1);
      e.preventDefault();
    },
    { passive: false },
  );
}

export const enfoncee = (...codes: string[]) => codes.some((c) => enfoncees.has(c));
export const vientDAppuyer = (...codes: string[]) => codes.some((c) => appuis.has(c));

/** À appeler à la fin de chaque image */
export function oublier() {
  appuis.clear();
  souris.dx = 0;
  souris.dy = 0;
  souris.molette = 0;
  souris.clic = false;
  souris.appui = false;
  souris.relache = false;
}
