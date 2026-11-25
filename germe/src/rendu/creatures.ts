// Les créatures qui reviennent avec la vie : des nuées d'oiseaux qui font le tour de la planète,
// des pelotes (petites boules duveteuses qui sautillent dans l'herbe et fuient le petit être)
// et des papillons autour des fleurs.
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { bruit3, hasard } from "../monde/bruit";
import { REGLAGES } from "../reglages";

const R = REGLAGES.planete.rayon;
const HAUT = new THREE.Vector3(0, 1, 0);
const bruit = bruit3(41);

interface Oiseau {
  groupe: THREE.Group;
  ailes: THREE.Mesh[];
  decalage: THREE.Vector3;
  phase: number;
}
interface Nuee {
  axe: THREE.Vector3;
  angle: number;
  vitesse: number;
  altitude: number;
  oiseaux: Oiseau[];
  apparition: number;
  seuil: number;
  ondule: number;
}
interface Pelote {
  groupe: THREE.Group;
  corps: THREE.Mesh;
  dir: THREE.Vector3;
  cap: THREE.Vector3;
  saut: number;
  pause: number;
  apparition: number;
  actif: boolean;
}
interface Papillon {
  groupe: THREE.Group;
  ailes: THREE.Mesh[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  phase: number;
  actif: boolean;
}

export class Creatures {
  readonly groupe = new THREE.Group();
  private readonly nuees: Nuee[] = [];
  private readonly pelotes: Pelote[] = [];
  private readonly papillons: Papillon[] = [];
  private readonly alea = hasard(808);
  /** Appelé quand un oiseau passe près de la caméra (pour le chant). */
  surChant: ((pos: THREE.Vector3) => void) | null = null;
  private chantDans = 3;

  constructor(private readonly monde: Monde) {
    const alea = this.alea;
    // Oiseaux
    const corpsGeo = new THREE.SphereGeometry(0.09, 8, 6).scale(0.8, 0.7, 1.8);
    const aileGeo = new THREE.BufferGeometry();
    aileGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.1, 0, 0, -0.1, 0.38, 0, -0.05], 3));
    aileGeo.computeVertexNormals();
    const couleurs = [0xf6f3ee, 0x3f5d7a, 0xff8a65, 0xf6f3ee];
    for (let n = 0; n < 5; n++) {
      const mat = new THREE.MeshStandardMaterial({ color: couleurs[n % couleurs.length], roughness: 0.7, side: THREE.DoubleSide });
      const axe = new THREE.Vector3(alea() - 0.5, alea() - 0.5, alea() - 0.5).normalize();
      const nuee: Nuee = {
        axe,
        angle: alea() * Math.PI * 2,
        vitesse: (0.09 + alea() * 0.06) * (alea() < 0.5 ? 1 : -1),
        altitude: 4.5 + alea() * 3.5,
        oiseaux: [],
        apparition: 0,
        seuil: 0.12 + n * 0.14,
        ondule: alea() * 10,
      };
      const nb = 5 + Math.floor(alea() * 5);
      for (let k = 0; k < nb; k++) {
        const g = new THREE.Group();
        const corps = new THREE.Mesh(corpsGeo, mat);
        corps.castShadow = true;
        g.add(corps);
        const ailes: THREE.Mesh[] = [];
        for (const s of [-1, 1]) {
          const a = new THREE.Mesh(aileGeo, mat);
          a.scale.x = s;
          a.castShadow = true;
          g.add(a);
          ailes.push(a);
        }
        const rang = Math.ceil(k / 2);
        const cote = k % 2 ? 1 : -1;
        g.visible = false;
        this.groupe.add(g);
        nuee.oiseaux.push({
          groupe: g,
          ailes,
          decalage: new THREE.Vector3(cote * rang * 0.5 + (alea() - 0.5) * 0.3, (alea() - 0.5) * 0.4, -rang * 0.55),
          phase: alea() * 10,
        });
      }
      this.nuees.push(nuee);
    }

    // Pelotes
    const peluche = (couleur: number) => {
      const geo = new THREE.IcosahedronGeometry(0.22, 2);
      const p = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        v.multiplyScalar(1 + 0.12 * bruit(v.x * 14, v.y * 14, v.z * 14));
        v.y *= 0.85;
        p.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: couleur, roughness: 1, flatShading: true }));
    };
    const teintes = [0xffe2b8, 0xffb88c, 0xc9d8ff, 0xfff4e6, 0xd8f0b0];
    const noir = new THREE.MeshStandardMaterial({ color: 0x15131a, roughness: 0.3 });
    for (let k = 0; k < 26; k++) {
      const g = new THREE.Group();
      const corps = peluche(teintes[k % teintes.length]);
      corps.castShadow = true;
      corps.position.y = 0.2;
      g.add(corps);
      for (const s of [-1, 1]) {
        const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), noir);
        oeil.position.set(s * 0.08, 0.06, 0.19);
        corps.add(oeil);
        const oreille = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), (corps.material as THREE.Material));
        oreille.position.set(s * 0.1, 0.2, 0);
        oreille.rotation.z = -s * 0.4;
        corps.add(oreille);
      }
      g.visible = false;
      this.groupe.add(g);
      this.pelotes.push({ groupe: g, corps, dir: new THREE.Vector3(0, 1, 0), cap: new THREE.Vector3(1, 0, 0), saut: 0, pause: 0, apparition: 0, actif: false });
    }

    // Papillons
    const aile = new THREE.PlaneGeometry(0.12, 0.1).translate(0.06, 0, 0);
    const teintesP = [0xffd84a, 0xffffff, 0x8fd3ff, 0xff9ad5, 0xffa24a];
    for (let k = 0; k < 24; k++) {
      const mat = new THREE.MeshStandardMaterial({ color: teintesP[k % teintesP.length], side: THREE.DoubleSide, emissive: teintesP[k % teintesP.length], emissiveIntensity: 0.2 });
      const g = new THREE.Group();
      const ailes: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        const a = new THREE.Mesh(aile, mat);
        a.scale.x = s;
        g.add(a);
        ailes.push(a);
      }
      g.visible = false;
      this.groupe.add(g);
      this.papillons.push({ groupe: g, ailes, pos: new THREE.Vector3(), vel: new THREE.Vector3(), phase: alea() * 10, actif: false });
    }
  }

  maj(dt: number, temps: number, joueur: THREE.Vector3, camera: THREE.Vector3, part: number, jourLocal: number) {
    this.majNuees(dt, temps, camera, part);
    this.majPelotes(dt, temps, joueur, part);
    this.majPapillons(dt, temps, joueur, part, jourLocal);
  }

  private majNuees(dt: number, temps: number, camera: THREE.Vector3, part: number) {
    const tmp = new THREE.Vector3();
    let plusProche = Infinity;
    let ouProche: THREE.Vector3 | null = null;
    for (const n of this.nuees) {
      const veut = part >= n.seuil ? 1 : 0;
      n.apparition += (veut - n.apparition) * Math.min(1, dt * 0.5);
      const visible = n.apparition > 0.02;
      n.angle += n.vitesse * dt;
      // La nuée suit un grand cercle, qui tourne lentement lui-même.
      n.axe.applyAxisAngle(HAUT, dt * 0.01).normalize();
      const perp = new THREE.Vector3(1, 0, 0).cross(n.axe);
      if (perp.lengthSq() < 0.01) perp.set(0, 0, 1).cross(n.axe);
      perp.normalize();
      const dir = perp.clone().applyAxisAngle(n.axe, n.angle);
      const tangente = new THREE.Vector3().crossVectors(n.axe, dir).multiplyScalar(Math.sign(n.vitesse));
      const droite = new THREE.Vector3().crossVectors(dir, tangente);
      const alt = R + n.altitude + Math.sin(temps * 0.3 + n.ondule) * 1.2;
      const centre = dir.clone().multiplyScalar(alt);
      for (const o of n.oiseaux) {
        o.groupe.visible = visible;
        if (!visible) continue;
        const d = o.decalage;
        tmp.copy(centre)
          .addScaledVector(droite, d.x + Math.sin(temps * 0.9 + o.phase) * 0.2)
          .addScaledVector(dir, d.y + Math.sin(temps * 1.3 + o.phase) * 0.25)
          .addScaledVector(tangente, d.z);
        o.groupe.position.copy(tmp);
        const m = new THREE.Matrix4().makeBasis(droite, dir, tangente);
        o.groupe.quaternion.setFromRotationMatrix(m);
        o.groupe.scale.setScalar(n.apparition * 1.2);
        const bat = Math.sin(temps * 11 + o.phase);
        const plane = Math.sin(temps * 0.7 + o.phase) > 0.3 ? 0.15 : 1;
        o.ailes[0].rotation.z = bat * 0.7 * plane;
        o.ailes[1].rotation.z = -bat * 0.7 * plane;
        const dc = tmp.distanceTo(camera);
        if (dc < plusProche) {
          plusProche = dc;
          ouProche = tmp.clone();
        }
      }
    }
    this.chantDans -= dt;
    if (this.chantDans <= 0 && ouProche && plusProche < 14) {
      this.chantDans = 1.5 + Math.random() * 3;
      this.surChant?.(ouProche);
    }
  }

  private majPelotes(dt: number, temps: number, joueur: THREE.Vector3, part: number) {
    const m = this.monde;
    const voulu = Math.floor(Math.max(0, part - 0.12) * 34);
    let actifs = this.pelotes.filter((p) => p.actif).length;
    const jdir = joueur.clone().normalize();
    for (const p of this.pelotes) {
      if (!p.actif) {
        if (actifs < voulu && Math.random() < dt * 0.6) {
          // Naît près d'un arbre adulte, de préférence pas trop loin du joueur
          const adultes = m.arbres.filter((a) => a.croissance > 0.9);
          if (adultes.length === 0) continue;
          adultes.sort((a, b) => a.dir.angleTo(jdir) - b.dir.angleTo(jdir));
          const a = adultes[Math.floor(Math.random() * Math.min(4, adultes.length))];
          const t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          t.addScaledVector(a.dir, -t.dot(a.dir)).normalize();
          p.dir.copy(a.dir).applyAxisAngle(new THREE.Vector3().crossVectors(a.dir, t).normalize(), 1.2 / R).normalize();
          p.cap.copy(t);
          p.actif = true;
          p.apparition = 0;
          p.saut = 0;
          p.pause = 1;
          p.groupe.visible = true;
          actifs++;
        }
        continue;
      }
      const i = m.noeud(p.dir);
      // Elle s'en va si l'herbe disparaît sous elle
      const fuite = m.vie[i] < 0.3 || actifs > voulu + 2;
      p.apparition += ((fuite ? 0 : 1) - p.apparition) * Math.min(1, dt * 2);
      if (fuite && p.apparition < 0.05) {
        p.actif = false;
        p.groupe.visible = false;
        actifs--;
        continue;
      }
      // Sautille : pause, puis un bond dans la direction du cap
      const versJoueur = joueur.clone().sub(p.groupe.position);
      const dj = versJoueur.length();
      if (p.saut <= 0) {
        p.pause -= dt;
        if (p.pause <= 0) {
          p.saut = 1;
          if (dj < 2.5) {
            // Fuit le petit être
            p.cap.copy(versJoueur).negate();
          } else {
            p.cap.applyAxisAngle(p.dir, (Math.random() - 0.5) * 2);
          }
          p.pause = 0.3 + Math.random() * (dj < 2.5 ? 0.1 : 1.8);
        }
      }
      p.cap.addScaledVector(p.dir, -p.cap.dot(p.dir)).normalize();
      let h = 0;
      if (p.saut > 0) {
        p.saut -= dt * 2.6;
        const s = Math.max(0, p.saut);
        h = Math.sin(s * Math.PI) * 0.35;
        const axe = new THREE.Vector3().crossVectors(p.dir, p.cap).normalize();
        const devant = p.dir.clone().applyAxisAngle(axe, (dt * 1.6) / R);
        // Ne saute pas dans l'eau ni sur le sol mort
        const j = m.noeud(devant, i);
        if (m.vie[j] > 0.3 && m.eau[j] < 0.05) {
          p.dir.copy(devant).normalize();
          p.cap.applyAxisAngle(axe, (dt * 1.6) / R);
        } else p.cap.negate();
      }
      m.surface(p.dir, p.groupe.position, h);
      const haut = p.dir;
      const droite = new THREE.Vector3().crossVectors(haut, p.cap).normalize();
      p.groupe.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(droite, haut, p.cap));
      const ecr = p.saut > 0 ? 1 + Math.sin(Math.max(0, p.saut) * Math.PI) * 0.18 : 1 - 0.08 * Math.max(0, Math.sin(temps * 3 + p.dir.x * 10));
      p.corps.scale.set(p.apparition / Math.sqrt(ecr), p.apparition * ecr, p.apparition / Math.sqrt(ecr));
    }
  }

  private majPapillons(dt: number, temps: number, joueur: THREE.Vector3, part: number, jour: number) {
    const m = this.monde;
    const voulu = Math.floor(Math.max(0, part - 0.25) * 30 * jour);
    let actifs = this.papillons.filter((p) => p.actif).length;
    const up = joueur.clone().normalize();
    for (const p of this.papillons) {
      if (!p.actif) {
        if (actifs < voulu && Math.random() < dt) {
          const t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
          t.addScaledVector(up, -t.dot(up)).normalize();
          const dir = up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(up, t).normalize(), (3 + Math.random() * 8) / R);
          const i = m.noeud(dir);
          if (m.vie[i] < 0.8) continue;
          m.surface(dir, p.pos, 0.6 + Math.random() * 0.8);
          p.vel.set(0, 0, 0);
          p.actif = true;
          p.groupe.visible = true;
          actifs++;
        }
        continue;
      }
      const haut = p.pos.clone().normalize();
      // Vol erratique, qui reste au-dessus de l'herbe
      p.phase += dt;
      const err = new THREE.Vector3(
        bruit(p.phase * 0.7, 0, p.groupe.id),
        bruit(0, p.phase * 0.7, p.groupe.id + 5),
        bruit(p.groupe.id + 9, 0, p.phase * 0.7),
      ).multiplyScalar(4);
      p.vel.addScaledVector(err, dt);
      const sol = R + m.hauteurSol(haut);
      const alt = p.pos.length() - sol;
      p.vel.addScaledVector(haut, (0.9 - alt) * 2.5 * dt);
      p.vel.multiplyScalar(Math.exp(-dt * 1.2));
      if (p.vel.length() > 1.6) p.vel.setLength(1.6);
      p.pos.addScaledVector(p.vel, dt);
      const loin = p.pos.distanceTo(joueur) > 16 || jour < 0.2 || m.vie[m.noeud(haut)] < 0.3;
      if (loin) {
        p.actif = false;
        p.groupe.visible = false;
        actifs--;
        continue;
      }
      p.groupe.position.copy(p.pos);
      const av = p.vel.clone().addScaledVector(haut, -p.vel.dot(haut));
      if (av.lengthSq() > 1e-4) {
        av.normalize();
        p.groupe.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(haut, av), haut, av));
      }
      const bat = Math.sin(temps * 18 + p.phase * 3) * 1.1;
      p.ailes[0].rotation.z = bat;
      p.ailes[1].rotation.z = -bat;
    }
  }
}
