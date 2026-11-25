// Les objets de la mine : lanternes, cristaux, le Cœur, chaînes, étais, wagonnets, planches,
// rais de lumière, herbes et racines qui ondulent.
import * as THREE from "three";
import { PLANCHE, ROCHE, caseEn, type Mine, type Objet } from "../monde/mine";
import { graine } from "./bruit";
import { GLSL_LUMIERES, LUMIERES, type Lumiere } from "./lumieres";
import { creerHalo, materiauEclaire, texturePeinte } from "./materiaux";

const CHAUD = new THREE.Color("#ffad5a");

/** Le premier rocher au-dessus d'une case (ligne), ou la case elle-même. */
function plafond(mine: Mine, col: number, ligne: number) {
  let l = ligne - 1;
  while (l > 0 && caseEn(mine, col, l) !== ROCHE) l--;
  return l + 1;
}

function sol(mine: Mine, col: number, ligne: number) {
  let l = ligne;
  while (l < mine.hauteur && caseEn(mine, col, l) !== ROCHE && caseEn(mine, col, l) !== PLANCHE) l++;
  return l;
}

// ——— Les textures peintes ———

function bois(c: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, base: string, seed: number) {
  const r = graine(seed);
  c.fillStyle = base;
  c.fillRect(x, y, l, h);
  c.globalAlpha = 0.35;
  for (let i = 0; i < (l * h) / 40; i++) {
    c.fillStyle = r.suivant() < 0.5 ? "#000" : "#a07850";
    const vertical = h > l;
    if (vertical) c.fillRect(x + r.entre(0, l), y + r.entre(0, h), 1, r.entre(4, 20));
    else c.fillRect(x + r.entre(0, l), y + r.entre(0, h), r.entre(4, 24), 1);
  }
  c.globalAlpha = 1;
}

const texPlanche = () =>
  texturePeinte(64, 32, (c) => {
    bois(c, 0, 2, 64, 12, "#4a3424", 3);
    c.fillStyle = "#1d130c";
    c.fillRect(0, 14, 64, 3);
    c.fillRect(31, 2, 2, 12);
    c.fillStyle = "#8a8070";
    c.fillRect(4, 6, 2, 2);
    c.fillRect(58, 6, 2, 2);
    c.fillStyle = "#c9ad86";
    c.fillRect(0, 2, 64, 2);
  });

const texEtai = () =>
  texturePeinte(32, 64, (c) => {
    bois(c, 6, 0, 20, 64, "#3e2b1d", 5);
    c.fillStyle = "#20160e";
    c.fillRect(6, 0, 3, 64);
    c.fillRect(23, 0, 3, 64);
  });

const texWagonnet = () =>
  texturePeinte(128, 84, (c) => {
    // La caisse, un peu penchée, rouillée
    c.fillStyle = "#2a2622";
    c.beginPath();
    c.moveTo(8, 14);
    c.lineTo(120, 10);
    c.lineTo(112, 62);
    c.lineTo(16, 64);
    c.closePath();
    c.fill();
    c.fillStyle = "#4a3a2c";
    for (let i = 0; i < 4; i++) c.fillRect(14 + i * 26, 16, 22, 3);
    c.fillStyle = "#5c3a22";
    c.globalAlpha = 0.5;
    c.fillRect(20, 30, 60, 18);
    c.globalAlpha = 1;
    c.fillStyle = "#1a1714";
    c.fillRect(4, 10, 120, 6);
    // Les roues
    for (const x of [34, 94]) {
      c.fillStyle = "#151311";
      c.beginPath();
      c.arc(x, 68, 13, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#3a332c";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, 68, 8, 0, Math.PI * 2);
      c.stroke();
    }
    // Un peu de minerai qui dépasse
    c.fillStyle = "#3a3a44";
    c.beginPath();
    c.moveTo(20, 12);
    c.quadraticCurveTo(50, -2, 70, 10);
    c.quadraticCurveTo(90, 2, 110, 11);
    c.fill();
  });

const texLanterne = () =>
  texturePeinte(64, 128, (c) => {
    // Le pied
    bois(c, 28, 44, 8, 84, "#3a281b", 9);
    c.fillStyle = "#1c130c";
    c.fillRect(20, 120, 24, 8);
    // La cage de fer
    c.fillStyle = "#1a1714";
    c.fillRect(18, 10, 28, 4);
    c.fillRect(20, 40, 24, 5);
    c.beginPath();
    c.moveTo(22, 10);
    c.lineTo(32, 0);
    c.lineTo(42, 10);
    c.fill();
    c.fillRect(19, 12, 3, 30);
    c.fillRect(42, 12, 3, 30);
    c.fillRect(31, 12, 2, 30);
    c.strokeStyle = "#2a2520";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(32, 0, 5, 0, Math.PI);
    c.stroke();
  });

// ——— Les géométries ———

/** Un éclat de cristal : un prisme effilé, sombre à la base, lumineux à la pointe. */
function eclats(h: ReturnType<typeof graine>, n: number, taille: number, base: THREE.Color, pointe: THREE.Color) {
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = h.entre(-0.75, 0.75) * (i === 0 ? 0.3 : 1);
    const long = taille * (i === 0 ? 1 : h.entre(0.35, 0.8));
    const larg = long * h.entre(0.13, 0.2);
    const ox = h.entre(-taille * 0.25, taille * 0.25) * (i === 0 ? 0.2 : 1);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const p = (x: number, y: number) => [ox + x * ca - y * sa, x * sa + y * ca, 0];
    const b1 = p(-larg, -0.1);
    const b2 = p(larg, -0.1);
    const m1 = p(-larg, long * 0.72);
    const m2 = p(larg, long * 0.72);
    const m0 = p(larg * 0.15, long * 0.7);
    const t = p(0, long);
    const sombre = base.clone().multiplyScalar(h.entre(0.6, 1.1));
    const clair = pointe.clone().multiplyScalar(h.entre(0.7, 1.2));
    const face = sombre.clone().lerp(clair, 0.35);
    // Deux faces, l'une plus claire, pour donner du volume
    const tri = (a: number[], b: number[], c: number[], ca: THREE.Color, cb: THREE.Color, cc: THREE.Color) => {
      pos.push(...a, ...b, ...c);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    };
    tri(b1, m0, m1, sombre, face, face);
    tri(b1, b2, m0, sombre, sombre, face);
    tri(b2, m2, m0, sombre, clair, face);
    tri(m1, m0, t, face, face, clair);
    tri(m0, m2, t, face, clair, clair);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function orientation(mine: Mine, o: Objet) {
  if (caseEn(mine, o.col, o.ligne + 1) === ROCHE) return { angle: 0, dx: 0.5, dy: -1 };
  if (caseEn(mine, o.col, o.ligne - 1) === ROCHE) return { angle: Math.PI, dx: 0.5, dy: 0 };
  if (caseEn(mine, o.col - 1, o.ligne) === ROCHE) return { angle: -Math.PI / 2, dx: 0, dy: -0.5 };
  if (caseEn(mine, o.col + 1, o.ligne) === ROCHE) return { angle: Math.PI / 2, dx: 1, dy: -0.5 };
  return { angle: 0, dx: 0.5, dy: -1 };
}

type Chaine = {
  points: THREE.Vector2[];
  anciens: THREE.Vector2[];
  longueur: number;
  mesh: THREE.Mesh;
  poids: THREE.Mesh;
  lampe: { halo: THREE.Mesh; coeur: THREE.Mesh; lum: Lumiere; phase: number } | null;
};

const LAMPE = new THREE.Color("#ffb070");

export type Decor = {
  groupe: THREE.Group;
  lumieres: Lumiere[];
  /** Appelé à chaque image ; renvoie les cristaux qui viennent de tinter */
  mettreAJour(dt: number, temps: number, hx: number, hy: number, hvx: number, allumees: boolean[], coeur: number): { note: number; x: number }[];
  /** Les becs de lanterne, pour les étincelles */
  lanternes: { x: number; y: number }[];
  coeur: { x: number; y: number };
};

export function creerDecor(mine: Mine, accentDe: (col: number, ligne: number) => THREE.Color, zoneDe: (col: number, ligne: number) => string): Decor {
  const groupe = new THREE.Group();
  const lumieres: Lumiere[] = [];
  const h = graine(42);

  // ——— Planches, suspendues par des cordes ———
  const tPlanche = texPlanche();
  tPlanche.wrapS = THREE.RepeatWrapping;
  const corde = new THREE.MeshBasicMaterial({ color: new THREE.Color("#0b0806") });
  for (let ligne = 0; ligne < mine.hauteur; ligne++) {
    let debut = -1;
    for (let col = 0; col <= mine.largeur; col++) {
      const p = col < mine.largeur && caseEn(mine, col, ligne) === PLANCHE;
      if (p && debut < 0) debut = col;
      if (!p && debut >= 0) {
        const n = col - debut;
        const t = tPlanche.clone();
        t.repeat.set(n, 1);
        t.needsUpdate = true;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(n + 0.1, 0.5), materiauEclaire(t));
        m.position.set(debut + n / 2, -ligne - 0.25 + 0.03, 0);
        m.renderOrder = -30;
        groupe.add(m);
        for (const cx of [debut + 0.25, col - 0.25]) {
          const haut = plafond(mine, Math.floor(cx), ligne);
          const longueur = ligne - haut;
          if (longueur > 14 || longueur < 1) continue;
          const r = new THREE.Mesh(new THREE.PlaneGeometry(0.05, longueur), corde);
          r.position.set(cx, -haut - longueur / 2, 0);
          r.renderOrder = -31;
          groupe.add(r);
        }
        debut = -1;
      }
    }
  }

  // ——— Étais, wagonnets, chaînes, rais de lumière ———
  const tEtai = texEtai();
  const tWagon = texWagonnet();
  const chaines: Chaine[] = [];
  const rais: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  const matChaine = new THREE.MeshBasicMaterial({ color: new THREE.Color("#0e0c0b") });
  for (const o of mine.decors) {
    if (o.lettre === "|") {
      // Un étai va du sol au plafond, coiffé d'un chapeau et tenu par deux jambes de force
      const etaiAuDessus = mine.decors.some((d) => d.lettre === "|" && d.col === o.col && d.ligne === o.ligne - 1);
      if (etaiAuDessus) continue;
      const haut = plafond(mine, o.col, o.ligne);
      const bas = sol(mine, o.col, o.ligne);
      const hauteur = bas - haut + 0.2;
      const x = o.col + 0.5;
      const t = tEtai.clone();
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, hauteur);
      t.needsUpdate = true;
      const poteau = new THREE.Mesh(new THREE.PlaneGeometry(0.5, hauteur), materiauEclaire(t));
      poteau.position.set(x, -haut - hauteur / 2 + 0.1, 0);
      poteau.renderOrder = -40;
      const chapeau = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.42), materiauEclaire(tPlanche));
      chapeau.position.set(x, -haut - 0.18, 0);
      chapeau.renderOrder = -39;
      groupe.add(poteau, chapeau);
      for (const s of [-1, 1]) {
        const jambe = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.5), materiauEclaire(tEtai));
        jambe.position.set(x + s * 0.55, -haut - 0.85, 0);
        jambe.rotation.z = s * 0.75;
        jambe.renderOrder = -39.5;
        groupe.add(jambe);
      }
    } else if (o.lettre === "w") {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.45), materiauEclaire(tWagon));
      const bas = sol(mine, o.col, o.ligne);
      m.position.set(o.col + 0.5, -bas + 0.7, 0);
      m.rotation.z = h.entre(-0.04, 0.04);
      m.renderOrder = -38;
      groupe.add(m);
      // Les rails
      const rail = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color("#2a2622") }));
      rail.position.set(o.col + 0.5, -bas + 0.06, 0);
      rail.renderOrder = -37;
      groupe.add(rail);
    } else if (o.lettre === "!") {
      const haut = plafond(mine, o.col, o.ligne);
      const x = o.col + 0.5;
      const longueur = o.ligne + 1 - haut;
      const n = Math.max(4, Math.round(longueur * 2.5));
      const points = Array.from({ length: n + 1 }, (_, i) => new THREE.Vector2(x, -haut - (i / n) * longueur));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((n + 1) * 2 * 3), 3));
      const index: number[] = [];
      for (let i = 0; i < n; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      geo.setIndex(index);
      const mesh = new THREE.Mesh(geo, matChaine);
      mesh.frustumCulled = false;
      mesh.renderOrder = -36;
      const poids = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), matChaine);
      poids.scale.set(1, 1.3, 1);
      poids.renderOrder = -36;
      groupe.add(mesh, poids);
      // Dans les galeries et plus bas, une vieille lampe de mineur pend encore au bout
      let lampe: Chaine["lampe"] = null;
      if (zoneDe(o.col, o.ligne) !== "puits" && zoneDe(o.col, o.ligne) !== "crevasse") {
        const halo = creerHalo(3.5, LAMPE.clone().multiplyScalar(0.4), -35);
        const coeurLampe = creerHalo(0.7, LAMPE.clone().multiplyScalar(2.5), -35);
        const lum: Lumiere = { x, y: 0, rayon: 5, couleur: LAMPE.clone(), intensite: 0.6 };
        lumieres.push(lum);
        groupe.add(halo, coeurLampe);
        lampe = { halo, coeur: coeurLampe, lum, phase: h.entre(0, 9) };
      }
      chaines.push({ points, anciens: points.map((p) => p.clone()), longueur: longueur / n, mesh, poids, lampe });
    } else if (o.lettre === "R") {
      const bas = sol(mine, o.col, o.ligne + 1);
      const longueur = Math.min(30, bas - o.ligne + 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTemps: LUMIERES.uTemps, uCouleur: { value: new THREE.Color("#cfe8ff").multiplyScalar(0.55) }, uLong: { value: longueur } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTemps;
          uniform vec3 uCouleur;
          uniform float uLong;
          varying vec2 vUv;
          float h(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            float travers = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
            float lg = pow(clamp(vUv.y, 0.0, 1.0), 1.6) * smoothstep(1.0, 0.92, vUv.y);
            // Des filets plus clairs qui ondulent lentement dans le rai
            float filets = 0.75 + 0.25 * sin(vUv.x * 19.0 + uTemps * 0.4) * sin(vUv.x * 7.0 - uTemps * 0.23);
            gl_FragColor = vec4(uCouleur * travers * lg * filets, 1.0);
          }
        `,
      });
      const largeurBas = 4.5;
      const geo = new THREE.BufferGeometry();
      const pente = 0.22;
      const yh = -o.ligne;
      const yb = -o.ligne - longueur;
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [o.col - 0.3, yh, 0, o.col + 1.3, yh, 0, o.col + 0.5 + longueur * pente + largeurBas / 2, yb, 0, o.col + 0.5 + longueur * pente - largeurBas / 2, yb, 0],
          3,
        ),
      );
      geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
      geo.setIndex([0, 3, 1, 1, 3, 2]);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = -50;
      groupe.add(mesh);
      rais.push({ mesh, mat });
      lumieres.push({ x: o.col + 0.5 + longueur * pente * 0.6, y: -o.ligne - longueur * 0.6, rayon: 7, couleur: new THREE.Color("#a8cfff"), intensite: 0.35 });
      lumieres.push({ x: o.col + 0.5 + longueur * pente * 0.95, y: -o.ligne - longueur * 0.95, rayon: 5, couleur: new THREE.Color("#a8cfff"), intensite: 0.4 });
    }
  }

  // ——— Lanternes ———
  const tLanterne = texLanterne();
  const lanternes = mine.lanternes.map((o) => {
    const bas = sol(mine, o.col, o.ligne);
    const x = o.col + 0.5;
    const y = -bas + 1.62;
    const corps = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7), materiauEclaire(tLanterne));
    corps.position.set(x, -bas + 0.85, 0);
    corps.renderOrder = -34;
    const flamme = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: CHAUD.clone(), transparent: true, depthTest: false }));
    flamme.scale.set(1, 1.5, 1);
    flamme.position.set(x, y, 0);
    flamme.renderOrder = -33;
    const halo = creerHalo(7, CHAUD);
    halo.position.set(x, y, 0);
    const petitHalo = creerHalo(1.6, CHAUD, -32);
    petitHalo.position.set(x, y, 0);
    groupe.add(corps, flamme, halo, petitHalo);
    const lum: Lumiere = { x, y, rayon: 9, couleur: CHAUD.clone(), intensite: 0 };
    lumieres.push(lum);
    return { x, y, flamme, halo, petitHalo, lum, allumage: -1, phase: h.entre(0, 10) };
  });

  // ——— Cristaux ———
  const cristaux = mine.cristaux.map((o, i) => {
    const or = orientation(mine, o);
    const accent = accentDe(o.col, o.ligne);
    const taille = h.entre(0.9, 1.5);
    const geo = eclats(graine(100 + i), h.entier(4, 7), taille, accent.clone().multiplyScalar(0.12), accent.clone().multiplyScalar(2.2));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, color: new THREE.Color(1, 1, 1) });
    const m = new THREE.Mesh(geo, mat);
    const x = o.col + or.dx;
    const y = -o.ligne + or.dy;
    m.position.set(x, y, 0);
    m.rotation.z = -or.angle;
    m.renderOrder = -5;
    const halo = creerHalo(5, accent.clone().multiplyScalar(0.45), -6);
    const cx = x + Math.sin(or.angle) * taille * 0.4;
    const cy = y + Math.cos(or.angle) * taille * 0.4;
    halo.position.set(cx, cy, 0);
    groupe.add(m, halo);
    const lum: Lumiere = { x: cx, y: cy, rayon: 4.5, couleur: accent.clone(), intensite: 0.6 };
    lumieres.push(lum);
    return { mat, halo, lum, x: cx, y: cy, eveil: 0, arme: true, phase: h.entre(0, 6), note: i % 8, accent };
  });

  // ——— Le Cœur ———
  const co = mine.coeur;
  const coeurX = co.col + 0.5;
  const coeurY = -co.ligne - 1 + 1.6;
  const rose = new THREE.Color("#ff9fd0");
  const coeurGeo = eclats(graine(7), 9, 3.2, rose.clone().multiplyScalar(0.1), rose.clone().multiplyScalar(1.4));
  const coeurMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, color: new THREE.Color(0.5, 0.5, 0.5) });
  const coeurMesh = new THREE.Mesh(coeurGeo, coeurMat);
  coeurMesh.position.set(coeurX, -co.ligne - 1, 0);
  coeurMesh.renderOrder = -4;
  const coeurHalo = creerHalo(12, rose.clone().multiplyScalar(0.5), -6);
  coeurHalo.position.set(coeurX, coeurY, 0);
  groupe.add(coeurMesh, coeurHalo);
  const coeurLum: Lumiere = { x: coeurX, y: coeurY, rayon: 9, couleur: rose.clone(), intensite: 0.5 };
  lumieres.push(coeurLum);

  // ——— Herbes et racines qui ondulent ———
  const herbes = creerVegetation(mine);
  groupe.add(herbes.mesh);

  return {
    groupe,
    lumieres,
    lanternes: lanternes.map((l) => ({ x: l.x, y: l.y })),
    coeur: { x: coeurX, y: coeurY },
    mettreAJour(dt, temps, hx, hy, hvx, allumees, coeur) {
      herbes.uniforms.uHeros.value.set(hx, hy, hvx);
      // Les lanternes : une flamme qui vacille, un éclat à l'allumage
      lanternes.forEach((l, i) => {
        // Pendant la finale, la lumière remonte et rallume toutes les lanternes, de proche en proche
        const parLeCoeur = coeur > 0 && coeur * 60 > Math.hypot(l.x - coeurX, l.y - coeurY);
        if ((allumees[i] || parLeCoeur) && l.allumage < 0) l.allumage = temps;
        const vacille = 0.88 + 0.08 * Math.sin(temps * 9 + l.phase) + 0.05 * Math.sin(temps * 23 + l.phase * 2);
        let f: number;
        if (l.allumage < 0) f = 0.012 + 0.008 * Math.sin(temps * 1.3 + l.phase);
        else {
          const t = temps - l.allumage;
          f = (1 + 3.5 * Math.exp(-t * 2.2)) * Math.min(1, t * 6);
        }
        l.lum.intensite = f * 1.7 * vacille;
        (l.flamme.material as THREE.MeshBasicMaterial).color.copy(CHAUD).multiplyScalar(0.06 + f * 6 * vacille);
        (l.halo.material as THREE.MeshBasicMaterial).color.copy(CHAUD).multiplyScalar(f * 0.5 * vacille);
        (l.petitHalo.material as THREE.MeshBasicMaterial).color.copy(CHAUD).multiplyScalar(0.03 + f * 1.2 * vacille);
        l.halo.scale.setScalar(1 + 0.6 * Math.exp(-(temps - l.allumage) * 1.5) * (l.allumage < 0 ? 0 : 1));
      });
      // Les cristaux : ils respirent, et tintent quand on passe près d'eux
      const tintes: { note: number; x: number }[] = [];
      for (const c of cristaux) {
        const d = Math.hypot(c.x - hx, c.y - hy);
        if (d < 2.4 && c.arme) {
          c.arme = false;
          c.eveil = 1;
          tintes.push({ note: c.note, x: c.x });
        }
        if (d > 4.5) c.arme = true;
        c.eveil = Math.max(0, c.eveil - dt * 0.5);
        const souffle = 0.75 + 0.25 * Math.sin(temps * 0.9 + c.phase);
        const f = souffle + c.eveil * 1.6 + coeur * 1.5;
        c.mat.color.setScalar(0.55 + f * 0.45);
        (c.halo.material as THREE.MeshBasicMaterial).color.copy(c.accent).multiplyScalar(0.25 * f);
        c.lum.intensite = 0.4 * f;
      }
      // Le Cœur : un battement lent, puis l'embrasement
      const battement = Math.pow(Math.max(0, Math.sin(temps * 1.4)), 6) + Math.pow(Math.max(0, Math.sin(temps * 1.4 - 0.5)), 8) * 0.6;
      const fc = 0.35 + battement * 0.35 + coeur * 2.5;
      coeurMat.color.setScalar(Math.min(4, 0.5 + fc * 0.6));
      (coeurHalo.material as THREE.MeshBasicMaterial).color.copy(rose).multiplyScalar(0.25 * fc);
      coeurHalo.scale.setScalar(1 + coeur * 1.5);
      coeurLum.intensite = 0.4 + battement * 0.4 + coeur * 1.4;
      coeurLum.rayon = 9 + coeur * 26;
      // Les chaînes : des points reliés qui se balancent, poussés par Veilleuse
      for (const ch of chaines) {
        animerChaine(ch, dt, temps, hx, hy, hvx);
        if (!ch.lampe) continue;
        const fin = ch.points[ch.points.length - 1];
        const vacille = 0.85 + 0.1 * Math.sin(temps * 7 + ch.lampe.phase) + (Math.sin(temps * 0.5 + ch.lampe.phase) > 0.97 ? -0.5 : 0);
        ch.lampe.halo.position.set(fin.x, fin.y - 0.15, 0);
        ch.lampe.coeur.position.set(fin.x, fin.y - 0.15, 0);
        ch.lampe.lum.x = fin.x;
        ch.lampe.lum.y = fin.y - 0.2;
        ch.lampe.lum.intensite = 0.65 * vacille * (1 + coeur);
        (ch.lampe.coeur.material as THREE.MeshBasicMaterial).color.copy(LAMPE).multiplyScalar(2.2 * vacille);
      }
      void rais;
      return tintes;
    },
  };
}

function animerChaine(ch: Chaine, dt: number, temps: number, hx: number, hy: number, hvx: number) {
  const pts = ch.points;
  const pas = Math.min(dt, 1 / 30);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const a = ch.anciens[i];
    const vx = (p.x - a.x) * 0.985;
    const vy = (p.y - a.y) * 0.985;
    a.copy(p);
    p.x += vx + Math.sin(temps * 0.7 + i * 0.3) * 0.00006;
    p.y += vy - 9 * pas * pas;
    // Veilleuse bouscule la chaîne en passant
    const dx = p.x - hx;
    const dy = p.y - hy;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.8) p.x += hvx * pas * 0.5 + Math.sign(dx || 1) * 0.01;
  }
  for (let k = 0; k < 6; k++) {
    pts[0].copy(ch.anciens[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const diff = (d - ch.longueur) / d;
      if (i === 0) {
        b.x -= dx * diff;
        b.y -= dy * diff;
      } else {
        a.x += dx * diff * 0.5;
        a.y += dy * diff * 0.5;
        b.x -= dx * diff * 0.5;
        b.y -= dy * diff * 0.5;
      }
    }
  }
  const pos = ch.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const ep = 0.045;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * ep;
    const ny = (dx / l) * ep;
    pos.setXYZ(i * 2, pts[i].x + nx, pts[i].y + ny, 0);
    pos.setXYZ(i * 2 + 1, pts[i].x - nx, pts[i].y - ny, 0);
  }
  pos.needsUpdate = true;
  const fin = pts[pts.length - 1];
  ch.poids.position.set(fin.x, fin.y - 0.1, 0);
}

/** Des brins d'herbe pâle sur les sols et des racines aux plafonds, qui ondulent et s'écartent au passage. */
function creerVegetation(mine: Mine) {
  const h = graine(5);
  const pos: number[] = [];
  const base: number[] = [];
  const souplesse: number[] = [];
  const brin = (x: number, y: number, haut: number, larg: number, penche: number, sens: number) => {
    // Un brin = un triangle effilé ; la pointe ondule, le pied reste fixe
    const tx = x + penche;
    const ty = y + haut * sens;
    pos.push(x - larg, y, 0, x + larg, y, 0, tx, ty, 0);
    for (let i = 0; i < 3; i++) base.push(x, y);
    souplesse.push(0, 0, 1);
  };
  for (let ligne = 1; ligne < mine.hauteur - 1; ligne++) {
    for (let col = 1; col < mine.largeur - 1; col++) {
      const ici = caseEn(mine, col, ligne);
      if (ici === ROCHE || mine.eau[ligne * mine.largeur + col]) continue;
      if (caseEn(mine, col, ligne + 1) === ROCHE && !mine.eau[(ligne + 1) * mine.largeur + col] && h.suivant() < 0.75) {
        const n = h.entier(2, 7);
        for (let i = 0; i < n; i++) brin(col + h.suivant(), -ligne - 1 + 0.02, h.entre(0.12, 0.5), h.entre(0.02, 0.045), h.entre(-0.15, 0.15), 1);
      }
      if (caseEn(mine, col, ligne - 1) === ROCHE && h.suivant() < 0.35) {
        const n = h.entier(1, 3);
        for (let i = 0; i < n; i++) brin(col + h.suivant(), -ligne + 0.05, h.entre(0.3, 1.6), h.entre(0.025, 0.05), h.entre(-0.1, 0.1), -1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("base", new THREE.Float32BufferAttribute(base, 2));
  geo.setAttribute("souplesse", new THREE.Float32BufferAttribute(souplesse, 1));
  const uniforms = { ...LUMIERES, uHeros: { value: new THREE.Vector3() }, uCouleur: { value: new THREE.Color("#3a4a48") } };
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 base;
        attribute float souplesse;
        uniform vec3 uHeros;
        uniform float uTemps;
        varying vec2 vMonde;
        varying float vHaut;
        void main() {
          vec3 p = position;
          float vent = sin(uTemps * 1.3 + base.x * 1.7) * 0.06 + sin(uTemps * 2.9 + base.x * 5.1) * 0.025;
          vec2 d = base - uHeros.xy;
          float pres = exp(-dot(d * vec2(1.6, 1.0), d * vec2(1.6, 1.0)) * 2.5);
          p.x += souplesse * (vent + pres * (sign(d.x) * 0.25 + uHeros.z * 0.04));
          p.y -= souplesse * pres * 0.08 * sign(p.y - base.y);
          vHaut = souplesse;
          vec4 m = modelMatrix * vec4(p, 1.0);
          vMonde = m.xy;
          gl_Position = projectionMatrix * viewMatrix * m;
        }
      `,
      fragmentShader: /* glsl */ `
        ${GLSL_LUMIERES}
        uniform vec3 uCouleur;
        varying vec2 vMonde;
        varying float vHaut;
        void main() {
          vec3 L = lumiere(vMonde, vec3(0.0, 0.3, 0.95));
          vec3 col = uCouleur * (0.25 + vHaut * 0.5) * (uAmbiant * 3.0 + L * 1.6);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  mesh.renderOrder = -8;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
