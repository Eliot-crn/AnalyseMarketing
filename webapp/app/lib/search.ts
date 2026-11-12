import { applyFilters, F0, prep, sortRows, type Filters, type Stats } from '#lib/prospects'
import { loadDep, loadMeta, loadWeb, type DepData, type Meta, type Row } from '#lib/store'

export const MAX_DEPS = 15
export const MAX_CSV = 500_000
const SORTABLE = new Set(['cat', '1', '3', '4', '5', '6', '7', '9', '10', '11', '14'])

export type Query = { deps: string[]; F: Filters; sort: number | 'cat'; dir: 1 | -1; page: number; size: number }

export const todayNum = (d = new Date()) => d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate()

/** Query string -> requête validée (valeurs hors bornes ramenées aux défauts ; les départements sont validés plus loin contre meta). */
export function parseQuery(qs: Record<string, string | undefined>): Query {
  const num = (k: string, d: number) => { const v = qs[k]; return v !== undefined && v !== '' && Number.isFinite(+v) ? +v : d }
  const str = (k: string, max = 100) => (qs[k] ?? '').slice(0, max)
  const F: Filters = {
    ...F0, q: str('q'), naf: str('naf'), com: str('com'), web: str('web', 10), video: str('video', 10), type: str('type', 10),
    cat: num('cat', -1), scoreMin: num('scoreMin', 0), oppMin: num('oppMin', 0), trMin: num('trMin', 0), trMax: num('trMax', 99),
    catent: num('catent', -1), emp: num('emp', -1), ess: num('ess', -1), dFrom: num('dFrom', 0), dTo: num('dTo', 0),
    cp: str('cp').split(/[\s,;]+/).filter(Boolean),
  }
  const sort = SORTABLE.has(qs.sort ?? '') ? (qs.sort === 'cat' ? 'cat' : Number(qs.sort)) : 14
  return {
    deps: str('deps', 200).split(',').filter(Boolean), F, sort,
    dir: qs.dir === '1' ? 1 : -1, page: Math.max(0, Math.floor(num('page', 0))), size: Math.min(500, Math.max(10, Math.floor(num('size', 100)))),
  }
}

const depCache = new Map<string, Promise<DepData>>()
function getDep(dep: string, today: number): Promise<DepData> {
  let p = depCache.get(dep)
  if (!p) {
    p = Promise.all([loadDep(dep), loadWeb(dep)]).then(([D, W]) => { prep(dep, D, W, today); return D })
    p.catch(() => depCache.delete(dep))
    depCache.set(dep, p)
    if (depCache.size > 10) depCache.delete(depCache.keys().next().value!) // éviction FIFO
  }
  return p
}

let last: { key: string; rows: Row[]; S: Stats } | null = null

/** Filtre + tri (mis en cache pour la pagination). Lève Error('...') si la requête est invalide. */
export async function search(q: Query, today = todayNum()) {
  const M: Meta = await loadMeta()
  const known = new Set(M.deps.map((d) => d[0]))
  if (q.deps.length > MAX_DEPS) throw new Error(`${MAX_DEPS} départements au maximum par requête`)
  const bad = q.deps.find((d) => !known.has(d))
  if (bad) throw new Error(`département inconnu : ${bad}`)
  const key = JSON.stringify([q.deps, q.F, q.sort, q.dir, today])
  if (last?.key !== key) {
    const sets = await Promise.all(q.deps.map((d) => getDep(d, today)))
    const { rows, S } = applyFilters(sets, q.F, M, today)
    sortRows(rows, q.sort, q.dir, M)
    last = { key, rows, S }
  }
  return { M, rows: last.rows, S: last.S }
}
