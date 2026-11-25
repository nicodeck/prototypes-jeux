// Page de mise au point : un perso dans plusieurs poses, côte à côte.
// http://localhost:5176/atelier.html?perso=ballerina&poses=garde,course:1.5,coup:battement:4
import * as THREE from "three";
import type { Jeu } from "./rendu/animations";
import type { Pantin, Pose } from "./rendu/pantin";
import { construireTung } from "./rendu/persos/tung";
import { POSES_TUNG } from "./rendu/persos/tung-poses";
import { construireBallerina } from "./rendu/persos/ballerina";
import { POSES_BALLERINA } from "./rendu/persos/ballerina-poses";
import { Rendu } from "./rendu/scene";

const params = new URLSearchParams(location.search);
const rendu = new Rendu(document.querySelector<HTMLCanvasElement>("#ecran")!);
rendu.scene.background = new THREE.Color("#bfe3f2");
rendu.final.uniforms.uVignette.value = 0.3;
const sol = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshBasicMaterial({ color: "#9fcf8a" }));
sol.rotation.x = -Math.PI / 2;
rendu.scene.add(sol);

const persos: Record<string, { fabrique: () => Pantin; jeu: Jeu }> = {
  ballerina: { fabrique: construireBallerina, jeu: POSES_BALLERINA },
  tung: { fabrique: construireTung, jeu: POSES_TUNG },
};
const { fabrique, jeu } = persos[params.get("perso") ?? "ballerina"];
const noms = (params.get("poses") ?? "garde,garde,garde").split(",");
const poseNommee = (nom: string): Pose => {
  const [a, b, c] = nom.split(":");
  if (a === "coup") return jeu.coups[b](Number(c ?? 0), 0);
  if (a === "course") return jeu.course(Number(b ?? 0));
  if (a === "etourdi" || a === "victoire") return jeu[a](Number(b ?? 0));
  return (jeu as any)[a] as Pose;
};
const angle = Number(params.get("angle") ?? 0.55);
const dirs = (params.get("dirs") ?? "").split(",").map(Number);
const ecart = Number(params.get("ecart") ?? 1.5);
const pantins = noms.map((nom, i) => {
  const p = fabrique();
  p.racine.position.x = (i - (noms.length - 1) / 2) * ecart;
  rendu.scene.add(p.racine);
  for (const c of p.chaines) rendu.scene.add(c.mesh);
  return { p, pose: poseNommee(nom), dir: dirs[i] || 1 };
});
const zoom = Number(params.get("zoom") ?? 1);
const cible = Number(params.get("y") ?? 0.95);
rendu.camera.position.set(0, cible + 0.25, (2.2 + noms.length * 1.2 * (ecart / 1.5)) / zoom);
rendu.camera.lookAt(0, cible, 0);
let t = 0;
function boucle() {
  for (let k = 0; k < 6; k++) {
    t += 1 / 60;
    for (const { p, pose, dir } of pantins) {
      p.poser(pose, dir, 1, Math.PI / 2 - angle);
      p.ancrerPieds(!pose.tour && !pose.sol && params.get("ancrer") !== "0");
      p.animerChaines(1 / 60, dir, t);
    }
  }
  rendu.dessiner(t);
  requestAnimationFrame(boucle);
}
boucle();
(window as any).atelier = { pantins, rendu };
