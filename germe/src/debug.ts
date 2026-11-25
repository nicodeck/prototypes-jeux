// Les paramètres d'URL de mise au point.
//   ?direct        saute l'écran titre
//   ?vite=8        accélère la vie (herbe, arbres, sources) par ce facteur
//   ?heure=0.5     heure de départ (0 minuit, 0.5 midi)
//   ?vie=0.6       planète déjà verte à ce point (à peu près)
//   ?graines=20    graines en poche au départ
//   ?fin           montre la séquence de fin dès le chargement
//   ?cendre=10     premier vent de cendre au bout de 10 s
//   ?muet          sans le son
//   ?fps           affiche le temps par image
const p = new URLSearchParams(typeof location !== "undefined" ? location.search : "");

function nombre(nom: string, defaut: number) {
  const v = p.get(nom);
  if (v === null || v === "") return defaut;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
}

export const DEBUG = {
  direct: p.has("direct") || p.has("fin"),
  vite: nombre("vite", 1),
  heure: p.has("heure") ? nombre("heure", 0.3) : null,
  vie: nombre("vie", 0),
  graines: p.has("graines") ? nombre("graines", 1) : null,
  fin: p.has("fin"),
  cendre: p.has("cendre") ? nombre("cendre", 10) : null,
  muet: p.has("muet"),
  fps: p.has("fps"),
  /** Position de caméra fixe pour les captures : ?cam=orbite */
  cam: p.get("cam"),
};
