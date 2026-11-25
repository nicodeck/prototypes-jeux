// Le clavier et la souris. On lit les touches par leur position physique (event.code) :
// ZQSD sur un clavier AZERTY et WASD sur un QWERTY sont les mêmes touches.

export class Entree {
  private readonly bas = new Set<string>();
  private readonly frappes = new Set<string>();
  sourisDx = 0;
  sourisDy = 0;
  molette = 0;
  boutonGauche = false;
  boutonDroit = false;
  clicGauche = false;
  verrouille = false;
  /** Temps depuis le dernier mouvement de souris (pour que la caméra se recale seule). */
  calmeSouris = 99;

  constructor(private readonly toile: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.bas.add(e.code);
      this.frappes.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.bas.delete(e.code));
    window.addEventListener("blur", () => {
      this.bas.clear();
      this.boutonDroit = this.boutonGauche = false;
    });
    toile.addEventListener("contextmenu", (e) => e.preventDefault());
    toile.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.boutonGauche = true;
        this.clicGauche = true;
      }
      if (e.button === 2) this.boutonDroit = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.boutonGauche = false;
      if (e.button === 2) this.boutonDroit = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (this.verrouille || this.boutonGauche) {
        this.sourisDx += e.movementX;
        this.sourisDy += e.movementY;
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) this.calmeSouris = 0;
      }
    });
    toile.addEventListener("wheel", (e) => {
      this.molette += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener("pointerlockchange", () => {
      this.verrouille = document.pointerLockElement === this.toile;
    });
  }

  verrouiller() {
    if (this.verrouille) return;
    try {
      const p = this.toile.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* le navigateur refuse : on joue sans verrouiller la souris */
    }
  }

  appuye(...codes: string[]) {
    return codes.some((c) => this.bas.has(c));
  }

  /** Vrai une seule fois par appui. */
  frappe(...codes: string[]) {
    return codes.some((c) => this.frappes.has(c));
  }

  /** Direction de marche demandée (x : droite, y : avant). */
  direction() {
    let x = 0;
    let y = 0;
    if (this.appuye("KeyW", "ArrowUp")) y += 1;
    if (this.appuye("KeyS", "ArrowDown")) y -= 1;
    if (this.appuye("KeyA", "ArrowLeft")) x -= 1;
    if (this.appuye("KeyD", "ArrowRight")) x += 1;
    return { x, y };
  }

  /** À appeler à la fin de chaque image. */
  finImage(dt: number) {
    this.frappes.clear();
    this.sourisDx = 0;
    this.sourisDy = 0;
    this.molette = 0;
    this.clicGauche = false;
    this.calmeSouris += dt;
  }

  /** Simule une touche (débogage, captures). */
  simuler(code: string, bas: boolean) {
    if (bas) {
      this.bas.add(code);
      this.frappes.add(code);
    } else this.bas.delete(code);
  }
}
