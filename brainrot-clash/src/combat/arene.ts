// L'arène : le récif principal (solide), trois plateformes qu'on traverse par dessous,
// et les limites au-delà desquelles on est éjecté.

export interface Bloc {
  gauche: number;
  droite: number;
  bas: number;
  haut: number;
}

export interface Plateforme {
  gauche: number;
  droite: number;
  y: number;
}

export const ARENE = {
  /** Le récif : le dessus est à y = 0. */
  blocs: [
    { gauche: -7, droite: 7, bas: -2.5, haut: 0 },
    { gauche: -5, droite: 5, bas: -6, haut: -2.5 },
  ] as Bloc[],
  plateformes: [
    { gauche: -5.2, droite: -2.2, y: 2.6 },
    { gauche: 2.2, droite: 5.2, y: 2.6 },
    { gauche: -1.6, droite: 1.6, y: 4.9 },
  ] as Plateforme[],
  limites: { gauche: -17, droite: 17, bas: -9, haut: 14 },
  departs: [
    { x: -3.5, y: 0 },
    { x: 3.5, y: 0 },
  ],
  reapparition: { x: 0, y: 7.5 },
  /** Le bord du récif, pour le bot. */
  bord: 7,
};
