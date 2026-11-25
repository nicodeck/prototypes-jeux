# Veilleuse — prototype 5

Une traversée contemplative dans l'esprit de Hollow Knight, en 2D avec WebGL (Three.js). On y
incarne Veilleuse, une petite silhouette encapuchonnée qui porte une lanterne. Elle descend dans
une mine engloutie et éteinte, rallume les lanternes en chemin, jusqu'au Cœur, un grand cristal
endormi tout au fond. Il n'y a ni combat ni mort : tout le soin va à l'ambiance.

## Lancer

```bash
bun install
bun dev     # http://localhost:5177
bun test    # vérifie que toute la mine est praticable (moins d'une seconde)
```

Raccourcis de mise au point : `?direct` saute l'écran titre, `&col=110&ligne=30` démarre à cet
endroit de la mine. Dans la console, `veilleuse.monde` donne l'état du jeu.

## Commandes

← → marcher · Espace, ↑ ou Z sauter (garder appuyé pour sauter plus haut) · ↓ descendre d'une
planche, ou plonger · contre une paroi en l'air : appuyer vers elle pour glisser, et sauter pour
rebondir · dans l'eau : Espace pour nager vers le haut · Échap pause · M muet. Une manette marche
aussi.

## La mine

Cinq zones, chacune avec sa lumière et sa musique : **le Puits** (des rais de lumière tombent
encore de la surface, un chevalement au loin), **les Galeries** (étais, wagonnets, vieilles lampes
de mineur), **la Crevasse** (une cheminée à gravir par sauts muraux, des cristaux qui tintent),
**les Galeries noyées** (on nage, on plonge sous un rideau de roche, des lucioles) et **le Cœur**.
Neuf lanternes sont à rallumer ; la musique s'enrichit à chaque lanterne. Atteindre le Cœur
déclenche la fin.

## Les choix

- **Le monde ne dépend pas du rendu** (`src/monde/`). Il avance d'une image à la fois, avec une
  physique au pixel près reprise de Plume (prototype 2), et tourne aussi dans les tests.
- **Un solveur vérifie la mine** (`tests/solveur.ts`). Il explore avec la vraie physique : marcher,
  sauter plus ou moins longtemps, glisser et rebondir sur les parois, nager, plonger. `bun test`
  échoue si une lanterne ou le Cœur devient inatteignable, ou s'il existe un endroit d'où l'on ne
  peut plus atteindre le Cœur.
- **La roche est un champ de distance** (`src/rendu/terrain.ts`). La carte est faite de cases,
  mais on calcule pour chaque point la distance à la roche. Le shader en tire des contours
  organiques, un intérieur qui s'assombrit, des arêtes qui accrochent la lumière et un liseré clair
  sur les sols. Le même champ, décalé et gonflé, dessine la caverne qui continue derrière.
- **De la lumière partout** (`src/rendu/lumieres.ts`). La lanterne de Veilleuse, les lanternes, les
  cristaux, les lampes et le Cœur éclairent la roche, l'eau, les herbes et la poussière. Un halo
  (bloom), une vignette, du grain et une légère aberration finissent l'image.
- **Des fonds peints en code** (`src/rendu/fonds.ts`, `src/rendu/peinture.ts`). Chaque salle a
  trois plans peints au Canvas 2D (parois, piliers, chevalements, galeries qui s'enfoncent,
  cristaux, racines), un premier plan noir et flou, et des nappes de brume, qui glissent tous en
  parallaxe.
- **Tout est fait maison, sans aucun fichier d'image ni de son.** La musique est générative
  (`src/moteur/sons.ts`) : drone, nappes d'accords, notes de verre, gouttes, réverbération de
  caverne, tout passe sous l'eau quand on plonge.

## Ce qu'on peut modifier à la main

| Fichier | Ce qu'il contient |
|---|---|
| `src/reglages.ts` | vitesse, saut, gravité, saut mural, nage… |
| `src/monde/carte.ts` | les salles, une lettre par case (légende en tête du fichier) |
| `src/rendu/ambiances.ts` | les couleurs et la brume de chaque zone |
| `src/monde/zones.ts` | les titres des zones |

Après une modification des réglages ou de la carte, `bun test` dit si la mine est toujours
praticable.
