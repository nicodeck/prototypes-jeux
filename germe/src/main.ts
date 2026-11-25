// Germe : une toute petite planète morte à faire revivre.
import { Jeu } from "./jeu/jeu";

const toile = document.getElementById("ecran") as HTMLCanvasElement;
const ui = document.getElementById("ui") as HTMLElement;
const jeu = new Jeu(toile, ui);

function image() {
  jeu.boucle();
  requestAnimationFrame(image);
}
requestAnimationFrame(image);

// Pour les essais à la main, dans la console : germe.monde, germe.joueur…
(window as unknown as { germe: Jeu }).germe = jeu;
