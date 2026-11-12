import { DEPS_LIST } from '#lib/geo_table'

/** Code departement -> [nom, region], insertion dans l'ordre de scripts/geo.py. */
export const DEPS = new Map<string, [string, string]>(DEPS_LIST.map(([c, n, r]) => [c, [n, r]]))

/** 2 premiers caracteres du code commune (3 pour 97x/98x). */
export function departement(codeCommune: string): string {
  if (!codeCommune) return '99'
  return ['97', '98'].includes(codeCommune.slice(0, 2)) ? codeCommune.slice(0, 3) : codeCommune.slice(0, 2)
}
