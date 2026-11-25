// L'atelier des modèles : montre les bâtiments d'Aurea côte à côte, posés sur de petites îles de
// sable au-dessus de l'eau, pour juger leurs proportions, leurs détails et leur rendu de nuit.
//
// Paramètres :
// - `?tout` (par défaut) : tout le catalogue en grille, avec les étiquettes ;
// - `?type=maison&palier=1` : toutes les variantes d'un type (`type=aqueduc` : l'aqueduc et le castellum) ;
// - `&angle=0.6&haut=0.55&zoom=1` : cadrage (azimut et élévation en radians, zoom multiplie la distance) ;
// - `&cible=x,z[,y]` : point visé ; `&nuit` : la nuit, fenêtres et feux allumés ; `&emetteurs` : montre les émetteurs ;
// - `&sans-etiquettes` : masque les étiquettes.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ATMO, preparerAtmosphere } from "./rendu/atmosphere";
import { creerInstances, materiauBatiment } from "./rendu/materiaux";
import { type Modele, modeleArcheAqueduc, modeleBatiment, modeleCastellum, nombreVariantes, triangles } from "./rendu/modeles";
import { FICHES, type Palier, type TypeBatiment } from "./ville/catalogue";

const params = new URLSearchParams(location.search);
const nuit = params.has("nuit");

preparerAtmosphere();
ATMO.uNuages.value = -1;
ATMO.uBrumeDensite.value = 0.0;
ATMO.uNuit.value = nuit ? 1 : 0;
ATMO.uLampes.value = nuit ? 0.8 : 0;

const toile = document.getElementById("ecran") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = nuit ? 1.25 : 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(nuit ? 0x0a1324 : 0xa9c4dc);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = nuit ? 0.05 : 0.45;

const soleilDir = new THREE.Vector3(0.55, 0.62, 0.42).normalize();
const soleil = new THREE.DirectionalLight(nuit ? 0x8fa6d8 : 0xffe2b8, nuit ? 0.35 : 3.0);
soleil.castShadow = true;
soleil.shadow.mapSize.set(4096, 4096);
soleil.shadow.bias = -0.0004;
soleil.shadow.normalBias = 0.02;
scene.add(soleil, soleil.target);
const ciel = new THREE.HemisphereLight(nuit ? 0x2a3a5a : 0xbcd4ec, nuit ? 0x0a0806 : 0x8a7a5a, nuit ? 0.25 : 0.9);
scene.add(ciel);
ATMO.uLumiereDir.value.copy(soleilDir);
ATMO.uSoleilDir.value.copy(soleilDir);
ATMO.uLumiereCouleur.value.set(nuit ? 0x8fa6d8 : 0xffe2b8);

// ---------------------------------------------------------------------------------------------
// Ce qu'on montre
// ---------------------------------------------------------------------------------------------

interface Piece {
  nom: string;
  modeles: { modele: Modele; x: number; z: number; rot?: number; teinte?: THREE.Color }[];
  /** Emprise de la pièce (sur l'île de sable) */
  l: number;
  p: number;
  /** Partie de l'emprise sur la terre ferme (le reste est sur l'eau) */
  terre: { x: number; z: number; l: number; p: number };
}

const TEINTES = [0xf3eee4, 0xf0d9a8, 0xeec3a6, 0xe9e0c9, 0xe8b48a, 0xf5e6c8, 0xd9c7a0, 0xf1cfc0];

function pieceBatiment(type: TypeBatiment, palier: Palier, variante: number): Piece {
  const f = FICHES[type];
  const modele = modeleBatiment(type, palier, variante);
  const teinte = new THREE.Color(TEINTES[(variante * 3 + palier * 5 + type.length) % TEINTES.length]!);
  const nom = type === "maison" ? `${["Liberti", "Plebeii", "Equites"][palier]} ${variante + 1}` : `${f.nom}`;
  const piece: Piece = { nom, modeles: [{ modele, x: 0, z: 0, teinte }], l: f.l, p: f.p, terre: { x: 0, z: 0, l: f.l, p: f.p } };
  if (type === "port") {
    piece.p = f.p + 2.7;
    piece.modeles[0]!.z = -1.35;
    piece.terre = { x: 0, z: -1.35, l: f.l, p: f.p };
  } else if (type === "peche") {
    piece.p = f.p + 1.6;
    piece.modeles[0]!.z = -0.8;
    piece.terre = { x: 0, z: -0.8, l: f.l, p: f.p };
  }
  return piece;
}

function pieceAqueduc(): Piece {
  const modeles: Piece["modeles"] = [];
  for (let i = 0; i < 4; i++) modeles.push({ modele: modeleArcheAqueduc(6.2), x: -3.5 + i, z: 0 });
  for (let i = 0; i < 3; i++) modeles.push({ modele: modeleArcheAqueduc(3.4 - i * 0.6), x: 0.5 + i, z: 0 });
  modeles.push({ modele: modeleCastellum(), x: 3.5, z: 0, rot: -Math.PI / 2 });
  return { nom: "Aqueduc et castellum", modeles, l: 8, p: 1.4, terre: { x: 0, z: 0, l: 8, p: 1.4 } };
}

const TOUT: [TypeBatiment, Palier, number][] = [];
const typeDemande = params.get("type");
let pieces: Piece[] = [];
if (typeDemande === "aqueduc") pieces = [pieceAqueduc()];
else if (typeDemande) {
  const t = typeDemande as TypeBatiment;
  const palier = Number(params.get("palier") ?? 0) as Palier;
  const seule = params.get("variante");
  const n = nombreVariantes(t, palier);
  for (let v = 0; v < n; v++) if (seule === null || Number(seule) === v) pieces.push(pieceBatiment(t, palier, v));
} else {
  for (const palier of [0, 1, 2] as Palier[]) for (let v = 0; v < nombreVariantes("maison", palier); v++) TOUT.push(["maison", palier, v]);
  for (const t of ["peche", "bucheron", "moulin", "boulangerie", "pressoir", "entrepot", "cave", "carriere", "ferme", "oliveraie", "vigne", "forum", "thermes", "temple", "port", "phare"] as TypeBatiment[]) TOUT.push([t, 0, 0]);
  pieces = TOUT.map(([t, p, v]) => pieceBatiment(t, p, v));
  pieces.push(pieceAqueduc());
}

// Rangement en étagères : de gauche à droite, retour à la ligne quand on dépasse la largeur
const ECART = 1.4;
const largeurMax = pieces.length > 8 ? 30 : 1e9;
let curX = 0;
let curZ = 0;
let hauteurRang = 0;
const places: { piece: Piece; x: number; z: number }[] = [];
for (const piece of pieces) {
  if (curX > 0 && curX + piece.l > largeurMax) {
    curX = 0;
    curZ += hauteurRang + ECART;
    hauteurRang = 0;
  }
  places.push({ piece, x: curX + piece.l / 2, z: curZ + piece.p / 2 });
  curX += piece.l + ECART;
  hauteurRang = Math.max(hauteurRang, piece.p);
}
const minX = 0;
const maxX = Math.max(...places.map((p) => p.x + p.piece.l / 2));
const maxZ = Math.max(...places.map((p) => p.z + p.piece.p / 2));
const centre = new THREE.Vector3((minX + maxX) / 2, 0, maxZ / 2);

// L'eau, et une île de sable sous chaque pièce
const eau = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: nuit ? 0x0c1a26 : 0x2f7f8f, roughness: 0.12, metalness: 0.1 }),
);
eau.position.set(centre.x, -0.38, centre.z);
eau.receiveShadow = true;
scene.add(eau);
const sable = new THREE.MeshStandardMaterial({ color: 0xb7a27c, roughness: 0.95 });
const herbe = new THREE.MeshStandardMaterial({ color: 0x8c8a55, roughness: 0.95 });

const materiau = materiauBatiment();
const etiquettes = document.getElementById("etiquettes")!;
const reperes: { el: HTMLElement; pos: THREE.Vector3 }[] = [];
const stats: string[] = [];
let totalTri = 0;
const montrerEmetteurs = params.has("emetteurs");
const COULEURS_EMETTEURS: Record<string, number> = { fumee: 0x777777, vapeur: 0xffffff, feu: 0xff6a00, torche: 0xffd040, ane: 0x7a4a20, fontaine: 0x2a8aff };
const lumieresNuit: THREE.PointLight[] = [];

for (const { piece, x, z } of places) {
  const t = piece.terre;
  const ile = new THREE.Mesh(new THREE.BoxGeometry(t.l + 0.5, 0.7, t.p + 0.5), piece.nom.startsWith("Ferme") || piece.nom.startsWith("Oliv") || piece.nom.startsWith("Vign") ? herbe : sable);
  ile.position.set(x + t.x, -0.35, z + t.z);
  ile.receiveShadow = true;
  scene.add(ile);
  let hMax = 0;
  for (const m of piece.modeles) {
    const mesh = creerInstances(m.modele.geometrie, materiau, 1, m.modele.hauteur);
    mesh.count = 1;
    const rot = m.rot ?? 0;
    mesh.setMatrixAt(0, new THREE.Matrix4().makeRotationY(rot).setPosition(x + m.x, 0, z + m.z));
    const teinte = mesh.geometry.getAttribute("aTeinte") as THREE.InstancedBufferAttribute;
    const c = m.teinte ?? new THREE.Color(1, 1, 1);
    teinte.setXYZ(0, c.r, c.g, c.b);
    scene.add(mesh);
    hMax = Math.max(hMax, m.modele.hauteur);
    const n = triangles(m.modele);
    totalTri += n;
    for (const e of m.modele.emetteurs) {
      const p = new THREE.Vector3(e.x, e.y, e.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x + m.x, 0, z + m.z));
      if (montrerEmetteurs) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: COULEURS_EMETTEURS[e.sorte] }));
        b.position.copy(p);
        scene.add(b);
      }
      if (nuit && (e.sorte === "feu" || e.sorte === "torche") && lumieresNuit.length < 40) {
        const l = new THREE.PointLight(0xff9a40, e.sorte === "feu" ? 6 : 1.6, e.sorte === "feu" ? 7 : 2.5, 1.6);
        l.position.copy(p).add(new THREE.Vector3(0, 0.1, 0));
        scene.add(l);
        lumieresNuit.push(l);
      }
    }
  }
  const n = piece.modeles.reduce((s, m) => s + triangles(m.modele), 0);
  stats.push(`${piece.nom} : ${n} triangles, h=${hMax.toFixed(2)}`);
  if (!params.has("sans-etiquettes")) {
    const el = document.createElement("div");
    el.className = "etiquette";
    el.innerHTML = `${piece.nom}<br><small>${n} tri</small>`;
    etiquettes.appendChild(el);
    reperes.push({ el, pos: new THREE.Vector3(x, hMax + 0.35, z) });
  }
}
document.getElementById("infos")!.textContent = `${places.length} pièces · ${totalTri} triangles`;
console.log(stats.join("\n"));
(window as unknown as { atelier: unknown }).atelier = { stats, totalTri };

// ---------------------------------------------------------------------------------------------
// La caméra
// ---------------------------------------------------------------------------------------------

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 600);
const cible = params.get("cible")?.split(",").map(Number);
if (cible && cible.length >= 2) centre.set(cible[0]!, cible[2] ?? 0, cible[1]!);
const angle = Number(params.get("angle") ?? 0.45);
const haut = Number(params.get("haut") ?? 0.62);
const etendue = Math.max(maxX - minX, maxZ) + 2;
const distance = etendue * 1.25 * Number(params.get("zoom") ?? 1) + 4;
camera.position.set(centre.x + Math.sin(angle) * Math.cos(haut) * distance, centre.y + Math.sin(haut) * distance, centre.z + Math.cos(angle) * Math.cos(haut) * distance);
const controles = new OrbitControls(camera, toile);
controles.target.copy(centre);
controles.update();

// L'ombre couvre toute la scène
const portee = etendue * 0.75 + 4;
soleil.position.copy(centre).addScaledVector(soleilDir, 60);
soleil.target.position.copy(centre);
const camOmbre = soleil.shadow.camera;
camOmbre.left = -portee;
camOmbre.right = portee;
camOmbre.top = portee;
camOmbre.bottom = -portee;
camOmbre.near = 1;
camOmbre.far = 140;
camOmbre.updateProjectionMatrix();

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const horloge = new THREE.Timer();
let images = 0;
function boucle() {
  horloge.update();
  ATMO.uTemps.value = horloge.getElapsed();
  controles.update();
  renderer.render(scene, camera);
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const r of reperes) {
    const p = r.pos.clone().project(camera);
    r.el.style.left = `${((p.x + 1) / 2) * w}px`;
    r.el.style.top = `${((1 - p.y) / 2) * h}px`;
    r.el.style.display = p.z < 1 ? "block" : "none";
  }
  if (++images === 3) (window as unknown as { atelierPret: boolean }).atelierPret = true;
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
