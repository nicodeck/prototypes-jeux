// Le petit être : un galet crème aux grands yeux, une pousse sur la tête, une écharpe corail.
// Il rebondit en marchant, s'étire en sautant, s'écrase à l'atterrissage ; la pousse et l'écharpe
// suivent ses mouvements avec un peu de retard. Les graines qu'il porte tournent autour de sa tête.
import * as THREE from "three";

export interface PoseJoueur {
  vitesse: number;
  vitesseMax: number;
  auSol: boolean;
  vertical: number;
  creuse: boolean;
  plante: number;
  souffle: number;
  graines: number;
  nuit: number;
}

function mat(couleur: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.6, ...opts });
}

export class Perso {
  readonly groupe = new THREE.Group();
  private readonly corps = new THREE.Group();
  private readonly tete = new THREE.Group();
  private readonly pousse = new THREE.Group();
  private readonly feuilles: THREE.Mesh[] = [];
  private readonly pieds: THREE.Mesh[] = [];
  private readonly queue: THREE.Group;
  private readonly orbite = new THREE.Group();
  private readonly grainesVues: THREE.Mesh[] = [];
  private readonly yeux: THREE.Mesh[] = [];
  readonly lumiere = new THREE.PointLight(0xffd08a, 0, 7, 1.6);
  private readonly bulbe: THREE.Mesh;
  private phase = 0;
  private ecrase = 0;
  private ecraseV = 0;
  private penche = 0;
  private poussePenche = new THREE.Vector2();
  private pousseV = new THREE.Vector2();
  private clignement = 2;
  private etaitAuSol = true;
  /** Appelé à chaque pas (pour le son et la poussière). */
  surPas: (() => void) | null = null;

  constructor() {
    const peau = mat(0xf4ead6, { emissive: 0xffd9a0, emissiveIntensity: 0.12, roughness: 0.5 });
    const corps = new THREE.Mesh(new THREE.SphereGeometry(0.3, 28, 20), peau);
    corps.scale.set(1, 1.12, 0.95);
    corps.castShadow = true;
    this.corps.add(corps);
    this.corps.position.y = 0.36;

    // Visage
    const noir = mat(0x1d1a22, { roughness: 0.2 });
    const blanc = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
    for (const s of [-1, 1]) {
      const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), noir);
      oeil.scale.set(0.85, 1.25, 0.6);
      oeil.position.set(s * 0.1, 0.07, 0.255);
      const reflet = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), blanc);
      reflet.position.set(0.018, 0.022, 0.04);
      oeil.add(reflet);
      this.tete.add(oeil);
      this.yeux.push(oeil);
      const joue = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), mat(0xff9a8a, { transparent: true, opacity: 0.75 }));
      joue.scale.set(1.2, 0.6, 0.4);
      joue.position.set(s * 0.17, -0.02, 0.235);
      this.tete.add(joue);
    }
    this.corps.add(this.tete);

    // La pousse
    const vert = mat(0x6cc644, { roughness: 0.45, emissive: 0x2a5a10, emissiveIntensity: 0.15 });
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.24, 6), vert);
    tige.position.y = 0.12;
    this.pousse.add(tige);
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), vert);
      f.scale.set(1, 0.28, 0.55);
      f.geometry.translate(0.1, 0, 0);
      f.position.set(0, 0.24, 0);
      f.rotation.set(0, s > 0 ? 0 : Math.PI, 0.35);
      f.castShadow = true;
      this.pousse.add(f);
      this.feuilles.push(f);
    }
    this.bulbe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xfff0b0, { emissive: 0xffd070, emissiveIntensity: 0.3 }));
    this.bulbe.position.y = 0.26;
    this.pousse.add(this.bulbe);
    this.lumiere.position.y = 0.3;
    this.pousse.add(this.lumiere);
    this.pousse.position.y = 0.3;
    this.corps.add(this.pousse);

    // L'écharpe et sa queue qui flotte
    const corail = mat(0xff6a4d, { roughness: 0.7 });
    const echarpe = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.05, 8, 24), corail);
    echarpe.rotation.x = Math.PI / 2;
    echarpe.position.y = -0.1;
    echarpe.scale.set(1, 0.95, 1);
    echarpe.castShadow = true;
    this.corps.add(echarpe);
    this.queue = new THREE.Group();
    this.queue.position.set(0.12, -0.1, -0.22);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.12), corail);
      m.position.z = -0.1 * k - 0.05;
      m.castShadow = true;
      this.queue.add(m);
    }
    this.corps.add(this.queue);

    // Pieds
    const piedMat = mat(0xd8c3a0, { roughness: 0.8 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), piedMat);
      p.scale.set(1, 0.6, 1.35);
      p.position.set(s * 0.12, 0.045, 0.02);
      p.castShadow = true;
      this.groupe.add(p);
      this.pieds.push(p);
    }

    // Graines en orbite
    const graineMat = mat(0xffd36b, { emissive: 0xffb030, emissiveIntensity: 1.2, roughness: 0.3 });
    for (let k = 0; k < 8; k++) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), graineMat);
      g.scale.set(0.8, 1.2, 0.8);
      g.visible = false;
      this.orbite.add(g);
      this.grainesVues.push(g);
    }
    this.orbite.position.y = 0.95;
    this.groupe.add(this.orbite);
    this.groupe.add(this.corps);
  }

  /** Oriente et anime le petit être. */
  animer(dt: number, temps: number, p: PoseJoueur) {
    const v = Math.min(1, p.vitesse / p.vitesseMax);
    // Cycle de marche
    const avant = this.phase;
    this.phase += dt * (4 + p.vitesse * 2.1) * (p.auSol ? 1 : 0.2);
    if (p.auSol && v > 0.1 && Math.floor(avant / Math.PI) !== Math.floor(this.phase / Math.PI)) this.surPas?.();
    const pas = Math.sin(this.phase);
    const rebond = p.auSol ? Math.abs(pas) * 0.07 * v : 0;

    // Écrasement à l'atterrissage, étirement en l'air (ressort)
    if (p.auSol && !this.etaitAuSol) this.ecraseV -= 6 + Math.min(10, Math.abs(p.vertical) * 0.8);
    this.etaitAuSol = p.auSol;
    const cible = p.auSol ? 0 : THREE.MathUtils.clamp(p.vertical * 0.03, -0.12, 0.2);
    this.ecraseV += (-(this.ecrase - cible) * 220 - this.ecraseV * 14) * dt;
    this.ecrase += this.ecraseV * dt;
    const e = THREE.MathUtils.clamp(this.ecrase, -0.35, 0.35);
    let sy = 1 + e + Math.sin(this.phase * 2) * 0.03 * v;
    let sxz = 1 - e * 0.5;
    // Creuser : il se penche et tremble ; planter : il s'accroupit
    let pencheCible = v * 0.22;
    if (p.creuse) {
      pencheCible = 0.55 + Math.sin(temps * 30) * 0.06;
      sy *= 0.92;
    }
    if (p.plante > 0) {
      const k = Math.sin(Math.min(1, p.plante) * Math.PI);
      sy *= 1 - 0.25 * k;
      sxz *= 1 + 0.1 * k;
      pencheCible = 0.3 * k;
    }
    if (p.souffle > 0) {
      const k = Math.sin(Math.min(1, p.souffle) * Math.PI);
      sy *= 1 + 0.2 * k;
      sxz *= 1 - 0.06 * k;
    }
    this.penche += (pencheCible - this.penche) * Math.min(1, dt * 8);
    this.corps.scale.set(sxz, sy, sxz);
    this.corps.position.y = 0.36 * sy + rebond;
    this.corps.rotation.x = this.penche;
    this.corps.rotation.z = pas * 0.08 * v;

    // Pieds
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? 1 : -1;
      const ph = Math.sin(this.phase) * s;
      this.pieds[k].position.z = 0.02 + ph * 0.13 * v;
      this.pieds[k].position.y = 0.045 + Math.max(0, Math.cos(this.phase) * s) * 0.08 * v + (p.auSol ? 0 : 0.05);
    }

    // La pousse : un ressort qui retarde sur le mouvement
    const force = new THREE.Vector2(-this.penche * 0.8 - v * 0.15, pas * 0.12 * v);
    if (!p.auSol) force.x += p.vertical * 0.04;
    this.pousseV.addScaledVector(force.clone().sub(this.poussePenche).multiplyScalar(90), dt);
    this.pousseV.multiplyScalar(Math.exp(-dt * 6));
    this.poussePenche.addScaledVector(this.pousseV, dt);
    this.pousse.rotation.x = -this.poussePenche.x * 0.8;
    this.pousse.rotation.z = this.poussePenche.y;
    const ondule = Math.sin(temps * 2.3) * 0.08;
    this.feuilles[0].rotation.z = 0.35 + ondule + this.poussePenche.x * 0.3;
    this.feuilles[1].rotation.z = 0.35 - ondule + this.poussePenche.x * 0.3;
    // La nuit, le bourgeon de la pousse s'allume comme une petite lanterne.
    (this.bulbe.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + p.nuit * 1.1;
    this.lumiere.intensity = p.nuit * 1.5;

    // L'écharpe flotte derrière
    this.queue.rotation.x = -0.4 - v * 0.6 + Math.sin(temps * 9) * 0.12 * (0.3 + v);
    this.queue.rotation.y = Math.sin(temps * 5) * 0.2 * v;
    this.queue.children.forEach((m, k) => {
      m.rotation.x = Math.sin(temps * 10 - k) * 0.25 * (0.3 + v);
    });

    // Clignement des yeux
    this.clignement -= dt;
    const ferme = this.clignement < 0.12 ? 0.1 : 1;
    if (this.clignement < 0) this.clignement = 2 + Math.random() * 3;
    for (const o of this.yeux) o.scale.y = 1.25 * ferme;

    // Graines en orbite
    const n = Math.min(this.grainesVues.length, p.graines);
    this.grainesVues.forEach((g, k) => {
      g.visible = k < n;
      if (!g.visible) return;
      const a = temps * 1.6 + (k / Math.max(1, n)) * Math.PI * 2;
      g.position.set(Math.cos(a) * 0.48, Math.sin(a * 2 + k) * 0.06, Math.sin(a) * 0.48);
      g.rotation.y = a;
    });
  }

  /** Place le petit être : position, verticale locale, direction du regard. */
  placer(pos: THREE.Vector3, haut: THREE.Vector3, avant: THREE.Vector3) {
    this.groupe.position.copy(pos);
    const droite = new THREE.Vector3().crossVectors(haut, avant).normalize();
    const av = new THREE.Vector3().crossVectors(droite, haut).normalize();
    const m = new THREE.Matrix4().makeBasis(droite, haut, av);
    this.groupe.quaternion.setFromRotationMatrix(m);
  }
}
