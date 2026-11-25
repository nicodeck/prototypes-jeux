// Veilleuse : une petite silhouette encapuchonnée, deux yeux qui luisent dans l'ombre du capuchon,
// et une lanterne au bout d'un bâton, qui se balance comme un pendule. La cape ondule, la pointe
// du capuchon traîne derrière, tout s'écrase un peu à l'atterrissage.
import * as THREE from "three";
import type { Heros } from "../monde/monde";
import { creerHalo } from "./materiaux";
import type { Lumiere } from "./lumieres";

const FLAMME = new THREE.Color("#ffc27a");

/** Une forme en éventail autour d'un centre, dont on déplace les points à chaque image. */
function forme(n: number, couleur: (x: number, y: number, c: THREE.Color) => void, mat: THREE.Material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((n + 1) * 3);
  const col = new Float32Array((n + 1) * 3);
  const index: number[] = [];
  for (let i = 0; i < n; i++) index.push(0, 1 + i, 1 + ((i + 1) % n));
  geo.setIndex(index);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const c = new THREE.Color();
  return {
    mesh,
    poser(centre: [number, number], points: [number, number][]) {
      pos[0] = centre[0];
      pos[1] = centre[1];
      couleur(centre[0], centre[1], c);
      col[0] = c.r;
      col[1] = c.g;
      col[2] = c.b;
      points.forEach(([x, y], i) => {
        pos[(i + 1) * 3] = x;
        pos[(i + 1) * 3 + 1] = y;
        couleur(x, y, c);
        col[(i + 1) * 3] = c.r;
        col[(i + 1) * 3 + 1] = c.g;
        col[(i + 1) * 3 + 2] = c.b;
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

function capsule(l: number, h: number, couleur: THREE.Color) {
  const forme = new THREE.Shape();
  const r = l / 2;
  forme.moveTo(-r, h - r);
  forme.absarc(0, h - r, r, Math.PI, 0, true);
  forme.lineTo(r, r);
  forme.absarc(0, r, r, 0, Math.PI, true);
  forme.closePath();
  return new THREE.Mesh(new THREE.ShapeGeometry(forme, 6), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthTest: false }));
}

export function creerHeros() {
  const groupe = new THREE.Group();
  const corpsGroupe = new THREE.Group();
  groupe.add(corpsGroupe);
  const matFond = { transparent: true, depthTest: false, depthWrite: false, vertexColors: true, side: THREE.DoubleSide } as const;

  const sombre = new THREE.Color("#0c101c");
  const clair = new THREE.Color("#1f2a46");
  const chaud = new THREE.Color("#7a4e32");
  const N = 24;
  const cape = forme(
    N,
    (x, y, c) => {
      c.copy(sombre).lerp(clair, Math.min(1, Math.max(0, (y - 0.1) / 1.2)) * 0.7);
      c.lerp(chaud, Math.max(0, Math.min(1, (x + 0.05) * 1.6)) * Math.max(0, Math.min(1, 1.2 - y * 0.6)) * 0.55);
    },
    new THREE.MeshBasicMaterial(matFond),
  );
  const lisere = forme(N, (_x, _y, c) => c.set("#8fa2c8").multiplyScalar(0.13), new THREE.MeshBasicMaterial(matFond));
  const visage = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color("#030305"), transparent: true, depthTest: false }));
  visage.scale.set(1.05, 0.88, 1);
  const oeil = () => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(3.2), transparent: true, depthTest: false }));
    m.scale.set(0.8, 1.15, 1);
    return m;
  };
  const oeilG = oeil();
  const oeilD = oeil();
  const jambeCouleur = new THREE.Color("#0d1018");
  const jambeG = capsule(0.11, 0.26, jambeCouleur);
  const jambeD = capsule(0.11, 0.26, jambeCouleur);
  const baton = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.62), new THREE.MeshBasicMaterial({ color: new THREE.Color("#2b1d14"), transparent: true, depthTest: false }));
  baton.geometry.translate(0, 0.31, 0);

  // La lanterne : une cage, une flamme, deux halos
  const lanterne = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color("#120e0b"), transparent: true, depthTest: false }));
  cage.position.y = -0.13;
  const verre = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.15), new THREE.MeshBasicMaterial({ color: FLAMME.clone().multiplyScalar(2.5), transparent: true, depthTest: false }));
  verre.position.y = -0.13;
  const flamme = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2d0").multiplyScalar(7), transparent: true, depthTest: false }));
  flamme.scale.set(1, 1.6, 1);
  flamme.position.y = -0.13;
  const anse = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color("#120e0b"), transparent: true, depthTest: false }));
  anse.position.y = -0.01;
  lanterne.add(anse, cage, verre, flamme);
  const halo = creerHalo(5.5, FLAMME.clone().multiplyScalar(0.55), -24);
  const petitHalo = creerHalo(1.1, FLAMME.clone().multiplyScalar(1.2), -19);

  lisere.mesh.renderOrder = -23;
  for (const m of [jambeG, jambeD]) m.renderOrder = -22;
  cape.mesh.renderOrder = -21;
  baton.renderOrder = -20.5;
  visage.renderOrder = -20;
  oeilG.renderOrder = oeilD.renderOrder = -19.5;
  for (const m of lanterne.children) m.renderOrder = -19;
  corpsGroupe.add(lisere.mesh, jambeG, jambeD, cape.mesh, visage, oeilG, oeilD, baton, lanterne);
  groupe.add(halo, petitHalo);

  const lumiere: Lumiere = { x: 0, y: 0, rayon: 7.5, couleur: FLAMME.clone(), intensite: 1.4 };

  // L'état de l'animation
  let regard = 1;
  let course = 0;
  let ecrase = 0;
  let vEcrase = 0;
  let angle = 0;
  let vAngle = 0;
  let vxAvant = 0;
  const pointe = new THREE.Vector2(-0.5, 1.15);
  const vPointe = new THREE.Vector2();
  let clignement = 2;
  let tempsArret = 0;

  const points: [number, number][] = [];
  const contour: [number, number][] = [];

  return {
    groupe,
    lumiere,
    /** Position de la lanterne dans le monde */
    lanterne: new THREE.Vector2(),
    atterrir(force: number) {
      vEcrase -= 3 + force * 9;
    },
    sauter() {
      vEcrase += 5;
    },
    mettreAJour(dt: number, temps: number, h: Heros, x: number, y: number) {
      const vx = (h.vx * 60) / 16;
      const vy = (-h.vy * 60) / 16;
      groupe.position.set(x, y, 0);

      // Le regard : à l'opposé de la paroi pendant une glissade
      const cible = h.mur !== 0 ? -h.mur : h.regard;
      regard += (cible - regard) * Math.min(1, dt * 18);
      corpsGroupe.scale.x = Math.abs(regard) < 0.15 ? 0.15 * Math.sign(regard || 1) : regard;

      // L'écrasement, comme un ressort
      vEcrase += (-ecrase * 180 - vEcrase * 14) * dt;
      ecrase += vEcrase * dt;
      const e = Math.max(-0.3, Math.min(0.25, ecrase));
      const respire = h.auSol && Math.abs(vx) < 0.5 ? Math.sin(temps * 2.2) * 0.015 : 0;
      corpsGroupe.scale.y = 1 + e + respire;
      corpsGroupe.scale.x *= 1 - e * 0.6;

      // La course
      const vitesse = Math.abs(vx);
      if (h.auSol && vitesse > 0.3) {
        course += dt * vitesse * 2.6;
        tempsArret = 0;
      } else tempsArret += dt;
      const pas = h.auSol && vitesse > 0.3 ? Math.sin(course * Math.PI) : 0;
      const rebond = h.auSol ? Math.abs(pas) * 0.05 : 0;
      corpsGroupe.position.y = rebond;
      corpsGroupe.rotation.z = -vx * 0.035 * (h.dansEau ? 0.3 : 1);
      if (h.dansEau) corpsGroupe.rotation.z += Math.sin(temps * 2) * 0.05;

      // Les jambes
      const enLAir = !h.auSol && !h.dansEau;
      const nage = h.dansEau ? Math.sin(temps * 8) : 0;
      jambeG.position.set(-0.1 + pas * 0.1, (enLAir ? 0.08 : 0) + Math.max(0, pas) * 0.07 + nage * 0.04, 0);
      jambeD.position.set(0.1 - pas * 0.1, (enLAir ? 0.12 : 0) + Math.max(0, -pas) * 0.07 - nage * 0.04, 0);
      jambeG.rotation.z = enLAir ? 0.3 : pas * 0.3;
      jambeD.rotation.z = enLAir ? -0.2 : -pas * 0.3;

      // La pointe du capuchon : un ressort qui traîne derrière
      const cibleX = -0.42 - Math.min(0.25, vitesse * 0.03);
      const cibleY = 1.12 - (vy > 0 ? -0.1 : Math.min(0.25, -vy * 0.02)) + Math.sin(temps * 1.7) * 0.02;
      vPointe.x += ((cibleX - pointe.x) * 90 - vPointe.x * 9) * dt;
      vPointe.y += ((cibleY - pointe.y) * 90 - vPointe.y * 9) * dt;
      pointe.x += vPointe.x * dt;
      pointe.y += vPointe.y * dt;

      // La cape : un contour qui ondule, surtout en bas
      const flotte = h.dansEau ? 0.06 : enLAir ? Math.min(0.12, Math.abs(vy) * 0.01) : Math.min(0.05, vitesse * 0.01);
      const ourlet = (i: number, n: number) => {
        const t = i / n;
        return Math.sin(temps * 7 + t * 9 + course) * (0.012 + flotte * 0.5) + (vy < 0 ? -flotte * 0.4 : flotte) * Math.sin(t * Math.PI);
      };
      points.length = 0;
      const nb = 9;
      for (let i = 0; i <= nb; i++) {
        const t = i / nb;
        points.push([0.4 - t * 0.82 - (enLAir ? vx * 0.006 : 0), 0.13 + ourlet(i, nb) + (t > 0.85 ? 0.02 : 0)]);
      }
      const traine = Math.min(0.12, vitesse * 0.018);
      points.push([-0.38 - traine, 0.42]);
      points.push([-0.3 - traine * 0.5, 0.72]);
      points.push([-0.27, 0.9]);
      points.push([-0.33, 1.02]);
      points.push([pointe.x, pointe.y]);
      points.push([-0.24, 1.18]);
      points.push([-0.1, 1.3]);
      points.push([0.06, 1.33]);
      points.push([0.2, 1.27]);
      points.push([0.29, 1.12]);
      points.push([0.31, 0.95]);
      points.push([0.25, 0.86]);
      points.push([0.29, 0.72]);
      points.push([0.36, 0.45]);
      const centre: [number, number] = [0, 0.65];
      cape.poser(centre, points);
      contour.length = 0;
      for (const [px, py] of points) {
        const dx = px - centre[0];
        const dy = py - centre[1];
        const d = Math.hypot(dx, dy) || 1;
        contour.push([px + (dx / d) * 0.035, py + (dy / d) * 0.035]);
      }
      lisere.poser(centre, contour);

      // Le visage et les yeux qui clignent
      visage.position.set(0.1, 1.04, 0);
      clignement -= dt;
      const ferme = clignement < 0.12 ? 0.1 : 1;
      if (clignement < 0) clignement = 2.5 + Math.random() * 3.5;
      oeilG.position.set(0.04, 1.04, 0);
      oeilD.position.set(0.17, 1.045, 0);
      oeilG.scale.y = oeilD.scale.y = 1.15 * ferme;
      // Après un long moment immobile, Veilleuse regarde sa lanterne
      const regardeLanterne = tempsArret > 5 ? Math.min(1, (tempsArret - 5) * 2) : 0;
      oeilG.position.x += regardeLanterne * 0.04;
      oeilD.position.x += regardeLanterne * 0.03;
      oeilG.position.y -= regardeLanterne * 0.02;
      oeilD.position.y -= regardeLanterne * 0.02;

      // Le bâton et la lanterne, en pendule
      const leve = h.dansEau ? 0.35 : enLAir ? 0.15 : regardeLanterne * 0.1;
      baton.position.set(0.2, 0.52, 0);
      baton.rotation.z = -0.55 + leve - Math.sin(course * Math.PI) * 0.06;
      const bout = new THREE.Vector2(0.2 + Math.sin(-baton.rotation.z) * 0.62, 0.52 + Math.cos(baton.rotation.z) * 0.62);
      const ax = (vx - vxAvant) / Math.max(dt, 1e-3);
      vxAvant = vx;
      const L = 0.22;
      vAngle += (-(9.8 / L) * Math.sin(angle) - (ax * Math.sign(regard) * Math.cos(angle)) / L * 0.25 - vAngle * 2.2) * dt;
      angle += vAngle * dt;
      angle = Math.max(-1.2, Math.min(1.2, angle));
      lanterne.position.set(bout.x, bout.y, 0);
      lanterne.rotation.z = angle;
      const lx = bout.x + Math.sin(angle) * 0.13;
      const ly = bout.y - Math.cos(angle) * 0.13;

      // La lumière, qui vacille
      const sx = groupe.position.x + lx * corpsGroupe.scale.x;
      const sy = groupe.position.y + (ly + corpsGroupe.position.y) * corpsGroupe.scale.y;
      const vacille = 0.92 + 0.05 * Math.sin(temps * 11) + 0.04 * Math.sin(temps * 27.3) + 0.03 * Math.sin(temps * 4.1);
      lumiere.x = sx;
      lumiere.y = sy;
      lumiere.intensite = 1.45 * vacille;
      halo.position.set(lx * corpsGroupe.scale.x, ly * corpsGroupe.scale.y + corpsGroupe.position.y, 0);
      petitHalo.position.copy(halo.position);
      (halo.material as THREE.MeshBasicMaterial).color.copy(FLAMME).multiplyScalar(0.45 * vacille);
      (flamme.material as THREE.MeshBasicMaterial).color.set("#fff2d0").multiplyScalar(6 * vacille);
      this.lanterne.set(sx, sy);
    },
  };
}
