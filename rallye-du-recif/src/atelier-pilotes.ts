// Page de mise au point des pilotes : Rin, Tao, Mira et Ganzo côte à côte, debout.
// http://localhost:5192/atelier-pilotes.html?angle=0             (de face)
// http://localhost:5192/atelier-pilotes.html?angle=180           (de dos)
// http://localhost:5192/atelier-pilotes.html?angle=145           (trois quarts dos)
// http://localhost:5192/atelier-pilotes.html?variante=1          (les palettes des bots)
// http://localhost:5192/atelier-pilotes.html?persos=tao,tao:v,mira,mira:v&angles=0,0,180,180
// Autres paramètres : zoom, y (hauteur visée), ecart, assis=1 (posture de conduite).
import * as THREE from "three";
import type { Pantin, Pose } from "./rendu/pantin";
import { construireGanzo } from "./rendu/persos/ganzo";
import { construireMira, VARIANTE_MIRA } from "./rendu/persos/mira";
import { construireRin } from "./rendu/persos/rin";
import { construireTao, VARIANTE_TAO } from "./rendu/persos/tao";
import { Rendu } from "./rendu/scene";

const params = new URLSearchParams(location.search);
const rendu = new Rendu(document.querySelector<HTMLCanvasElement>("#ecran")!);
rendu.scene.background = new THREE.Color("#bfe3f2");
rendu.final.uniforms.uVignette.value = 0.3;
const sol = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshBasicMaterial({ color: "#9fcf8a" }));
sol.rotation.x = -Math.PI / 2;
rendu.scene.add(sol);

const fabriques: Record<string, (variante: boolean) => Pantin> = {
  rin: () => construireRin(),
  ganzo: () => construireGanzo(),
  tao: (v) => (v ? construireTao(VARIANTE_TAO) : construireTao()),
  mira: (v) => (v ? construireMira(VARIANTE_MIRA) : construireMira()),
};

// Posture de conduite : assis, les mains vers le volant.
const ASSIS: Pose = {
  os: {
    cuisseP: [-1.45, 0, 0.08],
    cuisseL: [-1.45, 0, -0.08],
    molletP: [1.3, 0, 0],
    molletL: [1.3, 0, 0],
    piedP: [0.15, 0, 0],
    piedL: [0.15, 0, 0],
    brasP: [-0.75, 0, 0.25],
    brasL: [-0.75, 0, -0.25],
    avantBrasP: [-0.6, 0, 0],
    avantBrasL: [-0.6, 0, 0],
    torse: [0.05, 0, 0],
  },
  y: -0.45,
};
const assis = params.get("assis") === "1";
const pose: Pose = assis ? ASSIS : { os: {} };

const toutVariante = params.get("variante") === "1";
const noms = (params.get("persos") ?? "rin,tao,mira,ganzo").split(",");
const angles = (params.get("angles") ?? params.get("angle") ?? "0").split(",").map(Number);
const ecart = Number(params.get("ecart") ?? 1.1);
const pantins = noms.map((nom, i) => {
  const [cle, option] = nom.split(":");
  const p = fabriques[cle](toutVariante || option === "v");
  p.racine.position.x = (i - (noms.length - 1) / 2) * ecart;
  rendu.scene.add(p.racine);
  for (const c of p.chaines) rendu.scene.add(c.mesh);
  const degres = angles[Math.min(i, angles.length - 1)];
  return { p, angle: (degres * Math.PI) / 180 };
});
const zoom = Number(params.get("zoom") ?? 1);
const cible = Number(params.get("y") ?? (assis ? 0.95 : 1.15));
rendu.camera.position.set(0, cible + 0.25, (2.6 + noms.length * 1.25 * (ecart / 1.1)) / zoom);
rendu.camera.lookAt(0, cible, 0);
// Les mesures de chaque pilote (hauteur du bassin, hauteur totale), affichées en haut à gauche
// avec ?mesures=1. Les chaînes (tresse, bretelle) ne comptent pas.
const mesures = document.createElement("pre");
mesures.style.cssText = "position:fixed;top:8px;left:8px;margin:0;font:14px monospace;color:#1b1220";
if (params.get("mesures") === "1") document.body.append(mesures);
const boite = new THREE.Box3();
let t = 0;
function boucle() {
  for (let k = 0; k < 6; k++) {
    t += 1 / 60;
    for (const { p, angle } of pantins) {
      p.poser(pose, 1, 1, angle);
      p.ancrerPieds(!assis);
      p.animerChaines(1 / 60, 1, t);
    }
  }
  rendu.dessiner(t);
  if (mesures.isConnected)
    mesures.textContent = pantins
      .map(({ p }, i) => {
        const g = p.gabarit;
        boite.setFromObject(p.racine);
        return `${noms[i]} : bassin ${(g.pied + g.mollet + g.cuisse).toFixed(2)}, hauteur ${(boite.max.y - boite.min.y).toFixed(2)}`;
      })
      .join("\n");
  requestAnimationFrame(boucle);
}
boucle();
(window as any).atelier = { pantins, rendu };
