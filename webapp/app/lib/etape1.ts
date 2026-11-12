import { cible, score } from '#lib/naf_cibles'
import { tsvEscape } from '#lib/io'

export const UL_COLS = ['siren', 'nom', 'ei', 'date', 'tranche', 'catent', 'naf', 'cj', 'ess', 'emp', 'score']
const KEYS = ['statutDiffusion', 'dateCreation', 'prenomUsuel', 'trancheEffectifs', 'categorieEntreprise',
  'etatAdministratif', 'nom', 'nomUsage', 'denomination', 'denominationUsuelle1', 'categorieJuridique',
  'activitePrincipale', 'nomenclatureActivitePrincipale', 'economieSocialeSolidaire', 'caractereEmployeur']

/** Indices des colonnes utiles (les noms portent le suffixe "UniteLegale" ou non selon la version du stock). */
export function ulIndex(header: string[]): Record<string, number> {
  const ix = new Map(header.map((k, i) => [k, i]))
  return Object.fromEntries(KEYS.map((k) => {
    const i = ix.get(`${k}UniteLegale`) ?? ix.get(k)
    if (i === undefined) throw new Error(`colonne absente du fichier unités légales : ${k}`)
    return [k, i]
  }))
}

/** Une ligne StockUniteLegale -> [raison d'exclusion] ou colonnes de ul_retenues.tsv. */
export function filtreUL(row: string[], I: Record<string, number>): { skip: string } | { cols: (string | number)[] } {
  if (row[I.etatAdministratif] !== 'A') return { skip: 'cessées' }
  if (row[I.statutDiffusion] !== 'O') return { skip: 'non diffusibles' } // P = diffusion partielle -> exclu
  if (row[I.nomenclatureActivitePrincipale] !== 'NAFRev2') return { skip: 'NAF absent ou ancienne nomenclature' }
  const cj = row[I.categorieJuridique]
  if (cj.startsWith('7') || cj.startsWith('91')) return { skip: 'personnes publiques / copropriétés' }
  const naf = row[I.activitePrincipale]
  const t = cible(naf)
  if (!t) return { skip: 'NAF hors cible ou exclu' }
  const ei = cj === '1000'
  let nom: string
  if (ei) nom = `${row[I.prenomUsuel]} ${row[I.nomUsage] || row[I.nom]}`.trim()
  else {
    nom = row[I.denomination]
    const u = row[I.denominationUsuelle1]
    if (u && u !== nom) nom = nom ? `${nom} (${u})` : u
  }
  if (!nom) return { skip: 'sans nom' }
  const tr = row[I.trancheEffectifs] || 'NN'
  // caractereEmployeur est vide dans les stocks récents -> repli sur la tranche d'effectif
  const emp = row[I.caractereEmployeur] || (/^\d+$/.test(tr) && tr >= '01' ? 'O' : 'N')
  const date = row[I.dateCreation]
  return {
    cols: [row[0], tsvEscape(nom), +ei, date, tr, row[I.categorieEntreprise], naf, cj,
      +(row[I.economieSocialeSolidaire] === 'O'), +(emp === 'O'), score(t.base, date, tr)],
  }
}
