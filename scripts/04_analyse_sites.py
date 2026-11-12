#!/usr/bin/env python3
"""Etape 4 : analyse de la page d'accueil des sites connus (Crawl4AI) puis écriture de data/web_XX.js.
Poli par construction : une seule page par domaine, robots.txt respecté (check_robots_txt), 4 pages en
parallèle au plus (domaines tous différents), user-agent par défaut, aucun mode furtif ni proxy.
Un site qui refuse (robots.txt, 401/403/429/503) est noté « bloqué » et n'est pas retenté.
Cache : out/web/sites.jsonl (une ligne par URL ; supprimer la ligne pour ré-analyser).
usage : crawl4ai-env/bin/python scripts/04_analyse_sites.py --dep 75 --max 300
        python3 scripts/04_analyse_sites.py --all --max 0     (réécrit data/web_XX.js sans rien télécharger)"""
import argparse, asyncio, json, os, re, sys
from collections import Counter
from urllib.parse import urlsplit

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(BASE, "out", "web")
CACHE = os.path.join(WEB, "sites.jsonl")
SOCIAL = [("facebook", r"facebook\.com/"), ("instagram", r"instagram\.com/"), ("linkedin", r"linkedin\.com/"),
          ("tiktok", r"tiktok\.com/"), ("youtube", r"youtube\.com/|youtu\.be/"), ("x", r"(?:twitter|//x|\.x)\.com/")]
OLD_GEN = re.compile(r"joomla!? ?1\.|joomla!? ?2\.|wordpress [1-4]\.|drupal [4-7]\b|frontpage|dreamweaver|golive|iweb|"
                     r"spip [12]\.|prestashop 1\.[0-6]|microsoft|namo|webacappella|e-monsite", re.I)


def analyse(html, url):
    """-> [statut 0, vidéo intégrée, réseaux (bits fb1 ig2 in4 tt8 yt16 x32), année ©, mobile, https,
    vieillesse (bits jQuery<1.9 =1, Flash 2, mise en page tableaux 4, générateur ancien 8, <3 images 16), nb images]"""
    low = html.lower()
    video = bool(re.search(r"<video\b|<iframe[^>]+(?:youtube(?:-nocookie)?\.com/embed|player\.vimeo\.com|dailymotion\.com/embed)", low))
    hrefs = " ".join(re.findall(r'href=["\']([^"\']+)', low))
    soc = sum(1 << i for i, (_, rx) in enumerate(SOCIAL) if re.search(rx, hrefs))
    years = [int(y) for m in re.finditer(r"(?:©|&copy;|&#169;|copyright)(.{0,60})", low, re.S)
             for y in re.findall(r"\b(?:19|20)\d\d\b", re.sub(r"<[^>]*>", " ", m.group(1)))]
    year = max([y for y in years if 1995 <= y <= 2027], default=0)
    mobile = bool(re.search(r"<meta[^>]+name=[\"']?viewport", low))
    jq = re.search(r"jquery[-./@]?(?:v)?(\d+)\.(\d+)(?:\.\d+)?(?:\.min|\.slim)*\.js|jquery/(\d+)\.(\d+)", low)
    jqv = tuple(int(x) for x in jq.groups() if x) if jq else None
    gen = re.search(r'<meta[^>]+name=["\']?generator["\']?[^>]+content=["\']([^"\']*)', low)
    nimg = low.count("<img")
    old = (1 if jqv and jqv < (1, 9) else 0) | (2 if re.search(r"\.swf\b|x-shockwave-flash", low) else 0) \
        | (4 if low.count("<table") >= 4 and low.count("<div") < 20 else 0) \
        | (8 if gen and OLD_GEN.search(gen.group(1)) else 0) | (16 if nimg < 3 else 0)
    return [0, int(video), soc, year, int(mobile), int(url.startswith("https://")), old, nimg]


_t = analyse('<html><meta name="viewport" content="x"><iframe src="https://www.youtube.com/embed/x"></iframe>'
             '<a href="https://www.facebook.com/a">f</a><script src="/js/jquery-1.7.2.min.js"></script>'
             '<footer>&copy; 2012 - <b>2019</b> Ma boîte</footer><img><img><img></html>', "https://a.fr")
assert _t == [0, 1, 1, 2019, 1, 1, 1, 3], _t
_t = analyse("<table><table><table><table><embed src=a.swf> Copyright 2009", "http://a.fr")
assert _t == [0, 0, 0, 2009, 0, 0, 2 | 4 | 16, 0], _t


def load_cache():
    c = {}
    if os.path.exists(CACHE):
        for line in open(CACHE, encoding="utf-8"):
            d = json.loads(line)
            c[d["url"]] = d["a"]
    return c


async def crawl(urls, cache):
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    cfg = CrawlerRunConfig(check_robots_txt=True, cache_mode=CacheMode.BYPASS, page_timeout=25000,
                           wait_until="domcontentloaded", verbose=False)
    sem, n = asyncio.Semaphore(4), 0
    with open(CACHE, "a", encoding="utf-8") as fo:
        async with AsyncWebCrawler(config=BrowserConfig(headless=True, verbose=False)) as crawler:
            async def one(u):
                nonlocal n
                async with sem:
                    try:
                        r = await asyncio.wait_for(crawler.arun(u, config=cfg), 60)
                        err = (r.error_message or "").lower()
                        if r.success and r.html and (r.status_code or 200) < 400:
                            a = analyse(r.html, r.redirected_url or r.url or u)
                        elif "robots" in err or r.status_code in (401, 403, 429, 503):
                            a = [1]        # bloqué : on n'insiste pas
                        else:
                            a = [2]        # erreur (site mort, DNS, délai...)
                    except Exception:
                        a = [2]
                    cache[u] = a
                    fo.write(json.dumps({"url": u, "a": a}) + "\n"); fo.flush()
                    n += 1
                    if n % 25 == 0:
                        print(f"  {n}/{len(urls)}", flush=True)
            await asyncio.gather(*(one(u) for u in urls))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dep", action="append", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--max", type=int, default=300, help="nb max de nouveaux sites à analyser par département")
    a = ap.parse_args()
    deps = a.dep or []
    if a.all:
        deps = sorted(f[6:-5] for f in os.listdir(WEB) if f.startswith("match_"))
    cache, tot = load_cache(), Counter()
    for dep in deps:
        match = json.load(open(os.path.join(WEB, f"match_{dep}.json"), encoding="utf-8"))["match"]
        if a.max > 0:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from importlib import import_module
            rows = import_module("03_osm_overpass").load_dep(dep)["rows"]
            score = {str(r[0]): r[9] for r in rows}
            todo, seen = [], {urlsplit(u).netloc.lower() for u in cache}
            for siren, m in sorted(match.items(), key=lambda kv: (kv[1][3] < 2, -score.get(kv[0], 0))):
                dom = urlsplit(m[0]).netloc.lower()   # priorité : rapprochements sûrs puis meilleur score secteur
                if m[0] and m[0] not in cache and dom not in seen:
                    seen.add(dom); todo.append(m[0])
            todo = todo[:a.max]
            print(f"{dep}: {len(todo)} sites à analyser", flush=True)
            if todo:
                asyncio.run(crawl(todo, cache))
        out = {s: m + ([cache[m[0]]] if m[0] in cache else []) for s, m in match.items()}
        with open(os.path.join(BASE, "data", f"web_{dep}.js"), "w", encoding="utf-8") as f:
            f.write(f'(window.DATA_WEB=window.DATA_WEB||{{}})["{dep}"]=' + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
        st = Counter(v[4][0] for v in out.values() if len(v) > 4)
        tot.update({"rapprochés OSM": len(out), "avec site web": sum(bool(v[0]) for v in out.values()),
                    "sites analysés OK": st[0], "sites bloqués": st[1], "sites en erreur": st[2]})
    json.dump(tot, open(os.path.join(WEB, "stats_web.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for k, v in tot.items():
        print(f"{v:>10,} {k}")


if __name__ == "__main__":
    main()
