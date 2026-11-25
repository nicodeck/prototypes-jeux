// La vue d'une course : place les karts, anime les pilotes, lance les effets et cadre la caméra.
// Entre deux images simulées, les positions sont interpolées pour rester fluides à 120 Hz.
import * as THREE from "three";
import type { Course, Evenement, Kart } from "../course/course";
import { REGLAGES } from "../reglages";
import { Decor } from "./decor";
import { Effets } from "./effets";
import { Ile } from "./ile";
import { ModeleKart, poseAssise } from "./kart";
import { fabriquerMeduse, fabriquerOursin } from "./objets";
import { couleurKart, fabriquerPilote } from "./pilotes";
import type { Rendu } from "./scene";

const angle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

interface EtatVisuel {
  modele: ModeleKart;
  x: number;
  y: number;
  z: number;
  cap: number;
  /** L'état à l'image simulée précédente, pour interpoler. */
  avant: { x: number; y: number; z: number; cap: number };
  lacet: number;
  tangage: number;
  roulis: number;
  braquage: number;
  tourne: number;
  ecrase: number;
  vEcrase: number;
  couleurTurbo: string;
}

export type Camera = "suivre" | "presentation" | "survol" | "arrivee" | "vitrine";

let ileEnCache: { circuit: unknown; ile: Ile; decor: Decor } | null = null;

export class VueCourse {
  readonly ile: Ile;
  readonly decor: Decor;
  readonly effets = new Effets();
  readonly groupe = new THREE.Group();
  private readonly karts: EtatVisuel[];
  private readonly objets = new Map<number, THREE.Group>();
  modeCamera: Camera = "presentation";
  private camCap = 0;
  private camPos = new THREE.Vector3();
  private camVise = new THREE.Vector3();
  private camInit = false;
  private tempsMode = 0;
  /** Le kart suivi par la caméra. */
  suivi = 0;
  private tremble = 0;

  constructor(
    readonly rendu: Rendu,
    readonly course: Course,
    variantes: boolean[],
  ) {
    // L'île est lourde à construire : on la garde d'une course à l'autre.
    if (!ileEnCache || ileEnCache.circuit !== course.circuit) {
      const ile = new Ile(course.circuit);
      ileEnCache = { circuit: course.circuit, ile, decor: new Decor(course.circuit, ile) };
    }
    this.ile = ileEnCache.ile;
    this.decor = ileEnCache.decor;
    rendu.scene.add(this.ile.groupe, this.decor.groupe, this.groupe, this.effets.groupe);
    this.karts = course.karts.map((k) => {
      const pilote = fabriquerPilote(k.pilote, variantes[k.numero]);
      const modele = new ModeleKart(pilote, k.pilote, couleurKart(k.pilote, variantes[k.numero]), k.numero + 1);
      this.groupe.add(modele.racine, modele.ombre);
      for (const c of pilote.chaines) this.groupe.add(c.mesh);
      return {
        modele,
        x: k.x,
        y: k.y,
        z: k.z,
        cap: k.cap,
        avant: { x: k.x, y: k.y, z: k.z, cap: k.cap },
        lacet: 0,
        tangage: 0,
        roulis: 0,
        braquage: 0,
        tourne: 0,
        ecrase: 1,
        vEcrase: 0,
        couleurTurbo: "#ffb02e",
      };
    });
  }

  detruire() {
    this.rendu.scene.remove(this.ile.groupe, this.decor.groupe, this.groupe, this.effets.groupe);
  }

  /** À appeler juste avant chaque image simulée. */
  avantPas() {
    for (const [i, v] of this.karts.entries()) {
      const k = this.course.karts[i];
      v.avant = { x: k.x, y: k.y, z: k.z, cap: k.cap };
    }
  }

  /** Les effets et les sons des événements d'une image simulée. */
  evenements(liste: Evenement[], jouer: (nom: string, volume: number) => void) {
    const E = this.effets;
    const suivi = this.course.karts[this.suivi];
    const volume = (e: Evenement) => {
      if (e.kart === this.suivi) return 1;
      const d = Math.hypot(e.x - suivi.x, e.z - suivi.z);
      return Math.max(0, 1 - d / 60) * 0.7;
    };
    for (const e of liste) {
      const v = e.kart >= 0 ? this.karts[e.kart] : null;
      const k = e.kart >= 0 ? this.course.karts[e.kart] : null;
      const vol = volume(e);
      switch (e.type) {
        case "decompte":
          jouer("decompte", 1);
          break;
        case "depart":
          jouer("partez", 1);
          break;
        case "turboDepart":
          if (v) v.couleurTurbo = "#ff6a2e";
          if (vol > 0) jouer("turbo", vol);
          break;
        case "saut":
          if (vol > 0) jouer("saut", vol * 0.6);
          break;
        case "atterrit":
          if (v) v.vEcrase = -Math.min(4, (e.valeur ?? 4) * 0.35);
          if (k) for (let i = 0; i < 6; i++) E.bouffee(k.x, k.y + 0.2, k.z, "fumee", 0.7);
          if (vol > 0 && (e.valeur ?? 0) > 6) jouer("atterrit", vol);
          break;
        case "derive":
          if (vol > 0) jouer("derive", vol);
          break;
        case "palier":
          if (k) E.anneau(k.x, k.y + 0.5, k.z, e.valeur === 2 ? "orange" : "bleu", 1.8, 0.25);
          if (vol > 0) jouer(e.valeur === 2 ? "palier2" : "palier1", vol);
          break;
        case "miniTurbo":
          if (v) v.couleurTurbo = e.valeur === 2 ? "#ff7a1a" : "#58c8ff";
          if (k) E.anneau(k.x, k.y + 0.6, k.z, e.valeur === 2 ? "orange" : "bleu", 2.6, 0.3);
          if (vol > 0) jouer("turbo", vol);
          break;
        case "bande":
          if (v) v.couleurTurbo = "#ffd23a";
          if (vol > 0) jouer("turbo", vol);
          break;
        case "perle":
          if (k) for (let i = 0; i < 20; i++) E.etincelle(k.x, k.y + 1.2, k.z, i % 2 ? "or" : "blanc", 8);
          if (vol > 0) jouer("perle", vol);
          break;
        case "objet":
          if (e.kart === this.suivi) jouer("objet", 1);
          break;
        case "lance":
          if (e.objet === "piment" && v) v.couleurTurbo = "#ff3b2f";
          if (vol > 0) jouer(e.objet === "piment" ? "turbo" : e.objet === "bulle" ? "bulle" : "lance", vol);
          break;
        case "touche":
          if (k) E.eclat(k.x, k.y + 1, k.z, "or");
          if (e.kart === this.suivi) {
            this.tremble = 0.5;
            this.rendu.final.uniforms.uImpact.value = 1;
          }
          if (vol > 0) jouer("touche", vol);
          break;
        case "bulleEclate":
          if (k) E.eclat(k.x, k.y + 1, k.z, "bleu", 30);
          if (vol > 0) jouer("bulleEclate", vol);
          break;
        case "eclat":
          E.eclat(e.x, e.y + 0.8, e.z, "violet", 14);
          break;
        case "rebond":
          for (let i = 0; i < 6; i++) E.etincelle(e.x, e.y + 0.6, e.z, "blanc", 5);
          break;
        case "choc":
          if ((e.valeur ?? 0) > 5) E.etoile(e.x, e.y + 0.9, e.z, "or");
          if (vol > 0) jouer("choc", vol * Math.min(1, (e.valeur ?? 4) / 8));
          break;
        case "mur":
          if (k) for (let i = 0; i < 12; i++) E.etincelle(k.x, k.y + 0.5, k.z, "or", 6);
          if (vol > 0) jouer("mur", vol);
          if (e.kart === this.suivi) this.tremble = 0.25;
          break;
        case "plouf":
          if (k) E.gerbe(k.x, Math.max(0, k.y - 0.6), k.z, 1);
          if (vol > 0) jouer("plouf", vol);
          break;
        case "retour":
          if (v) {
            v.x = k!.x;
            v.z = k!.z;
            v.avant = { x: k!.x, y: k!.y, z: k!.z, cap: k!.cap };
            v.modele.pilote.reinitialiserChaines();
          }
          if (k) for (let i = 0; i < 16; i++) E.etincelle(k.x, k.y + 1, k.z, "blanc", 5);
          if (vol > 0) jouer("retour", vol);
          break;
        case "tour":
          if (e.kart === this.suivi) jouer(e.valeur === REGLAGES.tours ? "dernierTour" : "tour", 1);
          break;
        case "arrivee":
          if (e.kart === this.suivi) jouer(e.valeur === 1 ? "victoire" : "arrivee", 1);
          break;
      }
    }
  }

  /** Met à jour l'image. `alpha` : la part d'image simulée écoulée depuis le dernier pas. */
  maj(dt: number, temps: number, alpha: number) {
    const C = this.course.circuit;
    for (const [i, v] of this.karts.entries()) {
      const k = this.course.karts[i];
      v.x = v.avant.x + (k.x - v.avant.x) * alpha;
      v.y = v.avant.y + (k.y - v.avant.y) * alpha;
      v.z = v.avant.z + (k.z - v.avant.z) * alpha;
      v.cap = v.avant.cap + angle(k.cap - v.avant.cap) * alpha;
      this.animerKart(v, k, dt, temps);
    }
    // Les objets sur la piste
    const vus = new Set<number>();
    for (const o of this.course.objets) {
      vus.add(o.id);
      let m = this.objets.get(o.id);
      if (!m) {
        m = o.type === "oursin" ? fabriquerOursin() : fabriquerMeduse();
        this.groupe.add(m);
        this.objets.set(o.id, m);
      }
      m.position.set(o.x, o.y, o.z);
      if (o.type === "oursin") {
        m.rotation.y = -o.cap + Math.PI / 2;
        const boule = m.getObjectByName("boule")!;
        boule.rotation.x += (o.vitesse * dt) / 0.6;
      } else {
        const corps = m.getObjectByName("corps")!;
        corps.position.y = 0.95 + Math.sin(temps * 2.5 + o.id) * 0.15;
        corps.rotation.y = temps * 0.6 + o.id;
        const s = 1 + Math.sin(temps * 5 + o.id) * 0.06;
        corps.scale.set(s, 2 - s, s);
      }
    }
    for (const [id, m] of this.objets)
      if (!vus.has(id)) {
        this.groupe.remove(m);
        this.objets.delete(id);
      }
    this.ile.animer(
      temps,
      this.course.perles.map((p) => p.retour),
      this.rendu.camera,
    );
    this.decor.animer(temps, dt);
    this.cadrer(dt, temps);
    this.effets.avancer(dt, this.rendu.camera);
    this.effets.echelle(this.rendu.renderer.domElement.height);
    void C;
  }

  private animerKart(v: EtatVisuel, k: Kart, dt: number, temps: number) {
    const m = v.modele;
    const C = this.course.circuit;
    const lissage = 1 - Math.exp(-dt * 10);
    // Le lacet : en dérapage, le kart pointe vers l'intérieur du virage.
    const lacetVise = k.derive * 0.5 + (k.derive !== 0 ? Math.sin(temps * 18) * 0.03 : 0);
    v.lacet += (lacetVise - v.lacet) * (1 - Math.exp(-dt * 8));
    // Sonné : deux tours sur lui-même.
    if (k.sonne > 0) v.tourne += dt * 14;
    else v.tourne += (Math.round(v.tourne / (Math.PI * 2)) * Math.PI * 2 - v.tourne) * lissage;
    v.braquage += ((k.derive !== 0 ? k.derive * 0.6 + k.braquage * 0.4 : k.braquage) - v.braquage) * lissage;
    // La pente : le kart suit le sol.
    const fx = Math.cos(v.cap);
    const fz = Math.sin(v.cap);
    let tangage = 0;
    let roulis = 0;
    if (k.auSol && k.chute === 0) {
      const devant = C.lieu(v.x + fx * 1.0, v.z + fz * 1.0, {}).y;
      const derriere = C.lieu(v.x - fx * 1.0, v.z - fz * 1.0, {}).y;
      tangage = Math.atan2(devant - derriere, 2);
      const gauche = C.lieu(v.x + fz * 0.8, v.z - fx * 0.8, {}).y;
      const droite = C.lieu(v.x - fz * 0.8, v.z + fx * 0.8, {}).y;
      roulis = Math.atan2(gauche - droite, 1.6);
    } else if (k.chute > 0) tangage = -0.5;
    else tangage = Math.max(-0.4, Math.min(0.4, k.vy * 0.04));
    roulis += -v.braquage * Math.min(1, Math.abs(k.v) / 20) * 0.07 - k.derive * 0.08;
    v.tangage += (tangage - v.tangage) * lissage;
    v.roulis += (roulis - v.roulis) * lissage;
    // L'écrasement à l'atterrissage, comme un ressort.
    v.vEcrase += (1 - v.ecrase) * 180 * dt - v.vEcrase * 12 * dt;
    v.ecrase += v.vEcrase * dt;

    m.racine.position.set(v.x, v.y, v.z);
    m.racine.rotation.order = "YXZ";
    m.racine.rotation.set(-v.tangage, Math.PI / 2 - v.cap, v.roulis);
    m.caisse.rotation.y = -v.lacet + v.tourne;
    m.caisse.scale.set(1 + (1 - v.ecrase) * 0.4, v.ecrase, 1 + (1 - v.ecrase) * 0.4);
    // Clignote quand il vient d'être replacé.
    m.racine.visible = !(k.invincible > 0 && k.sonne === 0 && k.chute === 0 && Math.floor(temps * 16) % 2 === 0 && k.invincible < 80);
    // L'ombre, à plat sur le sol.
    const sol = C.lieu(v.x, v.z, {}).y;
    m.ombre.visible = k.chute === 0;
    m.ombre.position.set(v.x, sol + 0.04, v.z);
    m.ombre.rotation.z = -v.cap - Math.PI / 2;
    const hauteur = Math.max(0, v.y - sol);
    (m.ombre.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, 1 - hauteur * 0.25);
    m.turbo(k.turbo > 0, v.couleurTurbo);
    m.bulle.visible = k.bulle > 0;
    const matBulle = m.bulle.material as THREE.ShaderMaterial;
    matBulle.uniforms.uTemps.value = temps;
    matBulle.uniforms.uFin.value = k.bulle > 0 && k.bulle < 120 ? 1 : 0;
    m.animer(dt, k.v, v.braquage, temps);
    const expression = k.sonne > 0 || k.chute > 0 ? "douleur" : k.turbo > 0 ? "cri" : "neutre";
    m.pilote.poser(poseAssise(v.braquage, k.turbo > 0 ? 1 : 0, expression), 1, Math.min(1, dt * 14), 0);
    m.pilote.animerChaines(dt, 1, temps);

    // Les étincelles du dérapage, la poussière hors piste, le turbo.
    const E = this.effets;
    const arriere = (cote: number) => {
      const c = Math.cos(v.cap + v.lacet);
      const s = Math.sin(v.cap + v.lacet);
      return { x: v.x - c * 1.0 - s * 0.7 * cote, z: v.z - s * 1.0 + c * 0.7 * cote };
    };
    if (k.derive !== 0 && k.auSol && Math.random() < 0.9) {
      for (const cote of [-1, 1]) {
        const p = arriere(cote);
        if (k.palier === 0) {
          if (Math.random() < 0.35) E.bouffee(p.x, v.y + 0.2, p.z, "fumee", 0.45);
        } else E.etincelle(p.x, v.y + 0.25, p.z, k.palier === 2 ? "orange" : "bleu", 3);
      }
    }
    const surface = k.lieu.surface;
    if (k.auSol && (surface === "herbe" || surface === "sable") && Math.abs(k.v) > 6 && Math.random() < 0.6) {
      const p = arriere(Math.random() < 0.5 ? -1 : 1);
      E.bouffee(p.x, v.y + 0.2, p.z, surface, 0.6, -fx * 2, -fz * 2);
    }
    if (k.turbo > 0 && Math.random() < 0.25) {
      const p = arriere(0);
      E.bouffee(p.x, v.y + 0.6, p.z, "fumee", 0.3, -fx * 4, -fz * 4);
    }
  }

  /** Sur l'île : la hauteur du sol (route ou relief), pour garder la caméra au-dessus. */
  private solSous(x: number, z: number) {
    const l = this.course.circuit.lieu(x, z, {});
    const dansRoute = l.surface !== "eau" && (l.mur === null || Math.abs(l.proj.d) < l.mur);
    return Math.max(dansRoute ? l.y : -10, this.ile.hauteur(x, z), 0);
  }

  private cadrer(dt: number, temps: number) {
    const cam = this.rendu.camera;
    const k = this.course.karts[this.suivi];
    const v = this.karts[this.suivi];
    this.tempsMode += dt;
    const final = this.rendu.final.uniforms;
    final.uImpact.value = Math.max(0, final.uImpact.value - dt * 9);
    if (this.modeCamera === "survol") {
      // Un long survol de l'île pour l'écran titre.
      const P = this.course.circuit.principal;
      const s = (temps * 14) % P.longueur;
      const q = P.point(s);
      const r = P.point(s + 30);
      const pos = new THREE.Vector3(q.x - q.tz * 22, q.y + 14, q.z + q.tx * 22);
      this.camPos.lerp(pos, this.camInit ? 1 - Math.exp(-dt * 1.5) : 1);
      this.camVise.lerp(new THREE.Vector3(r.x, r.y + 2, r.z), this.camInit ? 1 - Math.exp(-dt * 1.5) : 1);
      this.camInit = true;
      cam.position.copy(this.camPos);
      cam.lookAt(this.camVise);
      cam.fov = 55;
      cam.updateProjectionMatrix();
      final.uVitesse.value = 0;
      return;
    }
    const fx = Math.cos(v.cap);
    const fz = Math.sin(v.cap);
    if (this.modeCamera === "presentation") {
      // Pendant le décompte : on tourne autour du kart, de face jusque derrière.
      const t = Math.min(1, this.tempsMode / 3.2);
      const a = v.cap + Math.PI * (1 - (t * t * (3 - 2 * t)));
      const dist = 5.5 + t * 1.2;
      cam.position.set(v.x - Math.cos(a) * dist, v.y + 1.6 + t * 1.0, v.z - Math.sin(a) * dist);
      cam.lookAt(v.x + fx * t * 3, v.y + 1.0, v.z + fz * t * 3);
      cam.fov = 60;
      cam.updateProjectionMatrix();
      this.camCap = v.cap;
      this.camPos.copy(cam.position);
      this.camVise.set(v.x + fx * 3, v.y + 1.2, v.z + fz * 3);
      this.camInit = true;
      final.uVitesse.value = 0;
      return;
    }
    if (this.modeCamera === "arrivee" || this.modeCamera === "vitrine") {
      // Après l'arrivée, ou au choix du pilote : la caméra tourne doucement devant le pilote.
      const vitrine = this.modeCamera === "vitrine";
      const a = v.cap + Math.PI * (vitrine ? 0.72 : 0.75) + Math.sin(this.tempsMode * 0.35) * (vitrine ? 0.35 : 0.3);
      const dist = vitrine ? 4.6 : 6;
      const pos = new THREE.Vector3(v.x - Math.cos(a) * dist, v.y + (vitrine ? 1.5 : 2.2), v.z - Math.sin(a) * dist);
      pos.y = Math.max(pos.y, this.solSous(pos.x, pos.z) + 1);
      // En vitrine, le kart est décalé vers la droite de l'écran (la fiche est à gauche).
      const droite = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
      const vise = new THREE.Vector3(v.x, v.y + 0.9, v.z).addScaledVector(droite, vitrine ? 1.3 : 0);
      if (!this.camInit) {
        this.camPos.copy(pos);
        this.camVise.copy(vise);
        this.camInit = true;
      }
      this.camPos.lerp(pos, 1 - Math.exp(-dt * 2));
      this.camVise.lerp(vise, 1 - Math.exp(-dt * 4));
      cam.position.copy(this.camPos);
      cam.lookAt(this.camVise);
      cam.fov = vitrine ? 45 : 50;
      cam.updateProjectionMatrix();
      final.uVitesse.value = 0;
      return;
    }
    // ——— Derrière le kart
    if (!this.camInit) this.camCap = v.cap;
    if (k.chute === 0) this.camCap += angle(v.cap + v.lacet * 0.35 - this.camCap) * (1 - Math.exp(-dt * 5));
    const cx = Math.cos(this.camCap);
    const cz = Math.sin(this.camCap);
    const vitesse = Math.max(0, k.v);
    const dist = 5.6 + vitesse * 0.05;
    const pos = new THREE.Vector3(v.x - cx * dist, v.y + 2.3, v.z - cz * dist);
    pos.y = Math.max(pos.y, this.solSous(pos.x, pos.z) + 1.3);
    const vise = new THREE.Vector3(v.x + cx * 4, v.y + 1.1, v.z + cz * 4);
    if (k.chute > 0) {
      vise.set(v.x, Math.max(v.y, 0), v.z);
      pos.copy(this.camPos);
    }
    if (!this.camInit) {
      this.camPos.copy(pos);
      this.camVise.copy(vise);
      cam.fov = 64;
      this.camInit = true;
    }
    this.camPos.lerp(pos, 1 - Math.exp(-dt * 12));
    this.camVise.lerp(vise, 1 - Math.exp(-dt * 14));
    cam.position.copy(this.camPos);
    if (this.tremble > 0) {
      this.tremble = Math.max(0, this.tremble - dt);
      cam.position.x += (Math.random() - 0.5) * this.tremble * 0.6;
      cam.position.y += (Math.random() - 0.5) * this.tremble * 0.6;
    }
    cam.lookAt(this.camVise);
    const turbo = k.turbo > 0 ? 1 : 0;
    const fov = 62 + Math.min(1, vitesse / REGLAGES.vitesseMax) * 6 + turbo * 9;
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 6));
    cam.updateProjectionMatrix();
    final.uVitesse.value += (turbo * 0.55 - final.uVitesse.value) * (1 - Math.exp(-dt * 8));
    final.uVitesseCentre.value.set(0.5, 0.45);
  }

  /** La position à l'écran d'un kart (pour les étiquettes et les onomatopées). */
  ecranDe(i: number, hauteur = 2.2) {
    const v = this.karts[i];
    return this.rendu.versEcran(new THREE.Vector3(v.x, v.y + hauteur, v.z));
  }

  /** Recentre la caméra (changement de mode). */
  changerCamera(mode: Camera) {
    this.modeCamera = mode;
    this.tempsMode = 0;
    if (mode !== "suivre") this.camInit = false;
  }
}
