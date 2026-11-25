// Tung Tung Tung Sahur : une bûche debout, aux grands yeux ronds, qui tient une batte en bois.
import * as THREE from "three";
import { ellipsoide, membre, profilLisse, revolution } from "../formes";
import { Pantin } from "../pantin";
import { peindreVisages } from "../visage";
import { atelier, texture } from "./commun";

export const COULEURS_TUNG = {
  bois: "#b9824f",
  boisOmbre: "#5e3426",
  boisClair: "#d9a571",
  coeur: "#e8c08a",
  batte: "#e3b47c",
  batteOmbre: "#8a5236",
  veines: "rgba(80,40,25,0.55)",
};

/** Le fil du bois : des veines verticales qui ondulent, et quelques nœuds. */
function veinesDuBois(couleur: string) {
  return texture(512, 512, (ctx, w, h) => {
    let s = 5;
    const a = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.strokeStyle = couleur;
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 2 + a() * 3;
      const x0 = a() * w;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y <= h; y += 24) ctx.lineTo(x0 + Math.sin(y * 0.02 + i) * 8 + (a() - 0.5) * 4, y);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = w * (0.15 + a() * 0.3) + (i === 2 ? w * 0.45 : 0);
      const y = h * (0.15 + a() * 0.3);
      ctx.lineWidth = 4;
      for (const r of [6, 13, 20]) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.7, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
}

export function construireTung(couleurs = COULEURS_TUNG) {
  const k = couleurs;
  const pantin = new Pantin({
    pied: 0.07,
    cuisse: 0.46,
    mollet: 0.45,
    ecartHanches: 0.15,
    torse: 0.78,
    epaules: 0.33,
    cou: 0.1,
    bras: 0.4,
    avantBras: 0.38,
  });
  const { mat, faire } = atelier(pantin);
  const bois = mat(k.bois, { ombre: k.boisOmbre, carte: veinesDuBois(k.veines), rim: 1.2, trame: 0.8 });
  const boisClair = mat(k.boisClair, { ombre: k.boisOmbre, rim: 1.1 });

  // ——— La bûche : le corps et la tête à la fois
  const buche = faire(
    revolution(
      profilLisse([
        [0.0, -0.16],
        [0.27, -0.15],
        [0.31, -0.08],
        [0.3, 0.4],
        [0.3, 0.9],
        [0.29, 1.28],
        [0.26, 1.34],
        [0.0, 1.35],
      ]),
      40,
    ),
    bois,
  );
  buche.scale.set(1, 1, 0.92);
  pantin.attacher("torse", buche);
  // Le dessus coupé : les cernes de l'arbre
  const cernes = texture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = k.coeur;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,70,40,0.7)";
    ctx.lineWidth = 4;
    for (let r = 12; r < w / 2; r += 14) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + 6, h / 2, r * 1.05, r, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  const dessus = faire(new THREE.CircleGeometry(0.255, 40), mat(k.coeur, { carte: cernes, trame: 0, ombre: "#a7764e" }), 0);
  dessus.rotation.x = -Math.PI / 2;
  dessus.scale.set(1, 0.92, 1);
  pantin.attacher("torse", dessus, 0, 1.352, 0);
  // Une petite branche coupée sur le côté
  const branche = faire(membre(0.05, 0.045, 0.12), bois);
  branche.rotation.z = 2.1;
  pantin.attacher("torse", branche, 0.27, 1.1, -0.05);

  // ——— Le visage : de grands yeux ronds et une petite bouche, sur le haut de la bûche
  const visages = peindreVisages({
    iris: ["#120c08", "#3a2414"],
    yeux: 2.0,
    ecartYeux: 0.14,
    hauteurYeux: 0.4,
    sourcils: 1.5,
    bouche: 0.9,
    peau: k.bois,
  });
  const matVisage = new THREE.MeshBasicMaterial({
    map: visages.neutre,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.46, 40, 1, true, -0.95, 1.9), matVisage);
  face.scale.set(1, 1, 0.92);
  face.renderOrder = 1;
  pantin.attacher("torse", face, 0, 1.0, 0);
  pantin.ajouterVisages(matVisage, visages);

  // ——— Les bras : de fines branches, des poings de bois
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`bras${cote}`, faire(ellipsoide(0.06, 0.06, 0.06), boisClair));
    pantin.attacher(`bras${cote}`, faire(membre(0.05, 0.042, 0.4), boisClair));
    pantin.attacher(`avantBras${cote}`, faire(membre(0.044, 0.038, 0.38), boisClair));
    const poing = new THREE.Group();
    poing.add(faire(ellipsoide(0.065, 0.07, 0.06), boisClair));
    const pouce = faire(ellipsoide(0.025, 0.035, 0.025), boisClair);
    pouce.position.set(cote === "D" ? 0.05 : -0.05, -0.02, 0.04);
    poing.add(pouce);
    pantin.attacher(`main${cote}`, poing, 0, -0.04, 0);
  }

  // ——— La batte, tenue dans la main côté caméra. Elle prolonge l'avant-bras (le poignet l'oriente).
  const veinesBatte = veinesDuBois("rgba(110,60,35,0.4)");
  const batte = () => {
    const g = new THREE.Group();
    const corps = faire(
      revolution(
        profilLisse(
          [
            [0.0, -1.02],
            [0.08, -0.98],
            [0.075, -0.8],
            [0.04, -0.45],
            [0.027, -0.2],
            [0.03, 0.04],
            [0.045, 0.07],
            [0.0, 0.08],
          ],
          30,
        ),
        24,
      ),
      mat(k.batte, { ombre: k.batteOmbre, carte: veinesBatte, brillance: 0.35 }),
    );
    g.add(corps);
    // Une bande de scotch au manche
    const scotch = faire(new THREE.CylinderGeometry(0.033, 0.033, 0.14, 16), mat("#2c2830"), 0.7);
    scotch.position.y = -0.05;
    g.add(scotch);
    return g;
  };
  const batteD = batte();
  const batteG = batte();
  pantin.attacher("mainD", batteD, 0, -0.04, 0);
  pantin.attacher("mainG", batteG, 0, -0.04, 0);
  pantin.paires.push([batteD, batteG]);

  // ——— Les jambes : des bâtons, et des pieds en sabots de bois
  for (const cote of ["D", "G"] as const) {
    pantin.attacher(`cuisse${cote}`, faire(membre(0.06, 0.05, 0.46), boisClair));
    pantin.attacher(`mollet${cote}`, faire(membre(0.05, 0.042, 0.45), boisClair));
    const pied = faire(ellipsoide(0.07, 0.05, 0.13), bois);
    pantin.attacher(`pied${cote}`, pied, 0, -0.025, 0.05);
  }
  return pantin;
}
