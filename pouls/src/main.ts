// Pouls — point d'entrée : les écrans (titre, calibration, jeu, pause, fin), la boucle d'image,
// et le lien entre les appuis, le jugement, le son et l'image.
//
// Paramètres d'URL utiles :
//   ?auto           le jeu joue tout seul, parfaitement (vérifie qu'une partie va au bout)
//   ?direct         saute l'écran titre
//   ?section=3      commence à la section 3
//   ?t=95           commence à 95 s
//   ?vitesse=4      horloge simulée et accélérée, sans son
//   ?fige=120       image figée à 120 s (pour les captures)

import { clic, sonGeste, sonRate } from "./audio/instruments";
import { MoteurAudio } from "./audio/moteur";
import { Ordonnanceur } from "./audio/ordonnanceur";
import { ecouterEntrees, type Commande } from "./entrees";
import { HorlogeAudio, HorlogeSimulee, type Horloge } from "./horloge";
import { Jeu, type Evenement } from "./jeu";
import { Partition } from "./partition";
import { REGLAGES, type Action } from "./reglages";
import { Ecran } from "./rendu/ecran";
import { dessinerCalibration, dessinerFin, dessinerPause, dessinerTitre, type EtatCalibration } from "./rendu/ecrans";
import { melangerPalettes, PALETTES, paletteAuTemps } from "./rendu/palette";
import { Scene } from "./rendu/scene";
import { positionCoeur } from "./rendu/decor";
import type { Vue } from "./rendu/vue";
import { lisse } from "./outils";

type Phase = "titre" | "calibration" | "jeu" | "pause" | "fin";

const params = new URLSearchParams(location.search);
const PILOTE = params.has("auto");
const VITESSE = params.has("vitesse") ? Number(params.get("vitesse")) || 1 : params.has("fige") ? 0 : null;

const partition = new Partition();
const ecran = new Ecran(document.getElementById("ecran") as HTMLCanvasElement);
const scene = new Scene(ecran);

let phase: Phase = "titre";
let pret = false;
let audio: MoteurAudio | null = null;
let ordonnanceur: Ordonnanceur | null = null;
let horloge: Horloge | null = null;
let jeu: Jeu | null = null;
let tFinReel = 0;
let intensite = 0;
let evenementsSonores = 0;
const presonnes = new Set<number>();
let latence = lireLatence();
let calibration: (EtatCalibration & { horloge: HorlogeAudio; minuterie: ReturnType<typeof setInterval>; t0: number }) | null = null;
let finalJoue = false;
let sectionAffichee = -1;

const erreurs: string[] = [];
window.addEventListener("error", (e) => erreurs.push(String(e.message)));

// Notes de grosse caisse, pour faire battre l'image avec le son.
const coups = partition.notes.filter((n) => n.instr === "grosse" || n.instr === "impact").map((n) => ({ t: n.t, vel: n.vel }));
const tImpact = partition.notes.find((n) => n.instr === "impact")?.t ?? partition.duree;

function lireLatence(): number {
  try {
    const v = Number(localStorage.getItem("pouls.latence"));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function ecrireLatence(v: number) {
  latence = Math.max(REGLAGES.latence.min, Math.min(REGLAGES.latence.max, v));
  try {
    localStorage.setItem("pouls.latence", String(latence));
  } catch {
    /* stockage indisponible : le réglage vaut pour la session */
  }
}

function assurerAudio(): MoteurAudio {
  if (!audio) audio = new MoteurAudio();
  const ctx = audio.ctx as AudioContext;
  if (ctx.state === "suspended") void ctx.resume();
  return audio;
}

// ------------------------------------------------------------------ partie

function debutDemande(): number {
  if (params.has("fige")) return Number(params.get("fige")) || 0;
  if (params.has("t")) return Number(params.get("t")) || 0;
  if (params.has("section")) {
    const s = Math.max(1, Math.min(partition.sections.length, Number(params.get("section")) || 1));
    return s === 1 ? 0 : partition.debutsSections[s - 1].t - (4 * 60) / partition.sections[s - 2].bpm;
  }
  return 0;
}

function demarrerPartie() {
  arreterSon();
  const debut = debutDemande();
  jeu = new Jeu(partition, debut);
  scene.reinitialiser();
  presonnes.clear();
  evenementsSonores = 0;
  finalJoue = debut > tImpact;
  sectionAffichee = -1;
  intensite = jeu.niveau;
  if (VITESSE !== null) {
    horloge = new HorlogeSimulee(debut - (VITESSE > 0 ? REGLAGES.audio.attenteDepart : 0), VITESSE);
  } else {
    const m = assurerAudio();
    m.sortie.gain.cancelScheduledValues(m.ctx.currentTime);
    m.sortie.gain.setValueAtTime(REGLAGES.audio.volume, m.ctx.currentTime);
    m.intensite(jeu.niveau);
    ordonnanceur = new Ordonnanceur(m, partition);
    ordonnanceur.demarrer(debut);
    horloge = new HorlogeAudio(m.ctx as AudioContext, ordonnanceur.t0);
  }
  phase = "jeu";
}

function arreterSon() {
  ordonnanceur?.arreter();
  ordonnanceur = null;
}

function couperMusique() {
  arreterSon();
  if (!audio) return;
  const g = audio.sortie.gain;
  const now = audio.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + 1.5);
}

function mettrePause(oui: boolean) {
  if (!horloge || !jeu) return;
  if (oui && phase === "jeu") {
    phase = "pause";
    horloge.pause();
    if (audio) void (audio.ctx as AudioContext).suspend();
  } else if (!oui && phase === "pause") {
    phase = "jeu";
    if (audio) void (audio.ctx as AudioContext).resume().then(() => horloge?.reprendre());
    else horloge.reprendre();
  }
}

function revenirAuTitre() {
  arreterSon();
  if (audio && (audio.ctx as AudioContext).state === "suspended") void (audio.ctx as AudioContext).resume();
  couperMusique();
  jeu = null;
  horloge = null;
  phase = "titre";
}

/** Les sons des gestes partent tout de suite ; un appui en avance est recalé pile sur le temps. */
function jouerSons(evts: Evenement[]) {
  if (!audio || !ordonnanceur) {
    evenementsSonores = evts.length;
    return;
  }
  for (; evenementsSonores < evts.length; evenementsSonores++) {
    const e = evts[evenementsSonores];
    const now = audio.ctx.currentTime;
    if (e.type === "jugement") {
      const o = e.obstacle.o;
      if (e.jugement === "rate") {
        sonRate(audio, now);
        audio.etouffer();
      } else if (!presonnes.has(o.id)) {
        const t = e.ecart < 0 ? Math.max(now, ordonnanceur.t0 + o.t) : now;
        sonGeste(audio, o.action, t, o.midi, o.accord, e.jugement === "parfait");
      }
    } else if (e.type === "palier") {
      audio.intensite(e.niveau);
    }
  }
}

function appui(action: Action, perf: number) {
  if (!jeu || !horloge || phase !== "jeu") return;
  const t = horloge.aInstant(perf) - latence;
  jeu.appuyer(action, t);
  jouerSons(jeu.evenements);
}

// ------------------------------------------------------------------ calibration

function demarrerCalibration() {
  const m = assurerAudio();
  const ctx = m.ctx as AudioContext;
  m.sortie.gain.cancelScheduledValues(ctx.currentTime);
  m.sortie.gain.setValueAtTime(REGLAGES.audio.volume, ctx.currentTime);
  const periode = 60 / REGLAGES.latence.bpm;
  const t0 = ctx.currentTime + 0.4;
  let n = 0;
  const minuterie = setInterval(() => {
    while (t0 + n * periode < ctx.currentTime + 0.15) {
      clic(m, t0 + n * periode, n % 4 === 0);
      n++;
    }
  }, 25);
  calibration = { ecarts: [], ignores: REGLAGES.latence.tapesIgnorees, resultat: null, temps: 0, periode, horloge: new HorlogeAudio(ctx, t0), minuterie, t0 };
  phase = "calibration";
}

function tapeCalibration(perf: number) {
  const c = calibration;
  if (!c || c.resultat !== null) return;
  const t = c.horloge.aInstant(perf);
  const ecart = t - Math.round(t / c.periode) * c.periode;
  c.ecarts.push(ecart);
  const L = REGLAGES.latence;
  if (c.ecarts.length >= L.tapesIgnorees + L.tapesMesurees) {
    const mesures = c.ecarts.slice(L.tapesIgnorees).sort((a, b) => a - b);
    c.resultat = mesures[Math.floor(mesures.length / 2)];
  }
}

function finirCalibration(garder: boolean) {
  if (!calibration) return;
  clearInterval(calibration.minuterie);
  if (garder && calibration.resultat !== null) ecrireLatence(calibration.resultat);
  calibration = null;
  phase = "titre";
}

// ------------------------------------------------------------------ entrées

ecouterEntrees(ecran.canvas, (commandes: Commande[], perf: number) => {
  const a = commandes.find((c): c is Action => c === "saut" || c === "frappe" || c === "glisse");
  switch (phase) {
    case "titre":
      if (!pret) return;
      if (commandes.includes("valider")) demarrerPartie();
      else if (commandes.includes("calibrer")) demarrerCalibration();
      else if (commandes.includes("plus")) ecrireLatence(latence + REGLAGES.latence.pas);
      else if (commandes.includes("moins")) ecrireLatence(latence - REGLAGES.latence.pas);
      break;
    case "calibration":
      if (commandes.includes("retour")) finirCalibration(false);
      else if (commandes.includes("valider") && calibration?.resultat !== null && !commandes.includes("saut")) finirCalibration(true);
      else if (commandes.includes("saut")) tapeCalibration(perf);
      break;
    case "jeu":
      if (commandes.includes("retour")) mettrePause(true);
      else if (a && !PILOTE) appui(a, perf);
      break;
    case "pause":
      if (commandes.includes("retour")) mettrePause(false);
      else if (commandes.includes("valider") && !commandes.includes("saut")) revenirAuTitre();
      break;
    case "fin":
      if (performance.now() / 1000 - tFinReel < 1.2) return;
      if (commandes.includes("retour")) revenirAuTitre();
      else if (commandes.includes("valider")) demarrerPartie();
      break;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) mettrePause(true);
});

// ------------------------------------------------------------------ boucle d'image

function impulsion(t: number): number {
  // Dernier coup de grosse caisse avant t (recherche dichotomique).
  let lo = 0;
  let hi = coups.length - 1;
  if (hi < 0 || t < coups[0].t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (coups[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  const c = coups[lo];
  return c.vel * Math.exp(-(t - c.t) * 9);
}

function vueJeu(t: number, reel: number): Vue {
  const H = ecran.H;
  // Après un échec, le monde ralentit jusqu'à s'arrêter.
  let tv = t;
  if (jeu?.echec) tv = jeu.tFin + (1 - Math.exp(-2 * (t - jeu.tFin))) / 2;
  const temps = partition.secondesVersTemps(tv);
  const bpm = partition.bpmA(tv);
  const { palette, section } = paletteAuTemps(partition, temps);
  const sb = ((temps % 1) * 60) / bpm;
  const sm = ((temps % 4) * 60) / bpm;
  intensite += ((jeu?.niveau ?? 0) - intensite) * 0.05;
  return {
    t: tv,
    temps,
    reel,
    W: ecran.W,
    H,
    ySol: REGLAGES.monde.ySol,
    xCoureur: ecran.W * REGLAGES.monde.xCoureur,
    pixelsParTemps: REGLAGES.monde.pixelsParTemps,
    palette,
    section,
    pouls: jeu?.echec ? 0 : impulsion(tv),
    battement: Math.exp(-sb * 7),
    mesure: Math.exp(-sm * 4),
    progression: Math.max(0, Math.min(1, tv / (partition.duree - 2.5))),
    intensite,
    bpm,
  };
}

/** L'écran titre : la jungle défile doucement, les couleurs font le tour des sections. */
function vueTitre(reel: number): Vue {
  const bpm = 80;
  const periode = 60 / bpm;
  const temps = reel / periode;
  const cycle = (reel / 9) % PALETTES.length;
  const i = Math.floor(cycle);
  const f = lisse(Math.max(0, Math.min(1, (cycle - i - 0.7) / 0.3)));
  const palette = melangerPalettes(PALETTES[i], PALETTES[(i + 1) % PALETTES.length], f);
  const d = reel % periode;
  const pouls = Math.exp(-d * 9) + (d > 0.2 ? 0.6 * Math.exp(-(d - 0.2) * 9) : 0);
  return {
    t: reel,
    temps: temps * 0.5,
    reel,
    W: ecran.W,
    H: ecran.H,
    ySol: REGLAGES.monde.ySol,
    xCoureur: ecran.W * REGLAGES.monde.xCoureur,
    pixelsParTemps: REGLAGES.monde.pixelsParTemps,
    palette,
    section: i + f,
    pouls,
    battement: Math.exp(-d * 7),
    mesure: Math.exp(-(reel % (periode * 4)) * 4),
    progression: 0.15,
    intensite: 2,
    bpm,
  };
}

let imagesComptees = 0;
let debutComptage = 0;
let ips = 0;

function image(perf: number) {
  requestAnimationFrame(image);
  const reel = perf / 1000;
  imagesComptees++;
  if (reel - debutComptage > 1) {
    ips = imagesComptees / (reel - debutComptage);
    imagesComptees = 0;
    debutComptage = reel;
  }

  if (phase === "titre" || phase === "calibration" || !jeu || !horloge) {
    const v = vueTitre(reel);
    scene.dessiner(v, null, partition, { hud: false, aide: false });
    if (phase === "calibration" && calibration) {
      calibration.temps = calibration.horloge.lire(perf);
      dessinerCalibration(ecran.ctx, v, calibration, Math.round(latence * 1000));
    } else dessinerTitre(ecran.ctx, v, Math.round(latence * 1000), pret);
  } else {
    const t = horloge.lire(perf);
    if (phase === "jeu") {
      if (PILOTE && audio && ordonnanceur) {
        // Le pilote programme le son de ses gestes à l'avance, comme la musique.
        for (const e of jeu.obstacles) {
          if (e.o.t <= t) continue;
          if (e.o.t > t + REGLAGES.audio.avance) break;
          if (!presonnes.has(e.o.id)) {
            presonnes.add(e.o.id);
            sonGeste(audio, e.o.action, ordonnanceur.t0 + e.o.t, e.o.midi, e.o.accord, true);
          }
        }
      }
      jeu.mettreAJour(t, PILOTE);
      jouerSons(jeu.evenements);
      if (jeu.fini) {
        phase = "fin";
        tFinReel = reel;
        if (jeu.echec) couperMusique();
      }
    }
    const v = vueJeu(t, reel);
    if (!finalJoue && t >= tImpact) {
      finalJoue = true;
      const c = positionCoeur(v);
      scene.effets.grandFinal(v, c.x, c.y);
    }
    // Changement de section : un éclair aux couleurs de la nouvelle palette.
    const section = partition.sectionALaSeconde(t);
    if (section !== sectionAffichee) {
      if (sectionAffichee >= 0 && section > sectionAffichee) scene.effets.nouvelleSection(v);
      sectionAffichee = section;
    }
    scene.effets.traiter(jeu.evenements, v);
    evenementsSonores = 0;
    scene.dessiner(v, jeu, partition, { hud: phase !== "fin", aide: v.section < 0.5 });
    if (phase === "pause") dessinerPause(ecran.ctx, v);
    if (phase === "fin") dessinerFin(ecran.ctx, v, jeu, reel - tFinReel);
  }

  (window as unknown as { __pouls: unknown }).__pouls = {
    phase,
    t: horloge ? horloge.lire(perf) : 0,
    duree: partition.duree,
    score: jeu?.score ?? 0,
    compte: jeu ? { ...jeu.compte } : null,
    combo: jeu?.combo ?? 0,
    vie: jeu?.vie ?? 0,
    niveau: jeu?.niveau ?? 0,
    obstacles: partition.obstacles.length,
    ips: Math.round(ips),
    erreurs,
  };
}

// Les polices sont dessinées dans le canevas : on les attend (sans bloquer plus de 2,5 s).
const polices = Promise.all([
  document.fonts.load("900 64px Unbounded"),
  document.fonts.load("700 64px Unbounded"),
  document.fonts.load("400 20px Unbounded"),
  document.fonts.load("800 20px Outfit"),
  document.fonts.load("600 20px Outfit"),
  document.fonts.load("400 20px Outfit"),
]);
void Promise.race([polices, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  pret = true;
  if (params.has("direct") || params.has("fige") || params.has("vitesse")) demarrerPartie();
});

requestAnimationFrame(image);
