// Le maillage géodésique de la planète : un icosaèdre subdivisé, ses sommets (directions unitaires),
// ses triangles, et pour chaque sommet la liste de ses voisins et de ses triangles.

export class Sphere {
  readonly n: number;
  /** Direction unitaire de chaque sommet (x, y, z à la suite). */
  readonly dir: Float32Array;
  readonly triangles: Uint32Array;
  /** Voisins du sommet i : voisins[voisinsDebut[i] .. voisinsDebut[i+1]-1]. */
  readonly voisinsDebut: Int32Array;
  readonly voisins: Int32Array;
  /** Triangles qui touchent le sommet i, rangés de la même façon. */
  readonly trisDebut: Int32Array;
  readonly tris: Int32Array;
  /** Angle moyen entre deux sommets voisins (en radians). */
  readonly pas: number;
  private readonly marque: Int32Array;
  private generation = 1;

  constructor(finesse: number) {
    const t = (1 + Math.sqrt(5)) / 2;
    const pts: number[] = [
      -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
      0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
      t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1,
    ];
    for (let i = 0; i < 12; i++) {
      const l = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      pts[i * 3] /= l;
      pts[i * 3 + 1] /= l;
      pts[i * 3 + 2] /= l;
    }
    let faces: number[] = [
      0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
      1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
      3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
      4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
    ];
    for (let niveau = 0; niveau < finesse; niveau++) {
      const milieux = new Map<number, number>();
      const milieu = (a: number, b: number) => {
        const cle = a < b ? a * 1e6 + b : b * 1e6 + a;
        const deja = milieux.get(cle);
        if (deja !== undefined) return deja;
        let x = pts[a * 3] + pts[b * 3];
        let y = pts[a * 3 + 1] + pts[b * 3 + 1];
        let z = pts[a * 3 + 2] + pts[b * 3 + 2];
        const l = Math.hypot(x, y, z);
        x /= l;
        y /= l;
        z /= l;
        const i = pts.length / 3;
        pts.push(x, y, z);
        milieux.set(cle, i);
        return i;
      };
      const suivantes: number[] = [];
      for (let f = 0; f < faces.length; f += 3) {
        const a = faces[f], b = faces[f + 1], c = faces[f + 2];
        const ab = milieu(a, b), bc = milieu(b, c), ca = milieu(c, a);
        suivantes.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      }
      faces = suivantes;
    }
    this.n = pts.length / 3;
    this.dir = new Float32Array(pts);
    this.triangles = new Uint32Array(faces);

    // Voisins et triangles de chaque sommet
    const ens: Set<number>[] = Array.from({ length: this.n }, () => new Set<number>());
    const triParSommet: number[][] = Array.from({ length: this.n }, () => []);
    for (let f = 0; f < faces.length; f += 3) {
      const a = faces[f], b = faces[f + 1], c = faces[f + 2];
      ens[a].add(b).add(c);
      ens[b].add(a).add(c);
      ens[c].add(a).add(b);
      triParSommet[a].push(f / 3);
      triParSommet[b].push(f / 3);
      triParSommet[c].push(f / 3);
    }
    this.voisinsDebut = new Int32Array(this.n + 1);
    this.trisDebut = new Int32Array(this.n + 1);
    let total = 0;
    let totalT = 0;
    for (let i = 0; i < this.n; i++) {
      this.voisinsDebut[i] = total;
      this.trisDebut[i] = totalT;
      total += ens[i].size;
      totalT += triParSommet[i].length;
    }
    this.voisinsDebut[this.n] = total;
    this.trisDebut[this.n] = totalT;
    this.voisins = new Int32Array(total);
    this.tris = new Int32Array(totalT);
    for (let i = 0; i < this.n; i++) {
      let k = this.voisinsDebut[i];
      for (const v of ens[i]) this.voisins[k++] = v;
      let m = this.trisDebut[i];
      for (const tr of triParSommet[i]) this.tris[m++] = tr;
    }
    // Angle moyen entre voisins
    let somme = 0;
    let compte = 0;
    for (let i = 0; i < this.n; i += 97) {
      for (let k = this.voisinsDebut[i]; k < this.voisinsDebut[i + 1]; k++) {
        somme += Math.acos(Math.min(1, this.produit(i, this.voisins[k])));
        compte++;
      }
    }
    this.pas = somme / compte;
    this.marque = new Int32Array(this.n);
  }

  produit(a: number, b: number) {
    const d = this.dir;
    return d[a * 3] * d[b * 3] + d[a * 3 + 1] * d[b * 3 + 1] + d[a * 3 + 2] * d[b * 3 + 2];
  }

  /** Le sommet le plus proche d'une direction (pas forcément unitaire). Partir d'un sommet proche accélère la recherche. */
  plusProche(x: number, y: number, z: number, depart = -1) {
    const d = this.dir;
    let cur = depart;
    if (cur < 0 || cur >= this.n) {
      let meilleur = -Infinity;
      for (let i = 0; i < 12; i++) {
        const p = d[i * 3] * x + d[i * 3 + 1] * y + d[i * 3 + 2] * z;
        if (p > meilleur) {
          meilleur = p;
          cur = i;
        }
      }
    }
    let p0 = d[cur * 3] * x + d[cur * 3 + 1] * y + d[cur * 3 + 2] * z;
    for (;;) {
      let mieux = cur;
      for (let k = this.voisinsDebut[cur]; k < this.voisinsDebut[cur + 1]; k++) {
        const v = this.voisins[k];
        const p = d[v * 3] * x + d[v * 3 + 1] * y + d[v * 3 + 2] * z;
        if (p > p0) {
          p0 = p;
          mieux = v;
        }
      }
      if (mieux === cur) return cur;
      cur = mieux;
    }
  }

  /**
   * Les sommets à moins d'un angle donné d'un sommet de départ (parcours en largeur).
   * Appelle `f(sommet, cosinus)` pour chacun.
   */
  autour(centre: number, angle: number, f: (i: number, cos: number) => void) {
    const cosMin = Math.cos(angle);
    const gen = ++this.generation;
    const file: number[] = [centre];
    this.marque[centre] = gen;
    const d = this.dir;
    const cx = d[centre * 3], cy = d[centre * 3 + 1], cz = d[centre * 3 + 2];
    for (let q = 0; q < file.length; q++) {
      const i = file[q];
      const c = d[i * 3] * cx + d[i * 3 + 1] * cy + d[i * 3 + 2] * cz;
      f(i, c);
      for (let k = this.voisinsDebut[i]; k < this.voisinsDebut[i + 1]; k++) {
        const v = this.voisins[k];
        if (this.marque[v] === gen) continue;
        this.marque[v] = gen;
        const cv = d[v * 3] * cx + d[v * 3 + 1] * cy + d[v * 3 + 2] * cz;
        if (cv >= cosMin) file.push(v);
      }
    }
  }
}
