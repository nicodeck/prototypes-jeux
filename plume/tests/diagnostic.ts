// bun tests/diagnostic.ts : affiche où le héros peut se tenir (·) et le temps d'exploration.
import { lireNiveau } from "../src/monde/niveau";
import { NIVEAU_1 } from "../src/monde/niveau-1";
import { explorer } from "./solveur";

const niveau = lireNiveau(NIVEAU_1);
const debut = performance.now();
const r = explorer(niveau, { plume: process.argv.includes("--plume") });
console.log(`${r.noeuds} positions explorées en ${Math.round(performance.now() - debut)} ms ; arrivée : ${r.arrivee}`);
const de = Number(process.argv.find((a) => a.startsWith("--de="))?.slice(5) ?? 0);
console.log(
  NIVEAU_1.carte
    .map((ligne, y) => [...ligne.padEnd(niveau.largeur)].map((c, x) => (r.positions.has(`${x},${y}`) ? "·" : c)).join("").slice(de, de + 110))
    .join("\n"),
);
