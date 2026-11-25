// Les cinq zones de la mine : chacune a son titre, sa lumière et sa musique.
export type Zone = "puits" | "galeries" | "crevasse" | "noyees" | "coeur";

export const TITRES: Record<Zone, { titre: string; sousTitre: string }> = {
  puits: { titre: "Le Puits", sousTitre: "là où la lumière tombe encore" },
  galeries: { titre: "Les Galeries", sousTitre: "le bois se souvient des mineurs" },
  crevasse: { titre: "La Crevasse", sousTitre: "les cristaux chantent dans le noir" },
  noyees: { titre: "Les Galeries noyées", sousTitre: "l'eau a tout repris" },
  coeur: { titre: "Le Cœur", sousTitre: "ce qui dort au fond" },
};
