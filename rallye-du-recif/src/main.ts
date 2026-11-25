// Le jeu : écran titre, choix du pilote et du niveau, course, résultats.
import { Bot, type Niveau } from "./course/bot";
import { AUCUNE_COMMANDE, Course, IMAGES_PAR_SECONDE, type Commandes, type Evenement } from "./course/course";
import { hasard } from "./course/hasard";
import { LISTE_PILOTES, PILOTES, type NomPilote } from "./course/pilotes";
import { appuis, commandesJoueur, ecouterClavier, oublierFronts, TOUCHES_AFFICHEES } from "./moteur/entree";
import { arreterMoteur, arreterMusique, basculerMuet, demarrerMoteur, jouer, lancerMusique, regimeMoteur, reveillerAudio } from "./moteur/sons";
import { ICONES, NOMS_OBJETS } from "./rendu/objets";
import { couleurKart } from "./rendu/pilotes";
import { Rendu } from "./rendu/scene";
import { VueCourse } from "./rendu/vue";
import { REGLAGES } from "./reglages";

type Etat = "titre" | "pilote" | "niveau" | "course" | "pause" | "resultats";

const ui = document.querySelector<HTMLDivElement>("#ui")!;
const rendu = new Rendu(document.querySelector<HTMLCanvasElement>("#ecran")!);
const params = new URLSearchParams(location.search);
const PAS = 1 / IMAGES_PAR_SECONDE;

const NIVEAUX: Niveau[] = ["facile", "moyen", "difficile"];
const NOMS_NIVEAUX: Record<Niveau, string> = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" };
const DESC_NIVEAUX: Record<Niveau, string> = {
  facile: "Les bots ne dérapent pas et lèvent le pied.",
  moyen: "Les bots dérapent et se servent de leurs objets.",
  difficile: "Les bots chargent leurs mini-turbos et tentent le ponton.",
};

const reglage = { pilote: "rin" as NomPilote, niveau: "moyen" as Niveau };

let etat: Etat = "titre";
let course!: Course;
let vue!: VueCourse;
let bots: (Bot | null)[] = [];
let joueur: number | null = null;
let accumulateur = 0;
let temps = 0;
let choixMenu = 0;
let finJoueur = 0;
let roulette = 0;
let variantes: boolean[] = [];

// ————— Petits outils DOM —————

function el(html: string) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
function vider() {
  ui.innerHTML = "";
}
const rangTexte = (r: number) => (r === 1 ? "1<small>er</small>" : `${r}<small>e</small>`);
function chrono(secondes: number) {
  const m = Math.floor(secondes / 60);
  const s = secondes - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

// ————— Les courses —————

function nouvelleCourse(c: Course, v: boolean[], suivi: number) {
  vue?.detruire();
  course = c;
  variantes = v;
  vue = new VueCourse(rendu, c, v);
  vue.suivi = suivi;
  accumulateur = 0;
}

/** Une course de démonstration pour l'écran titre : huit bots au niveau moyen. */
function lancerDemo() {
  const engages = LISTE_PILOTES.flatMap((p) => [p, p]);
  const graine = Math.floor(Math.random() * 1e6);
  const c = new Course(engages, { graine, decompte: 0.5 });
  const alea = hasard(graine);
  bots = engages.map(() => new Bot("moyen", hasard(Math.floor(alea() * 1e9))));
  joueur = null;
  nouvelleCourse(
    c,
    engages.map((_, i) => i % 2 === 1),
    0,
  );
  vue.changerCamera("survol");
}

/** La vraie course : le joueur part dernier, les sept autres places vont aux bots. */
function lancerCourse() {
  const autres: { pilote: NomPilote; variante: boolean }[] = [];
  for (const p of LISTE_PILOTES)
    for (const variante of [false, true]) if (!(p === reglage.pilote && !variante)) autres.push({ pilote: p, variante });
  const graine = Math.floor(Math.random() * 1e6);
  const alea = hasard(graine);
  // Mélange les bots sur la grille.
  for (let i = autres.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [autres[i], autres[j]] = [autres[j], autres[i]];
  }
  const grille = [...autres, { pilote: reglage.pilote, variante: false }];
  const c = new Course(
    grille.map((g) => g.pilote),
    { graine },
  );
  joueur = grille.length - 1;
  bots = grille.map((_, i) => (i === joueur ? null : new Bot(reglage.niveau, hasard(Math.floor(alea() * 1e9)))));
  nouvelleCourse(
    c,
    grille.map((g) => g.variante),
    joueur,
  );
  vue.changerCamera("presentation");
  finJoueur = 0;
  etat = "course";
  demarrerMoteur();
  lancerMusique();
  dessinerHud();
}

let pilotePourArrivee: Bot | null = null;

function simuler(dt: number) {
  accumulateur += dt;
  let pas = 0;
  while (accumulateur >= PAS && pas < 5) {
    accumulateur -= PAS;
    pas++;
    vue.avantPas();
    const cmd: Commandes[] = course.karts.map((k, i) => {
      if (i === joueur && !bots[i]) {
        if (!k.fini) return commandesJoueur();
        pilotePourArrivee ??= new Bot("moyen", hasard(3));
        return pilotePourArrivee.commandes(course, i);
      }
      return bots[i]?.commandes(course, i) ?? AUCUNE_COMMANDE;
    });
    oublierFronts();
    course.pas(cmd);
    vue.evenements(course.evenements, etat === "titre" ? () => {} : jouer);
    if (etat === "course") for (const e of course.evenements) surEvenement(e);
  }
  // Fin de la démo : on en relance une.
  if (etat === "titre" && course.chrono > 75) lancerDemo();
}

// ————— Les écrans —————

function ecranTitre() {
  etat = "titre";
  vider();
  arreterMoteur();
  lancerDemo();
  lancerMusique(true);
  ui.append(
    el(`<div class="titre">
      <div class="logo manga"><span class="l1">RALLYE</span><span class="l2">du <span>Récif</span> !</span></div>
      <div class="sous-titre">Une course de karts faite maison</div>
      <div class="appuie manga">Appuie sur Entrée</div>
    </div>`),
  );
  ui.append(el(`<div class="aide">${TOUCHES_AFFICHEES} · M : muet</div>`));
}

function ecranPilote() {
  etat = "pilote";
  choixMenu = LISTE_PILOTES.indexOf(reglage.pilote);
  vitrine();
  dessinerPilote();
}

/** Le kart du pilote choisi, posé sur la ligne, la caméra tourne autour. */
function vitrine() {
  const p = LISTE_PILOTES[choixMenu];
  const c = new Course([p], { objets: false, decompte: 1e6 });
  bots = [null];
  joueur = null;
  nouvelleCourse(c, [false], 0);
  vue.changerCamera("vitrine");
}

function barre(nom: string, valeur: number) {
  return `<div class="stat"><span>${nom}</span><span class="barre"><i style="width:${Math.round(Math.max(0.08, Math.min(1, valeur)) * 100)}%"></i></span></div>`;
}

function dessinerPilote() {
  vider();
  const p = LISTE_PILOTES[choixMenu];
  const f = PILOTES[p];
  const cartes = el(`<div class="pilotes"></div>`);
  for (const [i, nom] of LISTE_PILOTES.entries()) {
    const fi = PILOTES[nom];
    cartes.append(
      el(`<div class="vignette ${i === choixMenu ? "actif" : ""}" style="--c:${couleurKart(nom, false)}">
        <div class="nom manga">${fi.nom}</div><div class="surnom">${fi.surnom}</div></div>`),
    );
  }
  ui.append(cartes);
  ui.append(
    el(`<div class="fiche" style="--c:${couleurKart(p, false)}">
      <div class="nom manga">${f.nom}</div>
      <div class="surnom">${f.surnom}</div>
      <div class="desc">${f.description}</div>
      ${barre("Vitesse", (f.vitesse - 0.94) / 0.08)}
      ${barre("Accélér.", (f.acceleration - 0.7) / 0.55)}
      ${barre("Virage", (f.maniabilite - 0.85) / 0.3)}
      ${barre("Poids", (f.poids - 0.5) / 1.05)}
      ${barre("Dérapage", (f.derive - 0.85) / 0.45)}
    </div>`),
  );
  ui.append(el(`<div class="aide">← → choisir · Entrée valider · Échap retour</div>`));
}

function ecranNiveau() {
  etat = "niveau";
  choixMenu = NIVEAUX.indexOf(reglage.niveau);
  dessinerNiveau();
}
function dessinerNiveau() {
  vider();
  ui.append(el(`<div class="voile"></div>`));
  const p = el(`<div class="panneau"><h2 class="manga">Niveau des bots</h2></div>`);
  NIVEAUX.forEach((n, i) => p.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${NOMS_NIVEAUX[n]}</div>`)));
  p.append(el(`<div class="explication">${DESC_NIVEAUX[NIVEAUX[choixMenu]]}</div>`));
  ui.append(p);
  ui.append(el(`<div class="aide">↑ ↓ choisir · Entrée : c'est parti ! · Échap retour</div>`));
}

// ————— Le HUD —————

let minimapPoints: SVGCircleElement[] = [];
let bornes = { x0: 0, z0: 0, l: 1, h: 1 };

function dessinerHud() {
  vider();
  const P = course.circuit.principal;
  const xs = P.echantillons.map((e) => e.x);
  const zs = P.echantillons.map((e) => e.z);
  const x0 = Math.min(...xs) - 12;
  const z0 = Math.min(...zs) - 12;
  bornes = { x0, z0, l: Math.max(...xs) + 12 - x0, h: Math.max(...zs) + 12 - z0 };
  const trace = P.echantillons
    .filter((_, i) => i % 4 === 0)
    .map((e, i) => `${i ? "L" : "M"}${(e.x - x0).toFixed(1)} ${(e.z - z0).toFixed(1)}`)
    .join(" ");
  const R = course.circuit.raccourci.echantillons.filter((_, i) => i % 4 === 0 || i === course.circuit.raccourci.echantillons.length - 1);
  const ponton = R.map((e, i) => `${i ? "L" : "M"}${(e.x - x0).toFixed(1)} ${(e.z - z0).toFixed(1)}`).join(" ");
  const depart = P.point(0);
  const hud = el(`<div class="hud-course">
    <div class="tours manga"><span class="t">TOUR</span> <span id="tour">1</span><small>/${REGLAGES.tours}</small></div>
    <div class="chrono" id="chrono">0:00.00</div>
    <div class="temps-tours" id="temps-tours"></div>
    <div class="case-objet" id="objet"></div>
    <div class="rang manga" id="rang"></div>
    <svg class="minimap" viewBox="0 0 ${bornes.l.toFixed(0)} ${bornes.h.toFixed(0)}">
      <path d="${trace} Z" class="fond-piste"/><path d="${trace} Z" class="piste"/>
      <path d="${ponton}" class="ponton"/>
      <circle cx="${(depart.x - x0).toFixed(1)}" cy="${(depart.z - z0).toFixed(1)}" r="5" class="ligne"/>
      <g id="points"></g>
    </svg>
  </div>`);
  ui.append(hud);
  const g = hud.querySelector("#points")!;
  minimapPoints = course.karts.map((k, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", i === joueur ? "7" : "4.5");
    c.setAttribute("class", i === joueur ? "moi" : "bot");
    c.setAttribute("fill", couleurKart(k.pilote, vueVariante(i)));
    g.append(c);
    return c;
  });
  if (joueur !== null) g.append(minimapPoints[joueur]);
}
const vueVariante = (i: number) => variantes[i] ?? false;

function majHud() {
  if (joueur === null) return;
  const k = course.karts[joueur];
  const $ = (id: string) => document.getElementById(id);
  const tour = $("tour");
  if (!tour) return;
  tour.textContent = String(Math.min(REGLAGES.tours, k.tour));
  $("chrono")!.textContent = chrono(k.fini ? k.temps / IMAGES_PAR_SECONDE : course.chrono);
  $("temps-tours")!.innerHTML = k.passages
    .slice(0, REGLAGES.tours)
    .map((p, i) => `<div>T${i + 1} ${chrono((p - (i ? k.passages[i - 1] : 0)) / IMAGES_PAR_SECONDE)}</div>`)
    .join("");
  const rang = $("rang")!;
  const texte = rangTexte(k.rang);
  if (rang.innerHTML !== texte) {
    rang.innerHTML = texte;
    rang.dataset.rang = String(k.rang);
    rang.classList.remove("saute");
    void rang.offsetWidth;
    rang.classList.add("saute");
  }
  const caseObjet = $("objet")!;
  let contenu = "";
  if (k.roulette > 0) {
    roulette++;
    const liste = Object.keys(ICONES) as (keyof typeof ICONES)[];
    contenu = ICONES[liste[Math.floor(roulette / 4) % liste.length]];
    if (roulette % 4 === 0) jouer("roulette");
  } else if (k.objet) contenu = ICONES[k.objet] + `<span class="nom-objet">${NOMS_OBJETS[k.objet]}</span>`;
  if (caseObjet.dataset.contenu !== contenu) {
    caseObjet.innerHTML = contenu;
    caseObjet.dataset.contenu = contenu;
    caseObjet.classList.toggle("tourne", k.roulette > 0);
  }
  for (const [i, c] of minimapPoints.entries()) {
    const a = course.karts[i];
    c.setAttribute("cx", (a.x - bornes.x0).toFixed(1));
    c.setAttribute("cy", (a.z - bornes.z0).toFixed(1));
  }
  regimeMoteur(k.v / REGLAGES.vitesseMax, k.turbo > 0, k.derive !== 0 && k.auSol ? k.palier + 1 : 0, k.chute === 0 && etat === "course");
}

function annonce(texte: string, classe = "", duree = 900) {
  const a = el(`<div class="annonce manga ${classe}">${texte}</div>`);
  ui.append(a);
  setTimeout(() => a.remove(), duree);
}

function onomatopee(texte: string, classe = "") {
  if (joueur === null) return;
  const p = vue.ecranDe(joueur, 2.4);
  if (!p.devant) return;
  const e = el(`<div class="ono manga ${classe}">${texte}</div>`);
  e.style.left = `${p.x + (Math.random() - 0.5) * 80}px`;
  e.style.top = `${p.y}px`;
  e.style.setProperty("--r", `${(Math.random() - 0.5) * 24}deg`);
  ui.append(e);
  setTimeout(() => e.remove(), 800);
}

function surEvenement(e: Evenement) {
  if (e.type === "decompte" && e.valeur! > 0) annonce(String(e.valeur), "or", 800);
  if (e.type === "depart") {
    annonce("PARTEZ !", "rouge", 900);
    vue.changerCamera("suivre");
  }
  if (e.kart !== joueur) return;
  switch (e.type) {
    case "turboDepart":
      onomatopee("TURBO !", "grand");
      break;
    case "miniTurbo":
      if (e.valeur === 2) onomatopee("VROUM !", "orange");
      break;
    case "touche":
      onomatopee(["BONG !", "AÏE !", "PAF !"][Math.floor(Math.random() * 3)], "grand rouge");
      break;
    case "bulleEclate":
      onomatopee("POP !", "bleu");
      break;
    case "plouf":
      onomatopee("PLOUF !", "grand bleu");
      break;
    case "choc":
      onomatopee("BAM !");
      break;
    case "tour":
      annonce(e.valeur === REGLAGES.tours ? "DERNIER TOUR !" : `TOUR ${e.valeur}`, e.valeur === REGLAGES.tours ? "rouge" : "", 1300);
      break;
    case "arrivee":
      finJoueur = temps;
      annonce(`ARRIVÉE ! ${rangTexte(e.valeur!)}`, e.valeur === 1 ? "or" : "", 2500);
      vue.changerCamera("arrivee");
      break;
  }
}

function ecranPause() {
  etat = "pause";
  choixMenu = 0;
  arreterMoteur();
  dessinerPause();
}
function dessinerPause() {
  document.querySelector(".pause")?.remove();
  const p = el(`<div class="pause"><div class="voile"></div><div class="panneau"><h2 class="manga">Pause</h2></div></div>`);
  ["Reprendre", "Recommencer", "Quitter la course"].forEach((o, i) => p.querySelector(".panneau")!.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${o}</div>`)));
  ui.append(p);
}

function ecranResultats() {
  etat = "resultats";
  choixMenu = 0;
  arreterMoteur();
  lancerMusique(true);
  vider();
  const classement = course.classement();
  const moi = course.karts[joueur!];
  const lignes = classement
    .map((k) => {
      const f = PILOTES[k.pilote];
      const temps = k.fini ? chrono(k.temps / IMAGES_PAR_SECONDE) : "—";
      const meilleur = k.passages.length
        ? chrono(Math.min(...k.passages.slice(0, REGLAGES.tours).map((p, i) => p - (i ? k.passages[i - 1] : 0))) / IMAGES_PAR_SECONDE)
        : "—";
      return `<tr class="${k.numero === joueur ? "moi" : ""}"><td>${rangTexte(k.rang)}</td><td><i style="background:${couleurKart(k.pilote, vueVariante(k.numero))}"></i>${f.nom}${k.numero === joueur ? " (toi)" : ""}</td><td>${temps}</td><td>${meilleur}</td></tr>`;
    })
    .join("");
  ui.append(el(`<div class="voile leger"></div>`));
  ui.append(
    el(`<div class="resultats">
      <div class="gagnant manga"><div class="grand">${moi.rang === 1 ? "VICTOIRE !" : moi.rang <= 3 ? "SUR LE PODIUM !" : "ARRIVÉE"}</div>
      <div class="petit">${rangTexte(moi.rang)} sur ${course.karts.length}</div></div>
      <table><tr><th>Place</th><th>Pilote</th><th>Temps</th><th>Meilleur tour</th></tr>${lignes}</table>
      <div class="options"></div>
    </div>`),
  );
  dessinerOptionsResultats();
}
function dessinerOptionsResultats() {
  const o = document.querySelector(".resultats .options");
  if (!o) return;
  o.innerHTML = "";
  ["Rejouer", "Changer de pilote", "Titre"].forEach((t, i) => o.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${t}</div>`)));
}

// ————— Les touches des menus —————

function menus() {
  for (const t of appuis()) {
    if (t === "KeyM") {
      basculerMuet();
      continue;
    }
    const valider = t === "Enter" || t === "Space";
    const haut = t === "ArrowUp" || t === "KeyW";
    const bas = t === "ArrowDown" || t === "KeyS";
    const gauche = t === "ArrowLeft" || t === "KeyA";
    const droite = t === "ArrowRight" || t === "KeyD";
    if (etat === "titre" && valider) {
      jouer("valider");
      ecranPilote();
    } else if (etat === "pilote") {
      if (gauche || droite) {
        choixMenu = (choixMenu + (droite ? 1 : -1) + LISTE_PILOTES.length) % LISTE_PILOTES.length;
        reglage.pilote = LISTE_PILOTES[choixMenu];
        jouer("menu");
        vitrine();
        dessinerPilote();
      } else if (valider) {
        reglage.pilote = LISTE_PILOTES[choixMenu];
        jouer("valider");
        ecranNiveau();
      } else if (t === "Escape") {
        jouer("retourMenu");
        ecranTitre();
      }
    } else if (etat === "niveau") {
      if (haut || bas) {
        choixMenu = (choixMenu + (bas ? 1 : -1) + NIVEAUX.length) % NIVEAUX.length;
        reglage.niveau = NIVEAUX[choixMenu];
        jouer("menu");
        dessinerNiveau();
      } else if (valider) {
        jouer("valider");
        lancerCourse();
      } else if (t === "Escape") {
        jouer("retourMenu");
        ecranPilote();
      }
    } else if (etat === "course") {
      if (t === "Escape" || t === "KeyP") ecranPause();
    } else if (etat === "pause") {
      if (haut || bas) {
        choixMenu = (choixMenu + (bas ? 1 : -1) + 3) % 3;
        jouer("menu");
        dessinerPause();
      } else if (t === "Escape" || t === "KeyP" || (valider && choixMenu === 0)) {
        document.querySelector(".pause")?.remove();
        etat = "course";
        accumulateur = 0;
      } else if (valider && choixMenu === 1) lancerCourse();
      else if (valider && choixMenu === 2) ecranTitre();
    } else if (etat === "resultats") {
      if (gauche || droite) {
        choixMenu = (choixMenu + (droite ? 1 : -1) + 3) % 3;
        jouer("menu");
        dessinerOptionsResultats();
      } else if (valider) {
        jouer("valider");
        if (choixMenu === 0) lancerCourse();
        else if (choixMenu === 1) ecranPilote();
        else ecranTitre();
      }
    }
  }
}

// ————— La boucle —————

let dernier = performance.now();
function boucle() {
  const maintenant = performance.now();
  const dt = Math.max(0, Math.min(0.1, (maintenant - dernier) / 1000));
  dernier = maintenant;
  temps += dt;
  menus();
  if (etat === "titre" || etat === "course" || etat === "resultats") simuler(dt);
  if (etat === "pilote" || etat === "niveau") {
    vue.maj(dt, temps, 0);
  } else vue.maj(dt, temps, etat === "pause" ? 1 : accumulateur / PAS);
  if (etat === "course") {
    majHud();
    const moi = course.karts[joueur!];
    if (moi.fini && temps - finJoueur > 5) ecranResultats();
  }
  rendu.dessiner(temps);
  requestAnimationFrame(boucle);
}

ecouterClavier(reveillerAudio);
window.addEventListener("pointerdown", reveillerAudio);

// Raccourcis de mise au point : ?direct=rin,moyen lance une course tout de suite.
const direct = params.get("direct");
if (direct !== null) {
  const [p, n] = direct.split(",");
  if (LISTE_PILOTES.includes(p as NomPilote)) reglage.pilote = p as NomPilote;
  if (NIVEAUX.includes(n as Niveau)) reglage.niveau = n as Niveau;
  lancerCourse();
  if (params.has("bot")) bots[joueur!] = new Bot("difficile", hasard(9));
  // &avance=20 : saute les 20 premières secondes de la course.
  const avance = Number(params.get("avance") ?? 0);
  if (avance > 0) {
    vue.changerCamera("suivre");
    for (let i = 0; i < avance * IMAGES_PAR_SECONDE; i++) simuler(PAS);
  }
} else ecranTitre();
if (params.has("pilote")) ecranPilote();
(window as unknown as { rallye: object }).rallye = { get course() { return course; }, get vue() { return vue; } };
requestAnimationFrame(boucle);
if (params.has("debug")) setInterval(() => console.log("DEBUG", JSON.stringify({ impact: rendu.final.uniforms.uImpact.value, vitesse: rendu.final.uniforms.uVitesse.value, image: course.image, cam: rendu.camera.position.toArray().map((v) => v.toFixed(1)), fov: rendu.camera.fov.toFixed(0), appels: rendu.renderer.info.render.calls, triangles: rendu.renderer.info.render.triangles, etat, k: [course.karts[7].x.toFixed(1), course.karts[7].y.toFixed(1), course.karts[7].z.toFixed(1)] })), 1000);
