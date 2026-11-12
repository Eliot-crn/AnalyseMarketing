# Analyse marketing : prospects audiovisuel (vidéo, photo, identité graphique)

Source principale : stock SIRENE de l'INSEE du 01/11/2026 (unités légales + établissements sièges).
Enrichissement web : OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL) et analyse de pages d'accueil.
Outil : `prospects.html` (à ouvrir directement, sans serveur). Chiffres détaillés : `out/stats.json`.

## 1. Ce qui a été retenu

| Étape | Unités légales |
|---|---:|
| Lues dans le stock | 30 280 224 |
| Cessées | - 13 446 647 |
| Non diffusibles (statut P) | - 2 366 324 |
| NAF absent ou ancienne nomenclature (fiches jamais mises à jour) | - 855 846 |
| Personnes publiques (cat. jur. 7xxx) et syndicats de copropriété (91xx) | - 261 061 |
| NAF hors cible ou exclu | - 5 934 507 |
| Siège non diffusible, introuvable ou département inconnu | - 12 797 |
| **Retenues** | **7 403 041** |

Exclusions par NAF (table complète et justifiée dans `scripts/naf_cibles.py`) :
- Concurrents : 59.11 (production audiovisuelle), 59.12Z (post-production), 74.20Z (photo), 74.10Z (design), 73.11Z (agences de publicité), 18.13Z (pré-presse), 90.03 (artistes-auteurs). Le spectacle vivant (90.01Z, 90.02Z, 90.04Z) est gardé : ce sont des clients (captations, affiches).
- Sans besoin marketing : holdings (64.20Z), fonds (64.30Z, 66.30Z), sièges sociaux (70.10Z), toute la location immobilière 68.20 (SCI et loueurs en meublé : plusieurs millions de structures patrimoniales), administration publique (84), ménages employeurs.
- Tout code NAF absent de la table n'est pas retenu (agriculture hors vigne, transport, nettoyage, sécurité, énergie...).

Limite : 225 793 entreprises retenues ont leur siège à l'étranger (département « 99 »), surtout des vendeurs en ligne immatriculés pour la TVA. Elles sont isolées dans ce département et à ignorer pour une prospection locale.

## 2. Les deux scores

**Score secteur (0-100)** = score de base du code NAF + 5 si créée depuis moins de 3 ans + 5 si au moins 1 salarié + 5 si 10 salariés ou plus.
Base : 80-90 quand l'image fait vendre (hôtels, restaurants, traiteurs, agences immobilières, événementiel, cosmétique, e-commerce) ; 60-75 pour le B2C local très concurrentiel (beauté, mode, sport, artisans de bouche, architectes) ; 40-55 pour le besoin ponctuel (conseil, BTP, santé, enseignement) ; 25-35 pour le besoin faible (négoce, industrie générique, associations généralistes).

**Score opportunité communication (0-100)**, calculé dans `prospects.html` (fonction `opportunity`) :

| Composante | Points |
|---|---:|
| Score secteur x 0,4 | 0 à 40 |
| Déficit de communication (plafonné à 40) | |
| - aucune présence web connue | 25 |
| - réseaux sociaux connus mais pas de site | 20 |
| - site connu, non analysé ou bloqué | 10 |
| - site en erreur (peut-être abandonné) | 15 |
| - site analysé : pas de vidéo intégrée (6 si une chaîne YouTube est liée) | 12 |
| - site analysé : aucun réseau social lié (4 si un seul) | 8 |
| - site analysé : copyright vieux de 4 ans ou plus (4 si 2-3 ans) | 8 |
| - site analysé : pas adapté au mobile | 6 |
| - site analysé : pas de HTTPS | 3 |
| - site analysé : indices techniques anciens (jQuery < 1.9, Flash, mise en page en tableaux, CMS ancien, moins de 3 images), 3 points chacun | max 6 |
| Budget plausible : employeur 6, 3 salariés ou plus 3, 10 salariés ou plus 3 | 0 à 12 |
| Ancienneté : moins de 2 ans 8 (identité à créer), plus de 10 ans 6 (image vieillissante), 5-10 ans 3 | 0 à 8 |

« Aucune présence web connue » veut seulement dire qu'OpenStreetMap ne donne aucun lien : c'est un indice, pas une preuve. Le score n'est vraiment discriminant que pour les entreprises dont le site a été analysé.

## 3. Chiffres clés

**Par secteur cible**

| Secteur | Retenues | Score >= 70 | Employeuses | Créées < 2 ans | Coeur de cible* |
|---|---:|---:|---:|---:|---:|
| Commerce de détail & auto | 1 266 645 | 355 153 | 318 797 | 217 125 | 56 698 |
| BTP, artisans & architecture | 1 025 927 | 87 823 | 370 526 | 115 115 | 35 152 |
| Conseil & services B2B | 759 821 | 58 | 187 711 | 112 697 | 58 |
| Associations & ESS | 735 747 | 0 | 98 807 | 46 203 | 0 |
| Industrie & négoce | 424 358 | 4 590 | 145 616 | 42 102 | 999 |
| Santé libérale & soins | 408 288 | 9 | 70 796 | 26 168 | 9 |
| Restauration | 405 115 | 400 066 | 216 101 | 59 800 | 191 235 |
| Sport & loisirs | 388 655 | 47 298 | 66 514 | 32 485 | 18 119 |
| Immobilier | 306 925 | 199 299 | 41 269 | 29 282 | 29 237 |
| Événementiel | 280 389 | 123 329 | 24 508 | 42 842 | 15 423 |
| Culture & spectacle | 260 344 | 192 397 | 50 121 | 28 745 | 39 522 |
| Tech & startups | 243 932 | 27 542 | 56 484 | 58 054 | 9 688 |
| Beauté & bien-être | 214 125 | 161 019 | 66 299 | 30 296 | 46 308 |
| Enseignement & formation | 208 384 | 9 920 | 46 314 | 27 582 | 3 187 |
| Agroalimentaire & boissons | 207 668 | 66 940 | 71 015 | 13 155 | 43 429 |
| Hébergement & tourisme | 167 022 | 156 063 | 40 432 | 24 399 | 35 071 |
| Mode, luxe & création | 99 696 | 63 948 | 18 831 | 13 585 | 7 991 |
| **Total** | **7 403 041** | **1 895 454** | **1 890 141** | **919 635** | **532 126** |

*Coeur de cible = score secteur >= 70, employeuse, hors entrepreneur individuel.

**Par région** (retenues / score >= 70 / coeur de cible) : Île-de-France 1 680 031 / 425 542 / 144 594 ; Auvergne-Rhône-Alpes 852 598 / 206 606 / 58 982 ; Provence-Alpes-Côte d'Azur 723 293 / 181 293 / 51 368 ; Occitanie 717 343 / 173 523 / 49 000 ; Nouvelle-Aquitaine 630 670 / 153 959 / 44 438 ; Grand Est 479 453 / 111 406 / 35 849 ; Hauts-de-France 441 022 / 107 225 / 31 065 ; Pays de la Loire 316 928 / 73 525 / 22 427 ; Bretagne 288 501 / 72 800 / 22 068 ; Normandie 262 099 / 65 056 / 20 310 ; Bourgogne-Franche-Comté 245 269 / 56 652 / 16 898 ; Centre-Val de Loire 208 196 / 48 270 / 14 392 ; Corse 55 022 / 16 999 / 5 170 ; outre-mer 276 823 au total.

**Taille** : 6 157 903 sans salarié connu (83 %) ; 1-2 salariés 560 501 ; 3-9 salariés 461 176 ; 10-49 salariés 186 610 ; 50 salariés et plus 36 851.

**Type** : 4 409 400 sociétés ou personnes morales, 2 993 641 entrepreneurs individuels (EI).

**Ancienneté** : moins d'1 an 469 247 ; 1-2 ans 450 388 ; 2-5 ans 1 162 948 ; 5-10 ans 1 349 943 ; 10-20 ans 1 942 874 ; plus de 20 ans 2 027 641.

**Créations récentes** : environ 400 000 à 460 000 entreprises retenues créées par an depuis 2024. Sur les moins de 2 ans : commerce (217 125, dont beaucoup de vente en ligne), BTP (115 115), conseil (112 697), restauration (59 800), tech (58 054).

## 4. Enrichissement web

| | |
|---|---:|
| Objets OpenStreetMap récupérés (107 départements, API Overpass) | 1 272 114 |
| Entreprises SIRENE rapprochées d'un lien web | 128 445 (1,8 % des retenues en France) |
| - dont avec un site web | 111 890 |
| - par SIRET identique (sûr) | 86 876 |
| - par nom + code postal ou commune | 16 259 |
| - par nom seul, unique dans le département (marqué « à vérifier ») | 25 310 |
| Sites analysés (pilote : Paris, meilleurs scores secteur) | 312 |
| - analysés avec succès | 262 (84 %) |
| - bloqués (robots.txt ou refus 401/403/429/503), non retentés | 9 (2,9 %) |
| - en erreur (site mort, DNS, délai dépassé) | 41 (13 %) |

Résultats du pilote parisien (262 sites, surtout hôtels et restaurants) : 230 sans vidéo intégrée (88 %), 60 sans aucun réseau social lié, 101 « peu de communication » (ni vidéo, ni plus d'un réseau), 27 avec un copyright de 2022 ou avant, 7 non adaptés au mobile, 6 sans HTTPS. Les 41 sites en erreur sont aussi des pistes (site abandonné).

Limites :
- OpenStreetMap couvre surtout les commerces avec vitrine (restaurants, hôtels, boutiques). Les entreprises sans local ouvert au public y sont presque absentes.
- Le rapprochement se fait sur le siège : un établissement de chaîne dont le siège est ailleurs n'est pas rapproché.
- Certains liens OSM pointent vers la page d'une chaîne (Accor, La Poste) et non vers un site propre.
- La détection de vidéo ne voit que la page d'accueil. Une vidéo sur une page intérieure ou sur les réseaux sociaux n'est pas vue.
- Pour élargir : `crawl4ai-env/bin/python scripts/04_analyse_sites.py --dep 69 --max 500`.

## 5. Recommandations de prospection

1. **Commencer par le coeur de cible local** : dans `prospects.html`, charger son département, filtrer « Employeur : oui », « Type : sociétés », score secteur >= 70. Cela ramène 532 126 entreprises en France à quelques milliers par département.
2. **Secteurs prioritaires** : restauration traditionnelle et traiteurs (photo culinaire, vidéos courtes pour les réseaux), hôtels, campings et gîtes (visite vidéo, photo d'ambiance), agences et promoteurs immobiliers (visites filmées, drone), beauté et bien-être, salles de sport, événementiel et salles de spectacle (captation, aftermovie), artisans de bouche et boissons (brasseries, vignerons, chocolatiers : identité et packaging).
3. **Deux angles d'approche** :
   - *Image vieillissante* : entreprises de plus de 10 ans, employeuses, avec un site analysé sans vidéo, un copyright ancien ou un site non mobile (filtre « Peu de communication » + tri par score opportunité). Offre : refonte d'identité, film de présentation, nouvelles photos.
   - *Identité à créer* : créations de moins de 2 ans (raccourci « < 2 ans ») dans les secteurs à forte image. Offre : pack lancement (logo, charte, photos, vidéo courte). Budget plus serré, décision rapide.
4. **Offres récurrentes** pour restauration, beauté, sport : contenu mensuel pour les réseaux plutôt qu'une prestation unique.
5. **Marque employeur** pour le BTP, l'industrie et le recrutement (370 526 employeurs dans le BTP) : film de recrutement, portraits d'équipe. Score secteur moyen mais budgets réels.
6. **Toujours vérifier avant contact** : la fiche Annuaire des entreprises (lien par ligne) et le site réel de l'entreprise. L'absence de lien dans l'outil ne prouve rien.

## 6. Note RGPD

- La base SIRENE est une donnée publique réutilisable, mais les entreprises ayant demandé la non-diffusion (statut P) ont été exclues, pour l'unité légale comme pour le siège.
- Les 2 993 641 entrepreneurs individuels sont des personnes physiques : nom et prénom sont des données personnelles. Le filtre « Type » permet de les écarter. Les garder impose de respecter le RGPD : fichier limité au besoin, durée de conservation limitée, information de la personne au premier contact, droit d'opposition simple et respecté.
- Prospection B2B par courriel : admise sans consentement préalable si le message concerne l'activité professionnelle du destinataire, identifie l'expéditeur et propose un moyen simple de s'opposer. Les adresses génériques (contact@) ne sont pas des données personnelles. Par téléphone : respecter les règles en vigueur sur le démarchage et les oppositions.
- Ce fichier ne contient ni courriel ni téléphone. Toute collecte ultérieure de coordonnées doit suivre les mêmes règles. Ne pas republier la liste.
- Données OpenStreetMap : mention « © contributeurs OpenStreetMap » obligatoire en cas de réutilisation (licence ODbL).

## 7. Relancer

```
python3 scripts/01_filtre_unites_legales.py        # 2 min  -> out/ul_retenues.tsv
python3 scripts/02_jointure_export.py              # 4 min  -> data/dep_XX.js, data/meta.js, out/stats.json
python3 scripts/03_osm_overpass.py --all           # 1 à 3 h (cache out/web/osm/, --force pour rafraîchir)
crawl4ai-env/bin/python scripts/04_analyse_sites.py --dep 75 --max 300   # cache out/web/sites.jsonl
python3 scripts/04_analyse_sites.py --all --max 0  # réécrit data/web_XX.js sans téléchargement
node scripts/test_html.js data 75                  # test de la logique de la page
```
