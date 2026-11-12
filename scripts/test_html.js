// Test sans navigateur : syntaxe du script de prospects.html + logique de filtre/tri/CSV sur un vrai fichier dep.
// usage : node scripts/test_html.js [dossier data] [département]
const fs = require('fs'), path = require('path'), assert = require('assert');
const base = path.join(__dirname, '..'), data = process.argv[2] || path.join(base, 'data'), dep = process.argv[3] || '2A';
const html = fs.readFileSync(path.join(base, 'prospects.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);                                    // erreur de syntaxe => exception
global.window = {};
for (const f of ['meta.js', `dep_${dep}.js`, `web_${dep}.js`].filter(f => fs.existsSync(path.join(data, f)))) new Function('window', fs.readFileSync(path.join(data, f), 'utf8'))(window);
const core = script.match(/\/\*CORE\*\/([\s\S]*?)\/\*END CORE\*\//)[1];
const {prep, applyFilters, sortRows, toCSV, fmtDate, opportunity} = new Function('window', core + ';return {prep,applyFilters,sortRows,toCSV,fmtDate,opportunity}')(window);
const M = window.META, D = window.DATA_DEP[dep];
assert(D.rows.length && D.rows.every(r => r.length === 12), 'lignes à 12 champs');
prep(dep, 20261112); prep(dep, 20261112);
assert(D.rows.every(r => typeof r[11] === 'string' && r[12] === dep && M.naf[r[6]] && M.tranches[r[4]] && M.cj[r[7]]));
const F0 = {oppMin: 0, web: '', video: '', q: '', cat: -1, naf: '', scoreMin: 0, cp: [], com: '', trMin: 0, trMax: 99, catent: -1, type: '', emp: -1, ess: -1, dFrom: 0, dTo: 0};
const all = applyFilters([dep], F0, M, 20261112);
assert.strictEqual(all.rows.length, D.rows.length);
assert.strictEqual(all.S.cat.reduce((a, b) => a + b), all.S.n);
assert.strictEqual(all.S.age.reduce((a, b) => a + b), all.S.n);
const run = o => applyFilters([dep], {...F0, ...o}, M, 20261112).rows;
const ei = run({type: 'ei'}), soc = run({type: 'soc'});
assert.strictEqual(ei.length + soc.length, D.rows.length);
assert(ei.every(r => r[8] & 1) && soc.every(r => !(r[8] & 1)));
assert(run({scoreMin: 70}).every(r => r[9] >= 70));
assert(run({dFrom: 20241112}).every(r => r[3] >= 20241112));
assert(run({emp: 1}).every(r => r[8] & 4) && run({ess: 0}).every(r => !(r[8] & 2)));
const r0 = D.rows[0], cp = String(r0[10]).padStart(5, '0');
assert(run({cp: [cp.slice(0, 3)]}).includes(r0) && run({com: r0[11].toLowerCase()}).includes(r0));
assert(run({q: r0[1].toLowerCase()}).includes(r0) && run({naf: M.naf[r0[6]][0].slice(0, 4)}).includes(r0));
assert(run({cat: M.naf[r0[6]][2]}).includes(r0) && !run({cat: (M.naf[r0[6]][2] + 1) % M.cats.length}).includes(r0));
assert(D.rows.every(r => r[14] >= 0 && r[14] <= 100), 'opportunité dans 0-100');
const rowB = [1, 'X', '', 20100101, 5, 1, 0, 2, 4, 90, 75001, 'P', dep];
const op = w => opportunity([...rowB, w], 20261112);
assert.strictEqual(op(null), 36 + 25 + 12 + 6);                                   // aucune présence connue
assert.strictEqual(op(['https://a.fr', '', '', 3, [0, 1, 7, 2026, 1, 1, 0, 9]]), 36 + 0 + 12 + 6);   // site moderne avec vidéo
assert.strictEqual(op(['http://a.fr', '', '', 3, [0, 0, 0, 2015, 0, 0, 7, 1]]), 36 + 40 + 12 + 6);                // site vieillissant
const nWeb = run({web: 'none'}).length, nSite = run({web: 'site'}).length, nLow = run({web: 'low'}).length;
assert(nWeb + nSite <= D.rows.length && nLow >= nWeb);
assert(run({video: 'non'}).every(r => r[13][4][0] === 0 && !r[13][4][1]) && run({video: 'inc'}).length + run({video: 'oui'}).length + run({video: 'non'}).length === D.rows.length);
assert(run({oppMin: 60}).every(r => r[14] >= 60));
sortRows(all.rows, 9, -1, M);
assert(all.rows.every((r, i, a) => !i || a[i - 1][9] >= r[9]), 'tri score décroissant');
const csv = toCSV(all.rows.slice(0, 50), M, {[dep]: 'R'}).split('\r\n');
assert(csv.every(l => l.split(';').length >= 30), 'colonnes CSV');
assert.strictEqual(csv.length, Math.min(51, all.rows.length + 1));
assert(toCSV([[1, '=1+1;"x"', '', 0, 0, 0, 0, 0, 0, 5, 0, 'C', dep, null, 0]], M, {}).includes(`"'=1+1;""x"""`), 'échappement CSV');
assert.strictEqual(fmtDate(20000926), '2000-09-26');
console.log(`OK ${dep}: ${D.rows.length} lignes, ${nSite} avec site connu, ${run({web: 'ana'}).length} sites analysés, ${D.communes.length} communes, ${M.naf.length} codes NAF`);
