import '../css/app.css'

// Interface prospects : même présentation que prospects.html ; filtre, tri et pagination sont faits par le serveur (/api/prospects).
// Ligne reçue : 0 siren, 1 nom, 2 enseigne, 3 date AAAAMMJJ, 4 tranche, 5 cat. entreprise, 6 naf, 7 forme juridique,
// 8 drapeaux (1 EI, 2 ESS, 4 employeur), 9 score secteur, 10 CP, 11 commune, 12 département,
// 13 web = null | [site, facebook, instagram, confiance 1-3, analyse?], 14 score opportunité
// biome-ignore lint: lignes hétérogènes
type Row = any[]
type Meta = {
  date: string; cats: string[]; tranches: string[]; catent: string[]; cj: string[]
  naf: [string, string, number][]; deps: [string, string, string, number][]
}
type Stats = { n: number; ei: number; emp: number; ess: number; sum: number; cat: number[]; tr: number[]; age: number[] }
type Page = { S: Stats; page: number; pages: number; rows: Row[] }

const AGES: [number, string][] = [[1, '< 1 an'], [2, '1-2 ans'], [5, '2-5 ans'], [10, '5-10 ans'], [1e4, '> 10 ans']]
const pad = (n: number | string, l: number) => String(n).padStart(l, '0')
const fmtDate = (d: number) => (d ? pad(d, 8).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3') : '')
const bits = (n: number) => { let c = 0; for (; n; n >>= 1) c += n & 1; return c }

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const nf = (n: number) => n.toLocaleString('fr-FR')
const today = (() => { const d = new Date(); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate() })()

let M: Meta
let active: string[] = []
let page = 0
let sortCol: number | 'cat' = 14
let sortDir: 1 | -1 = -1
let seq = 0

fetch('/api/meta').then(async (r) => {
  const j = await r.json()
  if (!r.ok) throw new Error(j.error)
  M = j
  init()
}).catch((e: Error) => {
  $('status').className = 'err'
  $('status').textContent = e.message
})

function init() {
  const regOf: Record<string, string> = {}
  M.deps.forEach((d) => (regOf[d[0]] = d[2]))
  const total = M.deps.reduce((a, d) => a + d[3], 0)
  $('src').textContent += ` Stock du ${M.date} - ${nf(total)} entreprises retenues.`
  ;[...new Set(M.deps.map((d) => d[2]))].forEach((r) => $<HTMLSelectElement>('region').add(new Option(r, r)))
  M.cats.forEach((c, i) => $<HTMLSelectElement>('f_cat').add(new Option(c, String(i))))
  M.catent.forEach((c, i) => $<HTMLSelectElement>('f_catent').add(new Option(c, String(i))))
  M.tranches.forEach((t, i) => { $<HTMLSelectElement>('f_trmin').add(new Option(t, String(i))); $<HTMLSelectElement>('f_trmax').add(new Option(t, String(i))) })
  $('f_trmax').value = String(M.tranches.length - 1)
  $('deps').innerHTML = M.deps.map((d) => `<label data-r="${esc(d[2])}"><input type="checkbox" value="${d[0]}">${d[0]} ${esc(d[1])} <small>${nf(d[3])}</small></label>`).join('')
  const COLS: [number | string | null, string][] = [[14, 'Opportunité'], [9, 'Secteur'], [1, 'Nom'], ['cat', 'Secteur cible'], [6, 'NAF'], [3, 'Création'], [4, 'Effectif'], [5, 'Cat.'], [7, 'Forme'], [10, 'CP'], [11, 'Commune'], [null, 'Présence web'], [null, 'Fiche']]
  $('thead').innerHTML = COLS.map((c) => `<th scope="col"${c[0] === null ? '' : ` tabindex="0" data-c="${c[0]}"`}>${c[1]}</th>`).join('')

  const boxes = () => [...$('deps').querySelectorAll<HTMLInputElement>('input')]
  $('region').onchange = () => { const r = $('region').value; $('deps').querySelectorAll('label').forEach((l) => (l.hidden = !!r && l.dataset.r !== r)) }
  $('checkAll').onclick = () => boxes().forEach((b) => { if (!(b.parentNode as HTMLElement).hidden) b.checked = true })
  $('uncheck').onclick = () => boxes().forEach((b) => (b.checked = false))

  const link = (u: string, t: string) => (/^https?:\/\//i.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(t)}</a> ` : '')
  const webCell = (w: Row | null) => {
    if (!w) return '<small>inconnue</small>'
    const a = w[4], ok = a && a[0] === 0, tag = (t: string) => `<span class="tag">${t}</span>`
    return link(w[0], w[0].replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '')) + link(w[1], 'Facebook') + link(w[2], 'Instagram') +
      (w[3] === 1 ? tag('à vérifier') : '') + (a && a[0] === 1 ? tag('bloqué') : '') + (a && a[0] === 2 ? tag('site en erreur') : '') +
      (ok ? `<small>${a[1] ? 'vidéo' : 'pas de vidéo'} · ${bits(a[2])} réseau(x)${a[3] ? ` · © ${a[3]}` : ''}${a[4] ? '' : ' · non mobile'}${a[5] ? '' : ' · sans HTTPS'}${a[6] & 15 ? ' · technique ancienne' : ''}</small>` : '')
  }

  const dnum = (v: string) => (v ? +v.replace(/-/g, '') : 0)
  const queryString = (extra: Record<string, string> = {}) => new URLSearchParams({
    deps: active.join(','), q: $('f_q').value, cat: $('f_cat').value, naf: $('f_naf').value, scoreMin: $('f_score').value,
    oppMin: $('f_opp').value, web: $('f_web').value, video: $('f_video').value, cp: $('f_cp').value, com: $('f_com').value,
    trMin: $('f_trmin').value, trMax: $('f_trmax').value, catent: $('f_catent').value, type: $('f_type').value,
    emp: $('f_emp').value, ess: $('f_ess').value, dFrom: String(dnum($('f_dfrom').value)), dTo: String(dnum($('f_dto').value)),
    sort: String(sortCol), dir: String(sortDir), ...extra,
  }).toString()

  $('load').onclick = () => {
    const want = boxes().filter((b) => b.checked).map((b) => b.value)
    const n = M.deps.filter((d) => want.includes(d[0])).reduce((a, d) => a + d[3], 0)
    if (n > 2e6 && !confirm(`${nf(n)} lignes à charger côté serveur : cela peut demander plusieurs Go de mémoire. Continuer ?`)) return
    active = want
    refresh(true)
  }

  const bars = (el: string, labels: string[], vals: number[]) => {
    const mx = Math.max(1, ...vals), tot = Math.max(1, vals.reduce((a, b) => a + b, 0))
    $(el).innerHTML = labels.map((l, i) => [l, vals[i]] as [string, number]).filter((x) => x[1]).sort((a, b) => (el === 'c_cat' ? b[1] - a[1] : 0))
      .map(([l, v]) => `<div class="bar"><span title="${esc(l)}">${esc(l)}</span><div><i style="width:${v / mx * 100}%"></i></div><span>${nf(v)} <small>(${Math.round(v / tot * 100)}%)</small></span></div>`).join('') || '<span class="sub">-</span>'
  }

  async function refresh(loading = false) {
    $('f_score_o').textContent = $('f_score').value
    $('f_opp_o').textContent = $('f_opp').value
    const st = $('status'), mine = ++seq
    if (!active.length) { show({ S: emptyStats(), page: 0, pages: 1, rows: [] }); if (loading) st.textContent = 'Aucun département coché.'; return }
    if (loading) { $('load').toggleAttribute('disabled', true); st.className = ''; st.textContent = `Chargement de ${active.length} département(s)...` }
    try {
      const r = await fetch(`/api/prospects?${queryString({ page: String(page), size: $('psize').value })}`)
      const j = await r.json()
      if (mine !== seq) return // réponse périmée
      if (!r.ok) throw new Error(j.error)
      page = j.page
      show(j)
      if (loading) {
        const n = M.deps.filter((d) => active.includes(d[0])).reduce((a, d) => a + d[3], 0)
        st.textContent = `${active.length} département(s) chargé(s) : ${active.join(', ')} - ${nf(n)} entreprises.`
      }
    } catch (e) { st.className = 'err'; st.textContent = (e as Error).message }
    $('load').toggleAttribute('disabled', false)
  }
  const emptyStats = (): Stats => ({ n: 0, ei: 0, emp: 0, ess: 0, sum: 0, cat: M.cats.map(() => 0), tr: M.tranches.map(() => 0), age: AGES.map(() => 0) })

  function show({ S, pages, rows }: Page) {
    const pct = (x: number) => (S.n ? `${Math.round(x / S.n * 100)} %` : '-')
    $('kpis').innerHTML = [[nf(S.n), 'entreprises'], [pct(S.n - S.ei), 'sociétés (hors EI)'], [pct(S.emp), 'employeuses'],
      [pct(S.age[0] + S.age[1]), 'créées depuis < 2 ans'], [pct(S.ess), 'ESS'], [S.n ? (S.sum / S.n).toFixed(0) : '-', 'score moyen']]
      .map((k) => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('')
    bars('c_cat', M.cats, S.cat); bars('c_tr', M.tranches, S.tr); bars('c_age', AGES.map((a) => a[1]), S.age)
    $('count').textContent = nf(S.n) + (S.n > 1 ? ' résultats' : ' résultat')
    $('export').toggleAttribute('disabled', !S.n)
    $('tbody').innerHTML = rows.map((r) => {
      const n = M.naf[r[6]], s = pad(r[0], 9), f = r[8]
      const sc = (v: number) => `<td><span class="sc ${v >= 70 ? 'h' : v >= 50 ? 'm' : ''}">${v}</span></td>`
      return `<tr>${sc(r[14])}${sc(r[9])}` +
        `<td>${esc(r[1])}${f & 1 ? '<span class="tag">EI</span>' : ''}${f & 2 ? '<span class="tag">ESS</span>' : ''}${f & 4 ? '<span class="tag">employeur</span>' : ''}${r[2] ? `<small>${esc(r[2])}</small>` : ''}</td>` +
        `<td>${esc(M.cats[n[2]])}</td><td>${n[0]}<small>${esc(n[1])}</small></td><td class="n">${fmtDate(r[3])}</td>` +
        `<td>${esc(M.tranches[r[4]])}</td><td>${r[5] ? M.catent[r[5]] : ''}</td><td>${esc(M.cj[r[7]])}</td>` +
        `<td class="n">${r[10] ? pad(r[10], 5) : ''}</td><td>${esc(r[11])}</td><td>${webCell(r[13])}</td>` +
        `<td><a href="https://annuaire-entreprises.data.gouv.fr/entreprise/${s}" target="_blank" rel="noopener noreferrer" title="SIREN ${s}">fiche</a></td></tr>`
    }).join('') || `<tr><td colspan="13" class="sub">${active.length ? 'Aucun résultat avec ces filtres.' : 'Aucune donnée chargée.'}</td></tr>`
    $('page').textContent = `Page ${page + 1} / ${nf(pages)}`
    $('prev').toggleAttribute('disabled', page === 0); $('next').toggleAttribute('disabled', page >= pages - 1)
    $('thead').querySelectorAll('th').forEach((th) => {
      if (th.dataset.c === String(sortCol)) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort')
      th.textContent = (th.textContent ?? '').replace(/ [▲▼]$/, '') + (th.dataset.c === String(sortCol) ? (sortDir > 0 ? ' ▲' : ' ▼') : '')
    })
  }

  let t: ReturnType<typeof setTimeout>
  $('filters').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 0; refresh() }, 250) })
  document.querySelectorAll<HTMLButtonElement>('button[data-y]').forEach((b) => (b.onclick = () => {
    $('f_dfrom').value = fmtDate(today - Number(b.dataset.y) * 10000); $('f_dto').value = ''; page = 0; refresh()
  }))
  $('reset').onclick = () => {
    $('filters').querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach((e) => {
      e.value = e instanceof HTMLSelectElement ? e.options[0].value : e.type === 'range' ? '0' : ''
    })
    $('f_trmax').value = String(M.tranches.length - 1); page = 0; refresh()
  }
  const sortBy = (th: HTMLElement) => {
    const c = th.dataset.c
    if (c === undefined) return
    const col = c === 'cat' ? 'cat' : +c
    if (col === sortCol) sortDir = sortDir === 1 ? -1 : 1; else { sortCol = col; sortDir = col === 9 || col === 14 ? -1 : 1 }
    page = 0; refresh()
  }
  $('thead').onclick = (e) => { const th = (e.target as HTMLElement).closest('th'); if (th) sortBy(th) }
  $('thead').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(e.target as HTMLElement) } }
  $('prev').onclick = () => { page--; refresh() }
  $('next').onclick = () => { page++; refresh() }
  $('psize').onchange = () => { page = 0; refresh() }
  $('export').onclick = () => {
    const a = document.createElement('a')
    a.href = `/api/prospects.csv?${queryString()}`
    a.download = `prospects_${active.join('-').slice(0, 40) || 'selection'}.csv`
    document.body.append(a); a.click(); a.remove()
  }
  refresh()
}
