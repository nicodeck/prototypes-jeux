// Le catalogue des bâtiments et des marchandises d'Aurea.
//
// Une case vaut environ trois mètres. L'emprise d'un bâtiment est donnée sans rotation :
// `l` cases d'ouest en est (axe x), `p` cases du nord au sud (axe z). La façade regarde le sud
// (+z) ; une rotation d'un quart de tour la tourne vers l'est, puis le nord, puis l'ouest.

export type TypeBatiment =
  | "maison"
  | "entrepot"
  | "peche"
  | "bucheron"
  | "ferme"
  | "moulin"
  | "boulangerie"
  | "oliveraie"
  | "pressoir"
  | "vigne"
  | "cave"
  | "carriere"
  | "forum"
  | "thermes"
  | "temple"
  // Déjà là au début de la partie, on ne peut pas les construire
  | "port"
  | "phare";

export type Marchandise = "bois" | "marbre" | "poisson" | "ble" | "farine" | "pain" | "olives" | "huile" | "raisin" | "vin";

/** Le niveau d'une maison : 0 = Liberti (affranchis), 1 = Plebeii (la plèbe), 2 = Equites (chevaliers). */
export type Palier = 0 | 1 | 2;

export type Categorie = "habitat" | "production" | "services" | "monuments";

/** Où le bâtiment a le droit de se poser, en plus d'un terrain plat et libre. */
export type Emplacement = "partout" | "cote" | "foret" | "roche";

export interface Cout {
  denarii: number;
  bois?: number;
  marbre?: number;
}

export interface Fiche {
  nom: string;
  latin: string;
  categorie: Categorie;
  l: number;
  p: number;
  cout: Cout;
  /** Denarii par minute */
  entretien: number;
  emplacement: Emplacement;
  /** Le niveau des habitants à atteindre pour débloquer le bâtiment */
  debloque: Palier | 3;
  description: string;
  /** Production : une unité de `produit` toutes les `duree` secondes, en consommant une unité de `consomme`. */
  produit?: Marchandise;
  consomme?: Marchandise;
  duree?: number;
  /** Les services (forum, thermes, temple) servent les maisons à moins de `rayon` cases. */
  rayon?: number;
  constructible: boolean;
}

export const FICHES: Record<TypeBatiment, Fiche> = {
  maison: {
    nom: "Maison",
    latin: "Domus",
    categorie: "habitat",
    l: 2,
    p: 2,
    cout: { denarii: 40, bois: 2 },
    entretien: 0,
    emplacement: "partout",
    debloque: 0,
    description: "Des Liberti viennent s'y installer. Comblés, ils montent en Plebeii, puis en Equites.",
    constructible: true,
  },
  entrepot: {
    nom: "Entrepôt",
    latin: "Horreum",
    categorie: "production",
    l: 3,
    p: 3,
    cout: { denarii: 300, bois: 6 },
    entretien: 6,
    emplacement: "partout",
    debloque: 0,
    description: "Les charrettes y livrent les marchandises. Un atelier doit être relié par la route à un entrepôt ou au port.",
    constructible: true,
  },
  peche: {
    nom: "Pêcherie",
    latin: "Piscatoria",
    categorie: "production",
    l: 2,
    p: 2,
    cout: { denarii: 120, bois: 3 },
    entretien: 8,
    emplacement: "cote",
    debloque: 0,
    produit: "poisson",
    duree: 20,
    description: "Au bord de l'eau. Les barques sortent à l'aube et rentrent au crépuscule.",
    constructible: true,
  },
  bucheron: {
    nom: "Bûcheron",
    latin: "Lignarius",
    categorie: "production",
    l: 2,
    p: 2,
    cout: { denarii: 80 },
    entretien: 4,
    emplacement: "foret",
    debloque: 0,
    produit: "bois",
    duree: 16,
    description: "Près d'une forêt de pins. Il ne coupe que des arbres morts : la forêt reste.",
    constructible: true,
  },
  forum: {
    nom: "Forum",
    latin: "Forum",
    categorie: "services",
    l: 6,
    p: 6,
    cout: { denarii: 450, bois: 10 },
    entretien: 18,
    emplacement: "partout",
    debloque: 0,
    rayon: 15,
    description: "Le marché et la place publique. Toutes les maisons en ont besoin.",
    constructible: true,
  },
  ferme: {
    nom: "Ferme à blé",
    latin: "Villa rustica",
    categorie: "production",
    l: 4,
    p: 4,
    cout: { denarii: 160, bois: 4 },
    entretien: 6,
    emplacement: "partout",
    debloque: 1,
    produit: "ble",
    duree: 24,
    description: "Une ferme et son champ de blé doré.",
    constructible: true,
  },
  moulin: {
    nom: "Moulin",
    latin: "Pistrinum",
    categorie: "production",
    l: 2,
    p: 2,
    cout: { denarii: 180, bois: 4 },
    entretien: 8,
    emplacement: "partout",
    debloque: 1,
    consomme: "ble",
    produit: "farine",
    duree: 12,
    description: "Un âne fait tourner la meule. Du blé, il fait de la farine.",
    constructible: true,
  },
  boulangerie: {
    nom: "Boulangerie",
    latin: "Furnus",
    categorie: "production",
    l: 2,
    p: 2,
    cout: { denarii: 200, bois: 4 },
    entretien: 10,
    emplacement: "partout",
    debloque: 1,
    consomme: "farine",
    produit: "pain",
    duree: 12,
    description: "Le four à pain fume dès l'aube.",
    constructible: true,
  },
  oliveraie: {
    nom: "Oliveraie",
    latin: "Olivetum",
    categorie: "production",
    l: 4,
    p: 4,
    cout: { denarii: 160, bois: 3 },
    entretien: 6,
    emplacement: "partout",
    debloque: 1,
    produit: "olives",
    duree: 22,
    description: "Des oliviers centenaires, alignés sur la pente.",
    constructible: true,
  },
  pressoir: {
    nom: "Pressoir",
    latin: "Torcular",
    categorie: "production",
    l: 2,
    p: 2,
    cout: { denarii: 220, bois: 5 },
    entretien: 10,
    emplacement: "partout",
    debloque: 1,
    consomme: "olives",
    produit: "huile",
    duree: 14,
    description: "Des olives, il tire l'huile, qu'on garde en amphores.",
    constructible: true,
  },
  thermes: {
    nom: "Thermes",
    latin: "Thermae",
    categorie: "services",
    l: 5,
    p: 5,
    cout: { denarii: 700, bois: 12, marbre: 6 },
    entretien: 24,
    emplacement: "partout",
    debloque: 1,
    rayon: 15,
    description: "Bains chauds, tièdes et froids. Les Plebeii en ont besoin.",
    constructible: true,
  },
  carriere: {
    nom: "Carrière de marbre",
    latin: "Lapicidina",
    categorie: "production",
    l: 3,
    p: 3,
    cout: { denarii: 260, bois: 6 },
    entretien: 10,
    emplacement: "roche",
    debloque: 1,
    produit: "marbre",
    duree: 20,
    description: "Contre une paroi rocheuse. Le marbre sert aux thermes et au temple.",
    constructible: true,
  },
  vigne: {
    nom: "Vignoble",
    latin: "Vinea",
    categorie: "production",
    l: 4,
    p: 4,
    cout: { denarii: 220, bois: 4 },
    entretien: 8,
    emplacement: "partout",
    debloque: 2,
    produit: "raisin",
    duree: 22,
    description: "Des rangs de vigne sur les coteaux ensoleillés.",
    constructible: true,
  },
  cave: {
    nom: "Cave à vin",
    latin: "Cella vinaria",
    categorie: "production",
    l: 3,
    p: 2,
    cout: { denarii: 320, bois: 6, marbre: 2 },
    entretien: 12,
    emplacement: "partout",
    debloque: 2,
    consomme: "raisin",
    produit: "vin",
    duree: 14,
    description: "On y foule le raisin et le vin vieillit dans de grandes jarres enterrées.",
    constructible: true,
  },
  temple: {
    nom: "Temple de Jupiter",
    latin: "Templum",
    categorie: "monuments",
    l: 6,
    p: 8,
    cout: { denarii: 3000, bois: 30, marbre: 40 },
    entretien: 0,
    emplacement: "partout",
    debloque: 3,
    rayon: 22,
    description: "Le couronnement de la cité. Sa consécration ouvre une grande fête, et les maisons alentour paient davantage.",
    constructible: true,
  },
  port: {
    nom: "Port",
    latin: "Portus",
    categorie: "production",
    l: 6,
    p: 4,
    cout: { denarii: 0 },
    entretien: 0,
    emplacement: "cote",
    debloque: 0,
    description: "Le cœur marchand de l'île. Il sert d'entrepôt, et les navires y accostent.",
    constructible: false,
  },
  phare: {
    nom: "Phare",
    latin: "Pharus",
    categorie: "monuments",
    l: 2,
    p: 2,
    cout: { denarii: 0 },
    entretien: 0,
    emplacement: "partout",
    debloque: 0,
    description: "Son feu guide les navires dans la nuit.",
    constructible: false,
  },
};

/** Les besoins de chaque niveau d'habitants. */
export interface Besoins {
  /** Biens consommés, en unités par habitant et par minute */
  biens: Partial<Record<Marchandise, number>>;
  services: TypeBatiment[];
  /** Habitants par maison quand tout est satisfait, et au minimum */
  capacite: number;
  plancher: number;
  /** Impôt, en denarii par habitant et par minute, quand tout est satisfait */
  impot: number;
}

export const BESOINS: Record<Palier, Besoins> = {
  0: { biens: { poisson: 0.05 }, services: ["forum"], capacite: 8, plancher: 3, impot: 1.4 },
  1: { biens: { poisson: 0.04, pain: 0.05, huile: 0.04 }, services: ["forum", "thermes"], capacite: 16, plancher: 8, impot: 2.4 },
  2: { biens: { poisson: 0.03, pain: 0.04, huile: 0.04, vin: 0.04 }, services: ["forum", "thermes"], capacite: 24, plancher: 16, impot: 3.6 },
};

export const NOMS_PALIERS: Record<Palier, { nom: string; pluriel: string }> = {
  0: { nom: "Libertus", pluriel: "Liberti" },
  1: { nom: "Plebeius", pluriel: "Plebeii" },
  2: { nom: "Eques", pluriel: "Equites" },
};

/** Ce qu'il faut pour débloquer chaque niveau (et le temple, au niveau 3). */
export const SEUILS: Record<1 | 2 | 3, { palier: Palier; habitants: number }> = {
  1: { palier: 0, habitants: 100 },
  2: { palier: 1, habitants: 220 },
  3: { palier: 2, habitants: 320 },
};

/** Ce que coûte une montée de niveau, prélevé au moment où la maison s'agrandit. */
export const COUT_EVOLUTION: Record<1 | 2, Cout> = {
  1: { denarii: 30, bois: 2 },
  2: { denarii: 60, bois: 2, marbre: 1 },
};

export const NOMS_MARCHANDISES: Record<Marchandise, string> = {
  bois: "Bois",
  marbre: "Marbre",
  poisson: "Poisson",
  ble: "Blé",
  farine: "Farine",
  pain: "Pain",
  olives: "Olives",
  huile: "Huile",
  raisin: "Raisin",
  vin: "Vin",
};

export const COUT_ROUTE = 2;

/** Emprise d'un bâtiment une fois tourné de `rotation` quarts de tour. */
export function emprise(type: TypeBatiment, rotation: number) {
  const f = FICHES[type];
  return rotation % 2 === 0 ? { l: f.l, p: f.p } : { l: f.p, p: f.l };
}
