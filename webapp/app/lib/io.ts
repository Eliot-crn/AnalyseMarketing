import { createReadStream, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'
import yauzl from 'yauzl'

/** Racine de webapp (ou de build/ -> webapp) : la ou vivent data/ et le dossier parent du projet. */
function root(): string {
  let d = resolve(import.meta.dirname, '..', '..')
  if (basename(d) === 'build') d = dirname(d)
  return d
}
export const ROOT = root()
export const DATA = process.env.DATA_DIR ?? join(ROOT, 'data')
export const SRC_DIR = process.env.SRC_DIR ?? resolve(ROOT, '..') // zips SIRENE (lecture seule)
export const dataPath = (...p: string[]) => join(DATA, ...p)

/** Flux du premier fichier d'un zip (lecture en streaming, jamais en memoire). */
export function zipFirstEntry(zipPath: string): Promise<Readable> {
  return new Promise((ok, ko) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return ko(err)
      zip.once('entry', (e) =>
        zip.openReadStream(e, (err2, s) => (err2 ? ko(err2) : ok(s))))
      zip.readEntry()
    })
  })
}

export function lines(stream: Readable): AsyncIterable<string> {
  return createInterface({ input: stream, crlfDelay: Infinity })
}
export const fileLines = (path: string) => lines(createReadStream(path, { encoding: 'utf-8' }))
export const exists = existsSync

/** Ligne TSV ecrite avec QUOTE_NONE + escapechar "\" (comme csv.writer de Python). */
export const tsvEscape = (s: string) => s.replace(/[\\"]/g, '\\$&').replace(/[\t\r\n]/g, ' ')
export function tsvSplit(line: string): string[] {
  if (!line.includes('\\')) return line.split('\t')
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length) cur += line[++i]
    else if (ch === '\t') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}
