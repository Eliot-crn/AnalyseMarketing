import { createWriteStream, type WriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { parse } from 'csv-parse/sync'
import { DEPS, departement } from '#lib/geo'
import { dataPath, fileLines, lines, SRC_DIR, tsvSplit, zipFirstEntry } from '#lib/io'
import { CATEGORIES, cible, DATE_REF } from '#lib/naf_cibles'
import { anciennete, CATENT, CJ, cjSimple, TR_IX, TRANCHES } from '#lib/sirene'

export default class SireneJointure extends BaseCommand {
  static commandName = 'sirene:jointure'
  static description = 'Etape 2 : jointure ul_retenues.tsv x StockEtablissement (sièges) -> data/dep_XX.json, meta.json, stats.json'
  static options: CommandOptions = { startApp: false }

  @flags.string({ description: 'zip StockEtablissement (défaut : ../stock-stocketablissement-csv.zip, lecture seule)' })
  declare src: string

  @flags.number({ description: 'ne lire que les N premières lignes établissements (tests)' })
  declare limit: number

  async run() {
    const src = this.src ?? join(SRC_DIR, 'stock-stocketablissement-csv.zip')
    await mkdir(dataPath(), { recursive: true })
    for (const f of await readdir(dataPath())) if (/^dep_.*\.json\.tmp$/.test(f)) await rm(dataPath(f))

    const c: Record<string, number> = {}
    const inc = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n)
    const st = new Map<string, Map<string, number>>()
    const add = (k: string, v: string, n = 1) => {
      const m = st.get(k) ?? st.set(k, new Map()).get(k)!
      m.set(v, (m.get(v) ?? 0) + n)
    }
    const nafs = new Map<string, [number, string, number]>()
    const files = new Map<string, WriteStream>()
    const communes = new Map<string, Map<string, number>>()
    const depn = new Map<string, number>()

    const ulIt = fileLines(dataPath('ul_retenues.tsv'))[Symbol.asyncIterator]()
    const nextUL = async () => { const r = await ulIt.next(); return r.done ? null : tsvSplit(r.value) }
    await ulIt.next() // entête
    let cur = await nextUL()

    const raw = await zipFirstEntry(src)
    raw.setEncoding('utf-8')
    let head: string[] | null = null
    let I: Record<string, number> = {}
    let prev = ''
    for await (const line of lines(raw)) {
      if (!head) {
        head = parse(line, { bom: true })[0] as string[]
        const ix = Object.fromEntries(head.map((k, i) => [k, i]))
        I = Object.fromEntries(['etablissementSiege', 'statutDiffusionEtablissement', 'codePostalEtablissement',
          'codeCommuneEtablissement', 'libelleCommuneEtablissement', 'enseigne1Etablissement',
          'denominationUsuelleEtablissement', 'libelleCommuneEtrangerEtablissement',
          'caractereEmployeurEtablissement'].map((k) => [k, ix[k]]))
        continue
      }
      const s = line.slice(0, 9)
      inc('etab lus')
      if (this.limit && c['etab lus'] >= this.limit) break
      if (s < prev) throw new Error(`Fichier établissements non trié par siren (${prev} puis ${s}) : jointure par fusion impossible`)
      prev = s
      if (cur === null) { if (this.limit) break; continue }
      if (s < cur[0]) continue
      while (cur !== null && cur[0] < s) { inc('UL sans siège trouvé'); cur = await nextUL() }
      if (cur === null || cur[0] !== s) continue
      const e = parse(line, { relax_column_count: true })[0] as string[]
      if (e.length !== head.length) { inc('lignes établissement mal formées'); continue }
      if (e[I.etablissementSiege] !== 'true') continue
      const [siren, nom, ei, date, tr, catent, naf, cj, ess, empUL, score] = cur
      let emp = empUL
      cur = await nextUL()
      if (e[I.statutDiffusionEtablissement] !== 'O') { inc('siège non diffusible'); continue }
      if (e[I.caractereEmployeurEtablissement] === 'O') emp = '1' // le champ de l'unité légale est vide
      const dep = departement(e[I.codeCommuneEtablissement])
      if (!DEPS.has(dep)) { inc('département inconnu'); continue }
      const t = cible(naf)!
      if (!nafs.has(naf)) nafs.set(naf, [nafs.size, t.libelle, CATEGORIES.indexOf(t.categorie)])
      const ni = nafs.get(naf)![0]
      const com = e[I.libelleCommuneEtablissement] || e[I.libelleCommuneEtrangerEtablissement]
      const cm = communes.get(dep) ?? communes.set(dep, new Map()).get(dep)!
      if (!cm.has(com)) cm.set(com, cm.size)
      const ens = e[I.enseigne1Etablissement] || e[I.denominationUsuelleEtablissement]
      const cp = e[I.codePostalEtablissement]
      const row = [Number(siren), nom, ens === nom ? '' : ens, Number(date.replaceAll('-', '') || 0), TR_IX.get(tr) ?? 0,
        Math.max(0, CATENT.indexOf(catent)), ni, cjSimple(cj), Number(ei) | (Number(ess) << 1) | (Number(emp) << 2),
        Number(score), /^\d+$/.test(cp) ? Number(cp) : 0, cm.get(com)]
      let f = files.get(dep)
      if (!f) {
        f = createWriteStream(dataPath(`dep_${dep}.json.tmp`), { encoding: 'utf-8' })
        files.set(dep, f)
        f.write('{"rows":[\n')
      } else f.write(',\n')
      if (!f.write(JSON.stringify(row))) await once(f, 'drain')
      depn.set(dep, (depn.get(dep) ?? 0) + 1)
      inc('retenues')
      // --- statistiques
      const cat = t.categorie, reg = DEPS.get(dep)![1], anc = anciennete(date), sc = Number(score)
      add('secteur', cat); add('region', reg)
      add('taille', TRANCHES[TR_IX.get(tr) ?? 0][1]); add('anciennete', anc)
      add('type', ei === '1' ? 'EI' : 'Société / personne morale')
      add('catent', catent || CATENT[0])
      add('score', `${Math.floor(sc / 10) * 10}-${Math.floor(sc / 10) * 10 + 9}`)
      if (date.slice(0, 4) >= '2019') add('annee', date.slice(0, 4))
      add('naf', `${naf} ${t.libelle}`)
      if (anc === '< 1 an' || anc === '1-2 ans') { add('secteur_recent2', cat); add('region_recent2', reg) }
      if (emp === '1') add('secteur_employeur', cat)
      if (sc >= 70) {
        add('secteur_score70', cat); add('region_score70', reg); add('score70_employeur', emp === '1' ? 'oui' : 'non')
      }
      if (sc >= 70 && emp === '1' && ei === '0') { add('coeur_secteur', cat); add('coeur_region', reg) }
      if (c['etab lus'] % 10_000_000 === 0) this.logger.info(`${c['etab lus']} ${c.retenues}`)
    }
    while (cur !== null) { inc('UL sans siège trouvé'); cur = await nextUL() }
    if (!this.limit && c.retenues <= 1_000_000) throw new Error('jointure quasi vide : format changé ?')

    for (const [dep, f] of files) {
      f.end(`\n],"communes":${JSON.stringify([...communes.get(dep)!.keys()])}}\n`)
      await once(f, 'finish')
      await rename(dataPath(`dep_${dep}.json.tmp`), dataPath(`dep_${dep}.json`))
    }
    const meta = {
      date: DATE_REF, cats: CATEGORIES, tranches: TRANCHES.map((t) => t[1]), catent: CATENT, cj: CJ,
      naf: [...nafs].map(([k, v]) => [k, v[1], v[2]]),
      deps: [...DEPS].filter(([d]) => depn.get(d)).map(([d, [n, r]]) => [d, n, r, depn.get(d)]),
    }
    await writeFile(dataPath('meta.json'), JSON.stringify(meta))
    const out: Record<string, unknown> = { compteurs: c }
    for (const [k, m] of st) out[k] = Object.fromEntries([...m].sort((a, b) => b[1] - a[1]))
    await writeFile(dataPath('stats.json'), JSON.stringify(out, null, 1))
    for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) this.logger.log(`${String(v).padStart(12)} ${k}`)
  }
}
