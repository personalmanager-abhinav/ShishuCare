import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import catalogue from '../src/generated/catalogue.json';
import { recommend } from '../src/lib/recommendations';
import { rankingMetrics } from '../src/lib/ranking-evaluation';
import type { Product } from '../src/lib/product';
const path = process.argv[2];
if (!path)
  throw new Error(
    'Pass a private JSON file of judged recommendation cases. No relevance labels are invented.',
  );
const ids = new Set(catalogue.products.map((p) => p.product_id));
const productId = z.string().refine((id) => ids.has(id), 'Unknown product in evaluation');
const schema = z
  .array(
    z
      .object({
        source_id: productId,
        relevant_ids: z.array(productId).min(1),
        recent_ids: z.array(productId).max(8).default([]),
        popularity: z.record(productId, z.number().int().min(0)).default({}),
      })
      .strict()
      .refine(
        (c) => !c.relevant_ids.includes(c.source_id),
        'Source product cannot be a recommendation label',
      ),
  )
  .min(1)
  .max(1000);
const cases = schema.parse(JSON.parse(await readFile(path, 'utf8')));
const results = cases.map((item) => {
  const baseline = recommend(catalogue.products as Product[], item.source_id).map(
    (r) => r.product.product_id,
  );
  const challenger = recommend(catalogue.products as Product[], item.source_id, {
    ranking: 'hybrid',
    recentIds: item.recent_ids,
    popularity: item.popularity,
  }).map((r) => r.product.product_id);
  return {
    source_id: item.source_id,
    baseline: { ids: baseline, ...rankingMetrics(baseline, item.relevant_ids) },
    challenger: { ids: challenger, ...rankingMetrics(challenger, item.relevant_ids) },
  };
});
const averages = Object.fromEntries(
  ['baseline', 'challenger'].map((key) => [
    key,
    Object.fromEntries(
      ['precision', 'recall', 'ndcg'].map((metric) => [
        metric,
        results.reduce(
          (sum, row) =>
            sum +
            Number(
              row[key as 'baseline' | 'challenger'][metric as 'precision' | 'recall' | 'ndcg'],
            ),
          0,
        ) / results.length,
      ]),
    ),
  ]),
);
await mkdir('work', { recursive: true });
await writeFile(
  'work/discovery-evaluation.json',
  JSON.stringify(
    {
      catalogue_version: catalogue.version,
      cutoff: 3,
      cases: results.length,
      averages,
      results,
      notice:
        'Offline judged relevance only. Small or biased label sets cannot establish uplift; experiments are never enabled by this command.',
    },
    null,
    2,
  ),
);
console.log(
  `Evaluated ${results.length} judged cases. Report: work/discovery-evaluation.json. No ranking or experiment settings changed.`,
);
