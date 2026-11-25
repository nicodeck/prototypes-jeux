// La vue d'un combat : place les persos, les anime, lance les effets et cadre la caméra.
import * as THREE from "three";
import { ARENE } from "../combat/arene";
import type { Combat, Combattant, Evenement } from "../combat/combat";
import type { NomPerso } from "../combat/persos";
import { poseDe, type Jeu } from "./animations";
import { Decor, NIVEAU_MER } from "./decor";
import { Effets } from "./effets";
import type { Pantin } from "./pantin";
import { COULEURS_TUNG, construireTung } from "./persos/tung";
import { AIR_TUNG, POSES_TUNG } from "./persos/tung-poses";
import { COULEURS_BALLERINA, construireBallerina } from "./persos/ballerina";
import { POSES_BALLERINA } from "./persos/ballerina-poses";
import type { Rendu } from "./scene";

export const COULEURS_JOUEURS = ["#ff4b4b", "#3d9bff"];

/** Les couleurs de rechange, quand les deux joueurs prennent le même perso. */
const VARIANTES = {
  ballerina: { ...COULEURS_BALLERINA, justaucorps: "#5fb8f0", justaucorpsOmbre: "#2a5c9e", tutu: "#bfe4ff", tutuClair: "#f2faff", collant: "#e3f1ff", chaussons: "#7cc4f5", ruban: "#3a8de0", mousse: "#d9b98a", cafe: "#3b2414" },
  tung: { ...COULEURS_TUNG, bois: "#7a5136", boisOmbre: "#3a2018", boisClair: "#9c6b47", coeur: "#c99a6a", batte: "#c8ccd6", batteOmbre: "#5d6274" },
};

export function fabriquerPantin(nom: NomPerso, variante = false): Pantin {
  if (nom === "ballerina") return construireBallerina(variante ? VARIANTES.ballerina : COULEURS_BALLERINA);
  return construireTung(variante ? VARIANTES.tung : COULEURS_TUNG);
}

const JEUX: Record<NomPerso, Jeu> = { ballerina: POSES_BALLERINA, tung: POSES_TUNG };
const ANGLE_FACE = Math.PI / 2 - 0.55;

const TRACE = {
  vertex: /* glsl */ `
    varying vec2 vP;
    void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragment: /* glsl */ `
    uniform float uA0;
    uniform float uA1;
    uniform float uR;
    uniform float uEp;
    uniform vec3 uCouleur;
    uniform float uOpacite;
    varying vec2 vP;
    void main() {
      float r = length(vP);
      float a = atan(vP.y, vP.x);
      float lo = min(uA0, uA1);
      float hi = max(uA0, uA1);
      float aa = a;
      if (aa < lo) aa += 6.28318;
      if (aa > hi) aa -= 6.28318;
      if (aa < lo || aa > hi) discard;
      float t = (aa - uA0) / (uA1 - uA0);
      float ep = uEp * (0.15 + 0.85 * t);
      float d = abs(r - uR);
      if (d > ep) discard;
      float bord = smoothstep(ep, ep * 0.6, d);
      vec3 c = mix(vec3(1.0), uCouleur, smoothstep(ep * 0.35, ep, d));
      gl_FragColor = vec4(c, uOpacite * bord * (0.25 + 0.75 * t));
    }
  `,
};

const BULLE = {
  vertex: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uCouleur;
    uniform float uOpacite;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      float bord = smoothstep(0.55, 0.95, f);
      gl_FragColor = vec4(mix(uCouleur, vec3(1.0), bord * 0.6), (0.18 + bord * 0.7) * uOpacite);
    }
  `,
};

class VueCombattant {
  readonly pantin: Pantin;
  readonly jeu: Jeu;
  readonly ombre: THREE.Mesh;
  readonly bulle: THREE.Mesh;
  readonly trace: THREE.Mesh;
  readonly aura = new THREE.Group();
  readonly halo: THREE.Group;
  foulee = 0;
  salto = 0;
  eclat = 0;
  derniereTrainee = 0;
  dansLaMer = false;

  constructor(
    readonly c: Combattant,
    readonly couleur: string,
    variante: boolean,
    scene: THREE.Object3D,
  ) {
    this.pantin = fabriquerPantin(c.nom, variante);
    this.jeu = JEUX[c.nom];
    scene.add(this.pantin.racine);
    for (const ch of this.pantin.chaines) scene.add(ch.mesh);

    this.ombre = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({ color: "#2a1838", transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.ombre.rotation.x = -Math.PI / 2;
    scene.add(this.ombre);

    this.bulle = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 20),
      new THREE.ShaderMaterial({
        uniforms: { uCouleur: { value: new THREE.Color(couleur) }, uOpacite: { value: 1 } },
        vertexShader: BULLE.vertex,
        fragmentShader: BULLE.fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    scene.add(this.bulle);

    this.trace = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShaderMaterial({
        uniforms: {
          uA0: { value: 0 },
          uA1: { value: 1 },
          uR: { value: 1 },
          uEp: { value: 0.2 },
          uCouleur: { value: new THREE.Color(c.nom === "ballerina" ? "#ff8fd0" : "#ffcf7a") },
          uOpacite: { value: 0 },
        },
        vertexShader: TRACE.vertex,
        fragmentShader: TRACE.fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(this.trace);

    // L'aura de charge de Tung : des flammes en pointes autour de lui.
    const flamme = new THREE.MeshBasicMaterial({ color: "#ffb02e", transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 12; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1, 6, 1, true), flamme);
      const a = (i / 12) * Math.PI * 2;
      cone.position.set(Math.cos(a) * 0.55, 0.3 + Math.random() * 1.6, Math.sin(a) * 0.4);
      this.aura.add(cone);
    }
    this.aura.visible = false;
    scene.add(this.aura);

    // Le halo de réapparition : un disque lumineux sous les pieds.
    this.halo = new THREE.Group();
    const disque = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.7, 0.12, 32),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 }),
    );
    this.halo.add(disque);
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: couleur }));
    anneau.rotation.x = Math.PI / 2;
    this.halo.add(anneau);
    this.halo.visible = false;
    scene.add(this.halo);
  }
}

export class VueCombat {
  readonly racine = new THREE.Group();
  readonly decor = new Decor();
  readonly effets = new Effets();
  readonly vues: VueCombattant[];
  private camPos = new THREE.Vector3(0, 4, 26);
  private camCible = new THREE.Vector3(0, 1.2, 0);
  private secousse = 0;
  private impact = 0;
  private impactRouge = 0;
  private vitesse = 0;
  /** Ralenti (1 = normal) : utilisé pour l'éjection finale. */
  ralenti = 1;
  victoire: number | null = null;
  /** Gros plan sur un point (fin de combat). */
  grosPlan: THREE.Vector3 | null = null;

  constructor(
    readonly rendu: Rendu,
    readonly combat: Combat,
  ) {
    this.racine.add(this.decor.groupe, this.effets.groupe);
    rendu.scene.add(this.racine);
    const memePerso = combat.combattants[0].nom === combat.combattants[1].nom;
    this.vues = combat.combattants.map((c, i) => new VueCombattant(c, COULEURS_JOUEURS[i], memePerso && i === 1, this.racine));
    this.cadrer(1);
    rendu.camera.position.copy(this.camPos);
    rendu.camera.lookAt(this.camCible);
  }

  detruire() {
    this.rendu.scene.remove(this.racine);
    this.racine.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
  }

  /** Réagit aux événements de la simulation (une fois par image simulée). */
  evenements(liste: Evenement[], son: (nom: string, force?: number) => void) {
    for (const e of liste) {
      switch (e.type) {
        case "touche": {
          const v = this.vues[e.victime];
          const lourd = e.effet === "lourd" || e.force > 30;
          this.effets.impact(e.x, e.y, e.force, lourd, COULEURS_JOUEURS[e.attaquant], e.garde);
          if (!e.garde) {
            v.eclat = e.armure ? 0.6 : 1;
            v.pantin.eclatCouleur.value.set(e.armure ? "#ffb347" : "#ffffff");
          }
          this.secousse = Math.max(this.secousse, e.garde ? 0.08 : Math.min(0.7, 0.1 + e.force / 70));
          if (!e.garde && e.force > 32) {
            this.impact = 1;
            this.impactRouge = e.force > 45 ? 1 : 0;
            this.rendu.final.uniforms.uImpactCentre.value.copy(this.rendu.versUv(new THREE.Vector3(e.x, e.y, 0)));
          }
          if (!e.garde && e.force > 26) this.vitesse = Math.min(1, e.force / 50);
          const tung = this.combat.combattants[e.attaquant].nom === "tung";
          if (e.garde) son("garde");
          else if (e.armure) son("armure");
          else if (tung) son(lourd ? "tungLourd" : "tung", e.force);
          else son(e.effet === "tranchant" ? "tranche" : lourd ? "lourd" : "coup", e.force);
          break;
        }
        case "saut": {
          const c = this.combat.combattants[e.joueur];
          if (e.air) {
            this.vues[e.joueur].salto = 1;
            this.effets.anneauSaut(c.x, c.y);
          } else this.effets.poussiere(c.x, c.y, c.dir, 0.8, 4);
          son(e.air ? "doubleSaut" : "saut");
          break;
        }
        case "atterrit": {
          const c = this.combat.combattants[e.joueur];
          if (e.fort) this.effets.poussiere(c.x, c.y, 0, 1.3, 6);
          else this.effets.poussiere(c.x, c.y, 0, 0.7, 2);
          son(e.fort ? "atterritFort" : "atterrit");
          break;
        }
        case "coup":
          son("whoosh" + (this.combat.combattants[e.joueur].nom === "tung" ? "Lourd" : ""));
          if (e.nom === "fouette" || e.nom === "pirouette") son("boiteAMusique");
          break;
        case "ko": {
          const vers = new THREE.Vector2(-e.x, 2 - e.y).normalize();
          this.effets.ko(e.x, e.y, vers, COULEURS_JOUEURS[e.joueur]);
          this.secousse = 1;
          this.impact = 1;
          this.impactRouge = 1;
          this.rendu.final.uniforms.uImpactCentre.value.copy(this.rendu.versUv(new THREE.Vector3(e.x, e.y, 0)));
          son("ko");
          break;
        }
        case "brise":
          son("brise");
          this.secousse = 0.5;
          break;
        case "reapparait":
          this.vues[e.joueur].pantin.reinitialiserChaines();
          son("reapparait");
          break;
        case "fin":
          break;
      }
    }
  }

  /** Met à jour l'image (appelée à chaque affichage). */
  mettreAJour(dt: number, temps: number, dtReel = dt) {
    this.decor.animer(temps, dt);
    for (const v of this.vues) this.majCombattant(v, dt, temps);
    this.effets.mettreAJour(dt);
    this.cadrer(dtReel);

    // Les effets d'écran vivent en temps réel, même au ralenti.
    const u = this.rendu.final.uniforms;
    this.impact = Math.max(0, this.impact - dtReel * 9);
    u.uImpact.value = this.impact > 0.5 ? 1 : 0;
    u.uSature.value = this.impactRouge;
    this.vitesse = Math.max(0, this.vitesse - dtReel * 1.6);
    u.uVitesse.value = this.vitesse;
    const cible = this.vues.find((v) => v.c.etat === "tournoie");
    if (cible) u.uVitesseCentre.value.copy(this.rendu.versUv(new THREE.Vector3(cible.c.x, cible.c.y + 1, 0)));
  }

  private majCombattant(v: VueCombattant, dt: number, temps: number) {
    const c = v.c;
    const p = v.pantin;
    const visible = c.etat !== "ko";
    p.racine.visible = visible;
    for (const ch of p.chaines) ch.mesh.visible = visible;
    v.ombre.visible = visible;
    if (!visible) {
      v.bulle.visible = v.trace.visible = v.aura.visible = v.halo.visible = false;
      return;
    }

    // Position, avec un tremblement pendant le gel d'impact.
    const tremble = c.gel > 0 && c.etat !== "coup" ? (Math.random() - 0.5) * 0.12 : 0;
    p.racine.position.set(c.x + tremble, c.y, 0);

    // Foulée et allure
    const vitesseSol = c.auSol ? Math.abs(c.vx) : 0;
    v.foulee += (vitesseSol * dt * Math.PI) / (c.nom === "ballerina" ? 1.25 : 1.5);
    v.salto = Math.max(0, v.salto - dt * 2.6);
    const victoire = this.victoire === c.index;
    const { pose, lissage, ancrer } = poseDe(c, v.jeu, {
      temps,
      foulee: v.foulee,
      allure: vitesseSol / c.perso.marche,
      salto: v.salto,
      victoire,
    });
    const enAir = c.etat === "coup" && c.coup?.nom === "tungtung" && c.coup === c.perso.coups.specialAir;
    const poseFinale = enAir ? { ...AIR_TUNG(c.image), expression: "cri" as const } : pose;
    p.poser(poseFinale, c.dir, Math.min(1, lissage * dt * 60), victoire ? 0.35 : ANGLE_FACE);
    p.ancrerPieds(ancrer);
    p.animerChaines(dt, c.dir, temps);

    // Éclat blanc après un coup, clignotement pendant l'invincibilité
    v.eclat = Math.max(0, v.eclat - dt * 6);
    const clignote = c.invincible > 0 || c.etat === "reapparition" ? (Math.sin(temps * 30) > 0 ? 0.45 : 0) : 0;
    p.eclat.value = Math.max(v.eclat, clignote);
    if (clignote > 0 && v.eclat <= 0) p.eclatCouleur.value.set("#ffffff");

    // L'ombre portée sur la surface en dessous
    const sol = surfaceSous(c.x, c.y);
    if (sol !== null) {
      const h = c.y - sol;
      const s = Math.max(0.2, 1 - h / 8) * c.perso.largeur * 0.9;
      v.ombre.visible = true;
      v.ombre.position.set(c.x, sol + 0.02, 0);
      v.ombre.scale.set(s, s * 0.7, 1);
      (v.ombre.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.max(0.2, 1 - h / 8);
    } else v.ombre.visible = false;

    // Le bouclier
    v.bulle.visible = c.etat === "garde";
    if (v.bulle.visible) {
      const r = c.perso.hauteur * (0.32 + 0.3 * c.bouclier);
      v.bulle.position.set(c.x, c.y + c.perso.hauteur * 0.5, 0);
      v.bulle.scale.setScalar(r);
      (v.bulle.material as THREE.ShaderMaterial).uniforms.uOpacite.value = 0.6 + c.bouclier * 0.4;
    }

    // La trace des coups : un arc lumineux qui suit la frappe.
    this.majTrace(v);

    // L'aura de charge
    const charge = c.etat === "coup" && c.coup?.charge && c.image <= c.coup.charge.debut + 1 && c.charge > 0;
    v.aura.visible = !!charge;
    if (charge) {
      v.aura.position.set(c.x, c.y, 0);
      const k = c.charge / (c.coup!.charge!.max || 1);
      v.aura.children.forEach((cone, i) => {
        cone.scale.set(1, 0.5 + k * 1.2 + Math.sin(temps * 40 + i * 2) * 0.25, 1);
        cone.position.y = 0.3 + ((temps * 3 + i * 0.37) % 1) * 1.8;
      });
      ((v.aura.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(k > 0.95 ? "#ff4b2e" : "#ffb02e");
      if (Math.random() < 0.3) this.effets.vent(c.x + (Math.random() - 0.5) * 3, c.y + Math.random() * 2.2, Math.random() < 0.5 ? 1 : -1, 0.6);
    }

    // Le halo de réapparition
    v.halo.visible = c.etat === "reapparition";
    if (v.halo.visible) v.halo.position.set(c.x, c.y - 0.06, 0);

    // Traînée de fumée quand on vole loin, sonné quand le bouclier casse
    if (c.etat === "tournoie" && Math.hypot(c.ex, c.ey) > 14 && temps - v.derniereTrainee > 0.03) {
      v.derniereTrainee = temps;
      this.effets.trainee(c.x, c.y + c.perso.hauteur * 0.5, Math.hypot(c.ex, c.ey) / 40);
    }
    if (c.etat === "brise") this.effets.etoilesTete(c.x, c.y + c.perso.hauteur + 0.3, temps);
    if (c.etat === "coup" && c.coup?.nom === "fouette" && c.coup.elan && c.image >= c.coup.elan.debut && c.image <= c.coup.elan.fin)
      for (let i = 0; i < 2; i++) this.effets.vent(c.x - c.dir * 0.5, c.y + 0.3 + Math.random() * 1.3, c.dir, 1.5 + Math.random());
    if (c.auSol && c.libre && Math.abs(c.vx) > c.perso.marche * 0.9 && Math.random() < 0.08)
      this.effets.poussiere(c.x - c.dir * 0.3, c.y, c.dir, 0.5, 1);

    // La mer
    const dansLaMer = c.y < NIVEAU_MER;
    if (dansLaMer && !v.dansLaMer) this.effets.eclaboussure(c.x, NIVEAU_MER);
    v.dansLaMer = dansLaMer;
  }

  private majTrace(v: VueCombattant) {
    const c = v.c;
    const m = (v.trace.material as THREE.ShaderMaterial).uniforms;
    const coup = c.etat === "coup" ? c.coup : null;
    const f = coup?.frappes.find((f) => c.image >= f.debut - 1 && c.image <= f.fin + 5);
    if (!coup || !f) {
      m.uOpacite.value = Math.max(0, m.uOpacite.value - 0.15);
      v.trace.visible = m.uOpacite.value > 0;
      return;
    }
    v.trace.visible = true;
    const cy = c.y + c.perso.hauteur * 0.5;
    const hx = c.dir * f.x;
    const hy = c.y + f.y - cy;
    const r = Math.max(0.6, Math.hypot(hx, hy) + f.rayon * 0.35);
    const angle = Math.atan2(hy, hx);
    const actif = c.image >= f.debut && c.image <= f.fin;
    const progres = Math.min(1, (c.image - f.debut + 1) / (f.fin - f.debut + 2));
    v.trace.position.set(c.x, cy, 0.6);
    const tourComplet = coup.nom === "tourbillon";
    const balayage = tourComplet ? Math.PI * 1.9 : 1.6;
    // Le balayage va du dessus vers la cible, dans le sens du coup.
    const sens = f.angle < 0 ? 1 : -1;
    m.uA1.value = angle;
    m.uA0.value = angle - sens * c.dir * balayage * (0.3 + 0.7 * progres) * (tourComplet ? 1 : 1);
    m.uR.value = r;
    m.uEp.value = f.rayon * 0.55;
    m.uOpacite.value = actif ? 0.95 : Math.max(0, m.uOpacite.value - 0.18);
  }

  /** Cadre les deux combattants, comme une caméra de Smash. */
  private cadrer(dt: number) {
    const cam = this.rendu.camera;
    const presents = this.combat.combattants.filter((c) => c.etat !== "ko");
    let gauche = -6;
    let droite = 6;
    let bas = 0;
    let haut = 3;
    if (presents.length) {
      gauche = Math.min(...presents.map((c) => c.x)) - 3.2;
      droite = Math.max(...presents.map((c) => c.x)) + 3.2;
      bas = Math.min(0, ...presents.map((c) => c.y)) - 1.2;
      haut = Math.max(...presents.map((c) => c.y + c.perso.hauteur)) + 1.5;
    }
    // On garde toujours un bout du récif dans le cadre.
    gauche = Math.min(gauche, -3);
    droite = Math.max(droite, 3);
    const cx = (gauche + droite) / 2;
    const cy = (bas + haut) / 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let distance = Math.max((haut - bas) / 2 / tan, (droite - gauche) / 2 / (tan * cam.aspect));
    distance = THREE.MathUtils.clamp(distance, 13, 34);
    let cible = new THREE.Vector3(cx * 0.85, cy + 0.3, 0);
    if (this.grosPlan) {
      cible = this.grosPlan.clone();
      distance = 6.5;
    }
    const pos = new THREE.Vector3(cible.x * 0.92, cible.y + 0.8 + distance * 0.06, distance);
    const k = 1 - Math.exp(-dt * (this.grosPlan ? 3 : 4));
    this.camPos.lerp(pos, k);
    this.camCible.lerp(cible, k);
    cam.position.copy(this.camPos);
    this.secousse = Math.max(0, this.secousse - dt * 2.2);
    const s = this.secousse * this.secousse * 0.6;
    cam.position.x += (Math.random() - 0.5) * s;
    cam.position.y += (Math.random() - 0.5) * s;
    cam.lookAt(this.camCible);
  }

  /** Coordonnées à l'écran d'un combattant (au-dessus de la tête). */
  ecranDe(i: number) {
    const c = this.combat.combattants[i];
    return this.rendu.versEcran(new THREE.Vector3(c.x, c.y + c.perso.hauteur + 0.55, 0));
  }
}

/** La hauteur de la surface juste sous un point (récif ou plateforme), ou null s'il n'y a que la mer. */
function surfaceSous(x: number, y: number) {
  let meilleur: number | null = null;
  for (const b of ARENE.blocs) if (x >= b.gauche && x <= b.droite && b.haut <= y + 0.01) meilleur = Math.max(meilleur ?? -Infinity, b.haut);
  for (const p of ARENE.plateformes) if (x >= p.gauche && x <= p.droite && p.y <= y + 0.01) meilleur = Math.max(meilleur ?? -Infinity, p.y);
  return meilleur;
}
