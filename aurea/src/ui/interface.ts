// L'interface : la cité et ses ressources, le cadran solaire, la barre de construction, la fiche
// du bâtiment choisi, la chronique et les grandes annonces. Elle lit la cité et prévient le jeu
// des clics ; elle ne modifie rien elle-même.
import {
  BESOINS,
  COUT_ROUTE,
  FICHES,
  NOMS_MARCHANDISES,
  NOMS_PALIERS,
  SEUILS,
  type Categorie,
  type Marchandise,
  type Palier,
  type TypeBatiment,
} from "../ville/catalogue";
import type { Ligne } from "../ville/chronique";
import { heureRomaine, type Meteo } from "../ville/temps";
import type { Batiment, Besoin, Ville } from "../ville/ville";
import { ICONES, type NomIcone } from "./icones";

export type Outil = TypeBatiment | "route" | "demolir" | null;

const CATEGORIES: { id: Categorie; nom: string; icone: NomIcone }[] = [
  { id: "habitat", nom: "Habitat", icone: "maison" },
  { id: "production", nom: "Production", icone: "atelier" },
  { id: "services", nom: "Services", icone: "service" },
  { id: "monuments", nom: "Monuments", icone: "temple" },
];

const ORDRE: TypeBatiment[] = [
  "maison",
  "entrepot",
  "peche",
  "bucheron",
  "ferme",
  "moulin",
  "boulangerie",
  "oliveraie",
  "pressoir",
  "carriere",
  "vigne",
  "cave",
  "forum",
  "thermes",
  "temple",
];

const TOUCHES: Partial<Record<TypeBatiment | "route" | "demolir", string>> = { route: "R", maison: "1", demolir: "X" };

const MARCHANDISES_AFFICHEES: Marchandise[] = ["bois", "marbre", "poisson", "pain", "huile", "vin"];

const METEO_ICONES: Record<Meteo, NomIcone> = { clair: "soleil", voile: "voile", nuageux: "nuages", pluie: "pluie", orage: "orage" };
const METEO_NOMS: Record<Meteo, string> = { clair: "Ciel pur", voile: "Voilé", nuageux: "Nuageux", pluie: "Pluie", orage: "Orage" };

const $ = <T extends HTMLElement = HTMLElement>(sel: string, racine: ParentNode = document) => racine.querySelector(sel) as T;

function el(tag: string, classe = "", html = "") {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (html) e.innerHTML = html;
  return e;
}

const nombre = (n: number) => Math.floor(n).toLocaleString("fr-FR");

export interface Rappels {
  choisirOutil(o: Outil): void;
  vitesse(v: number): void;
  meteo(): void;
  muet(): boolean;
  cinema(): void;
  commencer(vitrine: boolean): void;
  survol(): void;
}

export class Interface {
  private readonly racine = document.getElementById("ui")!;
  private categorie: Categorie = "habitat";
  private outil: Outil = null;
  private derniereLigne = -1;
  private minuterieAnnonce = 0;
  private minuterieAstuce = 0;
  private cleCartes = "";

  constructor(private readonly rappels: Rappels) {
    this.racine.innerHTML = `
      <div id="haut" class="panneau">
        <div id="blason"><div class="nom">AVREA</div><div class="ere">Pax Romana</div></div>
        <div class="ressources" id="ressources"></div>
      </div>
      <div id="cadran" class="panneau">
        <div class="heure"><div class="romaine"></div><div class="jour"></div></div>
        <canvas id="disque" width="88" height="88"></canvas>
        <div id="meteo" title="Implorer Jupiter (changer le temps)"></div>
        <div class="sep"></div>
        <div class="boutons" id="vitesses"></div>
        <div class="sep"></div>
        <div class="boutons"><button class="bouton" id="b-cinema" title="Mode cinéma (C)">${ICONES.cinema}</button><button class="bouton" id="b-son" title="Couper le son (M)">${ICONES.son}</button><button class="bouton" id="b-aide" title="Aide (H)">?</button></div>
      </div>
      <div id="construire">
        <div id="onglets"></div>
        <div id="cartes" class="panneau"></div>
      </div>
      <div id="bulle" class="panneau"></div>
      <div id="fiche" class="panneau"></div>
      <div id="chronique"></div>
      <div id="annonce"><div class="surtitre"></div><h1></h1><p></p></div>
      <div id="astuce"></div>
      <div id="aide" class="panneau">
        <h2>COMMANDES</h2>
        <table>
          <tr><td><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> · flèches</td><td>Parcourir l'île (ou clic droit glissé)</td></tr>
          <tr><td><kbd>A</kbd> <kbd>E</kbd> · clic milieu</td><td>Tourner autour du point visé</td></tr>
          <tr><td>Molette</td><td>S'approcher jusqu'au ras des rues, ou prendre de la hauteur</td></tr>
          <tr><td>Clic</td><td>Choisir un bâtiment, ou bâtir avec l'outil choisi</td></tr>
          <tr><td><kbd>R</kbd></td><td>Tracer une route (cliquer, glisser, relâcher) ; avec un bâtiment, le tourner</td></tr>
          <tr><td><kbd>X</kbd></td><td>Démolir</td></tr>
          <tr><td><kbd>Espace</kbd> <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></td><td>Pause, vitesse ×1, ×2, ×4</td></tr>
          <tr><td><kbd>C</kbd></td><td>Mode cinéma : la caméra survole la cité</td></tr>
          <tr><td><kbd>T</kbd> <kbd>N</kbd></td><td>Figer l'heure · passer au moment suivant (aube, midi, couchant, nuit)</td></tr>
          <tr><td><kbd>M</kbd> <kbd>Échap</kbd></td><td>Couper le son · annuler, fermer</td></tr>
        </table>
        <p>Reliez chaque atelier au port ou à un entrepôt par la route. Comblez les besoins des maisons : elles grandissent.</p>
      </div>
    `;
    this.construireRessources();
    this.construireOnglets();
    this.construireVitesses();
    $("#meteo").addEventListener("click", () => this.rappels.meteo());
    $("#b-cinema").addEventListener("click", () => this.rappels.cinema());
    $("#b-aide").addEventListener("click", () => this.basculerAide());
    $("#b-son").addEventListener("click", () => {
      const muet = this.rappels.muet();
      $("#b-son").innerHTML = muet ? ICONES.muet : ICONES.son;
    });
  }

  // -------------------------------------------------------------------------------------------
  // Écran titre
  // -------------------------------------------------------------------------------------------

  ecranTitre() {
    const t = el(
      "div",
      "",
      `<div class="surtitre">ANNO DOMINI CXVII</div>
      <h1>AVREA</h1>
      <div class="devise">une île sous la paix romaine</div>
      <div class="choix">
        <button id="t-jouer">Fonder la cité<small>partir du petit bourg du port</small></button>
        <button id="t-vitrine">Contempler<small>une grande cité déjà bâtie</small></button>
      </div>
      <div class="pied">Casque recommandé · Molette pour s'approcher jusqu'au ras des rues</div>`,
    );
    t.id = "titre";
    this.racine.appendChild(t);
    this.racine.classList.add("titre");
    for (const id of ["#haut", "#cadran", "#construire", "#chronique"]) $(id).style.display = "none";
    $("#t-jouer").addEventListener("click", () => this.rappels.commencer(false));
    $("#t-vitrine").addEventListener("click", () => this.rappels.commencer(true));
  }

  quitterTitre() {
    $("#titre")?.classList.add("parti");
    setTimeout(() => $("#titre")?.remove(), 2200);
    for (const id of ["#haut", "#cadran", "#construire", "#chronique"]) $(id).style.display = "";
    for (const id of ["#haut", "#cadran", "#construire"]) {
      const e = $(id);
      e.style.opacity = "0";
      e.style.transition = "opacity 1.5s 0.8s";
      requestAnimationFrame(() => (e.style.opacity = "1"));
    }
  }

  // -------------------------------------------------------------------------------------------
  // Ressources
  // -------------------------------------------------------------------------------------------

  private construireRessources() {
    const r = $("#ressources");
    r.innerHTML = `
      <div class="res" id="r-denarii" title="Denarii">${ICONES.denarii}<span class="v"></span><span class="delta"></span></div>
      <div class="sep"></div>
      <div class="paliers" id="paliers">
        ${([0, 1, 2] as Palier[]).map((p) => `<div class="palier" id="p-${p}" title="${NOMS_PALIERS[p].pluriel}"><span class="v">0</span><small>${NOMS_PALIERS[p].pluriel.toUpperCase()}</small></div>`).join("")}
      </div>
      <div class="sep"></div>
      ${MARCHANDISES_AFFICHEES.map((m) => `<div class="res" id="r-${m}" title="${NOMS_MARCHANDISES[m]}">${ICONES[m]}<span class="v"></span></div>`).join("")}
    `;
  }

  private construireOnglets() {
    const o = $("#onglets");
    for (const c of CATEGORIES) {
      const b = el("div", "onglet" + (c.id === this.categorie ? " actif" : ""), `${ICONES[c.icone]}${c.nom}`);
      b.addEventListener("click", () => {
        this.categorie = c.id;
        o.querySelectorAll(".onglet").forEach((x) => x.classList.remove("actif"));
        b.classList.add("actif");
        this.cleCartes = "";
      });
      o.appendChild(b);
    }
  }

  private construireVitesses() {
    const v = $("#vitesses");
    const defs: [number, string][] = [
      [0, ICONES.pause],
      [1, "I"],
      [2, "II"],
      [4, "IV"],
    ];
    for (const [n, html] of defs) {
      const b = el("button", "bouton", html);
      b.dataset.v = String(n);
      b.title = n === 0 ? "Pause (Espace)" : `Vitesse ×${n}`;
      b.addEventListener("click", () => this.rappels.vitesse(n));
      v.appendChild(b);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Mise à jour
  // -------------------------------------------------------------------------------------------

  mettreAJour(v: Ville, vitesse: number, selection: Batiment | null) {
    const pop = v.population();
    $("#r-denarii .v").textContent = nombre(v.denarii);
    const net = v.bilan.impots - v.bilan.entretien;
    const delta = $("#r-denarii .delta");
    delta.textContent = `${net >= 0 ? "+" : ""}${Math.round(net)}`;
    delta.classList.toggle("neg", net < 0);
    for (const p of [0, 1, 2] as Palier[]) {
      const e = $(`#p-${p}`);
      e.querySelector(".v")!.textContent = nombre(pop.parPalier[p]);
      e.classList.toggle("verrou", p > v.palierMax && pop.parPalier[p] === 0);
    }
    const manques = new Set<Besoin>();
    for (const b of v.batiments.values()) if (b.type === "maison") for (const m of b.manques) manques.add(m);
    for (const m of MARCHANDISES_AFFICHEES) {
      const e = $(`#r-${m}`);
      e.querySelector(".v")!.textContent = nombre(v.stocks[m]);
      e.classList.toggle("manque", manques.has(m));
      const utile = m === "bois" || m === "poisson" || (m === "marbre" && v.palierMax >= 1) || ((m === "pain" || m === "huile") && v.palierMax >= 1) || (m === "vin" && v.palierMax >= 2);
      e.classList.toggle("cache", !utile);
    }

    // Le cadran
    const h = v.horloge;
    $("#cadran .romaine").textContent = heureRomaine(h.heure).toUpperCase();
    $("#cadran .jour").textContent = `jour ${h.jour}${h.figee ? " · heure figée" : ""}`;
    const icone = h.heure > 20.2 || h.heure < 5.3 ? (h.meteo === "clair" || h.meteo === "voile" ? "lune" : METEO_ICONES[h.meteo]) : METEO_ICONES[h.meteo];
    const meteo = $("#meteo");
    if (meteo.dataset.i !== icone) {
      meteo.innerHTML = ICONES[icone];
      meteo.dataset.i = icone;
      meteo.title = `${METEO_NOMS[h.meteo]} · cliquer pour implorer Jupiter`;
    }
    this.dessinerDisque(h.heure);
    $("#vitesses")
      .querySelectorAll<HTMLElement>(".bouton")
      .forEach((b) => b.classList.toggle("actif", Number(b.dataset.v) === vitesse));

    this.majCartes(v);
    this.majFiche(v, selection);
    this.majChronique(v.chronique.lignes, v.temps);

    if (this.minuterieAnnonce > 0) {
      this.minuterieAnnonce -= 1 / 10;
      if (this.minuterieAnnonce <= 0) $("#annonce").classList.remove("visible");
    }
    if (this.minuterieAstuce > 0) {
      this.minuterieAstuce -= 1 / 10;
      if (this.minuterieAstuce <= 0) $("#astuce").classList.remove("visible");
    }
  }

  /** Un petit cadran solaire : le soleil (ou la lune) parcourt un demi-cercle */
  private dessinerDisque(heure: number) {
    const c = $<HTMLCanvasElement>("#disque");
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 88, 88);
    const cx = 44;
    const cy = 54;
    const r = 32;
    g.strokeStyle = "rgba(215,180,106,0.55)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, r, Math.PI, 0);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - r - 6, cy);
    g.lineTo(cx + r + 6, cy);
    g.stroke();
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      g.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
      g.stroke();
    }
    const jour = heure >= 6 && heure <= 19.6;
    const t = jour ? (heure - 6) / 13.6 : ((heure >= 19.6 ? heure - 19.6 : heure + 4.4) / 10.4);
    const a = Math.PI + t * Math.PI;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const grad = g.createRadialGradient(x, y, 0, x, y, 12);
    grad.addColorStop(0, jour ? "rgba(255,226,150,1)" : "rgba(210,225,255,1)");
    grad.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = jour ? "#ffe9b0" : "#dfe8ff";
    g.beginPath();
    g.arc(x, y, 4.5, 0, Math.PI * 2);
    g.fill();
  }

  // -------------------------------------------------------------------------------------------
  // Construire
  // -------------------------------------------------------------------------------------------

  choisirOutil(o: Outil) {
    this.outil = o;
    this.cleCartes = "";
    if (o && o !== "route" && o !== "demolir") {
      const cat = FICHES[o].categorie;
      if (cat !== this.categorie) {
        this.categorie = cat;
        $("#onglets")
          .querySelectorAll(".onglet")
          .forEach((x, n) => x.classList.toggle("actif", CATEGORIES[n]!.id === cat));
      }
    }
  }

  private majCartes(v: Ville) {
    const types = ORDRE.filter((t) => FICHES[t].categorie === this.categorie);
    let cle = `${this.categorie}/${this.outil}/${v.palierMax}/`;
    for (const t of types) cle += v.peutPayer(FICHES[t].cout) ? "1" : "0";
    cle += v.denarii >= COUT_ROUTE ? "r" : "";
    if (cle === this.cleCartes) return;
    this.cleCartes = cle;
    const zone = $("#cartes");
    zone.innerHTML = "";
    const outils: (TypeBatiment | "route" | "demolir")[] = this.categorie === "habitat" ? ["route", ...types, "demolir"] : types;
    let n = 1;
    for (const t of outils) {
      const carte = el("div", "carte");
      if (t === "route") {
        carte.innerHTML = `<div class="touche">R</div><div class="latin">VIA</div><div class="fr">Route dallée</div><div class="cout"><span>${ICONES.denarii}${COUT_ROUTE}</span><span style="font-weight:400;font-style:italic;font-size:12.5px">par case</span></div>`;
      } else if (t === "demolir") {
        carte.innerHTML = `<div class="touche">X</div><div class="latin">DIRVERE</div><div class="fr">Démolir</div><div class="cout">${ICONES.demolir}</div>`;
      } else {
        const f = FICHES[t];
        const verrou = !v.debloque(t);
        const touche = TOUCHES[t] ?? (n <= 9 ? String(n) : "");
        if (t !== "maison") n++;
        carte.classList.toggle("verrou", verrou);
        carte.classList.toggle("cher", !verrou && !v.peutPayer(f.cout));
        const cout = `<span>${ICONES.denarii}${f.cout.denarii}</span>${f.cout.bois ? `<span>${ICONES.bois}${f.cout.bois}</span>` : ""}${f.cout.marbre ? `<span>${ICONES.marbre}${f.cout.marbre}</span>` : ""}`;
        const seuil = f.debloque >= 1 ? SEUILS[f.debloque as 1 | 2 | 3] : null;
        carte.innerHTML = `<div class="touche">${touche}</div><div class="latin">${f.latin.toUpperCase()}</div><div class="fr">${f.nom}</div>${
          verrou && seuil ? `<div class="cadenas">${seuil.habitants} ${NOMS_PALIERS[seuil.palier].pluriel}</div>` : `<div class="cout">${cout}</div>`
        }`;
        carte.dataset.touche = touche;
      }
      carte.classList.toggle("actif", this.outil === t);
      carte.addEventListener("click", () => {
        this.rappels.survol();
        this.rappels.choisirOutil(this.outil === t ? null : (t as Outil));
      });
      carte.addEventListener("mouseenter", (e) => this.bulleOutil(t, v, e.currentTarget as HTMLElement));
      carte.addEventListener("mouseleave", () => $("#bulle").classList.remove("visible"));
      zone.appendChild(carte);
    }
  }

  /** Le type de bâtiment associé à une touche chiffrée, dans l'onglet ouvert */
  outilPourTouche(touche: string): Outil | undefined {
    const carte = [...document.querySelectorAll<HTMLElement>("#cartes .carte")].find((c) => c.dataset.touche === touche);
    if (!carte) return undefined;
    const types = ORDRE.filter((t) => FICHES[t].categorie === this.categorie);
    const outils = this.categorie === "habitat" ? ["route", ...types, "demolir"] : types;
    const index = [...document.querySelectorAll("#cartes .carte")].indexOf(carte);
    return outils[index] as Outil;
  }

  private bulleOutil(t: TypeBatiment | "route" | "demolir", v: Ville, cible: HTMLElement) {
    const b = $("#bulle");
    if (t === "route") b.innerHTML = `<h3>VIA · Route</h3>Cliquer, glisser, relâcher pour tracer. Les ateliers doivent être reliés au port ou à un entrepôt.`;
    else if (t === "demolir") b.innerHTML = `<h3>Démolir</h3>On récupère la moitié de ce qu'a coûté le bâtiment.`;
    else {
      const f = FICHES[t];
      let besoins = "";
      if (t === "maison") {
        besoins = ([0, 1, 2] as Palier[])
          .map((p) => {
            const bs = BESOINS[p];
            const liste = [...Object.keys(bs.biens).map((m) => NOMS_MARCHANDISES[m as Marchandise]), ...bs.services.map((s) => FICHES[s].nom)];
            return `<div class="ligne"><b>${NOMS_PALIERS[p].pluriel}</b> : ${liste.join(", ")} · ${bs.capacite} habitants</div>`;
          })
          .join("");
      }
      const prod = f.produit ? `<div class="ligne">${f.consomme ? `${NOMS_MARCHANDISES[f.consomme]} → ` : ""}${NOMS_MARCHANDISES[f.produit]}, une unité toutes les ${f.duree} s</div>` : "";
      const rayon = f.rayon ? `<div class="ligne">Portée : ${f.rayon} cases</div>` : "";
      const verrou = !v.debloque(t) && f.debloque >= 1 ? `<div class="ligne">Débloqué à ${SEUILS[f.debloque as 1 | 2 | 3].habitants} ${NOMS_PALIERS[SEUILS[f.debloque as 1 | 2 | 3].palier].pluriel}.</div>` : "";
      b.innerHTML = `<h3>${f.latin.toUpperCase()} · ${f.nom}</h3>${f.description}${prod}${rayon}${besoins}${f.entretien ? `<div class="ligne">Entretien : ${f.entretien} denarii par minute</div>` : ""}${verrou}`;
    }
    const r = cible.getBoundingClientRect();
    b.classList.add("visible");
    const l = b.getBoundingClientRect();
    b.style.left = `${Math.max(8, Math.min(window.innerWidth - l.width - 8, r.left + r.width / 2 - l.width / 2))}px`;
    b.style.top = `${r.top - l.height - 12}px`;
  }

  // -------------------------------------------------------------------------------------------
  // La fiche
  // -------------------------------------------------------------------------------------------

  private majFiche(v: Ville, b: Batiment | null) {
    const fiche = $("#fiche");
    if (!b) {
      fiche.classList.remove("visible");
      return;
    }
    fiche.classList.add("visible");
    const f = FICHES[b.type];
    let corps = "";
    if (b.chantier < 1) {
      corps = `<div class="etat">En chantier…</div><div class="jauge"><div style="width:${Math.round(b.chantier * 100)}%"></div></div>`;
    } else if (b.type === "maison") {
      const bs = BESOINS[b.palier];
      const items: [string, boolean, NomIcone][] = [
        ...Object.keys(bs.biens).map((m) => [NOMS_MARCHANDISES[m as Marchandise], !b.manques.includes(m as Besoin), m as NomIcone] as [string, boolean, NomIcone]),
        ...bs.services.map((s) => [FICHES[s].nom, !b.manques.includes(s as Besoin), "service"] as [string, boolean, NomIcone]),
      ];
      const suivant = b.palier < 2 ? ((b.palier + 1) as Palier) : null;
      const evolution =
        suivant === null
          ? "La maison est au plus haut niveau."
          : suivant > v.palierMax
            ? `Les ${NOMS_PALIERS[suivant].pluriel} ne sont pas encore là.`
            : b.manques.length === 0
              ? `Comblée : elle va bientôt accueillir des ${NOMS_PALIERS[suivant].pluriel}.`
              : `Comblée, elle accueillerait des ${NOMS_PALIERS[suivant].pluriel}.`;
      corps = `
        <div class="etat">${b.habitants} habitants sur ${bs.capacite}</div>
        <div class="jauge"><div style="width:${Math.round((b.habitants / bs.capacite) * 100)}%"></div></div>
        ${b.manques.includes("route") ? `<div class="etat alerte">Pas reliée au port par la route.</div>` : ""}
        <div class="besoins">${items.map(([nom, ok, ic]) => `<div class="besoin ${ok ? "" : "non"}">${ICONES[ic]}${nom}</div>`).join("")}</div>
        <div class="etat">${evolution}</div>`;
    } else if (f.produit) {
      const etat = !b.relie
        ? `<div class="etat alerte">Pas relié au port ou à un entrepôt par la route.</div>`
        : f.consomme && b.entree < 1 && v.stocks[f.consomme] < 1
          ? `<div class="etat alerte">Attend du ${NOMS_MARCHANDISES[f.consomme].toLowerCase()}.</div>`
          : b.stock >= 4
            ? `<div class="etat alerte">Les entrepôts sont pleins.</div>`
            : `<div class="etat">${b.charrette ? "Une charrette est en route." : "Au travail."}</div>`;
      corps = `${etat}<div class="jauge"><div style="width:${Math.round(b.progres * 100)}%"></div></div><div class="etat">${f.consomme ? `${NOMS_MARCHANDISES[f.consomme]} → ` : ""}${NOMS_MARCHANDISES[f.produit]} · stock ${b.stock}/4</div>`;
    } else if (f.rayon) {
      let servies = 0;
      for (const m of v.batiments.values()) if (m.type === "maison" && v.servi(m, b.type)) servies++;
      corps = `<div class="etat">${b.relie ? `Sert ${servies} maisons dans un rayon de ${f.rayon} cases.` : "Pas relié au port par la route."}</div>`;
    } else if (b.type === "port" || b.type === "entrepot") {
      corps = `<div class="etat">Les charrettes y livrent. Capacité de la cité : ${v.capaciteStock()} par marchandise.</div>`;
      if (b.type === "port" && v.navire) corps += `<div class="etat">Un navire de ${v.navire.origine} ${v.navire.phase === "amarre" ? "est à quai" : v.navire.phase === "approche" ? "approche" : "repart"}.</div>`;
    }
    const titre = b.type === "maison" ? `${NOMS_PALIERS[b.palier].pluriel.toUpperCase()}` : f.latin.toUpperCase();
    const sous = b.type === "maison" ? ["Maison d'affranchis", "Insula de la plèbe", "Domus de chevalier"][b.palier] : f.nom;
    const cle = `${b.id}|${corps}`;
    if (fiche.dataset.cle !== cle) {
      fiche.dataset.cle = cle;
      fiche.innerHTML = `<h2>${titre}</h2><div class="sous">${sous}</div>${corps}`;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Chronique, annonces, astuces
  // -------------------------------------------------------------------------------------------

  private majChronique(lignes: Ligne[], temps: number) {
    const zone = $("#chronique");
    const derniere = lignes[lignes.length - 1];
    if (derniere && derniere.temps !== this.derniereLigne) {
      this.derniereLigne = derniere.temps;
      const n = el("div", `nouvelle i${derniere.importance}`);
      n.textContent = derniere.texte;
      zone.appendChild(n);
      while (zone.children.length > 5) zone.firstElementChild!.remove();
    }
    const enfants = [...zone.children] as HTMLElement[];
    enfants.forEach((e, k) => {
      e.classList.toggle("vieille", k < enfants.length - 2);
    });
    void temps;
  }

  annoncer(surtitre: string, titre: string, texte: string, duree = 7) {
    const a = $("#annonce");
    a.querySelector(".surtitre")!.textContent = surtitre;
    a.querySelector("h1")!.textContent = titre;
    a.querySelector("p")!.textContent = texte;
    a.classList.add("visible");
    this.minuterieAnnonce = duree;
  }

  astuce(texte: string, erreur = false, duree = 2.5) {
    const a = $("#astuce");
    a.textContent = texte;
    a.classList.toggle("erreur", erreur);
    a.classList.add("visible");
    this.minuterieAstuce = duree;
  }

  basculerAide(force?: boolean) {
    $("#aide").classList.toggle("visible", force);
  }

  aideOuverte() {
    return $("#aide").classList.contains("visible");
  }

  cacher(cache: boolean) {
    this.racine.classList.toggle("cache", cache);
  }
}
