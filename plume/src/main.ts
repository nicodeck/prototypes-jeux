// La boucle du jeu : lit les commandes, fait avancer le monde 60 fois par seconde, dessine.
import { NIVEAU_1 } from "./monde/niveau-1";
import { lireNiveau, T } from "./monde/niveau";
import { creerMonde, etape, type Monde } from "./monde/monde";
import { creerEcran, dessiner, ecrire, HAUTEUR, LARGEUR } from "./moteur/ecran";
import { ecouterClavier, lireCommandes, oublierAppuis, vientDAppuyer } from "./moteur/entree";
import { arreterMusique, basculerMuet, lancerMusique, reveillerAudio, SONS } from "./moteur/sons";
import { caseSol, dessinerFond, dessinerInterface, dessinerMonde, nouvelleCamera, reagir, suivre, viderParticules, type Camera } from "./rendu/rendu";
import { PALETTE } from "./rendu/palette";
import * as D from "./rendu/dessins";

const ecran = creerEcran(document.getElementById("ecran") as HTMLCanvasElement);
const niveau = lireNiveau(NIVEAU_1);

let scene: "titre" | "jeu" | "fin" = "titre";
let monde: Monde = creerMonde(niveau);
let camera: Camera = nouvelleCamera(monde);
let pause = false;
let muet = false;
let finDepuis = 0;
let image = 0;

ecouterClavier(reveillerAudio);

function commencer() {
  monde = creerMonde(niveau);
  const params = new URLSearchParams(location.search);
  if (params.get("colonne")) {
    // Pour tester : ?colonne=150&ligne=10 démarre à cet endroit
    monde.heros.x = Number(params.get("colonne")) * T + 3;
    monde.heros.y = Number(params.get("ligne") ?? 1) * T;
    monde.reprise = { x: monde.heros.x, y: monde.heros.y };
  }
  camera = nouvelleCamera(monde);
  viderParticules();
  pause = false;
  finDepuis = 0;
  scene = "jeu";
  lancerMusique();
}

function mettreAJour() {
  image++;
  const commandes = lireCommandes();
  const valider = vientDAppuyer("Space", "Enter");
  if (vientDAppuyer("KeyM")) muet = basculerMuet();

  if (scene === "titre" && valider) commencer();
  else if (scene === "fin" && valider && image - finDepuis > 60) commencer();
  else if (scene === "jeu") {
    if (vientDAppuyer("KeyP", "Escape")) pause = !pause;
    if (!pause) {
      etape(monde, commandes);
      for (const e of monde.evenements) SONS[e.sorte]?.();
      reagir(monde.evenements, monde, camera);
      suivre(camera, monde);
      if (monde.gagne && ++finDepuis > 180) {
        scene = "fin";
        finDepuis = image;
        arreterMusique();
      }
    }
  }
  oublierAppuis();
}

function dessinerTitre(ctx: CanvasRenderingContext2D) {
  const faux = creerMonde(niveau);
  faux.temps = image;
  dessinerFond(ctx, { x: image * 0.6, y: 0, avance: 0, secousse: 0 }, faux);
  for (let x = 0; x < LARGEUR; x += T) {
    ctx.drawImage(caseSol(1), x, HAUTEUR - 2 * T);
    ctx.drawImage(caseSol(0), x, HAUTEUR - T);
  }
  ecrire(ctx, "PLUME", LARGEUR / 2, 22, PALETTE.J, { echelle: 5, aligner: "centre", ombre: PALETTE.N });
  ecrire(ctx, "UN PETIT OISEAU QUI NE SAIT PAS VOLER", LARGEUR / 2, 62, PALETTE.N, { aligner: "centre" });
  if (Math.floor(image / 30) % 2 === 0) ecrire(ctx, "APPUIE SUR ESPACE", LARGEUR / 2, 84, PALETTE.B, { aligner: "centre", ombre: PALETTE.N });
  ecrire(ctx, "← → MARCHER   X COURIR   ESPACE SAUTER\n↓ DESCENDRE   P PAUSE   M MUET", LARGEUR / 2, 104, PALETTE.N, { aligner: "centre" });
  const course = [D.HEROS.course0, D.HEROS.course1, D.HEROS.course2, D.HEROS.course3];
  dessiner(ctx, course[Math.floor(image / 5) % 4], ((image * 1.2) % (LARGEUR + 40)) - 20, HAUTEUR - 3 * T);
}

function dessinerFin(ctx: CanvasRenderingContext2D) {
  dessinerMonde(ctx, monde, camera);
  ctx.fillStyle = "rgba(27,20,36,0.7)";
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ecrire(ctx, "BRAVO !", LARGEUR / 2, 24, PALETTE.J, { echelle: 3, aligner: "centre", ombre: PALETTE.N });
  ecrire(ctx, "PLUME A RETROUVÉ SON NID", LARGEUR / 2, 54, PALETTE.B, { aligner: "centre" });
  const s = Math.floor(monde.stats.temps / 60);
  const lignes: [string, string][] = [
    ["GRAINES", `${monde.stats.graines} / ${monde.stats.grainesTotal}`],
    ["ŒUFS D'OR", `${monde.stats.oeufs} / ${monde.stats.oeufsTotal}`],
    ["TEMPS", `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`],
    ["CHUTES", `${monde.stats.chutes}`],
  ];
  lignes.forEach(([nom, valeur], i) => {
    if (image - finDepuis < 20 + i * 15) return;
    ecrire(ctx, nom, LARGEUR / 2 - 60, 76 + i * 12, PALETTE.B);
    ecrire(ctx, valeur, LARGEUR / 2 + 60, 76 + i * 12, PALETTE.J, { aligner: "droite" });
  });
  if (Math.floor(image / 30) % 2 === 0) ecrire(ctx, "ESPACE : REJOUER", LARGEUR / 2, 140, PALETTE.B, { aligner: "centre" });
}

function dessinerTout() {
  const ctx = ecran.ctx;
  if (scene === "titre") dessinerTitre(ctx);
  else if (scene === "fin") dessinerFin(ctx);
  else {
    dessinerMonde(ctx, monde, camera);
    dessinerInterface(ctx, monde);
    if (muet) ecrire(ctx, "MUET", LARGEUR - 40, 2, PALETTE.g, { aligner: "droite" });
    if (pause) {
      ctx.fillStyle = "rgba(27,20,36,0.6)";
      ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
      ecrire(ctx, "PAUSE", LARGEUR / 2, 70, PALETTE.B, { echelle: 3, aligner: "centre" });
      ecrire(ctx, "P POUR REPRENDRE", LARGEUR / 2, 100, PALETTE.g, { aligner: "centre" });
    }
  }
  ecran.presenter();
}

// Pas de temps fixe : le monde avance toujours d'une image de 1/60 s, quelle que soit la vitesse de l'écran.
let precedent = performance.now();
let reserve = 0;
function boucle(maintenant: number) {
  reserve += Math.min(maintenant - precedent, 100);
  precedent = maintenant;
  while (reserve >= 1000 / 60) {
    mettreAJour();
    reserve -= 1000 / 60;
  }
  dessinerTout();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);

// Pour les essais automatiques
Object.assign(window, { plume: { get monde() { return monde; }, get scene() { return scene; } } });
