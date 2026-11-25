// Un kart et son pilote : le châssis, les roues, le volant, l'aileron, les flammes du turbo
// et la bulle. Le kart regarde vers +Z ; sa droite est vers -X.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { NomPilote } from "../course/pilotes";
import { ellipsoide, membre, meche } from "./formes";
import type { Pantin, Pose } from "./pantin";
import { texture } from "./persos/commun";
import { matToon, piece } from "./toon";

/** La taille du kart et du pilote, selon le gabarit. */
export const GABARITS: Record<NomPilote, { kart: number; pilote: number }> = {
  rin: { kart: 0.95, pilote: 0.9 },
  tao: { kart: 1, pilote: 0.9 },
  mira: { kart: 0.97, pilote: 0.9 },
  ganzo: { kart: 1.12, pilote: 0.74 },
};

/** La hauteur du siège, sous le bassin du pilote. */
const SIEGE = 0.5;
const RECUL_PILOTE = -0.32;

const ROUE_AVANT = { r: 0.27, l: 0.22, x: 0.7, z: 0.74 };
const ROUE_ARRIERE = { r: 0.34, l: 0.32, x: 0.72, z: -0.72 };

/** La pose assise, les mains au volant. `braquage` de -1 (gauche) à 1 (droite). */
export function poseAssise(braquage: number, penche = 0, expression: Pose["expression"] = "neutre"): Pose {
  const b = braquage;
  return {
    expression,
    os: {
      bassin: [-0.05, 0, 0],
      torse: [0.12 + penche * 0.2, b * 0.18, -b * 0.08],
      cou: [0.05, b * 0.15, 0],
      tete: [-0.12, b * 0.35, b * 0.05],
      // « P » est le bras droit du pilote (le kart regarde vers +Z).
      brasP: [-1.05 + b * 0.25, 0, -0.32],
      avantBrasP: [-0.55, 0, 0.25 + b * 0.1],
      mainP: [0, 0, 0],
      brasL: [-1.05 - b * 0.25, 0, 0.32],
      avantBrasL: [-0.55, 0, -0.25 + b * 0.1],
      mainL: [0, 0, 0],
      cuisseP: [-1.5, 0, -0.14],
      molletP: [0.45, 0, 0],
      piedP: [-0.5, 0, 0],
      cuisseL: [-1.5, 0, 0.14],
      molletL: [0.45, 0, 0],
      piedL: [-0.5, 0, 0],
    },
  };
}

export class ModeleKart {
  /** Posé au sol, tourné selon le cap. */
  readonly racine = new THREE.Group();
  /** La caisse : penche, tangue et pivote en dérapage. */
  readonly caisse = new THREE.Group();
  readonly ombre: THREE.Mesh;
  private readonly rouesAvant: THREE.Group[] = [];
  private readonly pneus: THREE.Object3D[] = [];
  private readonly volant: THREE.Group;
  readonly flammes: THREE.Mesh[] = [];
  readonly bulle: THREE.Mesh;
  private rotationRoues = 0;

  constructor(
    readonly pilote: Pantin,
    readonly nom: NomPilote,
    couleur: string,
    numero: number,
  ) {
    const gabarit = GABARITS[nom];
    const c = new THREE.Color(couleur);
    const principal = matToon(couleur, { rim: 1.2, brillance: 0.5 });
    const clair = matToon(c.clone().lerp(new THREE.Color("#ffffff"), 0.55), { rim: 1 });
    const sombre = matToon("#2d2836", { ombre: "#141019", rim: 1.2 });
    const metal = matToon("#c9cbd8", { ombre: "#5d5a78", brillance: 1, rim: 1.4 });
    const pneu = matToon("#29242f", { ombre: "#0f0c14", rim: 1.1, trame: 0.4 });
    const carrosserie = new THREE.Group();
    carrosserie.scale.setScalar(gabarit.kart);
    this.caisse.add(carrosserie);
    this.racine.add(this.caisse);

    // ——— Le châssis : un plancher, un nez arrondi, deux pontons sur les côtés.
    const plancher = piece(new RoundedBoxGeometry(1.15, 0.12, 2.05, 3, 0.05), sombre, 1, { lisser: true });
    plancher.position.set(0, 0.2, 0);
    carrosserie.add(plancher);
    const numeroPeint = texture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 16;
      ctx.strokeStyle = "#1b1220";
      ctx.stroke();
      ctx.fillStyle = "#1b1220";
      ctx.font = `900 ${w * 0.6}px Rubik, Arial Black, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(numero), w * 0.5, h * 0.54);
    });
    const nez = piece(ellipsoide(0.5, 0.24, 0.78, 28, 16), principal, 1);
    nez.position.set(0, 0.36, 0.55);
    nez.rotation.x = 0.08;
    carrosserie.add(nez);
    // Une bande claire sur le dessus du nez, et le numéro peint sur une plaque ronde.
    const bande = piece(ellipsoide(0.12, 0.08, 0.7), clair, 0);
    bande.position.set(0, 0.52, 0.5);
    bande.rotation.x = 0.1;
    carrosserie.add(bande);
    const plaque = new THREE.Mesh(
      new THREE.CircleGeometry(0.17, 24),
      new THREE.MeshBasicMaterial({ map: numeroPeint, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    plaque.position.set(0, 0.54, 0.95);
    plaque.rotation.x = -1.05;
    carrosserie.add(plaque);
    const capot = piece(ellipsoide(0.36, 0.2, 0.42), principal, 1);
    capot.position.set(0, 0.46, 0.12);
    carrosserie.add(capot);
    for (const s of [-1, 1]) {
      const ponton = piece(ellipsoide(0.2, 0.17, 0.7), principal, 1);
      ponton.position.set(s * 0.56, 0.32, -0.12);
      carrosserie.add(ponton);
      const liseré = piece(ellipsoide(0.12, 0.1, 0.5), clair, 0.8);
      liseré.position.set(s * 0.62, 0.42, -0.12);
      carrosserie.add(liseré);
    }
    // Le pare-chocs avant
    const parechoc = piece(membre(0.06, 0.06, 1.2, 10), sombre, 1);
    parechoc.rotation.z = Math.PI / 2;
    parechoc.position.set(-0.6, 0.22, 1.12);
    carrosserie.add(parechoc);

    // ——— Le siège, le moteur, les pots et l'aileron
    const dossier = piece(new RoundedBoxGeometry(0.62, 0.62, 0.14, 3, 0.06), sombre, 1, { lisser: true });
    dossier.position.set(0, 0.62, -0.6);
    dossier.rotation.x = -0.25;
    carrosserie.add(dossier);
    const assise = piece(new RoundedBoxGeometry(0.6, 0.12, 0.5, 3, 0.05), sombre, 1, { lisser: true });
    assise.position.set(0, 0.32, -0.38);
    carrosserie.add(assise);
    const moteur = piece(new RoundedBoxGeometry(0.72, 0.36, 0.42, 3, 0.07), metal, 1, { lisser: true });
    moteur.position.set(0, 0.42, -0.92);
    carrosserie.add(moteur);
    for (const s of [-1, 1]) {
      const pot = piece(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 14), metal, 1);
      pot.rotation.x = Math.PI / 2 - 0.35;
      pot.position.set(s * 0.2, 0.56, -1.16);
      carrosserie.add(pot);
      // La flamme du turbo, au bout du pot
      const flamme = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: "#ffb02e", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      flamme.rotation.x = -Math.PI / 2 - 0.35;
      flamme.position.set(s * 0.2, 0.64, -1.62);
      flamme.visible = false;
      carrosserie.add(flamme);
      this.flammes.push(flamme);
      // Les montants de l'aileron
      const montant = piece(new RoundedBoxGeometry(0.05, 0.42, 0.12, 2, 0.02), sombre, 0.8, { lisser: true });
      montant.position.set(s * 0.32, 0.78, -1.08);
      carrosserie.add(montant);
    }
    const aileron = piece(new RoundedBoxGeometry(1.25, 0.06, 0.32, 3, 0.03), principal, 1, { lisser: true });
    aileron.position.set(0, 1.0, -1.12);
    aileron.rotation.x = 0.12;
    carrosserie.add(aileron);
    const fanion = piece(meche([[0, 0, 0], [0, 0.5, 0.02], [0, 0.95, 0]], 0.02, 0.6, 5), sombre, 0.6);
    fanion.position.set(-0.55, 1.0, -1.16);
    carrosserie.add(fanion);
    const drapeau = piece(new THREE.PlaneGeometry(0.34, 0.22), matToon(c.clone().lerp(new THREE.Color("#ffd23a"), 0.6), { cote: THREE.DoubleSide, trame: 0 }), 0);
    drapeau.position.set(-0.55, 1.82, -1.16 - 0.17);
    drapeau.rotation.y = Math.PI / 2;
    carrosserie.add(drapeau);

    // ——— Le volant
    this.volant = new THREE.Group();
    const colonne = piece(membre(0.025, 0.025, 0.42, 8), sombre, 0.7);
    colonne.rotation.x = Math.PI / 2 + 0.75;
    this.volant.add(colonne);
    const cercle = piece(new THREE.TorusGeometry(0.17, 0.03, 8, 24), sombre, 0.8);
    cercle.position.set(0, 0, 0);
    this.volant.add(cercle);
    const centre = piece(ellipsoide(0.05, 0.05, 0.03), principal, 0.6);
    this.volant.add(centre);
    this.volant.position.set(0, 0.74, 0.18);
    this.volant.rotation.x = -0.75;
    carrosserie.add(this.volant);

    // ——— Les roues
    const roue = (r: number, l: number) => {
      const g = new THREE.Group();
      const gomme = piece(new THREE.CylinderGeometry(r, r, l, 22), pneu, 1);
      gomme.rotation.z = Math.PI / 2;
      g.add(gomme);
      const jante = piece(new THREE.CylinderGeometry(r * 0.55, r * 0.55, l + 0.02, 16), metal, 0);
      jante.rotation.z = Math.PI / 2;
      g.add(jante);
      // Des rayons, pour voir la roue tourner
      for (let i = 0; i < 3; i++) {
        const rayon = new THREE.Mesh(new THREE.BoxGeometry(l + 0.04, r * 0.95, 0.05), sombre);
        rayon.rotation.x = (i / 3) * Math.PI;
        g.add(rayon);
      }
      this.pneus.push(g);
      return g;
    };
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * ROUE_AVANT.x, ROUE_AVANT.r, ROUE_AVANT.z);
      pivot.add(roue(ROUE_AVANT.r, ROUE_AVANT.l));
      carrosserie.add(pivot);
      this.rouesAvant.push(pivot);
      const arriere = roue(ROUE_ARRIERE.r, ROUE_ARRIERE.l);
      arriere.position.set(s * ROUE_ARRIERE.x, ROUE_ARRIERE.r, ROUE_ARRIERE.z);
      carrosserie.add(arriere);
      // Les moyeux
      const axe = piece(membre(0.04, 0.04, 0.3, 8), sombre, 0);
      axe.rotation.z = (s * Math.PI) / 2;
      axe.position.set(s * 0.42, ROUE_ARRIERE.r, ROUE_ARRIERE.z);
      carrosserie.add(axe);
    }

    // ——— Le pilote, assis
    pilote.racine.scale.setScalar(gabarit.pilote);
    pilote.racine.position.set(0, SIEGE * gabarit.kart - pilote.milieu * gabarit.pilote, RECUL_PILOTE * gabarit.kart);
    this.caisse.add(pilote.racine);
    pilote.poser(poseAssise(0), 1, 1, 0);

    // ——— L'ombre portée, un disque sombre et flou
    const ombreTex = texture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(20,10,40,0.55)");
      g.addColorStop(0.6, "rgba(20,10,40,0.35)");
      g.addColorStop(1, "rgba(20,10,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.ombre = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9 * gabarit.kart, 2.8 * gabarit.kart),
      new THREE.MeshBasicMaterial({ map: ombreTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    this.ombre.rotation.x = -Math.PI / 2;
    this.ombre.renderOrder = 2;

    // ——— La bulle de protection
    this.bulle = new THREE.Mesh(
      new THREE.SphereGeometry(1.75 * gabarit.kart, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: { uTemps: { value: 0 }, uFin: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal); vV = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTemps; uniform float uFin;
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            float bord = smoothstep(0.55, 0.62, f);
            float reflet = smoothstep(0.86, 0.88, dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))));
            vec3 col = mix(vec3(0.55, 0.95, 1.0), vec3(1.0), bord * 0.5 + reflet);
            float a = 0.12 + bord * 0.55 + reflet * 0.7;
            a *= 1.0 - uFin * (0.5 + 0.5 * sin(uTemps * 30.0));
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.bulle.position.y = 0.75 * gabarit.kart;
    this.bulle.visible = false;
    this.caisse.add(this.bulle);
  }

  /** Les roues tournent selon la vitesse, celles de devant suivent le volant. */
  animer(dt: number, vitesse: number, braquage: number, temps: number) {
    this.rotationRoues += (vitesse * dt) / ROUE_ARRIERE.r;
    for (const p of this.pneus) p.rotation.x = this.rotationRoues;
    for (const r of this.rouesAvant) r.rotation.y = -braquage * 0.45;
    this.volant.rotation.z = braquage * 1.2;
    for (const [i, f] of this.flammes.entries()) {
      if (!f.visible) continue;
      const s = 0.8 + Math.sin(temps * 70 + i * 2) * 0.25 + Math.random() * 0.2;
      f.scale.set(s, s * (1 + Math.random() * 0.4), s);
    }
  }

  turbo(actif: boolean, couleur = "#ffb02e") {
    for (const f of this.flammes) {
      f.visible = actif;
      (f.material as THREE.MeshBasicMaterial).color.set(couleur);
    }
  }
}
