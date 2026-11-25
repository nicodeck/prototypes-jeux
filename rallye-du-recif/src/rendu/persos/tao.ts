// Tao, « le Mécano » : pilote équilibré. Salopette orange (une bretelle défaite qui pend),
// t-shirt blanc, casquette à l'envers avec des lunettes de soudeur, cheveux châtains en épis,
// gros gants, chiffon rouge dans la poche, traces de cambouis.
import * as THREE from "three";
import { ellipsoide, membre, meche, profilLisse, revolution, Tube } from "../formes";
import { Chaine, Pantin } from "../pantin";
import { geometrieVisage, HAUTEUR, LARGEUR } from "../visage";
import { atelier, deformerTete, tete, texture } from "./commun";

export const COULEURS_TAO = {
  peau: "#f7cfa8",
  peauOmbre: "#d0866c",
  cheveux: "#8a5230",
  cheveuxOmbre: "#43221a",
  tshirt: "#f7f4ee",
  tshirtOmbre: "#a9a8cc",
  salopette: "#f27a1a",
  salopetteOmbre: "#a8402e",
  boutons: "#f2cf5b",
  casquette: "#2f66c9",
  casquetteOmbre: "#16306e",
  lunettes: "#454b58",
  verres: "#5fd6b4",
  gants: "#f2b632",
  gantsOmbre: "#b0652c",
  chiffon: "#e3232e",
  chiffonOmbre: "#8c0c2c",
  chaussures: "#34303a",
  coques: "#b8c2cc",
  cambouis: "#2b2430",
};

/** La palette du bot : salopette vert sapin, casquette framboise, cheveux noirs, gants crème. */
export const VARIANTE_TAO: typeof COULEURS_TAO = {
  ...COULEURS_TAO,
  peau: "#e9b48a",
  peauOmbre: "#b4705a",
  cheveux: "#2a2a35",
  cheveuxOmbre: "#0e0d16",
  tshirt: "#dfe5ee",
  tshirtOmbre: "#8a8fb8",
  salopette: "#2f9a6a",
  salopetteOmbre: "#164a52",
  casquette: "#e84a7a",
  casquetteOmbre: "#7a1a4a",
  verres: "#ffb347",
  gants: "#efe6d2",
  gantsOmbre: "#a88a78",
  chiffon: "#2f8ee0",
  chiffonOmbre: "#1a3f8a",
};

type V2 = [number, number];
type V3 = [number, number, number];

/**
 * La surface d'un buste de révolution aplati en profondeur (`kz`) : sert à poser dessus
 * des pièces épaisses qui en épousent la courbure (bavette, bretelles, poches).
 */
function surfaceBuste(points: V2[], kz: number) {
  const profil = profilLisse(points, 48);
  const rayon = (y: number) => {
    if (y <= profil[0][1]) return profil[0][0];
    for (let i = 1; i < profil.length; i++) {
      const [r1, y1] = profil[i];
      const [r0, y0] = profil[i - 1];
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
    }
    return profil[profil.length - 1][0];
  };
  const normale = (phi: number, y: number) => {
    const e = 0.004;
    const dr = (rayon(y + e) - rayon(y - e)) / (2 * e);
    return new THREE.Vector3(kz * Math.sin(phi), -kz * dr, Math.cos(phi)).normalize();
  };
  const point = (phi: number, y: number, ecart = 0) => {
    const r = rayon(y);
    const p = new THREE.Vector3(r * Math.sin(phi), y, kz * r * Math.cos(phi));
    return ecart ? p.addScaledVector(normale(phi, y), ecart) : p;
  };
  /**
   * Une pièce épaisse posée sur la surface : elle suit `chemin` (des points [angle, hauteur]),
   * avec une largeur, une épaisseur et un écart à la surface qui peuvent varier le long du chemin.
   * Sa face extérieure reçoit la texture (u en travers, v le long du chemin).
   */
  const plaque = (
    chemin: V2[],
    largeur: (v: number) => number,
    epaisseur: number,
    ecart: (v: number) => number,
    nu = 6,
    nv = 18,
  ) => {
    const courbe = new THREE.SplineCurve(chemin.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.BoxGeometry(1, 1, 1, nu, nv, 1);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const c = new THREE.Vector2();
    const sur = (v: number) => {
      courbe.getPoint(Math.min(1, Math.max(0, v)), c);
      return point(c.x, c.y);
    };
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getY(i) + 0.5;
      const w = pos.getZ(i) + 0.5;
      courbe.getPoint(v, c);
      const centre = point(c.x, c.y);
      const tangente = sur(v + 0.01).sub(sur(v - 0.01)).normalize();
      const travers = tangente.cross(normale(c.x, c.y)).normalize();
      const q = centre.addScaledVector(travers, u * largeur(v));
      const phi = Math.atan2(q.x, q.z / kz);
      const p = point(phi, q.y, ecart(v) + w * epaisseur);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  };
  /** Oriente un objet (axe Y) selon la normale de la surface, et le pose dessus. */
  const poser = (objet: THREE.Object3D, phi: number, y: number, ecart: number) => {
    objet.position.copy(point(phi, y, ecart));
    objet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normale(phi, y));
    return objet;
  };
  return { profil, rayon, point, normale, plaque, poser };
}

/** Une tache de cambouis : quelques ellipses sombres irrégulières. */
function tache(ctx: CanvasRenderingContext2D, x: number, y: number, taille: number, couleur: string, graine = 1) {
  let s = graine * 9301 + 49297;
  const alea = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = couleur;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(
      x + (alea() - 0.5) * taille * 1.4,
      y + (alea() - 0.5) * taille * 0.7,
      taille * (0.25 + alea() * 0.35),
      taille * (0.12 + alea() * 0.2),
      (alea() - 0.5) * 0.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function construireTao(couleurs = COULEURS_TAO): Pantin {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.08,
    cuisse: 0.44,
    mollet: 0.43,
    ecartHanches: 0.11,
    torse: 0.46,
    epaules: 0.23,
    cou: 0.075,
    bras: 0.3,
    avantBras: 0.28,
  });
  const { mat, faire } = atelier(pantin);
  const peau = mat(k.peau, { ombre: k.peauOmbre, rim: 1, trame: 0.35 });
  const cheveux = mat(k.cheveux, { ombre: k.cheveuxOmbre, brillance: 0.8, rim: 1.2 });
  const tshirt = mat(k.tshirt, { ombre: k.tshirtOmbre });
  const salopette = mat(k.salopette, { ombre: k.salopetteOmbre });
  const metal = mat(k.boutons, { brillance: 1 });
  const casquette = mat(k.casquette, { ombre: k.casquetteOmbre, rim: 1.2 });
  const gants = mat(k.gants, { ombre: k.gantsOmbre });
  const chiffon = mat(k.chiffon, { ombre: k.chiffonOmbre, cote: THREE.DoubleSide });
  const chaussures = mat(k.chaussures, { rim: 1.4 });

  // ——— Le buste : un t-shirt blanc (col rond, un écrou peint dans le dos).
  const kz = 0.76;
  const profilBuste: V2[] = [
    [0.135, -0.02],
    [0.148, 0.1],
    [0.18, 0.25],
    [0.2, 0.36],
    [0.172, 0.425],
    [0.065, 0.47],
  ];
  const corps = surfaceBuste(profilBuste, kz);
  const motifTshirt = texture(512, 256, (ctx, w, h) => {
    // Plis du tissu sur les côtés
    ctx.strokeStyle = "rgba(27,18,32,0.45)";
    ctx.lineWidth = 3;
    for (const x of [0.27, 0.73]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.25);
      ctx.quadraticCurveTo(w * (x + 0.015), h * 0.32, w * (x - 0.01), h * 0.4);
      ctx.stroke();
    }
    // L'écrou dans le dos (le dos est aux deux bords de la texture)
    for (const x of [0, w]) {
      ctx.save();
      ctx.translate(x, h * 0.27);
      ctx.fillStyle = k.salopette;
      ctx.strokeStyle = "#1b1220";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 30);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = k.tshirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });
  const buste = faire(revolution(profilLisse(profilBuste), 28), mat(k.tshirt, { ombre: k.tshirtOmbre, carte: motifTshirt }));
  buste.scale.set(1, 1, kz);
  pantin.attacher("torse", buste);

  // ——— La salopette : la ceinture du pantalon, la bavette devant, un empiècement derrière.
  const hautCeinture = 0.16;
  const profilSalopette: V2[] = [[0.06, -0.08]];
  for (let y = -0.06; y <= hautCeinture + 1e-6; y += 0.02) profilSalopette.push([corps.rayon(y) + 0.014, y]);
  profilSalopette.push([corps.rayon(hautCeinture + 0.02) - 0.03, hautCeinture + 0.025]);
  const motifSalopette = texture(512, 256, (ctx, w, h) => {
    // Coutures sur les côtés
    ctx.strokeStyle = "rgba(255,236,190,0.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    for (const x of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.1);
      ctx.lineTo(w * x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Taches de cambouis, et une main essuyée sur la hanche.
    tache(ctx, w * 0.62, h * 0.55, 40, k.cambouis, 3);
    tache(ctx, w * 0.12, h * 0.4, 30, k.cambouis, 7);
    ctx.fillStyle = k.cambouis;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.84 + i * 0.022), h * (0.42 + i * 0.03), 6, 26, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  const ceintureSalopette = faire(revolution(profilSalopette, 28), mat(k.salopette, { ombre: k.salopetteOmbre, carte: motifSalopette }));
  ceintureSalopette.scale.set(1, 1, kz);
  pantin.attacher("torse", ceintureSalopette);
  const ourlet = faire(new THREE.TorusGeometry(corps.rayon(hautCeinture) + 0.014, 0.011, 8, 32), salopette);
  ourlet.rotation.x = Math.PI / 2;
  ourlet.scale.set(1, kz, 1);
  pantin.attacher("torse", ourlet, 0, hautCeinture, 0);

  // La bavette, avec sa poche, ses coutures et une trace de cambouis.
  const motifBavette = texture(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = "rgba(255,236,190,0.95)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 1.2);
    // La poche
    ctx.strokeRect(w * 0.26, h * 0.2, w * 0.48, h * 0.34);
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(27,18,32,0.8)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.17);
    ctx.lineTo(w * 0.78, h * 0.17);
    ctx.lineTo(w * 0.78, h * 0.58);
    ctx.lineTo(w * 0.22, h * 0.58);
    ctx.closePath();
    ctx.stroke();
    tache(ctx, w * 0.3, h * 0.78, 34, k.cambouis, 11);
  });
  const bavette = faire(
    corps.plaque(
      [
        [0, 0.11],
        [0, 0.24],
        [0, 0.37],
      ],
      (v) => 0.25 - 0.05 * v,
      0.012,
      (v) => 0.016 - 0.008 * THREE.MathUtils.smoothstep(v, 0.25, 0.5),
      8,
    ),
    mat(k.salopette, { ombre: k.salopetteOmbre, carte: motifBavette }),
    1,
    true,
  );
  pantin.attacher("torse", bavette);
  // Un tournevis dans la poche de la bavette
  const tournevis = new THREE.Group();
  tournevis.add(faire(membre(0.014, 0.014, 0.07, 10), mat("#e8d24a"), 1));
  const tige = faire(membre(0.005, 0.005, 0.05, 6), mat("#c9ced6", { brillance: 1 }), 1);
  tige.rotation.x = Math.PI;
  tournevis.add(tige);
  corps.poser(tournevis, 0.06, 0.34, 0.03);
  tournevis.rotateX(-1.2);
  tournevis.rotateZ(0.3);
  pantin.attacher("torse", tournevis, tournevis.position.x, tournevis.position.y, tournevis.position.z);

  // L'empiècement du dos, d'où partent les bretelles.
  const dos = faire(
    corps.plaque(
      [
        [Math.PI, 0.09],
        [Math.PI, 0.165],
        [Math.PI, 0.24],
      ],
      (v) => 0.22 - 0.07 * v,
      0.012,
      () => 0.016,
      8,
      10,
    ),
    mat(k.salopette, { ombre: k.salopetteOmbre, carte: motifBavette }),
    1,
    true,
  );
  pantin.attacher("torse", dos);

  // La bretelle attachée : du dos, par-dessus l'épaule, jusqu'au bouton de la bavette.
  const bretelle = faire(
    corps.plaque(
      [
        [Math.PI + 0.32, 0.215],
        [Math.PI + 0.42, 0.33],
        [Math.PI + 0.95, 0.425],
        [(Math.PI * 3) / 2, 0.448],
        [Math.PI * 2 - 0.85, 0.425],
        [Math.PI * 2 - 0.45, 0.345],
      ],
      () => 0.046,
      0.011,
      (v) => 0.006 + 0.02 * THREE.MathUtils.smoothstep(v, 0.85, 1) + 0.022 * (1 - THREE.MathUtils.smoothstep(v, 0, 0.12)),
      3,
      30,
    ),
    salopette,
    1,
    true,
  );
  pantin.attacher("torse", bretelle);
  // Les boutons de la bavette (celui de la bretelle défaite reste seul) et du dos.
  for (const [phi, y, e] of [
    [-0.45, 0.34, 0.045],
    [0.45, 0.34, 0.028],
    [Math.PI + 0.32, 0.215, 0.05],
    [Math.PI - 0.32, 0.215, 0.028],
  ] as V3[]) {
    const bouton = faire(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 14), metal, 1, true);
    corps.poser(bouton, phi, y, e);
    pantin.attacher("torse", bouton, bouton.position.x, bouton.position.y, bouton.position.z);
  }

  // La poche arrière et le chiffon rouge qui en dépasse.
  const phiPoche = Math.PI - 0.72;
  const poche = faire(
    corps.plaque(
      [
        [phiPoche, -0.02],
        [phiPoche, 0.04],
        [phiPoche, 0.1],
      ],
      () => 0.085,
      0.01,
      () => 0.022,
      4,
      6,
    ),
    salopette,
    1,
    true,
  );
  pantin.attacher("torse", poche);
  const ouverture = corps.point(phiPoche, 0.09, 0.03);
  const dehors = corps.normale(phiPoche, 0.09);
  // Repère local de la poche : x le long du dos, z vers l'extérieur.
  const ex = new THREE.Vector3(0, 1, 0).cross(dehors).normalize();
  const local = ([x, y, z]: V3) => ouverture.clone().addScaledVector(ex, x).add(new THREE.Vector3(0, y, 0)).addScaledVector(dehors, z);
  // Le chiffon roulé en boule dans la poche…
  const boule = faire(ellipsoide(0.05, 0.035, 0.03), chiffon);
  boule.position.copy(local([0, 0.012, -0.005]));
  boule.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dehors);
  boule.rotateZ(0.2);
  pantin.attacher("torse", boule, boule.position.x, boule.position.y, boule.position.z);
  // …et deux pans qui retombent par-dessus.
  const pans: [V3[], number][] = [
    [
      [
        [-0.015, 0.03, 0.0],
        [-0.02, 0.05, 0.025],
        [-0.03, 0.0, 0.045],
        [-0.045, -0.1, 0.05],
      ],
      0.042,
    ],
    [
      [
        [0.025, 0.03, 0.0],
        [0.045, 0.04, 0.02],
        [0.065, -0.02, 0.035],
        [0.075, -0.075, 0.04],
      ],
      0.034,
    ],
  ];
  for (const [pan, large] of pans) {
    const tube = new Tube(12, 10, (u) => large * (1 - u * 0.25) * (u < 0.12 ? 0.55 + u * 3.7 : 1), 0.22);
    tube.suivre(pan.map(local), dehors);
    pantin.attacher("torse", faire(tube.geometrie, chiffon, 0.9));
  }

  // ——— Le bassin et les jambes de la salopette
  pantin.attacher("bassin", faire(ellipsoide(0.165, 0.125, 0.127), salopette), 0, -0.03, 0);

  // ——— Le cou et le col du t-shirt
  pantin.attacher("cou", faire(membre(0.052, 0.056, 0.1), peau), 0, 0.09, 0);
  const col = faire(new THREE.TorusGeometry(0.066, 0.016, 10, 24), tshirt);
  col.rotation.x = Math.PI / 2 + 0.1;
  col.scale.set(1, 0.9, 1);
  pantin.attacher("cou", col, 0, 0.0, -0.004);

  // ——— La tête
  const r = 0.17;
  const yTete = 0.145;
  const crane = tete(
    pantin,
    r,
    0.3,
    peau,
    {
      iris: ["#1f4a1a", "#86cf4a"],
      yeux: 1.28,
      ecartYeux: 0.16,
      hauteurYeux: 0.48,
      sourcils: 1.25,
      bouche: 0.95,
      peau: k.peau,
    },
    yTete,
  );
  // Par-dessus le visage : taches de rousseur et trace de cambouis sur la joue.
  const motifJoues = texture(LARGEUR, HAUTEUR, (ctx, w, h) => {
    const cx = w / 2;
    const yJ = h * 0.48 + 62;
    ctx.fillStyle = "rgba(170,90,60,0.7)";
    for (const s of [-1, 1])
      for (const [dx, dy] of [
        [-12, 0],
        [4, -6],
        [16, 4],
        [0, 10],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + s * (w * 0.16 + dx), yJ + dy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    // Le cambouis : une traînée laissée par un revers de gant, de l'oreille vers la joue.
    ctx.fillStyle = k.cambouis;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.32, yJ - 14);
    ctx.quadraticCurveTo(cx + w * 0.25, yJ - 10, cx + w * 0.185, yJ + 2);
    ctx.quadraticCurveTo(cx + w * 0.24, yJ + 4, cx + w * 0.26, yJ + 12);
    ctx.quadraticCurveTo(cx + w * 0.28, yJ + 20, cx + w * 0.32, yJ + 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + w * 0.2, yJ + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  motifJoues.wrapS = THREE.ClampToEdgeWrapping;
  const joues = new THREE.Mesh(
    deformerTete(geometrieVisage(r * 1.006), r * 1.006, 0.3),
    new THREE.MeshBasicMaterial({
      map: motifJoues,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  joues.renderOrder = 2;
  crane.add(joues);

  // Les cheveux : une calotte sous la casquette, des épis qui dépassent de partout.
  const calotte = mat(k.cheveux, { ombre: k.cheveuxOmbre, rim: 1.2 });
  pantin.attacher("tete", faire(ellipsoide(0.17, 0.158, 0.17), calotte), 0, yTete + 0.0, -0.02);
  const epis: V3[][] = [];
  // Frange en pointes sous le bord de la casquette
  for (const [x, l] of [
    [-0.11, 0.9],
    [-0.055, 1.1],
    [0.0, 1],
    [0.055, 1.15],
    [0.105, 0.85],
  ])
    epis.push([
      [x, yTete + 0.1, 0.12],
      [x * 1.05, yTete + 0.07, 0.165],
      [x * 1.12 + 0.01, yTete + 0.06 - 0.05 * l, 0.182],
    ]);
  // Sur les côtés, devant les oreilles et au-dessus
  for (const s of [-1, 1]) {
    epis.push([
      [s * 0.15, yTete + 0.06, 0.05],
      [s * 0.172, yTete - 0.0, 0.07],
      [s * 0.166, yTete - 0.065, 0.078],
    ]);
    epis.push([
      [s * 0.15, yTete - 0.0, -0.02],
      [s * 0.205, yTete - 0.005, -0.04],
      [s * 0.26, yTete - 0.04, -0.08],
    ]);
    epis.push([
      [s * 0.13, yTete - 0.06, -0.09],
      [s * 0.18, yTete - 0.09, -0.125],
      [s * 0.215, yTete - 0.14, -0.16],
    ]);
  }
  // Sur la nuque, sous la visière
  for (const x of [-0.1, -0.035, 0.035, 0.1])
    epis.push([
      [x, yTete - 0.085, -0.12],
      [x * 1.2, yTete - 0.12, -0.17],
      [x * 1.5, yTete - 0.17, -0.21],
    ]);
  for (const m of epis) pantin.attacher("tete", faire(meche(m, 0.048, 0.07), cheveux));
  // La touffe qui sort de l'ouverture de la casquette, sur le front
  for (const [x, h] of [
    [-0.045, 0.9],
    [0.0, 1.2],
    [0.05, 1],
  ])
    pantin.attacher(
      "tete",
      faire(
        meche(
          [
            [x, yTete + 0.15, 0.1],
            [x * 1.3, yTete + 0.2 + 0.03 * h, 0.15],
            [x * 1.8, yTete + 0.21 + 0.07 * h, 0.2 + 0.02 * h],
          ],
          0.045,
          0.07,
        ),
        cheveux,
      ),
    );

  // ——— La casquette, portée à l'envers, avec les lunettes de soudeur posées dessus.
  const R = 0.188;
  const casque = new THREE.Group();
  casque.position.set(0, yTete + 0.012, -0.006);
  casque.rotation.x = -0.32;
  pantin.attacher("tete", casque, casque.position.x, casque.position.y, casque.position.z);
  const forme = new THREE.Group();
  forme.scale.set(1, 0.97, 1.05);
  casque.add(forme);
  const motifCasquette = texture(512, 128, (ctx, w, h) => {
    // Les coutures des pans
    ctx.strokeStyle = "rgba(10,14,40,0.7)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = w * (i / 6 + 1 / 12);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // L'ouverture de la patte de réglage, à l'avant puisque la casquette est retournée
    const x = w * 0.25;
    ctx.fillStyle = k.cheveux;
    ctx.strokeStyle = "#1b1220";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 46, h);
    ctx.quadraticCurveTo(x - 44, h * 0.38, x, h * 0.36);
    ctx.quadraticCurveTo(x + 44, h * 0.38, x + 46, h);
    ctx.fill();
    ctx.stroke();
    // La patte en plastique et ses trous
    ctx.fillStyle = "#26222c";
    ctx.fillRect(x - 50, h * 0.8, 100, h * 0.2);
    ctx.fillStyle = "#6b6f7a";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x - 34 + i * 17, h * 0.9, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const dome = faire(
    new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(k.casquette, { ombre: k.casquetteOmbre, rim: 1.2, carte: motifCasquette, cote: THREE.DoubleSide }),
  );
  forme.add(dome);
  const bord = faire(new THREE.TorusGeometry(R, 0.013, 8, 40), casquette);
  bord.rotation.x = Math.PI / 2;
  forme.add(bord);
  const sommet = faire(ellipsoide(0.022, 0.014, 0.022), casquette);
  sommet.position.set(0, R, 0);
  forme.add(sommet);
  // La visière, derrière
  const visiere = faire(ellipsoide(0.125, 0.016, 0.115, 24, 10), casquette);
  visiere.position.set(0, -0.004, -R - 0.05);
  visiere.rotation.x = 0.2;
  forme.add(visiere);
  // Les lunettes : un élastique autour de la calotte et deux coques à verres ronds.
  const alpha = 0.98;
  const beta = 0.3;
  const bande = new THREE.Group();
  bande.rotation.x = -beta;
  forme.add(bande);
  const elastique = faire(new THREE.TorusGeometry(R * Math.sin(alpha) + 0.006, 0.014, 8, 40), mat("#3b2a24", { rim: 1.3 }));
  elastique.rotation.x = Math.PI / 2;
  elastique.position.y = R * Math.cos(alpha);
  bande.add(elastique);
  const lunettes = mat(k.lunettes, { brillance: 0.6, rim: 1.4 });
  const verres = mat(k.verres, { brillance: 1, rim: 1.5 });
  const pointsVerres: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    const phi = s * 0.44;
    const d = new THREE.Vector3(Math.sin(alpha) * Math.sin(phi), Math.cos(alpha), Math.sin(alpha) * Math.cos(phi));
    const coque = new THREE.Group();
    coque.position.copy(d).multiplyScalar(R + 0.012);
    coque.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    coque.add(faire(new THREE.CylinderGeometry(0.046, 0.054, 0.045, 22), lunettes, 1, true));
    const cerclage = faire(new THREE.TorusGeometry(0.044, 0.011, 8, 22), metal);
    cerclage.rotation.x = Math.PI / 2;
    cerclage.position.y = 0.024;
    coque.add(cerclage);
    const verre = faire(ellipsoide(0.036, 0.012, 0.036), verres, 0.6);
    verre.position.y = 0.023;
    coque.add(verre);
    bande.add(coque);
    pointsVerres.push(d.clone().multiplyScalar(R + 0.03));
  }
  // Le pont entre les deux coques
  const milieu = pointsVerres[0].clone().add(pointsVerres[1]).multiplyScalar(0.5).multiplyScalar(1.06);
  bande.add(
    faire(
      meche(
        [pointsVerres[0].toArray() as V3, milieu.toArray() as V3, pointsVerres[1].toArray() as V3],
        0.014,
        1,
      ),
      lunettes,
    ),
  );

  // ——— Les bras : manches courtes, bras nus, gros gants de travail
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`bras${cote}`, faire(ellipsoide(0.075, 0.07, 0.07), tshirt), 0, -0.01, 0);
    pantin.attacher(`bras${cote}`, faire(membre(0.07, 0.066, 0.13), tshirt));
    const manche = faire(new THREE.TorusGeometry(0.066, 0.012, 8, 18), tshirt);
    manche.rotation.x = Math.PI / 2;
    pantin.attacher(`bras${cote}`, manche, 0, -0.135, 0);
    pantin.attacher(`bras${cote}`, faire(membre(0.054, 0.047, 0.3), peau));
    pantin.attacher(`avantBras${cote}`, faire(membre(0.049, 0.045, 0.22), peau));
    // Le gant : une manchette évasée, une grosse main, un pouce
    const manchette = faire(membre(0.06, 0.07, 0.09, 16), gants);
    pantin.attacher(`avantBras${cote}`, manchette, 0, -0.18, 0);
    const bordManchette = faire(new THREE.TorusGeometry(0.066, 0.013, 8, 18), mat(k.gantsOmbre));
    bordManchette.rotation.x = Math.PI / 2;
    pantin.attacher(`avantBras${cote}`, bordManchette, 0, -0.19, 0);
    const s = cote === "D" ? -1 : 1;
    const poing = new THREE.Group();
    poing.add(faire(ellipsoide(0.068, 0.07, 0.06), gants));
    const doigts = faire(ellipsoide(0.064, 0.042, 0.055), gants);
    doigts.position.set(0, -0.052, 0.028);
    poing.add(doigts);
    const pouce = faire(ellipsoide(0.025, 0.042, 0.025), gants);
    pouce.position.set(-s * 0.055, -0.02, 0.04);
    pouce.rotation.z = s * 0.4;
    poing.add(pouce);
    pantin.attacher(`main${cote}`, poing, 0, -0.045, 0);
  }

  // ——— Les jambes : salopette ample, bas retroussés, chaussures de sécurité
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.095, 0.078, 0.44), salopette));
    pantin.attacher(`mollet${cote}`, faire(membre(0.08, 0.072, 0.37), salopette));
    const revers = faire(new THREE.TorusGeometry(0.075, 0.024, 8, 20), salopette);
    revers.rotation.x = Math.PI / 2;
    pantin.attacher(`mollet${cote}`, revers, 0, -0.33, 0);
    const chaussure = new THREE.Group();
    const tige = faire(membre(0.068, 0.07, 0.07), chaussures);
    tige.position.set(0, 0.04, -0.005);
    chaussure.add(tige);
    const dessus = faire(ellipsoide(0.074, 0.06, 0.135), chaussures);
    dessus.position.set(0, -0.015, 0.045);
    chaussure.add(dessus);
    const coque = faire(ellipsoide(0.068, 0.045, 0.06), mat(k.coques, { brillance: 0.7 }));
    coque.position.set(0, -0.02, 0.13);
    chaussure.add(coque);
    const semelle = faire(ellipsoide(0.08, 0.03, 0.145), mat("#e8b23a"));
    semelle.position.set(0, -0.058, 0.045);
    chaussure.add(semelle);
    pantin.attacher(`pied${cote}`, chaussure);
  }

  // ——— La bretelle défaite, qui pend dans le dos
  const attacheBretelle = corps.point(Math.PI - 0.32, 0.215, 0.03);
  const pendante = new Chaine(pantin.os.torse, attacheBretelle, 5, 0.07, () => 0.024, k.salopette, {
    aplati: 0.3,
    flotte: 0.25,
    derriere: 0,
    eclat: pantin.eclat,
  });
  (pendante.mesh.material as THREE.ShaderMaterial).uniforms.uOmbre.value.set(k.salopetteOmbre);
  pantin.chaines.push(pendante);

  return pantin;
}
