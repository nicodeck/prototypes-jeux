// Le clavier. On lit e.code (position physique) : ZQSD en AZERTY = WASD en QWERTY.

const GAUCHE = ["ArrowLeft", "KeyA"];
const DROITE = ["ArrowRight", "KeyD"];
const HISSER = ["ArrowUp", "KeyW"];
const AFFALER = ["ArrowDown", "KeyS"];

export class Entrees {
  private enfoncees = new Set<string>();
  private appuis: string[] = [];

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.enfoncees.add(e.code);
      this.appuis.push(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.enfoncees.delete(e.code));
    window.addEventListener("blur", () => this.enfoncees.clear());
  }

  private une(codes: string[]) {
    return codes.some((c) => this.enfoncees.has(c));
  }

  get barre() {
    return (this.une(DROITE) ? 1 : 0) - (this.une(GAUCHE) ? 1 : 0);
  }

  get voile() {
    return (this.une(HISSER) ? 1 : 0) - (this.une(AFFALER) ? 1 : 0);
  }

  /** Touches pressées depuis le dernier appel. */
  sortirAppuis() {
    const a = this.appuis;
    this.appuis = [];
    return a;
  }

  /** Simule une touche (debug et tests). */
  presser(code: string, bas: boolean) {
    if (bas) {
      this.enfoncees.add(code);
      this.appuis.push(code);
    } else this.enfoncees.delete(code);
  }
}
