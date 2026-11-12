import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { dataPath } from '#lib/io'
import { fetchOsm, matchDep } from '#lib/osm'
import { DEP_RE, loadDep } from '#lib/store'

export default class OsmOverpass extends BaseCommand {
  static commandName = 'osm:overpass'
  static description = 'Etape 3 : présence web via OpenStreetMap (Overpass, © contributeurs OSM, ODbL) -> data/osm/, data/match_XX.json'
  static options: CommandOptions = { startApp: false }

  @flags.array({ description: 'département (répétable : --dep=75 --dep=69)' })
  declare dep: string[]

  @flags.boolean({ description: 'tous les départements de data/' })
  declare all: boolean

  @flags.boolean({ description: 'ignorer le cache data/osm/' })
  declare force: boolean

  async run() {
    let deps = this.dep ?? []
    if (this.all) {
      deps = (await readdir(dataPath())).flatMap((f) => /^dep_(.+)\.json$/.exec(f)?.[1] ?? []).filter((d) => d !== '99').sort()
    }
    const bad = deps.find((d) => !DEP_RE.test(d))
    if (bad) { this.logger.error(`département invalide : ${bad}`); this.exitCode = 1; return }
    const tot: Record<string, number> = {}
    for (const dep of deps) {
      const osm = await fetchOsm(dep, this.force, (m) => this.logger.warning(m))
      if (!osm) { tot['départements en échec'] = (tot['départements en échec'] ?? 0) + 1; continue }
      const { stats: c, match } = matchDep(await loadDep(dep), osm)
      await writeFile(dataPath(`match_${dep}.json`), JSON.stringify({ stats: c, match }))
      for (const [k, v] of Object.entries(c)) tot[k] = (tot[k] ?? 0) + v
      this.logger.info(`${dep}: ${c['objets OSM']} objets OSM, ${c['rapprochés']} rapprochés (${c['rapprochés avec site web'] ?? 0} avec site)`)
    }
    await mkdir(dataPath(), { recursive: true })
    await writeFile(dataPath('stats_osm.json'), JSON.stringify(tot, null, 1))
    for (const [k, v] of Object.entries(tot).sort((a, b) => b[1] - a[1])) this.logger.log(`${String(v).padStart(10)} ${k}`)
  }
}
