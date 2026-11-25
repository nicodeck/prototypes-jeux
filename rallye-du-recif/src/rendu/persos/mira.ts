// Mira, « la Plongeuse » : pilote technique. Fine et élancée, peau mate, combinaison de plongée
// turquoise et noire, masque relevé sur le front, longue tresse qui flotte, collier de coquillages.
import * as THREE from "three";
import { ellipsoide, membre, meche, profilLisse, revolution } from "../formes";
import { Chaine, Pantin } from "../pantin";
import { geometrieVisage, HAUTEUR, LARGEUR } from "../visage";
import { atelier, deformerTete, tete, texture } from "./commun";

export const COULEURS_MIRA = {
  peau: "#c98b62",
  peauOmbre: "#8b4c46",
  cheveux: "#2e1b28",
  cheveuxOmbre: "#0d060d",
  combi: "#1fc2bd",
  combiOmbre: "#0d6380",
  noir: "#232733",
  coutures: "#e6fbf6",
  masque: "#ffcc3a",
  masqueOmbre: "#c0612e",
  verre: "#c4f1ff",
  coquillages: "#fff0da",
  coquillagesRose: "#f5a596",
  cordon: "#7a4a2e",
  zinc: "#f4fbff",
};

/** La palette du bot : combinaison corail, cheveux couleur sable, masque turquoise. */
export const VARIANTE_MIRA: typeof COULEURS_MIRA = {
  ...COULEURS_MIRA,
  peau: "#a8694a",
  peauOmbre: "#6e3a3a",
  cheveux: "#e2c58c",
  cheveuxOmbre: "#9c6a4a",
  combi: "#ff6a4a",
  combiOmbre: "#9a2448",
  noir: "#262043",
  masque: "#36d1c4",
  masqueOmbre: "#1a6a80",
  coquillagesRose: "#9fd8ff",
  zinc: "#ffe0f0",
};

type V3 = [number, number, number];

export function construireMira(couleurs = COULEURS_MIRA): Pantin {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.07,
    cuisse: 0.45,
    mollet: 0.45,
    ecartHanches: 0.088,
    torse: 0.45,
    epaules: 0.195,
    cou: 0.09,
    bras: 0.31,
    avantBras: 0.28,
  });
  const { mat, faire } = atelier(pantin);
  const peau = mat(k.peau, { ombre: k.peauOmbre, rim: 1.1, trame: 0.4 });
  const cheveux = mat(k.cheveux, { ombre: k.cheveuxOmbre, brillance: 0.9, rim: 1.3 });
  const combi = mat(k.combi, { ombre: k.combiOmbre, rim: 1.2 });
  const noir = mat(k.noir, { rim: 1.2 });
  const masque = mat(k.masque, { ombre: k.masqueOmbre, rim: 1.2 });

  /** Une couture de combinaison : un trait pointillé clair. */
  const couture = (ctx: CanvasRenderingContext2D, trace: () => void, largeur = 3) => {
    ctx.save();
    ctx.strokeStyle = k.coutures;
    ctx.lineWidth = largeur;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    trace();
    ctx.stroke();
    ctx.restore();
  };

  // ——— Le buste : la combinaison. Panneaux noirs sur les côtés et les épaules, vagues peintes
  // dans le dos, fermeture éclair et son cordon.
  const motifCombi = texture(512, 512, (ctx, w, h) => {
    // Les épaules noires, au bord ondulé
    ctx.fillStyle = k.noir;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.26);
    for (let i = 8; i >= 0; i--) {
      const x = (w * i) / 8;
      ctx.quadraticCurveTo(x + w / 16, h * (i % 2 ? 0.2 : 0.3), x, h * 0.26);
    }
    ctx.closePath();
    ctx.fill();
    // Les flancs noirs, qui s'affinent vers la taille
    for (const c of [0.25, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(w * (c - 0.06), h * 0.24);
      ctx.quadraticCurveTo(w * (c - 0.02), h * 0.6, w * (c - 0.07), h);
      ctx.lineTo(w * (c + 0.07), h);
      ctx.quadraticCurveTo(w * (c + 0.02), h * 0.6, w * (c + 0.06), h * 0.24);
      ctx.fill();
      couture(ctx, () => {
        ctx.moveTo(w * (c - 0.065), h * 0.25);
        ctx.quadraticCurveTo(w * (c - 0.025), h * 0.6, w * (c - 0.075), h);
        ctx.moveTo(w * (c + 0.065), h * 0.25);
        ctx.quadraticCurveTo(w * (c + 0.025), h * 0.6, w * (c + 0.075), h);
      });
    }
    // La couture des épaules
    couture(ctx, () => {
      ctx.moveTo(0, h * 0.27);
      for (let i = 0; i <= 8; i++) {
        const x = (w * i) / 8;
        ctx.quadraticCurveTo(x - w / 16, h * (i % 2 ? 0.31 : 0.21), x, h * 0.27);
      }
    });
    // Devant : une bande claire en diagonale
    ctx.strokeStyle = k.coutures;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.75);
    ctx.lineTo(w * 0.6, h * 0.36);
    ctx.stroke();
    ctx.strokeStyle = k.noir;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.39, h * 0.8);
    ctx.lineTo(w * 0.63, h * 0.41);
    ctx.stroke();
    // Dans le dos (aux deux bords de la texture) : une vague qui s'enroule, et la fermeture.
    for (const x0 of [0, w]) {
      ctx.save();
      ctx.translate(x0, 0);
      ctx.fillStyle = k.noir;
      ctx.strokeStyle = k.coutures;
      ctx.lineWidth = 5;
      for (const [dy, e] of [
        [0.66, 1],
        [0.84, 0.8],
      ]) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.2, h * (dy + 0.1));
        ctx.quadraticCurveTo(-w * 0.12 * e, h * (dy - 0.02), -w * 0.03, h * (dy - 0.06 * e));
        ctx.quadraticCurveTo(w * 0.06 * e, h * (dy - 0.12 * e), w * 0.1 * e, h * (dy - 0.03));
        ctx.quadraticCurveTo(w * 0.07 * e, h * (dy - 0.07 * e), w * 0.03 * e, h * (dy - 0.03));
        ctx.quadraticCurveTo(w * 0.07 * e, h * (dy + 0.05), w * 0.2, h * (dy + 0.1));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // La fermeture éclair
      ctx.fillStyle = "#11141c";
      ctx.fillRect(-7, 0, 14, h * 0.62);
      ctx.strokeStyle = "#9aa4b4";
      ctx.lineWidth = 3;
      for (let y = 6; y < h * 0.62; y += 9) {
        ctx.beginPath();
        ctx.moveTo(-6, y);
        ctx.lineTo(6, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
  const kz = 0.74;
  const buste = faire(
    revolution(
      profilLisse([
        [0.12, -0.02],
        [0.128, 0.08],
        [0.12, 0.17],
        [0.15, 0.28],
        [0.172, 0.35],
        [0.176, 0.395],
        [0.148, 0.43],
        [0.055, 0.46],
      ]),
      28,
    ),
    mat(k.combi, { ombre: k.combiOmbre, rim: 1.2, carte: motifCombi }),
  );
  buste.scale.set(1, 1, kz);
  pantin.attacher("torse", buste);
  // Le curseur de la fermeture et son cordon, en haut du dos
  const curseur = faire(ellipsoide(0.018, 0.026, 0.01), mat("#9aa4b4", { brillance: 1 }));
  pantin.attacher("torse", curseur, 0, 0.405, -0.118);
  pantin.attacher(
    "torse",
    faire(
      meche(
        [
          [0, 0.4, -0.125],
          [0.012, 0.36, -0.138],
          [0.03, 0.31, -0.138],
          [0.045, 0.26, -0.135],
        ],
        0.009,
        1,
        6,
      ),
      masque,
      0.8,
    ),
  );

  // ——— Le bassin : noir, une bande turquoise sur les hanches.
  const motifHanches = texture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = k.combi;
    ctx.fillRect(0, h * 0.18, w, h * 0.16);
    couture(ctx, () => {
      ctx.moveTo(0, h * 0.4);
      ctx.lineTo(w, h * 0.4);
    });
  });
  pantin.attacher("bassin", faire(ellipsoide(0.148, 0.115, 0.112), mat(k.noir, { rim: 1.5, carte: motifHanches })), 0, -0.03, 0);

  // ——— Le cou, le col de la combinaison et le collier de coquillages
  pantin.attacher("cou", faire(membre(0.046, 0.05, 0.11), peau), 0, 0.1, 0);
  const col = faire(membre(0.06, 0.064, 0.05, 18), noir);
  pantin.attacher("cou", col, 0, 0.03, -0.003);
  const bordCol = faire(new THREE.TorusGeometry(0.057, 0.01, 8, 22), combi);
  bordCol.rotation.x = Math.PI / 2;
  pantin.attacher("cou", bordCol, 0, 0.03, -0.003);
  // Le cordon fait le tour du col et retombe sur la poitrine.
  const tourCou = new THREE.CatmullRomCurve3(
    (
      [
        [0, 0.035, -0.07],
        [0.062, 0.022, -0.045],
        [0.088, -0.006, 0.02],
        [0.07, -0.042, 0.1],
        [0, -0.062, 0.14],
        [-0.07, -0.042, 0.1],
        [-0.088, -0.006, 0.02],
        [-0.062, 0.022, -0.045],
      ] as V3[]
    ).map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
  );
  pantin.attacher("cou", faire(new THREE.TubeGeometry(tourCou, 64, 0.0045, 6, true), mat(k.cordon), 0.6));
  const blanc = mat(k.coquillages, { brillance: 0.5 });
  const rose = mat(k.coquillagesRose, { brillance: 0.4 });
  const formeEventail = new THREE.Shape();
  formeEventail.moveTo(0, 0);
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14 - 0.5) * 2.2;
    const rr = i % 2 ? 0.032 : 0.038;
    formeEventail.lineTo(Math.cos(a) * rr, 0.004 + Math.sin(a) * rr);
  }
  formeEventail.closePath();
  const nombre = 9;
  for (let i = 0; i < nombre; i++) {
    // Les coquillages sont enfilés sur l'avant du cordon (u = 0,5 au milieu de la poitrine).
    const u = 0.5 + (i / (nombre - 1) - 0.5) * 0.4;
    const p = tourCou.getPointAt(u);
    const coquille = new THREE.Group();
    coquille.position.copy(p);
    coquille.rotation.y = Math.atan2(p.x, p.z);
    coquille.rotation.x = -0.25;
    if (i === (nombre - 1) / 2) {
      // Au milieu, une coquille en éventail au bord festonné
      const eventail = faire(
        new THREE.ExtrudeGeometry(formeEventail, { depth: 0.004, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }),
        rose,
        0.8,
        true,
      );
      eventail.position.set(0, 0, 0.004);
      coquille.add(eventail);
      const charniere = faire(ellipsoide(0.011, 0.008, 0.008), rose, 0.6);
      charniere.position.set(0, -0.002, 0.004);
      coquille.add(charniere);
    } else if (i % 2) {
      // Des porcelaines, rondes et lisses
      const porcelaine = faire(ellipsoide(0.011, 0.016, 0.009), blanc, 0.7);
      porcelaine.position.set(0, -0.014, 0.005);
      coquille.add(porcelaine);
    } else {
      // Entre les coquillages, des perles couleur lagon
      const perle = faire(ellipsoide(0.008, 0.008, 0.008), combi, 0.6);
      perle.position.set(0, -0.004, 0.003);
      coquille.add(perle);
    }
    pantin.attacher("cou", coquille, coquille.position.x, coquille.position.y, coquille.position.z);
  }

  // ——— La tête
  const r = 0.16;
  const yTete = 0.14;
  const crane = tete(
    pantin,
    r,
    0,
    peau,
    {
      iris: ["#0b4756", "#46d6cc"],
      yeux: 1.32,
      ecartYeux: 0.155,
      hauteurYeux: 0.48,
      sourcils: 0.85,
      bouche: 0.72,
      peau: k.peau,
    },
    yTete,
  );
  // Par-dessus le visage : la crème solaire blanche, un trait sur le nez et sur chaque pommette.
  const motifZinc = texture(LARGEUR, HAUTEUR, (ctx, w, h) => {
    const cx = w / 2;
    const y = h * 0.48 + 54;
    ctx.fillStyle = k.zinc;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx - 1, h * 0.6, 9, 22, 0.08, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.11, y + 4);
      ctx.quadraticCurveTo(cx + s * w * 0.17, y - 8, cx + s * w * 0.23, y - 4);
      ctx.quadraticCurveTo(cx + s * w * 0.17, y + 4, cx + s * w * 0.11, y + 4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  motifZinc.wrapS = THREE.ClampToEdgeWrapping;
  const zinc = new THREE.Mesh(
    deformerTete(geometrieVisage(r * 1.006), r * 1.006, 0),
    new THREE.MeshBasicMaterial({
      map: motifZinc,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  zinc.renderOrder = 2;
  crane.add(zinc);

  // Les cheveux : tirés en arrière vers la tresse, une frange balayée sur le côté, deux longues
  // mèches qui encadrent le visage. La calotte porte des reflets peints (pas de reflet rond).
  const clair = "#" + new THREE.Color(k.cheveux).lerp(new THREE.Color("#b9a0e0"), 0.16).getHexString();
  const motifCheveux = texture(512, 256, (ctx, w, h) => {
    // Les mèches peignées, du sommet vers la nuque
    ctx.strokeStyle = k.cheveuxOmbre;
    ctx.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      const x = (w * i) / 24;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.05);
      ctx.quadraticCurveTo(x + w * 0.02, h * 0.4, x + w * (i % 2 ? 0.01 : -0.01), h * (0.7 + (i % 3) * 0.06));
      ctx.stroke();
    }
    // L'anneau de lumière, en dents de scie
    ctx.fillStyle = clair;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    for (let i = 0; i <= 32; i++) ctx.lineTo((w * i) / 32, h * (i % 2 ? 0.25 : 0.3));
    for (let i = 32; i >= 0; i--) ctx.lineTo((w * i) / 32, h * (i % 2 ? 0.33 : 0.38));
    ctx.closePath();
    ctx.fill();
  });
  pantin.attacher(
    "tete",
    faire(ellipsoide(0.17, 0.168, 0.174, 28, 20), mat(k.cheveux, { ombre: k.cheveuxOmbre, rim: 1.3, carte: motifCheveux })),
    0,
    yTete + 0.016,
    -0.022,
  );
  const meches: [V3[], number][] = [
    // La frange, balayée vers un côté
    [
      [
        [0.05, yTete + 0.125, 0.12],
        [-0.03, yTete + 0.095, 0.162],
        [-0.11, yTete + 0.04, 0.15],
      ],
      0.042,
    ],
    [
      [
        [0.1, yTete + 0.11, 0.1],
        [0.03, yTete + 0.075, 0.166],
        [-0.045, yTete + 0.035, 0.168],
      ],
      0.036,
    ],
    [
      [
        [-0.04, yTete + 0.125, 0.11],
        [-0.11, yTete + 0.085, 0.135],
        [-0.165, yTete + 0.01, 0.1],
      ],
      0.04,
    ],
    // Dans le dos, vers la racine de la tresse
    ...[-1, 1].flatMap((s) => [
      [
        [
          [s * 0.11, yTete + 0.1, -0.13],
          [s * 0.07, yTete + 0.02, -0.188],
          [s * 0.015, yTete - 0.07, -0.172],
        ],
        0.03,
      ] as [V3[], number],
      [
        [
          [s * 0.15, yTete + 0.0, -0.08],
          [s * 0.1, yTete - 0.05, -0.15],
          [s * 0.02, yTete - 0.075, -0.17],
        ],
        0.028,
      ] as [V3[], number],
    ]),
  ];
  for (const [m, epais] of meches) pantin.attacher("tete", faire(meche(m, epais, 0.12), cheveux));
  // Les mèches qui encadrent le visage
  for (const s of [-1, 1])
    pantin.attacher(
      "tete",
      faire(
        meche(
          [
            [s * 0.13, yTete + 0.09, 0.075],
            [s * 0.16, yTete - 0.01, 0.085],
            [s * 0.145, yTete - 0.11, 0.075],
            [s * 0.14, yTete - 0.16, 0.07],
          ],
          0.045,
          0.15,
        ),
        cheveux,
      ),
    );

  // ——— Le masque de plongée, relevé sur le front, et sa sangle qui fait le tour de la tête.
  const sangle = new THREE.Group();
  sangle.position.set(0, yTete + 0.056, 0);
  sangle.rotation.x = -0.42;
  pantin.os.tete.add(sangle);
  const ovale = new THREE.Group();
  ovale.scale.set(0.86, 1.4, 1.075);
  sangle.add(ovale);
  const ouvert = 0.8;
  const anneau = faire(new THREE.TorusGeometry(0.2, 0.015, 8, 44, Math.PI * 2 - ouvert * 2), masque);
  anneau.rotation.set(Math.PI / 2, 0, Math.PI / 2 + ouvert);
  ovale.add(anneau);
  const lunette = new THREE.Group();
  lunette.position.set(0, yTete + 0.115, 0.14);
  lunette.rotation.x = -0.55;
  pantin.os.tete.add(lunette);
  // La jupe en silicone, le cadre, la vitre et la poche du nez
  lunette.add(faire(ellipsoide(0.125, 0.066, 0.04), masque));
  const cadre = faire(ellipsoide(0.112, 0.056, 0.03), noir);
  cadre.position.z = 0.022;
  lunette.add(cadre);
  // La vitre : deux reflets peints en biais (u = 0,25 est l'avant de l'ellipsoïde).
  const reflets = texture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    for (const [x, l] of [
      [0.2, 14],
      [0.27, 7],
    ]) {
      ctx.beginPath();
      ctx.moveTo(w * x - l, h * 0.3);
      ctx.lineTo(w * x + l, h * 0.3);
      ctx.lineTo(w * x + l - 14, h * 0.7);
      ctx.lineTo(w * x - l - 14, h * 0.7);
      ctx.fill();
    }
  });
  const vitre = faire(ellipsoide(0.098, 0.045, 0.016), mat(k.verre, { rim: 1.5, carte: reflets }), 0.7);
  vitre.position.z = 0.044;
  lunette.add(vitre);
  const nez = faire(ellipsoide(0.032, 0.032, 0.03), masque);
  nez.position.set(0, -0.052, 0.014);
  lunette.add(nez);
  for (const s of [-1, 1]) {
    const boucle = faire(ellipsoide(0.02, 0.028, 0.022), noir);
    boucle.position.set(s * 0.128, 0.004, -0.006);
    lunette.add(boucle);
  }

  // ——— Les bras : manches turquoise et noires, mains nues
  const motifManche = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = k.noir;
    ctx.fillRect(w * 0.18, 0, w * 0.14, h);
    ctx.fillRect(w * 0.68, 0, w * 0.14, h);
    couture(ctx, () => {
      for (const x of [0.17, 0.33, 0.67, 0.83]) {
        ctx.moveTo(w * x, 0);
        ctx.lineTo(w * x, h);
      }
    });
  });
  const manche = mat(k.combi, { ombre: k.combiOmbre, rim: 1.2, carte: motifManche });
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`bras${cote}`, faire(ellipsoide(0.05, 0.056, 0.05), combi), 0, -0.02, 0);
    pantin.attacher(`bras${cote}`, faire(membre(0.047, 0.041, 0.31), manche));
    pantin.attacher(`avantBras${cote}`, faire(membre(0.042, 0.037, 0.25), noir));
    const poignet = faire(new THREE.TorusGeometry(0.038, 0.012, 8, 16), combi);
    poignet.rotation.x = Math.PI / 2;
    pantin.attacher(`avantBras${cote}`, poignet, 0, -0.235, 0);
    const poing = new THREE.Group();
    poing.add(faire(ellipsoide(0.05, 0.056, 0.046), peau));
    const doigts = faire(ellipsoide(0.046, 0.032, 0.042), peau);
    doigts.position.set(0, -0.042, 0.023);
    poing.add(doigts);
    pantin.attacher(`main${cote}`, poing, 0, -0.038, 0);
  }

  // ——— Les jambes : noires, une bande turquoise sur le côté, des genouillères, des chaussons
  const motifJambe = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = k.combi;
    for (const x of [0.25, 0.75]) ctx.fillRect(w * (x - 0.05), 0, w * 0.1, h);
    couture(ctx, () => {
      for (const x of [0.19, 0.31, 0.69, 0.81]) {
        ctx.moveTo(w * x, 0);
        ctx.lineTo(w * x, h);
      }
    });
  });
  const jambe = mat(k.noir, { rim: 1.5, carte: motifJambe });
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.085, 0.062, 0.45), jambe));
    pantin.attacher(`mollet${cote}`, faire(membre(0.062, 0.044, 0.4), jambe));
    const genou = faire(ellipsoide(0.04, 0.05, 0.018), combi);
    pantin.attacher(`mollet${cote}`, genou, 0, -0.035, 0.052);
    const chausson = new THREE.Group();
    const tige = faire(membre(0.052, 0.054, 0.08), noir);
    tige.position.set(0, 0.05, 0);
    chausson.add(tige);
    const bordTige = faire(new THREE.TorusGeometry(0.052, 0.011, 8, 18), combi);
    bordTige.rotation.x = Math.PI / 2;
    bordTige.position.y = 0.05;
    chausson.add(bordTige);
    const dessus = faire(ellipsoide(0.058, 0.05, 0.118), noir);
    dessus.position.set(0, -0.012, 0.045);
    chausson.add(dessus);
    const semelle = faire(ellipsoide(0.062, 0.022, 0.125), combi);
    semelle.position.set(0, -0.046, 0.045);
    chausson.add(semelle);
    pantin.attacher(`pied${cote}`, chausson);
  }

  // ——— La longue tresse : des renflements réguliers, un lien et un pinceau au bout.
  const nombreTresse = 13;
  const tresse = new Chaine(
    pantin.os.tete,
    new THREE.Vector3(0, yTete - 0.08, -0.17),
    nombreTresse,
    0.06,
    (u) => {
      if (u > 0.86) return 0.012 + 0.03 * Math.sin(((u - 0.86) / 0.14) * Math.PI) ** 0.7;
      if (u > 0.82) return 0.016;
      const bosses = 0.8 + 0.2 * Math.abs(Math.sin(u * Math.PI * 8));
      return (0.044 - u * 0.018) * bosses;
    },
    k.cheveux,
    { raideur: 0.2, flotte: 0.5, derriere: -0.3, eclat: pantin.eclat },
  );
  const mt = tresse.mesh.material as THREE.ShaderMaterial;
  mt.uniforms.uOmbre.value.set(k.cheveuxOmbre);
  mt.uniforms.uBrillance.value = 0.9;
  pantin.chaines.push(tresse);
  // Le lien à la racine de la tresse, avec un petit coquillage
  const lien = faire(new THREE.TorusGeometry(0.036, 0.013, 8, 16), masque);
  lien.rotation.x = 1.0;
  pantin.attacher("tete", lien, 0, yTete - 0.085, -0.172);
  const perle = faire(ellipsoide(0.014, 0.018, 0.011), blanc, 0.7);
  pantin.attacher("tete", perle, 0.032, yTete - 0.095, -0.19);

  return pantin;
}
