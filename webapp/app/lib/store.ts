import { readFile } from 'node:fs/promises'
import { dataPath } from '#lib/io'

// Ligne SIRENE : 0 siren, 1 nom, 2 enseigne, 3 date AAAAMMJJ, 4 tranche, 5 cat. entreprise, 6 naf (index),
// 7 forme juridique, 8 drapeaux (1 EI, 2 ESS, 4 employeur), 9 score secteur, 10 CP, 11 commune (index puis texte)
// Après prep() : 12 département, 13 web (null | [site, fb, ig, confiance, analyse?]), 14 score opportunité.
// biome-ignore lint: lignes heterogenes (nombres, textes, tableaux)
export type Row = any[]
export type Meta = {
  date: string; cats: string[]; tranches: string[]; catent: string[]; cj: string[]
  naf: [string, string, number][]; deps: [string, string, string, number][]
}
export type DepData = { rows: Row[]; communes: string[]; ok?: boolean }
export type WebMap = Record<string, Row>

/** Code departement sur disque : valide contre une liste blanche pour eviter toute traversee de chemin. */
export const DEP_RE = /^(\d{2}|2[AB]|97\d|98\d)$/

export async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(dataPath(name), 'utf-8')) as T
}
export const loadMeta = () => readJson<Meta>('meta.json')
export function loadDep(dep: string): Promise<DepData> {
  if (!DEP_RE.test(dep)) throw new Error(`département invalide : ${dep}`)
  return readJson<DepData>(`dep_${dep}.json`)
}
/** Enrichissement web facultatif : absent = aucune info. */
export async function loadWeb(dep: string): Promise<WebMap> {
  try { return await readJson<WebMap>(`web_${dep}.json`) } catch { return {} }
}
