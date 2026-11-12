"""Table NAF rev.2 -> (categorie cible, score de base 0-100, libelle) pour un prestataire
audiovisuel (video, photo, identite graphique).

Regle : le prefixe le plus long gagne ("56.10A" > "56.1" > "56"). Un code NAF absent de la
table n'est PAS retenu (secteur juge sans interet : agriculture hors vigne, transport,
nettoyage, securite, energie, etc.). Score 0 = exclusion explicite et documentee.

Logique du score de base :
  80-90  l'image EST le produit / vente par l'image (hotel, restaurant, immobilier, evenementiel, cosmetique)
  60-75  forte concurrence locale B2C, reseaux sociaux indispensables (beaute, mode, sport, artisans de bouche)
  40-55  besoin ponctuel : site, plaquette, film corporate, marque employeur (conseil, BTP, sante, industrie de marque)
  25-35  besoin faible ou budget rare (gros, industrie generique, associations generalistes)
"""

X = "EXCLU"
R, H, EV, CU, IM, BT, CO, BE, SA, SP, MO, AG, TE, SV, EN, AS, IN = (
    "Restauration", "Hébergement & tourisme", "Événementiel", "Culture & spectacle",
    "Immobilier", "BTP, artisans & architecture", "Commerce de détail & auto",
    "Beauté & bien-être", "Santé libérale & soins", "Sport & loisirs", "Mode, luxe & création",
    "Agroalimentaire & boissons", "Tech & startups", "Conseil & services B2B",
    "Enseignement & formation", "Associations & ESS", "Industrie & négoce")

TABLE = {
    # --- Exclusions -------------------------------------------------------------
    "59.11": (X, 0, "Production de films, vidéo, TV, pub (concurrents)"),
    "59.12Z": (X, 0, "Post-production (concurrents)"),
    "74.20Z": (X, 0, "Activités photographiques (concurrents)"),
    "74.10Z": (X, 0, "Design, graphisme (concurrents)"),
    "73.11Z": (X, 0, "Agences de publicité (concurrents)"),
    "18.13Z": (X, 0, "Pré-presse, PAO (concurrents)"),
    "90.03": (X, 0, "Création artistique, artistes-auteurs (concurrents / hors cible)"),
    "64.20Z": (X, 0, "Holdings (pas d'activité commerciale)"),
    "64.30Z": (X, 0, "Fonds de placement"),
    "66.30Z": (X, 0, "Gestion de fonds"),
    "70.10Z": (X, 0, "Sièges sociaux"),
    "68.20": (X, 0, "Location de biens immobiliers : SCI et loueurs en meublé, patrimonial, volume énorme sans besoin marketing"),
    "84": (X, 0, "Administration publique (marchés publics, hors prospection directe)"),
    "97": (X, 0, "Ménages employeurs"),
    "98": (X, 0, "Ménages producteurs"),
    "99": (X, 0, "Organisations extraterritoriales"),
    # --- Restauration -----------------------------------------------------------
    "56": (R, 60, "Restauration"),
    "56.10A": (R, 85, "Restauration traditionnelle"),
    "56.10B": (R, 40, "Cafétérias et autres libres-services"),
    "56.10C": (R, 70, "Restauration de type rapide"),
    "56.21Z": (R, 85, "Services des traiteurs"),
    "56.29": (R, 30, "Restauration collective"),
    "56.30Z": (R, 70, "Débits de boissons"),
    # --- Hébergement & tourisme -------------------------------------------------
    "55.10Z": (H, 90, "Hôtels et hébergement similaire"),
    "55.20Z": (H, 75, "Hébergement touristique et autre hébergement de courte durée"),
    "55.30Z": (H, 85, "Terrains de camping et parcs pour caravanes"),
    "55.90Z": (H, 30, "Autres hébergements"),
    "79": (H, 75, "Agences de voyage, voyagistes, services de réservation"),
    "50.10Z": (H, 60, "Transports maritimes et côtiers de passagers"),
    "50.30Z": (H, 60, "Transports fluviaux de passagers"),
    "49.39C": (H, 65, "Téléphériques et remontées mécaniques"),
    "77.21Z": (H, 60, "Location d'articles de loisirs et de sport"),
    # --- Événementiel -----------------------------------------------------------
    "82.30Z": (EV, 90, "Organisation de foires, salons professionnels et congrès"),
    "93.29Z": (EV, 70, "Autres activités récréatives et de loisirs"),
    "96.09Z": (EV, 35, "Autres services personnels n.c.a. (dont organisation de mariages)"),
    # --- Culture & spectacle ----------------------------------------------------
    "90.01Z": (CU, 70, "Arts du spectacle vivant"),
    "90.02Z": (CU, 55, "Activités de soutien au spectacle vivant"),
    "90.04Z": (CU, 75, "Gestion de salles de spectacles"),
    "91.01Z": (CU, 30, "Gestion des bibliothèques et des archives"),
    "91.02Z": (CU, 75, "Gestion des musées"),
    "91.03Z": (CU, 75, "Gestion des sites et monuments historiques"),
    "91.04Z": (CU, 75, "Jardins botaniques, zoologiques et réserves naturelles"),
    "59.14Z": (CU, 50, "Projection de films cinématographiques"),
    "59.20Z": (CU, 70, "Enregistrement sonore et édition musicale"),
    "58.11Z": (CU, 50, "Édition de livres"),
    "58.13Z": (CU, 40, "Édition de journaux"),
    "58.14Z": (CU, 45, "Édition de revues et périodiques"),
    "92.00Z": (CU, 60, "Jeux de hasard et d'argent (casinos)"),
    # --- Immobilier -------------------------------------------------------------
    "68.31Z": (IM, 85, "Agences immobilières"),
    "68.32A": (IM, 45, "Administration d'immeubles et autres biens immobiliers"),
    "68.10Z": (IM, 40, "Activités des marchands de biens immobiliers"),
    "41.10": (IM, 80, "Promotion immobilière"),
    # --- BTP, artisans, architecture ---------------------------------------------
    "41.20A": (BT, 70, "Construction de maisons individuelles"),
    "41.20B": (BT, 55, "Construction d'autres bâtiments"),
    "43": (BT, 45, "Travaux de construction spécialisés"),
    "43.32A": (BT, 50, "Travaux de menuiserie bois et PVC"),
    "43.33Z": (BT, 50, "Travaux de revêtement des sols et des murs"),
    "71.11Z": (BT, 75, "Activités d'architecture"),
    "81.30Z": (BT, 60, "Services d'aménagement paysager"),
    "16.23Z": (BT, 45, "Fabrication de charpentes et d'autres menuiseries"),
    "31": (BT, 60, "Fabrication de meubles"),
    "23.41Z": (BT, 55, "Fabrication d'articles céramiques à usage domestique ou ornemental"),
    # --- Commerce de détail & auto ------------------------------------------------
    "47": (CO, 50, "Commerce de détail"),
    "47.11": (CO, 35, "Commerce de détail alimentaire généraliste (supérettes, supermarchés)"),
    "47.19": (CO, 50, "Grands magasins et autres commerces non spécialisés"),
    "47.24Z": (CO, 60, "Commerce de détail de pain, pâtisserie et confiserie"),
    "47.25Z": (CO, 65, "Commerce de détail de boissons (cavistes)"),
    "47.30Z": (CO, 15, "Commerce de détail de carburants"),
    "47.59A": (CO, 65, "Commerce de détail de meubles"),
    "47.64Z": (CO, 60, "Commerce de détail d'articles de sport"),
    "47.71Z": (CO, 70, "Commerce de détail d'habillement"),
    "47.72A": (CO, 65, "Commerce de détail de la chaussure"),
    "47.72B": (CO, 65, "Commerce de détail de maroquinerie et d'articles de voyage"),
    "47.73Z": (CO, 25, "Pharmacies"),
    "47.75Z": (CO, 65, "Commerce de détail de parfumerie et de produits de beauté"),
    "47.76Z": (CO, 65, "Commerce de détail de fleurs, plantes, animaux de compagnie"),
    "47.77Z": (CO, 70, "Commerce de détail d'horlogerie et de bijouterie"),
    "47.78A": (CO, 55, "Commerces de détail d'optique"),
    "47.8": (CO, 30, "Commerce de détail sur éventaires et marchés"),
    "47.91": (CO, 80, "Vente à distance (e-commerce)"),
    "47.99": (CO, 30, "Vente à domicile, par automates et autres hors magasin"),
    "45.11Z": (CO, 60, "Commerce de voitures et de véhicules automobiles légers"),
    "45.19Z": (CO, 50, "Commerce d'autres véhicules automobiles"),
    "45.20": (CO, 35, "Entretien et réparation de véhicules automobiles"),
    "45.40Z": (CO, 50, "Commerce et réparation de motocycles"),
    "77.11A": (CO, 45, "Location de courte durée de voitures"),
    "96.03Z": (CO, 35, "Services funéraires"),
    # --- Beauté & bien-être ---------------------------------------------------------
    "96.02A": (BE, 65, "Coiffure"),
    "96.02B": (BE, 75, "Soins de beauté"),
    "96.04Z": (BE, 75, "Entretien corporel (spas, massages bien-être)"),
    # --- Santé (publicité réglementée pour les professions à ordre => scores bas) ----
    "86.10Z": (SA, 45, "Activités hospitalières (cliniques)"),
    "86.21Z": (SA, 20, "Médecins généralistes"),
    "86.22": (SA, 35, "Médecins spécialistes"),
    "86.23Z": (SA, 55, "Pratique dentaire"),
    "86.90E": (SA, 35, "Rééducation, appareillage, pédicures-podologues"),
    "86.90F": (SA, 50, "Activités de santé humaine n.c.a. (ostéopathes, psychologues, naturopathes...)"),
    "75.00Z": (SA, 45, "Activités vétérinaires"),
    # --- Sport & loisirs ------------------------------------------------------------
    "93.11Z": (SP, 65, "Gestion d'installations sportives"),
    "93.12Z": (SP, 60, "Activités de clubs de sports"),
    "93.13Z": (SP, 80, "Activités des centres de culture physique (fitness)"),
    "93.19Z": (SP, 60, "Autres activités liées au sport"),
    "93.21Z": (SP, 85, "Parcs d'attractions et parcs à thèmes"),
    "85.51Z": (SP, 65, "Enseignement de disciplines sportives et de loisirs (coachs)"),
    "85.52Z": (SP, 65, "Enseignement culturel (danse, musique, arts)"),
    # --- Mode, luxe, création ---------------------------------------------------------
    "13": (MO, 45, "Fabrication de textiles"),
    "14": (MO, 70, "Industrie de l'habillement"),
    "15": (MO, 70, "Industrie du cuir et de la chaussure (maroquinerie)"),
    "20.42Z": (MO, 80, "Fabrication de parfums et de produits pour la toilette (cosmétiques)"),
    "32.12Z": (MO, 75, "Fabrication d'articles de joaillerie et bijouterie"),
    "32.13Z": (MO, 75, "Fabrication de bijouterie fantaisie"),
    "46.42Z": (MO, 50, "Commerce de gros d'habillement et de chaussures"),
    "46.45Z": (MO, 55, "Commerce de gros de parfumerie et de produits de beauté"),
    # --- Agroalimentaire & boissons ----------------------------------------------------
    "10": (AG, 40, "Industries alimentaires"),
    "10.13B": (AG, 55, "Charcuterie"),
    "10.51C": (AG, 60, "Fabrication de fromage"),
    "10.52Z": (AG, 65, "Fabrication de glaces et sorbets"),
    "10.71C": (AG, 65, "Boulangerie et boulangerie-pâtisserie"),
    "10.71D": (AG, 70, "Pâtisserie"),
    "10.82Z": (AG, 75, "Fabrication de cacao, chocolat et confiserie"),
    "10.83Z": (AG, 70, "Transformation du thé et du café (torréfacteurs)"),
    "11": (AG, 65, "Fabrication de boissons"),
    "11.01Z": (AG, 80, "Production de boissons alcooliques distillées"),
    "11.02": (AG, 75, "Production de vin"),
    "11.05Z": (AG, 80, "Fabrication de bière (microbrasseries)"),
    "01.21Z": (AG, 65, "Culture de la vigne (domaines viticoles)"),
    # --- Tech & startups ----------------------------------------------------------------
    "58.21Z": (TE, 75, "Édition de jeux électroniques"),
    "58.29": (TE, 75, "Édition de logiciels"),
    "62.01Z": (TE, 60, "Programmation informatique"),
    "62.02A": (TE, 50, "Conseil en systèmes et logiciels informatiques"),
    "62.09Z": (TE, 45, "Autres activités informatiques"),
    "63.11Z": (TE, 50, "Traitement de données, hébergement"),
    "63.12Z": (TE, 70, "Portails Internet"),
    "72": (TE, 50, "Recherche-développement scientifique (biotech, deeptech)"),
    # --- Conseil & services B2B ------------------------------------------------------------
    "70.21Z": (SV, 55, "Conseil en relations publiques et communication"),
    "70.22Z": (SV, 50, "Conseil pour les affaires et autres conseils de gestion"),
    "73.12Z": (SV, 40, "Régie publicitaire de médias"),
    "73.20Z": (SV, 40, "Études de marché et sondages"),
    "78": (SV, 55, "Recrutement, intérim (marque employeur)"),
    "69.10Z": (SV, 45, "Activités juridiques (avocats, notaires)"),
    "69.20Z": (SV, 40, "Activités comptables"),
    "71.12B": (SV, 40, "Ingénierie, études techniques"),
    "74.90B": (SV, 40, "Activités spécialisées, scientifiques et techniques diverses"),
    "66.19B": (SV, 45, "Autres auxiliaires de services financiers (CGP)"),
    "66.22Z": (SV, 45, "Agents et courtiers d'assurances"),
    "65": (SV, 35, "Assurance"),
    "64.19Z": (SV, 35, "Autres intermédiations monétaires (banques)"),
    # --- Enseignement & formation -------------------------------------------------------------
    "85": (EN, 45, "Enseignement"),
    "85.31Z": (EN, 55, "Enseignement secondaire général"),
    "85.32Z": (EN, 55, "Enseignement secondaire technique ou professionnel"),
    "85.41Z": (EN, 60, "Enseignement post-secondaire non supérieur"),
    "85.42Z": (EN, 75, "Enseignement supérieur"),
    "85.53Z": (EN, 55, "Enseignement de la conduite (auto-écoles)"),
    "85.59A": (EN, 60, "Formation continue d'adultes"),
    "85.59B": (EN, 55, "Autres enseignements"),
    "88.91A": (EN, 50, "Accueil de jeunes enfants (crèches)"),
    # --- Associations & ESS -------------------------------------------------------------------
    "94": (AS, 35, "Activités des organisations associatives"),
    "94.11Z": (AS, 45, "Organisations patronales et consulaires"),
    "94.12Z": (AS, 45, "Organisations professionnelles"),
    "94.20Z": (AS, 25, "Syndicats de salariés"),
    "94.91Z": (AS, 20, "Organisations religieuses"),
    "94.99Z": (AS, 40, "Autres organisations fonctionnant par adhésion volontaire (associations)"),
    "87": (AS, 45, "Hébergement médico-social et social (EHPAD, foyers)"),
    "88": (AS, 35, "Action sociale sans hébergement"),
    # --- Industrie & négoce (film corporate, catalogue produit) ---------------------------------
    **{d: (IN, 35, lab) for d, lab in {
        "16": "Travail du bois", "17": "Industrie du papier et du carton", "18": "Imprimerie",
        "20": "Industrie chimique", "21": "Industrie pharmaceutique",
        "22": "Produits en caoutchouc et en plastique", "23": "Produits minéraux non métalliques",
        "24": "Métallurgie", "25": "Produits métalliques", "26": "Produits informatiques, électroniques et optiques",
        "27": "Équipements électriques", "28": "Machines et équipements", "29": "Industrie automobile",
        "30": "Autres matériels de transport", "32": "Autres industries manufacturières"}.items()},
    "30.12Z": (IN, 70, "Construction de bateaux de plaisance"),
    "30.92Z": (IN, 70, "Fabrication de bicyclettes"),
    "32.20Z": (IN, 65, "Fabrication d'instruments de musique"),
    "32.30Z": (IN, 70, "Fabrication d'articles de sport"),
    "32.40Z": (IN, 70, "Fabrication de jeux et jouets"),
    "46": (IN, 30, "Commerce de gros"),
}

CATEGORIES = [R, H, EV, CU, IM, BT, CO, BE, SA, SP, MO, AG, TE, SV, EN, AS, IN]
DATE_REF = "2026-11-01"  # date du stock SIRENE, pour un score reproductible


def cible(naf):
    """-> (prefixe, categorie, score de base, libelle) ou None si non retenu/exclu."""
    for n in (6, 5, 4, 2):  # "56.10A", "56.10", "56.1", "56"
        e = TABLE.get(naf[:n])
        if e:
            return None if e[0] == X else (naf[:n],) + e
    return None


def score(base, date_creation, tranche):
    """Base NAF + 5 si créée depuis moins de 3 ans (identité à construire)
    + 5 si au moins 1 salarié + 5 si 10 salariés ou plus (budget). Plafond 100."""
    s = base
    if date_creation and date_creation >= str(int(DATE_REF[:4]) - 3) + DATE_REF[4:]:
        s += 5
    if tranche.isdigit() and tranche >= "01":
        s += 5 + 5 * (tranche >= "11")
    return min(s, 100)


def _self_check():
    assert cible("56.10A")[1:3] == (R, 85)
    assert cible("56.10Z")[2] == 60            # repli sur la division
    assert cible("59.11B") is None and cible("74.20Z") is None  # concurrents
    assert cible("68.20B") is None and cible("84.11Z") is None and cible("64.20Z") is None
    assert cible("68.31Z")[2] == 85 and cible("01.11Z") is None and cible("") is None
    assert cible("47.91B")[2] == 80 and cible("47.26Z")[2] == 50
    assert all(0 <= s <= 90 and (c == X) == (s == 0) and (c == X or c in CATEGORIES)
               for c, s, _ in TABLE.values())
    assert score(85, "2025-06-01", "12") == 100 and score(50, "2010-01-01", "NN") == 50
    assert score(50, "", "00") == 50 and score(50, "2023-10-31", "01") == 55


_self_check()
if __name__ == "__main__":
    print("self-check OK,", len(TABLE), "entrées")
