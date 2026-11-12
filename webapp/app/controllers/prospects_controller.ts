import type { HttpContext } from '@adonisjs/core/http'
import { toCSV } from '#lib/prospects'
import { MAX_CSV, parseQuery, search } from '#lib/search'
import { loadMeta, readJson } from '#lib/store'

const NO_DATA = "Données absentes : lancez les commandes du pipeline (voir README) pour produire data/meta.json et data/dep_XX.json."

export default class ProspectsController {
  async meta({ response }: HttpContext) {
    try { return await loadMeta() } catch { return response.status(503).send({ error: NO_DATA }) }
  }

  async list({ request, response }: HttpContext) {
    const q = parseQuery(request.qs())
    try {
      const { rows, S } = await search(q)
      const pages = Math.max(1, Math.ceil(rows.length / q.size))
      const page = Math.min(q.page, pages - 1)
      return { S, page, pages, rows: rows.slice(page * q.size, (page + 1) * q.size) }
    } catch (e) {
      return response.status(e instanceof Error && e.message.includes('ENOENT') ? 503 : 400).send({ error: (e as Error).message })
    }
  }

  async csv({ request, response }: HttpContext) {
    try {
      const { M, rows } = await search(parseQuery(request.qs()))
      const regOf = Object.fromEntries(M.deps.map((d) => [d[0], d[2]]))
      response.header('Content-Type', 'text/csv; charset=utf-8')
      response.header('Content-Disposition', 'attachment; filename="prospects.csv"')
      response.header('X-Truncated', String(rows.length > MAX_CSV))
      return toCSV(rows.slice(0, MAX_CSV), M, regOf)
    } catch (e) {
      return response.status(400).send({ error: (e as Error).message })
    }
  }

  async stats({ response }: HttpContext) {
    try { return await readJson('stats.json') } catch { return response.status(503).send({ error: NO_DATA }) }
  }
}
