# Pouls — prototype 11

Un jeu de rythme-action en 2D. Brin, un petit esprit-graine au cœur lumineux, court à travers une jungle
bioluminescente, de nuit, vers l'Arbre-Cœur qui bat à l'horizon. Tout bat au rythme d'une musique générée
par le code : les ronces, les rôdeurs et les lianes arrivent sur les temps, et chaque geste réussi joue
une note du morceau. Quatre sections (Sous-bois, Marais des spores, Canopée, Le Cœur) qui accélèrent de
100 à 132 battements par minute, une partie d'environ 3 min 45. Univers original.

## Lancer

```bash
cd pouls && bun install && bun dev
```

Puis ouvrir http://localhost:5411 (Chrome de préférence, avec le son). Aucun fichier image ni audio :
tout est dessiné et synthétisé en code.

| Commande | Rôle |
|---|---|
| `bun dev` | le jeu, sur le port 5411 |
| `bun test` | la synchro (chaque obstacle tombe sur un coup de percussion de la partition) et des parties simulées |
| `bun run build` | vérification des types et construction |

Paramètres d'URL : `?auto` joue tout seul, parfaitement · `?direct` saute le titre · `?section=3` commence
à la section 3 · `?t=95` commence à 95 s · `?vitesse=4` horloge accélérée, sans son · `?fige=120` image figée.

## Touches

Espace ou ↑ (ou W / Z) sauter les ronces · X, J ou → frapper les rôdeurs · ↓ ou S glisser sous les lianes ·
Échap pause. À l'écran titre : C calibre la latence (on tape sur des clics), ← → l'ajustent à la main.
Au doigt : moitié gauche haut = sauter, moitié gauche bas = glisser, moitié droite = frapper.

## Choix

- **Une seule partition** (`src/partition.ts`) : chaque mesure porte un accord, un style de batterie et une
  ligne d'obstacles écrite en croches (`"S...F.S."`). La musique et le niveau en sortent ensemble, donc
  ils ne peuvent pas se décaler.
- **Un ordonnanceur sur l'horloge audio** (`src/audio/ordonnanceur.ts`) : il programme les notes 150 ms à
  l'avance ; le minuteur ne sert qu'à le réveiller. L'image lit la même horloge, corrigée de la latence de
  sortie (`src/horloge.ts`).
- **Les gestes sont des notes** : un appui en avance est recalé pile sur le temps, un appui en retard sonne
  tout de suite. Les réussites enchaînées ouvrent des couches (rythme, arpège, mélodie, éclat) ; un raté
  les referme et étouffe le son une demi-seconde.
- **Le rendu** (`src/rendu/`) : silhouettes peintes une fois en blanc puis teintées à chaque image selon la
  palette de la section, brume et rais de lumière entre les plans, lueurs additives, lueur diffuse obtenue en
  réduisant l'image deux fois. Tout ce qui luit pulse sur la grosse caisse.
- **Les réglages** (tempo, fenêtres de jugement, points, vie, élan, durées des gestes) sont dans
  `src/reglages.ts` ; la musique et les obstacles dans `src/partition.ts`.
- **Vérifications** dans `.verif/` : captures (`capture.ts`), partie complète en pilote automatique avec le
  vrai son (`partie.ts`), niveaux du mixage rendus hors ligne (`audio.ts`).
