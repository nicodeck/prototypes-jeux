// Page de mise au point : les karts et leurs pilotes, côte à côte.
// http://localhost:5178/atelier-kart.html?angle=0.6&braquage=0.5
import * as THREE from "three";
import { LISTE_PILOTES } from "./course/pilotes";
import { ModeleKart, poseAssise } from "./rendu/kart";
import { COULEURS_KARTS, fabriquerPilote } from "./rendu/pilotes";
import { Rendu } from "./rendu/scene";

const params = new URLSearchParams(location.search);
const rendu = new Rendu(document.querySelector<HTMLCanvasElement>("#ecran")!);
rendu.scene.background = new THREE.Color("#bfe3f2");
rendu.final.uniforms.uVignette.value = 0.3;
const sol = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshBasicMaterial({ color: "#8d8a9a" }));
sol.rotation.x = -Math.PI / 2;
rendu.scene.add(sol);
const angle = Number(params.get("angle") ?? 0.6);
const braquage = Number(params.get("braquage") ?? 0);
const variante = params.has("variante");
const noms = (params.get("pilotes") ?? LISTE_PILOTES.join(",")).split(",") as typeof LISTE_PILOTES;
const karts = noms.map((nom, i) => {
  const k = new ModeleKart(fabriquerPilote(nom, variante), nom, COULEURS_KARTS[i * 2 + (variante ? 1 : 0)], i + 1);
  k.racine.position.x = (i - (noms.length - 1) / 2) * 2.6;
  k.racine.rotation.y = angle;
  k.pilote.poser(poseAssise(braquage, 0, (params.get("expression") as any) ?? "neutre"), 1, 1, 0);
  k.turbo(params.has("turbo"));
  k.bulle.visible = params.has("bulle");
  rendu.scene.add(k.racine);
  for (const c of k.pilote.chaines) rendu.scene.add(c.mesh);
  return k;
});
const zoom = Number(params.get("zoom") ?? 1);
const hauteur = Number(params.get("h") ?? 2.2);
rendu.camera.fov = 40;
rendu.camera.position.set(0, hauteur, 9 / zoom);
rendu.camera.lookAt(0, 0.7, 0);
rendu.camera.updateProjectionMatrix();
let t = 0;
function boucle() {
  t += 1 / 60;
  for (const k of karts) {
    k.animer(1 / 60, 10, braquage, t);
    k.pilote.animerChaines(1 / 60, 1, t);
  }
  rendu.dessiner(t);
  requestAnimationFrame(boucle);
}
boucle();
