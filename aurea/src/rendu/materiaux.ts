// Le matériau de tous les bâtiments : un seul MeshStandardMaterial, enrichi en code.
//
// Chaque sommet porte une couleur (attribut `color`, en linéaire) et un numéro de matière
// (attribut `aMat`, voir MAT ci-dessous). Le shader en tire le relief et le grain : les tuiles
// romaines en rangs, les blocs de pierre jointoyés, les veines du marbre, le grain du bois, le
// crépi qui se salit au pied des murs. La nuit, les ouvertures (MAT.ouverture) s'allument une à
// une, et le feu (MAT.feu) brûle toujours.
//
// Les bâtiments sont toujours dessinés en InstancedMesh (même seuls), avec deux attributs par
// instance (voir `creerInstances`) :
// - `aTeinte` (vec3) : la teinte de l'enduit de cette maison-là ;
// - `aInst` (vec4) : (avancement du chantier de 0 à 1, hauteur du modèle, état, graine).
//   L'état vaut 0 normal, 1 sélectionné, 2 survolé.
import * as THREE from "three";
import { patcher } from "./atmosphere";

/** Les numéros de matière, à mettre dans l'attribut `aMat` de chaque sommet. */
export const MAT = {
  /** Enduit à la chaux, teinté par l'instance (aTeinte) */
  enduit: 0,
  /** Tuiles de terre cuite (tegulae et imbrices) : le relief suit la pente */
  tuiles: 1,
  /** Marbre blanc veiné, un peu brillant */
  marbre: 2,
  /** Bois : poutres, portes, échafaudages, barques */
  bois: 3,
  /** Pierre de taille en assises régulières */
  pierre: 4,
  /** Toile : auvents, voiles, stores (couleur du sommet) */
  tissu: 5,
  /** Fenêtres et portes ouvertes : sombres le jour, allumées la nuit */
  ouverture: 6,
  /** Feu : braseros, foyers, feu du phare (toujours lumineux) */
  feu: 7,
  /** Eau des bassins et fontaines */
  eau: 8,
  /** Plantes en pot, guirlandes, haies, treilles */
  feuillage: 9,
  /** Bronze des statues et des toits de coupole */
  bronze: 10,
  /** Dallage des places et des quais */
  dallage: 11,
  /** Enduit peint (rouge pompéien, ocre, bandeaux) : la couleur du sommet, sans teinte d'instance */
  peint: 12,
  /** Terre cuite brute : amphores, jarres, briques */
  terrecuite: 13,
} as const;

const GLSL_BATIMENT_VERTEX = /* glsl */ `
  attribute float aMat;
  attribute vec3 aTeinte;
  attribute vec4 aInst;
  varying float vMat;
  varying vec3 vTeinte;
  varying vec4 vInst;
`;

const GLSL_BATIMENT_FRAG = /* glsl */ `
  varying float vMat;
  varying vec3 vTeinte;
  varying vec4 vInst;

  float matEst(float m) { return 1.0 - step(0.5, abs(vMat - m)); }

  /** Une direction horizontale le long de la surface (pour les rangs de tuiles et les assises) */
  vec2 tangenteH(vec3 n) {
    vec2 h = n.xz;
    float l = length(h);
    return l > 1e-3 ? vec2(-h.y, h.x) / l : vec2(1.0, 0.0);
  }

  /** Coordonnées 2D sur la surface : u le long de l'horizontale, v vers le haut (ou le long de la pente) */
  vec2 coordSurface(vec3 p, vec3 n) {
    if (abs(n.y) > 0.92) return p.xz;
    vec2 t = tangenteH(n);
    return vec2(dot(p.xz, t), p.y);
  }
`;

export interface OptionsMateriau {
  /** Fantôme de placement : translucide, vert ou rouge selon `uFantome` */
  fantome?: boolean;
}

export function materiauBatiment(options: OptionsMateriau = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 1 });
  const fantome = options.fantome === true;
  if (fantome) {
    m.transparent = true;
    m.depthWrite = false;
    m.opacity = 0.62;
  }
  const uFantome = { value: new THREE.Color(0.4, 1, 0.5) };
  m.userData.uFantome = uFantome;

  patcher(m, {
    cle: fantome ? "batiment-fantome" : "batiment",
    vertexDecl: GLSL_BATIMENT_VERTEX,
    vertexDebut: /* glsl */ `
      vMat = aMat;
      #ifdef USE_INSTANCING
        vTeinte = aTeinte;
        vInst = aInst;
      #else
        vTeinte = vec3(1.0);
        vInst = vec4(1.0, 1.0, 0.0, 0.0);
      #endif
    `,
    fragDecl: GLSL_BATIMENT_FRAG + (fantome ? "uniform vec3 uFantome;" : ""),
    fragCouleur: /* glsl */ `
      vec3 nM = normalize(vNormalMonde);
      vec2 st = coordSurface(vMonde, nM);
      float graine = vInst.w;
      float hLoc = vLocal.y;

      // Le chantier : le bâtiment monte du sol, une assise après l'autre
      float avance = vInst.x;
      if (avance < 0.999) {
        float coupe = avance * (vInst.y + 0.3) - 0.15;
        if (hLoc > coupe) discard;
      }

      vec3 c = diffuseColor.rgb;
      float n1 = bruitTex(vMonde.xz * 0.37 + vMonde.y * 0.21).a;
      float n2 = bruitTex(st * 1.9 + graine * 7.0).b;

      if (matEst(0.0) > 0.5) {
        // Enduit : la teinte de la maison, un crépi irrégulier, la poussière au pied du mur,
        // et des coulures sous les toits
        c *= vTeinte;
        c *= 0.9 + 0.16 * n2 + 0.06 * (bruitTex(st * 7.3).a - 0.5);
        float pied = 1.0 - smoothstep(0.0, 0.45, hLoc);
        c = mix(c, c * vec3(0.72, 0.64, 0.55), pied * 0.55);
        float coulure = smoothstep(0.62, 0.85, bruitTex(vec2(st.x * 3.1, st.y * 0.35)).g) * (1.0 - abs(nM.y));
        c *= 1.0 - coulure * 0.13;
      } else if (matEst(1.0) > 0.5) {
        // Tuiles : des rangs d'imbrices le long de la pente, chaque tuile un peu différente
        vec2 t = tangenteH(nM);
        float u = dot(vMonde.xz, t) * 5.2;
        vec2 pente = abs(nM.y) < 0.999 ? normalize(nM.xz) : vec2(0.0, 1.0);
        float v = (dot(vMonde.xz, pente) - vMonde.y * 0.0) * 3.3;
        float rang = floor(v);
        float colonne = floor(u + 0.5 * mod(rang, 2.0));
        float h = hash21(vec2(colonne, rang) + graine * 13.0);
        c *= 0.82 + 0.3 * h;
        c = mix(c, c * vec3(1.08, 0.86, 0.7), step(0.85, h) * 0.6);
        // Lichen gris-vert sur les vieux toits
        float lichen = smoothstep(0.64, 0.82, bruitTex(vMonde.xz * 0.6).b);
        c = mix(c, c * vec3(0.62, 0.66, 0.5), lichen * 0.35);
        // Le bas de chaque tuile, dans l'ombre de celle du dessus
        c *= 0.72 + 0.28 * smoothstep(0.0, 0.35, fract(v));
      } else if (matEst(2.0) > 0.5) {
        // Marbre : des veines grises qui serpentent
        float veine = abs(sin((st.x * 1.7 + st.y * 0.9) * 3.0 + bruitTex(st * 0.35).g * 9.0));
        c *= (0.94 + 0.06 * n2) * vec3(0.8, 0.79, 0.76);
        c = mix(c, c * vec3(0.72, 0.72, 0.76), (1.0 - smoothstep(0.0, 0.09, veine)) * 0.45);
      } else if (matEst(3.0) > 0.5) {
        // Bois : un grain fin et des planches
        float grain = bruitTex(vec2(st.x * 0.3, st.y * 9.0) + vLocal.xz * 2.0).a;
        c *= 0.78 + 0.4 * grain;
        c *= 0.9 + 0.1 * step(0.08, fract(st.x * 6.0));
      } else if (matEst(4.0) > 0.5) {
        // Pierre de taille : assises de blocs décalés, joints sombres
        float rang = floor(st.y * 4.2);
        float bloc = floor(st.x * 2.1 + rang * 0.5);
        float h = hash21(vec2(bloc, rang) + graine);
        c *= 0.8 + 0.28 * h;
        vec2 f = vec2(fract(st.x * 2.1 + rang * 0.5), fract(st.y * 4.2));
        float joint = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y)));
        if (abs(nM.y) > 0.92) joint = 0.0;
        c *= 1.0 - joint * 0.45;
        c *= 0.92 + 0.12 * n1;
      } else if (matEst(6.0) > 0.5) {
        c *= 0.25;
      } else if (matEst(9.0) > 0.5) {
        c *= 0.75 + 0.5 * bruitTex(vMonde.xz * 3.1 + vMonde.y * 2.0).a;
      } else if (matEst(10.0) > 0.5) {
        // Bronze : patine vert-de-gris dans les creux
        float patine = smoothstep(0.4, 0.75, bruitTex(vMonde.xz * 1.7 + vMonde.y * 1.3).g);
        c = mix(c, vec3(0.22, 0.42, 0.33), patine * 0.65);
      } else if (matEst(11.0) > 0.5) {
        // Dallage : de grandes dalles irrégulières
        vec2 q = vMonde.xz * 2.4;
        vec2 i = floor(q);
        vec2 f = fract(q);
        float h = hash21(i + graine);
        c *= 0.82 + 0.26 * h;
        float joint = 1.0 - smoothstep(0.0, 0.06, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        c *= 1.0 - joint * 0.4;
      } else if (matEst(12.0) > 0.5) {
        c *= 0.9 + 0.14 * n2;
        float pied = 1.0 - smoothstep(0.0, 0.4, hLoc);
        c = mix(c, c * vec3(0.7, 0.62, 0.55), pied * 0.5);
      } else if (matEst(13.0) > 0.5) {
        c *= 0.85 + 0.25 * n2;
      }

      // Survol et sélection : un liseré doré qui respire
      float etat = vInst.z;
      if (etat > 0.5) {
        float respire = 0.5 + 0.5 * sin(uTemps * 4.0);
        c = mix(c, c * 1.25 + vec3(0.06, 0.045, 0.01), etat > 1.5 ? 0.35 : 0.55 + 0.25 * respire);
      }
      diffuseColor.rgb = c;
      ${fantome ? "diffuseColor.rgb = mix(diffuseColor.rgb, uFantome, 0.55);" : ""}
    `,
    fragMatiere: /* glsl */ `
      if (matEst(1.0) > 0.5) roughnessFactor = 0.72;
      else if (matEst(2.0) > 0.5) roughnessFactor = 0.32;
      else if (matEst(3.0) > 0.5) roughnessFactor = 0.8;
      else if (matEst(6.0) > 0.5) roughnessFactor = 0.95;
      else if (matEst(8.0) > 0.5) { roughnessFactor = 0.05; }
      else if (matEst(10.0) > 0.5) { roughnessFactor = 0.42; metalnessFactor = 0.75; }
      else if (matEst(11.0) > 0.5) roughnessFactor = 0.7;
      else if (matEst(13.0) > 0.5) roughnessFactor = 0.78;
    `,
    fragNormale: /* glsl */ `
      {
        vec3 nM2 = normalize(vNormalMonde);
        vec3 pert = vec3(0.0);
        if (matEst(1.0) > 0.5 && abs(nM2.y) < 0.995) {
          // Les imbrices bombées : la normale ondule en travers de la pente
          vec2 t = tangenteH(nM2);
          float u = dot(vMonde.xz, t) * 5.2;
          float rang = floor(dot(vMonde.xz, normalize(nM2.xz)) * 3.3);
          float ondule = sin((u + 0.5 * mod(rang, 2.0)) * 6.2831853);
          pert += vec3(t.x, 0.0, t.y) * ondule * 0.45;
        } else if (matEst(4.0) > 0.5 && abs(nM2.y) < 0.92) {
          vec2 st2 = coordSurface(vMonde, nM2);
          float rang = floor(st2.y * 4.2);
          vec2 f = vec2(fract(st2.x * 2.1 + rang * 0.5), fract(st2.y * 4.2));
          vec2 t = tangenteH(nM2);
          pert += vec3(t.x, 0.0, t.y) * (smoothstep(0.92, 1.0, f.x) - smoothstep(0.08, 0.0, f.x)) * 0.5;
          pert.y += (smoothstep(0.9, 1.0, f.y) - smoothstep(0.1, 0.0, f.y)) * 0.5;
        } else if (matEst(8.0) > 0.5) {
          vec2 q = vMonde.xz * 3.0 + uTemps * 0.3;
          pert += vec3(bruitTex(q * 0.2).a - 0.5, 0.0, bruitTex(q * 0.2 + 0.5).a - 0.5) * 0.6;
        }
        if (dot(pert, pert) > 0.0) normal = normalize(normal + (viewMatrix * vec4(pert, 0.0)).xyz);
      }
    `,
    fragEmission: /* glsl */ `
      {
        // Fenêtres : elles s'allument une à une au crépuscule et s'éteignent dans la nuit
        if (matEst(6.0) > 0.5) {
          vec2 cellule = floor(vLocal.xz * 2.0 + vLocal.y * 1.7);
          float h = hash21(cellule + graine * 31.7);
          float allume = step(h, uLampes);
          float vacille = 0.82 + 0.18 * sin(uTemps * (6.0 + h * 5.0) + h * 40.0) * sin(uTemps * 2.3 + h * 9.0);
          totalEmissiveRadiance += vec3(1.25, 0.6, 0.2) * allume * vacille * (0.3 + 0.7 * uNuit) * step(0.01, uLampes);
        }
        if (matEst(7.0) > 0.5) {
          float f = 0.75 + 0.25 * sin(uTemps * 13.0 + vLocal.y * 9.0) * sin(uTemps * 7.3 + vLocal.x * 5.0);
          totalEmissiveRadiance += vec3(3.2, 1.35, 0.35) * f * (0.5 + 0.8 * uNuit);
        }
        if (matEst(5.0) > 0.5) {
          // La toile laisse passer le soleil quand on la regarde à contre-jour
          vec3 vue = normalize(vMonde - cameraPosition);
          float contre = pow(max(dot(vue, uLumiereDir), 0.0), 3.0) * (1.0 - uNuit);
          totalEmissiveRadiance += diffuseColor.rgb * uLumiereCouleur * contre * 0.5;
        }
        ${fantome ? "totalEmissiveRadiance += uFantome * 0.25;" : ""}
      }
    `,
  });
  return m;
}

/**
 * Prépare une InstancedMesh de bâtiments avec ses attributs d'instance.
 * La géométrie doit avoir `position`, `normal`, `color` et `aMat`.
 */
export function creerInstances(geometrie: THREE.BufferGeometry, materiau: THREE.Material, max: number, hauteur: number) {
  const mesh = new THREE.InstancedMesh(geometrie, materiau, max);
  const teinte = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  for (let i = 0; i < max; i++) inst.setXYZW(i, 1, hauteur, 0, Math.random());
  teinte.setUsage(THREE.DynamicDrawUsage);
  inst.setUsage(THREE.DynamicDrawUsage);
  geometrie.setAttribute("aTeinte", teinte);
  geometrie.setAttribute("aInst", inst);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
