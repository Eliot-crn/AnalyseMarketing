import type { DepData, Meta, Row, WebMap } from '#lib/store'

// Logique du CORE de prospects.html (filtre, score d'opportunité, tri, CSV), exécutée côté serveur.
export const AGES: [number, string][] = [[1, '< 1 an'], [2, '1-2 ans'], [5, '2-5 ans'], [10, '5-10 ans'], [1e4, '> 10 ans']]
export const pad = (n: number | string, l: number) => String(n).padStart(l, '0')
export const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
export const fmtDate = (d: number) => (d ? pad(d, 8).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3') : '')
export const bits = (n: number) => { let c = 0; for (; n; n >>= 1) c += n & 1; return c }
const anaOk = (w: Row | null) => (w && w[4] && w[4][0] === 0 ? (w[4] as number[]) : null)

export type Filters = {
  q: string; cat: number; naf: string; scoreMin: number; oppMin: number; web: string; video: string; cp: string[]
  com: string; trMin: number; trMax: number; catent: number; type: string; emp: number; ess: number; dFrom: number; dTo: number
}
export const F0: Filters = {
  q: '', cat: -1, naf: '', scoreMin: 0, oppMin: 0, web: '', video: '', cp: [], com: '',
  trMin: 0, trMax: 99, catent: -1, type: '', emp: -1, ess: -1, dFrom: 0, dTo: 0,
}
export type Stats = { n: number; ei: number; emp: number; ess: number; sum: number; cat: number[]; tr: number[]; age: number[] }

/** Score opportunité 0-100 = 0,4 x score secteur (max 40) + déficit de communication (max 40) + budget (max 12) + ancienneté (max 8) */
export function opportunity(r: Row, today: number): number {
  const w = r[13], a = w && w[4], y = Math.floor(today / 1e4), age = today - r[3]
  let web: number
  if (!w) web = 25 // aucune présence web connue (OSM incomplet : indice, pas preuve)
  else if (!w[0]) web = 20 // réseaux sociaux seulement, pas de site connu
  else if (!a || a[0] === 1) web = 10 // site connu mais non analysé ou bloqué
  else if (a[0] === 2) web = 15 // site en erreur (peut-être abandonné)
  else {
    const ns = bits(a[2])
    web = Math.min(40, (a[1] ? 0 : a[2] & 16 ? 6 : 12) + (ns === 0 ? 8 : ns === 1 ? 4 : 0) +
      (a[3] && a[3] <= y - 4 ? 8 : a[3] && a[3] <= y - 2 ? 4 : 0) + (a[4] ? 0 : 6) + (a[5] ? 0 : 3) +
      Math.min(6, 3 * bits(a[6])))
  }
  const budget = (r[8] & 4 ? 6 : 0) + (r[4] >= 3 ? 3 : 0) + (r[4] >= 5 ? 3 : 0)
  const anc = !r[3] ? 0 : age < 20000 ? 8 : age >= 100000 ? 6 : age >= 50000 ? 3 : 0
  return Math.round(0.4 * r[9] + web + budget + anc)
}

/** Résout commune/département/web et calcule l'opportunité (idempotent). */
export function prep(dep: string, D: DepData, W: WebMap, today: number) {
  if (D.ok) return
  for (const r of D.rows) { r[11] = D.communes[r[11]]; r[12] = dep; r[13] = W[r[0]] || null; r[14] = opportunity(r, today) }
  D.ok = true
}

export function applyFilters(sets: DepData[], F: Filters, M: Meta, today: number): { rows: Row[]; S: Stats } {
  const nafOk = new Uint8Array(M.naf.length), nq = norm(F.naf), nqc = nq.replace(/[^0-9A-Z]/g, '')
  M.naf.forEach((n, i) => {
    nafOk[i] = (F.cat < 0 || n[2] === F.cat) &&
      (!nq || (nqc && /^\d/.test(nqc) ? n[0].replace('.', '').startsWith(nqc) : norm(n[1]).includes(nq))) ? 1 : 0
  })
  const q = norm(F.q), com = norm(F.com), cps = F.cp
  const S: Stats = { n: 0, ei: 0, emp: 0, ess: 0, sum: 0, cat: M.cats.map(() => 0), tr: M.tranches.map(() => 0), age: AGES.map(() => 0) }
  const lim = AGES.map((a) => today - a[0] * 10000), rows: Row[] = []
  for (const D of sets) for (const r of D.rows) {
    if (!nafOk[r[6]] || r[9] < F.scoreMin || r[14] < F.oppMin || r[4] < F.trMin || r[4] > F.trMax) continue
    if (F.catent >= 0 && r[5] !== F.catent) continue
    const fl = r[8]
    if (F.type && (F.type === 'ei') !== !!(fl & 1)) continue
    if (F.ess >= 0 && F.ess !== (fl >> 1 & 1)) continue
    if (F.emp >= 0 && F.emp !== (fl >> 2 & 1)) continue
    if ((F.dFrom && r[3] < F.dFrom) || (F.dTo && (r[3] > F.dTo || !r[3]))) continue
    if (F.web || F.video) {
      const w = r[13], a = anaOk(w)
      if (F.web === 'none' ? w : F.web === 'site' ? !(w && w[0]) : F.web === 'ana' ? !a
        : F.web === 'low' && !(!w || !w[0] || (a && !a[1] && bits(a[2]) <= 1))) continue
      if (F.video === 'inc' ? a : F.video && (!a || (F.video === 'oui') !== !!a[1])) continue
    }
    if (cps.length) { const cp = pad(r[10], 5); if (!cps.some((p) => cp.startsWith(p))) continue }
    if (com && !norm(r[11]).includes(com)) continue
    if (q && !norm(`${r[1]} ${r[2]}`).includes(q)) continue
    rows.push(r)
    S.n++; S.ei += fl & 1; S.ess += fl >> 1 & 1; S.emp += fl >> 2 & 1; S.sum += r[9]
    S.cat[M.naf[r[6]][2]]++; S.tr[r[4]]++
    S.age[lim.findIndex((l) => r[3] >= l)]++
  }
  return { rows, S }
}

export function sortRows(rows: Row[], col: number | 'cat', dir: number, M: Meta) {
  const key = col === 'cat' ? (r: Row) => M.cats[M.naf[r[6]][2]] : col === 6 ? (r: Row) => M.naf[r[6]][0] : (r: Row) => r[col]
  rows.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -dir : x > y ? dir : 0 })
}

export function toCSV(rows: Row[], M: Meta, regOf: Record<string, string>): string {
  // préfixe ' : neutralise les formules (=, +, -, @) à l'ouverture dans un tableur
  const c = (v: unknown) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const out = ['SIREN;Nom;Enseigne;Type;Date de création;Effectif;Catégorie entreprise;NAF;Libellé NAF;Secteur cible;Forme juridique;ESS;Employeur;Score secteur;Code postal;Commune;Département;Région;Fiche;Score opportunité;Site web;Facebook;Instagram;Rapprochement OSM;Analyse du site;Vidéo;Année copyright;Adapté mobile;HTTPS;Nb réseaux sur le site']
  for (const r of rows) {
    const n = M.naf[r[6]], s = pad(r[0], 9), w = r[13] || ['', '', '', 0], a = anaOk(w), on = (v: unknown) => (v ? 'oui' : 'non')
    out.push([s, r[1], r[2], r[8] & 1 ? 'EI' : 'Société', fmtDate(r[3]), M.tranches[r[4]], M.catent[r[5]], n[0], n[1],
      M.cats[n[2]], M.cj[r[7]], r[8] & 2 ? 'oui' : 'non', r[8] & 4 ? 'oui' : 'non', r[9], r[10] ? pad(r[10], 5) : '',
      r[11], r[12], regOf[r[12]], `https://annuaire-entreprises.data.gouv.fr/entreprise/${s}`,
      r[14], w[0], w[1], w[2], ['', 'nom seul (à vérifier)', 'nom + lieu', 'SIRET'][w[3]], !w[4] ? '' : ['ok', 'bloqué', 'erreur'][w[4][0]],
      a ? on(a[1]) : '', (a && a[3]) || '', a ? on(a[4]) : '', a ? on(a[5]) : '', a ? bits(a[2]) : ''].map(c).join(';'))
  }
  return String.fromCharCode(0xfeff) + out.join('\r\n') // BOM UTF-8 : accents corrects dans Excel
}
