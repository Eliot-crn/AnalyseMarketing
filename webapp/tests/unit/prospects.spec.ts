import { test } from '@japa/runner'
import { applyFilters, F0, fmtDate, opportunity, prep, sortRows, toCSV } from '#lib/prospects'
import { parseQuery } from '#lib/search'
import type { DepData, Meta, Row } from '#lib/store'

// Port de scripts/test_html.js sur un jeu synthétique (le test d'origine lisait un vrai fichier dep).
const TODAY = 20261112
const M: Meta = {
  date: '2026-11-01',
  cats: ['Restauration', 'Immobilier', 'BTP'],
  tranches: ['NN', '0', '1-2', '3-5', '6-9', '10-19', '20-49'],
  catent: ['Non renseignée', 'PME'],
  cj: ['EI', 'SARL', 'SAS', 'SA', 'SNC', 'SC', 'Asso', 'Fond', 'Autre soc', 'Autre'],
  naf: [
    ['56.10A', 'Restauration traditionnelle', 0],
    ['68.31Z', 'Agences immobilières', 1],
    ['43.32A', 'Menuiserie', 2],
  ],
  deps: [['75', 'Paris', 'Île-de-France', 60]],
}
function fixture(): { D: DepData; W: Record<string, Row> } {
  const rows: Row[] = Array.from({ length: 60 }, (_, i) => [
    1000 + i,
    `ENTREPRISE ${i}`,
    i % 7 === 0 ? `ENSEIGNE ${i}` : '',
    20000101 + (i % 12) * 20000 + i * 100,
    i % 7,
    i % 2,
    i % 3,
    i % 10,
    (i % 4 === 0 ? 1 : 0) | (i % 5 === 0 ? 2 : 0) | (i % 3 === 0 ? 4 : 0),
    20 + ((i * 7) % 80),
    75001 + (i % 20),
    i % 2,
  ])
  return {
    D: { rows, communes: ['PARIS 1ER', 'PARIS 2E'] },
    W: {
      1002: ['https://a.fr', '', '', 3],
      1004: ['', 'https://www.facebook.com/x', '', 2],
      1006: ['https://b.fr', '', '', 1, [0, 0, 0, 2015, 0, 0, 7, 1]],
      1008: ['https://c.fr', '', '', 3, [0, 1, 7, 2026, 1, 1, 0, 9]],
    },
  }
}

test.group('prospects : filtre, score, tri, CSV (port de test_html.js)', () => {
  test('filtres cohérents', ({ assert }) => {
    const { D, W } = fixture()
    prep('75', D, W, TODAY)
    prep('75', D, W, TODAY) // idempotent
    assert.isTrue(
      D.rows.every(
        (r) =>
          r.length === 15 &&
          typeof r[11] === 'string' &&
          r[12] === '75' &&
          r[14] >= 0 &&
          r[14] <= 100
      )
    )
    const run = (o: Partial<typeof F0>) => applyFilters([D], { ...F0, ...o }, M, TODAY).rows
    const all = applyFilters([D], F0, M, TODAY)
    assert.equal(all.rows.length, 60)
    assert.equal(
      all.S.cat.reduce((a, b) => a + b),
      all.S.n
    )
    assert.equal(
      all.S.age.reduce((a, b) => a + b),
      all.S.n
    )
    const ei = run({ type: 'ei' })
    const soc = run({ type: 'soc' })
    assert.equal(ei.length + soc.length, 60)
    assert.isTrue(ei.every((r) => r[8] & 1) && soc.every((r) => !(r[8] & 1)))
    assert.isTrue(run({ scoreMin: 70 }).every((r) => r[9] >= 70))
    assert.isTrue(run({ dFrom: 20241112 }).every((r) => r[3] >= 20241112))
    assert.isTrue(
      run({ emp: 1 }).every((r) => r[8] & 4) && run({ ess: 0 }).every((r) => !(r[8] & 2))
    )
    const r0 = D.rows[0]
    assert.include(run({ cp: ['750'] }), r0)
    assert.include(run({ com: r0[11].toLowerCase() }), r0)
    assert.include(run({ q: r0[1].toLowerCase() }), r0)
    assert.include(run({ naf: '5610' }), r0)
    assert.include(run({ cat: 0 }), r0)
    assert.notInclude(run({ cat: 1 }), r0)
    assert.equal(run({ web: 'site' }).length, 3)
    assert.equal(run({ web: 'ana' }).length, 2)
    assert.equal(run({ web: 'none' }).length, 60 - 4)
    assert.equal(run({ video: 'oui' }).length, 1)
    assert.equal(
      run({ video: 'inc' }).length + run({ video: 'oui' }).length + run({ video: 'non' }).length,
      60
    )
    assert.isTrue(run({ oppMin: 60 }).every((r) => r[14] >= 60))
  })
  test('score opportunité', ({ assert }) => {
    const rowB = [1, 'X', '', 20100101, 5, 1, 0, 2, 4, 90, 75001, 'P', '75']
    const op = (w: unknown) => opportunity([...rowB, w], TODAY)
    assert.equal(op(null), 36 + 25 + 12 + 6) // aucune présence connue
    assert.equal(op(['https://a.fr', '', '', 3, [0, 1, 7, 2026, 1, 1, 0, 9]]), 36 + 0 + 12 + 6) // site moderne avec vidéo
    assert.equal(op(['http://a.fr', '', '', 3, [0, 0, 0, 2015, 0, 0, 7, 1]]), 36 + 40 + 12 + 6) // site vieillissant
  })
  test('tri et CSV', ({ assert }) => {
    const { D, W } = fixture()
    prep('75', D, W, TODAY)
    const all = applyFilters([D], F0, M, TODAY)
    sortRows(all.rows, 9, -1, M)
    assert.isTrue(all.rows.every((r, i, a) => !i || a[i - 1][9] >= r[9]))
    const csv = toCSV(all.rows.slice(0, 50), M, { 75: 'R' }).split('\r\n')
    assert.isTrue(csv.every((l) => l.split(';').length >= 30))
    assert.equal(csv.length, 51)
    assert.include(
      toCSV([[1, '=1+1;"x"', '', 0, 0, 0, 0, 0, 0, 5, 0, 'C', '75', null, 0]], M, {}),
      `"'=1+1;""x"""`
    )
    assert.equal(fmtDate(20000926), '2000-09-26')
  })
})

test.group('requêtes API', () => {
  test('parseQuery borne et valide', ({ assert }) => {
    const q = parseQuery({
      deps: '75,69',
      size: '99999',
      page: '-3',
      sort: 'x;y',
      dir: '1',
      cp: '75011, 692',
      scoreMin: 'abc',
      cat: '2',
    })
    assert.deepEqual(q.deps, ['75', '69'])
    assert.equal(q.size, 500)
    assert.equal(q.page, 0)
    assert.equal(q.sort, 14)
    assert.equal(q.dir, 1)
    assert.deepEqual(q.F.cp, ['75011', '692'])
    assert.equal(q.F.scoreMin, 0)
    assert.equal(q.F.cat, 2)
    assert.equal(parseQuery({ sort: 'cat' }).sort, 'cat')
  })
})
