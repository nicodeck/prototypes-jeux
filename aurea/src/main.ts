// Aurea : la boucle de jeu. L'écran titre, la caméra, les outils de construction, la vitesse du
// temps, le mode cinéma, les sons et les grands moments (nouveau niveau, consécration du temple).
//
// Raccourcis de mise au point :
// - `?direct` saute l'écran titre, `?vitrine` bâtit d'abord une grande cité ;
// - `&heure=18.5` règle l'heure, `&figer` la fige, `&meteo=orage` impose le temps ;
// - `&cam=x,z,distance,lacet` place la caméra, `&cinema` lance le mode cinéma.
// Dans la console, `aurea.ville` donne l'état de la cité.
import { ecouter, enfoncee, oublier, souris, vientDAppuyer } from "./moteur/entree";
import { basculerMuet, demarrerAmbiance, reglerAmbiance, reveillerAudio, son, type Son } from "./moteur/sons";
import { REGLAGES } from "./reglages";
import { Batiments } from "./rendu/batiments";
import { DISTANCE_MAX, DISTANCE_MIN, type Plan } from "./rendu/camera";
import { Curseur } from "./rendu/curseur";
import { Vue } from "./rendu/vue";
import { Interface, type Outil } from "./ui/interface";
import { batirEnAccelere } from "./ville/architecte";
import { fonderBourg } from "./ville/bourg";
import { emprise, FICHES, NOMS_PALIERS, type TypeBatiment } from "./ville/catalogue";
import { hachage } from "./ville/hasard";
import { dansCarte, hauteur, indice, TAILLE } from "./ville/ile";
import { traceEnL, type Case } from "./ville/routes";
import type { Meteo } from "./ville/temps";
import { PAS, Ville, type Batiment } from "./ville/ville";

const params = new URLSearchParams(location.search);
const ville = new Ville();
fonderBourg(ville);
if (params.has("heure")) ville.horloge.heure = Number(params.get("heure"));
if (params.has("meteo")) ville.horloge.imposer(params.get("meteo") as Meteo, true);
if (params.has("figer")) ville.horloge.figee = true;

const toile = document.getElementById("ecran") as HTMLCanvasElement;
const vue = new Vue(toile);
const curseur = new Curseur();
vue.scene.add(curseur.groupe);

type Etat = "titre" | "jeu";
let etat: Etat = params.has("direct") || params.has("cam") || params.has("vitrine") ? "jeu" : "titre";
let vitesse = 1;
let vitesseAvantPause = 1;
let outil: Outil = null;
let rotation = 0;
let debutRoute: Case | null = null;
let selection: number | null = null;
let fete = 0;
let cinema = false;
let prochainPlan = 0;
let fondu = 0;
let fonduCible = 0;
let planEnAttente: { de: Plan; vers: Plan; duree: number } | null = null;
let tempsTitre = 0;

const ui = new Interface({
  choisirOutil: (o) => choisirOutil(o),
  vitesse: (v) => reglerVitesse(v),
  meteo: () => implorerJupiter(),
  muet: () => basculerMuet(),
  cinema: () => basculerCinema(),
  commencer: (vitrine) => commencer(vitrine),
  survol: () => son("clic"),
});

// -------------------------------------------------------------------------------------------
// Le début
// -------------------------------------------------------------------------------------------

/** La vue de départ : depuis la baie, vers le bourg et les collines */
const VUE_DEPART: Plan = { x: 59, z: 84, distance: 40, lacet: 0.32 };

function survolTitre() {
  // Un long plan bas au-dessus de la baie, qui remonte doucement vers le bourg
  vue.camera.lancerCinema({ x: 62, z: 104, distance: 13, lacet: 0.55, tangage: 0.08 }, { x: 58, z: 92, distance: 26, lacet: 0.18, tangage: 0.2 }, 70);
}

if (etat === "titre") {
  ville.horloge.heure = params.has("heure") ? ville.horloge.heure : 5.75;
  ui.ecranTitre();
  survolTitre();
} else if (params.has("cam")) {
  const [x, z, distance, lacet] = params.get("cam")!.split(",").map(Number);
  vue.camera.sauter({ x: x!, z: z!, distance: distance!, lacet: lacet! });
} else vue.camera.sauter(VUE_DEPART);

function commencer(vitrine: boolean) {
  reveillerAudio();
  demarrerAmbiance();
  son("ouvrir");
  if (vitrine) batirVitrine();
  etat = "jeu";
  ui.quitterTitre();
  vue.camera.arreterCinema();
  vue.camera.voulu.x = VUE_DEPART.x;
  vue.camera.voulu.z = VUE_DEPART.z;
  vue.camera.voulu.distance = vitrine ? 70 : VUE_DEPART.distance;
  vue.camera.voulu.lacet = VUE_DEPART.lacet;
  setTimeout(() => ui.astuce("Molette pour s'approcher · clic droit glissé pour se déplacer · H pour l'aide", false, 7), 2500);
}

function batirVitrine() {
  const heure = ville.horloge.heure;
  const figee = ville.horloge.figee;
  ville.horloge.figee = true;
  batirEnAccelere(ville, 52 * 60);
  ville.horloge.figee = figee;
  ville.horloge.heure = heure;
  ville.chronique.lignes = [];
  vitesse = 1;
}

if (params.has("vitrine") && etat === "jeu") batirVitrine();

// -------------------------------------------------------------------------------------------
// Les outils
// -------------------------------------------------------------------------------------------

function choisirOutil(o: Outil) {
  if (o && o !== "route" && o !== "demolir" && !ville.debloque(o)) {
    ui.astuce("Pas encore débloqué", true);
    son("refus");
    return;
  }
  outil = o;
  debutRoute = null;
  ui.choisirOutil(o);
  if (o) selection = null;
  son(o ? "clic" : "fermer");
}

function reglerVitesse(v: number) {
  if (v > 0) vitesseAvantPause = v;
  vitesse = v;
  son("clic");
}

const SUITE_METEO: Meteo[] = ["clair", "voile", "nuageux", "pluie", "orage"];
function implorerJupiter() {
  const n = SUITE_METEO[(SUITE_METEO.indexOf(ville.horloge.meteo) + 1) % SUITE_METEO.length]!;
  ville.horloge.imposer(n);
  ui.astuce(`Jupiter vous entend : ${({ clair: "le ciel se dégage", voile: "un voile de nuages", nuageux: "les nuages s'amoncellent", pluie: "la pluie arrive", orage: "l'orage gronde" } as const)[n]}.`);
  son(n === "orage" ? "tonnerre" : "clic");
}

/** Passe au prochain beau moment de la journée */
function momentSuivant() {
  const moments = [5.9, 9.5, 13, 18.4, 21.5];
  const h = ville.horloge.heure;
  const suivant = moments.find((m) => m > h + 0.2) ?? moments[0]!;
  ville.horloge.heure = suivant;
  ui.astuce(["L'aube", "Le matin", "Midi", "Le couchant", "La nuit"][moments.indexOf(suivant)]!);
}

/** L'emprise d'un bâtiment centrée sous la souris */
function placement(type: TypeBatiment, p: { x: number; z: number }, r: number) {
  const { l, p: pr } = emprise(type, r);
  return { i: Math.floor(p.x - l / 2 + 0.5), j: Math.floor(p.z - pr / 2 + 0.5), l, p: pr };
}

/** Pour les bâtiments de bord de mer, on tourne tout seul la façade vers l'eau */
function meilleureRotation(type: TypeBatiment, p: { x: number; z: number }) {
  if (FICHES[type].emplacement !== "cote") return rotation;
  for (const r of [rotation, (rotation + 1) % 4, (rotation + 2) % 4, (rotation + 3) % 4]) {
    const pl = placement(type, p, r);
    if (ville.peutPoser(type, pl.i, pl.j, r, true).ok) return r;
  }
  return rotation;
}

function solSous(i: number, j: number, l: number, p: number) {
  let s = -Infinity;
  for (let z = j; z <= j + p; z++) for (let x = i; x <= i + l; x++) s = Math.max(s, dansCarte(Math.min(x, TAILLE - 1), Math.min(z, TAILLE - 1)) ? ville.ile.coins[z * (TAILLE + 1) + x] ?? 0 : 0);
  return s;
}

function sonA(nom: Son, x: number, z: number, volume = 1) {
  const cam = vue.camera.camera;
  const d = Math.hypot(cam.position.x - x, cam.position.z - z);
  const a = Math.atan2(x - cam.position.x, z - cam.position.z);
  const lacet = vue.camera.actuel.lacet + Math.PI;
  const pan = Math.max(-1, Math.min(1, Math.sin(a - lacet) * 1.3));
  son(nom, pan, volume * Math.max(0.15, Math.min(1, 40 / (d + 10))));
}

// -------------------------------------------------------------------------------------------
// Le mode cinéma
// -------------------------------------------------------------------------------------------

function basculerCinema() {
  cinema = !cinema;
  ui.cacher(cinema);
  if (cinema) {
    prochainPlan = 0;
    ui.astuce("Mode cinéma · C pour revenir", false, 3);
  } else {
    vue.camera.arreterCinema();
    fonduCible = 0;
  }
}

function choisirPlan(): { de: Plan; vers: Plan; duree: number } {
  const lieux: { x: number; z: number; d: number }[] = [];
  for (const b of ville.batiments.values()) {
    const c = ville.centre(b);
    const poids = b.type === "temple" ? 6 : b.type === "forum" || b.type === "thermes" || b.type === "port" ? 3 : b.type === "maison" && b.palier === 2 ? 2 : b.type === "phare" ? 2 : 1;
    for (let k = 0; k < poids; k++) lieux.push({ x: c.x, z: c.z, d: b.type === "temple" ? 18 : b.type === "phare" ? 22 : b.type === "maison" ? 9 : 13 });
  }
  const a = ville.decor.aqueduc[Math.floor(Math.random() * ville.decor.aqueduc.length)];
  if (a) lieux.push({ x: a.i + 0.5, z: a.j + 0.5, d: 12 });
  const l = lieux[Math.floor(Math.random() * lieux.length)]!;
  const lacet = Math.random() * Math.PI * 2;
  const large = Math.random() < 0.25;
  const d = large ? 55 + Math.random() * 40 : l.d * (0.7 + Math.random() * 0.8);
  const t = large ? undefined : 0.16 + Math.random() * 0.24;
  const sens = Math.random() < 0.5 ? -1 : 1;
  return {
    de: { x: l.x, z: l.z, distance: d, lacet, tangage: t },
    vers: { x: l.x + (Math.random() - 0.5) * 4, z: l.z + (Math.random() - 0.5) * 4, distance: d * (0.75 + Math.random() * 0.2), lacet: lacet + sens * (0.35 + Math.random() * 0.35), tangage: t !== undefined ? t + 0.04 : undefined },
    duree: 13 + Math.random() * 6,
  };
}

// -------------------------------------------------------------------------------------------
// L'écoute du paysage, pour les sons
// -------------------------------------------------------------------------------------------

function ecoute() {
  const c = vue.camera.actuel;
  const R = 5 + c.distance * 0.35;
  let mer = 0;
  let nature = 0;
  let villeN = 0;
  let ateliers = 0;
  let n = 0;
  for (let dz = -4; dz <= 4; dz++)
    for (let dx = -4; dx <= 4; dx++) {
      const i = Math.floor(c.x + (dx / 4) * R);
      const j = Math.floor(c.z + (dz / 4) * R);
      n++;
      if (!dansCarte(i, j)) {
        mer++;
        continue;
      }
      const k = indice(i, j);
      if (ville.ile.sols[k] === "eau") mer++;
      else if (ville.occupation[k]) {
        const b = ville.batiments.get(ville.occupation[k]!)!;
        if (b.type === "maison" || b.type === "forum" || b.type === "thermes" || b.type === "temple") villeN++;
        else if (b.type === "ferme" || b.type === "oliveraie" || b.type === "vigne") nature++;
        else ateliers++;
      } else if (ville.routes[k]) villeN += 0.5;
      else nature++;
    }
  const port = [...ville.batiments.values()].find((b) => b.type === "port");
  const dPort = port ? Math.hypot(c.x - (port.i + 3), c.z - (port.j + 2)) : 99;
  const pop = ville.population();
  return {
    heure: ville.horloge.heure,
    pluie: ville.horloge.ciel.pluie,
    orage: ville.horloge.ciel.orage,
    vent: ville.horloge.ciel.vent,
    zoom: Math.min(1, Math.max(0, (c.distance - DISTANCE_MIN) / (DISTANCE_MAX - DISTANCE_MIN))),
    mer: mer / n,
    nature: nature / n,
    ville: Math.min(1, (villeN / n) * 2.2),
    ateliers: Math.min(1, (ateliers / n) * 4),
    port: Math.max(0, 1 - dPort / 30),
    population: pop.total,
    palier: Math.min(2, ville.palierMax) as 0 | 1 | 2,
    fete: fete > 0,
    titre: etat === "titre",
    pause: vitesse === 0,
  };
}

// -------------------------------------------------------------------------------------------
// La boucle
// -------------------------------------------------------------------------------------------

let audioPret = false;
ecouter(toile, () => {
  if (!audioPret) {
    audioPret = true;
    reveillerAudio();
    if (etat === "jeu") demarrerAmbiance();
  }
});

let reste = 0;
let derniere = performance.now();
let minuterieUi = 0;
let minuterieSon = 0;
const tonnerres: number[] = [];

function traiterEvenements() {
  for (const e of ville.evenements) {
    if (e.sorte === "construit") {
      const b = ville.batiments.get(e.id);
      if (b && etat === "jeu" && b.type !== "phare" && b.type !== "port") sonA("construit", b.i + b.l / 2, b.j + b.p / 2, 0.8);
    } else if (e.sorte === "evolution") {
      const b = ville.batiments.get(e.id);
      if (b) sonA("evolution", b.i + 1, b.j + 1, 0.7);
    } else if (e.sorte === "palier") {
      son("palier");
      if (e.palier === 1) ui.annoncer("NOVA AETAS", "PLEBEII", "La plèbe s'installe : elle réclame pain, huile et thermes.");
      else if (e.palier === 2) ui.annoncer("NOVA AETAS", "EQVITES", "Les chevaliers arrivent : ils veulent du vin de nos coteaux.");
      else ui.annoncer("FAVOR DEORVM", "TEMPLVM", "La cité est digne des dieux : bâtissez le temple de Jupiter.");
    } else if (e.sorte === "temple") {
      son("temple");
      fete = 120;
      ui.annoncer("PAX DEORVM", "IVPPITER", "Le temple est consacré. Que la fête commence !", 10);
    } else if (e.sorte === "eclair") {
      vue.eclairer();
      tonnerres.push(0.4 + Math.random() * 2.2);
    } else if (e.sorte === "navire" && e.phase === "approche") {
      setTimeout(() => son("navire", 0, 0.8), 1500);
    }
  }
}

function camera(dt: number) {
  const cam = vue.camera;
  if (cinema || etat === "titre") return;
  const vitesseCam = cam.voulu.distance * 0.9 * dt;
  let dx = 0;
  let dz = 0;
  if (enfoncee("KeyW", "ArrowUp")) dz += 1;
  if (enfoncee("KeyS", "ArrowDown")) dz -= 1;
  if (enfoncee("KeyA", "ArrowLeft")) dx -= 1;
  if (enfoncee("KeyD", "ArrowRight")) dx += 1;
  if (dx || dz) cam.deplacer(dx * vitesseCam, dz * vitesseCam);
  if (enfoncee("KeyQ")) cam.tourner(dt * 1.6);
  if (enfoncee("KeyE")) cam.tourner(-dt * 1.6);
  if (enfoncee("PageUp", "Equal", "NumpadAdd")) cam.zoomer(Math.pow(0.4, dt));
  if (enfoncee("PageDown", "Minus", "NumpadSubtract")) cam.zoomer(Math.pow(2.5, dt));
  if (souris.droite && (souris.dx || souris.dy)) cam.deplacer(-souris.dx * cam.voulu.distance * 0.0016, souris.dy * cam.voulu.distance * 0.0016);
  if (souris.milieu && souris.dx) cam.tourner(-souris.dx * 0.006);
  if (souris.molette && !souris.surInterface) {
    const p = vue.pointSol(souris.nx, souris.ny);
    cam.zoomer(Math.pow(1.0015, souris.molette), p ?? undefined);
  }
}

function outils() {
  if (etat !== "jeu" || cinema) return;
  const p = souris.surInterface ? null : vue.pointSol(souris.nx, souris.ny);
  const t = vue.terrain.uniforms;
  t.uGrille.value += ((outil && outil !== "demolir" ? 1 : 0) - t.uGrille.value) * 0.2;
  if (p) t.uCurseur.value.set(p.x, p.z);
  vue.batiments.selection.survol = null;
  vue.batiments.montrerFantome(null, 0, 0, 0, true, 0);
  curseur.cacher();

  // La portée du service choisi, ou de celui qu'on pose
  const portee = t.uPortee.value;
  portee.w *= 0.85;

  if (!p) return;
  const i = Math.floor(p.x);
  const j = Math.floor(p.z);

  if (outil === "route") {
    if (souris.appui) debutRoute = { i, j };
    const trace = debutRoute ? traceEnL(debutRoute, { i, j }) : [{ i, j }];
    curseur.montrer(trace.map((c) => ({ c, ok: ville.routePossible(c.i, c.j) && !ville.estRoute(c.i, c.j) ? true : ville.estRoute(c.i, c.j) })));
    if (souris.relache && debutRoute) {
      const n = ville.poserRoutes(trace);
      if (n > 0) sonA("route", p.x, p.z);
      else if (trace.some((c) => !ville.estRoute(c.i, c.j))) {
        ui.astuce(ville.denarii < 2 ? "Pas assez de denarii" : "On ne peut pas tracer de route ici", true);
        son("refus");
      }
      debutRoute = null;
    }
    return;
  }

  if (outil === "demolir") {
    const b = ville.batimentEn(i, j);
    if (b && FICHES[b.type].constructible) vue.batiments.selection.survol = b.id;
    else if (ville.estRoute(i, j)) curseur.montrer([{ c: { i, j }, ok: false }]);
    if (souris.clic) {
      if (ville.demolir(i, j)) sonA("demolir", p.x, p.z);
      else son("refus");
    }
    return;
  }

  if (outil) {
    const r = meilleureRotation(outil, p);
    const pl = placement(outil, p, r);
    const verdict = ville.peutPoser(outil, pl.i, pl.j, r);
    vue.batiments.montrerFantome(outil, pl.i, pl.j, r, verdict.ok, solSous(pl.i, pl.j, pl.l, pl.p));
    const rayon = Batiments.rayon(outil);
    if (rayon) portee.set(pl.i + pl.l / 2, pl.j + pl.p / 2, rayon, 1);
    if (souris.clic) {
      if (verdict.ok && ville.poser(outil, pl.i, pl.j, r)) {
        sonA("poser", p.x, p.z);
      } else {
        ui.astuce(verdict.raison ?? "Impossible ici", true);
        son("refus");
      }
    }
    return;
  }

  // Sans outil : survoler et choisir
  const b = ville.batimentEn(i, j);
  vue.batiments.selection.survol = b?.id ?? null;
  if (souris.clic) {
    selection = b && b.id !== selection ? b.id : null;
    son(selection ? "ouvrir" : "fermer");
  }
  const choisi = selection ? ville.batiments.get(selection) : null;
  if (choisi && FICHES[choisi.type].rayon) portee.set(choisi.i + choisi.l / 2, choisi.j + choisi.p / 2, FICHES[choisi.type].rayon!, 1);
}

function clavier() {
  if (vientDAppuyer("KeyM")) basculerMuet();
  if (etat !== "jeu") return;
  if (vientDAppuyer("KeyC")) basculerCinema();
  if (vientDAppuyer("Escape")) {
    if (ui.aideOuverte()) ui.basculerAide(false);
    else if (cinema) basculerCinema();
    else if (outil) choisirOutil(null);
    else selection = null;
  }
  if (cinema) return;
  if (vientDAppuyer("KeyH", "Slash")) ui.basculerAide();
  if (vientDAppuyer("Space")) reglerVitesse(vitesse === 0 ? vitesseAvantPause : 0);
  if (vientDAppuyer("Digit1") && !outil) reglerVitesse(1);
  if (vientDAppuyer("Digit2") && !outil) reglerVitesse(2);
  if (vientDAppuyer("Digit3") && !outil) reglerVitesse(4);
  if (vientDAppuyer("KeyT")) {
    ville.horloge.figee = !ville.horloge.figee;
    ui.astuce(ville.horloge.figee ? "L'heure est figée (T pour la libérer)" : "Le temps reprend son cours");
  }
  if (vientDAppuyer("KeyN")) momentSuivant();
  if (vientDAppuyer("KeyX", "Delete", "Backspace")) choisirOutil(outil === "demolir" ? null : "demolir");
  if (vientDAppuyer("KeyR")) {
    if (outil && outil !== "route" && outil !== "demolir") {
      rotation = (rotation + 1) % 4;
      son("clic");
    } else choisirOutil(outil === "route" ? null : "route");
  }
  if (souris.droite && souris.glisse < 4 && outil) {
    // un clic droit franc annule l'outil
  }
  for (let n = 1; n <= 9; n++) {
    if (vientDAppuyer(`Digit${n}`) && outil !== null) {
      const o = ui.outilPourTouche(String(n));
      if (o !== undefined) choisirOutil(o);
    }
  }
}

window.addEventListener("mouseup", (e) => {
  if (e.button === 2 && souris.glisse < 5 && etat === "jeu") {
    if (outil) choisirOutil(null);
    else selection = null;
  }
});

function image(maintenant: number) {
  const dt = Math.max(0, Math.min(0.1, (maintenant - derniere) / 1000));
  derniere = maintenant;

  clavier();
  camera(dt);
  outils();

  // La simulation
  const v = etat === "titre" ? 1 : vitesse;
  reste += dt * v;
  let pas = 0;
  while (reste >= PAS && pas < 12) {
    reste -= PAS;
    pas++;
    ville.pas();
    traiterEvenements();
    vue.particules.evenements(ville.evenements, ville);
  }
  if (pas >= 12) reste = 0;

  for (let k = tonnerres.length - 1; k >= 0; k--) {
    tonnerres[k]! -= dt;
    if (tonnerres[k]! <= 0) {
      son("tonnerre");
      tonnerres.splice(k, 1);
    }
  }
  if (fete > 0) fete -= dt;

  // L'écran titre : le survol tourne en boucle, l'aube se lève
  if (etat === "titre") {
    tempsTitre += dt;
    if (!vue.camera.cinema || vue.camera.cinema.t >= 1) survolTitre();
  }

  // Le mode cinéma : des plans qui s'enchaînent en fondu
  if (cinema) {
    prochainPlan -= dt;
    if (prochainPlan <= 0 && !planEnAttente) {
      planEnAttente = choisirPlan();
      fonduCible = 1;
    }
    if (planEnAttente && fondu > 0.98) {
      vue.camera.lancerCinema(planEnAttente.de, planEnAttente.vers, planEnAttente.duree);
      prochainPlan = planEnAttente.duree - 1.2;
      planEnAttente = null;
      fonduCible = 0;
    }
  }
  fondu += (fonduCible - fondu) * Math.min(1, dt * 3.5);
  if (Math.abs(fonduCible - fondu) < 0.01) fondu = fonduCible;
  vue.post.final.uFondu.value = fondu;

  vue.pause += ((vitesse === 0 && etat === "jeu" ? 1 : 0) - vue.pause) * Math.min(1, dt * 4);
  vue.batiments.selection.choisi = selection;
  vue.fete = fete > 0;
  vue.image(dt, ville);

  minuterieUi -= dt;
  if (minuterieUi <= 0) {
    minuterieUi = 0.1;
    if (etat === "jeu") {
      const b: Batiment | null = selection ? (ville.batiments.get(selection) ?? null) : null;
      if (selection && !b) selection = null;
      ui.mettreAJour(ville, vitesse, b);
    }
  }
  minuterieSon -= dt;
  if (minuterieSon <= 0) {
    minuterieSon = 0.1;
    reglerAmbiance(ecoute());
  }
  oublier();
  requestAnimationFrame(image);
}

if (params.has("cinema")) basculerCinema();
requestAnimationFrame(image);

(window as unknown as Record<string, unknown>).aurea = {
  ville,
  vue,
  regler: (v: number) => (vitesse = v),
  REGLAGES,
  hauteur,
  hachage,
  NOMS_PALIERS,
};
