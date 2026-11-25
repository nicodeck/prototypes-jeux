// Ballerina Cappuccina : une danseuse en tutu rose, avec une tasse de cappuccino pour tête.
import * as THREE from "three";
import { ellipsoide, membre, profilLisse, revolution } from "../formes";
import { Chaine, Pantin } from "../pantin";
import { peindreVisages } from "../visage";
import { atelier, texture } from "./commun";

export const COULEURS_BALLERINA = {
  peau: "#f9dcc8",
  peauOmbre: "#d99a8c",
  justaucorps: "#f58bb8",
  justaucorpsOmbre: "#a8417f",
  tutu: "#ffc3dc",
  tutuClair: "#fff1f7",
  collant: "#ffe0ea",
  chaussons: "#ff9cc4",
  tasse: "#fbf8f3",
  tasseOmbre: "#a9a6c8",
  mousse: "#ecd2a8",
  cafe: "#7a4a2b",
  ruban: "#f06aa6",
};

/** Un tutu : un disque de tulle plissé, au bord festonné. */
function tutu(rInt: number, rExt: number, epaisseur: number, festons: number) {
  const g = revolution(
    [
      [rInt, epaisseur],
      [rExt * 0.7, epaisseur * 0.5],
      [rExt, -epaisseur * 0.3],
      [rExt * 0.98, -epaisseur * 0.9],
      [rExt * 0.65, -epaisseur * 0.8],
      [rInt, -epaisseur],
    ],
    64,
  );
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const t = Math.max(0, (r - rInt) / (rExt - rInt));
    const a = Math.atan2(z, x);
    p.setY(i, p.getY(i) + Math.sin(a * festons) * 0.022 * t * t - t * t * 0.03);
  }
  g.computeVertexNormals();
  return g;
}

export function construireBallerina(couleurs = COULEURS_BALLERINA) {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.09,
    cuisse: 0.44,
    mollet: 0.43,
    ecartHanches: 0.08,
    torse: 0.37,
    epaules: 0.165,
    cou: 0.08,
    bras: 0.28,
    avantBras: 0.26,
  });
  const { mat, faire } = atelier(pantin);
  const peau = mat(k.peau, { ombre: k.peauOmbre, trame: 0.3 });
  const satin = mat(k.chaussons, { brillance: 0.6 });

  // ——— Le justaucorps : décolleté en cœur, fines bretelles
  const motif = texture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = k.peau;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 0);
    ctx.lineTo(w * 0.7, 0);
    ctx.lineTo(w * 0.62, h * 0.18);
    ctx.quadraticCurveTo(w * 0.56, h * 0.32, w * 0.5, h * 0.24);
    ctx.quadraticCurveTo(w * 0.44, h * 0.32, w * 0.38, h * 0.18);
    ctx.fill();
    ctx.strokeStyle = k.ruban;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.18);
    ctx.quadraticCurveTo(w * 0.56, h * 0.32, w * 0.5, h * 0.24);
    ctx.quadraticCurveTo(w * 0.44, h * 0.32, w * 0.38, h * 0.18);
    ctx.stroke();
    // Le dos nu
    ctx.fillStyle = k.peau;
    ctx.fillRect(0, 0, w * 0.15, h * 0.3);
    ctx.fillRect(w * 0.85, 0, w * 0.15, h * 0.3);
  });
  const buste = faire(
    revolution(
      profilLisse([
        [0.11, -0.03],
        [0.1, 0.1],
        [0.125, 0.22],
        [0.14, 0.3],
        [0.12, 0.36],
        [0.05, 0.39],
      ]),
      28,
    ),
    mat(k.justaucorps, { ombre: k.justaucorpsOmbre, carte: motif, rim: 1.2 }),
  );
  buste.scale.set(1, 1, 0.75);
  pantin.attacher("torse", buste);

  // ——— Le tutu, en deux couches, et la culotte
  pantin.attacher("bassin", faire(ellipsoide(0.13, 0.11, 0.11), mat(k.justaucorps, { ombre: k.justaucorpsOmbre })), 0, -0.02, 0);
  const tutuBas = faire(tutu(0.12, 0.46, 0.05, 15), mat(k.tutu, { ombre: "#c3739f", cote: THREE.DoubleSide, trame: 0.8 }), 0.9, true);
  tutuBas.scale.set(1, 1, 0.85);
  pantin.attacher("bassin", tutuBas, 0, 0.02, 0);
  const tutuHaut = faire(tutu(0.12, 0.36, 0.04, 11), mat(k.tutuClair, { ombre: "#d6a3c4", cote: THREE.DoubleSide }), 0.8, true);
  tutuHaut.scale.set(1, 1, 0.85);
  tutuHaut.rotation.y = 0.15;
  pantin.attacher("bassin", tutuHaut, 0, 0.06, 0);

  // ——— Le cou et une soucoupe en guise de col
  pantin.attacher("cou", faire(membre(0.04, 0.045, 0.1), peau), 0, 0.08, 0);
  const soucoupe = faire(
    revolution(
      [
        [0.0, -0.012],
        [0.15, -0.01],
        [0.2, 0.02],
        [0.19, 0.03],
        [0.13, 0.005],
        [0.0, 0.01],
      ],
      40,
    ),
    mat(k.tasse, { ombre: k.tasseOmbre, brillance: 0.5 }),
  );
  pantin.attacher("tete", soucoupe, 0, 0.0, 0);

  // ——— La tête : une tasse de cappuccino, avec un visage peint dessus
  const tasse = faire(
    revolution(
      profilLisse([
        [0.0, 0.01],
        [0.09, 0.012],
        [0.115, 0.05],
        [0.145, 0.16],
        [0.165, 0.27],
        [0.16, 0.285],
      ]),
      40,
    ),
    mat(k.tasse, { ombre: k.tasseOmbre, brillance: 0.7, rim: 1.2 }),
  );
  pantin.attacher("tete", tasse);
  const bord = faire(new THREE.TorusGeometry(0.16, 0.013, 8, 40), mat(k.tasse, { ombre: k.tasseOmbre, brillance: 0.8 }));
  bord.rotation.x = Math.PI / 2;
  pantin.attacher("tete", bord, 0, 0.283, 0);
  // La mousse, bombée, avec un cœur dessiné dans le latte
  const latte = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = k.cafe;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6e6c9";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = k.cafe;
    ctx.beginPath();
    const cx = w / 2;
    const cy = h * 0.55;
    ctx.moveTo(cx, cy + 40);
    ctx.bezierCurveTo(cx - 70, cy - 10, cx - 40, cy - 70, cx, cy - 30);
    ctx.bezierCurveTo(cx + 40, cy - 70, cx + 70, cy - 10, cx, cy + 40);
    ctx.fill();
  });
  const mousseGeo = new THREE.SphereGeometry(0.152, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  // Projette la texture vue de dessus sur le dôme.
  const pos = mousseGeo.getAttribute("position") as THREE.BufferAttribute;
  const uv = mousseGeo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.304 + 0.5, -pos.getZ(i) / 0.304 + 0.5);
  mousseGeo.scale(1, 0.25, 1);
  const mousse = faire(mousseGeo, mat(k.mousse, { ombre: "#b58b62", carte: latte, trame: 0 }), 0.6);
  pantin.attacher("tete", mousse, 0, 0.27, 0);
  // L'anse, sur le côté
  const anse = faire(new THREE.TorusGeometry(0.065, 0.02, 10, 20, Math.PI * 1.25), mat(k.tasse, { ombre: k.tasseOmbre, brillance: 0.5 }));
  anse.rotation.z = Math.PI / 2 + 0.95;
  pantin.attacher("tete", anse, -0.16, 0.16, 0);
  // Le visage, sur l'avant de la tasse
  const visages = peindreVisages({
    iris: ["#4b2412", "#c9772f"],
    yeux: 1.5,
    ecartYeux: 0.16,
    hauteurYeux: 0.45,
    sourcils: 0.9,
    bouche: 0.75,
    peau: k.tasse,
    joues: true,
  });
  const matVisage = new THREE.MeshBasicMaterial({
    map: visages.neutre,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.124, 0.22, 32, 1, true, -0.95, 1.9), matVisage);
  face.renderOrder = 1;
  pantin.attacher("tete", face, 0, 0.145, 0);
  pantin.ajouterVisages(matVisage, visages);
  // Un nuage de vapeur au-dessus de la tasse
  const vapeur = mat("#ffffff", { ombre: "#c9cfe8", trame: 0 });
  for (const [x, y, r] of [
    [0.02, 0.36, 0.035],
    [-0.03, 0.41, 0.028],
    [0.03, 0.45, 0.02],
  ])
    pantin.attacher("tete", faire(ellipsoide(r, r, r), vapeur, 0.6), x, y, 0);

  // ——— Les bras fins, les mains ouvertes de danseuse
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`bras${cote}`, faire(ellipsoide(0.048, 0.05, 0.048), peau));
    pantin.attacher(`bras${cote}`, faire(membre(0.043, 0.034, 0.28), peau));
    pantin.attacher(`avantBras${cote}`, faire(membre(0.034, 0.027, 0.26), peau));
    const main = faire(ellipsoide(0.03, 0.055, 0.018), peau);
    pantin.attacher(`main${cote}`, main, 0, -0.045, 0);
  }

  // ——— Les jambes en collant, les chaussons de pointe et leurs rubans
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.072, 0.052, 0.44), mat(k.collant, { ombre: "#d79ab2" })));
    pantin.attacher(`mollet${cote}`, faire(membre(0.052, 0.033, 0.43), mat(k.collant, { ombre: "#d79ab2" })));
    const chausson = faire(ellipsoide(0.038, 0.06, 0.085), satin);
    chausson.rotation.x = 0.5;
    pantin.attacher(`pied${cote}`, chausson, 0, -0.035, 0.035);
    const ruban = faire(new THREE.TorusGeometry(0.036, 0.009, 6, 16), mat(k.ruban));
    ruban.rotation.x = Math.PI / 2;
    pantin.attacher(`mollet${cote}`, ruban, 0, -0.39, 0);
  }

  // ——— Les rubans du nœud, dans le dos, qui flottent
  const noeud = faire(ellipsoide(0.04, 0.03, 0.03), mat(k.ruban));
  pantin.attacher("torse", noeud, 0, 0.0, -0.09);
  for (const dx of [-0.03, 0.03]) {
    const r = new Chaine(pantin.os.torse, new THREE.Vector3(dx, 0, -0.1), 6, 0.1, (u) => 0.035 * (1 - u * 0.3), k.ruban, {
      aplati: 0.3,
      flotte: 0.8,
      derriere: -0.5,
      eclat: pantin.eclat,
    });
    pantin.chaines.push(r);
  }
  // La tasse est grosse : c'est elle qu'on reconnaît.
  pantin.os.tete.scale.setScalar(1.3);
  return pantin;
}
