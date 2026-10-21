import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base = 'http://127.0.0.1:8787';
const token = (await readFile('.dev.vars', 'utf8')).match(/LOCAL_ADMIN_TOKEN=(.+)/)[1].trim();
const common = {
  'Content-Type': 'application/json',
  Origin: base,
  'CF-Connecting-IP': '198.51.100.44',
};
const owner = { ...common, Authorization: `Bearer ${token}` };
const post = (path, body, cookie) =>
  fetch(base + path, {
    method: 'POST',
    headers: { ...common, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
assert.equal((await fetch(base + '/internal/api/insights')).status, 401);
assert.equal((await fetch(base + '/internal/api/inventory')).status, 401);
assert.equal((await post('/api/recommendations', { product_id: 'P999' })).status, 400);
assert.equal(
  (await post('/api/recommendations', { product_id: 'P101', recent_ids: Array(9).fill('P101') }))
    .status,
  400,
);
const anonymous = await (await post('/api/recommendations', { product_id: 'P101' })).json();
assert.equal(anonymous.request_id, null);
assert.equal(anonymous.items.length, 3);
assert.ok(anonymous.items.every((p) => p.product_id !== 'P101'));
assert.equal(
  (await (await post('/api/recommendations', { product_id: 'P101', max: 0 })).json()).items.length,
  0,
);
const identity = await post('/api/identity', { consent: true });
const cookie = identity.headers.get('set-cookie').split(';')[0];
const sku = `fixture-${crypto.randomUUID()}`;
try {
  const denied = await (
    await post('/api/recommendations', { product_id: 'P101', analytics_consent: false }, cookie)
  ).json();
  assert.equal(denied.request_id, null, 'A remaining cookie cannot override declined consent');
  const rec = await (
    await post('/api/recommendations', { product_id: 'P101', analytics_consent: true }, cookie)
  ).json();
  assert.ok(rec.request_id);
  assert.equal(rec.experiment_id, 'none');
  const event = {
    event_id: crypto.randomUUID(),
    event_type: 'recommendation_impression',
    occurred_at: new Date().toISOString(),
    session_id: crypto.randomUUID(),
    page_view_id: crypto.randomUUID(),
    page_path: '/products/caps/',
    product_id: rec.items[0].product_id,
    catalogue_version: rec.catalogue_version,
    properties: {
      recommendation_id: rec.request_id,
      model_version: rec.model_version,
      experiment_id: rec.experiment_id,
      variant: rec.variant,
      position: 1,
      placement: 'product_detail',
    },
  };
  assert.equal((await post('/api/events', { events: [event] }, cookie)).status, 200);
  assert.equal(
    (
      await post(
        '/api/events',
        { events: [{ ...event, event_id: crypto.randomUUID(), product_id: 'P101' }] },
        cookie,
      )
    ).status,
    400,
  );
  const insights = await (await fetch(base + '/internal/api/insights', { headers: owner })).json();
  assert.ok(insights.experiments.some((r) => r.model_version === rec.model_version));
  const stock = {
    source: 'Disposable local API fixture',
    observed_at: new Date().toISOString(),
    skus: [
      { sku, product_id: 'P101', variant: 'blue', stock_on_hand: 12, lead_days: 3, safety_days: 2 },
    ],
    sales: [],
  };
  const importStock = (body, origin = base) =>
    fetch(base + '/internal/api/inventory', {
      method: 'POST',
      headers: { ...owner, Origin: origin },
      body: JSON.stringify(body),
    });
  assert.equal((await importStock(stock, 'https://wrong.example')).status, 403);
  assert.equal((await importStock(stock)).status, 200);
  assert.equal((await importStock(stock)).status, 200);
  assert.equal(
    (await importStock({ ...stock, skus: [{ ...stock.skus[0], product_id: 'P102' }] })).status,
    400,
  );
  const report = await (await fetch(base + '/internal/api/inventory', { headers: owner })).json();
  assert.equal(report.items.find((s) => s.sku === sku).status, 'incomplete_sales');
  assert.equal(report.items.find((s) => s.sku === sku).reorder_units, null);
} finally {
  await post('/api/delete-history', {}, cookie);
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--command',
      `DELETE FROM sales_daily WHERE sku='${sku}'; DELETE FROM inventory_skus WHERE sku='${sku}';`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}
console.log(
  'Architecture API checks passed: anonymous recommendations, consent receipts, forged-context rejection, private insights, idempotent inventory, immutable mapping and history deletion.',
);
