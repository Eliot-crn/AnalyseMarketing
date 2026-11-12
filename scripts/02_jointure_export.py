#!/usr/bin/env python3
"""Etape 2 : jointure out/ul_retenues.tsv x StockEtablissement (sièges, zip en streaming)
-> data/dep_XX.js (un par département), data/meta.js, out/stats.json.
Jointure par fusion : les deux fichiers sont triés par siren (vérifié, erreur sinon).
Relançable : python3 scripts/02_jointure_export.py   (après l'étape 1)"""
import csv, glob, io, json, os, sys, zipfile
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naf_cibles import cible, CATEGORIES, DATE_REF
from geo import DEPS, departement

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "stock-stocketablissement-csv.zip")
UL = os.path.join(BASE, "out", "ul_retenues.tsv")
DATA = os.path.join(BASE, "data")

TRANCHES = [("NN", "Non employeuse / non renseigné"), ("00", "0 salarié"), ("01", "1-2 salariés"),
            ("02", "3-5 salariés"), ("03", "6-9 salariés"), ("11", "10-19 salariés"),
            ("12", "20-49 salariés"), ("21", "50-99 salariés"), ("22", "100-199 salariés"),
            ("31", "200-249 salariés"), ("32", "250-499 salariés"), ("41", "500-999 salariés"),
            ("42", "1 000-1 999 salariés"), ("51", "2 000-4 999 salariés"),
            ("52", "5 000-9 999 salariés"), ("53", "10 000 salariés et plus")]
TR_IX = {c: i for i, (c, _) in enumerate(TRANCHES)}
CATENT = ["Non renseignée", "PME", "ETI", "GE"]
CJ = ["Entrepreneur individuel", "SARL / EURL", "SAS / SASU", "SA", "SNC / commandite",
      "Société civile", "Association", "Fondation", "Autre société / groupement", "Autre"]


def cj_simple(cj):
    if cj == "1000": return 0
    p = cj[:2]
    return {"54": 1, "57": 2, "55": 3, "56": 3, "52": 4, "53": 4, "65": 5, "92": 6, "93": 7}.get(
        p, 8 if cj[:1] in "2356" else 9)


assert CJ[cj_simple("5710")] == "SAS / SASU" and cj_simple("9220") == 6 and cj_simple("6220") == 8


def anciennete(date):
    y = int(DATE_REF[:4])
    for n, lab in ((1, "< 1 an"), (2, "1-2 ans"), (5, "2-5 ans"), (10, "5-10 ans"), (20, "10-20 ans")):
        if date >= f"{y - n}{DATE_REF[4:]}":
            return lab
    return "> 20 ans" if date else "inconnue"


def main():
    c, st = Counter(), Counter()
    nafs, files, communes, depn = {}, {}, {}, Counter()
    for f in glob.glob(os.path.join(DATA, "dep_*.js.tmp")):
        os.remove(f)
    ul = csv.reader(open(UL, encoding="utf-8", newline=""), delimiter="\t", quoting=csv.QUOTE_NONE, escapechar="\\")
    next(ul)
    cur = next(ul)
    z = zipfile.ZipFile(SRC)
    with z.open(z.namelist()[0]) as raw:
        txt = io.TextIOWrapper(raw, encoding="utf-8", newline="")
        head = next(csv.reader([txt.readline()]))
        ix = {k: i for i, k in enumerate(head)}
        iSiege, iDiff, iCP, iCom, iLib = (ix[k] for k in ("etablissementSiege", "statutDiffusionEtablissement",
            "codePostalEtablissement", "codeCommuneEtablissement", "libelleCommuneEtablissement"))
        iEns, iDen, iLibE = ix["enseigne1Etablissement"], ix["denominationUsuelleEtablissement"], ix["libelleCommuneEtrangerEtablissement"]
        iEmp = ix["caractereEmployeurEtablissement"]
        prev = ""
        for line in txt:
            s = line[:9]
            c["etab lus"] += 1
            if s < prev:
                raise SystemExit(f"Fichier établissements non trié par siren ({prev} puis {s}) : jointure par fusion impossible")
            prev = s
            if cur is None or s < cur[0]:
                continue
            while cur is not None and cur[0] < s:
                c["UL sans siège trouvé"] += 1
                cur = next(ul, None)
            if cur is None or cur[0] != s:
                continue
            e = next(csv.reader([line]))
            if len(e) != len(head):
                c["lignes établissement mal formées"] += 1; continue
            if e[iSiege] != "true":
                continue
            siren, nom, ei, date, tr, catent, naf, cj, ess, emp, score = cur
            cur = next(ul, None)
            if e[iDiff] != "O":
                c["siège non diffusible"] += 1; continue
            if e[iEmp] == "O":  # caractère employeur du siège (le champ de l'unité légale est vide)
                emp = "1"
            dep = departement(e[iCom])
            if dep not in DEPS:
                c["département inconnu"] += 1; continue
            t = cible(naf)
            ni = nafs.setdefault(naf, (len(nafs), t[3], CATEGORIES.index(t[1])))[0]
            com = e[iLib] or e[iLibE]
            cm = communes.setdefault(dep, {})
            ens = e[iEns] or e[iDen]
            row = [int(siren), nom, "" if ens == nom else ens, int(date.replace("-", "") or 0), TR_IX.get(tr, 0),
                   CATENT.index(catent) if catent in CATENT else 0, ni, cj_simple(cj),
                   int(ei) | int(ess) << 1 | int(emp) << 2, int(score),
                   int(e[iCP]) if e[iCP].isdigit() else 0, cm.setdefault(com, len(cm))]
            f = files.get(dep)
            if f is None:
                f = files[dep] = open(os.path.join(DATA, f"dep_{dep}.js.tmp"), "w", encoding="utf-8")
                f.write(f'(window.DATA_DEP=window.DATA_DEP||{{}})["{dep}"]={{rows:[\n')
            else:
                f.write(",\n")
            f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")))
            depn[dep] += 1
            c["retenues"] += 1
            # --- statistiques pour ANALYSE.md
            cat, reg, anc, sc = t[1], DEPS[dep][1], anciennete(date), int(score)
            st["secteur", cat] += 1
            st["region", reg] += 1
            st["taille", TRANCHES[TR_IX.get(tr, 0)][1]] += 1
            st["anciennete", anc] += 1
            st["type", "EI" if ei == "1" else "Société / personne morale"] += 1
            st["catent", catent or CATENT[0]] += 1
            st["score", f"{sc // 10 * 10}-{sc // 10 * 10 + 9}"] += 1
            st["annee", date[:4]] += date[:4] >= "2019"
            st["naf", f"{naf} {t[3]}"] += 1
            if anc in ("< 1 an", "1-2 ans"):
                st["secteur_recent2", cat] += 1
                st["region_recent2", reg] += 1
            if emp == "1":
                st["secteur_employeur", cat] += 1
            if sc >= 70:
                st["secteur_score70", cat] += 1
                st["region_score70", reg] += 1
                st["score70_employeur", "oui" if emp == "1" else "non"] += 1
            if sc >= 70 and emp == "1" and ei == "0":
                st["coeur_secteur", cat] += 1
                st["coeur_region", reg] += 1
            if c["etab lus"] % 10_000_000 == 0:
                print(c["etab lus"], c["retenues"], flush=True)
    while cur is not None:
        c["UL sans siège trouvé"] += 1
        cur = next(ul, None)
    assert c["retenues"] > 1_000_000, "jointure quasi vide : format changé ?"
    for dep, f in files.items():
        cm = communes[dep]
        f.write("\n],communes:" + json.dumps(list(cm), ensure_ascii=False, separators=(",", ":")) + "};\n")
        f.close()
        os.replace(f.name, f.name[:-4])
    meta = {"date": DATE_REF, "cats": CATEGORIES, "tranches": [l for _, l in TRANCHES], "catent": CATENT, "cj": CJ,
            "naf": [[k, v[1], v[2]] for k, v in sorted(nafs.items(), key=lambda kv: kv[1][0])],
            "deps": [[d, DEPS[d][0], DEPS[d][1], depn[d]] for d in DEPS if depn[d]]}
    with open(os.path.join(DATA, "meta.js"), "w", encoding="utf-8") as f:
        f.write("window.META=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
    out = {"compteurs": c}
    for (k, v), n in st.items():
        out.setdefault(k, {})[v] = n
    out = {k: dict(sorted(v.items(), key=lambda kv: -kv[1])) for k, v in out.items()}
    json.dump(out, open(os.path.join(BASE, "out", "stats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k, v in c.most_common():
        print(f"{v:>12,} {k}")


if __name__ == "__main__":
    main()
