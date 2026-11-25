// L'interface : HUD discret, messages, écrans de titre, de pause et de fin.

import { PHARES } from "../monde/archipel";
import { REGLAGES } from "../reglages";

const SVG_PHARE = `<svg viewBox="0 0 16 30"><path d="M6 2h4l1 3H5zM5 6h6v3H5zM5.5 10h5l1.5 18h-8z"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe = "", html = "") {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (html) e.innerHTML = html;
  return e;
}

export interface EtatHud {
  huile: number;
  coque: number;
  allumes: boolean[];
  cible: number;
  vitesse: number; // m/s
  ventRelatif: number; // d'où vient le vent, relatif au cap (rad, + = tribord)
  cap: number;
  rafale: number;
  rendement: number;
  faseye: number;
  hisse: number;
  allumage: { phare: number; progression: number } | null;
  repere: { x: number; y: number; visible: boolean; angle: number; texte: string } | null;
}

export class Hud {
  racine: HTMLElement;
  private hud = el("div");
  private iconesPhares: HTMLElement[] = [];
  private jaugeHuile = el("div", "jauge huile");
  private jaugeCoque = el("div", "jauge coque");
  private compas = el("div", "compas");
  private flecheVent!: SVGGElement;
  private arcMort!: SVGPathElement;
  private nord!: SVGTextElement;
  private texteVitesse = el("div", "vitesse");
  private texteAllure = el("div", "allure");
  private message = el("div", "message cache");
  private repere = el("div", "repere cache");
  private allumage = el("div", "allumage cache");
  private aide = el("div", "aide cache");
  private titre = el("div", "ecran ecran-titre");
  private fin = el("div", "ecran ecran-fin cache");
  private pause = el("div", "ecran ecran-pause cache");
  private voile = el("div", "voile-noir");
  private debug = el("div", "debug");
  private finMessage = 0;

  constructor(racine: HTMLElement) {
    this.racine = racine;
    this.hud.id = "hud";
    this.hud.classList.add("cache");

    const rangee = el("div", "phares");
    PHARES.forEach((p) => {
      const i = el("div", "phare-icone", SVG_PHARE);
      i.title = p.nom;
      rangee.append(i);
      this.iconesPhares.push(i);
    });
    this.hud.append(rangee);

    const jauges = el("div", "jauges");
    for (const [j, nom] of [
      [this.jaugeHuile, "Lanterne"],
      [this.jaugeCoque, "Coque"],
    ] as [HTMLElement, string][]) {
      j.innerHTML = `<span class="nom">${nom}</span><div class="barre"><div class="remplissage"></div></div>`;
      jauges.append(j);
    }
    this.hud.append(jauges);

    this.compas.innerHTML = `
      <svg viewBox="0 0 112 112">
        <circle cx="56" cy="56" r="46" fill="rgba(5,10,16,0.35)" stroke="rgba(239,230,214,0.25)" stroke-width="1"/>
        <path class="arc-mort" fill="rgba(255,110,80,0.22)" d=""/>
        <text class="nord" x="56" y="17" text-anchor="middle" font-size="10" fill="rgba(239,230,214,0.6)" font-family="serif">N</text>
        <path d="M56 40 C61 48 61 62 59 72 L53 72 C51 62 51 48 56 40Z" fill="rgba(239,230,214,0.85)"/>
        <g class="fleche-vent">
          <path d="M56 6 L56 26" stroke="#ffc47a" stroke-width="2"/>
          <path d="M50 20 L56 28 L62 20" fill="none" stroke="#ffc47a" stroke-width="2"/>
        </g>
      </svg>`;
    this.compas.append(this.texteVitesse, this.texteAllure);
    this.flecheVent = this.compas.querySelector(".fleche-vent")!;
    this.arcMort = this.compas.querySelector(".arc-mort")!;
    this.nord = this.compas.querySelector(".nord")!;
    this.hud.append(this.compas);

    this.message.innerHTML = `<div class="titre"></div><div class="sous"></div>`;
    this.repere.innerHTML = `<div class="fleche"></div><span></span>`;
    this.allumage.innerHTML = `<span>Rallumage du feu</span><div class="barre"><div class="remplissage"></div></div>`;
    this.aide.innerHTML = `<kbd>←</kbd><kbd>→</kbd> barrer &nbsp;·&nbsp; <kbd>↑</kbd><kbd>↓</kbd> hisser / affaler la voile &nbsp;·&nbsp; approche d'un phare éteint pour le rallumer`;
    this.hud.append(this.repere, this.allumage, this.aide);

    this.titre.innerHTML = `
      <h1>PHARES</h1>
      <div class="accroche">La tempête a soufflé les feux de l'archipel. Rallume-les, un par un.</div>
      <div class="bas">
      <div class="invite">Entrée pour larguer les amarres</div>
      <div class="touches">
        <kbd>←</kbd><kbd>→</kbd> ou <kbd>Q</kbd><kbd>D</kbd> barrer &nbsp;·&nbsp; <kbd>↑</kbd><kbd>↓</kbd> ou <kbd>Z</kbd><kbd>S</kbd> hisser, affaler<br>
        <kbd>C</kbd> caméra &nbsp;·&nbsp; <kbd>M</kbd> son &nbsp;·&nbsp; <kbd>P</kbd> pause
      </div>
      </div>`;
    this.fin.innerHTML = `
      <h2>L'archipel veille</h2>
      <div class="recit">Six feux tournent de nouveau sur la mer. La tempête se retire, et le jour se lève sur les récifs que tu as appris par cœur.</div>
      <div class="stats"></div>
      <div class="invite">Entrée pour reprendre la mer</div>`;
    this.pause.innerHTML = `Pause<small>P pour reprendre</small>`;

    racine.append(this.hud, this.message, this.titre, this.fin, this.pause, this.voile, this.debug);
  }

  montrerTitre(v: boolean) {
    this.titre.classList.toggle("cache", !v);
  }

  montrerHud(v: boolean) {
    this.hud.classList.toggle("cache", !v);
  }

  montrerAide(v: boolean) {
    this.aide.classList.toggle("cache", !v);
  }

  montrerPause(v: boolean) {
    this.pause.classList.toggle("cache", !v);
  }

  noir(v: boolean) {
    this.voile.style.opacity = v ? "1" : "0";
  }

  montrerFin(temps: number, chocs: number, naufrages: number) {
    const m = Math.floor(temps / 60);
    const s = Math.floor(temps % 60);
    const stats = this.fin.querySelector(".stats")!;
    stats.innerHTML = `
      <div><b>${m}:${String(s).padStart(2, "0")}</b>traversée</div>
      <div><b>${chocs}</b>${chocs > 1 ? "chocs" : "choc"}</div>
      <div><b>${naufrages}</b>${naufrages > 1 ? "naufrages" : "naufrage"}</div>`;
    this.fin.classList.remove("cache");
  }

  cacherFin() {
    this.fin.classList.add("cache");
  }

  annoncer(titre: string, sous = "", duree = 4, chaud = false) {
    this.message.querySelector(".titre")!.textContent = titre;
    this.message.querySelector(".sous")!.textContent = sous;
    this.message.classList.toggle("chaud", chaud);
    this.message.classList.remove("cache");
    this.finMessage = performance.now() + duree * 1000;
  }

  cacherMessage() {
    this.message.classList.add("cache");
    this.finMessage = 0;
  }

  texteDebug(t: string) {
    this.debug.textContent = t;
  }

  maj(e: EtatHud) {
    if (this.finMessage && performance.now() > this.finMessage) {
      this.message.classList.add("cache");
      this.finMessage = 0;
    }
    e.allumes.forEach((a, i) => {
      this.iconesPhares[i].classList.toggle("allume", a);
      this.iconesPhares[i].classList.toggle("cible", !a && i === e.cible);
    });
    const remplir = (j: HTMLElement, v: number, alerte: boolean) => {
      (j.querySelector(".remplissage") as HTMLElement).style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;
      j.classList.toggle("alerte", alerte);
    };
    remplir(this.jaugeHuile, e.huile / REGLAGES.huile.max, e.huile < REGLAGES.huile.seuilFaible);
    remplir(this.jaugeCoque, e.coque / REGLAGES.coque.max, e.coque < 30);

    const deg = (e.ventRelatif * 180) / Math.PI;
    this.flecheVent.setAttribute("transform", `rotate(${deg} 56 56)`);
    const mort = (REGLAGES.bateau.angleMort * Math.PI) / 180;
    const arc = (a0: number, a1: number, r: number) => {
      const p = (a: number) => `${56 + Math.sin(a) * r} ${56 - Math.cos(a) * r}`;
      return `M56 56 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`;
    };
    this.arcMort.setAttribute("d", arc(e.ventRelatif - mort, e.ventRelatif + mort, 46));
    const nordAngle = (-e.cap * 180) / Math.PI;
    this.nord.setAttribute("transform", `rotate(${nordAngle} 56 56)`);

    const noeuds = e.vitesse * 0.9; // nœuds « de jeu » : le monde est à l'échelle d'une maquette
    this.texteVitesse.textContent = `${noeuds.toFixed(1)} nœuds`;
    let allure = "";
    if (e.hisse < 0.05) allure = "voile affalée";
    else if (e.faseye > 0.5) allure = "face au vent — abats !";
    else if (e.rafale > 0.4) allure = "<span class='rafale'>rafale</span>";
    else if (e.rendement > 0.85) allure = "belle allure";
    this.texteAllure.innerHTML = allure;

    if (e.allumage && e.allumage.progression > 0) {
      this.allumage.classList.remove("cache");
      this.allumage.querySelector("span")!.textContent = `Rallumage — ${PHARES[e.allumage.phare].nom}`;
      (this.allumage.querySelector(".remplissage") as HTMLElement).style.width = `${e.allumage.progression * 100}%`;
    } else this.allumage.classList.add("cache");

    if (e.repere) {
      const r = e.repere;
      this.repere.classList.remove("cache");
      this.repere.style.left = `${r.x}px`;
      this.repere.style.top = `${r.y}px`;
      (this.repere.querySelector(".fleche") as HTMLElement).style.transform = `rotate(${r.angle + 45}deg)`;
      this.repere.querySelector("span")!.textContent = r.texte;
    } else this.repere.classList.add("cache");
  }
}
