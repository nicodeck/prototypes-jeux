// La vue : tout ce qui se dessine, assemblé. Elle lit la cité et ne la modifie jamais.
import * as THREE from "three";
import { SunLight } from "three/addons/lights/SunLight.js";
import { REGLAGES } from "../reglages";
import { hauteur } from "../ville/ile";
import type { Ville } from "../ville/ville";
import { Ambiances } from "./ambiances";
import { Batiments } from "./batiments";
import { ATMO, preparerAtmosphere } from "./atmosphere";
import { Camera } from "./camera";
import { Ciel } from "./ciel";
import { Lointain } from "./lointain";
import { Mer } from "./mer";
import { Post } from "./post";
import { Particules } from "./particules";
import { Terrain } from "./terrain";
import { Vie } from "./vie";
import { Vegetation } from "./vegetation";

/** La hauteur approximative du toit de chaque bâtiment, pour que la caméra ne le traverse pas */
function hauteurToit(type: string, palier: number) {
  if (type === "maison") return [1.9, 2.7, 3.1][palier] ?? 2.5;
  return ({ temple: 5.8, thermes: 3.8, forum: 2.8, port: 3.2, phare: 9.6, entrepot: 2.6, vigne: 1.2, ferme: 2, oliveraie: 2 } as Record<string, number>)[type] ?? 2.3;
}

export interface Modules {
  mettreAJour?(dt: number, v: Ville, vue: Vue): void;
}

export class Vue {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly post: Post;
  readonly ciel: Ciel;
  readonly ambiances = new Ambiances();
  readonly terrain: Terrain;
  readonly mer: Mer;
  readonly soleil: SunLight;
  readonly camera = new Camera();
  readonly batiments = new Batiments();
  readonly vegetation = new Vegetation();
  readonly particules = new Particules();
  readonly vie = new Vie();
  /** La fête du temple bat son plein */
  fete = false;
  readonly modules: Modules[] = [];
  private versionRoutes = -1;
  private versionArbres = -1;
  private nbBatiments = -1;
  private eclair = 0;
  temps = 0;
  /** Le point visé au sol */
  cible = new THREE.Vector3();
  pause = 0;
  /** La résolution s'adapte pour rester fluide */
  private ratio = 1;
  private ratioMax = 1;
  private mesure = { temps: 0, images: 0 };

  constructor(readonly toile: HTMLCanvasElement) {
    preparerAtmosphere();
    this.renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: "high-performance", stencil: false });
    this.ratioMax = Math.min(window.devicePixelRatio, REGLAGES.resolutionMax);
    this.ratio = Math.min(this.ratioMax, 1.5);
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 1);

    this.post = new Post(this.renderer);
    this.ciel = new Ciel(this.renderer);
    this.scene.add(this.ciel.dome);

    this.terrain = new Terrain();
    this.scene.add(this.terrain.mesh, this.terrain.fondMarin);
    this.mer = new Mer(this.terrain.texFond);
    this.scene.add(this.mer.mesh);
    this.scene.add(this.batiments.groupe, this.vegetation.groupe, this.particules.groupe, this.vie.groupe, new Lointain().groupe);

    this.soleil = new SunLight(0xffffff, 3);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(REGLAGES.ombres, REGLAGES.ombres);
    this.soleil.shadow.camera.far = 320;
    this.soleil.shadow.bias = -0.0004;
    this.soleil.shadow.normalBias = 0.03;
    this.soleil.shadow.radius = 2;
    this.scene.add(this.soleil);

    this.redimensionner();
    window.addEventListener("resize", () => this.redimensionner());
  }

  redimensionner() {
    const l = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(l, h);
    this.post.redimensionner(l, h, this.renderer.getPixelRatio());
  }

  /** Signale un éclair (l'image et le ciel flashent) */
  eclairer() {
    this.eclair = 1;
  }

  /** Si l'image rame, on baisse un peu la résolution ; si elle file, on la remonte */
  private adapterResolution(dt: number) {
    this.mesure.temps += dt;
    this.mesure.images++;
    if (this.mesure.temps < 2) return;
    const ips = this.mesure.images / this.mesure.temps;
    this.mesure = { temps: 0, images: 0 };
    let r = this.ratio;
    if (ips < 42) r = Math.max(0.75, r - 0.15);
    else if (ips > 57 && r < this.ratioMax) r = Math.min(this.ratioMax, r + 0.1);
    if (Math.abs(r - this.ratio) > 0.01) {
      this.ratio = r;
      this.renderer.setPixelRatio(r);
      this.redimensionner();
    }
  }

  image(dt: number, v: Ville) {
    this.temps += dt;
    this.adapterResolution(dt);
    // La cité a changé : on repeint le sol
    let nb = v.batiments.size;
    for (const b of v.batiments.values()) nb += b.palier * 1000 + b.i;
    if (v.versionRoutes !== this.versionRoutes || nb !== this.nbBatiments || v.versionArbres !== this.versionArbres) {
      this.terrain.mettreAJour(v);
      this.versionRoutes = v.versionRoutes;
      this.versionArbres = v.versionArbres;
      this.nbBatiments = nb;
    }

    const aspect = window.innerWidth / window.innerHeight;
    this.cible = this.camera.mettreAJour(dt, aspect, (x, z) => {
      // Le toit le plus haut parmi les cases autour de la caméra
      let h = -Infinity;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const b = v.batimentEn(Math.floor(x + dx * 0.6), Math.floor(z + dz * 0.6));
          if (b) h = Math.max(h, b.sol + hauteurToit(b.type, b.palier));
        }
      return h;
    });
    const cam = this.camera.camera;

    this.eclair = Math.max(0, this.eclair - dt * 3.2);
    const flash = this.eclair > 0 ? this.eclair * (0.6 + 0.4 * Math.sin(this.temps * 60)) : 0;
    const h = v.horloge;
    this.ambiances.appliquer(dt, h.heure, h.ciel, this.temps, flash, this.ciel, this.post, this.scene);
    const a = this.ambiances.etat;
    this.soleil.position.copy(a.lumiere).multiplyScalar(200);
    this.soleil.color.copy(a.couleur);
    this.soleil.intensity = a.intensite;
    this.soleil.castShadow = a.intensite > 0.02;

    this.batiments.mettreAJour(dt, v);
    this.vegetation.mettreAJour(dt, v);
    this.vie.mettreAJour(dt, v, this.batiments.emetteurs, this.temps);
    this.particules.mettreAJour(dt, v, this.batiments.emetteurs, cam, this.cible, this.fete, this.vie.lanternes);
    for (const m of this.modules) m.mettreAJour?.(dt, v, this);

    this.ciel.mettreAJour(dt, cam, this.scene);

    // Les rayons de soleil : seulement quand le soleil est devant nous
    const s = a.soleil.clone().multiplyScalar(1000).add(cam.position).project(cam);
    const devant = a.soleil.dot(cam.getWorldDirection(new THREE.Vector3())) > 0.05;
    this.post.uRayons.uSoleilEcran.value.set(s.x * 0.5 + 0.5, s.y * 0.5 + 0.5);
    this.post.uRayons.uVisible.value = devant ? 0.32 * (1 - a.nuit) * (0.4 + a.dore) * (1 - 0.6 * Math.max(0, h.ciel.nuages - 0.6)) : 0;

    // Le flou de maquette suit la distance de la caméra
    const d = this.camera.actuel.distance;
    this.post.final.uMiseAuPoint.value = cam.position.distanceTo(this.cible);
    this.post.final.uFlou.value = REGLAGES.flouMaquette * THREE.MathUtils.lerp(0.35, 1.1, THREE.MathUtils.smoothstep(d, 8, 120));
    this.post.final.uFlouProche.value = REGLAGES.flouMaquette * 0.5;
    this.post.final.uPause.value = this.pause;
    this.post.final.uEclair.value = flash;

    // L'éclairage de la nuit, calculé après le rendu
    const lum = this.particules.lumieres;
    const f = this.post.final;
    for (let k = 0; k < Math.min(48, lum.length); k++) {
      f.uLumieres.value[k]!.set(lum[k]!.pos.x, lum[k]!.pos.y, lum[k]!.pos.z, lum[k]!.portee);
      f.uForces.value[k] = lum[k]!.force;
    }
    f.uNbLumieres.value = Math.min(48, lum.length);

    this.post.rendre(this.scene, cam, this.temps);
  }

  /** Le point du sol (ou de la mer) sous un point de l'écran, en coordonnées normalisées (-1..1) */
  pointSol(nx: number, ny: number): THREE.Vector3 | null {
    const cam = this.camera.camera;
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(nx, ny), cam);
    const o = r.ray.origin;
    const d = r.ray.direction;
    let t = 0;
    let pas = 0.5;
    for (let n = 0; n < 900; n++) {
      const p = o.clone().addScaledVector(d, t);
      const sol = Math.max(0, hauteur(p.x, p.z));
      if (p.y <= sol) {
        // On affine par dichotomie
        let a = t - pas;
        let b = t;
        for (let k = 0; k < 12; k++) {
          const m = (a + b) / 2;
          const q = o.clone().addScaledVector(d, m);
          if (q.y <= Math.max(0, hauteur(q.x, q.z))) b = m;
          else a = m;
        }
        return o.clone().addScaledVector(d, b);
      }
      t += pas;
      pas = Math.min(2, pas * 1.02);
      if (t > 1500) break;
    }
    return null;
  }

  get atmo() {
    return ATMO;
  }
}
