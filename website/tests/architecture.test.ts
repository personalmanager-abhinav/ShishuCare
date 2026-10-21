import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { recommend, experimentVariant } from '../src/lib/recommendations';
import { inventoryImport, inventoryOutlook } from '../src/lib/inventory';
import { eventSchema } from '../src/lib/events';
import { sanitizeDatabase } from '../scripts/recovery-bundle';
import { discoveryInsights, importInventory, inventoryReport } from '../workers/insights';
import { validRecommendationEvent } from '../workers/recommendations';
import type { Env } from '../workers/types';
import type { Product } from '../src/lib/product';
import catalogue from '../src/generated/catalogue.json';
import { rankingMetrics } from '../src/lib/ranking-evaluation';
import storefrontWorker from '../workers/storefront-only';
import ownerWorker from '../workers/owner-only';
import publicWorker from '../workers/public';

const migrations = ['0001_initial.sql', '0002_reviews.sql', '0003_discovery_operations.sql']
  .map((f) => readFileSync(`db/migrations/${f}`, 'utf8'))
  .join('\n');
test('Ranking evaluation penalizes misses, position and duplicate recommendations', () => {
  assert.equal(rankingMetrics(['a', 'b', 'c'], ['a', 'b', 'c']).ndcg, 1);
  assert.equal(rankingMetrics(['a', 'a', 'a'], ['a', 'b', 'c']).precision, 1 / 3);
  assert.ok(rankingMetrics(['x', 'a', 'b'], ['a', 'b']).ndcg < 1);
  assert.equal(rankingMetrics([], ['a']).recall, 0);
});
test('Split Workers reject the other surface and monitor credentials cannot access reports', async () => {
  const { db, env } = database();
  env.MONITOR_TOKEN = 'm'.repeat(40);
  env.ASSETS = { fetch: async () => new Response('font') } as unknown as Env['ASSETS'];
  try {
    assert.equal(
      (await storefrontWorker.fetch(new Request('https://shop.example/internal/'), env)).status,
      404,
    );
    assert.equal(
      (await ownerWorker.fetch(new Request('https://owner.example/api/search'), env)).status,
      404,
    );
    assert.equal(
      (await ownerWorker.fetch(new Request('https://owner.example/fonts/poppins.css'), env)).status,
      200,
    );
    const health = await publicWorker.fetch(
      new Request('https://owner.example/internal/api/health', {
        headers: { Authorization: `Bearer ${env.MONITOR_TOKEN}` },
      }),
      env,
    );
    assert.equal(health.status, 503, 'Empty job history is an actionable monitor response');
    assert.equal(
      (
        await publicWorker.fetch(
          new Request('https://owner.example/internal/api/metrics', {
            headers: { Authorization: `Bearer ${env.MONITOR_TOKEN}` },
          }),
          env,
        )
      ).status,
      401,
    );
  } finally {
    db.close();
  }
});
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(migrations);
  const prepare = (sql: string, args: (string | number | null)[] = []): any => ({
    bind: (...values: (string | number | null)[]) => prepare(sql, values),
    all: async () => ({ results: db.prepare(sql).all(...args), success: true }),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => ({ meta: db.prepare(sql).run(...args), success: true }),
  });
  const env = {
    DB: {
      prepare,
      batch: async (statements: any[]) => {
        db.exec('BEGIN');
        try {
          const result = await Promise.all(statements.map((s) => s.run()));
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    },
  } as unknown as Env;
  return { db, env };
}
test('Recommendations exclude source, unavailable and archived products; hard budgets always win', () => {
  const products = structuredClone(catalogue.products) as Product[];
  products[1].status = 'archived';
  products[2].offers.forEach((o) => (o.availability = 'unavailable'));
  const results = recommend(products, 'P101', {
    filters: { max: 15000 },
    recentIds: ['P102'],
    ranking: 'hybrid',
    popularity: { P102: 99999 },
  });
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => !['P101', 'P102', 'P103'].includes(r.product.product_id)));
  assert.deepEqual(recommend(products, 'P101', { filters: { max: 0 } }), []);
  assert.deepEqual(recommend(products, 'missing'), []);
});
test('Recommendation ranking is deterministic; bounded session preference changes only eligible order', () => {
  const products = catalogue.products as Product[];
  assert.deepEqual(recommend(products, 'P101'), recommend(products, 'P101'));
  assert.equal(experimentVariant('00000000'), 'content');
  assert.equal(experimentVariant('00000001'), 'hybrid');
  assert.ok(recommend(products, 'P101', { recentIds: ['P104'], limit: 100 }).length <= 6);
});
test('Recommendation event schema rejects extra fields and invalid positions', () => {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: 'recommendation_click',
    occurred_at: new Date().toISOString(),
    session_id: crypto.randomUUID(),
    page_view_id: crypto.randomUUID(),
    page_path: '/products/caps/',
    product_id: 'P102',
    catalogue_version: 'v1',
    properties: {
      recommendation_id: crypto.randomUUID(),
      position: 1,
      model_version: 'v1',
      experiment_id: 'none',
      variant: 'content',
      placement: 'product_detail',
    },
  };
  assert.equal(eventSchema.safeParse(event).success, true);
  assert.equal(
    eventSchema.safeParse({ ...event, properties: { ...event.properties, position: 0 } }).success,
    false,
  );
  assert.equal(
    eventSchema.safeParse({ ...event, properties: { ...event.properties, visitor: 'forged' } })
      .success,
    false,
  );
});
test('Recommendation receipts reject wrong visitor, product, position and model', async () => {
  const { db, env } = database();
  try {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO recommendation_sets VALUES(?,?,?,?,?,?,?,?)').run(
      id,
      'v',
      'P101',
      'v1',
      'none',
      'content',
      '["P102"]',
      new Date().toISOString(),
    );
    const p = {
      recommendation_id: id,
      position: 1,
      model_version: 'v1',
      experiment_id: 'none',
      variant: 'content',
    };
    assert.equal(await validRecommendationEvent(env, 'v', 'P102', p), true);
    assert.equal(await validRecommendationEvent(env, 'other', 'P102', p), false);
    assert.equal(await validRecommendationEvent(env, 'v', 'P101', p), false);
    assert.equal(
      await validRecommendationEvent(env, 'v', 'P102', { ...p, model_version: 'v2' }),
      false,
    );
  } finally {
    db.close();
  }
});
test('Inventory baseline requires every completed day and fresh stock; returns never masquerade as sellable stock', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  const sku = {
    sku: 'caps-blue',
    product_id: 'P101',
    variant: 'blue',
    stock_on_hand: 4,
    lead_days: 5,
    safety_days: 2,
    observed_at: new Date(now).toISOString(),
    source: 'test',
  };
  const sales = Array.from({ length: 28 }, (_, i) => ({
    sku: sku.sku,
    day: new Date(Date.parse('2026-09-19') - (i + 1) * 86400000).toISOString().slice(0, 10),
    units_sold: 2,
    units_returned: 1,
  }));
  const r = inventoryOutlook(sku, sales, now);
  assert.equal(r.daily_units, 2);
  assert.equal(r.reorder_units, 10);
  assert.equal(r.days_of_cover, 2);
  assert.equal(inventoryOutlook(sku, sales.slice(1), now).daily_units, null);
  assert.equal(
    inventoryOutlook({ ...sku, observed_at: '2026-09-17T00:00:00Z' }, sales, now).status,
    'stale_stock',
  );
  assert.equal(
    inventoryImport.safeParse({
      source: 'test',
      observed_at: sku.observed_at,
      skus: [sku],
      sales: [],
    }).success,
    false,
    'Private import rejects unexpected fields',
  );
});
test('Inventory import is idempotent and refuses SKU reassignment, unknown variants and stale stock', async () => {
  const { db, env } = database();
  try {
    const input = {
      source: 'test',
      observed_at: new Date().toISOString(),
      skus: [
        {
          sku: 'test-cap',
          product_id: 'P101',
          variant: 'blue',
          stock_on_hand: 10,
          lead_days: 4,
          safety_days: 2,
        },
      ],
      sales: [
        {
          sku: 'test-cap',
          day: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
          units_sold: 2,
          units_returned: 0,
        },
      ],
    };
    assert.ok('ok' in (await importInventory(env, input)));
    assert.ok('ok' in (await importInventory(env, input)));
    assert.equal(db.prepare('SELECT COUNT(*) n FROM sales_daily').get()!.n, 1);
    assert.ok(
      'error' in
        (await importInventory(env, {
          ...input,
          skus: [{ ...input.skus[0], product_id: 'P102' }],
        })),
    );
    assert.ok(
      'error' in
        (await importInventory(env, {
          ...input,
          observed_at: new Date(Date.now() - 86400000).toISOString(),
        })),
    );
    assert.equal((await inventoryReport(env)).items[0].status, 'incomplete_sales');
  } finally {
    db.close();
  }
});
test('Insights count clicks only after a visible recommendation and deduplicate repeated events', async () => {
  const { db, env } = database();
  try {
    const receipt = crypto.randomUUID();
    const insert = (type: string, offset: number) =>
      db
        .prepare(
          'INSERT INTO events(event_id,event_type,occurred_at,received_at,visitor_id,session_id,page_view_id,page_path,product_id,catalogue_version,properties_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          crypto.randomUUID(),
          type,
          new Date(Date.now() + offset).toISOString(),
          new Date().toISOString(),
          'v',
          's',
          'p',
          '/',
          'P102',
          'v1',
          JSON.stringify({
            recommendation_id: receipt,
            experiment_id: 'test',
            variant: 'content',
            model_version: 'v1',
          }),
        );
    insert('recommendation_click', -10000);
    insert('recommendation_impression', -9000);
    insert('recommendation_impression', -8000);
    let result = await discoveryInsights(env);
    assert.equal(result.experiments[0].impressions, 1);
    assert.equal(result.experiments[0].clicked_impressions, 0);
    insert('recommendation_click', -1000);
    result = await discoveryInsights(env);
    assert.equal(result.experiments[0].clicked_impressions, 1);
  } finally {
    db.close();
  }
});
test('Full recovery preserves review/inventory schema and enforces both visitor and review deletion', () => {
  const now = Date.now(),
    time = new Date(now).toISOString();
  const sql =
    migrations +
    `INSERT INTO product_reviews VALUES('gone','P101','Parent','initial',4,'Good product','approved','${time}','hash','unverified',NULL);
    INSERT INTO product_reviews VALUES('kept','P101','Parent','initial',4,'Good product','approved','${time}','hash','unverified',NULL);
    INSERT INTO inventory_skus VALUES('cap','P101','blue',10,5,2,'${time}','test');`;
  const result = sanitizeDatabase(
    sql,
    { exported_at: time, visitors: ['v'], reviews: ['gone'] },
    now,
  );
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(result.sql);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM product_reviews').get()!.n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_skus').get()!.n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM review_deletions').get()!.n, 1);
    assert.equal(
      db.prepare('SELECT completed_at FROM deletion_requests').get()!.completed_at,
      null,
    );
    assert.throws(() => db.exec("UPDATE inventory_skus SET product_id='P102'"));
  } finally {
    db.close();
  }
});
