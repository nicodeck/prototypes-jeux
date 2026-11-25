// La partie : relie la simulation, le rendu, le son et l'interface, et enchaîne les états
// (titre → arrivée → jeu → fin).
import * as THREE from "three";
import { DEBUG } from "../debug";
import { lisse } from "../monde/bruit";
import { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";
import { RenduArbres } from "../rendu/arbres";
import { Ciel } from "../rendu/ciel";
import { GLOBAL, TexturesEtat } from "../rendu/communs";
import { Creatures } from "../rendu/creatures";
import { Effets } from "../rendu/effets";
import { creerBuissons } from "../rendu/buissons";
import { creerFleurs } from "../rendu/fleurs";
import { creerHerbe } from "../rendu/herbe";
import { Nuages } from "../rendu/nuages";
import { RenduObjets } from "../rendu/objets";
import { Perso } from "../rendu/perso";
import { RenduPlanete } from "../rendu/planete";
import { Rendu } from "../rendu/scene";
import type { Tapis } from "../rendu/tapis";
import { Sons } from "../son/sons";
import { Hud, type Repere } from "../ui/hud";
import { Aide } from "./aide";
import { CameraJeu } from "./camera";
import { Cycle } from "./cycle";
import { Entree } from "./entree";
import { Joueur } from "./joueur";

const R = REGLAGES.planete.rayon;
type Etat = "titre" | "arrivee" | "jeu" | "fin";

export class Jeu {
  readonly monde: Monde;
  readonly rendu: Rendu;
  private readonly textures: TexturesEtat;
  private readonly planete: RenduPlanete;
  private readonly herbe: Tapis;
  private readonly fleurs: Tapis;
  private readonly buissons: Tapis;
  private readonly arbres: RenduArbres;
  private readonly objets: RenduObjets;
  private readonly ciel: Ciel;
  readonly perso: Perso;
  private readonly creatures: Creatures;
  private readonly effets: Effets;
  private readonly nuages = new Nuages();
  readonly joueur: Joueur;
  readonly camera: CameraJeu;
  readonly entree: Entree;
  readonly sons = new Sons();
  private readonly hud: Hud;
  private readonly cycle: Cycle;
  private readonly aide = new Aide();

  etat: Etat = "titre";
  graines = REGLAGES.joueur.grainesDepart;
  private ramassees = 0;
  private tempsJeu = 0;
  private temps = 0;
  private transition = 0;
  private accTextures = 0;
  private plante = 0;
  private souffle = 0;
  private recharge = 0;
  private finDepuis = -1;
  private combo = 0;
  private comboT = 0;
  private bouchonInitial: THREE.Vector3;
  private floraison = 0;
  private nuitLissee = 0;
  private eauProche = 0;
  private dernier = performance.now();
  private moyenne = 16;
  private compteurPerf = 0;
  private sousLeVent = 0;
  /** Coups de pelle accumulés (pour le son et les particules). */
  private creuse = false;
  private aCreuse = false;
  private reperes: Repere[] = [];

  constructor(toile: HTMLCanvasElement, ui: HTMLElement) {
    this.monde = new Monde();
    this.monde.vite = DEBUG.vite;
    if (DEBUG.cendre !== null) this.monde.prochainVent = DEBUG.cendre;
    if (DEBUG.vie > 0 || DEBUG.fin) this.monde.verdir(DEBUG.fin ? 0.87 : DEBUG.vie);
    if (DEBUG.graines !== null) this.graines = DEBUG.graines;
    this.bouchonInitial = this.monde.pierres[0].dir.clone();

    this.rendu = new Rendu(toile);
    const scene = this.rendu.scene;
    this.textures = new TexturesEtat(this.monde);
    this.planete = new RenduPlanete(this.monde);
    this.herbe = creerHerbe(this.monde);
    this.fleurs = creerFleurs(this.monde);
    this.buissons = creerBuissons(this.monde);
    this.arbres = new RenduArbres(this.monde);
    this.objets = new RenduObjets(this.monde);
    this.ciel = new Ciel();
    this.perso = new Perso();
    this.creatures = new Creatures(this.monde);
    this.effets = new Effets(this.monde);
    scene.add(
      this.ciel.groupe,
      this.planete.sol,
      this.planete.eau,
      this.herbe.groupe,
      this.fleurs.groupe,
      this.buissons.groupe,
      this.arbres.groupe,
      this.objets.groupe,
      this.perso.groupe,
      this.creatures.groupe,
      this.effets.groupe,
      this.nuages.groupe,
    );

    this.joueur = new Joueur(this.monde);
    this.camera = new CameraJeu(this.monde);
    this.camera.init(this.joueur);
    this.entree = new Entree(toile);
    this.hud = new Hud(ui);
    this.cycle = new Cycle(this.monde.plan.depart, DEBUG.heure ?? REGLAGES.heureDepart);

    this.perso.surPas = () => this.surPas();
    this.creatures.surChant = (p) => {
      const cam = this.rendu.camera;
      const droite = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const d = p.clone().sub(cam.position);
      this.sons.oiseau(THREE.MathUtils.clamp(d.clone().normalize().dot(droite), -1, 1), d.length());
    };

    this.hud.surJouer(() => this.commencer());
    toile.addEventListener("click", () => {
      if (this.etat === "jeu") this.entree.verrouiller();
    });

    if (DEBUG.direct) {
      this.etat = "jeu";
      this.camera.orbite = 0;
      this.hud.montrerJeu();
    }
    // La victoire sera annoncée au prochain pas de simulation
    if (DEBUG.fin) this.monde.victoire = false;
  }

  private commencer() {
    if (this.etat !== "titre") return;
    this.sons.demarrer(DEBUG.muet);
    this.etat = "arrivee";
    this.transition = 0;
    this.hud.montrerJeu();
    this.hud.cacherHud(true);
  }

  boucle() {
    const maintenant = performance.now();
    const dt = Math.min(0.05, (maintenant - this.dernier) / 1000);
    this.dernier = maintenant;
    this.etape(dt);
    this.mesurer(dt);
  }

  private mesurer(dt: number) {
    this.moyenne += (dt * 1000 - this.moyenne) * 0.05;
    if (DEBUG.fps) this.hud.afficherFps(`${this.moyenne.toFixed(1)} ms · qualité ${this.rendu.qualite}`);
    this.compteurPerf += dt;
    if (this.compteurPerf > 3) {
      this.compteurPerf = 0;
      if (this.moyenne > 30 && this.rendu.qualite > 0.5) {
        this.rendu.qualite = Math.max(0.5, this.rendu.qualite - 0.25);
        this.rendu.redimensionner();
      }
    }
  }

  /** Avance le jeu d'un pas (appelé à chaque image ; aussi utilisable à la main pour les essais). */
  etape(dt: number) {
    this.temps += dt;
    const e = this.entree;
    const m = this.monde;

    // ——— États ———
    if (this.etat === "arrivee") {
      this.transition += dt / 3.2;
      this.camera.orbite = 1 - lisse(0, 1, this.transition);
      this.sons.titre(Math.min(1, this.transition));
      if (this.transition >= 1) {
        this.etat = "jeu";
        this.hud.cacherHud(false);
        this.hud.annoncer("Germe", "Réveille la planète", 3.5);
      }
    } else if (this.etat === "titre") {
      this.sons.titre(0.6);
    }
    const enJeu = this.etat === "jeu";
    this.cycle.avancer(dt * (this.etat === "titre" ? 3 : 1));
    GLOBAL.uSoleil.value.copy(this.cycle.soleil);
    GLOBAL.uLune.value.copy(this.cycle.lune);
    m.soleil.copy(this.cycle.soleil);

    // ——— Le joueur ———
    const j = this.joueur;
    const { avant, droite } = this.camera.reperes(j);
    const dir = enJeu ? e.direction() : { x: 0, y: 0 };
    const souhait = avant.clone().multiplyScalar(dir.y).addScaledVector(droite, dir.x);
    if (souhait.lengthSq() > 1) souhait.normalize();
    const course = e.appuye("ShiftLeft", "ShiftRight");
    const saut = enJeu && e.frappe("Space");
    const etaitAuSol = j.auSol;
    j.maj(dt, souhait, course, saut);
    const up = j.pos.clone().normalize();
    if (saut && etaitAuSol && !j.auSol) this.sons.saut();
    if (!etaitAuSol && j.auSol && j.vertical < -4) {
      this.sons.atterrir();
      this.effets.atterrir(j.pos, up, m.vie[j.noeud] < 0.4);
    }
    if (enJeu) {
      this.tempsJeu += dt;
      this.actions(dt, up);
    }
    if (e.frappe("KeyM")) this.sons.basculerMuet();

    // ——— Simulation ———
    m.avancer(dt);
    this.evenements(up);
    this.accTextures += dt;
    if (this.accTextures > 0.1) {
      this.accTextures = 0;
      this.textures.maj();
    }
    this.planete.majSol();

    // ——— Rendu ———
    const cam = this.rendu.camera;
    this.camera.maj(dt, cam, j, enJeu ? e.sourisDx : 0, enJeu ? e.sourisDy : 0, enJeu ? e.molette : 0, e.calmeSouris);
    const enOrbite = this.camera.orbite > 0.5;
    const hautVue = enOrbite ? cam.position.clone().normalize() : up;
    const jour = this.cycle.jour(hautVue);
    const nuit = 1 - jour;
    this.nuitLissee += (nuit - this.nuitLissee) * Math.min(1, dt * 2);
    const vieVisuelle = Math.min(1, m.part / 0.6);

    GLOBAL.uJoueur.value.copy(j.pos);
    GLOBAL.uPart.value = m.part;
    const floraisonCible = this.etat === "fin" ? 1 : lisse(0.06, 0.8, m.part) * 0.85;
    this.floraison += (floraisonCible - this.floraison) * Math.min(1, dt * (this.etat === "fin" ? 0.4 : 0.2));
    GLOBAL.uFloraison.value = this.floraison;
    // Vent : tourne lentement ; plus fort pendant une tempête proche
    const ventDir = new THREE.Vector3(Math.cos(this.temps * 0.05), 0.3, Math.sin(this.temps * 0.05)).normalize();
    let tempete = 0;
    for (const v of m.vents) {
      const d = v.centre.angleTo(up) * R;
      const f = Math.min(1, v.temps / 3) * Math.min(1, (v.duree - v.temps) / 3);
      const k = (1 - lisse(REGLAGES.cendre.rayon * 0.6, REGLAGES.cendre.rayon * 1.6, d)) * f;
      if (k > tempete) {
        tempete = k;
        ventDir.crossVectors(v.axe, v.centre).normalize();
      }
    }
    this.sousLeVent += (tempete - this.sousLeVent) * Math.min(1, dt * 1.5);
    GLOBAL.uVent.value.lerp(ventDir, Math.min(1, dt)).normalize();
    GLOBAL.uForceVent.value = 0.3 + this.sousLeVent * 1.2;

    const sLocal = this.cycle.soleil.dot(hautVue);
    this.nuages.maj(dt * (this.etat === "titre" ? 4 : 1), vieVisuelle, Math.exp(-((sLocal / 0.22) ** 2)), this.nuitLissee, this.camera.orbite);
    this.arbres.maj(dt);
    this.arbres.nuit(this.nuitLissee);
    this.objets.maj(dt, this.temps, this.nuitLissee, this.camera.orbite);
    this.creatures.maj(dt, this.temps, j.pos, cam.position, m.part, 1 - this.nuitLissee);
    this.effets.maj(dt, this.temps, { joueur: j.pos, camera: cam.position, nuit: this.nuitLissee, orbite: enOrbite });
    this.perso.placer(j.pos, up, j.avant);
    this.perso.animer(dt, this.temps, {
      vitesse: j.vitesse,
      vitesseMax: REGLAGES.joueur.course,
      auSol: j.auSol,
      vertical: j.vertical,
      creuse: this.creuse,
      plante: this.plante,
      souffle: this.souffle,
      graines: this.graines,
      nuit: this.nuitLissee,
    });
    this.plante = Math.max(0, this.plante - dt * 2.5);
    this.souffle = Math.max(0, this.souffle - dt * 2);

    // Curseur de plantation
    const devant = this.devant(j, up);
    if (enJeu && this.graines > 0 && this.sourceProche(up) < 0) {
      const p = m.plantable(devant);
      this.effets.placerCurseur(m.surface(devant), devant, p === "ok" ? "ok" : "non", this.temps);
    } else this.effets.placerCurseur(j.pos, up, "rien", this.temps);

    const atmo = 1 - lisse(0.15, 0.85, this.camera.orbite);
    this.ciel.maj(cam, hautVue, atmo, vieVisuelle, this.sousLeVent, this.rendu.renderer.getPixelRatio());
    this.planete.majCiel(this.couleurCiel(hautVue, vieVisuelle));
    this.eclairer(hautVue, jour, atmo, vieVisuelle, j.pos);
    const auSol = this.camera.orbite < 0.3;
    this.herbe.cadrer(cam.position, auSol, 30);
    this.fleurs.cadrer(cam.position, auSol, 24);
    this.buissons.cadrer(cam.position, auSol, 30);
    this.effets.lumineux.echelle(window.innerHeight * this.rendu.renderer.getPixelRatio(), cam.fov);
    this.effets.mats.echelle(window.innerHeight * this.rendu.renderer.getPixelRatio(), cam.fov);

    const fx = this.rendu.final.uniforms;
    fx.uVie.value = vieVisuelle;
    fx.uCendre.value = this.sousLeVent;
    fx.uNuit.value = this.nuitLissee * atmo;
    this.rendu.bloom.strength = 0.45 + this.nuitLissee * 0.35 + (this.etat === "fin" ? 0.25 : 0);
    this.rendu.dessiner(this.temps);

    // ——— Son ———
    this.eauProche += ((enOrbite ? 0 : this.mesurerEau(up)) - this.eauProche) * Math.min(1, dt * 3);
    this.sons.ambiance(dt, {
      vie: m.part,
      nuit: this.nuitLissee,
      eauProche: this.eauProche,
      tempete: this.sousLeVent,
      poussee: j.poussee,
      enJeu,
    });

    // ——— Interface ———
    if (this.etat === "jeu" || this.etat === "fin") {
      this.hud.maj({
        part: m.part,
        graines: this.graines,
        sources: m.sources.map((s) => s.active),
        aide: this.etat === "jeu" ? this.texteAide(up, devant) : "",
        vent: m.vents.length > 0 && this.etat === "jeu",
        muet: this.sons.muet,
        dt,
      });
      this.majReperes(up);
    }
    if (this.etat === "fin") this.majFin(dt);
    e.finImage(dt);
  }

  /** Débogage : fait avancer la simulation sans dessiner (en secondes de jeu). */
  debugAvancer(secondes: number) {
    const pas = 1 / 30;
    for (let t = 0; t < secondes; t += pas) {
      this.cycle.avancer(pas);
      this.monde.soleil.copy(this.cycle.soleil);
      this.monde.avancer(pas);
      this.tempsJeu += pas;
      this.evenements(this.joueur.pos.clone().normalize());
    }
    this.textures.maj();
    this.arbres.maj(10);
  }

  /** Débogage : place le petit être à côté d'un endroit, tourné vers lui. */
  debugAller(cible: THREE.Vector3, recul: number) {
    const c = cible.clone().normalize();
    const t = new THREE.Vector3(0.3, 1, 0.2);
    t.addScaledVector(c, -t.dot(c)).normalize();
    const p = c.clone().applyAxisAngle(new THREE.Vector3().crossVectors(c, t).normalize(), -recul / R);
    this.joueur.teleporter(p);
    const h = p.clone().normalize();
    this.joueur.avant.copy(c).addScaledVector(h, -c.dot(h)).normalize();
    this.camera.cap.copy(this.joueur.avant);
  }

  private devant(j: Joueur, up: THREE.Vector3) {
    const axe = new THREE.Vector3().crossVectors(up, j.avant).normalize();
    return up.clone().applyAxisAngle(axe, 0.75 / R).normalize();
  }

  private sourceProche(up: THREE.Vector3) {
    return this.monde.sources.findIndex((s) => !s.active && s.dir.angleTo(up) * R < 3.2);
  }

  // ——— Actions du joueur ———

  private actions(dt: number, up: THREE.Vector3) {
    const e = this.entree;
    const m = this.monde;
    const j = this.joueur;

    // Ramasser les graines
    this.comboT -= dt;
    if (this.comboT < 0) this.combo = 0;
    for (const g of [...m.graines]) {
      if (g.age < 0.6) continue;
      const p = m.surface(g.dir, new THREE.Vector3(), 0.35);
      if (p.distanceTo(j.pos) < REGLAGES.joueur.ramassage) {
        m.graines.splice(m.graines.indexOf(g), 1);
        this.graines++;
        this.ramassees++;
        this.effets.ramasser(p);
        this.sons.ramasser(this.combo);
        this.combo++;
        this.comboT = 2.5;
        if (this.ramassees === 1) this.aide.conseiller("ramasse", "Une graine ! Elle tourne maintenant autour de toi", this.tempsJeu, 3);
      }
    }

    // Planter / offrir
    const veutPlanter = e.frappe("KeyE") || (e.clicGauche && e.verrouille);
    if (veutPlanter) {
      const k = this.sourceProche(up);
      if (this.graines <= 0) {
        this.sons.refus();
      } else if (k >= 0) {
        this.graines--;
        m.reveillerSource(k);
        this.plante = 1;
      } else {
        const devant = this.devant(j, up);
        const p = m.plantable(devant);
        if (p === "ok") {
          const a = m.planter(devant);
          this.graines--;
          this.plante = 1;
          const pos = m.surface(a.dir);
          this.effets.planter(pos, a.dir);
          this.sons.planter();
          this.camera.secousse = 0.25;
          if (m.arbresPlantes === 1) {
            this.aide.conseiller("premier", "L'arbre va pousser et humidifier la terre autour de lui", this.tempsJeu, 6);
          }
        } else {
          this.sons.refus();
          const raisons = { sec: "Trop sec ici : il faut de la terre humide", eau: "Pas dans l'eau", arbre: "Trop près d'un autre arbre", source: "Trop près de la source", ok: "" };
          this.hud.annoncer("", raisons[p], 1.6);
        }
      }
    }

    if (this.tempsJeu > 110 && m.arbresPlantes > 0 && !this.aCreuse) {
      this.aide.conseiller("pelle", "Maintiens <kbd>F</kbd> en marchant pour creuser une rigole : l'eau suit les creux", this.tempsJeu, 7);
    }
    // Creuser
    this.creuse = e.appuye("KeyF") || e.boutonDroit;
    if (this.creuse && j.auSol) {
      const devant = this.devant(j, up);
      const retire = m.creuser(devant, dt);
      if (retire > 0) {
        this.sons.creuser();
        this.effets.creuser(m.surface(devant), devant, m.humid[j.noeud] > 0.3);
      }
      this.aCreuse = true;
      this.aide.conseiller("rigole", "Creuse en marchant pour tracer une rigole : l'eau suit les creux", this.tempsJeu, 6);
    }

    // Souffle
    this.recharge = Math.max(0, this.recharge - dt);
    if (e.frappe("KeyC") && this.recharge <= 0) {
      this.recharge = REGLAGES.souffle.recharge;
      this.souffle = 1;
      this.lancerSouffle(up);
    }
  }

  private lancerSouffle(up: THREE.Vector3) {
    const m = this.monde;
    const S = REGLAGES.souffle;
    this.effets.souffle(this.joueur.pos, up);
    this.sons.souffle();
    const n = m.noeud(up);
    m.sphere.autour(n, S.rayon / R, (i, cos) => {
      const d = Math.acos(Math.min(1, cos)) * R;
      const f = 1 - lisse(S.rayon * 0.5, S.rayon, d);
      m.cendre[i] *= 1 - f;
      if (m.humid[i] >= REGLAGES.vie.seuilHumide * 0.8) m.vie[i] = Math.min(1, m.vie[i] + S.elan * f);
    });
    for (const a of m.arbres) {
      if (a.dir.angleTo(up) * R < S.rayon && a.croissance < 1) a.croissance = Math.min(1, a.croissance + 0.08);
    }
    // Le souffle disperse la tempête qui passe
    for (const v of m.vents) {
      if (v.centre.angleTo(up) * R < REGLAGES.cendre.rayon + S.rayon) v.temps = Math.max(v.temps, v.duree - 4);
    }
  }

  private surPas() {
    const m = this.monde;
    const j = this.joueur;
    const i = j.noeud;
    const sol = m.eau[i] > 0.03 ? "eau" : m.vie[i] > 0.5 ? "herbe" : "mort";
    this.sons.pas(sol);
    this.effets.pas(j.pos, j.pos.clone().normalize(), sol);
  }

  // ——— Événements de la simulation ———

  private evenements(up: THREE.Vector3) {
    const m = this.monde;
    while (m.evenements.length) {
      const ev = m.evenements.shift()!;
      if (ev.type === "source") {
        const s = m.sources[ev.source];
        const pos = m.surface(s.dir);
        this.effets.source(pos, s.dir);
        const proche = s.dir.angleTo(up) * R < 20;
        if (this.etat === "jeu" || this.etat === "arrivee") {
          this.sons.source();
          if (proche) this.camera.secousse = 1;
          const n = m.sources.filter((x) => x.active).length;
          this.hud.annoncer("Une source s'éveille", `${n} sur ${m.sources.length}`, 4.5);
          if (n === 2) this.aide.conseiller("sources", "Les sources endormies sont signalées au bord de l'écran", this.tempsJeu, 6);
        }
      } else if (ev.type === "arbreAdulte") {
        const pos = m.surface(ev.arbre.dir);
        if (pos.distanceTo(this.joueur.pos) < 18) {
          this.effets.arbreAdulte(pos, ev.arbre.dir);
          const droite = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rendu.camera.quaternion);
          this.sons.arbreAdulte(pos.clone().sub(this.rendu.camera.position).normalize().dot(droite));
        }
        if (m.arbres.filter((a) => a.croissance >= 1).length === 1) {
          this.aide.conseiller("graines", "Les arbres adultes sèment des graines autour d'eux", this.tempsJeu, 6);
        }
      } else if (ev.type === "vent") {
        if (this.etat === "jeu") {
          this.sons.vent();
          this.hud.annoncer("Un vent de cendre se lève", "les arbres et l'eau protègent la vie", 4);
        }
      } else if (ev.type === "victoire") {
        this.lancerFin();
      }
    }
  }

  private lancerFin() {
    if (this.etat === "fin") return;
    this.etat = "fin";
    this.finDepuis = 0;
    this.camera.decalage = -5;
    this.sons.victoire();
    this.hud.cacherHud(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private majFin(dt: number) {
    const avant = this.finDepuis;
    this.finDepuis += dt;
    // Le petit être lève les yeux, la caméra s'envole en orbite
    this.camera.orbite = lisse(1.5, 8, this.finDepuis);
    // Une vague de vert part du petit être et fait le tour de la planète
    if (this.finDepuis < 12) {
      const m = this.monde;
      const centre = this.joueur.pos.clone().normalize();
      const rayon = lisse(0.3, 9, this.finDepuis) * Math.PI * 1.05;
      const d = m.sphere.dir;
      for (let i = 0; i < m.n; i++) {
        const c = d[i * 3] * centre.x + d[i * 3 + 1] * centre.y + d[i * 3 + 2] * centre.z;
        const a = Math.acos(Math.max(-1, Math.min(1, c)));
        if (a > rayon) continue;
        const f = Math.min(1, (rayon - a) * 4);
        if (m.vie[i] < f) m.vie[i] = f;
        if (m.humid[i] < 0.6 * f) m.humid[i] = 0.6 * f;
        m.cendre[i] *= 1 - f;
      }
    }
    if (avant < 2 && this.finDepuis >= 2) this.effets.feuDArtifice();
    if (avant < 5 && this.finDepuis >= 5) this.effets.feuDArtifice();
    if (avant < 7 && this.finDepuis >= 7) {
      const t = this.tempsJeu;
      this.hud.montrerFin(
        {
          minutes: Math.floor(t / 60),
          secondes: Math.floor(t % 60),
          arbres: this.monde.arbres.length,
          plantes: this.monde.arbresPlantes,
        },
        () => {
          this.etat = "arrivee";
          this.transition = 0;
          this.finDepuis = -1;
        },
        () => location.reload(),
      );
    }
  }

  // ——— Lumières, couleurs ———

  private couleurCiel(haut: THREE.Vector3, vie: number) {
    const s = this.cycle.soleil.dot(haut);
    const jour = THREE.MathUtils.smoothstep(s, -0.28, 0.22);
    const horJ = new THREE.Color(0.62, 0.55, 0.53).lerp(new THREE.Color(0.6, 0.78, 0.95), vie);
    const horN = new THREE.Color(0.03, 0.05, 0.12);
    const c = horN.lerp(horJ, jour);
    const crep = Math.exp(-(((s + 0.03) / 0.2) ** 2));
    c.lerp(new THREE.Color(0.95, 0.55, 0.42), crep * 0.5);
    return c;
  }

  private eclairer(haut: THREE.Vector3, jour: number, atmo: number, vie: number, centre: THREE.Vector3) {
    const r = this.rendu;
    const s = this.cycle.soleil.dot(haut);
    const crep = Math.exp(-(((s - 0.05) / 0.22) ** 2));
    r.soleil.color.setRGB(1, 0.94, 0.84).lerp(new THREE.Color(1, 0.6, 0.35), crep * 0.8);
    r.soleil.intensity = 2.3;
    r.lune.intensity = 0.55 + (1 - atmo) * 0.2;
    // Lumière du ciel : bleue le jour, nuit bleu sombre
    const cielJ = new THREE.Color(0.62, 0.74, 0.95);
    const cielN = new THREE.Color(0.22, 0.28, 0.5);
    r.ciel.color.copy(cielN).lerp(cielJ, jour);
    r.ciel.groundColor.setRGB(0.3, 0.27, 0.24).lerp(new THREE.Color(0.22, 0.32, 0.16), vie * jour);
    r.ciel.intensity = (0.45 + 0.4 * jour) * (atmo * 0.85 + 0.15) + (1 - atmo) * 0.25;
    r.eclairer(atmo > 0.5 ? centre : new THREE.Vector3(), atmo > 0.5 ? haut : this.rendu.camera.position.clone().normalize());
    // Brouillard d'horizon, seulement près du sol
    const c = this.couleurCiel(haut, vie);
    c.lerp(new THREE.Color(0.3, 0.27, 0.25), this.sousLeVent * 0.8);
    r.brouillard.color.copy(c);
    r.brouillard.density = (0.012 + this.sousLeVent * 0.05) * atmo;
    if (atmo < 0.5) {
      // En orbite, l'ombre doit couvrir toute la planète
      const o = r.soleil.shadow.camera;
      o.left = o.bottom = -22;
      o.right = o.top = 22;
      o.far = 120;
      r.soleil.position.copy(this.cycle.soleil).multiplyScalar(60);
      o.updateProjectionMatrix();
    } else {
      const o = r.soleil.shadow.camera;
      if (o.right !== 16) {
        o.left = o.bottom = -16;
        o.right = o.top = 16;
        o.far = 90;
        o.updateProjectionMatrix();
      }
    }
  }

  private mesurerEau(up: THREE.Vector3) {
    const m = this.monde;
    let total = 0;
    let n = 0;
    m.sphere.autour(this.joueur.noeud >= 0 ? this.joueur.noeud : m.noeud(up), 4 / R, (i) => {
      n++;
      if (m.eau[i] > 0.02) total++;
    });
    return Math.min(1, (total / Math.max(1, n)) * 3);
  }

  // ——— Aide et repères ———

  private texteAide(up: THREE.Vector3, devant: THREE.Vector3) {
    const p0 = this.monde.pierres[0];
    return this.aide.texte({
      monde: this.monde,
      dirJoueur: up,
      devant,
      graines: this.graines,
      ramassees: this.ramassees + (this.graines > REGLAGES.joueur.grainesDepart ? 1 : 0),
      plantees: this.monde.arbresPlantes,
      bouchonEnPlace: p0.dir.angleTo(this.bouchonInitial) * R < 0.9 && this.monde.sources[0].active,
      sourceProche: this.sourceProche(up),
      dansLeVent: this.sousLeVent > 0.35,
      souffleDispo: this.recharge <= 0,
      temps: this.tempsJeu,
    });
  }

  private majReperes(up: THREE.Vector3) {
    const m = this.monde;
    const cam = this.rendu.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cibles: { dir: THREE.Vector3; type: "graine" | "source"; d: number }[] = [];
    for (const g of m.graines) cibles.push({ dir: g.dir, type: "graine", d: g.dir.angleTo(up) * R });
    cibles.sort((a, b) => a.d - b.d);
    const choix = cibles.slice(0, 3);
    for (const s of m.sources) if (!s.active) choix.push({ dir: s.dir, type: "source", d: s.dir.angleTo(up) * R });
    const { avant, droite } = this.camera.reperes(this.joueur);
    this.reperes.length = 0;
    const visible = this.etat === "jeu";
    for (const c of choix) {
      const pos = m.surface(c.dir, new THREE.Vector3(), c.type === "source" ? 1.5 : 0.5);
      const ecran = this.rendu.versEcran(pos);
      // Caché derrière la planète ?
      const versP = pos.clone().sub(cam.position);
      const l = versP.length();
      versP.normalize();
      const b = cam.position.dot(versP);
      const disc = b * b - (cam.position.lengthSq() - (R - 0.3) ** 2);
      const cache = disc > 0 && -b - Math.sqrt(disc) > 0 && -b - Math.sqrt(disc) < l - 0.5;
      const marge = 46;
      const dedans = ecran.devant && ecran.x > marge && ecran.x < W - marge && ecran.y > marge && ecran.y < H - marge;
      if (dedans && !cache) {
        // Visible : la colonne de lumière suffit quand c'est proche
        if (c.d < 9) continue;
        this.reperes.push({ x: ecran.x, y: ecran.y, angle: Math.PI / 2, visible, type: c.type });
        continue;
      }
      // Hors champ : au bord de l'écran, dans la direction à prendre
      const t = c.dir.clone().addScaledVector(up, -c.dir.dot(up)).normalize();
      const a = Math.atan2(t.dot(droite), t.dot(avant));
      const sx = Math.sin(a), sy = -Math.cos(a);
      const k = Math.min((W / 2 - marge) / Math.max(1e-3, Math.abs(sx)), (H / 2 - marge) / Math.max(1e-3, Math.abs(sy)));
      this.reperes.push({ x: W / 2 + sx * k, y: H / 2 + sy * k, angle: Math.atan2(sy, sx), visible, type: c.type });
    }
    this.hud.majReperes(this.reperes);
  }
}
