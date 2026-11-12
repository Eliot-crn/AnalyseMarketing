import * as cheerio from 'cheerio'

export const UA = 'AnalyseMarketing-webapp/1.0 (analyse ponctuelle de page d\'accueil; respecte robots.txt)'
const BOT = 'analysemarketing'
const MAX_BYTES = 2_000_000
const SOCIAL = [/facebook\.com\//, /instagram\.com\//, /linkedin\.com\//, /tiktok\.com\//, /youtube\.com\/|youtu\.be\//, /(?:twitter|\/\/x|\.x)\.com\//]
const OLD_GEN = /joomla!? ?1\.|joomla!? ?2\.|wordpress [1-4]\.|drupal [4-7]\b|frontpage|dreamweaver|golive|iweb|spip [12]\.|prestashop 1\.[0-6]|microsoft|namo|webacappella|e-monsite/i
const VIDEO_IFRAME = /youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com|dailymotion\.com\/embed/

/** Analyse = [statut 0 ok / 1 bloqué / 2 erreur, vidéo, réseaux (bits fb1 ig2 in4 tt8 yt16 x32), année ©, mobile, https,
 *  vieillesse (bits jQuery<1.9 =1, Flash 2, tableaux 4, générateur ancien 8, <3 images 16), nb images] */
export type Analyse = number[]

export function analyse(html: string, url: string): Analyse {
  const $ = cheerio.load(html)
  const low = html.toLowerCase()
  const video = $('video').length > 0 ||
    $('iframe').toArray().some((e) => VIDEO_IFRAME.test(($(e).attr('src') ?? '').toLowerCase()))
  const hrefs = $('[href]').toArray().map((e) => ($(e).attr('href') ?? '').toLowerCase()).join(' ')
  const soc = SOCIAL.reduce((a, rx, i) => a + (rx.test(hrefs) ? 1 << i : 0), 0)
  const years: number[] = []
  for (const m of low.matchAll(/(?:©|&copy;|&#169;|copyright)(.{0,60})/gs))
    for (const y of m[1].replace(/<[^>]*>/g, ' ').match(/\b(?:19|20)\d\d\b/g) ?? []) years.push(Number(y))
  const year = Math.max(0, ...years.filter((y) => y >= 1995 && y <= 2027))
  const mobile = $('meta[name="viewport" i]').length > 0
  const jq = /jquery[-./@]?(?:v)?(\d+)\.(\d+)(?:\.\d+)?(?:\.min|\.slim)*\.js|jquery\/(\d+)\.(\d+)/.exec(low)
  const jv = jq ? jq.slice(1).filter(Boolean).map(Number) : null
  const gen = $('meta[name="generator" i]').attr('content')
  const nimg = $('img').length
  const old = (jv && (jv[0] < 1 || (jv[0] === 1 && jv[1] < 9)) ? 1 : 0)
    | (/\.swf\b|x-shockwave-flash/.test(low) ? 2 : 0)
    | ($('table').length >= 4 && $('div').length < 20 ? 4 : 0)
    | (gen && OLD_GEN.test(gen) ? 8 : 0) | (nimg < 3 ? 16 : 0)
  return [0, +video, soc, year, +mobile, +url.startsWith('https://'), old, nimg]
}

/** robots.txt (RFC 9309 simplifié) : groupe de notre agent sinon "*", plus long motif gagnant, Allow l'emporte à égalité. */
export function robotsAllows(txt: string, path: string): boolean {
  const groups: { agents: string[]; rules: [boolean, string][] }[] = []
  let last: string | null = null
  for (const raw of txt.split(/\r?\n/)) {
    const m = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(raw.replace(/#.*/, ''))
    if (!m) continue
    const k = m[1].toLowerCase()
    if (k === 'user-agent') {
      if (last !== 'ua') groups.push({ agents: [], rules: [] })
      groups.at(-1)!.agents.push(m[2].toLowerCase())
    } else if ((k === 'allow' || k === 'disallow') && groups.length) {
      if (m[2]) groups.at(-1)!.rules.push([k === 'allow', m[2]])
    }
    last = k === 'user-agent' ? 'ua' : k
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT.includes(a)))
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  let best: [boolean, number] = [true, -1]
  for (const [allow, pat] of rules) {
    const rx = new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`.replace(/\\\$$/, '$'))
    if (rx.test(path) && (pat.length > best[1] || (pat.length === best[1] && allow))) best = [allow, pat.length]
  }
  return best[0]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function readCapped(r: Response): Promise<string> {
  const chunks: Uint8Array[] = []
  let n = 0
  for await (const c of r.body as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(c); n += c.length
    if (n > MAX_BYTES) break
  }
  return Buffer.concat(chunks).toString('utf-8')
}
const get = (u: string, ms: number) =>
  fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, signal: AbortSignal.timeout(ms), redirect: 'follow' })

/** Une seule page (accueil) ; robots.txt d'abord. [1] = bloqué (robots ou 401/403/429/503), [2] = erreur. */
export async function fetchSite(u: string): Promise<Analyse> {
  try {
    const url = new URL(u)
    if (!/^https?:$/.test(url.protocol)) return [2]
    const rb = await get(`${url.origin}/robots.txt`, 10_000)
    if (rb.status >= 500) { await rb.body?.cancel(); return [1] } // RFC 9309 : robots.txt indisponible => on s'abstient
    if (rb.ok && !robotsAllows((await readCapped(rb)).slice(0, 500_000), url.pathname + url.search)) return [1]
    if (!rb.ok) await rb.body?.cancel()
    const r = await get(u, 25_000)
    if (r.status >= 400) { await r.body?.cancel(); return [[401, 403, 429, 503].includes(r.status) ? 1 : 2] }
    if (!/html|xml/i.test(r.headers.get('content-type') ?? 'text/html')) { await r.body?.cancel(); return [2] }
    return analyse(await readCapped(r), r.url || u)
  } catch { return [2] }
}

/** n domaines en parallèle au plus, pause entre deux requêtes d'un même worker. */
export async function crawl(urls: string[], onDone: (u: string, a: Analyse) => void, workers = 4, delayMs = 1000) {
  const q = [...urls]
  await Promise.all(Array.from({ length: Math.min(workers, q.length) }, async () => {
    for (let u = q.shift(); u; u = q.shift()) {
      onDone(u, await fetchSite(u))
      await sleep(delayMs)
    }
  }))
}
