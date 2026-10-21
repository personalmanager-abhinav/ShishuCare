import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:8787';
const token = (await readFile('.dev.vars', 'utf8')).match(/LOCAL_ADMIN_TOKEN=(.+)/)[1].trim();
const headers = { 'Content-Type': 'application/json', Origin: base };
const post = (path, body, cookie) =>
  fetch(base + path, {
    method: 'POST',
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
assert.equal((await fetch(base + '/')).status, 200);
assert.equal((await fetch(base + '/internal/')).status, 401);
assert.equal((await fetch(base + '/internal/api/metrics')).status, 401);
assert.equal((await fetch(base + '/internal/api/health')).status, 401);
const initialMetrics = await (await fetch(base + '/internal/api/metrics', { headers: { Authorization: `Bearer ${token}` } })).json();
assert.equal(initialMetrics.timezone, 'Asia/Kolkata');
assert.match(initialMetrics.window.start, /T18:30:00.000Z$/);
assert.ok(Array.isArray(initialMetrics.health.warnings));
assert.equal(
  (await fetch(base + '/internal/', { headers: { Authorization: `Bearer ${token}` } })).status,
  200,
);
assert.equal(
  (
    await fetch(base + '/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{"q":"shirt"}',
    })
  ).status,
  403,
);
const search = await (await post('/api/search', { q: 'pink baby caps' })).json();
assert.deepEqual(search.product_ids, ['P101']);
assert.equal(search.fallback, true);
assert.deepEqual((await (await post('/api/search', { q: 'bule caps under 101' })).json()).product_ids, ['P101']);
assert.deepEqual((await (await post('/api/search', { q: 'bule caps under 100' })).json()).product_ids, []);
assert.equal((await post('/api/identity', { consent: false })).status, 400);
const identity = await post('/api/identity', { consent: true });
assert.equal(identity.status, 200);
const cookie = identity.headers.get('set-cookie').split(';')[0];
const event = {
  event_id: crypto.randomUUID(),
  event_type: 'product_view',
  occurred_at: new Date().toISOString(),
  session_id: crypto.randomUUID(),
  page_view_id: crypto.randomUUID(),
  page_path: '/products/caps/',
  product_id: 'P101',
  catalogue_version: 'integration',
  properties: { source_surface: 'product_detail' },
};
const metrics = async () => {
  const response = await fetch(base + '/internal/api/metrics?days=7', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  return response.json();
};
const before = await metrics();
assert.equal((await post('/api/events', { events: [event] }, cookie)).status, 200);
assert.equal((await post('/api/events', { events: [event] }, cookie)).status, 200);
const after = await metrics();
assert.equal(after.overview.product_views, (before.overview.product_views || 0) + 1);
assert.equal(
  (
    await post(
      '/api/events',
      {
        events: [
          { ...event, event_id: crypto.randomUUID(), properties: { source_surface: 'bad' } },
        ],
      },
      cookie,
    )
  ).status,
  400,
);
assert.equal(
  (
    await post(
      '/api/events',
      { events: [{ ...event, event_id: crypto.randomUUID(), product_id: 'missing' }] },
      cookie,
    )
  ).status,
  400,
);
assert.equal((await post('/api/delete-history', {}, cookie)).status, 202);
assert.equal((await metrics()).overview.product_views, before.overview.product_views || 0);
assert.equal((await post('/api/events', { events: [event] }, cookie)).status, 401);
console.log(
  'Integration checks passed: rendering, auth, origins, search, consent, deduplication, validation, deletion.',
);
