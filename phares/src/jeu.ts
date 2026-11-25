// Le chef d'orchestre : relie la simulation (bateau, météo, partie),
// le rendu (océan, ciel, phares...), le son et l'interface.

import * as THREE from "three";
import { REGLAGES } from "./reglages";
import { DEPART, PHARES, genererArchipel, getBalises, getRochers, getTonneaux } from "./monde/archipel";
import { Meteo } from "./monde/meteo";
import { Calme, hauteurMer } from "./monde/vagues";
import { Voilier } from "./jeu/navigation";
import { Partie, Evenement, pointDeMouillage } from "./jeu/partie";
import { Pilote } from "./jeu/pilote";
import { Rendu } from "./rendu/scene";
import { Ocean, NB_PHARES_MAX, NB_SILLAGE } from "./rendu/ocean";
import { Ciel } from "./rendu/ciel";
import { Pluie } from "./rendu/pluie";
import { Foudre } from "./rendu/eclair";
import { Particules } from "./rendu/particules";
import { Phare } from "./rendu/phare";
import { ModeleBateau } from "./rendu/bateau";
import { creerIles, texturerTerrain } from "./rendu/iles";
import { Balises } from "./rendu/balises";
import { Son } from "./audio/son";
import { Hud } from "./ui/hud";
import { Entrees } from "./entrees";
import { amortir, clamp, lerp } from "./outils/maths";

export type Etat = "titre" | "jeu" | "fin";

export interface Options {
  direct: boolean;
  auto: boolean;
  fantome: boolean;
  invincible: boolean;
  phares: number;
  qualite: number;
  debug: boolean;
  depart: { x: number; z: number; cap: number } | null;
  vue: string | null;
}

/** « Le Guetteur » → « du Guetteur », « La Veilleuse » → « de la Veilleuse »... */
export function deNom(nom: string) {
  if (nom.startsWith("Le ")) return `du ${nom.slice(3)}`;
  if (nom.startsWith("La ")) return `de la ${nom.slice(3)}`;
  if (nom.startsWith("L'")) return `de l'${nom.slice(2)}`;
  return `de ${nom}`;
}

const BRUME_NUIT = new THREE.Color(0.014, 0.019, 0.027);
const BRUME_AUBE = new THREE.Color(0.36, 0.2, 0.12);

export class Jeu {
  etat: Etat = "titre";
  pause = false;
  rendu: Rendu;
  meteo = new Meteo();
  calme = new Calme();
  bateau = new Voilier();
  partie!: Partie;
  pilote = new Pilote();
  entrees = new Entrees();
  son = new Son();
  hud: Hud;
  ocean!: Ocean;
  ciel!: Ciel;
  pluie!: Pluie;
  foudre = new Foudre();
  particules!: Particules;
  phares: Phare[] = [];
  modele = new ModeleBateau();
  balises!: Balises;
  temps = 0;
  modeCamera = 0;
  private secousse = 0;
  private sillage: { x: number; z: number; age: number; force: number }[] = [];
  private prochainSillage = 0;
  private tangagePrecedent = 0;
  private camCible = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private finAffichee = false;
  private tempsFin = 0;
  private aideMasquee = false;
  private debutJeu = 0;
  private degats = 0;
  private flashDir = new THREE.Vector3(0, 0.4, -1).normalize();
  private v2 = new THREE.Vector2();
  private hisserAuto = false;
  private onde: { x: number; z: number; t0: number } | null = null;
  private cinematique: { phare: number; t0: number } | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement, public options: Options) {
    this.rendu = new Rendu(canvas, options.qualite);
    this.hud = new Hud(ui);
    genererArchipel();
    this.construireScene();
    this.partie = new Partie(this.bateau);
    this.partie.invincible = options.invincible;
    this.bateau.fantome = options.fantome;

    const d = options.depart ?? DEPART;
    this.bateau.placer(d.x, d.z, d.cap);
    for (let i = 1; i <= options.phares && i < PHARES.length; i++) {
      this.partie.allumes[i] = true;
      this.partie.dernierPhare = i;
    }
    this.phares.forEach((p, i) => {
      if (this.partie.allumes[i]) p.allumer(true);
    });
    if (options.phares > 0 && !options.depart) {
      const p = PHARES[this.partie.dernierPhare];
      const m = pointDeMouillage(p.x, p.z);
      this.bateau.placer(m.x, m.y, m.cap);
    }
    this.majCalme();

    this.meteo.surEclair = (e) => {
      const x = this.bateau.x + Math.cos(e.direction) * e.distance;
      const z = this.bateau.z + Math.sin(e.direction) * e.distance;
      const cam = this.rendu.camera.position;
      this.foudre.frapper(x, z, cam, this.meteo.temps, e.force);
      this.flashDir.set(x - cam.x, 260, z - cam.z).normalize();
      this.son.tonnerre(e.distance, e.force);
      if (e.distance < 400) this.secousse = Math.max(this.secousse, 0.25 * e.force);
    };

    this.camPos.set(this.bateau.x, 8, this.bateau.z + 20);
    if (options.direct) this.commencer(false);
    else this.hud.montrerTitre(true);
  }

  private construireScene() {
    const s = this.rendu.scene;
    const { texture, zone } = texturerTerrain();
    this.ocean = new Ocean(texture, zone, this.options.qualite < 0.75 ? 220 : 320);
    const u = this.ocean.uniforms;
    s.add(this.ocean.mesh);
    this.ciel = new Ciel(u);
    s.add(this.ciel.mesh);
    s.add(creerIles(getRochers()));
    const uTemps = { value: 0 };
    this.uTempsPhares = uTemps;
    for (const def of PHARES) {
      const p = new Phare(def, uTemps, u.uDensiteBrume);
      this.phares.push(p);
      s.add(p.groupe, p.spot, p.spot.target, p.lampe);
    }
    this.balises = new Balises(getBalises(), getRochers(), getTonneaux());
    s.add(this.balises.groupe);
    s.add(this.modele.racine);
    this.pluie = new Pluie(this.options.qualite < 0.75 ? 4000 : 7000, u);
    s.add(this.pluie.mesh);
    s.add(this.foudre.mesh);
    this.particules = new Particules(900, u);
    s.add(this.particules.points);
  }
  private uTempsPhares!: { value: number };

  /** geste : appelé depuis une action du joueur (le navigateur n'autorise le son qu'après un geste). */
  commencer(geste = true) {
    if (this.etat === "jeu") return;
    if (geste) this.son.demarrer();
    this.etat = "jeu";
    this.debutJeu = this.temps;
    this.hisserAuto = true; // on largue les amarres : la voile monte toute seule
    this.hud.montrerTitre(false);
    this.hud.montrerHud(true);
    this.hud.montrerAide(true);
    this.hud.annoncer("Rallume les feux", `${PHARES.length - 1} phares éteints dans l'archipel`, 5);
  }

  private majCalme() {
    this.calme.centres = PHARES.filter((_, i) => this.partie.allumes[i]).map((p) => new THREE.Vector2(p.x, p.z));
    const c = this.ocean.uniforms.uCalmes.value as THREE.Vector3[];
    PHARES.forEach((p, i) => c[i].set(p.x, p.z, this.partie.allumes[i] ? 1 : 0));
  }

  /** Touches ponctuelles. */
  private touches() {
    for (const code of this.entrees.sortirAppuis()) {
      if (this.etat === "titre" && (code === "Enter" || code === "Space")) this.commencer();
      else if (this.etat === "fin" && this.finAffichee && code === "Enter") location.reload();
      else if (code === "KeyP" || code === "Escape") {
        if (this.etat === "jeu") {
          this.pause = !this.pause;
          this.hud.montrerPause(this.pause);
        }
      } else if (code === "KeyM") {
        const muet = this.son.basculerMuet();
        this.hud.annoncer(muet ? "Son coupé" : "Son rétabli", "", 1.5);
      } else if (code === "KeyC") this.modeCamera = (this.modeCamera + 1) % 3;
    }
  }

  /** Un pas de simulation (et de mise à jour visuelle). */
  maj(dtBrut: number) {
    this.touches();
    if (this.pause) return;
    const dt = Math.min(dtBrut, 1 / 20);
    this.temps += dt;
    const t = this.temps;
    this.meteo.maj(dt);

    // commandes
    let cmd = { barre: 0, voile: 0 };
    if (this.etat !== "titre") {
      if (this.options.auto) {
        const cible = this.partie.prochainPhare;
        cmd = cible >= 0 ? this.pilote.commander(this.bateau, this.meteo, cible, dt) : { barre: 0.15, voile: 0 };
      } else cmd = { barre: this.entrees.barre, voile: this.entrees.voile };
      if (this.hisserAuto) {
        if (cmd.voile < 0 || this.bateau.hisse >= 1) this.hisserAuto = false;
        else cmd.voile = 1;
      }
      if (!this.aideMasquee && t - this.debutJeu > 14) {
        this.aideMasquee = true;
        this.hud.montrerAide(false);
      }
    }
    if (this.partie.naufrage > 0) cmd = { barre: 0, voile: -1 };

    const choc = this.etat === "titre" ? null : this.bateau.maj(dt, cmd, this.meteo, this.calme, t);
    if (this.etat === "titre") this.bateau.maj(dt, { barre: 0, voile: -1 }, this.meteo, this.calme, t);
    if (this.etat !== "titre") {
      this.partie.maj(dt, choc);
      for (const e of this.partie.sortirEvenements()) this.evenement(e);
    }

    if (this.etat === "fin") {
      this.tempsFin += dt;
      this.meteo.finale = true;
      this.calme.apaisement = Math.min(1, this.calme.apaisement + dt / 18);
      if (!this.finAffichee && this.tempsFin > 9) {
        this.finAffichee = true;
        this.hud.montrerHud(false);
        this.hud.cacherMessage();
        this.hud.montrerFin(this.partie.tempsVictoire, this.partie.chocs, this.partie.naufrages);
      }
    }

    this.majVisuels(dt, t);
  }

  private evenement(e: Evenement) {
    const h = this.hud;
    switch (e.type) {
      case "allumage-debut":
        break;
      case "phare-allume": {
        const p = this.phares[e.phare];
        p.allumer();
        this.onde = { x: p.def.x, z: p.def.z, t0: this.temps + 1.4 };
        this.cinematique = { phare: e.phare, t0: this.temps };
        this.son.allumage(e.phare);
        this.son.intensiteMusique = (this.partie.nbAllumes - 1) / (PHARES.length - 1);
        this.majCalme();
        const restants = PHARES.length - this.partie.nbAllumes;
        h.annoncer(`${PHARES[e.phare].nom} brille à nouveau`, restants > 0 ? `encore ${restants} ${restants > 1 ? "feux" : "feu"} à rallumer` : "tous les feux brûlent", 5, true);
        for (let i = 0; i < 90; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 6), 2 + Math.random() * 8, Math.sin(a) * (2 + Math.random() * 6));
          this.particules.emettre(p.lampePos, v, {
            duree: 1.2 + Math.random() * 1.6,
            taille: 0.5 + Math.random() * 0.6,
            couleur: new THREE.Color(4, 2.2, 0.8),
            emissive: true,
            gravite: 4,
          });
        }
        break;
      }
      case "choc": {
        this.son.choc(e.choc.force);
        this.secousse = Math.max(this.secousse, Math.min(1, e.choc.force / 8));
        this.degats = Math.min(1, this.degats + e.degats / 25);
        const av = this.bateau.avant;
        this.particules.gerbe(new THREE.Vector3(e.choc.x, this.bateau.y + 0.5, e.choc.z), new THREE.Vector3(-av.x, 0, -av.y), 40, 4 + e.choc.force * 0.5);
        if (this.partie.coque < 35 && this.partie.coque > 0) h.annoncer("La coque gémit", "un phare allumé la réparera", 3);
        break;
      }
      case "tonneau":
        this.son.tonneau();
        h.annoncer("Huile repêchée", `+${REGLAGES.huile.tonneau} pour la lanterne`, 2.5, true);
        break;
      case "huile-faible":
        this.son.alerte();
        h.annoncer("La lanterne faiblit", "repêche un tonneau ou rejoins un phare allumé", 4);
        break;
      case "lanterne-eteinte":
        this.son.alerte();
        h.annoncer("La lanterne s'est éteinte", "fie-toi aux éclairs et à l'écume", 4);
        break;
      case "naufrage":
        this.son.naufrage();
        h.noir(true);
        h.annoncer("L'Étincelle sombre…", "", 3);
        break;
      case "renfloue":
        h.noir(false);
        h.annoncer("Renflouée", `on repart ${deNom(PHARES[this.partie.dernierPhare].nom)}`, 3);
        this.camPos.set(this.bateau.x, 10, this.bateau.z);
        this.sillage = [];
        break;
      case "zone-sure":
        h.annoncer(`Sous la garde ${deNom(PHARES[e.phare].nom)}`, "la mer s'apaise · huile et coque reprennent", 3.5);
        break;
      case "victoire":
        this.etat = "fin";
        this.son.victoire();
        this.son.intensiteMusique = 1;
        break;
    }
  }

  private majVisuels(dt: number, t: number) {
    const b = this.bateau;
    const m = this.meteo;
    const u = this.ocean.uniforms;
    const cam = this.rendu.camera;

    // bateau
    this.modele.racine.position.set(b.x, b.y - (this.partie.naufrage > 0 ? this.partie.naufrage * 1.2 : 0), b.z);
    this.modele.racine.rotation.y = -b.cap;
    this.modele.assiette.rotation.set(-b.tangage, 0, b.roulis + b.gite, "YXZ");
    const lanterne = this.etat === "titre" ? 1 : this.partie.lanterne;
    this.modele.maj(t, b.angleBome, b.creux, b.faseye, b.hisse, b.ventRelatif, lanterne);

    // sillage
    this.sillage.forEach((p) => (p.age += dt / 6));
    this.sillage = this.sillage.filter((p) => p.age < 1);
    if (t > this.prochainSillage && b.vitesseSol > 1.2) {
      this.prochainSillage = t + 0.15;
      const av = b.avant;
      this.sillage.unshift({ x: b.x - av.x * 3, z: b.z - av.y * 3, age: 0, force: clamp(b.vitesseSol / 10, 0.2, 1) });
      if (this.sillage.length > NB_SILLAGE) this.sillage.length = NB_SILLAGE;
    }
    this.ocean.majSillage(this.sillage);

    // embruns d'étrave quand le bateau plonge dans une vague
    const plonge = (this.tangagePrecedent - b.tangage) / Math.max(dt, 1e-3);
    this.tangagePrecedent = b.tangage;
    if (b.vitesse > 3 && (plonge > 0.12 || Math.random() < b.vitesse * 0.012)) {
      const av = b.avant;
      const proue = new THREE.Vector3(b.x + av.x * 3.3, b.y + 0.4, b.z + av.y * 3.3);
      const cote = new THREE.Vector3(-av.y, 0, av.x);
      const n = plonge > 0.12 ? 10 : 2;
      for (let i = 0; i < n; i++) {
        const s = Math.random() < 0.5 ? -1 : 1;
        const v = new THREE.Vector3(av.x * b.vitesse * 0.6 + cote.x * s * 3, 2 + Math.random() * 3 * (0.5 + plonge), av.y * b.vitesse * 0.6 + cote.z * s * 3);
        this.particules.emettre(proue, v, { duree: 0.6 + Math.random() * 0.5, taille: 0.1 + Math.random() * 0.18 });
      }
      if (plonge > 0.2) this.son.clapot(Math.min(1, plonge));
    }

    // phares
    this.uTempsPhares.value = t;
    const phU = u.uPhares.value as THREE.Vector4[];
    const phA = u.uPharesAngle.value as number[];
    this.phares.forEach((p, i) => {
      p.maj(dt, t, cam.position, m.aube);
      if (i < NB_PHARES_MAX) {
        phU[i].set(p.lampePos.x, p.lampePos.y, p.lampePos.z, p.allume * p.allume);
        phA[i] = p.angle;
      }
    });
    this.balises.maj(dt, t, (troncon) => this.partie.allumes[troncon] ?? false, this.partie.tonneauxPris, m.houle);

    // météo, brume, éclairs
    const brume = BRUME_NUIT.clone().lerp(BRUME_AUBE, m.aube);
    (u.uBrume.value as THREE.Color).copy(brume);
    const fog = this.rendu.scene.fog as THREE.FogExp2;
    fog.color.copy(brume).add(new THREE.Color(0.2, 0.22, 0.3).multiplyScalar(m.flash));
    fog.density = lerp(0.0028, 0.0007, m.aube);
    u.uDensiteBrume.value = fog.density;
    u.uFlash.value = m.flash;
    (u.uFlashDir.value as THREE.Vector3).copy(this.flashDir);
    u.uAube.value = m.aube;
    u.uTemps.value = t;
    u.uAmpli.value = m.houle;
    u.uApaisement.value = this.calme.apaisement;
    const pluie = REGLAGES.meteo.pluie * m.tempete * (this.partie.dansZoneSure >= 0 ? 0.6 : 1);
    u.uPluie.value = pluie;
    u.uLanterneForce.value = lanterne;
    (u.uLanternePos.value as THREE.Vector3).copy(this.modele.lanternePos);
    (u.uBateau.value as THREE.Vector3).set(b.x, b.y, b.z);
    this.foudre.maj(m.temps);
    const onde = u.uOnde.value as THREE.Vector4;
    if (this.onde && t > this.onde.t0) {
      const a = t - this.onde.t0;
      onde.set(this.onde.x, this.onde.z, a * 110, Math.max(0, 1 - a / 4) * 1.6);
      if (a > 4) this.onde = null;
    } else onde.w = 0;
    this.rendu.eclairLumiere.intensity = m.flash * 1.4;
    this.rendu.eclairLumiere.position.copy(cam.position).addScaledVector(this.flashDir, 100);
    this.rendu.eclairLumiere.target.position.copy(cam.position);
    this.rendu.hemi.intensity = 0.35 + m.aube * 0.9 + m.flash * 0.35;
    this.rendu.soleil.intensity = m.aube * 2.5;
    this.ciel.uniforms.uTemps.value = t;
    m.souffle(this.v2);
    (this.ciel.uniforms.uVent.value as THREE.Vector2).copy(this.v2);

    // caméra
    this.majCamera(dt, t);
    this.ocean.suivre(cam.position);
    this.ciel.suivre(cam.position);
    this.pluie.maj(dt, cam.position, this.v2, m.forceTotale, pluie);
    this.particules.uniforms.uEchelle.value = window.innerHeight * 0.9;
    this.particules.maj(dt, this.v2);

    // finition
    const f = this.rendu.finition.uniforms;
    f.uTemps.value = t;
    f.uFlash.value = m.flash;
    this.degats = Math.max(0, this.degats - dt * 0.8);
    f.uDegats.value = Math.max(this.degats, this.partie.coque < 25 ? 0.25 + 0.15 * Math.sin(t * 4) : 0);
    f.uNoir.value = this.partie.naufrage > 0 ? Math.min(1, this.partie.naufrage / 1.5) : 0;
    this.rendu.bloom.strength = 0.6 - m.aube * 0.25;

    // son
    this.son.maj({
      rafale: m.rafale,
      force: m.forceTotale,
      pluie,
      vitesse: Math.abs(b.vitesse),
      tempete: m.tempete,
      gite: b.gite,
      tangage: b.tangage,
      enJeu: this.etat !== "titre",
    });

    // interface
    if (this.etat !== "titre") this.majHud();
    if (this.options.debug) {
      this.hud.texteDebug(
        `t ${t.toFixed(1)}  pos ${b.x.toFixed(0)},${b.z.toFixed(0)}  cap ${((b.cap * 180) / Math.PI).toFixed(0)}  v ${b.vitesse.toFixed(1)}\n` +
          `vent ${((m.ventDirection * 180) / Math.PI).toFixed(0)}° x${m.forceTotale.toFixed(2)}  allure ${((b.angleAuVent * 180) / Math.PI).toFixed(0)}° r ${b.rendement.toFixed(2)}\n` +
          `huile ${this.partie.huile.toFixed(0)} coque ${this.partie.coque.toFixed(0)} phares ${this.partie.nbAllumes}`,
      );
    }
  }

  private majCamera(dt: number, t: number) {
    const cam = this.rendu.camera;
    const b = this.bateau;
    const av = b.avant;
    const cible = new THREE.Vector3();
    const pos = new THREE.Vector3();

    if (this.etat === "titre") {
      // plan large et lent : le bateau au premier plan, le phare du port derrière
      const p = PHARES[0];
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) - 0.42 + Math.sin(t * 0.05) * 0.06;
      pos.set(b.x + Math.cos(a) * 24, b.y + 4.5, b.z + Math.sin(a) * 24);
      // on vise un peu à gauche du phare : il se cale dans le tiers droit, le bateau au premier plan
      const gx = lerp(b.x, p.x, 0.3);
      const gz = lerp(b.z, p.z, 0.3);
      cible.set(gx + (dz / d) * 14, b.y + 9 + d * 0.02, gz - (dx / d) * 14);
    } else if (this.etat === "fin" && this.tempsFin > 2) {
      // la caméra s'élève pour embrasser l'archipel au lever du jour
      const k = clamp((this.tempsFin - 2) / 14, 0, 1);
      const e = k * k * (3 - 2 * k);
      const a = Math.atan2(-av.y, -av.x) + t * 0.02;
      pos.set(b.x + Math.cos(a) * lerp(20, 70, e), b.y + lerp(7, 38, e), b.z + Math.sin(a) * lerp(20, 70, e));
      cible.set(b.x - Math.cos(a) * 60 * e, b.y + 2 + 10 * e, b.z - Math.sin(a) * 60 * e);
    } else {
      const reglages = [
        [17, 6.2, 9],
        [30, 12, 14],
        [9, 3.2, 12],
      ][this.modeCamera];
      const [recul, hauteur, devant] = reglages;
      pos.set(b.x - av.x * recul, b.y + hauteur, b.z - av.y * recul);
      cible.set(b.x + av.x * devant, b.y + 2.2, b.z + av.y * devant);
    }
    // un phare se rallume : la caméra recule et lève les yeux vers lui quelques secondes
    if (this.cinematique && this.etat === "jeu") {
      const a = t - this.cinematique.t0;
      const k = a < 1 ? a * a * (3 - 2 * a) : a < 3.5 ? 1 : Math.max(0, 1 - (a - 3.5) / 1.5);
      const k2 = k * k * (3 - 2 * k);
      const ph = this.phares[this.cinematique.phare];
      const dx = b.x - ph.def.x;
      const dz = b.z - ph.def.z;
      const d = Math.hypot(dx, dz) || 1;
      const recul = new THREE.Vector3(b.x + (dx / d) * 40 - av.x * 6, b.y + 15, b.z + (dz / d) * 40 - av.y * 6);
      pos.lerp(recul, k2);
      cible.lerp(ph.lampePos.clone().setY(ph.lampePos.y * 0.55), k2 * 0.8);
      if (a > 5) this.cinematique = null;
    }
    if (this.options.vue) this.vueDebug(pos, cible, t);

    const k = this.etat === "titre" ? 1.2 : 2.6;
    if (this.camPos.lengthSq() === 0 || this.temps < 0.1) this.camPos.copy(pos);
    this.camPos.x = amortir(this.camPos.x, pos.x, k, dt);
    this.camPos.y = amortir(this.camPos.y, pos.y, k, dt);
    this.camPos.z = amortir(this.camPos.z, pos.z, k, dt);
    this.camCible.x = amortir(this.camCible.x, cible.x, 5, dt);
    this.camCible.y = amortir(this.camCible.y, cible.y, 5, dt);
    this.camCible.z = amortir(this.camCible.z, cible.z, 5, dt);
    if (this.options.vue) {
      this.camPos.copy(pos);
      this.camCible.copy(cible);
    }
    cam.position.copy(this.camPos);
    // jamais sous les vagues
    const mer = hauteurMer(cam.position.x, cam.position.z, t, this.meteo.houle * (1 - this.calme.facteur(cam.position.x, cam.position.z)));
    cam.position.y = Math.max(cam.position.y, mer + 1.6);
    this.secousse = Math.max(0, this.secousse - dt * 1.4);
    const s = this.secousse * this.secousse * 0.6;
    cam.position.x += (Math.random() - 0.5) * s;
    cam.position.y += (Math.random() - 0.5) * s;
    cam.lookAt(this.camCible);
    if (this.etat === "jeu") cam.rotateZ((-this.bateau.roulis - this.bateau.gite) * 0.15);
  }

  /** Vues fixes pour les captures (?vue=...). */
  private vueDebug(pos: THREE.Vector3, cible: THREE.Vector3, _t: number) {
    const b = this.bateau;
    const v = this.options.vue;
    if (v === "phare") {
      const p = this.phares[0];
      pos.set(p.def.x - 70, 14, p.def.z - 60);
      cible.set(p.def.x, p.lampePos.y - 8, p.def.z);
    } else if (v === "haut") {
      pos.set(b.x + 60, 160, b.z + 120);
      cible.set(b.x, 0, b.z - 60);
    } else if (v === "cote") {
      const av = b.avant;
      pos.set(b.x - av.y * 14 + av.x * 2, b.y + 3, b.z + av.x * 14 + av.y * 2);
      cible.set(b.x, b.y + 3, b.z);
    }
  }

  private majHud() {
    const b = this.bateau;
    const p = this.partie;
    const cam = this.rendu.camera;
    let allumage: { phare: number; progression: number } | null = null;
    p.progression.forEach((v, i) => {
      if (v > 0 && !p.allumes[i]) allumage = { phare: i, progression: v };
    });
    let repere = null;
    const cible = p.prochainPhare;
    if (cible >= 0 && this.etat === "jeu") {
      const ph = this.phares[cible];
      const proj = ph.lampePos.clone().add(new THREE.Vector3(0, 6, 0)).project(cam);
      const w = window.innerWidth;
      const h = window.innerHeight;
      let x = (proj.x * 0.5 + 0.5) * w;
      let y = (-proj.y * 0.5 + 0.5) * h;
      const devant = proj.z < 1;
      const dist = Math.hypot(ph.def.x - b.x, ph.def.z - b.z);
      const marge = 70;
      const margeX = 130; // le texte du repère doit rester lisible
      let angle = 180;
      if (!devant || x < margeX || x > w - margeX || y < marge || y > h - marge) {
        // hors champ : flèche au bord de l'écran
        let dx = x - w / 2;
        let dy = y - h / 2;
        if (!devant) {
          dx = -dx;
          dy = -dy;
        }
        angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const r = Math.min((w / 2 - margeX) / Math.abs(dx || 1e-3), (h / 2 - marge) / Math.abs(dy || 1e-3));
        x = w / 2 + dx * r;
        y = h / 2 + dy * r;
      }
      repere = { x, y, visible: true, angle, texte: `${ph.def.nom} · ${Math.round(dist)} m` };
      if (dist < 60) repere = null;
    }
    const rel = Math.atan2(Math.sin(this.meteo.ventDirection - b.cap), Math.cos(this.meteo.ventDirection - b.cap));
    this.hud.maj({
      huile: p.huile,
      coque: p.coque,
      allumes: p.allumes,
      cible,
      vitesse: b.vitesseSol,
      ventRelatif: rel,
      cap: b.cap,
      rafale: this.meteo.rafale,
      rendement: b.rendement,
      faseye: b.faseye,
      hisse: b.hisse,
      allumage,
      repere,
    });
  }

  rendre() {
    this.rendu.rendre();
  }

  /** Debug : un éclair dans le champ de la caméra. */
  foudroyerDevant(distance = 450) {
    const cam = this.rendu.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const a = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * 0.4;
    this.meteo.declencherEclair(1, a, distance);
  }

  /** Avance la simulation sans dessiner (tests). */
  avancer(secondes: number, pas = 1 / 30) {
    const n = Math.round(secondes / pas);
    for (let i = 0; i < n; i++) this.maj(pas);
  }
}
