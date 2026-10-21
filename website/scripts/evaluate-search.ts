import { readFile, mkdir, writeFile } from 'node:fs/promises';
import catalogue from '../src/generated/catalogue.json';
import { search, eligible } from '../src/lib/search';
import type { Product } from '../src/lib/product';

type Case = { query: string; expected_ids: string[] };
const fileIndex = process.argv.indexOf('--cases');
const cases: Case[] = fileIndex >= 0
  ? JSON.parse(await readFile(process.argv[fileIndex + 1], 'utf8'))
  : catalogue.products.flatMap(p => ['', 'pink ', 'blue ', 'cream '].flatMap(colour => [
      { query: `${colour}${p.name}`, expected_ids: [p.product_id] },
      { query: `${colour}${p.name} under 1`, expected_ids: [] },
    ]));
if (!Array.isArray(cases) || !cases.length || !cases.every(c => typeof c.query === 'string' && Array.isArray(c.expected_ids) && c.expected_ids.every(id => typeof id === 'string'))) throw new Error('Cases must contain query and expected_ids');
const endpointIndex = process.argv.indexOf('--endpoint');
const endpoint = endpointIndex >= 0 ? new URL(process.argv[endpointIndex + 1]) : undefined;
if (process.argv.includes('--require-semantic') && !endpoint) throw new Error('--require-semantic requires --endpoint');
const products = catalogue.products as Product[];
const results = [];
for (const item of cases) {
  const start = performance.now();
  const local = search(products, item.query);
  let ids = local.products.map(p => p.product_id), fallback = true;
  if (endpoint) {
    const response = await fetch(new URL('/api/search', endpoint), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: endpoint.origin }, body: JSON.stringify({ q: item.query }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Search evaluation HTTP ${response.status}`);
    const result = await response.json();
    ids = result.product_ids;
    fallback = result.fallback;
  }
  const expected = new Set(item.expected_ids);
  const relevant = ids.filter(id => expected.has(id)).length;
  const constraints = ids.every(id => { const p = products.find(p => p.product_id === id); return p && eligible(p, local.filters); });
  const pass = constraints && ids.length === expected.size && relevant === expected.size && (!process.argv.includes('--require-semantic') || !item.query.trim() || !fallback);
  results.push({ ...item, actual_ids: ids, pass, constraints, fallback, elapsed_ms: Math.round(performance.now() - start) });
}
await mkdir('work', { recursive: true });
await writeFile('work/search-evaluation.json', JSON.stringify({ catalogue_version: catalogue.version, mode: endpoint ? 'api' : 'local', results }, null, 2));
const failed = results.filter(r => !r.pass);
console.log(`${results.length - failed.length}/${results.length} search cases passed. Report: work/search-evaluation.json. Demo cases do not establish real-world or multilingual relevance.`);
if (failed.length) process.exitCode = 1;
