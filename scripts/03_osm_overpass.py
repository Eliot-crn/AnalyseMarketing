#!/usr/bin/env python3
"""Etape 3 : présence web connue via OpenStreetMap (API Overpass, © contributeurs OpenStreetMap, ODbL).
Par département : objets ayant un nom + (website | facebook | instagram | ref:FR:SIRET), rapprochés de
data/dep_XX.js. Confiance : 3 = SIRET identique, 2 = nom normalisé + code postal ou commune,
1 = nom normalisé unique dans le département (à vérifier). Sorties : out/web/osm/osm_XX.json (cache brut),
out/web/match_XX.json. Requêtes séquentielles avec pause (usage équitable d'Overpass).
usage : python3 scripts/03_osm_overpass.py --dep 75 [--dep 69 ...] | --all   [--force]"""
import argparse, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(BASE, "out", "web")
API = "https://overpass-api.de/api/interpreter"
UA = "sirene-prospects-local/1.0 (script ponctuel, requetes sequentielles)"
QUERY = """[out:json][timeout:300];
area%s["boundary"="administrative"]["admin_level"~"^[346]$"]->.a;
nwr(area.a)["name"][~"^(website|contact:website|facebook|contact:facebook|instagram|contact:instagram|ref:FR:SIRET)$"~"."];
out tags;"""
STOP = set("SARL SAS SASU EURL SA SCI SNC STE SOCIETE ETS ETABLISSEMENTS ETABLISSEMENT LE LA LES L DE DU DES D ET AU AUX A".split())


def norm(s):
    s = unicodedata.normalize("NFD", s.upper())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return "".join(t for t in re.split(r"[^A-Z0-9]+", s) if t and t not in STOP)


def url_ok(u, prefix=""):
    """URL http(s) propre ou '' (les tags OSM sont des données non fiables)."""
    u = (u or "").split(";")[0].strip()
    if not u or re.search(r"[\s\"'<>\\]", u):
        return ""
    if not re.match(r"https?://", u, re.I):
        if re.match(r"[a-z]+:", u, re.I) and not re.match(r"[\w.-]+:\d", u):
            return ""                       # autre schéma (javascript:, mailto:...)
        u = (prefix or "https://") + u.lstrip("@/")
    return u[:200]


def fetch(dep, force=False):
    path = os.path.join(WEB, "osm", f"osm_{dep}.json")
    if os.path.exists(path) and not force:
        return json.load(open(path, encoding="utf-8"))
    d = _fetch('["ref:INSEE"~"^69[DM]?$"]' if dep == "69" else f'["ref:INSEE"="{dep}"]', dep)  # Rhône = 69D + métropole 69M
    if d and not d["elements"]:             # certains DOM n'ont pas de ref:INSEE départemental dans OSM
        d = _fetch(f'["ISO3166-2"="FR-{dep}"]', dep)
    if d is None:
        return None
    json.dump(d, open(path + ".tmp", "w", encoding="utf-8"), ensure_ascii=False)
    os.replace(path + ".tmp", path)
    return d


def _fetch(area, dep):
    req = urllib.request.Request(API, data=urllib.parse.urlencode({"data": QUERY % area}).encode(),
                                 headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=330) as r:
                d = json.load(r)
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            print(f"  {dep}: {e} -> pause {60 * (attempt + 1)} s", flush=True)
            time.sleep(60 * (attempt + 1))
    else:
        print(f"  {dep}: abandon (Overpass indisponible)", flush=True)
        return None
    if d.get("remark"):                     # timeout/mémoire côté serveur : ne pas mettre en cache
        print(f"  {dep}: {d['remark'][:120]}", flush=True)
        return None
    time.sleep(8)                           # pause de politesse entre deux requêtes
    return d


def load_dep(dep):
    s = open(os.path.join(BASE, "data", f"dep_{dep}.js"), encoding="utf-8").read()
    s = s[s.index("{rows:"):].rstrip().rstrip(";")
    return json.loads(s.replace("{rows:", '{"rows":', 1).replace("\n],communes:", '\n],"communes":', 1))


def match(dep, osm):
    D = load_dep(dep)
    by_siren, by_name = {}, {}
    for r in D["rows"]:
        by_siren[r[0]] = r
        for k in {norm(r[1]), norm(r[2])}:
            if len(k) >= 4:
                by_name.setdefault(k, []).append(r)
    out, c = {}, Counter()
    for el in osm["elements"]:
        t = el.get("tags", {})
        site = url_ok(t.get("website") or t.get("contact:website"))
        fb = url_ok(t.get("contact:facebook") or t.get("facebook"), "https://www.facebook.com/")
        ig = url_ok(t.get("contact:instagram") or t.get("instagram"), "https://www.instagram.com/")
        m = re.search(r"https?://(?:[\w-]+\.)*(facebook|instagram)\.com/", site, re.I)
        if m:                               # un réseau social déclaré comme site web
            if m.group(1).lower() == "facebook": fb = fb or site
            else: ig = ig or site
            site = ""
        c["objets OSM"] += 1
        if not (site or fb or ig):
            c["sans lien (SIRET seul)"] += 1; continue
        siret = re.sub(r"\D", "", t.get("ref:FR:SIRET", ""))
        r, conf = (by_siren.get(int(siret[:9])), 3) if len(siret) == 14 else (None, 0)
        if r is None:
            cand = by_name.get(norm(t.get("name", "")), [])
            cp, city = t.get("addr:postcode", ""), norm(t.get("addr:city", ""))
            if cand and cp.isdigit():
                loc = [x for x in cand if x[10] == int(cp)]
            elif cand and city:
                loc = [x for x in cand if norm(D["communes"][x[11]]) == city]
            else:
                loc = None
            if loc is not None and len(loc) == 1:
                r, conf = loc[0], 2
            elif loc is None and len(cand) == 1 and len(norm(t["name"])) >= 6:
                r, conf = cand[0], 1
            else:
                c["non rapprochés"] += 1; continue
        old = out.get(r[0])
        if old and old[3] > conf:
            continue
        o = old if old and old[3] == conf else ["", "", "", conf]
        out[r[0]] = [o[0] or site, o[1] or fb, o[2] or ig, conf]
    for v in out.values():
        c[f"rapprochés confiance {v[3]}"] += 1
        c["rapprochés avec site web"] += bool(v[0])
    c["rapprochés"] = len(out)
    c["entreprises SIRENE du département"] = len(D["rows"])
    json.dump({"stats": c, "match": out}, open(os.path.join(WEB, f"match_{dep}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    return c


assert norm("SARL Le Café de l'Église") == "CAFEEGLISE" and url_ok("javascript:alert(1)") == ""
assert url_ok("www.x.fr") == "https://www.x.fr" and url_ok("monbar", "https://www.facebook.com/") == "https://www.facebook.com/monbar"
assert url_ok('http://a.fr/"><script>') == "" and url_ok("http://a.fr;http://b.fr") == "http://a.fr"

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dep", action="append", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    deps = a.dep or []
    if a.all:
        deps = sorted(f[4:-3] for f in os.listdir(os.path.join(BASE, "data")) if f.startswith("dep_") and f.endswith(".js"))
        deps.remove("99")
    tot = Counter()
    for dep in deps:
        osm = fetch(dep, a.force)
        if osm is None:
            tot["départements en échec"] += 1; continue
        c = match(dep, osm)
        tot.update(c)
        print(f"{dep}: {c['objets OSM']} objets OSM, {c['rapprochés']} rapprochés ({c['rapprochés avec site web']} avec site)", flush=True)
    json.dump(tot, open(os.path.join(WEB, "stats_osm.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k, v in tot.most_common():
        print(f"{v:>10,} {k}")
