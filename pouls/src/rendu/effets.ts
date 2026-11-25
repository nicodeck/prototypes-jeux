// Particules, mots de jugement, secousses et éclairs : la réponse visuelle à chaque geste.

import type { Evenement } from "../jeu";
import { eclaircir, hexVersRvb, rvb, type RVB } from "../outils";
import { REGLAGES, type Action } from "../reglages";
import { lueur, type Ctx } from "./ecran";
import { HAUTEUR } from "./obstacles";
import type { Vue } from "./vue";

type Genre = "etincelle" | "point" | "petale" | "anneau" | "eclat";

interface Particule {
  genre: Genre;
  /** Position « monde » (x en pixels de défilement) : les éclats restent accrochés au décor. */
  wx: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  duree: number;
  taille: number;
  c: RVB;
  rot: number;
  vrot: number;
  gravite: number;
}

interface Mot {
  texte: string;
  sous?: string;
  x: number;
  y: number;
  t0: number;
  c: RVB;
  taille: number;
}

const COULEURS: Record<Action, RVB> = {
  saut: hexVersRvb(REGLAGES.couleursActions.saut),
  frappe: hexVersRvb(REGLAGES.couleursActions.frappe),
  glisse: hexVersRvb(REGLAGES.couleursActions.glisse),
};
const OR: RVB = [255, 226, 140];
const ROUGE: RVB = [255, 70, 90];

export class Effets {
  private particules: Particule[] = [];
  private mots: Mot[] = [];
  secousse = 0;
  flash = 0;
  flashCouleur: RVB = [255, 255, 255];
  rouge = 0;
  /** Petit à-coup de zoom sur les frappes parfaites. */
  zoom = 0;
  private derniereMaj = -1;

  reinitialiser() {
    this.particules = [];
    this.mots = [];
    this.secousse = this.flash = this.rouge = this.zoom = 0;
  }

  traiter(evenements: Evenement[], v: Vue) {
    for (const e of evenements) {
      if (e.type === "jugement") this.jugement(e, v);
      else if (e.type === "cran") {
        this.mots.push({ texte: `×${e.multiplicateur}`, sous: "multiplicateur", x: v.xCoureur + 280, y: v.ySol - 220, t0: v.reel, c: OR, taille: 56 });
        this.anneauAutour(v, v.xCoureur, v.ySol - 40, OR, 3);
        this.flash = Math.max(this.flash, 0.25);
        this.flashCouleur = OR;
      } else if (e.type === "geste" && e.action === "glisse") {
        this.poussiere(v);
      }
    }
    evenements.length = 0;
  }

  private jugement(e: Extract<Evenement, { type: "jugement" }>, v: Vue) {
    const o = e.obstacle.o;
    const wx = o.temps * v.pixelsParTemps;
    const y = v.ySol - HAUTEUR[o.action];
    const c = COULEURS[o.action];
    const xMot = v.xCoureur + 20;
    const yMot = v.ySol - 285;
    if (e.jugement === "rate") {
      this.mots = this.mots.filter((m) => m.sous === "multiplicateur");
      this.mots.push({ texte: e.tropTot ? "TROP TÔT" : "RATÉ", x: xMot, y: yMot, t0: v.reel, c: ROUGE, taille: 30 });
      this.rouge = 1;
      this.secousse = Math.max(this.secousse, 7);
      for (let i = 0; i < 10; i++) this.ajouter("point", wx, y, (Math.random() - 0.5) * 120, -Math.random() * 120, 0.6, 3, [140, 120, 130], 200);
      return;
    }
    const parfait = e.jugement === "parfait";
    const tard = e.ecart > 0;
    // Un seul mot de jugement à la fois : le plus récent remplace le précédent.
    this.mots = this.mots.filter((m) => m.sous === "multiplicateur");
    this.mots.push({
      texte: parfait ? "PARFAIT" : "BIEN",
      sous: parfait ? undefined : tard ? "tard" : "tôt",
      x: xMot,
      y: yMot,
      t0: v.reel,
      c: parfait ? OR : eclaircir(c, 0.3),
      taille: parfait ? 38 : 30,
    });
    const n = parfait ? 34 : 16;
    if (o.action === "saut") {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const s = 120 + Math.random() * 320;
        this.ajouter("petale", wx + (Math.random() - 0.5) * 40, v.ySol - 20, Math.cos(a) * s, Math.sin(a) * s, 1 + Math.random() * 0.6, 4 + Math.random() * 3, i % 3 ? c : eclaircir(c, 0.6), 420);
      }
    } else if (o.action === "frappe") {
      for (let i = 0; i < n * 1.4; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 200 + Math.random() * 500;
        this.ajouter(i % 2 ? "etincelle" : "eclat", wx, y, Math.cos(a) * s + 120, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 3 + Math.random() * 4, i % 4 ? c : [255, 255, 255], 300);
      }
      this.secousse = Math.max(this.secousse, parfait ? 10 : 5);
      this.zoom = parfait ? 1 : 0.5;
    } else {
      for (let i = 0; i < n; i++) {
        this.ajouter("etincelle", wx + (Math.random() - 0.5) * 30, y, (Math.random() - 0.5) * 160, 60 + Math.random() * 300, 0.7 + Math.random() * 0.5, 3, i % 3 ? c : eclaircir(c, 0.6), 600);
      }
    }
    this.ajouter("anneau", wx, y, 0, 0, parfait ? 0.45 : 0.3, parfait ? 120 : 70, parfait ? eclaircir(c, 0.4) : c, 0);
    if (parfait) {
      this.ajouter("anneau", wx, y, 0, 0, 0.6, 190, c, 0);
      this.flash = Math.max(this.flash, o.action === "frappe" ? 0.22 : 0.1);
      this.flashCouleur = eclaircir(c, 0.5);
      this.secousse = Math.max(this.secousse, o.action === "frappe" ? 10 : 3);
    }
  }

  /** L'arrivée : le cœur de l'arbre éclate en lumière. */
  grandFinal(v: Vue, x: number, y: number) {
    this.flash = 1;
    this.flashCouleur = [255, 225, 235];
    this.secousse = 16;
    const wx = v.temps * v.pixelsParTemps + (x - v.xCoureur);
    for (let i = 0; i < 4; i++) this.ajouter("anneau", wx, y, 0, 0, 0.8 + i * 0.35, 260 + i * 220, eclaircir(v.palette.horizon, 0.3 * i), 0);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 700;
      const c = i % 4 ? v.palette.lueurs[i % 3] : ([255, 255, 255] as RVB);
      this.ajouter(i % 3 ? "point" : "petale", wx, y, Math.cos(a) * s, Math.sin(a) * s, 1.5 + Math.random() * 2.5, 2 + Math.random() * 4, c, 40);
    }
  }

  /** Entrée dans une nouvelle section : éclair et ondes aux couleurs de la palette. */
  nouvelleSection(v: Vue) {
    this.flash = Math.max(this.flash, 0.45);
    this.flashCouleur = eclaircir(v.palette.horizon, 0.3);
    this.anneauAutour(v, v.xCoureur, v.ySol - 40, v.palette.horizon, 3);
    const wx = v.temps * v.pixelsParTemps;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 150 + Math.random() * 500;
      this.ajouter("point", wx + (Math.random() - 0.3) * v.W, v.ySol - Math.random() * 400, Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, 1 + Math.random(), 2 + Math.random() * 2, v.palette.lueurs[i % 3], 0);
    }
  }

  private anneauAutour(v: Vue, x: number, y: number, c: RVB, n: number) {
    const wx = v.temps * v.pixelsParTemps + (x - v.xCoureur);
    for (let i = 0; i < n; i++) this.ajouter("anneau", wx, y, 0, 0, 0.5 + i * 0.15, 140 + i * 70, c, 0);
  }

  private poussiere(v: Vue) {
    const wx = v.temps * v.pixelsParTemps;
    for (let i = 0; i < 14; i++) {
      this.ajouter("etincelle", wx + 10, v.ySol - 2, 100 + Math.random() * 250, -Math.random() * 160, 0.35 + Math.random() * 0.3, 2, v.palette.trainee, 500);
    }
  }

  /** Étincelles d'ambiance propres à chaque section (spores, pollen, braises). */
  private ambiance(v: Vue, dt: number) {
    const s = Math.round(v.section);
    const taux = [6, 14, 12, 22][s] ?? 8;
    let n = taux * dt + Math.random();
    const wx0 = v.temps * v.pixelsParTemps - v.xCoureur;
    while (n-- > 1) {
      const x = wx0 + Math.random() * (v.W + 300);
      const c = v.palette.lueurs[Math.floor(Math.random() * 3)];
      if (s === 1) this.ajouter("point", x, v.ySol + 10, (Math.random() - 0.5) * 20, -30 - Math.random() * 60, 4 + Math.random() * 3, 2 + Math.random() * 2.5, c, -2);
      else if (s === 2) this.ajouter("petale", x, -10, -20 - Math.random() * 30, 30 + Math.random() * 40, 8, 3 + Math.random() * 2, c, 4);
      else if (s === 3) this.ajouter("point", x, v.ySol + 10, (Math.random() - 0.5) * 40, -60 - Math.random() * 90, 3 + Math.random() * 2, 1.5 + Math.random() * 2, c, -10);
      else this.ajouter("point", x, v.ySol - Math.random() * 300, (Math.random() - 0.5) * 10, -10, 3, 1.5, c, 0);
    }
  }

  private ajouter(genre: Genre, wx: number, y: number, vx: number, vy: number, duree: number, taille: number, c: RVB, gravite: number) {
    if (this.particules.length > 1800) return;
    this.particules.push({ genre, wx, y, vx, vy, vie: 0, duree, taille, c, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 12, gravite });
  }

  mettreAJour(v: Vue, enJeu: boolean) {
    const dt = this.derniereMaj < 0 ? 0 : Math.min(0.05, v.reel - this.derniereMaj);
    this.derniereMaj = v.reel;
    if (enJeu) this.ambiance(v, dt);
    for (const p of this.particules) {
      p.vie += dt;
      p.vx *= 1 - dt * (p.genre === "petale" ? 1.8 : 1.2);
      p.vy = p.vy * (1 - dt * (p.genre === "petale" ? 1.8 : 1.2)) + p.gravite * dt;
      p.wx += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    this.particules = this.particules.filter((p) => p.vie < p.duree);
    this.secousse *= Math.pow(0.0005, dt);
    this.flash *= Math.pow(0.002, dt);
    this.rouge *= Math.pow(0.02, dt);
    this.zoom *= Math.pow(0.001, dt);
  }

  decalageSecousse(): [number, number] {
    const s = this.secousse;
    return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s];
  }

  dessinerParticules(ctx: Ctx, v: Vue) {
    const ox = v.temps * v.pixelsParTemps - v.xCoureur;
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particules) {
      const x = p.wx - ox;
      if (x < -50 || x > v.W + 50) continue;
      const k = p.vie / p.duree;
      const a = 1 - k;
      switch (p.genre) {
        case "point":
          lueur(ctx, x, p.y, p.taille * 4, p.c, a * 0.6);
          lueur(ctx, x, p.y, p.taille, eclaircir(p.c, 0.5), a);
          break;
        case "etincelle": {
          ctx.strokeStyle = rvb(eclaircir(p.c, 0.3), a);
          ctx.lineWidth = p.taille * 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.lineTo(x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          break;
        }
        case "petale":
        case "eclat": {
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = rvb(p.c, a);
          ctx.beginPath();
          if (p.genre === "petale") ctx.ellipse(0, 0, p.taille, p.taille * 0.45 * Math.abs(Math.cos(p.rot * 1.3)) + 0.5, 0, 0, Math.PI * 2);
          else {
            ctx.moveTo(-p.taille, -p.taille * 0.4);
            ctx.lineTo(p.taille * 1.4, 0);
            ctx.lineTo(-p.taille, p.taille * 0.4);
          }
          ctx.fill();
          ctx.restore();
          lueur(ctx, x, p.y, p.taille * 3, p.c, a * 0.35);
          break;
        }
        case "anneau": {
          const r = p.taille * (1 - Math.pow(1 - k, 3));
          ctx.strokeStyle = rvb(p.c, a * 0.8);
          ctx.lineWidth = 1 + 6 * a;
          ctx.beginPath();
          ctx.arc(x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  dessinerMots(ctx: Ctx, v: Vue) {
    this.mots = this.mots.filter((m) => v.reel - m.t0 < 0.75);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const m of this.mots) {
      const k = (v.reel - m.t0) / 0.75;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.6);
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const y = m.y - k * 30;
      ctx.save();
      ctx.translate(m.x, y);
      ctx.scale(pop, pop);
      ctx.font = `900 ${m.taille}px Unbounded, sans-serif`;
      ctx.globalCompositeOperation = "lighter";
      lueur(ctx, 0, 0, m.taille * 2.4, m.c, 0.35 * a, 2.2);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 5;
      ctx.strokeStyle = `rgba(5,4,12,${0.7 * a})`;
      ctx.strokeText(m.texte, 0, 0);
      ctx.fillStyle = rvb(eclaircir(m.c, 0.35), a);
      ctx.fillText(m.texte, 0, 0);
      if (m.sous) {
        ctx.font = `600 ${Math.round(m.taille * 0.45)}px Outfit, sans-serif`;
        ctx.fillStyle = rvb(m.c, a * 0.85);
        ctx.fillText(m.sous, 0, m.taille * 0.75);
      }
      ctx.restore();
    }
  }

  /** Éclair blanc et voile rouge, par-dessus tout le reste. */
  dessinerVoiles(ctx: Ctx, v: Vue) {
    if (this.flash > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rvb(this.flashCouleur, this.flash * 0.5);
      ctx.fillRect(0, 0, v.W, v.H);
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.rouge > 0.01) {
      const g = ctx.createRadialGradient(v.W / 2, v.H / 2, v.H * 0.3, v.W / 2, v.H / 2, v.W * 0.7);
      g.addColorStop(0, "rgba(255,30,60,0)");
      g.addColorStop(1, `rgba(255,30,60,${0.35 * this.rouge})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, v.W, v.H);
    }
  }
}
