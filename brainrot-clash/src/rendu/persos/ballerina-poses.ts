// Les poses de Ballerina Cappuccina : sur les pointes, bras en couronne, pirouettes.
// Tournée vers la droite ; « P » = côté proche de la caméra, « L » = côté loin.
// Rotations en radians [x, y, z]. Bras : x < 0 lance le bras vers l'avant. Coude : x < 0 plie.
// Cuisse : x < 0 lève la jambe devant. Genou : x > 0 plie. Pied : x > 0 pointe.
// Torse : x > 0 penche en avant, y < 0 ouvre le buste vers la caméra.
import { coup, type Jeu } from "../animations";
import { cles, type Pose } from "../pantin";

const garde: Pose = {
  os: {
    bassin: [0, -0.15, 0],
    torse: [0.02, -0.2, 0],
    tete: [0.05, 0.3, 0],
    brasP: [-0.85, 0, -0.35],
    avantBrasP: [-0.9, 0, 0],
    mainP: [0, 0, 0.3],
    brasL: [-2.6, 0, 0.35],
    avantBrasL: [-0.7, 0, 0],
    mainL: [0, 0, 0.3],
    cuisseL: [-0.4, 0, 0.1],
    molletL: [0.05, 0, 0],
    piedL: [0.9, 0, 0],
    cuisseP: [0.12, 0, -0.08],
    molletP: [0.3, 0, 0],
    piedP: [0.6, 0, 0],
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
      piedL: [0.8, 0, 0],
      cuisseP: [-0.4 + s * 0.85, 0, -0.05],
      molletP: [0.5 + Math.max(0, -c) * 1.3, 0, 0],
      piedP: [0.8, 0, 0],
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
  // Grand jeté : jambes en grand écart, bras levés.
  os: {
    torse: [0.1, -0.2, 0],
    tete: [-0.2, 0.3, 0],
    brasP: [-2.3, 0, -0.5],
    avantBrasP: [-0.3, 0, 0],
    brasL: [-1.6, 0, 0.9],
    avantBrasL: [-0.3, 0, 0],
    cuisseP: [-1.45, 0, 0],
    molletP: [0.05, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [1.1, 0, 0],
    molletL: [0.1, 0, 0],
    piedL: [0.9, 0, 0],
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
    torse: [0, -0.3, 0],
    tete: [-0.1, 0.3, 0],
    brasP: [-2.8, 0, -0.35],
    avantBrasP: [-0.6, 0, 0],
    brasL: [-2.8, 0, 0.35],
    avantBrasL: [-0.6, 0, 0],
    cuisseP: [0, 0, -0.1],
    piedP: [1.0, 0, 0],
    cuisseL: [0.05, 0, 0.1],
    piedL: [1.0, 0, 0],
  },
};

const victoire = (t: number): Pose => ({
  // Une arabesque : sur une pointe, l'autre jambe tendue derrière.
  y: 0.04,
  os: {
    torse: [0.35, -0.3, 0],
    tete: [-0.4, 0.4, 0],
    brasP: [-2.1 + Math.sin(t * 2) * 0.05, 0, -0.15],
    avantBrasP: [-0.15, 0, 0],
    brasL: [0.7, 0, 0.7],
    avantBrasL: [-0.15, 0, 0],
    cuisseP: [0, 0, 0],
    molletP: [0, 0, 0],
    piedP: [1.0, 0, 0],
    cuisseL: [1.35, 0, 0.1],
    molletL: [0, 0, 0],
    piedL: [0.9, 0, 0],
  },
  expression: "cri",
});

// ——— Les coups ———

const bras2nde: Pose["os"] = {
  brasP: [-0.15, 0, -1.4],
  avantBrasP: [-0.25, 0, 0],
  brasL: [-0.15, 0, 1.4],
  avantBrasL: [-0.25, 0, 0],
};

/** Grand battement de la jambe proche. */
const battementP: Pose = {
  y: 0.02,
  os: {
    ...bras2nde,
    torse: [-0.25, 0.1, 0],
    tete: [0.1, 0.2, 0],
    cuisseP: [-1.8, 0, 0.35],
    molletP: [0, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [0.05, 0, 0.08],
    molletL: [0, 0, 0],
    piedL: [0.9, 0, 0],
  },
};

/** Grand battement de la jambe loin, tournée vers l'adversaire. */
const battementL: Pose = {
  y: 0.02,
  os: {
    ...bras2nde,
    torse: [-0.25, -0.35, 0],
    tete: [0.1, 0.45, 0],
    cuisseL: [-1.8, 0, 0.65],
    molletL: [0, 0, 0],
    piedL: [0.9, 0, 0],
    cuisseP: [0.05, 0, -0.08],
    molletP: [0, 0, 0],
    piedP: [0.9, 0, 0],
  },
};

/** Retiré : le pied de la jambe proche contre le genou, prête à tourner. */
const passe: Pose = {
  y: 0.03,
  os: {
    torse: [0, -0.1, 0],
    brasP: [-1.2, 0, -0.3],
    avantBrasP: [-1.1, 0, 0],
    brasL: [-1.2, 0, 0.3],
    avantBrasL: [-1.1, 0, 0],
    cuisseP: [-1.1, 0, -0.75],
    molletP: [1.9, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [0, 0, 0.05],
    molletL: [0, 0, 0],
    piedL: [1.0, 0, 0],
  },
};

/** Jambe tendue sur le côté, bras ouverts : le tour qui frappe. */
const secondeTendue: Pose = {
  y: 0.03,
  os: {
    ...bras2nde,
    torse: [-0.1, 0, 0.1],
    cuisseP: [-1.55, 0, 0.2],
    molletP: [0, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [0, 0, 0.05],
    molletL: [0, 0, 0],
    piedL: [1.0, 0, 0],
  },
};

const couronne: Pose = {
  os: {
    torse: [0, 0, 0],
    tete: [-0.1, 0, 0],
    brasP: [-2.8, 0, -0.35],
    avantBrasP: [-0.6, 0, 0],
    brasL: [-2.8, 0, 0.35],
    avantBrasL: [-0.6, 0, 0],
    cuisseP: [-1.45, 0, 0.1],
    molletP: [0, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [0.1, 0, 0.05],
    molletL: [0.2, 0, 0],
    piedL: [0.9, 0, 0],
  },
};

const plie: Pose = {
  y: -0.2,
  os: {
    torse: [0.3, -0.2, 0],
    tete: [-0.2, 0.3, 0],
    brasP: [-0.3, 0, -1.1],
    avantBrasP: [-0.4, 0, 0],
    brasL: [-0.3, 0, 1.1],
    avantBrasL: [-0.4, 0, 0],
    cuisseP: [-0.9, 0, -0.4],
    molletP: [1.5, 0, 0],
    piedP: [0.3, 0, 0],
    cuisseL: [-0.9, 0, 0.4],
    molletL: [1.5, 0, 0],
    piedL: [0.3, 0, 0],
  },
};

const fouette: Pose = {
  os: {
    torse: [0.15, 0, 0],
    tete: [-0.15, 0, 0],
    brasP: [-1.4, 0, -0.2],
    avantBrasP: [-0.9, 0, 0],
    brasL: [-1.4, 0, 0.2],
    avantBrasL: [-0.9, 0, 0],
    cuisseP: [-1.5, 0, 0.25],
    molletP: [0, 0, 0],
    piedP: [0.9, 0, 0],
    cuisseL: [0, 0, 0.05],
    molletL: [0, 0, 0],
    piedL: [1.0, 0, 0],
  },
};

const tour = (f: number, de: number, a: number, tours: number) => {
  const t = Math.max(0, Math.min(1, (f - de) / (a - de)));
  return t * t * (3 - 2 * t) * Math.PI * 2 * tours;
};

export const POSES_BALLERINA: Jeu = {
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
  souffle: 0.03,
  coups: {
    battement: coup([
      [0, garde],
      [2, battementP],
      [7, battementP],
      [14, garde],
    ]),
    battement2: coup([
      [0, battementP],
      [2, battementL],
      [7, battementL],
      [14, garde],
    ]),
    pirouette: (f) => ({
      ...cles(
        [
          [0, garde],
          [2, passe],
          [5, secondeTendue],
          [12, secondeTendue],
          [24, garde],
        ],
        f,
      ),
      pirouette: tour(f, 1, 9, 1),
    }),
    tourbillon: (f) => ({
      ...cles(
        [
          [0, saut],
          [4, couronne],
          [16, couronne],
          [24, chute],
        ],
        f,
      ),
      pirouette: tour(f, 3, 15, 2),
    }),
    fouette: (f) => ({
      ...cles(
        [
          [0, garde],
          [5, plie],
          [7, fouette],
          [20, fouette],
          [32, garde],
        ],
        f,
      ),
      pirouette: f < 7 ? 0 : tour(f, 7, 22, 3),
    }),
  },
};
