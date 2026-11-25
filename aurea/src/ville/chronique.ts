// La chronique de l'île : de petites nouvelles des habitants, qui donnent un visage à la cité.
// Elle observe la simulation à chaque pas et écrit une ligne de temps en temps, jamais trop
// souvent, en donnant la priorité à ce qui compte.
import { NOMS_MARCHANDISES, type Marchandise, type TypeBatiment } from "./catalogue";
import { choisir, type Hasard } from "./hasard";
import type { Ville } from "./ville";

export interface Ligne {
  temps: number;
  texte: string;
  /** 0 anecdote, 1 nouvelle, 2 grand moment */
  importance: number;
}

const PRENOMS = ["Gaius", "Lucius", "Marcus", "Publius", "Quintus", "Titus", "Sextus", "Aulus", "Decimus", "Gnaeus", "Servius", "Spurius"];
const NOMS = ["Aemilius", "Cornelius", "Valerius", "Iulius", "Claudius", "Flavius", "Fabius", "Licinius", "Sempronius", "Terentius", "Caecilius", "Pompeius"];
const FEMMES = ["Aemilia", "Cornelia", "Valeria", "Iulia", "Claudia", "Flavia", "Livia", "Octavia", "Tullia", "Caecilia", "Fabia", "Antonia"];
const SURNOMS = ["Felix", "Hilarus", "Primus", "Faustus", "Eros", "Philo", "Syrus", "Thallus", "Secundus", "Rufus", "Niger", "Celer"];
export const ORIGINES = ["Alexandrie", "Carthage", "Ostie", "Massilia", "Gadès", "Antioche", "Rhodes", "Pouzzoles", "Leptis Magna", "Corinthe", "Éphèse", "Tarraco"];
export const CARGAISONS = ["du papyrus", "des épices d'Arabie", "du vin de Chios", "du lin d'Égypte", "de l'ambre de la Baltique", "de l'encens", "du verre de Sidon", "du garum", "de la soie", "du cuivre de Chypre"];

const ATELIERS: Partial<Record<TypeBatiment, string[]>> = {
  peche: ["{n} prend la mer avec ses filets.", "{n} a ramené un thon superbe : on le montre sur le quai."],
  bucheron: ["La hache de {n} résonne dans la pinède.", "{n} débite les pins pour la charpente."],
  ferme: ["{n} sème le blé sur les terres du sud.", "Les moissonneurs de {n} chantent dans les blés."],
  moulin: ["L'âne de {n} tourne déjà la meule.", "{n} vend sa première farine."],
  boulangerie: ["Le premier pain sort du four de {n}.", "L'odeur du four de {n} remplit la rue."],
  oliveraie: ["{n} plante des oliviers : ses petits-enfants en récolteront les fruits.", "On gaule les olives chez {n}."],
  pressoir: ["Le pressoir de {n} grince : l'huile coule dans les jarres.", "{n} goûte l'huile nouvelle sur du pain."],
  vigne: ["{n} taille ses vignes en chantant.", "Les vendangeurs de {n} ont les pieds violets."],
  cave: ["{n} scelle les dolia : le vin vieillira jusqu'à l'hiver.", "On trinque chez {n} au vin nouveau."],
  carriere: ["Les tailleurs de {n} attaquent la paroi de marbre.", "Un bloc de marbre pur sort de la carrière de {n}."],
  forum: ["Le forum s'anime : marchands et badauds y affluent.", "Un orateur harangue la foule au forum."],
  thermes: ["Les thermes ouvrent leurs portes : on s'y presse jusqu'au soir.", "On ne parle plus que des nouveaux thermes."],
  entrepot: ["Un nouvel horreum ouvre ses portes : on y range amphores et sacs.", "{n} tient les comptes du nouvel entrepôt."],
};

export class Chronique {
  lignes: Ligne[] = [];
  private derniere = -100;
  private readonly attente: Ligne[] = [];
  private derniersManques = new Map<Marchandise | "forum" | "thermes", number>();
  private derniereHeure = -1;
  private derniereMeteo = "";
  private brumeAnnoncee = -1;
  private prochaineAnecdote = 40;

  constructor(private readonly alea: Hasard) {}

  homme() {
    return `${choisir(this.alea, PRENOMS)} ${choisir(this.alea, NOMS)}`;
  }
  femme() {
    return choisir(this.alea, FEMMES);
  }
  affranchi() {
    return `${choisir(this.alea, PRENOMS)} ${choisir(this.alea, NOMS)} ${choisir(this.alea, SURNOMS)}`;
  }
  quelquun() {
    return this.alea() < 0.35 ? this.femme() : this.alea() < 0.5 ? this.affranchi() : this.homme();
  }

  /** Ajoute une ligne à la file ; les grands moments passent devant. */
  ecrire(texte: string, importance = 1) {
    this.attente.push({ temps: 0, texte, importance });
    this.attente.sort((a, b) => b.importance - a.importance);
    if (this.attente.length > 6) this.attente.length = 6;
  }

  observer(v: Ville) {
    for (const e of v.evenements) {
      if (e.sorte === "construit") {
        const b = v.batiments.get(e.id);
        if (!b) continue;
        if (b.type === "maison") {
          if (this.alea() < 0.3) this.ecrire(`${this.affranchi()}, venu de ${choisir(this.alea, ORIGINES)}, s'installe avec sa famille.`, 0);
        } else if (b.type !== "temple") {
          const phrases = ATELIERS[b.type];
          if (phrases) this.ecrire(choisir(this.alea, phrases).replace("{n}", this.quelquun()), 1);
        }
      } else if (e.sorte === "evolution") {
        if (this.alea() < 0.4) {
          const n = this.quelquun();
          this.ecrire(
            e.palier === 1
              ? choisir(this.alea, [`La famille de ${n} ouvre une taberna sur la rue.`, `${n} fait monter un étage et loue des chambres.`])
              : choisir(this.alea, [`${this.homme()} est élevé au rang de chevalier ; sa domus s'orne de marbre.`, `${n} fait peindre des fresques dans son atrium.`]),
            0,
          );
        }
      } else if (e.sorte === "palier") {
        this.ecrire(
          e.palier === 1
            ? "Les Liberti prospèrent : les premiers Plebeii réclament pain, huile et thermes."
            : e.palier === 2
              ? "La plèbe s'enrichit : les premiers Equites veulent du vin de nos coteaux."
              : "La cité est digne des dieux : on peut bâtir le temple de Jupiter.",
          2,
        );
      } else if (e.sorte === "temple") {
        this.ecrire("Le temple de Jupiter est consacré. Toute l'île est en fête !", 2);
      } else if (e.sorte === "eclair") {
        // rien : le tonnerre suffit
      }
    }

    // Les manques, rappelés de temps en temps
    for (const b of v.batiments.values()) {
      if (b.type !== "maison") continue;
      for (const m of b.manques) {
        if (m === "route") continue;
        const dernier = this.derniersManques.get(m) ?? -1e9;
        if (v.temps - dernier < 110) continue;
        this.derniersManques.set(m, v.temps);
        if (m === "forum" || m === "thermes") {
          this.ecrire(`Dans certaines rues, on se plaint : il faudrait ${m === "forum" ? "un forum" : "des thermes"} plus près.`, 1);
        } else {
          const nom = NOMS_MARCHANDISES[m].toLowerCase();
          const article = /^[aeiouh]/.test(nom) ? "l'" : nom.endsWith("s") ? "les " : "le ";
          this.ecrire(`Au marché, on murmure : ${article}${nom} ${nom.endsWith("s") ? "manquent" : "manque"}.`, 1);
        }
      }
    }

    // Le temps qui passe
    const h = v.horloge.heure;
    const heureEntiere = Math.floor(h);
    if (heureEntiere !== this.derniereHeure) {
      if (heureEntiere === 6 && this.derniereHeure !== -1) this.ecrire(`Le soleil se lève sur Aurea. Jour ${v.horloge.jour}.`, 1);
      if (heureEntiere === 20) this.ecrire("On allume les lampes ; les tavernes s'emplissent.", 0);
      this.derniereHeure = heureEntiere;
    }
    if (v.horloge.meteo !== this.derniereMeteo) {
      if (v.horloge.meteo === "orage") this.ecrire("Orage sur la mer : les barques restent au port.", 1);
      else if (v.horloge.meteo === "pluie") this.ecrire("Une averse rafraîchit les rues et fait briller les dalles.", 0);
      else if (v.horloge.meteo === "clair" && this.derniereMeteo) this.ecrire("Le ciel se dégage sur la baie.", 0);
      this.derniereMeteo = v.horloge.meteo;
    }
    if (v.horloge.ciel.brume > 0.5 && this.brumeAnnoncee !== v.horloge.jour) {
      this.brumeAnnoncee = v.horloge.jour;
      this.ecrire("La brume du matin enveloppe la baie.", 0);
    }

    // Les anecdotes de la vie de tous les jours
    if (v.temps > this.prochaineAnecdote) {
      this.prochaineAnecdote = v.temps + 50 + this.alea() * 60;
      const pop = v.population().total;
      if (pop > 20) {
        const a = [
          `Naissance chez ${this.homme()} : on suspend une couronne à la porte.`,
          `${this.femme()} a perdu une fibule d'or au marché ; une récompense est promise.`,
          `Un poète récite Virgile sur les marches du forum.`,
          `${this.homme()} et ${this.homme()} se disputent un mur mitoyen devant le magistrat.`,
          `Les enfants jouent aux osselets dans la rue.`,
          `Un marchand de ${choisir(this.alea, ORIGINES)} vante ses étoffes à tue-tête.`,
          `On a vu des dauphins à l'entrée de la baie.`,
          `${this.femme()} offre une libation aux Lares de la maison.`,
          `Un graffiti sur un mur : « ${choisir(this.alea, ["Vive les Verts !", "Ici, on a bien mangé.", "Celer aime Fabia.", "Votez pour Rufus, homme honnête."])} »`,
        ];
        this.ecrire(choisir(this.alea, a), 0);
      }
    }

    // On publie au plus une ligne toutes les 9 secondes
    if (this.attente.length && v.temps - this.derniere > 9) {
      const l = this.attente.shift()!;
      l.temps = v.temps;
      this.lignes.push(l);
      if (this.lignes.length > 40) this.lignes.shift();
      this.derniere = v.temps;
    }
  }
}
