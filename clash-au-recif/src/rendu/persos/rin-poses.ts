// Les poses de Rin. Tournée vers la droite ; « P » = côté proche de la caméra, « L » = côté loin.
// Rotations en radians [x, y, z]. Bras : x < 0 lance le bras vers l'avant. Coude : x < 0 plie.
// Cuisse : x < 0 lève le genou. Genou : x > 0 plie. Torse : x > 0 penche en avant, y < 0 ouvre le buste vers la caméra.
import { coup, type Jeu } from "../animations";
import type { Pose } from "../pantin";

const garde: Pose = {
  os: {
    bassin: [0, -0.25, 0],
    torse: [0.12, -0.1, 0],
    tete: [0.02, 0.32, 0],
    cou: [0, 0.05, 0],
    brasL: [-1.0, 0, 0.3],
    avantBrasL: [-1.55, 0, 0],
    mainL: [0, 0, 0.2],
    brasP: [-0.45, 0, -0.42],
    avantBrasP: [-2.1, 0, 0],
    cuisseL: [-0.5, 0, 0.12],
    molletL: [0.55, 0, 0],
    piedL: [-0.05, 0, 0],
    cuisseP: [0.35, 0, -0.14],
    molletP: [0.5, 0, 0],
    piedP: [0.15, 0, 0],
  },
};

const course = (phase: number): Pose => {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    y: -0.04 + Math.abs(c) * 0.05,
    os: {
      bassin: [0, s * 0.15, 0],
      torse: [0.45, -s * 0.25, 0],
      tete: [-0.3, s * 0.15, 0],
      brasL: [s * 1.1, 0, 0.25],
      avantBrasL: [-1.5, 0, 0],
      brasP: [-s * 1.1, 0, -0.25],
      avantBrasP: [-1.5, 0, 0],
      cuisseL: [-0.4 - s * 0.85, 0, 0.05],
      molletL: [0.5 + Math.max(0, c) * 1.3, 0, 0],
      piedL: [0.2, 0, 0],
      cuisseP: [-0.4 + s * 0.85, 0, -0.05],
      molletP: [0.5 + Math.max(0, -c) * 1.3, 0, 0],
      piedP: [0.2, 0, 0],
    },
  };
};

const accroupi: Pose = {
  y: -0.25,
  os: {
    torse: [0.45, -0.1, 0],
    tete: [-0.3, 0.3, 0],
    brasL: [-0.4, 0, 0.5],
    avantBrasL: [-1.2, 0, 0],
    brasP: [0.3, 0, -0.5],
    avantBrasP: [-1.2, 0, 0],
    cuisseL: [-1.1, 0, 0.15],
    molletL: [1.5, 0, 0],
    piedL: [-0.3, 0, 0],
    cuisseP: [-0.5, 0, -0.15],
    molletP: [1.6, 0, 0],
    piedP: [0.4, 0, 0],
  },
};

const saut: Pose = {
  os: {
    torse: [0.2, -0.15, 0],
    tete: [-0.15, 0.25, 0],
    brasL: [-2.4, 0, 0.4],
    avantBrasL: [-0.5, 0, 0],
    brasP: [0.6, 0, -0.5],
    avantBrasP: [-0.9, 0, 0],
    cuisseL: [-1.3, 0, 0.1],
    molletL: [1.7, 0, 0],
    piedL: [0.4, 0, 0],
    cuisseP: [-0.3, 0, -0.1],
    molletP: [1.3, 0, 0],
    piedP: [0.5, 0, 0],
  },
};

const chute: Pose = {
  os: {
    torse: [-0.05, -0.15, 0],
    tete: [0.15, 0.25, 0],
    brasL: [-0.6, 0, 1.3],
    avantBrasL: [-0.6, 0, 0],
    brasP: [-0.3, 0, -1.2],
    avantBrasP: [-0.6, 0, 0],
    cuisseL: [-0.6, 0, 0.1],
    molletL: [0.7, 0, 0],
    piedL: [0.3, 0, 0],
    cuisseP: [0.1, 0, -0.1],
    molletP: [0.5, 0, 0],
    piedP: [0.4, 0, 0],
  },
};

const bouclier: Pose = {
  y: -0.12,
  os: {
    torse: [0.25, -0.2, 0],
    tete: [0.25, 0.3, 0],
    brasL: [-1.2, 0.3, 0.6],
    avantBrasL: [-1.7, 0, 0],
    brasP: [-1.25, -0.3, -0.5],
    avantBrasP: [-1.8, 0, 0],
    cuisseL: [-0.7, 0, 0.15],
    molletL: [1.0, 0, 0],
    cuisseP: [0.2, 0, -0.2],
    molletP: [0.9, 0, 0],
    piedP: [0.3, 0, 0],
  },
};

const touche: Pose = {
  os: {
    torse: [-0.45, 0.15, 0.1],
    tete: [-0.45, 0.3, 0],
    brasL: [-1.1, 0, 0.9],
    avantBrasL: [-0.4, 0, 0],
    brasP: [-0.9, 0, -1.0],
    avantBrasP: [-0.3, 0, 0],
    cuisseL: [-0.6, 0, 0.1],
    molletL: [0.4, 0, 0],
    cuisseP: [0.2, 0, -0.1],
    molletP: [0.3, 0, 0],
  },
};

const tournoie: Pose = {
  os: {
    torse: [0.5, 0, 0],
    tete: [0.4, 0, 0],
    brasL: [-2.0, 0, 0.8],
    avantBrasL: [-0.8, 0, 0],
    brasP: [-1.4, 0, -0.9],
    avantBrasP: [-0.6, 0, 0],
    cuisseL: [-1.4, 0, 0.2],
    molletL: [1.6, 0, 0],
    cuisseP: [-0.9, 0, -0.2],
    molletP: [1.2, 0, 0],
  },
};

const aTerre: Pose = {
  tour: 1.45,
  sol: -0.78,
  os: {
    torse: [-0.1, 0, 0],
    tete: [0.3, 0.6, 0],
    brasL: [0.2, 0, 1.2],
    avantBrasL: [-0.4, 0, 0],
    brasP: [-0.3, 0, -0.9],
    avantBrasP: [-0.3, 0, 0],
    cuisseL: [-0.6, 0, 0.1],
    molletL: [1.0, 0, 0],
    cuisseP: [-0.1, 0, -0.1],
    molletP: [0.2, 0, 0],
  },
};

const etourdi = (t: number): Pose => ({
  y: -0.05,
  os: {
    bassin: [0, 0, Math.sin(t * 4) * 0.08],
    torse: [0.35, 0, Math.sin(t * 4) * 0.15],
    tete: [0.4, Math.sin(t * 3) * 0.4, Math.sin(t * 4 + 1) * 0.3],
    brasL: [0, 0, 0.2],
    avantBrasL: [-0.2, 0, 0],
    brasP: [0, 0, -0.2],
    avantBrasP: [-0.2, 0, 0],
    cuisseL: [-0.2, 0, 0.1],
    molletL: [0.4, 0, 0],
    cuisseP: [-0.1, 0, -0.1],
    molletP: [0.4, 0, 0],
  },
});

const apparition: Pose = {
  os: {
    torse: [-0.05, -0.4, 0],
    tete: [-0.1, 0.4, 0],
    brasL: [-0.4, 0, 0.5],
    avantBrasL: [-2.2, 0.3, 0],
    brasP: [-0.4, 0, -0.5],
    avantBrasP: [-2.2, -0.3, 0],
    cuisseL: [-0.15, 0, 0.12],
    cuisseP: [0.1, 0, -0.12],
  },
};

const victoire = (t: number): Pose => ({
  os: {
    torse: [-0.1, -0.5, 0],
    tete: [-0.2, 0.2, 0],
    brasL: [0.2, 0, 0.3],
    avantBrasL: [-0.6, 0, 0],
    brasP: [-2.9 + Math.sin(t * 6) * 0.1, 0, -0.3],
    avantBrasP: [-0.2, 0, 0],
    cuisseL: [-0.2, 0, 0.15],
    cuisseP: [0.15, 0, -0.15],
  },
  expression: "cri",
});

// ——— Les coups ———

const poingL: Pose = {
  y: -0.06,
  os: {
    ...garde.os,
    torse: [0.18, -0.15, 0],
    tete: [0.05, 0.4, 0],
    brasL: [-1.5, 0, 0.62],
    avantBrasL: [-0.05, 0, 0],
    brasP: [-0.6, 0, -0.5],
    avantBrasP: [-2.0, 0, 0],
  },
};

const poingP: Pose = {
  y: -0.08,
  os: {
    ...garde.os,
    bassin: [0, 0.2, 0],
    torse: [0.2, 0.35, 0],
    tete: [0.05, -0.15, 0],
    brasP: [-1.5, 0, 0.42],
    avantBrasP: [-0.05, 0, 0],
    brasL: [-0.5, 0, 0.5],
    avantBrasL: [-2.0, 0, 0],
    cuisseP: [0.15, 0, -0.1],
  },
};

const piedArme: Pose = {
  os: {
    ...garde.os,
    torse: [-0.1, -0.3, 0],
    brasL: [-0.6, 0, 0.9],
    brasP: [0.3, 0, -0.9],
    cuisseP: [-1.6, 0, -0.2],
    molletP: [1.9, 0, 0],
    cuisseL: [-0.1, 0, 0.1],
    molletL: [0.3, 0, 0],
  },
};

const piedTendu: Pose = {
  os: {
    ...garde.os,
    torse: [-0.45, -0.4, 0.1],
    tete: [0.2, 0.5, 0],
    brasL: [-0.3, 0, 1.3],
    avantBrasL: [-0.5, 0, 0],
    brasP: [0.4, 0, -1.2],
    avantBrasP: [-0.4, 0, 0],
    cuisseP: [-1.75, 0, -0.15],
    molletP: [0.05, 0, 0],
    piedP: [0.6, 0, 0],
    cuisseL: [0.05, 0, 0.1],
    molletL: [0.2, 0, 0],
  },
};

const vrille: Pose = {
  os: {
    torse: [0.2, -0.2, 0],
    tete: [0.1, 0.3, 0],
    brasL: [-0.4, 0, 1.4],
    avantBrasL: [-0.3, 0, 0],
    brasP: [-0.2, 0, -1.4],
    avantBrasP: [-0.3, 0, 0],
    cuisseL: [-1.5, 0, 0.1],
    molletL: [0.1, 0, 0],
    piedL: [0.5, 0, 0],
    cuisseP: [-0.6, 0, -0.1],
    molletP: [1.6, 0, 0],
  },
};

const lameArme: Pose = {
  y: -0.22,
  os: {
    torse: [0.5, 0.35, 0],
    tete: [-0.35, -0.2, 0],
    brasP: [0.9, 0, -0.7],
    avantBrasP: [-0.6, 0, 0],
    brasL: [-1.3, 0, 0.7],
    avantBrasL: [-1.6, 0, 0],
    cuisseL: [-1.2, 0, 0.15],
    molletL: [1.5, 0, 0],
    cuisseP: [-0.3, 0, -0.15],
    molletP: [1.7, 0, 0],
    piedP: [0.5, 0, 0],
  },
};

const lameFonce: Pose = {
  y: -0.12,
  os: {
    torse: [0.75, -0.35, 0],
    tete: [-0.6, 0.35, 0],
    brasP: [-1.5, 0, 0.35],
    avantBrasP: [0, 0, 0],
    mainP: [0, 0, -0.3],
    brasL: [1.1, 0, 0.5],
    avantBrasL: [-0.3, 0, 0],
    cuisseL: [-1.0, 0, 0.1],
    molletL: [0.5, 0, 0],
    cuisseP: [0.9, 0, -0.1],
    molletP: [0.6, 0, 0],
    piedP: [0.6, 0, 0],
  },
};

export const POSES_RIN: Jeu = {
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
  souffle: 0.05,
  coups: {
    poing: coup([
      [0, garde],
      [2, poingL],
      [6, poingL],
      [14, garde],
    ]),
    poing2: coup([
      [0, poingL],
      [2, poingP],
      [6, poingP],
      [14, garde],
    ]),
    tornade: coup([
      [0, garde],
      [3, piedArme],
      [5, piedTendu],
      [11, piedTendu],
      [22, garde],
    ]),
    vrille: (f) => {
      const p = coup([
        [0, saut],
        [4, vrille],
        [16, vrille],
        [24, saut],
      ])(f);
      const t = Math.max(0, Math.min(1, (f - 3) / 11));
      return { ...p, tour: -t * Math.PI * 2 };
    },
    lame: coup([
      [0, garde],
      [5, lameArme],
      [7, lameFonce],
      [20, lameFonce],
      [32, garde],
    ]),
  },
};
