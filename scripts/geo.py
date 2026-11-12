"""Département -> nom, région. Département = 2 premiers caractères du code commune (3 pour 97x/98x)."""
_R = {
 "Auvergne-Rhône-Alpes": "01 Ain,03 Allier,07 Ardèche,15 Cantal,26 Drôme,38 Isère,42 Loire,43 Haute-Loire,63 Puy-de-Dôme,69 Rhône,73 Savoie,74 Haute-Savoie",
 "Bourgogne-Franche-Comté": "21 Côte-d'Or,25 Doubs,39 Jura,58 Nièvre,70 Haute-Saône,71 Saône-et-Loire,89 Yonne,90 Territoire de Belfort",
 "Bretagne": "22 Côtes-d'Armor,29 Finistère,35 Ille-et-Vilaine,56 Morbihan",
 "Centre-Val de Loire": "18 Cher,28 Eure-et-Loir,36 Indre,37 Indre-et-Loire,41 Loir-et-Cher,45 Loiret",
 "Corse": "2A Corse-du-Sud,2B Haute-Corse",
 "Grand Est": "08 Ardennes,10 Aube,51 Marne,52 Haute-Marne,54 Meurthe-et-Moselle,55 Meuse,57 Moselle,67 Bas-Rhin,68 Haut-Rhin,88 Vosges",
 "Hauts-de-France": "02 Aisne,59 Nord,60 Oise,62 Pas-de-Calais,80 Somme",
 "Île-de-France": "75 Paris,77 Seine-et-Marne,78 Yvelines,91 Essonne,92 Hauts-de-Seine,93 Seine-Saint-Denis,94 Val-de-Marne,95 Val-d'Oise",
 "Normandie": "14 Calvados,27 Eure,50 Manche,61 Orne,76 Seine-Maritime",
 "Nouvelle-Aquitaine": "16 Charente,17 Charente-Maritime,19 Corrèze,23 Creuse,24 Dordogne,33 Gironde,40 Landes,47 Lot-et-Garonne,64 Pyrénées-Atlantiques,79 Deux-Sèvres,86 Vienne,87 Haute-Vienne",
 "Occitanie": "09 Ariège,11 Aude,12 Aveyron,30 Gard,31 Haute-Garonne,32 Gers,34 Hérault,46 Lot,48 Lozère,65 Hautes-Pyrénées,66 Pyrénées-Orientales,81 Tarn,82 Tarn-et-Garonne",
 "Pays de la Loire": "44 Loire-Atlantique,49 Maine-et-Loire,53 Mayenne,72 Sarthe,85 Vendée",
 "Provence-Alpes-Côte d'Azur": "04 Alpes-de-Haute-Provence,05 Hautes-Alpes,06 Alpes-Maritimes,13 Bouches-du-Rhône,83 Var,84 Vaucluse",
 "Guadeloupe": "971 Guadeloupe", "Martinique": "972 Martinique", "Guyane": "973 Guyane",
 "La Réunion": "974 La Réunion", "Mayotte": "976 Mayotte",
 "Collectivités d'outre-mer": "975 Saint-Pierre-et-Miquelon,977 Saint-Barthélemy,978 Saint-Martin,986 Wallis-et-Futuna,987 Polynésie française,988 Nouvelle-Calédonie",
 "Étranger": "99 Siège à l'étranger",
}
DEPS = {d.split(" ", 1)[0]: (d.split(" ", 1)[1], reg) for reg, ds in _R.items() for d in ds.split(",")}


def departement(code_commune):
    if not code_commune:
        return "99"
    return code_commune[:3] if code_commune[:2] in ("97", "98") else code_commune[:2]


assert len(DEPS) == 96 + 5 + 6 + 1 and departement("2A004") == "2A" and departement("97411") == "974"
assert departement("75056") == "75" and departement("") == "99" and DEPS["2B"][1] == "Corse"
