// Le niveau 1 : « La forêt ». Une lettre par case de 16 × 16 pixels ; la légende est dans niveau.ts.
// Modifie le dessin, sauvegarde : le jeu se recharge. Lance `bun test` pour vérifier qu'il reste jouable.
import type { Niveau } from "./niveau";

export const NIVEAU_1: Niveau = {
  nom: "La forêt",
  // Les textes des panneaux « i », de gauche à droite et de haut en bas.
  panneaux: [
    "← → : MARCHER    X : COURIR\nESPACE : SAUTER. GARDE APPUYÉ POUR SAUTER PLUS HAUT.",
    "SAUTE SUR LES LIMACES !\n↓ : DESCENDRE D'UNE PASSERELLE.",
    "LE BLOC À PLUME DONNE UN DOUBLE SAUT.\nSI TU ES TOUCHÉ, TU PERDS LA PLUME.",
    "GARDE ESPACE APPUYÉ EN TOMBANT SUR LE RESSORT\nPOUR REBONDIR TRÈS HAUT.",
    "UN COUP DE TÊTE CASSE LES BRIQUES.\nQUI SAIT CE QU'IL Y A AU-DESSUS ?",
    "LA PLATEFORME MONTE ET DESCEND :\nATTENDS LE BON MOMENT.",
    "LÀ-HAUT, UN ŒUF D'OR…\nIL FAUDRAIT UN DOUBLE SAUT.",
  ],
  carte: [
    "",
    "",
    "                                                                                                                                                                            ooo",
    "",
    "                                                                                                        O",
    "                                                                                                       cc                                                              F  *     l",
    "               ?                                                                                   cc                                                                 #############",
    "                                                                               w               ccc                                                                    ##############          O",
    "                                                                                                                         =================                            ###############         ==",
    "                                                                              ooo                                        =  oo   oo    O =                            ################               ooo",
    "          ooo?B?B?           o      ooo                      P       ==                                o                  BBBB?BBBBB?BBBBB                            #################",
    "                                   -----     * b   ,                 ==           h                 o  =  o                                                       v   ##################",
    "                         =                  #########                ==   h                         =  =  =                                                           ##################",
    "   S  i  ,       *  l   ==       i    l  ,  #########   g  i      F %==                   i  R    ^^=^^=^^=   l  *   F  i     l     g         b         g     i       ##################  i       b      * G   ,",
    "############################   #########################################                ##########################################################   ###############################################################",
    "############################   #########################################                ##########################################################   ###############################################################",
    "############################   #########################################                ##########################################################   ###############################################################",
    "############################   #########################################                ##########################################################   ###############################################################",
  ],
};
