// Faire courir des bots sans navigateur.
import { Bot, type Niveau } from "../src/course/bot";
import { Course, IMAGES_PAR_SECONDE, type OptionsCourse } from "../src/course/course";
import { hasard } from "../src/course/hasard";
import type { NomPilote } from "../src/course/pilotes";

export interface Engage {
  pilote: NomPilote;
  niveau: Niveau;
  derive?: boolean;
  raccourci?: boolean;
}

export interface Resultat {
  course: Course;
  /** Le plus long moment passé sans avancer, en secondes, pour chaque kart. */
  arrets: number[];
  /** La course est allée au bout avant la limite de temps. */
  terminee: boolean;
}

export function courir(engages: Engage[], options: OptionsCourse & { limite?: number } = {}): Resultat {
  const course = new Course(
    engages.map((e) => e.pilote),
    options,
  );
  const alea = hasard((options.graine ?? 1) * 7919);
  const bots = engages.map((e) => new Bot(e.niveau, hasard(Math.floor(alea() * 1e9)), e));
  const limite = (options.limite ?? 300) * IMAGES_PAR_SECONDE;
  const arrets = engages.map(() => 0);
  const meilleur = engages.map(() => -Infinity);
  const depuis = engages.map(() => 0);
  while (!course.terminee && course.image < limite) {
    course.pas(bots.map((b, i) => b.commandes(course, i)));
    if (!course.lancee) continue;
    for (const k of course.karts) {
      if (k.fini) continue;
      if (k.distance > meilleur[k.numero] + 1) {
        meilleur[k.numero] = k.distance;
        depuis[k.numero] = course.image;
      }
      arrets[k.numero] = Math.max(arrets[k.numero], (course.image - depuis[k.numero]) / IMAGES_PAR_SECONDE);
    }
  }
  return { course, arrets, terminee: course.terminee };
}

export const temps = (images: number) => images / IMAGES_PAR_SECONDE;
