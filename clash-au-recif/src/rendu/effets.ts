// Les effets : éclats d'impact, lignes de choc, poussière, éclaboussures, explosion d'éjection.
import * as THREE from "three";
import { ellipsoide, etoile } from "./formes";
import { matToon, piece } from "./toon";

interface Particule {
  objet: THREE.Object3D;
  vie: number;
  duree: number;
  maj: (t: number, dt: number, p: Particule) => void;
  vx?: number;
  vy?: number;
}

const ETOILES = Array.from({ length: 4 }, (_, i) => etoile(10 + i, 1, 0.42, 0.35, i * 13 + 5));
const ANNEAU = new THREE.RingGeometry(0.8, 1, 40);
const TRAIT = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -0.5, 0, 1, 0, 0, 0, 0.5, 0], 3));
  return g;
})();
const BOULE = ellipsoide(1, 1, 1, 14, 10);

const basique = (couleur: THREE.ColorRepresentation, opacite = 1, additif = false) =>
  new THREE.MeshBasicMaterial({
    color: couleur,
    transparent: true,
    opacity: opacite,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additif ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

export class Effets {
  readonly groupe = new THREE.Group();
  private particules: Particule[] = [];
  private readonly fumee = matToon("#ffffff", { ombre: "#b7c3e6", trame: 0.6, rim: 0 });
  private readonly eau = matToon("#e9fbff", { ombre: "#5fb7e6", trame: 0, rim: 0 });

  private ajouter(objet: THREE.Object3D, duree: number, maj: Particule["maj"], extra: Partial<Particule> = {}) {
    this.groupe.add(objet);
    this.particules.push({ objet, vie: 0, duree, maj, ...extra });
  }

  /** L'éclat d'un coup qui porte. */
  impact(x: number, y: number, force: number, lourd: boolean, couleur: THREE.ColorRepresentation, garde: boolean) {
    const taille = garde ? 0.7 : 0.6 + Math.min(force, 60) / 45;
    const forme = ETOILES[Math.floor(Math.random() * ETOILES.length)];
    const rot = Math.random() * Math.PI;
    // Encre noire derrière, puis blanc, puis le cœur coloré.
    const couches: [THREE.ColorRepresentation, number, number][] = garde
      ? [["#1b1220", 1.12, 0.02], ["#bfe8ff", 1, 0.03]]
      : [
          ["#1b1220", 1.15, 0.02],
          ["#ffffff", 1, 0.03],
          [lourd ? "#ff3b2f" : "#ffd23a", 0.55, 0.04],
        ];
    for (const [c, s, z] of couches) {
      const m = new THREE.Mesh(forme, basique(c));
      m.position.set(x, y, 0.8 + z);
      m.rotation.z = rot;
      this.ajouter(m, lourd ? 14 : 9, (t) => {
        const k = t < 0.25 ? t / 0.25 : 1 + (t - 0.25) * 0.4;
        m.scale.setScalar(taille * s * k * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1));
        m.rotation.z = rot + t * 0.3;
      });
    }
    // Lignes de choc qui s'éloignent du point d'impact
    const n = garde ? 6 : lourd ? 16 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const l = taille * (0.8 + Math.random() * 1.2);
      const m = new THREE.Mesh(TRAIT, basique(i % 3 === 0 ? "#1b1220" : "#ffffff"));
      m.rotation.z = a;
      m.position.set(x, y, 0.85);
      this.ajouter(m, lourd ? 16 : 11, (t) => {
        const d = taille * 0.4 + t * taille * 2.2;
        m.position.set(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.85);
        m.scale.set(l * (1 - t), 0.08 * taille * (1 - t * 0.5), 1);
      });
    }
    // L'onde de choc
    const anneau = new THREE.Mesh(ANNEAU, basique(garde ? "#bfe8ff" : "#ffffff", 0.9));
    anneau.position.set(x, y, 0.75);
    this.ajouter(anneau, lourd ? 20 : 12, (t) => {
      anneau.scale.setScalar(taille * (0.4 + t * 2.4));
      (anneau.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    });
    if (lourd && !garde) {
      for (let i = 0; i < 8; i++) this.etincelle(x, y, couleur);
    }
  }

  private etincelle(x: number, y: number, couleur: THREE.ColorRepresentation) {
    const m = new THREE.Mesh(BOULE, basique(couleur, 1, true));
    const a = Math.random() * Math.PI * 2;
    const v = 6 + Math.random() * 10;
    m.position.set(x, y, 0.9);
    this.ajouter(
      m,
      18 + Math.random() * 10,
      (t, dt, p) => {
        p.vy! -= 30 * dt;
        m.position.x += p.vx! * dt;
        m.position.y += p.vy! * dt;
        m.scale.set(0.12 * (1 - t) + 0.02, 0.05, 0.05);
        m.rotation.z = Math.atan2(p.vy!, p.vx!);
        m.scale.x = 0.25 * (1 - t) + 0.03;
      },
      { vx: Math.cos(a) * v, vy: Math.sin(a) * v },
    );
  }

  /** Des bouffées de poussière (course, saut, atterrissage). */
  poussiere(x: number, y: number, dir: number, taille = 1, nombre = 3) {
    for (let i = 0; i < nombre; i++) {
      const b = piece(BOULE, this.fumee, 0.8, { trait: "#55607e" });
      const vx = (-dir * (0.5 + Math.random()) + (Math.random() - 0.5) * 2) * taille;
      const r = (0.12 + Math.random() * 0.12) * taille;
      b.position.set(x + (Math.random() - 0.5) * 0.3, y + r * 0.6, (Math.random() - 0.3) * 0.6);
      this.ajouter(
        b,
        22 + Math.random() * 10,
        (t, dt, p) => {
          b.position.x += p.vx! * dt;
          b.position.y += p.vy! * dt;
          b.scale.setScalar(r * (t < 0.2 ? 0.5 + t * 2.5 : 1 - (t - 0.2) / 0.8) + 0.001);
        },
        { vx, vy: 0.6 * taille },
      );
    }
  }

  /** L'anneau d'air d'un double saut. */
  anneauSaut(x: number, y: number) {
    const a = new THREE.Mesh(ANNEAU, basique("#ffffff", 0.9));
    a.position.set(x, y, 0);
    a.rotation.x = -Math.PI / 2 + 0.25;
    this.ajouter(a, 14, (t) => {
      a.scale.setScalar(0.3 + t * 0.9);
      (a.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    });
  }

  /** La traînée de fumée d'un perso éjecté. */
  trainee(x: number, y: number, taille: number) {
    const b = piece(BOULE, this.fumee, 0.8, { trait: "#55607e" });
    b.position.set(x, y, -0.2);
    const r = 0.18 + taille * 0.25;
    this.ajouter(b, 30, (t) => b.scale.setScalar(r * (1 - t) + 0.001));
  }

  /** Une gerbe d'eau quand un perso tombe dans la mer. */
  eclaboussure(x: number, y: number) {
    for (let i = 0; i < 16; i++) {
      const b = piece(BOULE, this.eau, 0.8, { trait: "#2a6f9e" });
      const a = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const v = 9 + Math.random() * 9;
      const r = 0.25 + Math.random() * 0.35;
      b.position.set(x + (Math.random() - 0.5), y, (Math.random() - 0.5) * 2);
      this.ajouter(
        b,
        40,
        (t, dt, p) => {
          p.vy! -= 32 * dt;
          b.position.x += p.vx! * dt;
          b.position.y += p.vy! * dt;
          b.scale.setScalar(r * (1 - t * 0.7));
        },
        { vx: Math.cos(a) * v, vy: Math.sin(a) * v },
      );
    }
    const anneau = new THREE.Mesh(ANNEAU, basique("#ffffff", 0.9));
    anneau.rotation.x = -Math.PI / 2;
    anneau.position.set(x, y + 0.05, 0);
    this.ajouter(anneau, 40, (t) => {
      anneau.scale.setScalar(0.5 + t * 4);
      (anneau.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    });
  }

  /** L'explosion d'une éjection : un grand rayon coloré qui part du bord de l'écran. */
  ko(x: number, y: number, versCentre: THREE.Vector2, couleur: THREE.ColorRepresentation) {
    const angle = Math.atan2(versCentre.y, versCentre.x);
    for (const [c, largeur, z] of [
      [couleur, 3.2, 0],
      ["#ffffff", 1.4, 0.05],
    ] as const) {
      const g = new THREE.ConeGeometry(largeur, 28, 24, 1, true);
      g.translate(0, -14, 0);
      const m = new THREE.Mesh(g, basique(c, 0.95, c !== "#ffffff"));
      m.position.set(x, y, z);
      m.rotation.z = angle - Math.PI / 2 + Math.PI;
      this.ajouter(m, 50, (t) => {
        const ouverture = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        m.scale.set(ouverture, 0.6 + t * 0.6, ouverture);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.95 * ouverture;
      });
    }
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(ETOILES[i], basique(i === 0 ? "#1b1220" : i === 1 ? "#ffffff" : couleur));
      s.position.set(x, y, 1 + i * 0.02);
      const base = [5, 4.4, 2.5][i];
      this.ajouter(s, 30, (t) => {
        s.scale.setScalar(base * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) + 0.001);
        s.rotation.z = t * 0.6;
      });
    }
    for (let i = 0; i < 24; i++) this.etincelle(x, y, couleur);
  }

  /** Les étoiles qui tournent au-dessus de la tête d'un perso sonné. */
  etoilesTete(x: number, y: number, temps: number) {
    for (let i = 0; i < 3; i++) {
      const a = temps * 4 + (i / 3) * Math.PI * 2;
      const s = new THREE.Mesh(ETOILES[0], basique("#ffe14a"));
      s.position.set(x + Math.cos(a) * 0.45, y + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45);
      s.scale.setScalar(0.13);
      this.ajouter(s, 1, () => {});
    }
  }

  /** Un trait de vent (lame de Rin, course rapide). */
  vent(x: number, y: number, dir: number, longueur: number) {
    const m = new THREE.Mesh(TRAIT, basique("#ffffff", 0.9));
    m.position.set(x, y, 0.5 + Math.random() * 0.4);
    m.rotation.z = dir > 0 ? Math.PI : 0;
    this.ajouter(m, 12, (t) => {
      m.scale.set(longueur * (1 - t), 0.06, 1);
      m.position.x += dir * 0.02;
    });
  }

  mettreAJour(dt: number) {
    const restantes: Particule[] = [];
    for (const p of this.particules) {
      p.vie += dt * 60;
      const t = Math.min(1, p.vie / p.duree);
      p.maj(t, dt, p);
      if (p.vie >= p.duree) {
        this.groupe.remove(p.objet);
        p.objet.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m && (m as THREE.MeshBasicMaterial).isMeshBasicMaterial) m.dispose();
        });
      } else restantes.push(p);
    }
    this.particules = restantes;
  }

  vider() {
    for (const p of this.particules) this.groupe.remove(p.objet);
    this.particules = [];
  }
}
