import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportingWindow } from '../workers/reporting';
import { QueryVectorCache } from '../workers/query-cache';
import { prepareRestore } from '../scripts/restore';
import { generateImages } from '../scripts/images';
import sharp from 'sharp';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import catalogue from '../src/generated/catalogue.json';
import type { Product } from '../src/lib/product';
import { search } from '../src/lib/search';

test('Known spelling mistakes preserve strict colour, negation, and budget constraints', () => {
  const products = catalogue.products as Product[];
  assert.deepEqual(search(products, 'bule caps under 101').products.map(p => p.product_id), ['P101']);
  assert.equal(search(products, 'bule caps under 100').products.length, 0);
  assert.equal(search(products, 'not bule caps').products.length, 0);
  assert.deepEqual(search(products, 'swadle').products.map(p => p.product_id), ['P107']);
});

test('India calendar windows cross UTC midnight and month/year boundaries', () => {
  assert.equal(reportingWindow(7, Date.parse('2026-01-01T00:00:00Z')).start, '2025-12-25T18:30:00.000Z');
  assert.equal(reportingWindow(7, Date.parse('2026-09-19T18:29:59Z')).start, '2026-09-12T18:30:00.000Z');
  assert.equal(reportingWindow(7, Date.parse('2026-09-19T18:30:00Z')).start, '2026-09-13T18:30:00.000Z');
  assert.throws(() => reportingWindow(100));
});
test('Vector cache expires, isolates versions, evicts least recently used, and copies vectors', () => {
  const cache = new QueryVectorCache(2, 100);
  cache.set('v1:q', [1, 2], 0);
  cache.set('v1:r', [3, 4], 0);
  const vector = cache.get('v1:q', 50)!;
  vector[0] = 99;
  cache.set('v1:s', [5, 6], 50);
  assert.equal(cache.get('v1:r', 50), undefined);
  assert.deepEqual(cache.get('v1:q', 50), [1, 2]);
  assert.equal(cache.get('v2:q', 50), undefined);
  assert.equal(cache.get('v1:q', 100), undefined);
});
test('Recovery removes deleted and expired events, deduplicates, strips query text and escapes SQL', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  const row = { event_id: 'one', visitor_id: 'kept', event_type: 'search', occurred_at: '2026-09-01T00:00:00Z', received_at: '2026-09-01T00:00:00Z', session_id: 'session', page_view_id: 'view', page_path: "/it's/", catalogue_version: 'v1', properties_json: JSON.stringify({ query: 'private', result_count: 1 }) };
  const result = prepareRestore([row, row, { ...row, event_id: 'two', visitor_id: 'deleted' }, { ...row, event_id: 'old', received_at: '2025-01-01T00:00:00Z' }], new Set(['deleted']), now);
  assert.equal(result.imported, 1);
  assert.equal(result.omitted, 2);
  assert.ok(!result.sql.includes('private'));
  assert.ok(result.sql.includes("/it''s/"));
  assert.ok(result.sql.includes('WHERE NOT EXISTS'));
  assert.ok(result.sql.includes('DELETE FROM visitors'));
  assert.throws(() => prepareRestore([{ ...row, properties_json: 'bad' }], new Set(), now));
});
test('Responsive images retain proportions, avoid upscaling, and hash source changes', async () => {
  await mkdir('work', { recursive: true });
  const directory = await mkdtemp('work/image-test-');
  await mkdir(`${directory}/images`);
  const file = `${directory}/images/test.png`;
  await sharp({ create: { width: 500, height: 600, channels: 3, background: '#c5dce8' } }).png().toFile(file);
  const product = { ...catalogue.products[0], images: [{ src: '/images/test.png', alt: 'Test photo' }], colour_variants: [] } as Product;
  const manifest = await generateImages([product], directory);
  const set = manifest['/images/test.png'].srcset;
  assert.match(set, /320w/);
  assert.match(set, /500w/);
  assert.ok(!set.includes('640w'));
  const src = set.split(' ')[0];
  const metadata = await sharp(await readFile(directory + src)).metadata();
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 384);
  assert.equal(metadata.format, 'webp');
  await sharp({ create: { width: 500, height: 600, channels: 3, background: '#edc1d4' } }).png().toFile(file);
  const changed = await generateImages([product], directory);
  assert.notEqual(changed['/images/test.png'].srcset, set);
});
