// Ganzo, « le Roc » : un colosse. Torse en V, gilet vert ouvert, avant-bras bandés,
// barbe noire, bandeau blanc dont les pans flottent.
import * as THREE from "three";
import { ellipsoide, membre, meche, profilLisse, revolution } from "../formes";
import { Chaine, Pantin } from "../pantin";
import { atelier, tete, texture } from "./commun";

export const COULEURS_GANZO = {
  peau: "#c98a5c",
  peauOmbre: "#7d4436",
  cheveux: "#1e1a24",
  gilet: "#2e7553",
  giletOmbre: "#123a3a",
  pantalon: "#ece4cf",
  pantalonOmbre: "#9a92b5",
  ceinture: "#c8312c",
  bottes: "#4a3128",
  bandes: "#f2ecdd",
  bandeau: "#f4f1ea",
};

export function construireGanzo(couleurs = COULEURS_GANZO) {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.1,
    cuisse: 0.48,
    mollet: 0.48,
    ecartHanches: 0.17,
    torse: 0.72,
    epaules: 0.43,
    cou: 0.13,
    bras: 0.42,
    avantBras: 0.42,
  });
  const { mat, faire } = atelier(pantin);
  const peau = mat(k.peau, { ombre: k.peauOmbre, rim: 1.1, trame: 0.6 });
  const cheveux = mat(k.cheveux, { ombre: "#000000", brillance: 0.5, rim: 1.4 });
  const poils = mat(k.cheveux, { ombre: "#000000", rim: 1.6 });
  const pantalon = mat(k.pantalon, { ombre: k.pantalonOmbre });
  const bottes = mat(k.bottes, { rim: 1.3 });
  const rouge = mat(k.ceinture);

  // ——— Le torse nu : pectoraux, abdominaux et une grande cicatrice, peints sur la peau.
  const muscles = texture(512, 512, (ctx, w, h) => {
    ctx.strokeStyle = "rgba(90,40,30,0.85)";
    ctx.lineWidth = 7;
    // Pectoraux
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(w * (0.5 + s * 0.005), h * 0.36);
      ctx.quadraticCurveTo(w * (0.5 + s * 0.08), h * 0.44, w * (0.5 + s * 0.15), h * 0.33);
      ctx.stroke();
    }
    // Abdominaux
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.42);
    ctx.lineTo(w * 0.5, h * 0.82);
    ctx.stroke();
    for (const y of [0.53, 0.63, 0.73]) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w * (0.5 + s * 0.012), h * y);
        ctx.quadraticCurveTo(w * (0.5 + s * 0.04), h * y + 10, w * (0.5 + s * 0.065), h * y - 4);
        ctx.stroke();
      }
    }
    // Cicatrice en diagonale, avec ses points de couture
    ctx.strokeStyle = "#8f3a30";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w * 0.43, h * 0.2);
    ctx.lineTo(w * 0.57, h * 0.52);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const x = w * (0.43 + 0.14 * t);
      const y = h * (0.2 + 0.32 * t);
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 5);
      ctx.lineTo(x + 10, y - 5);
      ctx.stroke();
    }
  });
  const torse = faire(
    revolution(
      profilLisse([
        [0.2, -0.04],
        [0.23, 0.12],
        [0.29, 0.32],
        [0.38, 0.52],
        [0.4, 0.62],
        [0.3, 0.72],
        [0.12, 0.77],
      ]),
      32,
    ),
    mat(k.peau, { ombre: k.peauOmbre, rim: 1.1, carte: muscles, trame: 0.6 }),
  );
  torse.scale.set(1, 1, 0.66);
  pantin.attacher("torse", torse);
  // Le gilet ouvert sur le devant
  const motifGilet = texture(512, 256, (ctx, w, h) => {
    ctx.strokeStyle = "#e9c46a";
    ctx.lineWidth = 10;
    for (const x of [0.03, 0.97]) {
      ctx.beginPath();
      ctx.moveTo(w * x, 0);
      ctx.lineTo(w * x, h);
      ctx.stroke();
    }
  });
  const gilet = faire(
    revolution(
      profilLisse([
        [0.27, 0.22],
        [0.36, 0.42],
        [0.425, 0.56],
        [0.43, 0.63],
        [0.33, 0.73],
        [0.2, 0.78],
      ]),
      32,
      1.5,
    ),
    mat(k.gilet, { ombre: k.giletOmbre, cote: THREE.DoubleSide, carte: motifGilet }),
  );
  gilet.scale.set(1.02, 1, 0.7);
  pantin.attacher("torse", gilet);
  // Le col du gilet, retourné
  for (const s of [-1, 1]) {
    const col = faire(
      meche(
        [
          [s * 0.16, 0.76, 0.06],
          [s * 0.21, 0.66, 0.18],
          [s * 0.2, 0.5, 0.24],
        ],
        0.06,
        0.4,
      ),
      mat(k.gilet, { ombre: k.giletOmbre }),
    );
    pantin.attacher("torse", col);
  }
  // La grosse ceinture rouge, son nœud et ses pans
  const ceinture = faire(new THREE.TorusGeometry(0.23, 0.08, 14, 32), rouge);
  ceinture.rotation.x = Math.PI / 2;
  ceinture.scale.set(1, 0.72, 1.3);
  pantin.attacher("torse", ceinture, 0, 0.0, 0);
  pantin.attacher("torse", faire(ellipsoide(0.08, 0.07, 0.06), rouge), -0.12, -0.0, 0.16);
  for (const [dx, dz] of [
    [0, 0],
    [0.05, 0.02],
  ]) {
    pantin.attacher(
      "torse",
      faire(
        meche(
          [
            [-0.12 + dx, -0.02, 0.17 + dz],
            [-0.16 + dx, -0.18, 0.2 + dz],
            [-0.15 + dx, -0.36, 0.17 + dz],
          ],
          0.05,
          0.5,
        ),
        rouge,
      ),
    );
  }

  // ——— Le bassin et le pantalon bouffant
  pantin.attacher("bassin", faire(ellipsoide(0.27, 0.2, 0.2), pantalon), 0, -0.04, 0);

  // ——— Le cou, épais
  pantin.attacher("cou", faire(membre(0.12, 0.13, 0.14), peau), 0, 0.1, 0);
  // Les trapèzes
  for (const s of [-1, 1]) {
    const trapeze = faire(ellipsoide(0.16, 0.08, 0.12), peau);
    trapeze.position.set(s * 0.19, 0.66, -0.04);
    trapeze.rotation.z = s * -0.35;
    pantin.os.torse.add(trapeze);
  }

  // ——— La tête : petite, mâchoire carrée
  const r = 0.2;
  tete(
    pantin,
    r,
    1,
    peau,
    {
      iris: ["#2a1608", "#6b4423"],
      yeux: 0.95,
      ecartYeux: 0.16,
      hauteurYeux: 0.46,
      sourcils: 1.8,
      bouche: 1.1,
      peau: k.peau,
      cicatrice: true,
    },
    0.15,
  );
  // Cheveux en brosse : une calotte et des pointes courtes vers le haut et l'arrière.
  pantin.attacher("tete", faire(ellipsoide(0.196, 0.17, 0.2), cheveux), 0, 0.2, -0.03);
  for (let rang = 0; rang < 3; rang++)
    for (let i = 0; i < 5; i++) {
      const x = (i / 4 - 0.5) * 0.3;
      const z = 0.07 - rang * 0.11;
      pantin.attacher(
        "tete",
        faire(
          meche(
            [
              [x, 0.3 - rang * 0.02, z],
              [x * 1.15, 0.39 - rang * 0.02, z - 0.04],
              [x * 1.3, 0.44 - rang * 0.03, z - 0.1 - rang * 0.04],
            ],
            0.055,
            0.08,
          ),
          poils,
        ),
      );
    }
  // Le bandeau blanc
  const bandeau = faire(new THREE.TorusGeometry(0.2, 0.035, 10, 32), mat(k.bandeau));
  bandeau.rotation.x = Math.PI / 2 - 0.25;
  bandeau.scale.set(1.0, 1.04, 1);
  pantin.attacher("tete", bandeau, 0, 0.24, -0.015);
  // La barbe : des mèches qui suivent la mâchoire
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.4;
    const x = Math.sin(a) * 0.15;
    const z = Math.cos(a) * 0.12 - 0.01;
    const long = 0.1 + (1 - Math.abs(i / 8 - 0.5) * 2) * 0.12;
    pantin.attacher(
      "tete",
      faire(
        meche(
          [
            [x * 1.02, 0.08, z],
            [x * 1.0, 0.0 - long * 0.3, z + 0.03],
            [x * 0.75, -long + 0.0, z + 0.05],
          ],
          0.055,
          0.1,
        ),
        poils,
      ),
    );
  }
  // Moustache
  for (const s of [-1, 1])
    pantin.attacher(
      "tete",
      faire(
        meche(
          [
            [s * 0.01, 0.075, 0.185],
            [s * 0.06, 0.07, 0.175],
            [s * 0.1, 0.03, 0.15],
          ],
          0.025,
          0.2,
        ),
        poils,
      ),
    );

  // ——— Les bras énormes : deltoïdes, biceps, avant-bras bandés, gros poings
  const motifBandes = texture(256, 256, (ctx, w, h) => {
    ctx.strokeStyle = "rgba(60,40,40,0.55)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 11; i++) {
      const y = h * (0.04 + i * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + h * 0.05);
      ctx.stroke();
    }
  });
  const bandes = mat(k.bandes, { carte: motifBandes });
  for (const cote of ["D", "G"] as const) {
    const s = cote === "D" ? -1 : 1;
    const deltoide = faire(ellipsoide(0.17, 0.16, 0.16), peau);
    deltoide.position.set(s * 0.02, -0.03, 0);
    pantin.os[`bras${cote}`].add(deltoide);
    pantin.attacher(`bras${cote}`, faire(membre(0.145, 0.12, 0.42), peau));
    // Le biceps, un peu en avant
    const biceps = faire(ellipsoide(0.11, 0.15, 0.11), peau);
    biceps.position.set(0, -0.2, 0.05);
    pantin.os[`bras${cote}`].add(biceps);
    pantin.attacher(`avantBras${cote}`, faire(membre(0.15, 0.12, 0.38), bandes));
    const poing = new THREE.Group();
    poing.add(faire(ellipsoide(0.135, 0.14, 0.13), peau));
    const doigts = faire(ellipsoide(0.13, 0.085, 0.11), peau);
    doigts.position.set(0, -0.1, 0.05);
    poing.add(doigts);
    const pouce = faire(ellipsoide(0.045, 0.07, 0.045), peau);
    pouce.position.set(-s * 0.1, -0.05, 0.09);
    poing.add(pouce);
    pantin.attacher(`main${cote}`, poing, 0, -0.07, 0);
  }

  // ——— Les jambes : pantalon bouffant, bottes
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.17, 0.15, 0.48), pantalon));
    pantin.attacher(`mollet${cote}`, faire(membre(0.16, 0.12, 0.2), pantalon));
    const botte = faire(membre(0.13, 0.12, 0.34), bottes);
    pantin.attacher(`mollet${cote}`, botte, 0, -0.15, 0);
    const revers = faire(new THREE.TorusGeometry(0.13, 0.035, 8, 20), bottes);
    revers.rotation.x = Math.PI / 2;
    pantin.attacher(`mollet${cote}`, revers, 0, -0.16, 0);
    const pied = faire(ellipsoide(0.115, 0.08, 0.19), bottes);
    pantin.attacher(`pied${cote}`, pied, 0, -0.03, 0.06);
  }

  // ——— Les pans du bandeau
  for (const [dx, long] of [
    [-0.03, 5],
    [0.03, 4],
  ]) {
    const pan = new Chaine(
      pantin.os.tete,
      new THREE.Vector3(dx, 0.24, -0.2),
      long,
      0.1,
      (u) => 0.05 * (1 - u * 0.4),
      k.bandeau,
      { aplati: 0.3, flotte: 0.8, derriere: -0.4, eclat: pantin.eclat },
    );
    pantin.chaines.push(pan);
  }
  return pantin;
}
