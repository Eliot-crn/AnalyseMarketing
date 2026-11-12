#!/usr/bin/env python3
"""Etape 1 : StockUniteLegale (zip, streaming) -> out/ul_retenues.tsv
Garde : actives (A), diffusibles (statut != P), nomenclature NAFRev2, NAF présent dans la table
de cibles, hors personnes publiques (cat. jur. 7xxx) et syndicats de copropriété (91xx).
Relançable : python3 scripts/01_filtre_unites_legales.py   (~3 min)"""
import csv, io, json, os, sys, zipfile
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naf_cibles import cible, score

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "stock-stockunitelegale-csv.zip")
OUT = os.path.join(BASE, "out", "ul_retenues.tsv")
COLS = ["siren", "nom", "ei", "date", "tranche", "catent", "naf", "cj", "ess", "emp", "score"]


def main():
    c = Counter()
    z = zipfile.ZipFile(SRC)
    with z.open(z.namelist()[0]) as raw, open(OUT + ".tmp", "w", encoding="utf-8", newline="") as fo:
        r = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
        ix = {k: i for i, k in enumerate(next(r))}
        g = lambda k: ix[k + "UniteLegale"] if k + "UniteLegale" in ix else ix[k]
        I = {k: g(k) for k in ("statutDiffusion", "dateCreation", "prenomUsuel", "trancheEffectifs",
             "categorieEntreprise", "etatAdministratif", "nom", "nomUsage", "denomination",
             "denominationUsuelle1", "categorieJuridique", "activitePrincipale",
             "nomenclatureActivitePrincipale", "economieSocialeSolidaire", "caractereEmployeur")}
        w = csv.writer(fo, delimiter="\t", quoting=csv.QUOTE_NONE, escapechar="\\")
        w.writerow(COLS)
        for row in r:
            c["lues"] += 1
            if row[I["etatAdministratif"]] != "A":
                c["cessées"] += 1; continue
            if row[I["statutDiffusion"]] != "O":      # P = diffusion partielle (opposition) -> exclu
                c["non diffusibles"] += 1; continue
            if row[I["nomenclatureActivitePrincipale"]] != "NAFRev2":
                c["NAF absent ou ancienne nomenclature"] += 1; continue
            cj = row[I["categorieJuridique"]]
            if cj[:1] == "7" or cj[:2] == "91":
                c["personnes publiques / copropriétés"] += 1; continue
            naf = row[I["activitePrincipale"]]
            t = cible(naf)
            if not t:
                c["NAF hors cible ou exclu"] += 1; continue
            ei = cj == "1000"
            if ei:
                nom = (row[I["prenomUsuel"]] + " " + (row[I["nomUsage"]] or row[I["nom"]])).strip()
            else:
                nom, u = row[I["denomination"]], row[I["denominationUsuelle1"]]
                if u and u != nom:
                    nom = f"{nom} ({u})" if nom else u
            if not nom:
                c["sans nom"] += 1; continue
            tr = row[I["trancheEffectifs"]] or "NN"
            # caractereEmployeur est vide dans les stocks récents -> repli sur la tranche d'effectif
            emp = row[I["caractereEmployeur"]] or ("O" if tr.isdigit() and tr >= "01" else "N")
            date = row[I["dateCreation"]]
            w.writerow([row[0], nom.replace("\t", " "), int(ei), date, tr,
                        row[I["categorieEntreprise"]], naf, cj,
                        int(row[I["economieSocialeSolidaire"]] == "O"), int(emp == "O"),
                        score(t[2], date, tr)])
            c["retenues"] += 1
            if c["lues"] % 5_000_000 == 0:
                print(c["lues"], c["retenues"], flush=True)
    assert c["retenues"] > 1_000_000, "trop peu de lignes retenues : format du fichier changé ?"
    os.replace(OUT + ".tmp", OUT)
    json.dump(c, open(os.path.join(BASE, "out", "stats_etape1.json"), "w"), ensure_ascii=False, indent=1)
    for k, v in c.most_common():
        print(f"{v:>12,} {k}")


if __name__ == "__main__":
    main()
