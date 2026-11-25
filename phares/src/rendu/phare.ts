// Un phare : tour rayée, galerie, lanterne vitrée, maison du gardien,
// et ses deux pinceaux de lumière volumétrique qui tournent dans la pluie.

import * as THREE from "three";
import { PhareDef } from "../monde/archipel";
import { GLSL_BRUIT } from "./glsl";
import { creerLueur } from "./lueur";
import { REGLAGES } from "../reglages";

const LONGUEUR_FAISCEAU = 260;

const FAISCEAU_VERTEX = /* glsl */ `
uniform float uLongueur;
varying float vLong;
varying vec3 vN;
varying vec3 vP;
varying float vAngle;
void main() {
  vLong = clamp(position.x / uLongueur, 0.0, 1.0);
  vAngle = atan(position.z, position.y);
  vec4 m = modelMatrix * vec4(position, 1.0);
  vP = m.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * m;
}
`;

const FAISCEAU_FRAGMENT = /* glsl */ `
uniform float uForce;
uniform float uTemps;
uniform vec3 uCouleur;
uniform vec3 uAxe;
uniform float uDensiteBrume;
varying float vLong;
varying vec3 vN;
varying vec3 vP;
varying float vAngle;
${GLSL_BRUIT}
void main() {
  vec3 V = normalize(cameraPosition - vP);
  float bord = pow(abs(dot(normalize(vN), V)), 2.2);
  float longi = pow(max(1.0 - vLong, 0.0), 2.6) * smoothstep(0.0, 0.01, vLong);
  float coeur = exp(-vLong * 40.0) * 2.0;
  float poussiere = 0.55 + 0.9 * fbm3(vec2(vLong * 22.0 - uTemps * 1.4, vAngle * 2.0 + uTemps * 0.3));
  float d = length(cameraPosition - vP);
  float proche = smoothstep(2.0, 14.0, d);
  // vu depuis l'intérieur du pinceau (dans l'axe), on s'efface : le halo d'éblouissement prend le relais
  float axe = abs(dot(V, uAxe));
  float dansAxe = 1.0 - smoothstep(0.6, 0.93, axe);
  // la brume avale les faisceaux lointains (moins vite que le reste : ils percent la nuit)
  float b = d * uDensiteBrume * 0.75;
  float brume = exp(-b * b) * (1.0 - smoothstep(450.0, 650.0, d));
  float a = uForce * bord * (longi * poussiere + coeur) * proche * dansAxe * brume;
  gl_FragColor = vec4(uCouleur * a * 0.2, 1.0);
}
`;

function bande(rBas: number, rHaut: number, h: number, couleur: THREE.Color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rHaut, rBas, h, 28, 1),
    new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.75 }),
  );
  return m;
}

export class Phare {
  groupe = new THREE.Group();
  def: PhareDef;
  allume = 0; // 0..1, animé
  estAllume = false;
  angle = 0;
  lampePos = new THREE.Vector3();
  private pivot = new THREE.Group();
  private faisceauMat: THREE.ShaderMaterial;
  private vitre: THREE.MeshStandardMaterial;
  private fenetre: THREE.MeshStandardMaterial;
  private coeur: THREE.Mesh;
  private halo: THREE.Sprite;
  private braise: THREE.Sprite;
  spot: THREE.SpotLight;
  lampe: THREE.PointLight;

  constructor(def: PhareDef, uTemps: THREE.IUniform, uDensiteBrume: THREE.IUniform) {
    this.def = def;
    this.angle = (Math.abs(def.x * 0.37 + def.z * 0.11) % 6.28);
    this.groupe.position.set(def.x, def.socle - 0.5, def.z);
    const H = def.hauteurTour;
    const blanc = new THREE.Color(0.75, 0.72, 0.66);
    const couleurs = [new THREE.Color(0.55, 0.06, 0.04), new THREE.Color(0.06, 0.09, 0.14), new THREE.Color(0.12, 0.12, 0.1)];
    const rayure = couleurs[def.rayures % couleurs.length];

    // soubassement de pierre
    const socle = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 4.0, 2.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a3631, roughness: 0.95, flatShading: true }),
    );
    socle.position.y = 0.6;
    this.groupe.add(socle);

    // la tour, en bandes alternées
    const nb = 5;
    const rBas = 2.7;
    const rHaut = 1.75;
    for (let i = 0; i < nb; i++) {
      const y0 = 1.8 + (i / nb) * (H - 1.8);
      const y1 = 1.8 + ((i + 1) / nb) * (H - 1.8);
      const r0 = THREE.MathUtils.lerp(rBas, rHaut, i / nb);
      const r1 = THREE.MathUtils.lerp(rBas, rHaut, (i + 1) / nb);
      const b = bande(r0, r1, y1 - y0, i % 2 === 0 ? blanc : rayure);
      b.position.y = (y0 + y1) / 2;
      this.groupe.add(b);
    }
    // petites fenêtres de l'escalier
    const fenMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(1, 0.6, 0.25), emissiveIntensity: 0 });
    this.fenetre = fenMat;
    for (let i = 0; i < 3; i++) {
      const y = 5 + i * ((H - 8) / 3);
      const r = THREE.MathUtils.lerp(rBas, rHaut, (y - 1.8) / (H - 1.8));
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.2), fenMat);
      const a = i * 2.1;
      f.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      f.lookAt(new THREE.Vector3(Math.cos(a) * 10, y, Math.sin(a) * 10));
      this.groupe.add(f);
    }

    const metal = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.5, metalness: 0.6 });
    // galerie et garde-corps
    const galerie = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.3, 0.45, 28), metal);
    galerie.position.y = H + 0.2;
    this.groupe.add(galerie);
    const rambarde = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 6, 36), metal);
    rambarde.rotation.x = Math.PI / 2;
    rambarde.position.y = H + 1.3;
    this.groupe.add(rambarde);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const montant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4), metal);
      montant.position.set(Math.cos(a) * 2.6, H + 0.8, Math.sin(a) * 2.6);
      this.groupe.add(montant);
    }

    // lanterne vitrée
    this.vitre = new THREE.MeshStandardMaterial({
      color: 0x1a2228,
      roughness: 0.15,
      metalness: 0.3,
      emissive: new THREE.Color(1.0, 0.78, 0.45),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.85,
    });
    const vitre = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 2.4, 12, 1, true), this.vitre);
    vitre.position.y = H + 1.65;
    this.groupe.add(vitre);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const meneau = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), metal);
      meneau.position.set(Math.cos(a) * 1.47, H + 1.65, Math.sin(a) * 1.47);
      this.groupe.add(meneau);
    }
    const toit = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.7, 12), new THREE.MeshStandardMaterial({ color: rayure.clone().multiplyScalar(0.8), roughness: 0.5, metalness: 0.4 }));
    toit.position.y = H + 3.7;
    this.groupe.add(toit);
    const boule = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), metal);
    boule.position.y = H + 4.65;
    this.groupe.add(boule);

    // la lampe
    this.coeur = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), fog: false }));
    this.coeur.position.y = H + 1.6;
    this.groupe.add(this.coeur);
    this.lampePos.set(def.x, this.groupe.position.y + H + 1.6, def.z);

    this.halo = creerLueur(new THREE.Color(1.0, 0.78, 0.5), 30);
    this.halo.position.y = H + 1.6;
    this.groupe.add(this.halo);
    // braise rouge des phares éteints : le cap à suivre
    this.braise = creerLueur(new THREE.Color(1.0, 0.18, 0.08), 9);
    this.braise.position.y = H + 1.6;
    this.groupe.add(this.braise);

    // les deux pinceaux
    this.faisceauMat = new THREE.ShaderMaterial({
      vertexShader: FAISCEAU_VERTEX,
      fragmentShader: FAISCEAU_FRAGMENT,
      uniforms: {
        uLongueur: { value: LONGUEUR_FAISCEAU },
        uForce: { value: 0 },
        uTemps: uTemps,
        uCouleur: { value: new THREE.Color(1.0, 0.82, 0.58) },
        uAxe: { value: new THREE.Vector3(1, 0, 0) },
        uDensiteBrume,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const cone = new THREE.CylinderGeometry(0.6, 18, LONGUEUR_FAISCEAU, 40, 1, true);
    cone.translate(0, -LONGUEUR_FAISCEAU / 2, 0);
    cone.rotateZ(Math.PI / 2); // la pointe à l'origine, le cône vers +x
    for (const sens of [0, Math.PI]) {
      const bras = new THREE.Group();
      bras.rotation.y = sens;
      const m = new THREE.Mesh(cone, this.faisceauMat);
      m.rotation.z = -0.01; // à peine plongeant : le cône ne doit pas toucher la mer
      m.frustumCulled = false;
      m.renderOrder = 12;
      bras.add(m);
      this.pivot.add(bras);
    }
    this.pivot.position.y = H + 1.6;
    this.pivot.visible = false;
    this.groupe.add(this.pivot);

    // maison du gardien
    const murs = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.2), new THREE.MeshStandardMaterial({ color: 0x8c8678, roughness: 0.9 }));
    const maison = new THREE.Group();
    murs.position.y = 1.3;
    maison.add(murs);
    const toitForme = new THREE.Shape();
    toitForme.moveTo(-1.9, 0);
    toitForme.lineTo(0, 1.5);
    toitForme.lineTo(1.9, 0);
    toitForme.lineTo(-1.9, 0);
    const toitMaison = new THREE.Mesh(
      new THREE.ExtrudeGeometry(toitForme, { depth: 4.6, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.8 }),
    );
    toitMaison.rotation.y = Math.PI / 2;
    toitMaison.position.set(-2.3, 2.6, 0);
    maison.add(toitMaison);
    for (const dx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1), fenMat);
      f.position.set(dx, 1.5, 1.62);
      maison.add(f);
    }
    maison.position.set(5.5, 0.2, 2.5);
    maison.rotation.y = 0.4;
    this.groupe.add(maison);

    // lumières réelles (toujours présentes : pas de recompilation des shaders)
    this.spot = new THREE.SpotLight(new THREE.Color(1.0, 0.82, 0.58), 0, 520, 0.14, 0.7, 1.3);
    this.spot.position.copy(this.lampePos);
    this.lampe = new THREE.PointLight(new THREE.Color(1.0, 0.7, 0.4), 0, 60, 1.6);
    this.lampe.position.copy(this.lampePos).add(new THREE.Vector3(0, -2, 0));
  }

  allumer(instantane = false) {
    this.estAllume = true;
    if (instantane) this.allume = 1;
  }

  /** Direction actuelle d'un pinceau dans le plan xz (angle depuis +x vers +z). */
  get angleFaisceau() {
    return this.angle;
  }

  maj(dt: number, temps: number, camera: THREE.Vector3, aube = 0) {
    if (this.estAllume) this.allume = Math.min(1, this.allume + dt / 2.2);
    const a = this.allume;
    const on = a > 0;
    this.angle = (this.angle + dt * REGLAGES.phares.vitesseRotation * (0.3 + 0.7 * a)) % (Math.PI * 2);
    this.pivot.rotation.y = -this.angle;
    (this.faisceauMat.uniforms.uAxe.value as THREE.Vector3).set(Math.cos(this.angle), -0.01, Math.sin(this.angle)).normalize();
    this.pivot.visible = on;
    // allumage : la flamme crépite avant de prendre
    const crepite = a < 1 ? 0.6 + 0.4 * Math.sin(temps * 40) * Math.sin(temps * 23) : 1;
    const f = a * a * crepite;
    this.faisceauMat.uniforms.uForce.value = f * (1 - aube * 0.6);
    (this.coeur.material as THREE.MeshBasicMaterial).color.setRGB(14 * f, 10 * f, 6 * f);
    this.vitre.emissiveIntensity = 1.4 * f;
    this.fenetre.emissiveIntensity = 2.2 * Math.min(1, a * 2);

    // éblouissement quand un pinceau regarde la caméra
    const dx = camera.x - this.lampePos.x;
    const dz = camera.z - this.lampePos.z;
    const versCam = Math.atan2(dz, dx);
    const x = versCam - this.angle + Math.PI / 2;
    const ecart = Math.abs((((x % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2);
    const eblouit = Math.exp(-(ecart * ecart) / 0.012);
    // caméra à l'intérieur d'un pinceau : on l'efface (le halo d'éblouissement prend le relais)
    const dedans = (1 - THREE.MathUtils.smoothstep(ecart, 0.07, 0.22)) * (1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 280, 340));
    this.faisceauMat.uniforms.uForce.value *= 1 - dedans;
    const dist = Math.hypot(dx, dz);
    this.halo.visible = on;
    const tailleHalo = (20 + 60 * eblouit) * (0.4 + 0.6 * Math.min(1, dist / 200)) * (1 - aube * 0.9);
    this.halo.scale.setScalar(tailleHalo * f + 0.01);
    (this.halo.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.55 + eblouit * 0.6) * f;

    // braise des phares éteints : pulsation lente
    this.braise.visible = !this.estAllume;
    const pulse = 0.5 + 0.5 * Math.sin(temps * 2.2 + this.def.x);
    this.braise.scale.setScalar(5 + pulse * 6 + Math.min(14, dist / 40));
    (this.braise.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * pulse;

    this.spot.intensity = 2600 * f;
    this.spot.target.position.set(
      this.lampePos.x + Math.cos(this.angle) * 100,
      this.lampePos.y - 9,
      this.lampePos.z + Math.sin(this.angle) * 100,
    );
    this.spot.target.updateMatrixWorld();
    this.lampe.intensity = 260 * f;
  }
}
