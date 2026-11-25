// Le petit être et sa physique sur une sphère : la gravité tire vers le centre, la marche se fait
// dans le plan tangent, et chaque pas fait tourner la position (et le regard) autour du centre.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;

export class Joueur {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  /** Direction du regard (tangente à la sphère). */
  readonly avant = new THREE.Vector3();
  readonly haut = new THREE.Vector3();
  auSol = true;
  noeud = -1;
  vertical = 0;
  vitesse = 0;
  dansLEau = 0;
  /** Rotation appliquée à la dernière image (pour transporter la caméra avec soi). */
  readonly transport = new THREE.Quaternion();
  /** Une pierre poussée à cette image (pour le son). */
  poussee = 0;

  constructor(private readonly monde: Monde) {
    const p = monde.plan;
    monde.surface(p.depart, this.pos);
    this.avant.copy(p.regard);
    this.haut.copy(p.depart).normalize();
  }

  maj(dt: number, souhait: THREE.Vector3, course: boolean, saut: boolean) {
    const J = REGLAGES.joueur;
    const m = this.monde;
    const haut = this.haut.copy(this.pos).normalize();
    this.noeud = m.noeud(haut, this.noeud);
    this.dansLEau = m.eau[this.noeud];
    const freinEau = this.dansLEau > 0.15 ? J.freinEau : 1;
    const vmax = (course ? J.course : J.vitesse) * freinEau;

    // Vitesse tangente et verticale
    let vr = this.vel.dot(haut);
    const vt = this.vel.clone().addScaledVector(haut, -vr);
    const cible = souhait.clone().multiplyScalar(vmax);
    const k = Math.min(1, dt / J.reactivite) * (this.auSol ? 1 : 0.35);
    vt.lerp(cible, k);
    vr -= J.gravite * dt;
    if (saut && this.auSol) {
      vr = J.saut;
      this.auSol = false;
    }

    // Collisions avec les pierres (on les pousse) et les troncs (on les contourne)
    this.poussee = 0;
    for (const p of m.pierres) {
      const d = p.dir.angleTo(haut) * R;
      const contact = p.rayon + 0.3;
      if (d < contact && d > 1e-4) {
        const n = p.dir.clone().sub(haut.clone().multiplyScalar(p.dir.dot(haut))).normalize();
        const pousse = Math.max(0, vt.dot(n));
        const recouvre = contact - d;
        // La pierre avance (moins vite que nous) ; nous reculons un peu.
        const avance = Math.min(recouvre * 0.6 + pousse * dt * 0.7, 2 * dt);
        if (avance > 0) {
          const axe = new THREE.Vector3().crossVectors(p.dir, n).normalize();
          const nouv = p.dir.clone().applyAxisAngle(axe, avance / R);
          m.deplacerPierre(p, nouv);
          this.poussee = Math.max(this.poussee, pousse);
        }
        vt.addScaledVector(n, -Math.max(0, vt.dot(n)) * 0.55);
        this.deplacer(n.clone().multiplyScalar(-recouvre * 0.3));
      }
    }
    for (const a of m.arbres) {
      if (a.croissance < 0.3) continue;
      const d = a.dir.angleTo(haut) * R;
      const contact = 0.25 + 0.15 * a.croissance;
      if (d < contact && d > 1e-4) {
        const n = a.dir.clone().sub(haut.clone().multiplyScalar(a.dir.dot(haut))).normalize();
        vt.addScaledVector(n, -Math.max(0, vt.dot(n)));
        this.deplacer(n.clone().multiplyScalar(-(contact - d)));
      }
    }

    // Déplacement le long de la sphère
    this.transport.identity();
    const pas = vt.clone().multiplyScalar(dt);
    const q = this.deplacer(pas);
    vt.applyQuaternion(q);
    haut.copy(this.pos).normalize();

    // Hauteur : sol, saut, atterrissage
    const sol = R + m.hauteurSol(haut, this.noeud);
    let r = this.pos.length() + vr * dt;
    const etaitAuSol = this.auSol;
    if (r <= sol) {
      r = sol;
      this.vertical = vr;
      if (vr < 0) vr = 0;
      this.auSol = true;
    } else if (etaitAuSol && vr <= 0 && r - sol < 0.25) {
      // On colle au sol en descendant une pente.
      r = sol;
      vr = 0;
      this.auSol = true;
    } else {
      this.auSol = false;
      this.vertical = vr;
    }
    this.pos.copy(haut).multiplyScalar(r);
    this.vel.copy(vt).addScaledVector(haut, vr);
    this.vitesse = vt.length();

    // Le regard suit la marche
    if (souhait.lengthSq() > 0.01) {
      const vise = souhait.clone().normalize();
      const angle = this.avant.angleTo(vise);
      const sens = Math.sign(new THREE.Vector3().crossVectors(this.avant, vise).dot(haut)) || 1;
      this.avant.applyAxisAngle(haut, sens * Math.min(angle, dt * 12));
    }
    this.avant.addScaledVector(haut, -this.avant.dot(haut)).normalize();
  }

  /** Déplace d'un vecteur tangent, en tournant autour du centre. Renvoie la rotation. */
  private deplacer(d: THREE.Vector3) {
    const l = d.length();
    const q = new THREE.Quaternion();
    if (l < 1e-7) return q;
    const axe = new THREE.Vector3().crossVectors(this.pos, d).normalize();
    q.setFromAxisAngle(axe, l / this.pos.length());
    this.pos.applyQuaternion(q);
    this.avant.applyQuaternion(q);
    this.transport.premultiply(q);
    return q;
  }

  /** Téléporte (débogage). */
  teleporter(dir: THREE.Vector3) {
    this.monde.surface(dir.clone().normalize(), this.pos, 0.05);
    this.vel.set(0, 0, 0);
    const h = this.pos.clone().normalize();
    this.avant.addScaledVector(h, -this.avant.dot(h));
    if (this.avant.lengthSq() < 1e-6) this.avant.set(1, 0, 0).addScaledVector(h, -h.x);
    this.avant.normalize();
  }
}
