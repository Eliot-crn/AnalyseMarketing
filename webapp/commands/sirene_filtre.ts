import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { parse } from 'csv-parse'
import { filtreUL, UL_COLS, ulIndex } from '#lib/etape1'
import { dataPath, SRC_DIR, zipFirstEntry } from '#lib/io'

export default class SireneFiltre extends BaseCommand {
  static commandName = 'sirene:filtre'
  static description = 'Etape 1 : StockUniteLegale (zip, streaming) -> data/ul_retenues.tsv + stats_etape1.json'
  static options: CommandOptions = { startApp: false }

  @flags.string({ description: 'zip StockUniteLegale (défaut : ../stock-stockunitelegale-csv.zip, lecture seule)' })
  declare src: string

  @flags.number({ description: 'ne lire que les N premières lignes du zip (tests)' })
  declare limit: number

  async run() {
    const src = this.src ?? join(SRC_DIR, 'stock-stockunitelegale-csv.zip')
    const out = dataPath('ul_retenues.tsv')
    await mkdir(dataPath(), { recursive: true })
    const c: Record<string, number> = {}
    const inc = (k: string) => (c[k] = (c[k] ?? 0) + 1)
    const fo = createWriteStream(`${out}.tmp`, { encoding: 'utf-8' })
    const raw = await zipFirstEntry(src)
    const parser = raw.pipe(parse({ bom: true, relax_column_count: true }))
    let I: Record<string, number> | null = null
    fo.write(`${UL_COLS.join('\t')}\n`)
    for await (const row of parser as AsyncIterable<string[]>) {
      if (!I) { I = ulIndex(row); continue }
      inc('lues')
      const r = filtreUL(row, I)
      if ('skip' in r) inc(r.skip)
      else {
        if (!fo.write(`${r.cols.join('\t')}\n`)) await once(fo, 'drain')
        inc('retenues')
      }
      if (c.lues % 5_000_000 === 0) this.logger.info(`${c.lues} ${c.retenues ?? 0}`)
      if (this.limit && c.lues >= this.limit) { raw.destroy(); break }
    }
    fo.end()
    await once(fo, 'finish')
    if (!this.limit && (c.retenues ?? 0) <= 1_000_000) {
      this.exitCode = 1
      this.logger.error('trop peu de lignes retenues : format du fichier changé ?')
    } else {
      await rename(`${out}.tmp`, out)
      await writeFile(dataPath('stats_etape1.json'), JSON.stringify(c, null, 1))
    }
    for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) this.logger.log(`${String(v).padStart(12)} ${k}`)
  }
}
