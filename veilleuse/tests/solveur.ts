// Le solveur : explore la mine avec la vraie physique du jeu pour savoir ce qui est atteignable.
//
// Il part de chaque endroit « stable » (debout, accroché à une paroi, ou flottant à la surface de
// l'eau), essaie une série de gestes (marcher, sauter plus ou moins longtemps, lâcher ou inverser
// en l'air, sauter d'une paroi, plonger, nager…) et simule chaque geste image par image jusqu'au
// prochain endroit stable. Il retient aussi le graphe des passages, pour vérifier qu'on ne peut
// jamais rester coincé : depuis n'importe quel endroit atteint, le Cœur doit rester atteignable.
import { AUCUNE_COMMANDE, copierMonde, creerMonde, etape, type Commandes, type Monde } from "../src/monde/monde";
import { CASE, type Mine } from "../src/monde/mine";

type Sorte = "sol" | "mur" | "eau";
type Geste = { nom: string; pour: Sorte[]; commandes: (i: number, m: Monde, depart: Monde) => Commandes | null };

function sorte(m: Monde): Sorte | null {
  const h = m.heros;
  if (h.dansEau && h.surface && Math.abs(h.vy) < 0.35 && !h.auSol) return "eau";
  if (h.auSol) return "sol";
  if (h.mur !== 0 && h.tempsMur === 2) return "mur";
  return null;
}

const C = (dir: number, saut = false, bas = false): Commandes => ({ gauche: dir < 0, droite: dir > 0, saut, bas });

function gestes(): Geste[] {
  const liste: Geste[] = [];
  // Au sol
  for (const dir of [-1, 1]) {
    liste.push({ nom: `marcher ${dir}`, pour: ["sol"], commandes: (i) => (i < 50 ? C(dir) : null) });
    liste.push({ nom: `descendre ${dir}`, pour: ["sol"], commandes: (i) => (i < 12 ? C(i < 4 ? 0 : dir, false, true) : i < 40 ? C(dir) : null) });
  }
  liste.push({ nom: `descendre`, pour: ["sol"], commandes: (i) => (i < 12 ? C(0, false, true) : null) });
  for (const dir of [-1, 0, 1]) {
    for (const elan of dir ? [0, 14] : [0]) {
      for (const maintien of [4, 10, 40]) {
        for (const air of dir ? ["tenir", "lacher", "inverser", "tard"] : ["tenir", "gauche", "droite"]) {
          liste.push({
            nom: `sauter ${dir} élan ${elan} maintien ${maintien} ${air}`,
            pour: ["sol", "eau"],
            commandes: (i) => {
              if (i > 200) return null;
              let d = dir;
              const enLAir = i - elan;
              if (air === "lacher" && enLAir > 12) d = 0;
              if (air === "inverser" && enLAir > 14) d = -dir;
              if (air === "tard" && enLAir < 16) d = 0;
              if (air === "gauche" && enLAir > 8) d = -1;
              if (air === "droite" && enLAir > 8) d = 1;
              return C(d, i >= elan && i < elan + maintien);
            },
          });
        }
      }
    }
  }
  // Contre une paroi : sauter (en revenant vers elle, en s'éloignant, ou sans rien), glisser, lâcher
  for (const retour of ["vers", "loin", "rien"]) {
    for (const maintien of [8, 30]) {
      for (const attente of [0, 20]) {
        liste.push({
          nom: `saut mural ${retour} ${maintien} après ${attente}`,
          pour: ["mur"],
          commandes: (i, _m, depart) => {
            if (i > 200) return null;
            const cote = depart.heros.mur;
            if (i < attente) return C(cote);
            const d = retour === "vers" ? cote : retour === "loin" ? -cote : 0;
            return C(i - attente > 10 ? d : 0, i - attente < maintien);
          },
        });
      }
    }
  }
  liste.push({ nom: "lâcher la paroi", pour: ["mur"], commandes: (i, _m, depart) => (i < 6 ? C(-depart.heros.mur) : null) });
  liste.push({ nom: "glisser", pour: ["mur"], commandes: (i, _m, depart) => (i < 200 ? C(depart.heros.mur) : null) });
  // Dans l'eau : nager le long de la surface, plonger puis remonter
  for (const dir of [-1, 1]) {
    liste.push({ nom: `nager ${dir}`, pour: ["eau"], commandes: (i) => (i < 40 ? C(dir) : null) });
    for (const fond of [30, 70]) {
      for (const duree of [60, 140]) {
        liste.push({
          nom: `plonger ${dir} ${fond} ${duree}`,
          pour: ["eau"],
          commandes: (i) => (i < fond ? C(dir, false, true) : i < fond + duree ? C(dir, i % 14 === 0) : null),
        });
      }
    }
  }
  return liste;
}

function cle(m: Monde) {
  const h = m.heros;
  const s = sorte(m)!;
  return `${h.x >> 3},${h.y >> 2},${s},${s === "mur" ? h.mur : ""}`;
}

export type Resultat = {
  /** Le Cœur est atteint depuis le départ */
  coeur: boolean;
  lanternes: Set<number>;
  /** Cases où Veilleuse a pu se tenir */
  positions: Set<string>;
  /** Endroits atteints d'où le Cœur n'est plus atteignable */
  coinces: { x: number; y: number }[];
  noeuds: number;
};

export function explorer(mine: Mine, limite = 60000): Resultat {
  const depart = creerMonde(mine);
  for (let i = 0; i < 10; i++) etape(depart, AUCUNE_COMMANDE);
  const liste = gestes();
  const etats = new Map<string, Monde>([[cle(depart), depart]]);
  const suivants = new Map<string, Set<string>>();
  const versCoeur = new Set<string>();
  const file = [cle(depart)];
  const lanternes = new Set<number>();
  const positions = new Set<string>();

  while (file.length && etats.size < limite) {
    const k = file.shift()!;
    const etat = etats.get(k)!;
    const s = sorte(etat)!;
    const succ = new Set<string>();
    suivants.set(k, succ);
    positions.add(`${Math.floor((etat.heros.x + 5) / CASE)},${Math.floor((etat.heros.y + 12) / CASE)}`);
    for (const geste of liste) {
      if (!geste.pour.includes(s)) continue;
      const m = copierMonde(etat);
      let quitte = false;
      let fin = false;
      for (let i = 0; i < 400; i++) {
        const c = geste.commandes(i, m, etat);
        etape(m, c ?? AUCUNE_COMMANDE);
        for (const e of m.evenements) if (e.sorte === "lanterne") lanternes.add(e.numero);
        if (m.fini) {
          versCoeur.add(k);
          fin = true;
          break;
        }
        const stable = sorte(m) !== null;
        if (!stable) quitte = true;
        if (stable && (quitte || c === null)) break;
      }
      if (fin || sorte(m) === null) continue;
      const k2 = cle(m);
      if (k2 === k) continue;
      succ.add(k2);
      if (!etats.has(k2)) {
        etats.set(k2, m);
        file.push(k2);
      }
    }
  }

  // Remonte le graphe depuis les endroits d'où l'on atteint le Cœur
  const precedents = new Map<string, string[]>();
  for (const [a, bs] of suivants) for (const b of bs) precedents.set(b, [...(precedents.get(b) ?? []), a]);
  const bons = new Set(versCoeur);
  const pile = [...versCoeur];
  while (pile.length) {
    const b = pile.pop()!;
    for (const a of precedents.get(b) ?? []) {
      if (!bons.has(a)) {
        bons.add(a);
        pile.push(a);
      }
    }
  }
  const coinces: { x: number; y: number }[] = [];
  for (const k of suivants.keys()) {
    if (!bons.has(k)) coinces.push({ x: etats.get(k)!.heros.x, y: etats.get(k)!.heros.y });
  }
  return { coeur: versCoeur.size > 0, lanternes, positions, coinces, noeuds: etats.size };
}

/** La mine en texte, avec les endroits atteints marqués d'un point, pour comprendre un échec. */
export function dessinerAtteint(mine: Mine, r: Resultat, marques: { x: number; y: number }[] = []) {
  const lignes: string[] = [];
  const coinces = new Set(marques.map((p) => `${Math.floor((p.x + 5) / CASE)},${Math.floor((p.y + 12) / CASE)}`));
  for (let y = 0; y < mine.hauteur; y++) {
    let l = "";
    for (let x = 0; x < mine.largeur; x++) {
      const i = y * mine.largeur + x;
      const ch = mine.cases[i] === 1 ? "#" : mine.cases[i] === 2 ? "=" : mine.eau[i] ? "~" : " ";
      l += coinces.has(`${x},${y}`) ? "X" : r.positions.has(`${x},${y}`) ? "·" : ch;
    }
    lignes.push(l);
  }
  return lignes.join("\n");
}
