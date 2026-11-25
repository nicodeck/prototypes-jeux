// Rin, « la Bourrasque » : légère et rapide. Cheveux indigo en pointes, longue écharpe rouge.
import * as THREE from "three";
import { ellipsoide, membre, meche, profilLisse, revolution } from "../formes";
import { Chaine, Pantin } from "../pantin";
import { atelier, tete, texture } from "./commun";

export const COULEURS_RIN = {
  peau: "#ffd8bd",
  peauOmbre: "#e0907f",
  cheveux: "#2c3a72",
  cheveuxOmbre: "#121636",
  haut: "#f6f2ea",
  hautOmbre: "#a6a6cf",
  ceinture: "#2f86e0",
  pantalon: "#272a40",
  bandes: "#efe8da",
  chaussures: "#ec5a2c",
  echarpe: "#e3202e",
  echarpeOmbre: "#8c0c2c",
};

export function construireRin(couleurs = COULEURS_RIN) {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.07,
    cuisse: 0.42,
    mollet: 0.42,
    ecartHanches: 0.095,
    torse: 0.42,
    epaules: 0.205,
    cou: 0.07,
    bras: 0.29,
    avantBras: 0.27,
  });
  const { mat, faire } = atelier(pantin);
  const peau = mat(k.peau, { ombre: k.peauOmbre, rim: 1, trame: 0.35 });
  const cheveux = mat(k.cheveux, { ombre: k.cheveuxOmbre, brillance: 0.9, rim: 1.2 });
  const tissuSombre = mat(k.pantalon, { rim: 1.4 });
  const rouge = mat(k.echarpe, { ombre: k.echarpeOmbre });

  // ——— Le buste : un haut blanc croisé (col en V, liseré rouge), une large ceinture bleue.
  const motifHaut = texture(512, 256, (ctx, w, h) => {
    // Le col en V : la peau, bordée d'un liseré.
    ctx.fillStyle = k.peau;
    ctx.beginPath();
    ctx.moveTo(w * 0.4, 0);
    ctx.lineTo(w * 0.5, h * 0.42);
    ctx.lineTo(w * 0.6, 0);
    ctx.fill();
    ctx.strokeStyle = k.echarpe;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(w * 0.385, 0);
    ctx.lineTo(w * 0.5, h * 0.46);
    ctx.lineTo(w * 0.63, -4);
    ctx.stroke();
    ctx.strokeStyle = "#1b1220";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.46);
    ctx.lineTo(w * 0.47, h * 0.95);
    ctx.stroke();
    // Plis du tissu
    ctx.strokeStyle = "rgba(27,18,32,0.55)";
    ctx.lineWidth = 3;
    for (const [x, y, l] of [
      [0.32, 0.55, 0.2],
      [0.66, 0.6, 0.18],
      [0.42, 0.75, 0.12],
    ])
      {
        ctx.beginPath();
        ctx.moveTo(w * x, h * y);
        ctx.quadraticCurveTo(w * (x + 0.02), h * (y + l / 2), w * (x - 0.01), h * (y + l));
        ctx.stroke();
      }
  });
  const buste = faire(
    revolution(
      profilLisse([
        [0.125, -0.02],
        [0.14, 0.1],
        [0.17, 0.24],
        [0.195, 0.34],
        [0.165, 0.405],
        [0.06, 0.45],
      ]),
      28,
    ),
    mat(k.haut, { ombre: k.hautOmbre, carte: motifHaut }),
  );
  buste.scale.set(1, 1, 0.74);
  pantin.attacher("torse", buste);
  const ceinture = faire(new THREE.TorusGeometry(0.135, 0.045, 12, 28), mat(k.ceinture));
  ceinture.rotation.x = Math.PI / 2;
  ceinture.scale.set(1, 0.76, 1.2);
  pantin.attacher("torse", ceinture, 0, 0.02, 0);
  // Le nœud de la ceinture et ses deux pans, sur le côté
  const noeud = faire(ellipsoide(0.045, 0.04, 0.035), mat(k.ceinture));
  pantin.attacher("torse", noeud, 0.13, 0.02, 0.04);
  for (const [dx, dz] of [
    [0, 0],
    [0.03, -0.03],
  ]) {
    const pan = faire(
      meche(
        [
          [0.13 + dx, 0.0, 0.04 + dz],
          [0.16 + dx, -0.1, 0.03 + dz],
          [0.15 + dx, -0.22, 0.0 + dz],
        ],
        0.03,
        0.4,
      ),
      mat(k.ceinture),
    );
    pantin.attacher("torse", pan);
  }

  // ——— Le bassin : un pantalon court et sombre.
  const hanches = faire(ellipsoide(0.155, 0.12, 0.12), tissuSombre);
  pantin.attacher("bassin", hanches, 0, -0.03, 0);

  // ——— Le cou et l'écharpe
  pantin.attacher("cou", faire(membre(0.05, 0.055, 0.1), peau), 0, 0.09, 0);
  const col = faire(new THREE.TorusGeometry(0.07, 0.045, 12, 24), rouge);
  col.rotation.x = Math.PI / 2 + 0.25;
  pantin.attacher("cou", col, 0, 0.0, -0.005);

  // ——— La tête
  const r = 0.165;
  tete(
    pantin,
    r,
    0,
    peau,
    {
      iris: ["#7a3b10", "#ffb43a"],
      yeux: 1.45,
      ecartYeux: 0.16,
      hauteurYeux: 0.47,
      sourcils: 1,
      bouche: 0.8,
      peau: k.peau,
      joues: true,
    },
    0.14,
  );
  const calotte = faire(ellipsoide(0.178, 0.178, 0.18), cheveux);
  pantin.attacher("tete", calotte, 0, 0.165, -0.022);
  // Mèches de devant, qui tombent sur le front
  const meches: [number, number, number][][] = [
    [
      [-0.11, 0.28, 0.07],
      [-0.14, 0.2, 0.15],
      [-0.15, 0.1, 0.14],
    ],
    [
      [-0.05, 0.3, 0.1],
      [-0.07, 0.22, 0.17],
      [-0.09, 0.14, 0.18],
    ],
    [
      [0.02, 0.31, 0.11],
      [0.02, 0.23, 0.18],
      [0.0, 0.16, 0.19],
    ],
    [
      [0.08, 0.3, 0.09],
      [0.1, 0.22, 0.16],
      [0.12, 0.15, 0.17],
    ],
    [
      [0.13, 0.27, 0.05],
      [0.16, 0.18, 0.12],
      [0.165, 0.08, 0.11],
    ],
  ];
  for (const m of meches) pantin.attacher("tete", faire(meche(m, 0.05, 0.08), cheveux));
  // Les grandes pointes, vers le haut et l'arrière
  const pointes: [number, number, number][][] = [
    [
      [0, 0.3, 0.02],
      [0.02, 0.42, -0.02],
      [0.05, 0.5, -0.1],
    ],
    [
      [-0.06, 0.29, -0.02],
      [-0.12, 0.4, -0.08],
      [-0.16, 0.45, -0.17],
    ],
    [
      [0.08, 0.28, -0.03],
      [0.15, 0.38, -0.08],
      [0.22, 0.42, -0.14],
    ],
    [
      [0, 0.27, -0.1],
      [0, 0.34, -0.22],
      [0.02, 0.36, -0.34],
    ],
    [
      [-0.12, 0.22, -0.08],
      [-0.2, 0.26, -0.16],
      [-0.28, 0.26, -0.22],
    ],
    [
      [0.13, 0.21, -0.08],
      [0.21, 0.24, -0.15],
      [0.29, 0.22, -0.2],
    ],
    [
      [-0.04, 0.16, -0.15],
      [-0.08, 0.1, -0.26],
      [-0.1, 0.04, -0.33],
    ],
    [
      [0.06, 0.16, -0.15],
      [0.1, 0.09, -0.25],
      [0.12, 0.02, -0.32],
    ],
  ];
  for (const m of pointes) pantin.attacher("tete", faire(meche(m, 0.075, 0.06), cheveux));
  // Mèches sur les côtés, devant les oreilles
  for (const s of [-1, 1])
    pantin.attacher(
      "tete",
      faire(
        meche(
          [
            [s * 0.15, 0.2, 0.04],
            [s * 0.18, 0.08, 0.06],
            [s * 0.165, -0.04, 0.07],
          ],
          0.045,
          0.1,
        ),
        cheveux,
      ),
    );

  // ——— Les bras : épaules nues, gants sombres, poignets rouges
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`bras${cote}`, faire(ellipsoide(0.06, 0.066, 0.06), peau), 0, -0.01, 0);
    pantin.attacher(`bras${cote}`, faire(membre(0.056, 0.047, 0.29), peau));
    pantin.attacher(`avantBras${cote}`, faire(membre(0.05, 0.045, 0.24), tissuSombre));
    const poignet = faire(new THREE.TorusGeometry(0.047, 0.022, 8, 16), rouge);
    poignet.rotation.x = Math.PI / 2;
    pantin.attacher(`avantBras${cote}`, poignet, 0, -0.2, 0);
    // Le poing : une paume et des doigts repliés
    const poing = new THREE.Group();
    poing.add(faire(ellipsoide(0.055, 0.06, 0.05), peau));
    const doigts = faire(ellipsoide(0.05, 0.035, 0.045), peau);
    doigts.position.set(0, -0.045, 0.025);
    poing.add(doigts);
    pantin.attacher(`main${cote}`, poing, 0, -0.04, 0);
  }

  // ——— Les jambes : pantalon sombre resserré par des bandes, chaussures orange
  const motifBandes = texture(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = "rgba(27,18,32,0.6)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const y = h * (0.1 + i * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + h * 0.06);
      ctx.stroke();
    }
  });
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.088, 0.068, 0.42), tissuSombre));
    pantin.attacher(`mollet${cote}`, faire(membre(0.066, 0.048, 0.4), mat(k.bandes, { carte: motifBandes })));
    const chaussure = new THREE.Group();
    const dessus = faire(ellipsoide(0.062, 0.055, 0.12), mat(k.chaussures));
    dessus.position.set(0, -0.015, 0.045);
    chaussure.add(dessus);
    const semelle = faire(ellipsoide(0.066, 0.025, 0.13), mat("#f5efe4"));
    semelle.position.set(0, -0.05, 0.045);
    chaussure.add(semelle);
    pantin.attacher(`pied${cote}`, chaussure);
  }

  // ——— Ce qui flotte : l'écharpe et la queue de cheval
  const echarpe = new Chaine(
    pantin.os.cou,
    new THREE.Vector3(0, 0.01, -0.07),
    9,
    0.13,
    (u) => 0.085 * (1 - u * 0.25),
    k.echarpe,
    { aplati: 0.32, flotte: 1, derriere: -0.6, eclat: pantin.eclat },
  );
  (echarpe.mesh.material as THREE.ShaderMaterial).uniforms.uOmbre.value.set(k.echarpeOmbre);
  pantin.chaines.push(echarpe);
  const queue = new Chaine(
    pantin.os.tete,
    new THREE.Vector3(0, 0.27, -0.15),
    6,
    0.1,
    (u) => 0.075 * (1 - u * 0.85) + 0.01,
    k.cheveux,
    { raideur: 0.25, flotte: 0.55, derriere: -0.3, eclat: pantin.eclat },
  );
  const mq = queue.mesh.material as THREE.ShaderMaterial;
  mq.uniforms.uOmbre.value.set(k.cheveuxOmbre);
  mq.uniforms.uBrillance.value = 0.9;
  pantin.chaines.push(queue);
  const attache = faire(new THREE.TorusGeometry(0.035, 0.02, 8, 14), rouge);
  pantin.attacher("tete", attache, 0, 0.27, -0.15);
  attache.rotation.x = 0.6;

  return pantin;
}
