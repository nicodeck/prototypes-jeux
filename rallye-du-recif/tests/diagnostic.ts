// Statistiques de course : `bun tests/diagnostic.ts`
import { courir, temps } from "./outils";
import type { NomPilote } from "../src/course/pilotes";
import type { Niveau } from "../src/course/bot";

const pilotes: NomPilote[] = ["rin", "tao", "mira", "ganzo"];
for (const niveau of ["facile", "moyen", "difficile"] as Niveau[]) {
  const r = courir(pilotes.map((p) => ({ pilote: p, niveau })), { objets: false });
  console.log(`\n${niveau} sans objets — terminée: ${r.terminee}, ${r.course.chrono.toFixed(1)} s`);
  for (const k of r.course.classement())
    console.log(`  ${k.rang}. ${k.pilote.padEnd(6)} ${k.fini ? temps(k.temps).toFixed(1) + " s" : "—"}  tours: ${k.passages.map((p, i) => (temps(p) - (i ? temps(k.passages[i - 1]) : 0)).toFixed(1)).join(" / ")}  chutes ${k.chutes}  miniTurbos ${k.miniTurbos}  arrêt max ${r.arrets[k.numero].toFixed(1)} s`);
}
const mixte = courir(
  (["facile", "moyen", "difficile", "facile", "moyen", "difficile", "moyen", "difficile"] as Niveau[]).map((n, i) => ({ pilote: pilotes[i % 4], niveau: n })),
  { graine: 3 },
);
console.log(`\n8 karts avec objets — terminée: ${mixte.terminee}, ${mixte.course.chrono.toFixed(1)} s`);
for (const k of mixte.course.classement())
  console.log(`  ${k.rang}. ${k.pilote.padEnd(6)} ${k.numero} ${k.fini ? temps(k.temps).toFixed(1) + " s" : "—"} chutes ${k.chutes} arrêt ${mixte.arrets[k.numero].toFixed(1)}`);
