// La boucle de jeu : l'écran titre, le voyage, la pause et la fin.
import { ecouterClavier, lireCommandes, oublierAppuis, unAppui, vientDAppuyer } from "./moteur/entree";
import { basculerMuet, cristal, demarrerAmbiance, finale, glissade, reglerAmbiance, reveillerAudio, son } from "./moteur/sons";
import { CASE, lireMine } from "./monde/mine";
import { AUCUNE_COMMANDE, creerMonde, etape, type Monde } from "./monde/monde";
import { TITRES, type Zone } from "./monde/zones";
import { creerVue } from "./rendu/vue";

const PAS = 1 / 60;
const params = new URLSearchParams(location.search);

const mine = lireMine();
const monde: Monde = creerMonde(mine);
// Raccourci de mise au point : ?col=110&ligne=30 démarre à cet endroit de la mine
if (params.has("col")) {
  monde.heros.x = Number(params.get("col")) * CASE + 3;
  monde.heros.y = Number(params.get("ligne")) * CASE - 6;
}
for (let i = 0; i < 20; i++) etape(monde, AUCUNE_COMMANDE);

const toile = document.getElementById("ecran") as HTMLCanvasElement;
const vue = creerVue(toile, mine, monde.salle);
vue.cadrer(monde);

const $ = (id: string) => document.getElementById(id)!;
const titre = $("titre");
const carte = $("zone");
const hud = $("lanternes");
const aide = $("aide");
const pause = $("pause");
const fin = $("fin");
hud.innerHTML = mine.lanternes.map(() => "<span></span>").join("");

type Etat = "titre" | "jeu" | "pause" | "fin";
let etat: Etat = "titre";
const zonesVues = new Set<Zone>();
let minuterieCarte = 0;
let minuterieHud = 0;
let tempsFin = -1;
let aideMontree = false;
let bouge = 0;

function montrerZone(zone: Zone) {
  if (zonesVues.has(zone)) return;
  zonesVues.add(zone);
  carte.querySelector("h2")!.textContent = TITRES[zone].titre;
  carte.querySelector("p")!.textContent = TITRES[zone].sousTitre;
  carte.classList.add("visible");
  minuterieCarte = 4.5;
}

function commencer() {
  reveillerAudio();
  demarrerAmbiance();
  etat = "jeu";
  titre.classList.add("parti");
  setTimeout(() => montrerZone(mine.salles[monde.salle].zone), 1800);
  setTimeout(() => {
    if (!aideMontree && etat === "jeu") {
      aide.classList.add("visible");
      aideMontree = true;
    }
  }, 6000);
}

ecouterClavier(() => {
  reveillerAudio();
  if (etat !== "titre") demarrerAmbiance();
});
if (params.has("direct")) {
  titre.style.display = "none";
  etat = "jeu";
  zonesVues.add(mine.salles[monde.salle].zone);
}

// La position de Veilleuse avant le dernier pas, pour une image fluide entre deux pas
let avantX = monde.heros.x;
let avantY = monde.heros.y;
let reste = 0;
let derniere = performance.now();
let zonePrecedente = mine.salles[monde.salle].zone;

function image(maintenant: number) {
  const dt = Math.min(0.1, (maintenant - derniere) / 1000);
  derniere = maintenant;

  if (vientDAppuyer("KeyM")) basculerMuet();
  if (etat === "titre") {
    if (unAppui()) commencer();
  } else if (etat === "pause") {
    if (vientDAppuyer("Escape", "KeyP")) {
      etat = "jeu";
      pause.classList.remove("visible");
    }
  } else if (etat === "jeu") {
    if (vientDAppuyer("Escape", "KeyP") && !monde.fini) {
      etat = "pause";
      pause.classList.add("visible");
      son("pause");
    }
  } else if (etat === "fin") {
    if (tempsFin > 16 && unAppui()) location.reload();
  }
  oublierAppuis();

  const h = monde.heros;
  if (etat === "jeu" || etat === "fin") {
    reste += dt;
    while (reste >= PAS) {
      reste -= PAS;
      avantX = h.x;
      avantY = h.y;
      const c = etat === "jeu" && !monde.fini ? lireCommandes() : AUCUNE_COMMANDE;
      if (c.gauche || c.droite) bouge += PAS;
      etape(monde, c);
      vue.evenements(monde.evenements);
      for (const e of monde.evenements) {
        const pan = Math.max(-1, Math.min(1, (e.x / CASE - (avantX + 5) / CASE) * 0.1));
        if (e.sorte === "atterrit") son(e.force > 0.6 ? "atterritFort" : "atterrit", pan);
        else if (e.sorte === "lanterne") {
          son("lanterne", pan);
          hud.children[e.numero].classList.add("allumee");
          hud.classList.add("visible");
          minuterieHud = 5;
        } else if (e.sorte === "coeur") {
          finale();
          etat = "fin";
          tempsFin = 0;
          const n = monde.allumees.filter(Boolean).length;
          fin.querySelector(".l3")!.textContent = `${n} lanterne${n > 1 ? "s" : ""} rallumée${n > 1 ? "s" : ""} sur ${monde.allumees.length}`;
          setTimeout(() => fin.classList.add("visible"), 3500);
        } else son(e.sorte, pan);
      }
    }
  }
  if (etat === "fin") tempsFin += dt;

  // Les panneaux qui s'effacent d'eux-mêmes
  if (minuterieCarte > 0) {
    minuterieCarte -= dt;
    if (minuterieCarte <= 0) carte.classList.remove("visible");
  }
  if (minuterieHud > 0) {
    minuterieHud -= dt;
    if (minuterieHud <= 0) hud.classList.remove("visible");
  }
  if (aideMontree && bouge > 8) aide.classList.remove("visible");

  // Une nouvelle zone : son titre apparaît une fois le fondu passé
  const zone = mine.salles[vue.salleCam].zone;
  if (zone !== zonePrecedente && vue.fondu < 0.5) {
    zonePrecedente = zone;
    montrerZone(zone);
  }

  const a = etat === "jeu" || etat === "fin" ? reste / PAS : 1;
  const x = (avantX + (h.x - avantX) * a + h.l / 2) / CASE;
  const y = -(avantY + (h.y - avantY) * a + h.h) / CASE;
  reglerAmbiance({ zone, sousLEau: h.dansEau && !h.surface, eclat: monde.allumees.filter(Boolean).length / monde.allumees.length, titre: etat === "titre" });
  glissade(etat === "jeu" && h.mur !== 0 ? 1 : 0);
  vue.dessiner(dt, monde, x, y, (note, pan) => cristal(note, pan, 0.7));
  requestAnimationFrame(image);
}

requestAnimationFrame(image);

// Pour la mise au point depuis la console
(window as unknown as { veilleuse: unknown }).veilleuse = { monde, vue };
