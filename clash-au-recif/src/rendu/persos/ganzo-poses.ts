// Les poses de Ganzo : lourdes, larges, les poings bas. Mêmes conventions que Rin.
import { coup, type Jeu } from "../animations";
import { ajouter, type Pose } from "../pantin";

const garde: Pose = {
  y: -0.05,
  os: {
    bassin: [0, -0.2, 0],
    torse: [0.22, -0.15, 0],
    cou: [-0.1, 0, 0],
    tete: [-0.12, 0.3, 0],
    brasL: [-0.7, 0, 0.45],
    avantBrasL: [-1.3, 0, 0],
    brasP: [-0.35, 0, -0.5],
    avantBrasP: [-1.5, 0, 0],
    cuisseL: [-0.45, 0, 0.25],
    molletL: [0.5, 0, 0],
    piedL: [-0.05, 0, 0],
    cuisseP: [0.3, 0, -0.25],
    molletP: [0.45, 0, 0],
    piedP: [0.1, 0, 0],
  },
};

const course = (phase: number): Pose => {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    y: -0.05 + Math.abs(c) * 0.06,
    os: {
      bassin: [0, s * 0.18, 0],
      torse: [0.35, -s * 0.2, s * 0.06],
      cou: [-0.1, 0, 0],
      tete: [-0.25, s * 0.1, 0],
      brasL: [s * 0.8, 0, 0.45],
      avantBrasL: [-1.3, 0, 0],
      brasP: [-s * 0.8, 0, -0.45],
      avantBrasP: [-1.3, 0, 0],
      cuisseL: [-0.35 - s * 0.7, 0, 0.12],
      molletL: [0.45 + Math.max(0, c) * 1.0, 0, 0],
      piedL: [0.15, 0, 0],
      cuisseP: [-0.35 + s * 0.7, 0, -0.12],
      molletP: [0.45 + Math.max(0, -c) * 1.0, 0, 0],
      piedP: [0.15, 0, 0],
    },
  };
};

const accroupi: Pose = {
  y: -0.3,
  os: {
    torse: [0.5, -0.1, 0],
    tete: [-0.4, 0.3, 0],
    brasL: [-0.5, 0, 0.6],
    avantBrasL: [-1.0, 0, 0],
    brasP: [0.1, 0, -0.6],
    avantBrasP: [-1.0, 0, 0],
    cuisseL: [-1.1, 0, 0.3],
    molletL: [1.4, 0, 0],
    piedL: [-0.3, 0, 0],
    cuisseP: [-0.5, 0, -0.3],
    molletP: [1.5, 0, 0],
    piedP: [0.3, 0, 0],
  },
};

const saut: Pose = {
  os: {
    torse: [0.25, -0.1, 0],
    tete: [-0.2, 0.25, 0],
    brasL: [-1.0, 0, 0.9],
    avantBrasL: [-1.2, 0, 0],
    brasP: [-0.6, 0, -0.9],
    avantBrasP: [-1.2, 0, 0],
    cuisseL: [-1.2, 0, 0.25],
    molletL: [1.5, 0, 0],
    piedL: [0.3, 0, 0],
    cuisseP: [-0.4, 0, -0.25],
    molletP: [1.2, 0, 0],
    piedP: [0.4, 0, 0],
  },
};

const chute: Pose = {
  os: {
    torse: [0.05, -0.1, 0],
    tete: [0.05, 0.25, 0],
    brasL: [-0.4, 0, 1.1],
    avantBrasL: [-0.8, 0, 0],
    brasP: [-0.2, 0, -1.1],
    avantBrasP: [-0.8, 0, 0],
    cuisseL: [-0.5, 0, 0.25],
    molletL: [0.6, 0, 0],
    piedL: [0.3, 0, 0],
    cuisseP: [0.1, 0, -0.25],
    molletP: [0.5, 0, 0],
    piedP: [0.3, 0, 0],
  },
};

const bouclier: Pose = {
  y: -0.12,
  os: {
    torse: [0.3, -0.2, 0],
    tete: [0.15, 0.3, 0],
    brasL: [-1.25, 0.3, 0.75],
    avantBrasL: [-1.6, 0, 0],
    brasP: [-1.3, -0.3, -0.6],
    avantBrasP: [-1.7, 0, 0],
    cuisseL: [-0.65, 0, 0.3],
    molletL: [0.9, 0, 0],
    cuisseP: [0.2, 0, -0.3],
    molletP: [0.8, 0, 0],
    piedP: [0.2, 0, 0],
  },
};

const touche: Pose = {
  os: {
    torse: [-0.35, 0.15, 0.1],
    tete: [-0.4, 0.3, 0],
    brasL: [-0.9, 0, 0.9],
    avantBrasL: [-0.5, 0, 0],
    brasP: [-0.7, 0, -1.0],
    avantBrasP: [-0.4, 0, 0],
    cuisseL: [-0.5, 0, 0.25],
    molletL: [0.4, 0, 0],
    cuisseP: [0.2, 0, -0.25],
    molletP: [0.3, 0, 0],
  },
};

const tournoie: Pose = {
  os: {
    torse: [0.45, 0, 0],
    tete: [0.3, 0, 0],
    brasL: [-1.8, 0, 0.9],
    avantBrasL: [-0.8, 0, 0],
    brasP: [-1.3, 0, -1.0],
    avantBrasP: [-0.6, 0, 0],
    cuisseL: [-1.3, 0, 0.3],
    molletL: [1.5, 0, 0],
    cuisseP: [-0.8, 0, -0.3],
    molletP: [1.1, 0, 0],
  },
};

const aTerre: Pose = {
  tour: 1.45,
  sol: -0.95,
  os: {
    torse: [-0.1, 0, 0],
    tete: [0.3, 0.6, 0],
    brasL: [0.1, 0, 1.3],
    avantBrasL: [-0.4, 0, 0],
    brasP: [-0.3, 0, -1.1],
    avantBrasP: [-0.3, 0, 0],
    cuisseL: [-0.5, 0, 0.25],
    molletL: [0.9, 0, 0],
    cuisseP: [-0.1, 0, -0.25],
    molletP: [0.2, 0, 0],
  },
};

const etourdi = (t: number): Pose => ({
  y: -0.05,
  os: {
    bassin: [0, 0, Math.sin(t * 3) * 0.06],
    torse: [0.3, 0, Math.sin(t * 3) * 0.12],
    tete: [0.35, Math.sin(t * 2.5) * 0.35, Math.sin(t * 3 + 1) * 0.25],
    brasL: [0, 0, 0.35],
    avantBrasL: [-0.2, 0, 0],
    brasP: [0, 0, -0.35],
    avantBrasP: [-0.2, 0, 0],
    cuisseL: [-0.2, 0, 0.25],
    molletL: [0.4, 0, 0],
    cuisseP: [-0.1, 0, -0.25],
    molletP: [0.4, 0, 0],
  },
});

const apparition: Pose = {
  os: {
    torse: [-0.1, -0.4, 0],
    tete: [-0.15, 0.4, 0],
    brasL: [-0.5, 0, 0.6],
    avantBrasL: [-2.0, 0.4, 0],
    brasP: [-0.5, 0, -0.6],
    avantBrasP: [-2.0, -0.4, 0],
    cuisseL: [-0.1, 0, 0.3],
    cuisseP: [0.1, 0, -0.3],
  },
};

const victoire = (t: number): Pose => ({
  y: -0.05,
  os: {
    torse: [-0.15 + Math.sin(t * 5) * 0.03, -0.45, 0],
    tete: [-0.35, 0.3, 0],
    brasL: [-0.2, 0, 1.4],
    avantBrasL: [-1.8, 0, 0],
    brasP: [-0.2, 0, -1.4],
    avantBrasP: [-1.8, 0, 0],
    cuisseL: [-0.3, 0, 0.35],
    molletL: [0.4, 0, 0],
    cuisseP: [0.2, 0, -0.35],
    molletP: [0.4, 0, 0],
  },
  expression: "cri",
});

// ——— Les coups ———

const crochetArme: Pose = {
  y: -0.1,
  os: {
    ...garde.os,
    bassin: [0, -0.4, 0],
    torse: [0.3, -0.7, 0],
    tete: [-0.15, 0.6, 0],
    brasP: [0.5, 0, -1.0],
    avantBrasP: [-1.4, 0, 0],
    brasL: [-0.9, 0, 0.6],
    avantBrasL: [-1.4, 0, 0],
  },
};

const crochetFrappe: Pose = {
  y: -0.12,
  avance: 0.1,
  os: {
    ...garde.os,
    bassin: [0, 0.3, 0],
    torse: [0.35, 0.55, 0],
    tete: [-0.15, -0.2, 0],
    brasP: [-1.45, 0, 0.55],
    avantBrasP: [-0.35, 0, 0],
    brasL: [0.3, 0, 0.7],
    avantBrasL: [-1.3, 0, 0],
    cuisseL: [-0.6, 0, 0.25],
    molletL: [0.6, 0, 0],
    cuisseP: [0.45, 0, -0.2],
    molletP: [0.25, 0, 0],
  },
};

const marteauLeve: Pose = {
  os: {
    torse: [-0.35, 0, 0],
    tete: [-0.4, 0.2, 0],
    brasL: [-2.9, 0, 0.25],
    avantBrasL: [-0.4, 0, 0],
    brasP: [-2.9, 0, -0.25],
    avantBrasP: [-0.4, 0, 0],
    cuisseL: [-0.9, 0, 0.25],
    molletL: [1.3, 0, 0],
    cuisseP: [-0.2, 0, -0.25],
    molletP: [1.0, 0, 0],
  },
};

const marteauAbattu: Pose = {
  os: {
    torse: [0.75, 0, 0],
    tete: [-0.6, 0.1, 0],
    brasL: [-0.9, 0, 0.3],
    avantBrasL: [-0.15, 0, 0],
    brasP: [-0.9, 0, -0.3],
    avantBrasP: [-0.15, 0, 0],
    cuisseL: [-1.1, 0, 0.25],
    molletL: [1.2, 0, 0],
    cuisseP: [-0.6, 0, -0.25],
    molletP: [1.4, 0, 0],
  },
};

const canonCharge: Pose = {
  y: -0.22,
  os: {
    bassin: [0, -0.5, 0],
    torse: [0.25, -0.9, 0.1],
    tete: [-0.2, 0.85, 0],
    brasP: [0.9, 0, -0.6],
    avantBrasP: [-1.8, 0, 0],
    brasL: [-1.2, 0, 0.9],
    avantBrasL: [-0.6, 0, 0],
    cuisseL: [-0.9, 0, 0.35],
    molletL: [1.0, 0, 0],
    cuisseP: [0.25, 0, -0.35],
    molletP: [1.0, 0, 0],
    piedP: [0.3, 0, 0],
  },
};

const canonFrappe: Pose = {
  y: -0.15,
  avance: 0.15,
  os: {
    bassin: [0, 0.35, 0],
    torse: [0.45, 0.6, 0],
    tete: [-0.3, -0.3, 0],
    brasP: [-1.5, 0, 0.5],
    avantBrasP: [0, 0, 0],
    brasL: [0.7, 0, 0.8],
    avantBrasL: [-0.8, 0, 0],
    cuisseL: [-1.0, 0, 0.3],
    molletL: [0.9, 0, 0],
    cuisseP: [0.6, 0, -0.25],
    molletP: [0.2, 0, 0],
    piedP: [0.4, 0, 0],
  },
};

const canonAir: Pose = {
  os: {
    torse: [-0.2, 0.4, 0],
    tete: [-0.5, -0.1, 0],
    brasP: [-2.4, 0, 0.3],
    avantBrasP: [0, 0, 0],
    brasL: [0.4, 0, 0.9],
    avantBrasL: [-1.0, 0, 0],
    cuisseL: [-1.2, 0, 0.25],
    molletL: [1.5, 0, 0],
    cuisseP: [0.2, 0, -0.25],
    molletP: [0.8, 0, 0],
  },
};

export const POSES_GANZO: Jeu = {
  garde,
  course,
  accroupi,
  saut,
  chute,
  bouclier,
  touche,
  tournoie,
  aTerre,
  etourdi,
  apparition,
  victoire,
  souffle: 0.04,
  coups: {
    crochet: coup([
      [0, garde],
      [7, crochetArme],
      [10, crochetFrappe],
      [16, crochetFrappe],
      [34, garde],
    ]),
    marteau: coup([
      [0, saut],
      [6, marteauLeve],
      [9, marteauLeve],
      [12, marteauAbattu],
      [22, marteauAbattu],
      [36, chute],
    ]),
    canon: (f, charge) => {
      if (f <= 8) {
        // Prise d'élan, puis la charge : il tremble de plus en plus.
        const p = coup([
          [0, garde],
          [8, canonCharge],
        ])(f);
        const tremble = charge > 0 ? Math.sin(charge * 2.3) * 0.02 * (1 + charge / 20) : 0;
        return ajouter(p, { torse: [tremble, tremble, 0], tete: [tremble * 2, 0, 0] });
      }
      return coup([
        [8, canonCharge],
        [13, canonFrappe],
        [22, canonFrappe],
        [38, garde],
      ])(f);
    },
  },
};

/** En l'air, le poing canon part vers le haut. */
export const CANON_AIR = coup([
  [0, saut],
  [4, canonAir],
  [16, canonAir],
  [36, chute],
]);
