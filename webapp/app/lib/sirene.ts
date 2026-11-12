import { DATE_REF } from '#lib/naf_cibles'

export const TRANCHES: [string, string][] = [
  ['NN', 'Non employeuse / non renseigné'], ['00', '0 salarié'], ['01', '1-2 salariés'],
  ['02', '3-5 salariés'], ['03', '6-9 salariés'], ['11', '10-19 salariés'],
  ['12', '20-49 salariés'], ['21', '50-99 salariés'], ['22', '100-199 salariés'],
  ['31', '200-249 salariés'], ['32', '250-499 salariés'], ['41', '500-999 salariés'],
  ['42', '1 000-1 999 salariés'], ['51', '2 000-4 999 salariés'],
  ['52', '5 000-9 999 salariés'], ['53', '10 000 salariés et plus'],
]
export const TR_IX = new Map(TRANCHES.map(([c], i) => [c, i]))
export const CATENT = ['Non renseignée', 'PME', 'ETI', 'GE']
export const CJ = ['Entrepreneur individuel', 'SARL / EURL', 'SAS / SASU', 'SA', 'SNC / commandite',
  'Société civile', 'Association', 'Fondation', 'Autre société / groupement', 'Autre']

const CJ_PREFIX: Record<string, number> = { 54: 1, 57: 2, 55: 3, 56: 3, 52: 4, 53: 4, 65: 5, 92: 6, 93: 7 }
export function cjSimple(cj: string): number {
  if (cj === '1000') return 0
  return CJ_PREFIX[cj.slice(0, 2)] ?? ('2356'.includes(cj.slice(0, 1)) && cj ? 8 : 9)
}

export function anciennete(date: string): string {
  const y = Number(DATE_REF.slice(0, 4))
  for (const [n, lab] of [[1, '< 1 an'], [2, '1-2 ans'], [5, '2-5 ans'], [10, '5-10 ans'], [20, '10-20 ans']] as const)
    if (date >= `${y - n}${DATE_REF.slice(4)}`) return lab
  return date ? '> 20 ans' : 'inconnue'
}
