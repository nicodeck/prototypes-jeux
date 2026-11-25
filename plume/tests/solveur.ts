// Le solveur : explore le niveau avec la vraie physique du jeu pour savoir ce qui est atteignable.
//
// Depuis chaque endroit où le héros tient debout, il essaie une série de gestes (marcher, courir,
// sauter plus ou moins longtemps, lâcher ou inverser la direction en l'air, attendre…) et simule
// chaque geste image par image jusqu'à ce que le héros se repose quelque part. Les ennemis sont
// retirés : on vérifie le terrain, pas l'adresse du joueur face aux ennemis.
import { AUCUNE_COMMANDE, PERIODE_PLATEFORME, copierMonde, creerMonde, etape, type Commandes, type Monde } from "../src/monde/monde";
import type { NiveauLu } from "../src/monde/niveau";

type Geste = { nom: string; commandes: (image: number, decolle: number | null) => Commandes | null };

function gestes(plume: boolean): Geste[] {
  const liste: Geste[] = [];
  for (const attente of [30, 75]) {
    liste.push({ nom: `attendre ${attente}`, commandes: (i) => (i < attente ? AUCUNE_COMMANDE : null) });
  }
  for (const dir of [-1, 0, 1]) {
    for (const course of dir ? [false, true] : [false]) {
      for (const elan of dir ? [0, 20] : [0]) {
        const base: Commandes = { ...AUCUNE_COMMANDE, gauche: dir < 0, droite: dir > 0, course };
        // Marcher jusqu'à tomber d'un bord (ou s'arrêter un peu plus loin)
        if (dir) liste.push({ nom: `marcher ${dir} ${course}`, commandes: (i, d) => (d === null && i > 40 ? null : base) });
        for (const maintien of [5, 12, 40, 120]) {
          for (const air of dir ? ["tenir", "lacher", "inverser"] : ["tenir"]) {
            for (const second of plume ? [null, 10, 22] : [null]) {
              liste.push({
                nom: `dir ${dir} course ${course} élan ${elan} saut ${maintien} air ${air} double ${second}`,
                commandes: (i, d) => {
                  const enLAir = d !== null ? i - d : -1;
                  const c = { ...base, saut: i >= elan && i < elan + maintien };
                  if (second !== null && enLAir === second - 1) c.saut = false;
                  else if (second !== null && enLAir >= second && enLAir < second + 30) c.saut = true;
                  if (air === "lacher" && enLAir > 12) c.gauche = c.droite = false;
                  if (air === "inverser" && enLAir > 14) {
                    c.gauche = dir > 0;
                    c.droite = dir < 0;
                  }
                  return c;
                },
              });
            }
          }
        }
      }
    }
  }
  return liste;
}

function cle(m: Monde) {
  const h = m.heros;
  let phase = "";
  const proche = m.plateformes.some((p) => p.sorte !== "nuage" && Math.abs(p.x - h.x) < 12 * 16);
  if (proche) phase = String(Math.floor((m.temps % PERIODE_PLATEFORME) / 20));
  // Les briques cassées tout près comptent : casser une brique ouvre parfois un passage
  let casse = 0;
  const colonne = Math.floor(h.x / 16);
  for (let i = 0; i < m.cases.length && !casse; i++) {
    if (m.cases[i] === 0 && m.niveau.cases[i] !== 0 && Math.abs((i % m.niveau.largeur) - colonne) < 6) casse = 1;
  }
  return `${h.x >> 3},${h.y},${phase},${casse},${h.plume}`;
}

export type Resultat = { arrivee: boolean; ramasses: Set<string>; positions: Set<string>; noeuds: number };

export function explorer(niveau: NiveauLu, options: { plume?: boolean; limite?: number } = {}): Resultat {
  const depart = creerMonde(niveau);
  depart.ennemis = [];
  depart.heros.plume = !!options.plume;
  for (let i = 0; i < 5; i++) etape(depart, AUCUNE_COMMANDE); // se poser

  const liste = gestes(!!options.plume);
  const vus = new Set<string>([cle(depart)]);
  const file: Monde[] = [depart];
  const ramasses = new Set<string>();
  const positions = new Set<string>();
  let arrivee = false;
  let noeuds = 0;

  while (file.length && noeuds < (options.limite ?? 20000)) {
    const etat = file.shift()!;
    noeuds++;
    positions.add(`${Math.floor((etat.heros.x + 5) / 16)},${Math.floor((etat.heros.y + 12) / 16)}`);
    for (const geste of liste) {
      const m = copierMonde(etat);
      let decolle: number | null = null;
      let rate = false;
      for (let i = 0; i < 260; i++) {
        const c = geste.commandes(i, decolle);
        if (!c) break;
        etape(m, c);
        // Sans plume : même si on attrape la plume en chemin, on fait comme si on l'avait perdue
        if (!options.plume) m.heros.plume = false;
        if (m.evenements.some((e) => e.sorte === "mort" || e.sorte === "perdPlume")) {
          rate = true;
          break;
        }
        if (m.gagne) {
          arrivee = true;
          rate = true;
          break;
        }
        if (decolle === null && !m.heros.auSol) decolle = i;
        if (decolle !== null && m.heros.auSol) break;
      }
      for (const id of m.definitif) ramasses.add(id);
      if (rate || !m.heros.auSol) continue;
      const k = cle(m);
      if (vus.has(k)) continue;
      vus.add(k);
      file.push(m);
    }
  }
  return { arrivee, ramasses, positions, noeuds };
}
