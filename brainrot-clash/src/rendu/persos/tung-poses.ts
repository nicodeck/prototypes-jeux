// Les poses de Tung Tung Tung Sahur : raide comme une bûche, la batte toujours en main.
// Mêmes conventions que Ballerina. La batte prolonge l'avant-bras proche : le poignet (mainP)
// l'oriente. L'angle total bras + avant-bras + poignet (en x) donne sa direction :
// 0 = vers le bas, -1,6 = devant, -3,1 = vers le haut, -3,8 = en haut derrière l'épaule.
import { coup, type Jeu } from "../animations";
import { ajouter, type Pose } from "../pantin";

const epaule: Pose["os"] = {
  brasP: [-0.45, 0, -0.35],
  avantBrasP: [-1.9, 0, 0],
  mainP: [-1.3, 0, 0],
};

const garde: Pose = {
  y: -0.05,
  os: {
    bassin: [0, -0.2, 0],
    torse: [0.08, -0.15, 0],
    brasL: [-0.5, 0, 0.35],
    avantBrasL: [-1.0, 0, 0],
    ...epaule,
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
      torse: [0.15, -s * 0.15, s * 0.06],
      brasL: [s * 0.8, 0, 0.45],
      avantBrasL: [-1.3, 0, 0],
      ...epaule,
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
  // Tung tung tung : il frappe le sol en cadence, batte levée.
  y: Math.abs(Math.sin(t * 6)) * 0.08,
  os: {
    torse: [-0.1, -0.4, 0],
    brasP: [-2.9 + Math.sin(t * 12) * 0.25, 0, -0.2],
    avantBrasP: [-0.3, 0, 0],
    mainP: [-0.4, 0, 0],
    brasL: [-0.2, 0, 1.0],
    avantBrasL: [-1.6, 0, 0],
    cuisseL: [-0.2, 0, 0.2],
    cuisseP: [0.1, 0, -0.2],
  },
  expression: "cri",
});

// ——— Les coups ———

const batteArmee: Pose = {
  y: -0.08,
  os: {
    ...garde.os,
    bassin: [0, -0.35, 0],
    torse: [0.1, -0.75, 0],
    brasP: [0.35, 0, -0.6],
    avantBrasP: [-1.6, 0, 0],
    mainP: [-2.5, 0, 0],
    brasL: [-0.4, 0, 0.2],
    avantBrasL: [-1.8, 0, 0],
  },
};

const batteFrappe: Pose = {
  y: -0.1,
  avance: 0.08,
  os: {
    ...garde.os,
    bassin: [0, 0.3, 0],
    torse: [0.2, 0.55, 0],
    brasP: [-1.5, 0, 0.5],
    avantBrasP: [-0.05, 0, 0],
    mainP: [-0.1, 0, 0],
    brasL: [-1.3, 0, 1.0],
    avantBrasL: [-0.4, 0, 0],
    cuisseL: [-0.6, 0, 0.2],
    molletL: [0.6, 0, 0],
    cuisseP: [0.45, 0, -0.2],
    molletP: [0.25, 0, 0],
  },
};

const batteSuite: Pose = {
  ...batteFrappe,
  os: { ...batteFrappe.os, torse: [0.2, 0.9, 0], brasP: [-1.3, 0, 1.3], mainP: [-0.5, 0, 0] },
};

const massueLevee: Pose = {
  os: {
    torse: [-0.3, 0, 0],
    brasP: [-3.0, 0, -0.15],
    avantBrasP: [-0.3, 0, 0],
    mainP: [-0.8, 0, 0],
    brasL: [-2.9, 0, 0.3],
    avantBrasL: [-0.5, 0, 0],
    cuisseL: [-0.9, 0, 0.2],
    molletL: [1.3, 0, 0],
    cuisseP: [-0.2, 0, -0.2],
    molletP: [1.0, 0, 0],
  },
};

const massueAbattue: Pose = {
  os: {
    torse: [0.6, 0, 0],
    brasP: [-0.9, 0, 0.2],
    avantBrasP: [-0.1, 0, 0],
    mainP: [0.15, 0, 0],
    brasL: [-0.9, 0, 0.5],
    avantBrasL: [-0.3, 0, 0],
    cuisseL: [-1.1, 0, 0.2],
    molletL: [1.2, 0, 0],
    cuisseP: [-0.6, 0, -0.2],
    molletP: [1.4, 0, 0],
  },
};

const tungCharge: Pose = {
  y: -0.15,
  os: {
    bassin: [0, -0.5, 0],
    torse: [0.1, -1.0, 0.1],
    brasP: [0.6, 0, -0.7],
    avantBrasP: [-1.6, 0, 0],
    mainP: [-2.5, 0, 0],
    brasL: [-0.2, 0, 0.3],
    avantBrasL: [-1.9, 0, 0],
    cuisseL: [-0.9, 0, 0.3],
    molletL: [1.0, 0, 0],
    cuisseP: [0.25, 0, -0.3],
    molletP: [1.0, 0, 0],
    piedP: [0.3, 0, 0],
  },
};

const tungFrappe: Pose = {
  y: -0.12,
  avance: 0.15,
  os: {
    bassin: [0, 0.35, 0],
    torse: [0.3, 0.65, 0],
    brasP: [-1.5, 0, 0.55],
    avantBrasP: [0, 0, 0],
    mainP: [-0.1, 0, 0],
    brasL: [-1.3, 0, 1.0],
    avantBrasL: [-0.4, 0, 0],
    cuisseL: [-1.0, 0, 0.3],
    molletL: [0.9, 0, 0],
    cuisseP: [0.6, 0, -0.25],
    molletP: [0.2, 0, 0],
    piedP: [0.4, 0, 0],
  },
};

const tungAir: Pose = {
  os: {
    torse: [-0.25, 0.3, 0],
    brasP: [-2.6, 0, 0.3],
    avantBrasP: [0, 0, 0],
    mainP: [0, 0, 0],
    brasL: [-2.2, 0, 0.6],
    avantBrasL: [-0.4, 0, 0],
    cuisseL: [-1.2, 0, 0.25],
    molletL: [1.5, 0, 0],
    cuisseP: [0.2, 0, -0.25],
    molletP: [0.8, 0, 0],
  },
};

export const POSES_TUNG: Jeu = {
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
  souffle: 0.02,
  coups: {
    batte: coup([
      [0, garde],
      [7, batteArmee],
      [10, batteFrappe],
      [15, batteSuite],
      [34, garde],
    ]),
    massue: coup([
      [0, saut],
      [6, massueLevee],
      [9, massueLevee],
      [12, massueAbattue],
      [22, massueAbattue],
      [36, chute],
    ]),
    tungtung: (f, charge) => {
      if (f <= 8) {
        // Il arme, puis tremble de plus en plus pendant la charge.
        const p = coup([
          [0, garde],
          [8, tungCharge],
        ])(f);
        const tremble = charge > 0 ? Math.sin(charge * 2.3) * 0.02 * (1 + charge / 20) : 0;
        return ajouter(p, { torse: [tremble, tremble, 0], tete: [tremble * 2, 0, 0] }, Math.abs(tremble));
      }
      return coup([
        [8, tungCharge],
        [13, tungFrappe],
        [22, tungFrappe],
        [38, garde],
      ])(f);
    },
  },
};

/** En l'air, le coup de batte part vers le haut. */
export const AIR_TUNG = coup([
  [0, saut],
  [4, tungAir],
  [16, tungAir],
  [36, chute],
]);
