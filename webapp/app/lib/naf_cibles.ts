import { CATEGORIES, EXCLU, TABLE } from '#lib/naf_table'

export { CATEGORIES }
export const DATE_REF = '2026-11-01' // date du stock SIRENE, pour un score reproductible

export type Cible = { prefixe: string; categorie: string; base: number; libelle: string }

/** Le prefixe le plus long gagne ("56.10A" > "56.10" > "56.1" > "56"). null = non retenu ou exclu. */
export function cible(naf: string): Cible | null {
  for (const n of [6, 5, 4, 2]) {
    const e = Object.hasOwn(TABLE, naf.slice(0, n)) ? TABLE[naf.slice(0, n)] : undefined
    if (e) return e[0] === EXCLU ? null : { prefixe: naf.slice(0, n), categorie: e[0], base: e[1], libelle: e[2] }
  }
  return null
}

/** Base NAF + 5 si creee depuis moins de 3 ans + 5 si >= 1 salarie + 5 si >= 10 salaries. Plafond 100. */
export function score(base: number, dateCreation: string, tranche: string): number {
  let s = base
  if (dateCreation && dateCreation >= `${Number(DATE_REF.slice(0, 4)) - 3}${DATE_REF.slice(4)}`) s += 5
  if (/^\d+$/.test(tranche) && tranche >= '01') s += 5 + (tranche >= '11' ? 5 : 0)
  return Math.min(s, 100)
}
