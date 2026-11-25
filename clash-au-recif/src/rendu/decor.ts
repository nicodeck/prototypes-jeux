// Le décor : un récif herbeux au milieu de la mer, sous un grand ciel à cumulus.
// La forme du récif suit exactement les blocs solides de la simulation (src/combat/arene.ts).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ARENE } from "../combat/arene";
import { ellipsoide, meche } from "./formes";
import { texture } from "./persos/commun";
import { GLOBAL, matToon, piece } from "./toon";

export const NIVEAU_MER = -7.6;

const CIEL = {
  vertex: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uHaut;
    uniform vec3 uHorizon;
    uniform vec3 uSoleil;
    uniform vec3 uDirSoleil;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y, -0.2, 1.0);
      vec3 col = mix(uHorizon, uHaut, smoothstep(0.0, 0.55, h));
      float s = max(dot(d, normalize(uDirSoleil)), 0.0);
      col = mix(col, uSoleil, smoothstep(0.995, 0.997, s));
      col += uSoleil * pow(s, 24.0) * 0.35;
      // Bandes de couleur nettes, comme un ciel peint en aplats.
      col = mix(col, uHorizon * 1.08, step(h, 0.06) * 0.35);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

const MER = {
  vertex: /* glsl */ `
    varying vec3 vMonde;
    void main() {
      vec4 m = modelMatrix * vec4(position, 1.0);
      vMonde = m.xyz;
      gl_Position = projectionMatrix * viewMatrix * m;
    }
  `,
  fragment: /* glsl */ `
    uniform float uTemps;
    uniform vec3 uProche;
    uniform vec3 uLoin;
    uniform vec3 uEcume;
    uniform vec3 uCiel;
    varying vec3 vMonde;
    float vague(vec2 p, float t) {
      return sin(p.x * 0.35 + t * 1.1 + sin(p.y * 0.21 + t * 0.4) * 2.0)
           + sin(p.y * 0.52 - t * 0.8 + sin(p.x * 0.17) * 1.5) * 0.7;
    }
    void main() {
      float dist = length(vMonde.xz - cameraPosition.xz);
      float loin = smoothstep(20.0, 220.0, dist);
      vec3 col = mix(uProche, uLoin, loin);
      // Écume : des lignes claires qui ondulent, plus fines au loin.
      float v = vague(vMonde.xz, uTemps);
      float largeur = mix(0.12, 0.03, loin);
      float ecume = smoothstep(1.35 - largeur, 1.35, v) * (1.0 - smoothstep(1.35, 1.35 + largeur, v));
      float ondes = step(0.92, fract(vMonde.z * 0.12 + sin(vMonde.x * 0.08 + uTemps * 0.5) * 0.4));
      col = mix(col, uEcume, ecume * (1.0 - loin * 0.6));
      col = mix(col, uProche * 1.25, ondes * 0.25 * (1.0 - loin));
      // Brume vers l'horizon
      col = mix(col, uCiel, smoothstep(120.0, 330.0, dist));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

export class Decor {
  readonly groupe = new THREE.Group();
  private readonly mer: THREE.ShaderMaterial;
  private readonly nuages: { objet: THREE.Object3D; vitesse: number }[] = [];
  private readonly ecume: THREE.Mesh;
  private readonly lanternes: THREE.Object3D[] = [];
  private readonly mouettes: { objet: THREE.Group; ailes: THREE.Object3D[]; phase: number; rayon: number; centre: THREE.Vector3 }[] = [];

  constructor() {
    const g = this.groupe;

    // ——— Le ciel et le soleil
    const ciel = new THREE.Mesh(
      new THREE.SphereGeometry(380, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          uHaut: { value: new THREE.Color("#2f7fd8") },
          uHorizon: { value: new THREE.Color("#bfe8ff") },
          uSoleil: { value: new THREE.Color("#fff6d8") },
          uDirSoleil: { value: new THREE.Vector3(-0.55, 0.32, -1) },
        },
        vertexShader: CIEL.vertex,
        fragmentShader: CIEL.fragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    ciel.renderOrder = -10;
    g.add(ciel);

    // ——— La mer
    this.mer = new THREE.ShaderMaterial({
      uniforms: {
        uTemps: GLOBAL.uTemps,
        uProche: { value: new THREE.Color("#1d8fc4") },
        uLoin: { value: new THREE.Color("#5fb9e3") },
        uEcume: { value: new THREE.Color("#e8fbff") },
        uCiel: { value: new THREE.Color("#bfe8ff") },
      },
      vertexShader: MER.vertex,
      fragmentShader: MER.fragment,
    });
    const mer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), this.mer);
    mer.rotation.x = -Math.PI / 2;
    mer.position.y = NIVEAU_MER;
    g.add(mer);

    // ——— Le récif
    this.construireRecif();
    this.construirePlateformes();
    this.construireAccessoires();

    // L'écume au pied du récif
    const anneau = new THREE.RingGeometry(1, 1.35, 48);
    this.ecume = new THREE.Mesh(anneau, new THREE.MeshBasicMaterial({ color: "#f2fdff", transparent: true, opacity: 0.85 }));
    this.ecume.rotation.x = -Math.PI / 2;
    this.ecume.position.set(0, NIVEAU_MER + 0.02, -0.3);
    this.ecume.scale.set(6.8, 3.6, 1);
    g.add(this.ecume);

    // ——— Les îles lointaines
    const iles: [number, number, number, number, string][] = [
      [-130, -210, 46, 20, "#7fb7d6"],
      [-60, -250, 30, 12, "#8cc0dc"],
      [95, -190, 60, 26, "#79b2d3"],
      [170, -260, 40, 16, "#8cc0dc"],
    ];
    for (const [x, z, l, h, c] of iles) {
      const ile = new THREE.Mesh(ellipsoide(l / 2, h, l / 5, 24, 12), matToon(c, { ombre: "#6a9cc4", trame: 0, rim: 0 }));
      ile.position.set(x, NIVEAU_MER - h * 0.25, z);
      g.add(ile);
    }

    // ——— Les cumulus : des grappes de boules blanches à l'ombre bleutée
    const blanc = matToon("#ffffff", { ombre: "#a9bfee", trame: 0.5, rim: 0 });
    let graine = 7;
    const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const grappe = (x: number, y: number, z: number, taille: number) => {
      const n = new THREE.Group();
      const boules = 7 + Math.floor(alea() * 5);
      for (let i = 0; i < boules; i++) {
        const r = taille * (0.45 + alea() * 0.55) * (1 - Math.abs(i / boules - 0.5));
        const b = piece(ellipsoide(r, r * 0.85, r * 0.8, 18, 12), blanc, 0.8, { trait: "#6f86c4" });
        b.position.set((i / boules - 0.5) * taille * 2.6, r * 0.35 + alea() * taille * 0.3, alea() * taille * 0.4);
        n.add(b);
      }
      const base = piece(ellipsoide(taille * 1.5, taille * 0.4, taille * 0.6, 20, 10), blanc, 0.8, { trait: "#6f86c4" });
      n.add(base);
      n.position.set(x, y, z);
      g.add(n);
      this.nuages.push({ objet: n, vitesse: 0.4 + alea() * 0.5 });
    };
    grappe(-60, 22, -110, 9);
    grappe(10, 34, -150, 13);
    grappe(75, 18, -120, 10);
    grappe(-120, 40, -200, 16);
    grappe(140, 45, -220, 18);
    grappe(-30, 8, -90, 5);
    grappe(40, 4, -80, 4);

    // ——— Des mouettes qui tournent au loin
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group();
      const matM = matToon("#ffffff", { ombre: "#9fb0d0", trame: 0 });
      const corps = piece(ellipsoide(0.25, 0.12, 0.12), matM, 0.7);
      corps.rotation.y = Math.PI / 2;
      m.add(corps);
      const ailes: THREE.Object3D[] = [];
      for (const s of [-1, 1]) {
        const aile = new THREE.Group();
        aile.add(piece(meche([[0, 0, 0], [0, 0.15, s * 0.5], [0, -0.05, s * 1.0]], 0.09, 0.2), matM, 0.7));
        m.add(aile);
        ailes.push(aile);
      }
      g.add(m);
      this.mouettes.push({
        objet: m,
        ailes,
        phase: i * 1.7,
        rayon: 8 + i * 3,
        centre: new THREE.Vector3(-20 + i * 14, 14 + i * 2.5, -40 - i * 8),
      });
    }
  }

  private construireRecif() {
    // La roche : la silhouette des blocs solides, extrudée en profondeur, bords arrondis.
    const [haut, bas] = ARENE.blocs;
    const forme = new THREE.Shape();
    forme.moveTo(haut.gauche, haut.haut - 0.3);
    forme.lineTo(haut.droite, haut.haut - 0.3);
    forme.lineTo(haut.droite, haut.bas + 0.25);
    forme.quadraticCurveTo(haut.droite, haut.bas, haut.droite - 0.4, haut.bas);
    forme.lineTo(bas.droite + 0.1, haut.bas - 0.05);
    forme.lineTo(bas.droite, bas.bas);
    forme.quadraticCurveTo(bas.droite - 0.6, -8.6, 1.5, -9.5);
    forme.quadraticCurveTo(0, -10.2, -1.8, -9.4);
    forme.quadraticCurveTo(bas.gauche + 0.6, -8.6, bas.gauche, bas.bas);
    forme.lineTo(bas.gauche - 0.1, haut.bas - 0.05);
    forme.lineTo(haut.gauche + 0.4, haut.bas);
    forme.quadraticCurveTo(haut.gauche, haut.bas, haut.gauche, haut.bas + 0.25);
    forme.closePath();
    const geo = new THREE.ExtrudeGeometry(forme, {
      depth: 5,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.22,
      bevelSegments: 4,
      curveSegments: 12,
    });
    geo.translate(0, 0, -2.8);
    // Des UV en coordonnées du monde, réduites : la texture de fissures se répète.
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.09, uv.getY(i) * 0.09);
    const fissures = texture(512, 512, (ctx, w, h) => {
      let s = 3;
      const a = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      ctx.strokeStyle = "rgba(70,38,48,0.55)";
      // Strates horizontales
      for (let i = 0; i < 9; i++) {
        ctx.lineWidth = 3 + a() * 3;
        const y = (i / 9) * h + a() * 20;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 10 + a() * 6);
        ctx.stroke();
      }
      // Fissures
      ctx.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        let x = a() * w;
        let y = a() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (a() - 0.5) * 50;
          y += 12 + a() * 28;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    fissures.wrapT = THREE.RepeatWrapping;
    const roche = piece(geo, matToon("#c99a6c", { ombre: "#6b4152", carte: fissures, degrade: 0.35 }), 1.2, { lisser: true });
    this.groupe.add(roche);

    // L'herbe : une dalle verte posée sur le dessus, qui déborde un peu et coule sur les bords.
    const dalle = new RoundedBoxGeometry(haut.droite - haut.gauche + 0.5, 0.5, 5.6, 4, 0.2);
    const herbe = matToon("#73c94c", { ombre: "#2f7a52", rim: 0.8 });
    const tapis = piece(dalle, herbe, 1.1, { lisser: true });
    tapis.position.set(0, -0.25, -0.3);
    this.groupe.add(tapis);
    let s = 11;
    const a = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // Des coulures d'herbe sur l'avant et les côtés
    for (let i = 0; i < 40; i++) {
      const x = haut.gauche + 0.2 + (i / 39) * (haut.droite - haut.gauche - 0.4);
      const l = 0.18 + a() * 0.35;
      const c = piece(
        meche([[0, 0, 0], [0, -l * 0.5, 0.05], [0, -l, 0.02]], 0.09 + a() * 0.06, 0.2),
        herbe,
        0.9,
      );
      c.position.set(x, -0.4, 2.45);
      this.groupe.add(c);
    }
    // Des touffes d'herbe et des fleurs à l'arrière
    const touffe = matToon("#8fdc5a", { ombre: "#2f7a52" });
    for (let i = 0; i < 22; i++) {
      const x = haut.gauche + 0.3 + a() * (haut.droite - haut.gauche - 0.6);
      const z = -1.4 - a() * 1.6;
      for (let k = 0; k < 3; k++) {
        const brin = piece(
          meche([[0, 0, 0], [(k - 1) * 0.05, 0.15, 0], [(k - 1) * 0.14, 0.32 + a() * 0.15, 0]], 0.05, 0.05, 6),
          touffe,
          0.7,
        );
        brin.position.set(x + (k - 1) * 0.06, 0, z);
        this.groupe.add(brin);
      }
      if (a() < 0.35) {
        const fleur = piece(ellipsoide(0.09, 0.05, 0.09), matToon(a() < 0.5 ? "#ffd84a" : "#ff7aa8", { trame: 0 }), 0.7);
        fleur.position.set(x + 0.12, 0.22, z);
        this.groupe.add(fleur);
      }
    }
  }

  private construirePlateformes() {
    const bois = texture(256, 128, (ctx, w, h) => {
      ctx.strokeStyle = "rgba(60,28,20,0.7)";
      ctx.lineWidth = 4;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo((i / 5) * w, 0);
        ctx.lineTo((i / 5) * w + 4, h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,28,20,0.8)";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc((i / 5) * w + 10, 14, 3.5, 0, Math.PI * 2);
        ctx.arc((i / 5) * w + 10, h - 14, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const matBois = matToon("#b97a45", { ombre: "#5c2f3b", carte: bois, rim: 1.2 });
    const matCorde = matToon("#e6cf98", { ombre: "#8b6a5a" });
    const matLanterne = matToon("#ff5b3a", { ombre: "#a3203f", trame: 0 });
    for (const p of ARENE.plateformes) {
      const largeur = p.droite - p.gauche;
      const groupe = new THREE.Group();
      groupe.position.set((p.gauche + p.droite) / 2, p.y, 0);
      const planche = piece(new RoundedBoxGeometry(largeur + 0.1, 0.28, 2.4, 3, 0.08), matBois, 1, { lisser: true });
      planche.position.y = -0.14;
      groupe.add(planche);
      // Deux traverses dessous et une corde qui les lie
      for (const sx of [-1, 1]) {
        const traverse = piece(new RoundedBoxGeometry(0.22, 0.2, 2.5, 2, 0.06), matBois, 1, { lisser: true });
        traverse.position.set(sx * (largeur / 2 - 0.35), -0.34, 0);
        groupe.add(traverse);
        const corde = piece(new THREE.TorusGeometry(0.16, 0.04, 6, 14), matCorde, 0.8);
        corde.position.set(sx * (largeur / 2 - 0.35), -0.3, 1.1);
        groupe.add(corde);
        // Une lanterne de papier accrochée au bout
        const fil = piece(meche([[0, 0, 0], [0, -0.3, 0]], 0.015, 1, 5), matCorde, 0.5);
        fil.position.set(sx * (largeur / 2 + 0.02), -0.28, -0.9);
        groupe.add(fil);
        const lanterne = new THREE.Group();
        lanterne.add(piece(ellipsoide(0.16, 0.2, 0.16), matLanterne, 0.9));
        const chapeau = piece(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 12), matToon("#2b1b2a"), 0.7);
        chapeau.position.y = 0.2;
        lanterne.add(chapeau);
        lanterne.position.set(sx * (largeur / 2 + 0.02), -0.75, -0.9);
        groupe.add(lanterne);
        this.lanternes.push(lanterne);
      }
      this.groupe.add(groupe);
    }
  }

  private construireAccessoires() {
    // Un palmier à gauche, en arrière-plan
    const tronc = matToon("#a8744a", { ombre: "#5a3442" });
    const palme = matToon("#4cbf5a", { ombre: "#1f6b4f", rim: 0.8 });
    const palmier = new THREE.Group();
    const points: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) points.push([Math.sin(i * 0.3) * 0.9 - i * 0.15, i * 0.9, 0]);
    palmier.add(piece(meche(points, 0.28, 0.55, 10), tronc, 1.1));
    const sommet = new THREE.Vector3(...points[points.length - 1]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dx = Math.cos(a) * 1.9;
      const dz = Math.sin(a) * 1.2;
      const feuille = piece(
        meche(
          [
            [sommet.x, sommet.y, sommet.z],
            [sommet.x + dx * 0.5, sommet.y + 0.55, sommet.z + dz * 0.5],
            [sommet.x + dx, sommet.y - 0.2, sommet.z + dz],
            [sommet.x + dx * 1.2, sommet.y - 0.9, sommet.z + dz * 1.15],
          ],
          0.32,
          0.1,
          8,
        ),
        palme,
        1,
      );
      feuille.scale.set(1, 0.6, 1);
      feuille.position.y = sommet.y * 0.4;
      palmier.add(feuille);
    }
    for (let i = 0; i < 3; i++) {
      const coco = piece(ellipsoide(0.18, 0.18, 0.18), matToon("#6b4a2e"), 0.8);
      coco.position.set(sommet.x + (i - 1) * 0.2, sommet.y - 0.25, 0.2);
      palmier.add(coco);
    }
    palmier.position.set(-5.4, 0, -2.2);
    palmier.scale.setScalar(0.85);
    this.groupe.add(palmier);

    // Un grand rocher et un tonneau à droite
    const rocher = piece(new THREE.DodecahedronGeometry(1.1, 1), matToon("#b58a66", { ombre: "#5d3a4a" }), 1.1, { lisser: true });
    rocher.position.set(5.6, 0.4, -2.3);
    rocher.scale.set(1.2, 0.8, 0.9);
    this.groupe.add(rocher);
    const tonneau = new THREE.Group();
    tonneau.add(piece(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 18), matToon("#a8663a", { ombre: "#552d38" }), 1));
    for (const y of [-0.3, 0.3]) {
      const cercle = piece(new THREE.TorusGeometry(0.44, 0.04, 6, 24), matToon("#3d3440"), 0.6);
      cercle.rotation.x = Math.PI / 2;
      cercle.position.y = y;
      tonneau.add(cercle);
    }
    tonneau.position.set(4.1, 0.48, -2.0);
    this.groupe.add(tonneau);
    // Un drapeau sur un mât, au fond
    const mat = piece(meche([[0, 0, 0], [0, 4.5, 0]], 0.09, 0.6, 8), matToon("#7a5236"), 1);
    mat.position.set(2.2, 0, -2.6);
    this.groupe.add(mat);
    const embleme = texture(256, 144, (ctx, w, h) => {
      // Une vague blanche et un poing : l'emblème du récif.
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, h * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e33b3b";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.58);
      ctx.quadraticCurveTo(w * 0.43, h * 0.3, w * 0.5, h * 0.55);
      ctx.quadraticCurveTo(w * 0.57, h * 0.78, w * 0.64, h * 0.45);
      ctx.stroke();
      ctx.fillStyle = "#1b1220";
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, h - 8, w, 8);
    });
    const drapeau = piece(
      new THREE.PlaneGeometry(1.6, 0.9, 8, 2),
      matToon("#e33b3b", { cote: THREE.DoubleSide, ombre: "#7c1838", carte: embleme }),
      0,
    );
    drapeau.position.set(3.0, 4.0, -2.6);
    drapeau.name = "drapeau";
    this.groupe.add(drapeau);
  }

  animer(temps: number, dt: number) {
    for (const n of this.nuages) {
      n.objet.position.x += n.vitesse * dt;
      if (n.objet.position.x > 220) n.objet.position.x = -220;
    }
    const s = 1 + Math.sin(temps * 1.4) * 0.03;
    this.ecume.scale.set(6.8 * s, 3.6 * s, 1);
    for (const [i, l] of this.lanternes.entries()) l.rotation.z = Math.sin(temps * 1.8 + i) * 0.12;
    for (const m of this.mouettes) {
      const a = temps * 0.25 + m.phase;
      m.objet.position.set(m.centre.x + Math.cos(a) * m.rayon, m.centre.y + Math.sin(a * 2) * 0.8, m.centre.z + Math.sin(a) * m.rayon * 0.4);
      m.objet.rotation.y = -a;
      const battement = Math.sin(temps * 7 + m.phase) * 0.5;
      m.ailes[0].rotation.x = battement;
      m.ailes[1].rotation.x = -battement;
    }
    const drapeau = this.groupe.getObjectByName("drapeau") as THREE.Mesh | undefined;
    if (drapeau) {
      const p = drapeau.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + 0.8;
        p.setZ(i, Math.sin(x * 3 - temps * 6) * 0.12 * x);
      }
      p.needsUpdate = true;
      drapeau.geometry.computeVertexNormals();
    }
  }
}
