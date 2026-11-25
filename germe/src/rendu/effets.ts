// Les effets de particules : ambiance (pollen le jour, poussière sur le sol mort, lucioles la nuit,
// flocons de cendre dans les tempêtes, embruns des sources, pétales des arbres en fleurs) et éclats
// ponctuels (graine ramassée, graine plantée, coup de pelle, réveil d'une source, souffle).
import * as THREE from "three";
import type { Monde } from "../monde/monde";
import { REGLAGES } from "../reglages";
import { Particules } from "./particules";

const R = REGLAGES.planete.rayon;

function tangenteAleatoire(up: THREE.Vector3) {
  const t = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  return t.addScaledVector(up, -t.dot(up)).normalize();
}

export class Effets {
  readonly groupe = new THREE.Group();
  readonly lumineux = new Particules(5000, true);
  readonly mats = new Particules(3500, false);
  private readonly ondes: { mesh: THREE.Mesh; t: number; duree: number; taille: number }[] = [];
  readonly curseur: THREE.Mesh;

  constructor(private readonly monde: Monde) {
    this.groupe.add(this.lumineux.points, this.mats.points);
    for (let k = 0; k < 4; k++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 64),
        new THREE.MeshBasicMaterial({ color: 0xe6ffc8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.visible = false;
      this.groupe.add(mesh);
      this.ondes.push({ mesh, t: 1, duree: 1, taille: 1 });
    }
    this.curseur = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x9be15d, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.groupe.add(this.curseur);
  }

  private onde(pos: THREE.Vector3, up: THREE.Vector3, couleur: number, taille: number, duree: number) {
    const o = this.ondes.find((x) => x.t >= x.duree) ?? this.ondes[0];
    o.t = 0;
    o.duree = duree;
    o.taille = taille;
    o.mesh.position.copy(pos).addScaledVector(up, 0.3);
    o.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    (o.mesh.material as THREE.MeshBasicMaterial).color.set(couleur);
    o.mesh.visible = true;
  }

  maj(dt: number, temps: number, o: { joueur: THREE.Vector3; camera: THREE.Vector3; nuit: number; orbite: boolean }) {
    const m = this.monde;
    const up = o.joueur.clone().normalize();
    // Ambiance autour du joueur
    if (!o.orbite) {
      const n = Math.random() < dt * 40 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const t = tangenteAleatoire(up);
        const d = 1 + Math.random() * 11;
        const dir = up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(up, t).normalize(), d / R);
        const i = m.noeud(dir);
        const p = m.surface(dir, new THREE.Vector3(), 0.2 + Math.random() * 2.2);
        const vie = m.vie[i];
        if (vie > 0.5) {
          if (o.nuit < 0.5) {
            this.lumineux.emettre({ pos: p, couleur: new THREE.Color(1, 0.88, 0.5).multiplyScalar(0.5), taille: 0.05, vie: 4, flotte: 0.25 });
          }
        } else if (m.cendre[i] < 0.3) {
          if (Math.random() < 0.5) this.mats.emettre({ pos: p, couleur: new THREE.Color(0.5, 0.48, 0.46), taille: 0.04, vie: 3.5, flotte: 0.2, vel: tangenteAleatoire(dir).multiplyScalar(0.3) });
        }
      }
      // Lucioles, la nuit, au-dessus de l'herbe
      if (o.nuit > 0.3) {
        const nl = Math.random() < dt * 30 * o.nuit ? 1 : 0;
        for (let k = 0; k < nl; k++) {
          const t = tangenteAleatoire(up);
          const d = 1.5 + Math.random() * 12;
          const dir = up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(up, t).normalize(), d / R);
          const i = m.noeud(dir);
          if (m.vie[i] < 0.6) continue;
          const p = m.surface(dir, new THREE.Vector3(), 0.3 + Math.random() * 1.4);
          this.lumineux.emettre({
            pos: p,
            couleur: new THREE.Color(0.75, 1, 0.35).multiplyScalar(1.6),
            taille: 0.09,
            vie: 5 + Math.random() * 4,
            flotte: 0.35,
            clignote: true,
          });
        }
      }
      // Pétales sous les arbres en fleurs
      for (const a of m.arbres) {
        if (a.espece !== 2 || a.croissance < 0.8) continue;
        if (a.dir.angleTo(up) * R > 15 || Math.random() > dt * 2.5) continue;
        const p = m.surface(a.dir, new THREE.Vector3(), 2 + Math.random()).addScaledVector(tangenteAleatoire(a.dir), Math.random() * 1.2);
        this.mats.emettre({ pos: p, couleur: new THREE.Color(1, 0.72, 0.85), taille: 0.07, vie: 4, gravite: 0.25, frein: 1.5, flotte: 0.4 });
      }
    }
    // Embruns des sources actives
    m.sources.forEach((s) => {
      if (!s.active) return;
      const c = m.surface(s.dir);
      if (c.distanceTo(o.camera) > 40) return;
      const fort = s.depuis < 3 ? 6 : 1;
      const n = Math.random() < dt * 25 * fort ? fort : 0;
      for (let k = 0; k < n; k++) {
        const v = s.dir.clone().multiplyScalar(2 + Math.random() * 2 * fort * 0.5).addScaledVector(tangenteAleatoire(s.dir), 0.6 + Math.random());
        this.lumineux.emettre({ pos: c.clone().addScaledVector(s.dir, 0.6), vel: v, couleur: new THREE.Color(0.6, 0.9, 1).multiplyScalar(0.8), taille: 0.07, vie: 1.6, gravite: 5, frein: 0.4 });
      }
    });
    // Tempêtes de cendre : des flocons sombres qui filent dans le sens du vent
    for (const v of m.vents) {
      const force = Math.min(1, v.temps / 3) * Math.min(1, (v.duree - v.temps) / 3);
      const dirV = new THREE.Vector3().crossVectors(v.axe, v.centre).normalize();
      const n = Math.floor(dt * 260 * force + Math.random());
      for (let k = 0; k < n; k++) {
        const t = tangenteAleatoire(v.centre);
        const d = Math.random() * REGLAGES.cendre.rayon;
        const dir = v.centre.clone().applyAxisAngle(new THREE.Vector3().crossVectors(v.centre, t).normalize(), d / R);
        const p = m.surface(dir, new THREE.Vector3(), 0.1 + Math.random() * 3.5);
        if (p.distanceTo(o.camera) > 35 && !o.orbite) continue;
        const g = (0.12 + Math.random() * 0.12) * (1 - 0.65 * o.nuit);
        this.mats.emettre({
          pos: p,
          vel: dirV.clone().multiplyScalar(4 + Math.random() * 3).addScaledVector(dir, (Math.random() - 0.3) * 0.8),
          couleur: new THREE.Color(g, g * 0.95, g * 0.92),
          taille: 0.07 + Math.random() * 0.06,
          vie: 2.2,
          flotte: 0.6,
        });
      }
    }
    // Ondes
    for (const w of this.ondes) {
      if (w.t >= w.duree) {
        w.mesh.visible = false;
        continue;
      }
      w.t += dt;
      const k = w.t / w.duree;
      w.mesh.scale.setScalar(0.2 + (1 - (1 - k) ** 3) * w.taille);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
    this.lumineux.maj(dt, temps);
    this.mats.maj(dt, temps);
  }

  pas(pos: THREE.Vector3, up: THREE.Vector3, sol: "mort" | "herbe" | "eau") {
    const n = sol === "mort" ? 4 : sol === "eau" ? 5 : 1;
    for (let k = 0; k < n; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(0.6).addScaledVector(up, 0.4 + Math.random() * 0.5);
      if (sol === "eau") {
        this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.05), vel: v.multiplyScalar(2), couleur: new THREE.Color(0.5, 0.75, 0.9).multiplyScalar(0.7), taille: 0.05, vie: 0.5, gravite: 8 });
      } else if (sol === "mort") {
        this.mats.emettre({ pos: pos.clone().addScaledVector(up, 0.05), vel: v, couleur: new THREE.Color(0.62, 0.6, 0.57), taille: 0.12, vie: 0.8, frein: 3, gravite: 0.5 });
      } else {
        this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.2), vel: v.multiplyScalar(0.5), couleur: new THREE.Color(0.8, 1, 0.4).multiplyScalar(0.5), taille: 0.05, vie: 1.2, flotte: 0.2 });
      }
    }
  }

  ramasser(pos: THREE.Vector3) {
    for (let k = 0; k < 40; k++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 2.5);
      this.lumineux.emettre({ pos, vel: v, couleur: new THREE.Color(1, 0.8, 0.35).multiplyScalar(1.4), taille: 0.08, vie: 0.6 + Math.random() * 0.6, frein: 2.5 });
    }
  }

  planter(pos: THREE.Vector3, up: THREE.Vector3) {
    this.onde(pos, up, 0x9be15d, 2.4, 0.9);
    for (let k = 0; k < 50; k++) {
      const t = tangenteAleatoire(up);
      const v = t.multiplyScalar(0.5 + Math.random() * 1.5).addScaledVector(up, 1 + Math.random() * 2.5);
      this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.1), vel: v, couleur: new THREE.Color(0.75, 1, 0.4).multiplyScalar(1.2), taille: 0.07, vie: 1 + Math.random(), frein: 1.5, flotte: 0.3 });
    }
    for (let k = 0; k < 14; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(1 + Math.random()).addScaledVector(up, 1.5 + Math.random() * 2);
      this.mats.emettre({ pos: pos.clone(), vel: v, couleur: new THREE.Color(0.38, 0.27, 0.18), taille: 0.09, vie: 0.8, gravite: 9 });
    }
  }

  creuser(pos: THREE.Vector3, up: THREE.Vector3, humide: boolean) {
    const n = 2;
    for (let k = 0; k < n; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(0.8 + Math.random() * 1.2).addScaledVector(up, 2 + Math.random() * 2.5);
      const c = humide ? new THREE.Color(0.32, 0.22, 0.14) : new THREE.Color(0.5, 0.47, 0.43);
      this.mats.emettre({ pos: pos.clone().addScaledVector(up, 0.15), vel: v, couleur: c, taille: 0.1 + Math.random() * 0.06, vie: 0.9, gravite: 10 });
    }
  }

  source(pos: THREE.Vector3, up: THREE.Vector3) {
    this.onde(pos, up, 0x8ff0ff, 9, 2.2);
    this.onde(pos, up, 0xe0fdff, 5, 1.4);
    for (let k = 0; k < 220; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(Math.random() * 3).addScaledVector(up, 4 + Math.random() * 9);
      this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.5), vel: v, couleur: new THREE.Color(0.55, 0.9, 1).multiplyScalar(1.3), taille: 0.1, vie: 1.5 + Math.random() * 1.5, gravite: 6, frein: 0.3 });
    }
  }

  arbreAdulte(pos: THREE.Vector3, up: THREE.Vector3) {
    for (let k = 0; k < 30; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(0.8 + Math.random()).addScaledVector(up, Math.random());
      this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 2 + Math.random()), vel: v, couleur: new THREE.Color(1, 0.95, 0.6), taille: 0.06, vie: 2, flotte: 0.4, frein: 1 });
    }
  }

  souffle(pos: THREE.Vector3, up: THREE.Vector3) {
    this.onde(pos, up, 0xfff3c8, REGLAGES.souffle.rayon, 1.1);
    this.onde(pos, up, 0x9be15d, REGLAGES.souffle.rayon * 0.6, 0.8);
    for (let k = 0; k < 120; k++) {
      const t = tangenteAleatoire(up);
      const v = t.multiplyScalar(4 + Math.random() * 4).addScaledVector(up, Math.random() * 1.5);
      this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.4), vel: v, couleur: new THREE.Color(1, 0.95, 0.7).multiplyScalar(1.2), taille: 0.08, vie: 0.9, frein: 2.5 });
    }
  }

  atterrir(pos: THREE.Vector3, up: THREE.Vector3, mort: boolean) {
    for (let k = 0; k < 10; k++) {
      const v = tangenteAleatoire(up).multiplyScalar(1.5).addScaledVector(up, 0.3);
      if (mort) this.mats.emettre({ pos: pos.clone().addScaledVector(up, 0.05), vel: v, couleur: new THREE.Color(0.62, 0.6, 0.57), taille: 0.12, vie: 0.7, frein: 3 });
      else this.lumineux.emettre({ pos: pos.clone().addScaledVector(up, 0.1), vel: v, couleur: new THREE.Color(0.8, 1, 0.4).multiplyScalar(0.6), taille: 0.05, vie: 0.8, frein: 3 });
    }
  }

  /** Grande gerbe de la fin : pétales et lumières tout autour de la planète. */
  feuDArtifice() {
    for (let k = 0; k < 500; k++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const p = this.monde.surface(dir, new THREE.Vector3(), 0.3);
      const v = dir.clone().multiplyScalar(2 + Math.random() * 4).addScaledVector(tangenteAleatoire(dir), Math.random());
      const c = [new THREE.Color(1, 0.8, 0.4), new THREE.Color(0.7, 1, 0.5), new THREE.Color(1, 0.6, 0.8), new THREE.Color(0.6, 0.9, 1)][k % 4];
      this.lumineux.emettre({ pos: p, vel: v, couleur: c.multiplyScalar(1.3), taille: 0.35, vie: 3 + Math.random() * 3, frein: 0.6, flotte: 0.5 });
    }
  }

  placerCurseur(pos: THREE.Vector3, up: THREE.Vector3, etat: "ok" | "non" | "rien", temps: number) {
    const c = this.curseur;
    c.visible = etat !== "rien";
    if (!c.visible) return;
    c.position.copy(pos).addScaledVector(up, 0.06);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    const mat = c.material as THREE.MeshBasicMaterial;
    mat.color.set(etat === "ok" ? 0x9be15d : 0x8a8a8a);
    mat.opacity = etat === "ok" ? 0.55 + Math.sin(temps * 5) * 0.2 : 0.25;
    c.scale.setScalar(1 + Math.sin(temps * 5) * 0.05);
  }
}
