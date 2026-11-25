// La vue : assemble tout le rendu et le fait vivre à chaque image (caméra, passage d'une salle à
// l'autre par un fondu au noir, ambiance de la zone, lumières, effets des événements).
import * as THREE from "three";
import { CASE, type Mine } from "../monde/mine";
import type { Evenement, Monde } from "../monde/monde";
import type { Zone } from "../monde/zones";
import { AMBIANCES, AmbianceCourante } from "./ambiances";
import { creerDecor } from "./decor";
import { creerEau } from "./eau";
import { creerBrume, creerCiel, peindreSalle, type PlanPeint } from "./fonds";
import { creerHeros } from "./heros";
import { LUMIERES, envoyerLumieres, type Lumiere } from "./lumieres";
import { creerParticules } from "./particules";
import { HAUTEUR_VUE, Scene } from "./scene";
import { creerTerrain } from "./terrain";

const EAU = new THREE.Color("#0a2a30");

const LUEURS: Record<Zone, [number, number, number]> = {
  puits: [0.45, 1.25, 0.9],
  galeries: [0.75, 0.55, 0.25],
  crevasse: [0.5, 1.1, 0.5],
  noyees: [0.3, 0.2, 0.45],
  coeur: [0.5, -0.15, 1.0],
};

export function creerVue(toile: HTMLCanvasElement, mine: Mine, salleDepart: number) {
  const sc = new Scene(toile);
  const salles = mine.salles;
  const amb = new AmbianceCourante(salles[salleDepart].zone);

  const ciel = creerCiel();
  sc.scene.add(ciel.mesh);
  const brumes = [
    { ...creerBrume(0.3, 0.32, -86, 0.2), force: 0.32 },
    { ...creerBrume(0.5, 0.3, -76, 0.45), force: 0.3 },
    { ...creerBrume(0.85, 0.2, -56, 0.7), force: 0.2 },
    { ...creerBrume(1.25, 0.07, 3, 0.9), force: 0.07 },
  ];
  for (const b of brumes) sc.scene.add(b.mesh);

  // Les plans peints, pour une vue large (jusqu'à 21:9)
  const demiPeinture = { l: (HAUTEUR_VUE / 2) * 2.4, h: HAUTEUR_VUE / 2 };
  const plans: PlanPeint[] = salles.flatMap((s, i) => peindreSalle(s, i, demiPeinture, [-90, -80, -70, 1]));
  for (const p of plans) sc.scene.add(p.mesh);

  const terrain = creerTerrain(mine);
  sc.scene.add(terrain.roche, ...terrain.arriere);

  const accentDe = (col: number, ligne: number) => {
    const s = salles.find((s) => col >= s.col && col < s.col + s.largeur && ligne >= s.ligne && ligne < s.ligne + s.hauteur);
    return new THREE.Color(AMBIANCES[s?.zone ?? "crevasse"].accent);
  };
  const zoneDe = (col: number, ligne: number) =>
    salles.find((s) => col >= s.col && col < s.col + s.largeur && ligne >= s.ligne && ligne < s.ligne + s.hauteur)?.zone ?? "puits";
  const decor = creerDecor(mine, accentDe, zoneDe);
  sc.scene.add(decor.groupe);
  const eau = creerEau(mine);
  sc.scene.add(eau.groupe);
  const particules = creerParticules(mine);
  sc.scene.add(particules.points);
  const heros = creerHeros();
  sc.scene.add(heros.groupe);
  const lumieres: Lumiere[] = [...decor.lumieres, heros.lumiere];

  // La caméra
  let salleCam = salleDepart;
  const cam = new THREE.Vector2();
  let avance = 0;
  let fondu = 1;
  let fonduCible = 0;
  let salleAttendue = -1;
  let coeur = 0;
  let tempsFinale = -1;
  let temps = 0;

  const bornes = (s: number, x: number, y: number) => {
    const salle = salles[s];
    const { l, h } = sc.demiVue;
    const x0 = salle.col;
    const x1 = salle.col + salle.largeur;
    const yh = -salle.ligne;
    const yb = -salle.ligne - salle.hauteur;
    const bx = x1 - x0 < 2 * l ? (x0 + x1) / 2 : Math.max(x0 + l, Math.min(x1 - l, x));
    const by = yh - yb < 2 * h ? (yh + yb) / 2 : Math.max(yb + h, Math.min(yh - h, y));
    return [bx, by] as const;
  };

  const montrerPlans = (s: number) => {
    for (const p of plans) p.mesh.visible = p.salle === salles[s];
  };
  montrerPlans(salleCam);

  return {
    scene: sc,
    get salleCam() {
      return salleCam;
    },
    get fondu() {
      return fondu;
    },
    /** Place la caméra directement sur Veilleuse (au départ). */
    cadrer(m: Monde) {
      const [bx, by] = bornes(salleCam, (m.heros.x + 5) / CASE, -(m.heros.y + 11) / CASE + 1);
      cam.set(bx, by);
    },
    /** Commence ou finit un fondu au noir (écran titre). */
    fonduVers(v: number) {
      fonduCible = v;
    },
    evenements(evs: Evenement[]) {
      for (const e of evs) {
        const x = e.x / CASE;
        const y = -e.y / CASE;
        if (e.sorte === "atterrit") {
          heros.atterrir(e.force);
          if (e.force > 0.15) particules.nuage(x, y, e.force);
        } else if (e.sorte === "saut" || e.sorte === "sautMural") heros.sauter();
        else if (e.sorte === "plouf") {
          eau.eclabousser(x, y + 1, 6);
          particules.eclaboussure(x, y + 1, 1);
        } else if (e.sorte === "sortieEau") {
          eau.eclabousser(x, y, -4);
          particules.eclaboussure(x, y, 0.6);
        } else if (e.sorte === "brasse") {
          for (let i = 0; i < 3; i++) particules.bulle(x + (Math.random() - 0.5) * 0.3, y + 1);
        } else if (e.sorte === "lanterne") {
          particules.gerbe(x, y + 0.6, 70);
        } else if (e.sorte === "coeur") {
          tempsFinale = temps;
          particules.gerbe(decor.coeur.x, decor.coeur.y, 200, new THREE.Color("#ffc4e4"));
          particules.envol(decor.coeur.x, decor.coeur.y, 900, new THREE.Color("#ffb6dc"));
        }
      }
    },
    /** Dessine une image. x, y : Veilleuse (en cases, interpolée entre deux pas du monde). */
    dessiner(dt: number, m: Monde, x: number, y: number, surTinte: (note: number, pan: number) => void) {
      temps += dt;
      LUMIERES.uTemps.value = temps;
      const h = m.heros;

      // Passer d'une salle à l'autre : fondu au noir, puis on recadre
      if (m.salle !== salleCam && salleAttendue !== m.salle && tempsFinale < 0) {
        salleAttendue = m.salle;
        fonduCible = 1;
      }
      if (salleAttendue >= 0 && fondu > 0.97) {
        salleCam = salleAttendue;
        salleAttendue = -1;
        montrerPlans(salleCam);
        amb.viser(salles[salleCam].zone, 1);
        const [bx, by] = bornes(salleCam, x + h.regard * 1.5, y + 1.2);
        cam.set(bx, by);
        fonduCible = 0;
      }
      const vitesseFondu = fonduCible > fondu ? 6 : 2.2;
      fondu += Math.sign(fonduCible - fondu) * Math.min(Math.abs(fonduCible - fondu), dt * vitesseFondu);

      // La finale : le Cœur s'embrase, la caméra recule doucement
      if (tempsFinale >= 0) {
        const t = temps - tempsFinale;
        coeur = Math.min(1, t / 5);
        sc.recul = 1 + Math.min(0.55, t * 0.05);
        sc.cadrer();
        sc.final.uniforms.uFlash.value = Math.max(0, 0.25 - t * 0.3) * (t < 0.1 ? t * 10 : 1);
        sc.bloom.strength = 0.85 + coeur * 0.25;
      }

      // La caméra suit Veilleuse, regarde un peu devant et vers le bas quand on tombe
      avance += (h.regard * 1.6 - avance) * Math.min(1, dt * 1.5);
      const vy = -h.vy * 60 / CASE;
      const basChute = vy < -8 ? Math.max(-3, (vy + 8) * 0.25) : 0;
      const [bx, by] = bornes(salleCam, x + avance, y + 1.3 + basChute);
      const suivi = tempsFinale >= 0 ? 0.6 : 3.2;
      cam.x += (bx - cam.x) * Math.min(1, dt * suivi);
      cam.y += (by - cam.y) * Math.min(1, dt * suivi * 0.9);
      sc.camera.position.set(cam.x, cam.y, 50);

      // L'ambiance de la zone
      const zone = salles[salleCam].zone;
      amb.viser(zone, Math.min(1, dt * 0.8));
      LUMIERES.uAmbiant.value.copy(amb.ambiant).multiplyScalar(1 + coeur * 1.2);
      LUMIERES.uBrume.value.copy(amb.brume);
      terrain.uniforms.uRoche.value.copy(amb.roche);
      terrain.uniforms.uMousse.value.copy(amb.mousse);
      terrain.uniforms.uEclat.value = m.allumees.filter(Boolean).length / Math.max(1, m.allumees.length) + coeur;
      const salle = salles[salleCam];
      const refX = salle.col + salle.largeur / 2;
      const refY = -salle.ligne - salle.hauteur / 2;
      terrain.regler(cam.x, cam.y, refX, refY, amb.lointains, amb.brume);
      const { l, h: dh } = sc.demiVue;
      ciel.uniforms.uHaut.value.copy(amb.cielHaut);
      ciel.uniforms.uBas.value.copy(amb.cielBas);
      ciel.uniforms.uBrume.value.copy(amb.brume);
      ciel.uniforms.uCam.value.copy(cam);
      ciel.uniforms.uVue.value.set(l * 2, dh * 2);
      ciel.uniforms.uTemps.value = temps;
      const lu = LUEURS[zone];
      ciel.uniforms.uLueur.value.set(lu[0], lu[1], lu[2] + coeur * 1.5);
      for (const b of brumes) {
        b.uniforms.uCouleur.value.copy(amb.brume);
        b.uniforms.uCam.value.copy(cam);
        b.uniforms.uVue.value.set(l * 2, dh * 2);
        b.uniforms.uTemps.value = temps;
        b.uniforms.uForce.value = b.force * amb.densite;
      }
      sc.final.uniforms.uTeinte.value.copy(amb.brume);
      sc.final.uniforms.uFondu.value = fondu;

      // Les plans peints glissent en parallaxe autour du centre de la salle
      for (const p of plans) {
        if (!p.mesh.visible) continue;
        p.mesh.position.set(refX + (cam.x - refX) * (1 - p.facteur), refY + (cam.y - refY) * (1 - p.facteur), 0);
      }

      // Veilleuse, le décor, l'eau, les particules
      heros.mettreAJour(dt, temps, h, x, y);
      const tintes = decor.mettreAJour(dt, temps, x, y + 0.7, h.vx * 60 / CASE, m.allumees, coeur);
      for (const t of tintes) surTinte(t.note, Math.max(-1, Math.min(1, (t.x - cam.x) / l)));
      if (h.dansEau && Math.abs(h.vx) > 0.5 && Math.random() < 0.3) eau.eclabousser(x, y + 1.2, Math.abs(h.vx) * 0.25);
      if (h.dansEau && !h.surface && Math.random() < dt * 1.5) particules.bulle(x + 0.1, y + 1);
      eau.uniforms.uCouleur.value.copy(amb.brume).multiplyScalar(0.32).lerp(EAU, 0.3);
      eau.mettreAJour(dt, temps);
      particules.uniforms.uEchelle.value = (window.innerHeight * sc.renderer.getPixelRatio()) / (HAUTEUR_VUE * sc.recul);
      particules.mettreAJour(
        dt,
        temps,
        { x: cam.x, y: cam.y, l, h: dh },
        lumieres,
        { x, y, lx: heros.lanterne.x, ly: heros.lanterne.y },
        zone,
        decor.lanternes,
        m.allumees,
        (gx, gy, dansLEau) => {
          if (dansLEau) eau.eclabousser(gx, gy, 0.8);
        },
      );

      envoyerLumieres(lumieres, cam.x, cam.y);
      sc.dessiner(temps);
    },
  };
}

export type Vue = ReturnType<typeof creerVue>;
