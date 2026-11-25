// L'interface : écran titre, jauge de vie, compteurs, aide contextuelle, annonces, alerte de vent,
// repères au bord de l'écran vers les graines et les sources endormies, écran de fin.

const TOUCHES = `
  <span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> marcher</span>
  <span><kbd>Maj</kbd> courir</span>
  <span><kbd>Espace</kbd> sauter</span>
  <span><kbd>E</kbd> / clic planter</span>
  <span><kbd>F</kbd> / clic droit creuser</span>
  <span><kbd>C</kbd> souffle</span>
  <span>souris : regarder</span>
  <span><kbd>M</kbd> son</span>
`;

function el(parent: HTMLElement, cls: string, html = "") {
  const d = document.createElement("div");
  d.className = cls;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}

export interface Repere {
  x: number;
  y: number;
  angle: number;
  visible: boolean;
  type: "graine" | "source";
}

export class Hud {
  private readonly racine: HTMLElement;
  readonly titre: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly arc: SVGCircleElement;
  private readonly pct: HTMLElement;
  private readonly graines: HTMLElement;
  private readonly sources: HTMLElement;
  private readonly aide: HTMLElement;
  private readonly annonce: HTMLElement;
  private readonly alerte: HTMLElement;
  private readonly reperes: HTMLElement;
  private readonly muet: HTMLElement;
  private readonly fps: HTMLElement;
  private fin: HTMLElement | null = null;
  private elemsReperes: HTMLElement[] = [];
  private dernierPct = -1;
  private dernieresGraines = -1;
  private dernieresSources = "";
  private derniereAide = "";
  private annonceFin = 0;

  constructor(racine: HTMLElement) {
    this.racine = racine;
    this.titre = el(
      racine,
      "titre",
      `<div class="accroche">une toute petite planète attend</div>
       <h1>Germe</h1>
       <div class="sous">Réveille l'eau, sème les graines, rends-lui la vie.</div>
       <button class="bouton" id="jouer">Éveiller</button>
       <div class="touches">${TOUCHES}</div>`,
    );
    this.hud = el(racine, "hud cache");
    const jauge = el(
      this.hud,
      "jauge",
      `<div style="position:relative">
         <svg viewBox="0 0 74 74">
           <circle cx="37" cy="37" r="31" fill="rgba(8,12,20,0.35)" stroke="rgba(255,255,255,0.14)" stroke-width="6"/>
           <circle class="arc" cx="37" cy="37" r="31" fill="none" stroke="url(#degrade)" stroke-width="6" stroke-linecap="round"
             stroke-dasharray="194.8" stroke-dashoffset="194.8"/>
           <defs><linearGradient id="degrade" x1="0" y1="0" x2="1" y2="1">
             <stop offset="0" stop-color="#e6ffc8"/><stop offset="1" stop-color="#6cc644"/></linearGradient></defs>
         </svg>
         <div class="pct"><span>0</span><small>vie</small></div>
       </div>
       <div class="compteurs">
         <div class="cg"><i></i><span>0</span></div>
         <div class="cs"></div>
       </div>`,
    );
    this.arc = jauge.querySelector(".arc") as SVGCircleElement;
    this.pct = jauge.querySelector(".pct span") as HTMLElement;
    this.graines = jauge.querySelector(".cg") as HTMLElement;
    this.sources = jauge.querySelector(".cs") as HTMLElement;
    this.reperes = el(this.hud, "reperes");
    this.aide = el(this.hud, "aide cache");
    this.annonce = el(this.hud, "annonce cache");
    this.alerte = el(this.hud, "alerte cache", "Vent de cendre");
    this.muet = el(this.hud, "muet cache", "son coupé — M");
    this.fps = el(racine, "fps cache");
  }

  surJouer(f: () => void) {
    const b = this.titre.querySelector("#jouer") as HTMLButtonElement;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      f();
    });
  }

  montrerJeu() {
    this.titre.classList.add("cache");
    this.hud.classList.remove("cache");
  }

  cacherHud(c: boolean) {
    this.hud.classList.toggle("cache", c);
  }

  maj(o: { part: number; graines: number; sources: boolean[]; aide: string; vent: boolean; muet: boolean; dt: number }) {
    const p = Math.floor(o.part * 100);
    if (p !== this.dernierPct) {
      this.dernierPct = p;
      this.pct.innerHTML = `${p}<span style="font-size:13px">%</span>`;
      this.arc.style.strokeDashoffset = String(194.8 * (1 - Math.min(1, o.part)));
    }
    if (o.graines !== this.dernieresGraines) {
      const plus = o.graines > this.dernieresGraines && this.dernieresGraines >= 0;
      this.dernieresGraines = o.graines;
      (this.graines.querySelector("span") as HTMLElement).textContent = `${o.graines} graine${o.graines > 1 ? "s" : ""}`;
      if (plus) {
        this.graines.classList.remove("bump");
        void this.graines.offsetWidth;
        this.graines.classList.add("bump");
      }
    }
    const cle = o.sources.map((s) => (s ? 1 : 0)).join("");
    if (cle !== this.dernieresSources) {
      this.dernieresSources = cle;
      const n = o.sources.filter(Boolean).length;
      this.sources.innerHTML = o.sources.map((s) => `<i class="source ${s ? "" : "dort"}"></i>`).join("") + `<span>${n}/${o.sources.length} sources</span>`;
      this.sources.classList.remove("bump");
      void this.sources.offsetWidth;
      this.sources.classList.add("bump");
    }
    if (o.aide !== this.derniereAide) {
      this.derniereAide = o.aide;
      if (o.aide) this.aide.innerHTML = o.aide;
      this.aide.classList.toggle("cache", !o.aide);
    }
    this.alerte.classList.toggle("cache", !o.vent);
    this.muet.classList.toggle("cache", !o.muet);
    if (this.annonceFin > 0) {
      this.annonceFin -= o.dt;
      if (this.annonceFin <= 0) this.annonce.classList.add("cache");
    }
  }

  annoncer(texte: string, sous = "", duree = 4) {
    this.annonce.innerHTML = texte + (sous ? `<small>${sous}</small>` : "");
    this.annonce.classList.remove("cache");
    this.annonceFin = duree;
  }

  majReperes(r: Repere[]) {
    while (this.elemsReperes.length < r.length) {
      const e = el(this.reperes, "repere", `<div class="fleche"></div><div class="point"></div>`);
      this.elemsReperes.push(e);
    }
    this.elemsReperes.forEach((e, k) => {
      const v = r[k];
      if (!v || !v.visible) {
        e.style.opacity = "0";
        return;
      }
      e.style.opacity = "1";
      e.className = `repere ${v.type}`;
      e.style.left = `${v.x}px`;
      e.style.top = `${v.y}px`;
      const f = e.firstElementChild as HTMLElement;
      const dx = Math.cos(v.angle) * 22, dy = Math.sin(v.angle) * 22;
      f.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${v.angle + Math.PI / 2}rad)`;
    });
  }

  afficherFps(t: string) {
    this.fps.classList.remove("cache");
    this.fps.textContent = t;
  }

  montrerFin(stats: { minutes: number; secondes: number; arbres: number; plantes: number }, flaner: () => void, rejouer: () => void) {
    this.fin?.remove();
    this.fin = el(
      this.racine,
      "fin cache",
      `<h2>La planète respire.</h2>
       <p>En ${stats.minutes} min ${String(stats.secondes).padStart(2, "0")} — ${stats.plantes} arbres plantés de tes mains, ${stats.arbres} en tout.</p>
       <div class="boutons">
         <button class="bouton" id="flaner">Flâner encore</button>
         <button class="bouton discret" id="rejouer">Recommencer</button>
       </div>`,
    );
    requestAnimationFrame(() => this.fin?.classList.remove("cache"));
    (this.fin.querySelector("#flaner") as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      this.fin?.classList.add("cache");
      flaner();
    };
    (this.fin.querySelector("#rejouer") as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      rejouer();
    };
  }
}
