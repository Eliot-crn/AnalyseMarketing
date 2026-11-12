# AnalyseMarketing

Prospection de clients pour l'audiovisuel, la photo et l'identité graphique à partir de la base publique SIRENE (INSEE), enrichie avec OpenStreetMap et une analyse des pages d'accueil (Crawl4AI).

Les données ne sont pas versionnées. Pour les régénérer :

1. Télécharger dans ce dossier `stock-stockunitelegale-csv.zip` et `stock-stocketablissement-csv.zip` (data.gouv.fr, « Base Sirene des entreprises et de leurs établissements »).
2. `python3 scripts/01_filtre_unites_legales.py` puis `python3 scripts/02_jointure_export.py`
3. Optionnel : `python3 scripts/03_osm_overpass.py`, puis `crawl4ai-env/bin/python scripts/04_analyse_sites.py --dep 75 --max 300`
4. Ouvrir `prospects.html` dans un navigateur (aucun serveur nécessaire).

Méthode, scores et note RGPD : voir `ANALYSE.md`.

Données : SIRENE © INSEE (Licence Ouverte) ; © contributeurs OpenStreetMap (ODbL).
