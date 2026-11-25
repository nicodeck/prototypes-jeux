// Balises sur les récifs (elles s'allument quand le phare précédent est rallumé)
// et tonneaux d'huile à la dérive, signalés par une petite lueur.

import * as THREE from "three";
import { Balise, Rocher, Tonneau } from "../monde/archipel";
import { hauteurMer } from "../monde/vagues";
import { creerLueur, creerRefletEau } from "./lueur";

interface BaliseVisuelle {
  def: Balise;
  lueur: THREE.Sprite;
  reflet: THREE.Sprite;
  verre: THREE.MeshBasicMaterial;
  phase: number;
  active: number; // 0..1
}

interface TonneauVisuel {
  def: Tonneau;
  groupe: THREE.Group;
  lueur: THREE.Sprite;
  reflet: THREE.Sprite;
  pris: number; // animation de ramassage
}

export class Balises {
  groupe = new THREE.Group();
  private balises: BaliseVisuelle[] = [];
  private tonneaux: TonneauVisuel[] = [];

  constructor(balises: Balise[], rochers: Rocher[], tonneaux: Tonneau[]) {
    const fer = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.5, metalness: 0.6 });
    const peinture = new THREE.MeshStandardMaterial({ color: 0x5a0d08, roughness: 0.6 });
    for (const b of balises) {
      // on la pose sur le plus haut rocher de l'amas
      let haut = 0;
      for (const r of rochers) if (Math.hypot(r.x - b.x, r.z - b.z) < 4 && r.h > haut) haut = r.h;
      const g = new THREE.Group();
      g.position.set(b.x, haut - 0.3, b.z);
      const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 6), peinture);
      mat.position.y = 1.6;
      g.add(mat);
      const voyant = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.01, 0.01) });
      const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), voyant);
      lampe.position.y = 3.4;
      g.add(lampe);
      const toit = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 8), fer);
      toit.position.y = 3.75;
      g.add(toit);
      const lueur = creerLueur(new THREE.Color(1, 0.12, 0.06), 6);
      lueur.position.y = 3.4;
      g.add(lueur);
      const reflet = creerRefletEau(new THREE.Color(0.8, 0.08, 0.03), 1.4, haut + 6);
      reflet.position.set(b.x, 0.1, b.z);
      this.groupe.add(g, reflet);
      this.balises.push({ def: b, lueur, reflet, verre: voyant, phase: Math.random() * 4, active: 0 });
    }

    const profil: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      profil.push(new THREE.Vector2(0.42 + Math.sin(t * Math.PI) * 0.1, (t - 0.5) * 1.2));
    }
    const geoTonneau = new THREE.LatheGeometry(profil, 14);
    const bois = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.17, 0.08), roughness: 0.55 });
    const cercle = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.4, metalness: 0.7 });
    for (const t of tonneaux) {
      const g = new THREE.Group();
      const corps = new THREE.Mesh(geoTonneau, bois);
      corps.rotation.z = Math.PI / 2;
      g.add(corps);
      for (const dx of [-0.38, 0.38]) {
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 5, 16), cercle);
        c.rotation.y = Math.PI / 2;
        c.position.x = dx;
        g.add(c);
      }
      // petite lanterne de repérage sur un flotteur
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), cercle);
      tige.position.y = 0.9;
      g.add(tige);
      const lueur = creerLueur(new THREE.Color(1, 0.62, 0.22), 4);
      lueur.position.y = 1.5;
      g.add(lueur);
      const reflet = creerRefletEau(new THREE.Color(0.9, 0.45, 0.12), 1.1, 6);
      this.groupe.add(g, reflet);
      this.tonneaux.push({ def: t, groupe: g, lueur, reflet, pris: 0 });
    }
  }

  maj(dt: number, temps: number, actives: (troncon: number) => boolean, pris: boolean[], ampli: number) {
    for (const b of this.balises) {
      b.active = Math.min(1, Math.max(0, b.active + (actives(b.def.troncon) ? dt : -dt)));
      const cycle = (temps + b.phase) % 3.2;
      const eclat = (cycle < 0.25 ? 1 : cycle > 0.55 && cycle < 0.8 ? 1 : 0.06) * b.active;
      b.lueur.visible = eclat > 0.01;
      b.lueur.scale.setScalar(4 + eclat * 6);
      (b.lueur.material as THREE.SpriteMaterial).opacity = eclat;
      b.verre.color.setRGB(0.05 + eclat * 9, 0.01 + eclat * 0.8, 0.01 + eclat * 0.3);
      b.reflet.visible = eclat > 0.01;
      (b.reflet.material as THREE.SpriteMaterial).opacity = eclat * 0.5;
    }
    this.tonneaux.forEach((t, i) => {
      if (pris[i]) t.pris = Math.min(1, t.pris + dt * 1.5);
      const g = t.groupe;
      g.visible = t.pris < 1;
      t.reflet.visible = g.visible;
      if (!g.visible) return;
      const h = hauteurMer(t.def.x, t.def.z, temps, ampli);
      g.position.set(t.def.x, h - 0.1 + t.pris * 2, t.def.z);
      g.rotation.set(Math.sin(temps * 1.3 + i) * 0.25, temps * 0.1 + i, Math.sin(temps * 1.1 + i * 2) * 0.2);
      g.scale.setScalar(1 - t.pris);
      const p = 0.65 + 0.35 * Math.sin(temps * 3 + i);
      t.lueur.scale.setScalar((3 + p * 3) * (1 + t.pris * 3));
      (t.lueur.material as THREE.SpriteMaterial).opacity = p * (1 - t.pris);
      t.reflet.position.set(t.def.x, h + 0.05, t.def.z);
      (t.reflet.material as THREE.SpriteMaterial).opacity = p * 0.4 * (1 - t.pris);
    });
  }
}
