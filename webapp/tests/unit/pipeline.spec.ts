import { test } from '@japa/runner'
import { filtreUL, ulIndex } from '#lib/etape1'
import { departement, DEPS } from '#lib/geo'
import { tsvEscape, tsvSplit } from '#lib/io'
import { cible, score } from '#lib/naf_cibles'
import { matchDep, norm, urlOk, type OsmData } from '#lib/osm'
import { analyse, robotsAllows } from '#lib/sites'
import { anciennete, cjSimple, CJ } from '#lib/sirene'

test.group('naf_cibles (port de _self_check)', () => {
  test('préfixe le plus long, exclusions, repli', ({ assert }) => {
    assert.equal(cible('56.10A')?.categorie, 'Restauration')
    assert.equal(cible('56.10A')?.base, 85)
    assert.equal(cible('56.10Z')?.base, 60) // repli sur la division
    assert.isNull(cible('59.11B'))
    assert.isNull(cible('74.20Z')) // concurrents
    for (const n of ['68.20B', '84.11Z', '64.20Z', '01.11Z', '']) assert.isNull(cible(n))
    assert.equal(cible('68.31Z')?.base, 85)
    assert.equal(cible('47.91B')?.base, 80)
    assert.equal(cible('47.26Z')?.base, 50)
  })
  test('score', ({ assert }) => {
    assert.equal(score(85, '2025-06-01', '12'), 100)
    assert.equal(score(50, '2010-01-01', 'NN'), 50)
    assert.equal(score(50, '', '00'), 50)
    assert.equal(score(50, '2023-10-31', '01'), 55)
  })
})

test.group('geo / sirene', () => {
  test('départements', ({ assert }) => {
    assert.equal(DEPS.size, 108)
    assert.equal(departement('2A004'), '2A')
    assert.equal(departement('97411'), '974')
    assert.equal(departement('75056'), '75')
    assert.equal(departement(''), '99')
    assert.equal(DEPS.get('2B')![1], 'Corse')
    assert.equal([...DEPS.keys()][0], '01') // ordre d'origine conservé
  })
  test('forme juridique et ancienneté', ({ assert }) => {
    assert.equal(CJ[cjSimple('5710')], 'SAS / SASU')
    assert.equal(cjSimple('9220'), 6)
    assert.equal(cjSimple('1000'), 0)
    assert.equal(anciennete('2026-06-01'), '< 1 an')
    assert.equal(anciennete('1990-01-01'), '> 20 ans')
    assert.equal(anciennete(''), 'inconnue')
  })
  test('TSV avec échappements', ({ assert }) => {
    const s = tsvEscape('A "B" \\ C\tD')
    assert.deepEqual(tsvSplit(`1\t${s}\t2`), ['1', 'A "B" \\ C D', '2'])
  })
})

test.group('étape 1 : filtre unités légales', () => {
  const header = [
    'siren',
    'statutDiffusionUniteLegale',
    'dateCreationUniteLegale',
    'prenomUsuelUniteLegale',
    'trancheEffectifsUniteLegale',
    'categorieEntreprise',
    'etatAdministratifUniteLegale',
    'nomUniteLegale',
    'nomUsageUniteLegale',
    'denominationUniteLegale',
    'denominationUsuelle1UniteLegale',
    'categorieJuridiqueUniteLegale',
    'activitePrincipaleUniteLegale',
    'nomenclatureActivitePrincipaleUniteLegale',
    'economieSocialeSolidaireUniteLegale',
    'caractereEmployeurUniteLegale',
  ]
  const I = ulIndex(header)
  const mk = (o: Record<string, string>) => header.map((h) => o[h] ?? '')
  const base: Record<string, string> = {
    siren: '123456789',
    statutDiffusionUniteLegale: 'O',
    dateCreationUniteLegale: '2025-06-01',
    trancheEffectifsUniteLegale: '12',
    categorieEntreprise: 'PME',
    etatAdministratifUniteLegale: 'A',
    denominationUniteLegale: 'LE BISTROT',
    categorieJuridiqueUniteLegale: '5710',
    activitePrincipaleUniteLegale: '56.10A',
    nomenclatureActivitePrincipaleUniteLegale: 'NAFRev2',
    economieSocialeSolidaireUniteLegale: 'N',
  }
  test('retenue : colonnes et score', ({ assert }) => {
    const r = filtreUL(mk(base), I)
    assert.deepEqual('cols' in r && r.cols, [
      '123456789',
      'LE BISTROT',
      0,
      '2025-06-01',
      '12',
      'PME',
      '56.10A',
      '5710',
      0,
      1,
      100,
    ])
  })
  test('exclusions', ({ assert }) => {
    const skip = (o: Record<string, string>) =>
      (filtreUL(mk({ ...base, ...o }), I) as { skip: string }).skip
    assert.equal(skip({ etatAdministratifUniteLegale: 'C' }), 'cessées')
    assert.equal(skip({ statutDiffusionUniteLegale: 'P' }), 'non diffusibles')
    assert.equal(
      skip({ nomenclatureActivitePrincipaleUniteLegale: 'NAFRev1' }),
      'NAF absent ou ancienne nomenclature'
    )
    assert.equal(
      skip({ categorieJuridiqueUniteLegale: '7210' }),
      'personnes publiques / copropriétés'
    )
    assert.equal(skip({ activitePrincipaleUniteLegale: '74.20Z' }), 'NAF hors cible ou exclu')
    assert.equal(skip({ denominationUniteLegale: '' }), 'sans nom')
  })
  test("entrepreneur individuel : prénom + nom d'usage", ({ assert }) => {
    const r = filtreUL(
      mk({
        ...base,
        categorieJuridiqueUniteLegale: '1000',
        prenomUsuelUniteLegale: 'ANNE',
        nomUniteLegale: 'X',
        nomUsageUniteLegale: 'DURAND',
      }),
      I
    )
    assert.equal('cols' in r && r.cols[1], 'ANNE DURAND')
    assert.equal('cols' in r && r.cols[2], 1)
  })
})

test.group('étape 3 : OSM', () => {
  test('norm / urlOk (asserts du script Python)', ({ assert }) => {
    assert.equal(norm("SARL Le Café de l'Église"), 'CAFEEGLISE')
    assert.equal(urlOk('javascript:alert(1)'), '')
    assert.equal(urlOk('www.x.fr'), 'https://www.x.fr')
    assert.equal(urlOk('monbar', 'https://www.facebook.com/'), 'https://www.facebook.com/monbar')
    assert.equal(urlOk('http://a.fr/"><script>'), '')
    assert.equal(urlOk('http://a.fr;http://b.fr'), 'http://a.fr')
  })
  test('rapprochement : SIRET (3), nom + CP (2), nom seul (1)', ({ assert }) => {
    const rows = [
      [111111111, 'BOULANGERIE DUPONT', '', 0, 0, 0, 0, 0, 0, 50, 69001, 0],
      [222222222, 'HOTEL DES ALPES', '', 0, 0, 0, 0, 0, 0, 50, 74000, 0],
      [333333333, 'GARAGE MARTIN', '', 0, 0, 0, 0, 0, 0, 50, 38000, 0],
    ]
    const osm: OsmData = {
      elements: [
        { tags: { 'name': 'x', 'ref:FR:SIRET': '11111111100012', 'website': 'dupont.fr' } },
        {
          tags: {
            'name': 'Hôtel des Alpes',
            'addr:postcode': '74000',
            'website': 'https://alpes.example',
          },
        },
        { tags: { 'name': 'Garage Martin', 'contact:facebook': 'garagemartin' } },
        { tags: { name: 'Inconnu SA', website: 'https://nope.example' } },
        { tags: { name: 'Sans lien' } },
      ],
    }
    const { match, stats } = matchDep({ rows, communes: ['LYON'] }, osm)
    assert.deepEqual(match['111111111'], ['https://dupont.fr', '', '', 3])
    assert.deepEqual(match['222222222'], ['https://alpes.example', '', '', 2])
    assert.deepEqual(match['333333333'], ['', 'https://www.facebook.com/garagemartin', '', 1])
    assert.equal(stats['rapprochés'], 3)
    assert.equal(stats['non rapprochés'], 1)
    assert.equal(stats['sans lien (SIRET seul)'], 1)
  })
})

test.group('étape 4 : analyse de sites', () => {
  test('asserts du script Python (sans rendu JS)', ({ assert }) => {
    assert.deepEqual(
      analyse(
        '<html><meta name="viewport" content="x"><iframe src="https://www.youtube.com/embed/x"></iframe>' +
          '<a href="https://www.facebook.com/a">f</a><script src="/js/jquery-1.7.2.min.js"></script>' +
          '<footer>&copy; 2012 - <b>2019</b> Ma boîte</footer><img><img><img></html>',
        'https://a.fr'
      ),
      [0, 1, 1, 2019, 1, 1, 1, 3]
    )
    assert.deepEqual(
      analyse('<table><table><table><table><embed src=a.swf> Copyright 2009', 'http://a.fr'),
      [0, 0, 0, 2009, 0, 0, 2 | 4 | 16, 0]
    )
  })
  test('robots.txt', ({ assert }) => {
    const t =
      'User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: AnalyseMarketing\nDisallow: /nobot\n'
    assert.isFalse(robotsAllows(t, '/nobot/page'))
    assert.isTrue(robotsAllows(t, '/private')) // le groupe de notre agent remplace "*"
    assert.isFalse(robotsAllows('User-agent: *\nDisallow: /\n', '/'))
    const g = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n'
    assert.isTrue(robotsAllows(g, '/private/ok/x'))
    assert.isFalse(robotsAllows(g, '/private/x'))
    assert.isTrue(robotsAllows('', '/'))
    assert.isTrue(robotsAllows('User-agent: *\nDisallow:\n', '/'))
  })
})
