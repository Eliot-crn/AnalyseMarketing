import { appendFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { dataPath } from '#lib/io'
import type { Match } from '#lib/osm'
import { crawl, type Analyse } from '#lib/sites'
import { DEP_RE, loadDep, readJson } from '#lib/store'

const host = (u: string) => { try { return new URL(u).host.toLowerCase() } catch { return '' } }

export default class SitesAnalyse extends BaseCommand {
  static commandName = 'sites:analyse'
  static description = "Etape 4 : analyse de la page d'accueil des sites connus (fetch + cheerio, sans JS) -> data/web_XX.json"
  static options: CommandOptions = { startApp: false }

  @flags.array({ description: 'département (répétable)' })
  declare dep: string[]

  @flags.boolean({ description: 'tous les départements ayant un data/match_XX.json' })
  declare all: boolean

  @flags.number({ description: 'nb max de nouveaux sites à analyser par département (0 = rien télécharger, réécrit web_XX.json)', default: 300 })
  declare max: number

  async run() {
    let deps = this.dep ?? []
    if (this.all) deps = (await readdir(dataPath())).flatMap((f) => /^match_(.+)\.json$/.exec(f)?.[1] ?? []).sort()
    const bad = deps.find((d) => !DEP_RE.test(d))
    if (bad) { this.logger.error(`département invalide : ${bad}`); this.exitCode = 1; return }
    await mkdir(dataPath('web'), { recursive: true })
    const cachePath = dataPath('web', 'sites.jsonl')
    const cache = new Map<string, Analyse>()
    try {
      for (const l of (await readFile(cachePath, 'utf-8')).split('\n')) if (l) { const d = JSON.parse(l); cache.set(d.url, d.a) }
    } catch { /* pas encore de cache */ }
    const tot: Record<string, number> = {}
    for (const dep of deps) {
      const { match } = await readJson<{ match: Record<string, Match> }>(`match_${dep}.json`)
      if (this.max > 0) {
        const score = new Map((await loadDep(dep)).rows.map((r) => [String(r[0]), r[9] as number]))
        const seen = new Set([...cache.keys()].map(host))
        const todo: string[] = []
        // priorité : rapprochements sûrs puis meilleur score secteur
        const order = Object.entries(match).sort((a, b) => Number(a[1][3] < 2) - Number(b[1][3] < 2) || (score.get(b[0]) ?? 0) - (score.get(a[0]) ?? 0))
        for (const [, m] of order) {
          const dom = host(m[0])
          if (m[0] && dom && !cache.has(m[0]) && !seen.has(dom)) { seen.add(dom); todo.push(m[0]) }
        }
        todo.length = Math.min(todo.length, this.max)
        this.logger.info(`${dep}: ${todo.length} sites à analyser`)
        let n = 0
        await crawl(todo, (u, a) => {
          cache.set(u, a)
          appendFileSync(cachePath, `${JSON.stringify({ url: u, a })}\n`)
          if (++n % 25 === 0) this.logger.info(`  ${n}/${todo.length}`)
        })
      }
      const out = Object.fromEntries(Object.entries(match).map(([s, m]) => [s, cache.has(m[0]) ? [...m, cache.get(m[0])] : m]))
      await writeFile(dataPath(`web_${dep}.json`), JSON.stringify(out))
      const add = (k: string, n: number) => (tot[k] = (tot[k] ?? 0) + n)
      const vals = Object.values(out) as unknown[][]
      add('rapprochés OSM', vals.length)
      add('avec site web', vals.filter((v) => v[0]).length)
      for (const [k, s] of [['sites analysés OK', 0], ['sites bloqués', 1], ['sites en erreur', 2]] as const)
        add(k, vals.filter((v) => v.length > 4 && (v[4] as number[])[0] === s).length)
    }
    await writeFile(dataPath('stats_web.json'), JSON.stringify(tot, null, 1))
    for (const [k, v] of Object.entries(tot)) this.logger.log(`${String(v).padStart(10)} ${k}`)
  }
}
