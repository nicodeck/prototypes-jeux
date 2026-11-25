// La partition : la musique et le niveau sortent de la même source.
// Chaque mesure porte un accord, un style de batterie et une ligne d'obstacles écrite en croches
// ("S" sauter, "F" frapper, "G" glisser, "." rien). Les obstacles sont donc posés exactement
// sur des temps de la musique, et le son de chaque geste réussi fait partie du morceau.

import type { Action } from "./reglages";
import { hasard } from "./outils";

export type Couche = "base" | "rythme" | "arpege" | "melodie" | "eclat";
export const COUCHES: Couche[] = ["base", "rythme", "arpege", "melodie", "eclat"];

export type Style = "eveil" | "sousbois" | "marais" | "canopee" | "coeur" | "final";

export type Instrument =
  | "grosse"
  | "caisse"
  | "claque"
  | "charley"
  | "charleyOuvert"
  | "shaker"
  | "tom"
  | "basse"
  | "nappe"
  | "arpege"
  | "cloche"
  | "flute"
  | "souffle"
  | "impact"
  | "choeur";

export interface Note {
  /** Instant en secondes depuis le début du morceau. */
  t: number;
  /** Position en temps (noires) depuis le début du morceau. */
  temps: number;
  instr: Instrument;
  couche: Couche;
  vel: number;
  midi?: number;
  accord?: number[];
  /** Durée en secondes. */
  duree?: number;
  /** Index de la section (pour les timbres qui changent). */
  section: number;
}

export interface Obstacle {
  id: number;
  action: Action;
  temps: number;
  t: number;
  mesure: number;
  /** Position dans la mesure, en croches (0 à 7). */
  pas: number;
  section: number;
  /** Note jouée si le geste est réussi. */
  midi: number;
  accord: number[];
}

interface MesureDef {
  accord: string;
  obstacles?: string;
  texte?: string;
  remplissage?: boolean;
  style?: Style;
}

export interface SectionDef {
  nom: string;
  bpm: number;
  style: Style;
  /** Tonique (classe de hauteur, 0 = do) et gamme utilisée pour la mélodie. */
  tonique: number;
  gamme: number[];
  /** Couches toujours ouvertes dans cette section, même sans élan. */
  elanMin: number;
  mesures: MesureDef[];
}

export interface Mesure {
  index: number;
  section: number;
  debutTemps: number;
  debutS: number;
  bpm: number;
  racine: number;
  accord: number[];
  style: Style;
  remplissage: boolean;
  texte?: string;
}

export interface Panneau {
  temps: number;
  texte: string;
}

const MINEUR = [0, 2, 3, 5, 7, 8, 10];
const TEMPS_PAR_MESURE = 4;

/** Écrit une suite de mesures : accords qui tournent, lignes d'obstacles données une par une. */
function mesures(accords: string[], lignes: (string | Omit<MesureDef, "accord">)[]): MesureDef[] {
  return lignes.map((l, i) => {
    const accord = accords[i % accords.length];
    return typeof l === "string" ? { accord, obstacles: l } : { ...l, accord };
  });
}

export const SECTIONS: SectionDef[] = [
  {
    nom: "Sous-bois",
    bpm: 100,
    style: "sousbois",
    tonique: 9,
    gamme: MINEUR,
    elanMin: 0,
    mesures: mesures(
      ["Am", "F", "C", "G"],
      [
        { style: "eveil", obstacles: "........" },
        { style: "eveil", obstacles: "........" },
        { style: "eveil", obstacles: "........" },
        { style: "eveil", obstacles: "........", texte: "ESPACE  ·  sauter" },
        "S.......",
        "S...S...",
        "S...S...",
        { obstacles: "S.......", texte: "X  ·  frapper" },
        "....F...",
        "....F...",
        "S...F...",
        { obstacles: "S...F...", texte: "↓  ·  glisser" },
        "G.......",
        "G...F...",
        "S...G...",
        "S...FS..",
        "G...F...",
        "S...FS..",
        "G...F.G.",
        "S.S.F...",
        "G...F...",
        "S...FS..",
        "G.G.F...",
        "S...F.S.",
        "G...FS..",
        "S.S.F.F.",
        "G...F...",
        { obstacles: "S...S...", remplissage: true },
      ],
    ),
  },
  {
    nom: "Marais des spores",
    bpm: 112,
    style: "marais",
    tonique: 0,
    gamme: MINEUR,
    elanMin: 1,
    mesures: mesures(
      ["Cm", "Ab", "Eb", "Bb"],
      [
        "........",
        "S...S...",
        "S.F.S.F.",
        "G...G...",
        "S.F.G...",
        "S.F.S.F.",
        "G.F.G.F.",
        "S.S.S.F.",
        "..F...F.",
        "S.F.G.F.",
        "S...S.F.",
        "G.F.S.SF",
        "S.F.S.F.",
        "G...G.F.",
        "S.S.G.F.",
        "S.F.SSF.",
        "G.F.G.F.",
        "S.F.S.F.",
        "G.G.S.F.",
        "S.FSS.F.",
        "G.F.G.F.",
        "S.S.S.F.",
        "G.F.SSF.",
        { obstacles: "S...S...", remplissage: true },
      ],
    ),
  },
  {
    nom: "Canopée",
    bpm: 124,
    style: "canopee",
    tonique: 4,
    gamme: MINEUR,
    elanMin: 1,
    mesures: mesures(
      ["Em", "C", "G", "D"],
      [
        "........",
        "S..S....",
        "S..S.F..",
        "..F...F.",
        "S..S.F..",
        "G...G.F.",
        "S..S.F..",
        "G.F.G.F.",
        "S..S.F.S",
        "..F.G.F.",
        "S..S.F..",
        "G.F...F.",
        "S..S.F.S",
        "G.F.G...",
        "S.FS.F..",
        "G.F.G.F.",
        "S..S.F..",
        "..F.G.F.",
        "S..S.FS.",
        "G.F.G.F.",
        "S.FS.F..",
        "G.F.S.F.",
        "S..S.FS.",
        "G.F.G.F.",
        "S.FS.F.S",
        "G.G.F.F.",
        "S..S.F..",
        { obstacles: "S...S...", remplissage: true },
      ],
    ),
  },
  {
    nom: "Le Cœur",
    bpm: 132,
    style: "coeur",
    tonique: 9,
    gamme: MINEUR,
    elanMin: 2,
    mesures: [
      ...mesures(
        ["F", "G", "Am", "Am", "F", "G", "C", "E"],
        [
          "........",
          "S...S...",
          "S.F.S.F.",
          "G.F.G.F.",
          "S.F.S.F.",
          "G.F.S.F.",
          "S.S.S.F.",
          "G.F.G.FF",
          "S.F.S.F.",
          "G.F.S.SF",
          "S.F.G.F.",
          "S.FSS.F.",
          "G.F.G.F.",
          "S.S.G.F.",
          "S.F.S.FS",
          "G.F.G.F.",
          "S.F.S.F.",
          "G.G.S.F.",
          "S.FSS.F.",
          "G.F.G.F.",
          "S.S.S.F.",
          "G.F.SSF.",
          "S.F.S.F.",
          "F.F.F.F.",
        ],
      ),
      { accord: "Am", style: "final", obstacles: "........" },
      { accord: "Am", style: "final", obstacles: "........" },
    ],
  },
];

/** Accord écrit ("Am", "Bb", "E") : racine de basse (vers la1–sol#2) et intervalles. */
export function lireAccord(nom: string): { racine: number; intervalles: number[] } {
  const lettres: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = lettres[nom[0]];
  let i = 1;
  if (nom[i] === "b") (pc = (pc + 11) % 12), i++;
  else if (nom[i] === "#") (pc = (pc + 1) % 12), i++;
  const mineur = nom[i] === "m";
  let racine = 36 + pc;
  if (racine > 44) racine -= 12;
  return { racine, intervalles: mineur ? [0, 3, 7] : [0, 4, 7] };
}

/** Motif de batterie en double-croches : "x" fort, "o" doux, "." rien. */
function motif(m: string): { pas: number; vel: number }[] {
  const r: { pas: number; vel: number }[] = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] === "x") r.push({ pas: i, vel: 1 });
    else if (m[i] === "o") r.push({ pas: i, vel: 0.55 });
  }
  return r;
}

export class Partition {
  readonly mesures: Mesure[] = [];
  readonly obstacles: Obstacle[] = [];
  readonly notes: Note[] = [];
  readonly panneaux: Panneau[] = [];
  /** Début de chaque section, en temps et en secondes. */
  readonly debutsSections: { temps: number; t: number }[] = [];
  readonly tempsTotal: number;
  readonly duree: number;

  constructor(readonly sections: SectionDef[] = SECTIONS) {
    let temps = 0;
    let t = 0;
    sections.forEach((s, si) => {
      this.debutsSections.push({ temps, t });
      for (const def of s.mesures) {
        const { racine, intervalles } = lireAccord(def.accord);
        this.mesures.push({
          index: this.mesures.length,
          section: si,
          debutTemps: temps,
          debutS: t,
          bpm: s.bpm,
          racine,
          accord: intervalles,
          style: def.style ?? s.style,
          remplissage: !!def.remplissage,
          texte: def.texte,
        });
        temps += TEMPS_PAR_MESURE;
        t += (TEMPS_PAR_MESURE * 60) / s.bpm;
      }
    });
    this.tempsTotal = temps;
    // La dernière note laisse résonner la réverbération avant l'écran de fin.
    this.duree = t + 2.5;

    for (const m of this.mesures) this.ecrireMesure(m);
    this.notes.sort((a, b) => a.t - b.t);
  }

  /** Conversion temps musical → secondes, en suivant les changements de tempo. */
  tempsVersSecondes(temps: number): number {
    const m = this.mesureAuTemps(temps);
    return m.debutS + ((temps - m.debutTemps) * 60) / m.bpm;
  }

  secondesVersTemps(t: number): number {
    const m = this.mesureALaSeconde(t);
    return m.debutTemps + ((t - m.debutS) * m.bpm) / 60;
  }

  mesureAuTemps(temps: number): Mesure {
    const i = Math.floor(temps / TEMPS_PAR_MESURE);
    return this.mesures[Math.max(0, Math.min(this.mesures.length - 1, i))];
  }

  mesureALaSeconde(t: number): Mesure {
    let lo = 0;
    let hi = this.mesures.length - 1;
    if (t <= 0) return this.mesures[0];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.mesures[mid].debutS <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.mesures[lo];
  }

  sectionALaSeconde(t: number): number {
    return this.mesureALaSeconde(t).section;
  }

  /** Le tempo courant, utile pour les animations. */
  bpmA(t: number): number {
    return this.mesureALaSeconde(t).bpm;
  }

  // ---------------------------------------------------------------- écriture

  private ajouter(m: Mesure, tempsDansMesure: number, n: Omit<Note, "t" | "temps" | "section">) {
    const temps = m.debutTemps + tempsDansMesure;
    this.notes.push({ ...n, temps, t: this.tempsVersSecondes(temps), section: m.section });
  }

  private ecrireMesure(m: Mesure) {
    const def = this.sections[m.section];
    const dureeTemps = 60 / m.bpm;
    const accordAigu = m.accord.map((i) => m.racine + 24 + i);
    const r = hasard(m.section * 1000 + (m.index % 8) * 17 + 3);

    // --- obstacles, lus dans la ligne de croches
    const ligne = def.mesures[m.index - this.premiereMesure(m.section)].obstacles ?? "";
    let rang = 0;
    for (let pas = 0; pas < ligne.length; pas++) {
      const c = ligne[pas];
      if (c === ".") continue;
      const action: Action = c === "S" ? "saut" : c === "F" ? "frappe" : "glisse";
      const temps = m.debutTemps + pas * 0.5;
      const tons = [0, 1, 2, 3].map((k) => m.racine + 36 + m.accord[k % 3] + (k === 3 ? 12 : 0));
      this.obstacles.push({
        id: this.obstacles.length,
        action,
        temps,
        t: this.tempsVersSecondes(temps),
        mesure: m.index,
        pas,
        section: m.section,
        midi: action === "glisse" ? m.racine + 12 : tons[rang % 4],
        accord: accordAigu,
      });
      rang++;
    }
    if (m.texte) this.panneaux.push({ temps: m.debutTemps, texte: m.texte });

    // --- harmonie : la nappe tient toute la mesure
    if (m.style !== "final") {
      this.ajouter(m, 0, {
        instr: "nappe",
        couche: "base",
        vel: m.style === "eveil" ? 0.7 : 1,
        accord: [m.racine + 12, ...m.accord.map((i) => m.racine + 24 + i), m.racine + 24 + m.accord[1] + 12],
        duree: dureeTemps * 4.05,
      });
    }

    switch (m.style) {
      case "eveil":
        this.eveil(m);
        break;
      case "sousbois":
        this.batterie(m, "x.o.......x.....", "........x.......", "x.o.x.o.x.o.x.o.", "oooooooooooooooo");
        this.basse(m, [
          [0, 0, 1.5],
          [2.5, 0, 1],
          [3.5, 12, 0.5],
        ]);
        this.arpege(m, 0.5, [0, 1, 2, 3, 2, 1, 0, 1]);
        this.melodie(m, r, ["x..x..x.x.......", "x.....x...x.x...", "..x.x.x.....x..."]);
        this.ajouter(m, 3.5, { instr: "tom", couche: "eclat", vel: 0.5, midi: 45 });
        break;
      case "marais":
        this.batterie(m, "x...x...x...x...", "....x.......x...", "x.o.x.o.x.o.x.o.", "..o...o...o...o.");
        for (let k = 0; k < 4; k++) this.ajouter(m, k + 0.5, { instr: "charleyOuvert", couche: "rythme", vel: 0.7 });
        this.basse(m, [
          [0.5, 0, 0.4],
          [1.5, 0, 0.4],
          [2.5, 0, 0.4],
          [3.5, 12, 0.4],
        ]);
        this.arpege(m, 0.25, [0, 2, 1, 3, 2, 1, 3, 2]);
        this.melodie(m, r, ["x.x...x.x...x...", "x...x.x...x.x.x.", "x.....x.x.x....."]);
        break;
      case "canopee":
        this.batterie(m, "x.....x...x.....", "....x.......x...", "xoxoxoxoxoxoxoxo", "......o..o....o.");
        this.basse(m, [
          [0, 0, 0.6],
          [0.75, 12, 0.4],
          [1.5, 7, 0.4],
          [2.5, 0, 0.8],
          [3.5, 10, 0.4],
        ]);
        this.arpege(m, 0.25, [0, 1, 2, 3, 4, 3, 2, 1]);
        this.melodie(m, r, ["x..x..x...x.x...", "x.x.x...x..x....", "x..x..x.x.x.x..."], "flute");
        if (m.index % 2 === 1) for (const p of [3, 3.25, 3.5, 3.75]) this.ajouter(m, p, { instr: "tom", couche: "eclat", vel: 0.6, midi: 50 - p * 4 });
        break;
      case "coeur":
        this.batterie(m, "x...x...x...x...", "....x.......x...", "xoxoxoxoxoxoxoxo", "..x...x...x...x.");
        for (let k = 0; k < 4; k++) this.ajouter(m, k + 0.5, { instr: "charleyOuvert", couche: "rythme", vel: 0.8 });
        for (let k = 0; k < 8; k++) this.ajouter(m, k * 0.5, { instr: "basse", couche: "base", vel: k % 2 ? 0.7 : 1, midi: m.racine + (k % 2 ? 12 : 0), duree: dureeTemps * 0.45 });
        this.arpege(m, 0.25, [0, 1, 2, 3, 4, 3, 2, 1]);
        this.melodie(m, r, ["x.x.x...x.x.x...", "x...x...x.x.x.x.", "x.x...x.x...x.x."]);
        this.ajouter(m, 0, { instr: "choeur", couche: "eclat", vel: 0.8, accord: accordAigu, duree: dureeTemps * 4 });
        break;
      case "final":
        if (m.index === this.mesures.length - 2) {
          this.ajouter(m, 0, { instr: "impact", couche: "base", vel: 1, midi: m.racine });
          this.ajouter(m, 0, { instr: "nappe", couche: "base", vel: 1.2, accord: [m.racine + 12, m.racine + 24, m.racine + 28, m.racine + 31, m.racine + 36], duree: dureeTemps * 8 });
          this.ajouter(m, 0, { instr: "choeur", couche: "base", vel: 1, accord: [m.racine + 36, m.racine + 40, m.racine + 43], duree: dureeTemps * 8 });
          this.ajouter(m, 0, { instr: "basse", couche: "base", vel: 1, midi: m.racine, duree: dureeTemps * 6 });
          [0, 4, 7, 12, 16, 19, 24].forEach((iv, k) =>
            this.ajouter(m, 0.25 + k * 0.25, { instr: "cloche", couche: "base", vel: 0.6, midi: m.racine + 45 + iv, duree: 2 }),
          );
        }
        break;
    }

    if (m.remplissage) {
      // Roulement et souffle qui montent vers la section suivante.
      this.ajouter(m, 0, { instr: "souffle", couche: "base", vel: 1, duree: dureeTemps * 4 });
      for (let k = 8; k < 16; k++) this.ajouter(m, k * 0.25, { instr: "caisse", couche: "base", vel: 0.35 + (k - 8) * 0.08 });
    }
  }

  private premiereMesure(section: number): number {
    return this.mesures.findIndex((m) => m.section === section);
  }

  private eveil(m: Mesure) {
    // Le battement de cœur : un coup fort, un coup sourd.
    for (const p of [0, 0.5, 2, 2.5]) this.ajouter(m, p, { instr: "grosse", couche: "base", vel: p % 1 ? 0.55 : 0.95 });
    this.ajouter(m, 0, { instr: "cloche", couche: "base", vel: 0.35, midi: m.racine + 48 + m.accord[2], duree: 3 });
    for (let k = 0; k < 8; k++) this.ajouter(m, k * 0.5, { instr: "charley", couche: "eclat", vel: 0.25 });
  }

  /** Grosse caisse, claque, charleston fermé, shaker. Le remplissage coupe la grosse caisse en fin de mesure. */
  private batterie(m: Mesure, grosse: string, claque: string, charley: string, shaker: string) {
    for (const { pas, vel } of motif(grosse)) if (!m.remplissage || pas < 8) this.ajouter(m, pas / 4, { instr: "grosse", couche: "base", vel });
    for (const { pas, vel } of motif(claque)) this.ajouter(m, pas / 4, { instr: "claque", couche: "rythme", vel });
    for (const { pas, vel } of motif(charley)) this.ajouter(m, pas / 4, { instr: "charley", couche: "rythme", vel: vel * 0.8 });
    for (const { pas, vel } of motif(shaker)) this.ajouter(m, pas / 4, { instr: "shaker", couche: "eclat", vel });
  }

  private basse(m: Mesure, notes: [number, number, number][]) {
    const d = 60 / m.bpm;
    for (const [p, iv, duree] of notes) this.ajouter(m, p, { instr: "basse", couche: "base", vel: 1, midi: m.racine + iv, duree: duree * d });
  }

  private arpege(m: Mesure, pas: number, ordre: number[]) {
    const tons = [0, 1, 2, 3, 4].map((k) => m.racine + 36 + m.accord[k % 3] + 12 * Math.floor(k / 3));
    const n = Math.round(4 / pas);
    for (let k = 0; k < n; k++) {
      this.ajouter(m, k * pas, { instr: "arpege", couche: "arpege", vel: k % 4 === 0 ? 1 : 0.7, midi: tons[ordre[k % ordre.length] % tons.length], duree: (pas * 60) / m.bpm });
    }
  }

  /** Mélodie : des tons de l'accord sur les appuis, des notes de passage ailleurs, qui se répètent toutes les 8 mesures. */
  private melodie(m: Mesure, r: () => number, rythmes: string[], instr: Instrument = "cloche") {
    const s = this.sections[m.section];
    const gamme: number[] = [];
    for (let o = 5; o <= 7; o++) for (const g of s.gamme) gamme.push(12 * o + s.tonique + g);
    const tonsAccord = new Set(m.accord.map((i) => (m.racine + i) % 12));
    const rythme = rythmes[Math.floor(r() * rythmes.length)];
    let i = gamme.findIndex((n) => n >= 72 + s.tonique - 12 + 9);
    if (i < 0) i = 7;
    for (const { pas } of motif(rythme)) {
      i = Math.max(3, Math.min(gamme.length - 4, i + Math.round((r() - 0.5) * 4)));
      if (pas % 4 === 0) {
        // Sur le temps, on retombe sur la note de l'accord la plus proche.
        for (let d = 0; d < 4; d++) {
          if (tonsAccord.has(gamme[i + d] % 12)) (i = i + d), (d = 9);
          else if (tonsAccord.has(gamme[i - d] % 12)) (i = i - d), (d = 9);
        }
      }
      this.ajouter(m, pas / 4, { instr, couche: "melodie", vel: pas % 4 === 0 ? 0.9 : 0.65, midi: gamme[i], duree: (instr === "flute" ? 0.45 : 1.2) * (60 / m.bpm) });
    }
  }
}
