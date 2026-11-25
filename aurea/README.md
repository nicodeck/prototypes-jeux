# Aurea — prototype 7

Un city builder dans l'esprit d'Anno 117 : Pax Romana, en 3D avec Three.js. On fonde une cité
romaine sur une île de Méditerranée, vers 117 apr. J.-C. Au départ, il y a un petit bourg au fond
d'une baie, avec un port, un forum, une pêcherie et un vieil aqueduc. On le fait grandir
jusqu'à consacrer un temple de Jupiter sur le promontoire. Le gameplay reste réduit : tout le soin
va à l'ambiance.

## Lancer

```bash
bun install
bun dev     # http://localhost:5179
bun test    # la cité grandit-elle jusqu'au temple ? (moins d'une seconde)
```

À l'écran titre, deux choix :

- **Fonder la cité** : on part du bourg.
- **Contempler** : une grande cité, bâtie en quelques secondes par l'architecte automatique.

Raccourcis de mise au point :

- `?direct` saute l'écran titre, `?vitrine` bâtit la grande cité.
- `&heure=18.5` règle l'heure, `&figer` la fige, `&meteo=orage` impose le temps (clair, voile,
  nuageux, pluie, orage).
- `&cam=x,z,distance,lacet` place la caméra, `&cinema` lance le mode cinéma.
- Dans la console, `aurea.ville` donne l'état de la cité.
- `atelier.html` montre tous les bâtiments côte à côte (`?type=maison&palier=2`, `&nuit`…).

## Commandes

| | |
|---|---|
| Parcourir l'île | ZQSD ou flèches, ou clic droit glissé |
| Tourner | A et E, ou clic milieu glissé |
| S'approcher, s'éloigner | molette, jusqu'au ras des rues |
| Bâtir | choisir une carte en bas, puis cliquer ; R tourne le bâtiment |
| Route | R, puis cliquer, glisser, relâcher |
| Démolir | X |
| Vitesse | Espace (pause), 1, 2, 3 |
| Le temps | T fige l'heure, N passe au moment suivant (aube, midi, couchant, nuit) ; un clic sur l'icône du temps implore Jupiter |
| Mode cinéma | C |
| Son, aide | M, H |

## Les règles

- **Les routes** : un atelier doit être relié par la route au port ou à un entrepôt. Ses
  charrettes y livrent ; ceux qui transforment (moulin, boulangerie, pressoir, cave) y prennent ce
  qu'il leur faut.
- **Les maisons** : elles veulent des biens, pris au stock commun, et des services à portée.
  Comblées, elles se remplissent et paient plus d'impôts. Comblées assez longtemps, elles montent
  d'un niveau, si l'on peut payer l'agrandissement.

| Niveau | Biens | Services | Débloque |
|---|---|---|---|
| **Liberti** | poisson | forum | — |
| **Plebeii** | poisson, pain, huile | forum, thermes | 100 Liberti |
| **Equites** | poisson, pain, huile, vin | forum, thermes | 220 Plebeii |
| **Le temple** | | | 320 Equites |

- **Les chaînes** :
  - le pain : ferme à blé, puis moulin, puis boulangerie ;
  - l'huile : oliveraie, puis pressoir ;
  - le vin : vignoble, puis cave ;
  - le reste : poisson, bois, marbre.
- **Les navires** : un navire marchand vient de temps en temps du large. Il accoste au port et
  achète ce qui déborde des entrepôts.
- **Le temple** : sa consécration ouvre une grande fête. Les maisons à portée paient davantage.

## L'ambiance

- **Le ciel** (`src/rendu/ciel.ts`) : une vraie diffusion atmosphérique, de Rayleigh et de Mie,
  calculée pour chaque direction dans une petite texture.
  - Le dôme et la brume de tous les matériaux la lisent : le lointain a toujours la couleur du ciel.
  - Le ciel sert aussi de lumière d'ambiance et de reflet.
  - On y voit les nuages, le soleil, la lune, les étoiles et la Voie lactée.
  - Après la pluie vient l'arc-en-ciel, et l'orage a ses éclairs.
- **Les nuages** : la couche qu'on voit dans le ciel est la même que celle dont l'ombre glisse sur
  l'île (`src/rendu/atmosphere.ts`).
- **Le jour et la nuit** : une journée dure environ six minutes. On a l'aube brumeuse, l'heure
  dorée aux ombres longues, puis la nuit au clair de lune.
  - La nuit, les fenêtres s'allument une à une, et torches et feux éclairent les murs.
  - Cet éclairage est calculé après le rendu à partir de la profondeur : jusqu'à 48 lumières.
- **La mer** (`src/rendu/mer.ts`) :
  - une houle de vagues et des hauts-fonds turquoise et transparents, avec reflets de vagues sur
    le sable et herbiers de posidonie ;
  - le chemin de paillettes du soleil, de l'écume en dentelle sur les plages et un ressac sous
    les falaises.
- **La vie** (`src/rendu/vie.ts`) :
  - en ville : des passants qui tiennent leur droite (et leur lanterne la nuit), des charrettes
    tirées par des ânes, l'âne qui tourne la meule du moulin ;
  - en mer : des barques qui sortent à l'aube et rentrent au crépuscule, le navire marchand,
    parfois des dauphins ;
  - dans le ciel et sur les collines : des mouettes au-dessus du port, des martinets le soir, des
    chèvres.
- **Les particules** (`src/rendu/particules.ts`) : fumées des cheminées le matin et le soir,
  vapeur des thermes, étincelles des feux, panache du volcan, pluie, lucioles, poussières dorées
  au couchant, pétales de la fête.
- **L'image** (`src/rendu/post.ts`) : rayons de soleil, halo des lumières, flou de maquette selon
  la distance, étalonnage selon l'heure, vignette et grain.
- **La chronique** (`src/ville/chronique.ts`) : de petites nouvelles des habitants, avec des noms
  romains et des anecdotes, s'affichent en bas à gauche.
- **Le son** (`src/moteur/sons.ts`) : tout est synthétisé, sans aucun fichier.
  - La musique est générative : lyre, aulos, tambour sur cadre et orgue hydraulique, dans les modes
    antiques.
  - Le paysage sonore suit la caméra : ressac, cigales, foule, ateliers, port, grillons, pluie,
    tonnerre.
- **Tout est fait maison** : aucun fichier d'image, de modèle ni de son. Les bâtiments
  (`src/rendu/modeles/`), les arbres, les personnages et les bateaux sont modelés en code.

## Les choix

- **La simulation ne dépend pas du rendu** (`src/ville/`). Elle avance par pas de 0,1 s, toujours
  de la même façon, et tourne aussi dans les tests.
- **L'île est une fonction de hauteur** (`src/ville/ile.ts`). La simulation s'en sert pour savoir
  où bâtir, et le rendu pour modeler le terrain.
- **L'architecte** (`src/ville/architecte.ts`) bâtit comme un joueur appliqué : les maisons sur la
  grille romaine près du forum, les champs à la campagne, le temple sur le promontoire. Il sert à
  la vitrine et aux tests.
- **Le rendu s'adapte** : la résolution baisse toute seule si l'image rame.

## Ce que vérifient les tests

`bun test` fait tourner la cité sans navigateur :

- **Le bourg** : il est entièrement posé et relié au port. Il reste du terrain à bâtir, et le
  promontoire peut porter le temple.
- **Les règles** :
  - un atelier sans route ne livre rien ;
  - on ne bâtit ni dans l'eau, ni sur une route, ni sans le sou ;
  - le pain sort bien de sa chaîne ;
  - une maison comblée monte de niveau.
- **La partie entière** : l'architecte consacre le temple en moins de 40 minutes de jeu, sans
  s'endetter.
- **La reproductibilité** : la même partie donne toujours le même résultat.

## Ce qu'on peut modifier à la main

| Fichier | Ce qu'il contient |
|---|---|
| `src/reglages.ts` | la durée du jour, l'argent de départ, les chantiers, les impôts, la qualité de l'image |
| `src/ville/catalogue.ts` | les bâtiments, leurs coûts et productions, les besoins de chaque niveau, les seuils |
| `src/ville/bourg.ts` | le bourg de départ et l'aqueduc |
| `src/ville/ile.ts` | la géographie de l'île |
| `src/rendu/ambiances.ts` | la lumière, la brume et l'étalonnage selon l'heure |

Après un changement des règles ou des réglages, `bun test` dit si la cité peut toujours grandir
jusqu'au temple.

## Ce qui reste à juger

- **L'équilibre face à un humain** : l'architecte arrive au temple en 25 minutes de jeu environ.
- **Le son** : il a été réglé sur des mesures, pas encore à l'oreille.
- **La fluidité sur un écran Retina** : mesurée à 1600 × 900. La vitrine tourne à environ 65
  images par seconde de jour et 120 la nuit ; la résolution adaptative doit absorber le reste.
