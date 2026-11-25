# Plume — prototype 2

Un plateformer en pixel art, sans moteur de jeu : TypeScript et Canvas 2D. Plume, un petit
oiseau qui ne sait pas voler, traverse la forêt jusqu'à son nid.

## Lancer

```bash
bun install
bun dev     # http://localhost:5174
bun test    # vérifie que le niveau est jouable (environ 30 secondes)
```

`?colonne=150&ligne=10` démarre à cet endroit de la carte.

## Commandes

← → marcher · X courir · Espace sauter (garder appuyé pour sauter plus haut) · ↓ descendre
d'une passerelle · P pause · M muet. Une manette marche aussi.

## Les choix

- **Une physique au pixel près, sans rattrapage.** Un corps avance d'un pixel à la fois et
  s'arrête au premier contact. Si les pieds ne passent pas au-dessus d'un bord, on ne monte
  pas dessus (`src/monde/physique.ts`). Les seules tolérances sont des tolérances de temps :
  on peut sauter 5 images après avoir quitté un bord, et un appui 5 images trop tôt compte.
- **Le monde ne dépend pas du navigateur** (`src/monde/`). Il avance d'une image à la fois,
  toujours au même rythme : il tourne aussi dans les tests.
- **Un solveur vérifie le niveau** (`tests/solveur.ts`). Il explore le niveau avec la vraie
  physique : depuis chaque endroit où l'on tient debout, il essaie des gestes (marcher,
  courir, sauter plus ou moins longtemps, lâcher ou inverser la direction en l'air,
  attendre une plateforme). `bun test` échoue si l'arrivée, une graine ou un bloc devient
  inatteignable. Deux œufs d'or se prennent sans plume, le troisième seulement avec.
- **Tout est fait maison.** Les dessins sont du texte, une lettre par pixel ; les sons sont
  synthétisés.

## Ce qu'on peut modifier à la main

| Fichier | Ce qu'il contient |
|---|---|
| `src/reglages.ts` | vitesses, hauteur de saut, gravité, ressort… |
| `src/monde/niveau-1.ts` | le niveau, une lettre par case (légende dans `niveau.ts`) |
| `src/rendu/dessins.ts` | les dessins, une lettre par pixel (couleurs dans `palette.ts`) |

Après une modification du niveau ou des réglages, `bun test` dit si le niveau est toujours
jouable.

## Le niveau

Marcher, courir et sauter ; blocs mystère et briques ; passerelles ; limaces à écraser,
bogues qui piquent, grenouilles qui sautent, guêpes ; une plume qui donne un double saut,
perdue au premier coup ; deux plateformes qui vont et viennent au-dessus d'un grand trou ;
un ressort et des nuages qui se dissipent ; un couloir de briques avec une cachette ; une
plateforme qui monte et descend au pied d'une falaise ; trois œufs d'or cachés ; des
drapeaux de reprise ; le nid à l'arrivée.
