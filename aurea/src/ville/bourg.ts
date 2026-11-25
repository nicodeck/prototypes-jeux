// Le bourg de départ : un port au fond de la baie, une rue le long du port, le cardo qui monte
// vers le forum, le decumanus qui le croise, une dizaine de maisons de Liberti, une pêcherie et un
// bûcheron. Un vieil aqueduc descend des collines jusqu'au château d'eau, et un phare veille sur
// l'îlot à l'entrée de la baie.
//
// Le plan suit une grille romaine : les rues nord-sud tombent sur x = 57 + 9k, les rues est-ouest
// sur z = 88 - 5k. L'architecte (architecte.ts) prolonge cette grille.
import { hauteur, indice, TAILLE } from "./ile";
import { traceEnL } from "./routes";
import type { Ville } from "./ville";

export const GRILLE = { x0: 57, pasX: 9, z0: 88, pasZ: 5 };

export function estRueDeGrille(i: number, j: number) {
  return (((i - GRILLE.x0) % GRILLE.pasX) + GRILLE.pasX) % GRILLE.pasX === 0 || (((GRILLE.z0 - j) % GRILLE.pasZ) + GRILLE.pasZ) % GRILLE.pasZ === 0;
}

/** Le tracé de l'aqueduc : de la source dans les collines au château d'eau. */
const AQUEDUC = { source: { i: 39, j: 45 }, coude: { i: 39, j: 67 }, castellum: { i: 47, j: 67 } };

export function fonderBourg(v: Ville) {
  const route = (a: [number, number], b: [number, number]) => v.poserRoutes(traceEnL({ i: a[0], j: a[1] }, { i: b[0], j: b[1] }), true);

  // L'aqueduc et son château d'eau
  const cases = [...traceEnL(AQUEDUC.source, AQUEDUC.coude), ...traceEnL(AQUEDUC.coude, AQUEDUC.castellum).slice(1, -1)];
  const hDepart = hauteur(AQUEDUC.source.i + 0.5, AQUEDUC.source.j + 0.5) + 0.6;
  const c = AQUEDUC.castellum;
  const hFin = hauteur(c.i + 0.5, c.j + 0.5) + 3.2;
  cases.forEach((cs, n) => {
    const t = n / (cases.length - 1);
    const canal = hDepart + (hFin - hDepart) * t;
    const sol = hauteur(cs.i + 0.5, cs.j + 0.5);
    const precedent = cases[Math.max(0, n - 1)]!;
    const suivant = cases[Math.min(cases.length - 1, n + 1)]!;
    const axe = precedent.i !== suivant.i ? "x" : "z";
    v.decor.aqueduc.push({ i: cs.i, j: cs.j, hauteur: Math.max(0, canal - sol), axe });
    v.reserve[indice(cs.i, cs.j)] = 2;
    v.ile.arbres[indice(cs.i, cs.j)] = 0;
  });
  v.decor.castellum = { ...c };
  v.reserve[indice(c.i, c.j)] = 1;

  // Le phare, sur l'îlot à l'entrée de la baie, et le port
  v.poser("phare", 79, 116, 0, { gratuit: true, fini: true });
  v.poser("port", 54, 89, 0, { gratuit: true, fini: true });

  // Les rues
  route([48, 88], [81, 88]); // le long du port
  route([57, 87], [57, 70]); // le cardo
  route([44, 78], [70, 78]); // le decumanus
  route([64, 89], [64, 93]); // vers la pêcherie
  route([48, 79], [48, 87]); // la ruelle ouest
  route([47, 68], [56, 68]); // vers le château d'eau

  // Le forum, au croisement du cardo et du decumanus
  v.poser("forum", 58, 72, 0, { gratuit: true, fini: true });
  // Les maisons : au nord de la rue du port (façade au sud), au sud du decumanus (façade au nord)
  const maisons: [number, number, number][] = [
    [51, 86, 0],
    [53, 86, 0],
    [55, 86, 0],
    [58, 86, 0],
    [60, 86, 0],
    [53, 79, 2],
    [55, 79, 2],
    [58, 79, 2],
    [60, 79, 2],
  ];
  for (const [i, j, r] of maisons) {
    const b = v.poser("maison", i, j, r, { gratuit: true, fini: true });
    if (b) b.habitants = 5;
  }
  v.poser("peche", 62, 92, 0, { gratuit: true, fini: true });
  v.poser("bucheron", 80, 86, 0, { gratuit: true, fini: true });
}

/** Pour les tests : toutes les cases du bourg sont dans la carte */
export function dansLaCarte(i: number, j: number) {
  return i >= 0 && j >= 0 && i < TAILLE && j < TAILLE;
}
