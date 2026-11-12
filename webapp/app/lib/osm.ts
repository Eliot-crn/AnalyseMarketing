import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dataPath } from '#lib/io'
import type { DepData } from '#lib/store'

const API = 'https://overpass-api.de/api/interpreter'
const UA = 'AnalyseMarketing-webapp/1.0 (script ponctuel, requetes sequentielles)'
const QUERY = (area: string) => `[out:json][timeout:300];
area${area}["boundary"="administrative"]["admin_level"~"^[346]$"]->.a;
nwr(area.a)["name"][~"^(website|contact:website|facebook|contact:facebook|instagram|contact:instagram|ref:FR:SIRET)$"~"."];
out tags;`
const STOP = new Set('SARL SAS SASU EURL SA SCI SNC STE SOCIETE ETS ETABLISSEMENTS ETABLISSEMENT LE LA LES L DE DU DES D ET AU AUX A'.split(' '))

export type OsmData = { elements: { tags?: Record<string, string> }[] }
/** [site, facebook, instagram, confiance 1-3] */
export type Match = [string, string, string, number]

export function norm(s: string): string {
  const t = s.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  return t.split(/[^A-Z0-9]+/).filter((x) => x && !STOP.has(x)).join('')
}

/** URL http(s) propre ou '' (les tags OSM sont des données non fiables). */
export function urlOk(u?: string, prefix = ''): string {
  u = (u ?? '').split(';')[0].trim()
  if (!u || /[\s"'<>\\]/.test(u)) return ''
  if (!/^https?:\/\//i.test(u)) {
    if (/^[a-z]+:/i.test(u) && !/^[\w.-]+:\d/.test(u)) return '' // autre schéma (javascript:, mailto:...)
    u = (prefix || 'https://') + u.replace(/^[@/]+/, '')
  }
  return u.slice(0, 200)
}

export function matchDep(D: DepData, osm: OsmData) {
  const bySiren = new Map<number, (typeof D.rows)[number]>()
  const byName = new Map<string, (typeof D.rows)[number][]>()
  for (const r of D.rows) {
    bySiren.set(r[0], r)
    for (const k of new Set([norm(r[1]), norm(r[2])]))
      if (k.length >= 4) (byName.get(k) ?? byName.set(k, []).get(k)!).push(r)
  }
  const out = new Map<number, Match>()
  const c: Record<string, number> = {}
  const inc = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n)
  for (const el of osm.elements) {
    const t = el.tags ?? {}
    let site = urlOk(t.website || t['contact:website'])
    let fb = urlOk(t['contact:facebook'] || t.facebook, 'https://www.facebook.com/')
    let ig = urlOk(t['contact:instagram'] || t.instagram, 'https://www.instagram.com/')
    const m = /^https?:\/\/(?:[\w-]+\.)*(facebook|instagram)\.com\//i.exec(site)
    if (m) { // un réseau social déclaré comme site web
      if (m[1].toLowerCase() === 'facebook') fb ||= site
      else ig ||= site
      site = ''
    }
    inc('objets OSM')
    if (!(site || fb || ig)) { inc('sans lien (SIRET seul)'); continue }
    const siret = (t['ref:FR:SIRET'] ?? '').replace(/\D/g, '')
    let r = siret.length === 14 ? bySiren.get(Number(siret.slice(0, 9))) : undefined
    let conf = r ? 3 : 0
    if (!r) {
      const name = norm(t.name ?? '')
      const cand = byName.get(name) ?? []
      const cp = t['addr:postcode'] ?? ''
      const city = norm(t['addr:city'] ?? '')
      let loc: typeof cand | null = null
      if (cand.length && /^\d+$/.test(cp)) loc = cand.filter((x) => x[10] === Number(cp))
      else if (cand.length && city) loc = cand.filter((x) => norm(D.communes[x[11]]) === city)
      if (loc && loc.length === 1) { r = loc[0]; conf = 2 }
      else if (!loc && cand.length === 1 && name.length >= 6) { r = cand[0]; conf = 1 }
      else { inc('non rapprochés'); continue }
    }
    const old = out.get(r[0])
    if (old && old[3] > conf) continue
    const o: Match = old && old[3] === conf ? old : ['', '', '', conf]
    out.set(r[0], [o[0] || site, o[1] || fb, o[2] || ig, conf])
  }
  for (const v of out.values()) { inc(`rapprochés confiance ${v[3]}`); if (v[0]) inc('rapprochés avec site web') }
  c['rapprochés'] = out.size
  c['entreprises SIRENE du département'] = D.rows.length
  return { stats: c, match: Object.fromEntries(out) as Record<string, Match> }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function overpass(area: string, dep: string, log: (m: string) => void): Promise<OsmData | null> {
  let d: (OsmData & { remark?: string }) | null = null
  for (let attempt = 0; attempt < 4 && !d; attempt++) {
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: QUERY(area) }), signal: AbortSignal.timeout(330_000),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      d = (await r.json()) as OsmData
    } catch (e) {
      log(`  ${dep}: ${(e as Error).message} -> pause ${60 * (attempt + 1)} s`)
      await sleep(60_000 * (attempt + 1))
    }
  }
  if (!d) { log(`  ${dep}: abandon (Overpass indisponible)`); return null }
  if ((d as { remark?: string }).remark) { // timeout/mémoire côté serveur : ne pas mettre en cache
    log(`  ${dep}: ${String((d as { remark?: string }).remark).slice(0, 120)}`)
    return null
  }
  await sleep(8000) // pause de politesse entre deux requêtes
  return d
}

export async function fetchOsm(dep: string, force: boolean, log: (m: string) => void): Promise<OsmData | null> {
  const path = dataPath('osm', `osm_${dep}.json`)
  if (!force) { try { return JSON.parse(await readFile(path, 'utf-8')) } catch { /* pas de cache */ } }
  let d = await overpass(dep === '69' ? '["ref:INSEE"~"^69[DM]?$"]' : `["ref:INSEE"="${dep}"]`, dep, log) // Rhône = 69D + métropole 69M
  if (d && !d.elements.length) d = await overpass(`["ISO3166-2"="FR-${dep}"]`, dep, log) // certains DOM n'ont pas de ref:INSEE
  if (!d) return null
  await mkdir(dataPath('osm'), { recursive: true })
  await writeFile(`${path}.tmp`, JSON.stringify(d))
  await rename(`${path}.tmp`, path)
  return d
}
