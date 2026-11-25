// Le jeu : écran titre, choix du mode et des persos, combat, résultats.
import { Vector3 } from "three";
import { Bot, hasard, type Niveau } from "./combat/bot";
import { AUCUNE_COMMANDE, Combat, type Commandes } from "./combat/combat";
import { PERSOS, type NomPerso } from "./combat/persos";
import { appuis, commandesJoueur, ecouterClavier, oublierFronts, TOUCHES_AFFICHEES } from "./moteur/entree";
import { arreterMusique, basculerMuet, jouer, lancerMusique, reveillerAudio } from "./moteur/sons";
import { Rendu } from "./rendu/scene";
import { COULEURS_JOUEURS, VueCombat } from "./rendu/vue";

type Etat = "titre" | "mode" | "persos" | "decompte" | "combat" | "pause" | "fin" | "resultats";
type Pilote = (combat: Combat, i: number) => Commandes;

const ui = document.querySelector<HTMLDivElement>("#ui")!;
const rendu = new Rendu(document.querySelector<HTMLCanvasElement>("#ecran")!);
const params = new URLSearchParams(location.search);

const NIVEAUX: Niveau[] = ["facile", "moyen", "difficile"];
const NOMS_NIVEAUX: Record<Niveau, string> = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" };
const LISTE_PERSOS: NomPerso[] = ["ballerina", "tung"];
const FICHES: Record<NomPerso, { desc: string; vitesse: number; puissance: number; poids: number; sauts: number }> = {
  ballerina: {
    desc: "Une danseuse étoile, une tasse de cappuccino en guise de tête. Enchaîne deux grands battements et une pirouette, tourbillonne en l'air, fonce en fouetté. Mais elle est légère : elle vole loin.",
    vitesse: 0.9,
    puissance: 0.45,
    poids: 0.3,
    sauts: 3,
  },
  tung: {
    desc: "Une bûche qui vient te réveiller à coups de batte. Lent mais terrible : encaisse les coups pendant son élan, écrase vers le bas en l'air, et charge un « tung tung tung » qui brise les gardes.",
    vitesse: 0.45,
    puissance: 0.95,
    poids: 0.9,
    sauts: 2,
  },
};

const reglage = {
  deuxJoueurs: false,
  persos: ["ballerina", "tung"] as [NomPerso, NomPerso],
  niveau: "moyen" as Niveau,
};

let etat: Etat = "titre";
let combat: Combat;
let vue: VueCombat;
let pilotes: Pilote[] = [];
let accumulateur = 0;
let temps = 0;
let minuterie = 0;
let choixMenu = 0;
let derniersDegats = [0, 0];
let derniersVies = [3, 3];
let viesAuDepart = 3;

// ————— Petits outils DOM —————

function el(html: string) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
function vider() {
  ui.innerHTML = "";
}
const couleurJoueur = (i: number) => COULEURS_JOUEURS[i];

// ————— Combats —————

function bot(niveau: Niveau, graine: number): Pilote {
  const b = new Bot(niveau, hasard(graine));
  return (c, i) => b.commandes(c, i);
}

function nouvelleVue(c: Combat) {
  vue?.detruire();
  combat = c;
  vue = new VueCombat(rendu, c);
  accumulateur = 0;
}

function lancerDemo() {
  nouvelleVue(new Combat([Math.random() < 0.5 ? "ballerina" : "tung", Math.random() < 0.5 ? "tung" : "ballerina"]));
  const g = Math.floor(Math.random() * 1e6);
  pilotes = [bot("moyen", g), bot("moyen", g + 1)];
}

function simuler(dt: number) {
  accumulateur += dt * vue.ralenti;
  let pas = 0;
  while (accumulateur >= 1 / 60 && pas < 5) {
    accumulateur -= 1 / 60;
    pas++;
    const cmd = pilotes.map((p, i) => p(combat, i));
    oublierFronts();
    combat.pas(cmd);
    vue.evenements(combat.evenements, jouer);
    for (const e of combat.evenements) surEvenement(e);
  }
}

// ————— Les écrans —————

function ecranTitre() {
  etat = "titre";
  vider();
  lancerDemo();
  rendu.final.uniforms.uVignette.value = 1;
  ui.append(
    el(`<div class="titre">
      <div class="logo manga"><span class="l1">BRAINROT</span><span class="l2">Clash au <span>Récif</span> !</span></div>
      <div class="sous-titre">Ballerina Cappuccina contre Tung Tung Tung Sahur</div>
      <div class="appuie manga">Appuie sur Entrée</div>
    </div>`),
  );
  ui.append(el(`<div class="aide">${TOUCHES_AFFICHEES.solo} · M : muet</div>`));
}

function ecranMode() {
  etat = "mode";
  choixMenu = reglage.deuxJoueurs ? 1 : 0;
  dessinerMode();
}
function dessinerMode() {
  vider();
  ui.append(el(`<div class="voile"></div>`));
  const options = ["1 joueur contre le bot", "2 joueurs, même clavier"];
  const p = el(`<div class="panneau"><h2 class="manga">Mode de jeu</h2></div>`);
  options.forEach((o, i) => p.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${o}</div>`)));
  ui.append(p);
  ui.append(
    el(`<div class="aide">${choixMenu === 1 ? `J1 : ${TOUCHES_AFFICHEES.j1} — J2 : ${TOUCHES_AFFICHEES.j2}` : TOUCHES_AFFICHEES.solo}</div>`),
  );
}

function ecranPersos() {
  etat = "persos";
  choixMenu = 0;
  apercu();
  dessinerPersos();
}
function apercu() {
  nouvelleVue(new Combat(reglage.persos));
  pilotes = [() => ({ ...AUCUNE_COMMANDE }), () => ({ ...AUCUNE_COMMANDE })];
}
function lignesPersos() {
  const lignes = [
    { nom: reglage.deuxJoueurs ? "J1" : "Toi", val: PERSOS[reglage.persos[0]].nom },
    { nom: reglage.deuxJoueurs ? "J2" : "Bot", val: PERSOS[reglage.persos[1]].nom },
  ];
  if (!reglage.deuxJoueurs) lignes.push({ nom: "Niveau du bot", val: NOMS_NIVEAUX[reglage.niveau] });
  lignes.push({ nom: "", val: "COMBAT !" });
  return lignes;
}
function carte(i: number, cote: "g" | "d") {
  const nom = reglage.persos[i];
  const p = PERSOS[nom];
  const f = FICHES[nom];
  const qui = reglage.deuxJoueurs ? `J${i + 1}` : i === 0 ? "Toi" : `Bot · ${NOMS_NIVEAUX[reglage.niveau]}`;
  const stat = (n: string, v: number) => `<div class="stat"><span>${n}</span><div class="barre"><i style="width:${v * 100}%"></i></div></div>`;
  return el(`<div class="carte-perso ${cote}">
    <span class="qui" style="background:${couleurJoueur(i)}">${qui}</span>
    <div class="nom manga">${p.nom}</div>
    <div class="surnom">${p.surnom}</div>
    <div class="desc">${f.desc}</div>
    ${stat("Vitesse", f.vitesse)}${stat("Puissance", f.puissance)}${stat("Poids", f.poids)}${stat("Sauts", f.sauts / 3)}
  </div>`);
}
function dessinerPersos() {
  vider();
  const conteneur = el(`<div class="persos"></div>`);
  conteneur.append(carte(0, "g"), carte(1, "d"));
  const sel = el(`<div class="selection"></div>`);
  lignesPersos().forEach((l, i) => {
    const fleches = l.nom ? `<span class="fleche">◀ </span>${l.val}<span class="fleche"> ▶</span>` : l.val;
    sel.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${l.nom ? `${l.nom} : <span class="val">${fleches}</span>` : fleches}</div>`));
  });
  conteneur.append(sel);
  ui.append(conteneur);
  ui.append(el(`<div class="aide">↑ ↓ choisir · ← → changer · Entrée valider · Échap retour</div>`));
}

function demarrerCombat() {
  nouvelleVue(new Combat(reglage.persos, Number(params.get("vies") ?? 3)));
  const graine = Math.floor(Math.random() * 1e6);
  pilotes = reglage.deuxJoueurs
    ? [() => commandesJoueur(0, true), () => commandesJoueur(1, true)]
    : [() => commandesJoueur(0, false), bot(reglage.niveau, graine)];
  derniersDegats = [0, 0];
  derniersVies = [combat.combattants[0].vies, combat.combattants[1].vies];
  viesAuDepart = combat.combattants[0].vies;
  etat = "decompte";
  minuterie = 0;
  vider();
  dessinerHud();
  lancerMusique();
}

// ————— Le HUD —————

let hud: { pct: HTMLElement; vies: HTMLElement[]; jauge: HTMLElement }[] = [];
let etiquettes: HTMLElement[] = [];

function dessinerHud() {
  const h = el(`<div class="hud"></div>`);
  hud = combat.combattants.map((c, i) => {
    const qui = reglage.deuxJoueurs ? `J${i + 1}` : i === 0 ? "J1" : "CPU";
    const j = el(`<div class="jauge">
      <div class="fond"></div>
      <div class="bandeau" style="background:${couleurJoueur(i)}"></div>
      <div class="nom manga" style="color:${couleurJoueur(i)}">${c.perso.court}</div>
      <div class="pct manga">0<small>%</small></div>
      <div class="vies"></div>
    </div>`);
    const vies = Array.from({ length: c.vies }, () => {
      const v = el(`<i style="background:${couleurJoueur(i)}"></i>`);
      j.querySelector(".vies")!.append(v);
      return v;
    });
    h.append(j);
    const e = el(`<div class="etiquette" style="background:${couleurJoueur(i)}">${qui}</div>`);
    ui.append(e);
    etiquettes[i] = e;
    return { pct: j.querySelector<HTMLElement>(".pct")!, vies, jauge: j };
  });
  ui.append(h);
}

function couleurDegats(p: number) {
  const etapes: [number, [number, number, number]][] = [
    [0, [255, 255, 255]],
    [40, [255, 236, 110]],
    [80, [255, 160, 50]],
    [120, [255, 70, 50]],
    [180, [170, 10, 30]],
  ];
  for (let i = 1; i < etapes.length; i++) {
    const [p1, c1] = etapes[i];
    const [p0, c0] = etapes[i - 1];
    if (p <= p1) {
      const t = (p - p0) / (p1 - p0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(",")})`;
    }
  }
  return "rgb(120,0,20)";
}

function majHud() {
  if (!hud.length) return;
  combat.combattants.forEach((c, i) => {
    const h = hud[i];
    const d = Math.floor(c.degats);
    if (d !== derniersDegats[i]) {
      h.pct.innerHTML = `${d}<small>%</small>`;
      h.pct.style.color = couleurDegats(d);
      if (d > derniersDegats[i]) {
        h.jauge.classList.remove("secoue");
        void h.jauge.offsetWidth;
        h.jauge.classList.add("secoue");
      }
      derniersDegats[i] = d;
    }
    if (c.vies !== derniersVies[i]) {
      h.vies.forEach((v, k) => v.classList.toggle("perdue", k >= c.vies));
      derniersVies[i] = c.vies;
    }
    const e = etiquettes[i];
    if (e) {
      const p = vue.ecranDe(i);
      const visible = c.etat !== "ko" && etat !== "resultats";
      e.style.display = visible ? "block" : "none";
      e.style.left = `${Math.max(20, Math.min(innerWidth - 20, p.x))}px`;
      e.style.top = `${Math.max(30, Math.min(innerHeight - 20, p.y))}px`;
    }
  });
}

// ————— Onomatopées et annonces —————

const ONOS = {
  ballerina: {
    lourd: ["BAM !", "MI MI MI !", "BOUM !"],
    tranchant: ["MI MI MI !", "FOUETTÉ !", "SHHK !"],
    leger: ["PAF !", "MI !", "TAK !"],
  },
  tung: {
    lourd: ["TUNG TUNG TUNG !", "TUNG TUNG !", "SAHUR !"],
    tranchant: ["TUNG !"],
    leger: ["TUNG !", "TOC !"],
  },
};

let derniereOno = 0;
function onomatopee(x: number, y: number, texte: string, classe = "", forcer = false) {
  // Une seule à la fois, sauf pour les grands moments.
  if (!forcer && temps - derniereOno < 0.35) return;
  derniereOno = temps;
  const e = el(`<div class="ono manga ${classe}">${texte}</div>`);
  e.style.left = `${Math.max(80, Math.min(innerWidth - 80, x))}px`;
  e.style.top = `${Math.max(60, Math.min(innerHeight - 140, y))}px`;
  e.style.setProperty("--r", `${(Math.random() - 0.5) * 30}deg`);
  ui.append(e);
  setTimeout(() => e.remove(), 750);
}

function annonce(texte: string, classe = "", duree = 650) {
  ui.querySelectorAll(".annonce").forEach((a) => a.remove());
  const e = el(`<div class="annonce manga ${classe}">${texte}</div>`);
  ui.append(e);
  if (duree > 0) setTimeout(() => e.remove(), duree);
}

function surEvenement(e: Combat["evenements"][number]) {
  if (etat !== "combat" && etat !== "fin") return;
  if (e.type === "touche" && !e.garde) {
    const p = rendu.versEcran(new Vector3(e.x, e.y + 0.6, 0));
    const onos = ONOS[combat.combattants[e.attaquant].nom];
    if (e.armure) {
      if (e.degats >= 6) onomatopee(p.x, p.y - 40, "TOC !");
    } else if (e.force > 26 || e.effet !== "leger") {
      const liste = e.effet === "tranchant" ? onos.tranchant : e.force > 30 ? onos.lourd : onos.leger;
      onomatopee(p.x, p.y - 40, liste[Math.floor(Math.random() * liste.length)], e.force > 40 ? "grand" : "");
    }
  }
  if (e.type === "brise") {
    const c = combat.combattants[e.joueur];
    const p = rendu.versEcran(new Vector3(c.x, c.y + 2.5, 0));
    onomatopee(p.x, p.y, "CRAC !", "grand rouge", true);
  }
  if (e.type === "ko") {
    const p = rendu.versEcran(new Vector3(e.x, e.y, 0));
    onomatopee(p.x, p.y, "BOOOM !", "grand rouge", true);
  }
  if (e.type === "fin") {
    etat = "fin";
    minuterie = 0;
    vue.ralenti = 0.2;
    jouer("fin");
    arreterMusique();
  }
}

// ————— Résultats —————

function ecranResultats() {
  etat = "resultats";
  const g = combat.gagnant ?? 0;
  const c = combat.combattants[g];
  // Le gagnant revient au centre du récif pour poser.
  Object.assign(c, { x: 0, y: 0, vx: 0, vy: 0, ex: 0, ey: 0, auSol: true, etat: "libre", invincible: 0, dir: 1 });
  vue.victoire = g;
  vue.grosPlan = new Vector3(c.x - 1.4, c.y + c.perso.hauteur * 0.6, 0);
  vue.ralenti = 1;
  jouer("victoire");
  lancerMusique(true);
  vider();
  const qui = reglage.deuxJoueurs ? `J${g + 1}` : g === 0 ? "Tu gagnes !" : "Le bot gagne…";
  const lignes = [
    ["Dégâts infligés", (k: number) => `${combat.combattants[k].stats.degatsInfliges} %`],
    ["Éjections", (k: number) => `${combat.combattants[k].stats.koDonnes}`],
    ["Vies perdues", (k: number) => `${viesAuDepart - combat.combattants[k].vies}`],
    ["Chutes toutes seules", (k: number) => `${combat.combattants[k].stats.autodestructions}`],
  ] as const;
  const entete = combat.combattants
    .map((k, i) => `<th style="background:${couleurJoueur(i)}">${reglage.deuxJoueurs ? `J${i + 1}` : i === 0 ? "Toi" : "Bot"} · ${k.perso.court}</th>`)
    .join("");
  ui.append(
    el(`<div class="resultats">
      <div class="gagnant"><div class="petit manga">${qui}</div><div class="grand manga" style="color:${couleurJoueur(g)}">${c.perso.nom.toUpperCase()}</div><div class="petit manga">${c.perso.surnom}</div></div>
      <table><tr><th style="background:var(--encre)"></th>${entete}</tr>
      ${lignes.map(([n, f]) => `<tr><td>${n}</td><td>${f(0)}</td><td>${f(1)}</td></tr>`).join("")}
      </table>
      <div class="options"></div>
    </div>`),
  );
  choixMenu = 0;
  dessinerOptionsResultats();
}
const OPTIONS_RESULTATS = ["Revanche", "Changer de persos", "Menu"];
function dessinerOptionsResultats() {
  const o = ui.querySelector(".resultats .options");
  if (!o) return;
  o.innerHTML = "";
  OPTIONS_RESULTATS.forEach((t, i) => o.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${t}</div>`)));
}

// ————— Pause —————

const OPTIONS_PAUSE = ["Reprendre", "Recommencer", "Quitter"];
function dessinerPause() {
  ui.querySelector(".pause")?.remove();
  const p = el(`<div class="pause"><div class="voile"></div><div class="panneau"><h2 class="manga">Pause</h2></div></div>`);
  OPTIONS_PAUSE.forEach((t, i) => p.querySelector(".panneau")!.append(el(`<div class="choix ${i === choixMenu ? "actif" : ""}">${t}</div>`)));
  ui.append(p);
}

// ————— Les touches de menu —————

const VALIDER = ["Enter", "Space", "KeyJ", "KeyF", "NumpadEnter"];
const RETOUR = ["Escape", "Backspace"];
const HAUT = ["ArrowUp", "KeyW"];
const BAS = ["ArrowDown", "KeyS"];
const GAUCHE = ["ArrowLeft", "KeyA"];
const DROITE = ["ArrowRight", "KeyD"];

function menus(touches: string[]) {
  for (const t of touches) {
    if (t === "KeyM") {
      basculerMuet();
      continue;
    }
    const est = (l: string[]) => l.includes(t);
    switch (etat) {
      case "titre":
        if (est(VALIDER)) {
          jouer("valider");
          ecranMode();
        }
        break;
      case "mode":
        if (est(HAUT) || est(BAS)) {
          choixMenu = 1 - choixMenu;
          jouer("menu");
          dessinerMode();
        } else if (est(VALIDER)) {
          reglage.deuxJoueurs = choixMenu === 1;
          jouer("valider");
          ecranPersos();
        } else if (est(RETOUR)) {
          jouer("retour");
          ecranTitre();
        }
        break;
      case "persos": {
        const n = lignesPersos().length;
        const derniere = choixMenu === n - 1;
        if (est(HAUT)) choixMenu = (choixMenu + n - 1) % n;
        else if (est(BAS)) choixMenu = (choixMenu + 1) % n;
        else if ((est(GAUCHE) || est(DROITE)) && !derniere) {
          const s = est(DROITE) ? 1 : -1;
          if (choixMenu < 2) {
            const i = LISTE_PERSOS.indexOf(reglage.persos[choixMenu]);
            reglage.persos[choixMenu] = LISTE_PERSOS[(i + s + LISTE_PERSOS.length) % LISTE_PERSOS.length];
            apercu();
          } else reglage.niveau = NIVEAUX[(NIVEAUX.indexOf(reglage.niveau) + s + 3) % 3];
        } else if (est(VALIDER)) {
          if (derniere) {
            jouer("valider");
            demarrerCombat();
            return;
          }
          choixMenu = n - 1;
        } else if (est(RETOUR)) {
          jouer("retour");
          ecranMode();
          lancerDemo();
          return;
        } else continue;
        jouer("menu");
        dessinerPersos();
        break;
      }
      case "decompte":
      case "combat":
        if (t === "Escape" || t === "KeyP") {
          etat = "pause";
          choixMenu = 0;
          dessinerPause();
        }
        break;
      case "pause":
        if (est(HAUT)) choixMenu = (choixMenu + 2) % 3;
        else if (est(BAS)) choixMenu = (choixMenu + 1) % 3;
        else if (t === "Escape" || t === "KeyP") choixMenu = 0;
        if (est(HAUT) || est(BAS)) {
          jouer("menu");
          dessinerPause();
        }
        if (est(VALIDER) || t === "Escape" || t === "KeyP") {
          ui.querySelector(".pause")?.remove();
          if (choixMenu === 0) etat = "combat";
          else if (choixMenu === 1) demarrerCombat();
          else {
            arreterMusique();
            ecranTitre();
          }
          return;
        }
        break;
      case "resultats":
        if (est(GAUCHE) || est(HAUT)) choixMenu = (choixMenu + 2) % 3;
        else if (est(DROITE) || est(BAS)) choixMenu = (choixMenu + 1) % 3;
        if (est(GAUCHE) || est(DROITE) || est(HAUT) || est(BAS)) {
          jouer("menu");
          dessinerOptionsResultats();
        }
        if (est(VALIDER)) {
          jouer("valider");
          arreterMusique();
          if (choixMenu === 0) demarrerCombat();
          else if (choixMenu === 1) {
            hud = [];
            ecranPersos();
          } else {
            hud = [];
            ecranTitre();
          }
          return;
        }
        break;
    }
  }
}

// ————— La boucle —————

let avant = performance.now();
function boucle(maintenant: number) {
  const dt = Math.min(0.05, (maintenant - avant) / 1000);
  avant = maintenant;
  temps += dt;
  menus(appuis());

  switch (etat) {
    case "titre":
    case "mode":
      simuler(dt);
      if (combat.fini) {
        minuterie += dt;
        if (minuterie > 2) {
          minuterie = 0;
          lancerDemo();
        }
      }
      break;
    case "decompte": {
      const avantM = minuterie;
      minuterie += dt;
      const marques = [0.0, 0.75, 1.5, 2.25];
      const textes = ["3", "2", "1", "BAGARRE !"];
      marques.forEach((m, i) => {
        if (avantM <= m && minuterie > m) {
          annonce(textes[i], i === 3 ? "or" : "", i === 3 ? 900 : 650);
          jouer(i === 3 ? "partez" : "decompte");
        }
      });
      if (minuterie > 2.3) etat = "combat";
      break;
    }
    case "combat":
      simuler(dt);
      break;
    case "fin":
      simuler(dt);
      minuterie += dt;
      if (minuterie > 0.25 && !ui.querySelector(".annonce")) annonce("GAME !", "rouge", 0);
      if (minuterie > 1.1) vue.ralenti = 1;
      if (minuterie > 2.6) {
        ui.querySelectorAll(".annonce").forEach((a) => a.remove());
        ecranResultats();
      }
      break;
    case "resultats":
      simuler(dt);
      break;
    default:
      break;
  }
  vue.mettreAJour(dt * (etat === "pause" ? 0 : vue.ralenti), temps, etat === "pause" ? 0 : dt);
  rendu.dessiner(temps);
  if (etat === "combat" || etat === "decompte" || etat === "fin" || etat === "pause") majHud();
  requestAnimationFrame(boucle);
}

ecouterClavier(() => reveillerAudio());

// Raccourcis pour la mise au point : ?direct=ballerina,tung,difficile  ou  ?direct=ballerina,tung,2j  ou  ?demo
const direct = params.get("direct");
if (direct) {
  const [a, b, n] = direct.split(",");
  reglage.persos = [(a as NomPerso) ?? "ballerina", (b as NomPerso) ?? "tung"];
  reglage.deuxJoueurs = n === "2j";
  if (n && n !== "2j") reglage.niveau = n as Niveau;
  demarrerCombat();
  if (params.has("bots")) {
    const g = Math.floor(Math.random() * 1e6);
    pilotes = [bot("difficile", g), bot("difficile", g + 1)];
  }
} else ecranTitre();

requestAnimationFrame(boucle);
(window as unknown as { jeu: unknown }).jeu = {
  get combat() {
    return combat;
  },
  get vue() {
    return vue;
  },
  get etat() {
    return etat;
  },
};
