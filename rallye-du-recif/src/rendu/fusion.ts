// Fusionne un décor fait de centaines de petites pièces en quelques gros maillages :
// un par matériau, plus un par épaisseur de contour. La carte graphique dessine alors tout
// le décor en quelques appels au lieu de milliers.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { matContour } from "./toon";

function nettoyer(g: THREE.BufferGeometry, avecUv: boolean) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const nom of Object.keys(n.attributes)) if (nom !== "position" && nom !== "normal" && nom !== "uv") n.deleteAttribute(nom);
  if (!n.getAttribute("normal")) n.computeVertexNormals();
  if (avecUv && !n.getAttribute("uv")) n.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n.getAttribute("position").count * 2), 2));
  if (!avecUv && n.getAttribute("uv")) n.deleteAttribute("uv");
  return n;
}

/** Remplace le contenu d'un groupe statique par des maillages fusionnés. */
export function fusionner(groupe: THREE.Group) {
  groupe.updateMatrixWorld(true);
  const parMateriau = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const parContour = new Map<string, { facteur: number; trait: THREE.Color; geos: THREE.BufferGeometry[] }>();
  groupe.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.ShaderMaterial;
    if (o.name === "contour") {
      const facteur = m.uniforms.uFacteur.value as number;
      const trait = m.uniforms.uTrait.value as THREE.Color;
      const cle = `${facteur.toFixed(2)}-${trait.getHexString()}`;
      if (!parContour.has(cle)) parContour.set(cle, { facteur, trait, geos: [] });
      parContour.get(cle)!.geos.push(nettoyer(o.geometry, false).applyMatrix4(o.matrixWorld));
      return;
    }
    if (!parMateriau.has(m)) parMateriau.set(m, []);
    parMateriau.get(m)!.push(nettoyer(o.geometry, true).applyMatrix4(o.matrixWorld));
  });
  const inverse = groupe.matrixWorld.clone().invert();
  groupe.clear();
  for (const [materiau, geos] of parMateriau) {
    const g = mergeGeometries(geos);
    g.applyMatrix4(inverse);
    groupe.add(new THREE.Mesh(g, materiau));
  }
  for (const { facteur, trait, geos } of parContour.values()) {
    const g = mergeGeometries(geos);
    g.applyMatrix4(inverse);
    groupe.add(new THREE.Mesh(g, matContour(facteur, trait)));
  }
  return groupe;
}
