# AnalyseMarketing webapp (AdonisJS 6 + Vite, TypeScript)

Port du pipeline Python (`../scripts`) et de `../prospects.html`. Stockage en fichiers JSON/TSV dans `data/` (ignoré par git).

## Installation
    npm install        # le postinstall corrige jsonschema pour Node >= 26 (sinon `node ace` échoue)
    npm run typecheck && npm test

## Pipeline (équivalents des scripts Python)
| Python | Commande | Sorties (`data/`) |
|---|---|---|
| 01_filtre_unites_legales.py | `node ace sirene:filtre [--src zip] [--limit N]` | ul_retenues.tsv, stats_etape1.json |
| 02_jointure_export.py | `node ace sirene:jointure [--src zip] [--limit N]` | dep_XX.json, meta.json, stats.json |
| 03_osm_overpass.py | `node ace osm:overpass --dep=75 [--dep=69] \| --all [--force]` | osm/osm_XX.json, match_XX.json, stats_osm.json |
| 04_analyse_sites.py | `node ace sites:analyse --dep=75 --max=300 \| --all --max=0` | web/sites.jsonl, web_XX.json, stats_web.json |

Les zips SIRENE sont lus (jamais modifiés) dans `..` (`SRC_DIR` pour changer). `--limit N` limite les lignes lues (tests). `DATA_DIR` change le dossier de sortie.
L'analyse de sites n'exécute pas de JavaScript (fetch + cheerio), respecte robots.txt, 4 domaines en parallèle, 1 s entre requêtes, user-agent honnête.

## Lancement
    npm run build
    cd build && cp ../.env . && HOST=127.0.0.1 PORT=3333 node bin/server.js    # http://127.0.0.1:3333
Redémarrer le serveur après avoir relancé le pipeline (les départements sont mis en cache en mémoire).

API : `GET /api/meta`, `/api/prospects` (deps, filtres, page, size, sort, dir), `/api/prospects.csv`, `/api/stats`.

Données : SIRENE © INSEE (Licence Ouverte) ; © contributeurs OpenStreetMap (ODbL).
