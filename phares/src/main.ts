// Point d'entrée : lit les paramètres d'URL, crée le jeu et lance la boucle.
//
// Paramètres de debug :
//   ?direct        saute l'écran titre
//   ?auto          pilote automatique (vise le prochain phare)
//   ?fantome       le bateau traverse récifs et îles
//   ?invincible    pas de dégâts
//   ?phares=3      les 3 premiers phares à rallumer sont déjà allumés
//   ?x=..&z=..&cap=..  position et cap de départ (cap en degrés)
//   ?vue=phare|haut|cote  caméra fixe pour les captures
//   ?q=0.5         qualité (résolution de rendu)
//   ?debug         affiche l'état de la simulation

import { Jeu } from "./jeu";

const p = new URLSearchParams(location.search);
const nombre = (cle: string, defaut: number) => (p.has(cle) ? Number(p.get(cle)) : defaut);

const jeu = new Jeu(document.getElementById("ecran") as HTMLCanvasElement, document.getElementById("ui")!, {
  direct: p.has("direct") || p.has("auto"),
  auto: p.has("auto"),
  fantome: p.has("fantome"),
  invincible: p.has("invincible"),
  phares: nombre("phares", 0),
  qualite: nombre("q", 1),
  debug: p.has("debug"),
  depart: p.has("x") ? { x: nombre("x", 0), z: nombre("z", 0), cap: (nombre("cap", 0) * Math.PI) / 180 } : null,
  vue: p.get("vue"),
});

// accès depuis la console et les scripts de vérification
(window as unknown as { jeu: Jeu }).jeu = jeu;

document.addEventListener("pointerdown", () => {
  if (jeu.etat === "titre") jeu.commencer();
  else jeu.son.demarrer();
});
window.addEventListener("keydown", () => {
  if (jeu.etat !== "titre") jeu.son.demarrer();
});

// Résolution adaptative : si la machine peine, on baisse la définition du rendu.
let precedent = performance.now();
let cumul = 0;
let images = 0;
const adaptative = !p.has("q");
function boucle(maintenant: number) {
  const dt = Math.min(0.1, (maintenant - precedent) / 1000);
  precedent = maintenant;
  jeu.maj(dt);
  jeu.rendre();
  cumul += dt;
  images++;
  if (cumul > 2.5) {
    const moyenne = cumul / images;
    if (adaptative && moyenne > 1 / 42) jeu.rendu.ajusterQualite(0.85);
    else if (adaptative && moyenne < 1 / 58) jeu.rendu.ajusterQualite(1.08);
    cumul = 0;
    images = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
