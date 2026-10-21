import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalogue from './fixtures/legacy-catalogue.json';
import { search, parseQuery, cosine } from '../src/lib/search';
import { validateCatalogue, price, type Product } from '../src/lib/catalogue';
import { batchSchema, redact } from '../src/lib/events';
const products = catalogue.products as Product[];
const cases: [string, string[]][] = [
  ['black shirt', ['P001']],
  ['white linen shirt', ['P002']],
  ['blue tee', ['P003']],
  ['canvas tote', ['P004']],
  ['black crossbody', ['P005']],
  ['ceramic mug', ['P006']],
  ['cotton cushion', ['P007']],
  ['green scarf', ['P008']],
  ['shirt under 800', ['P001']],
  ['shirt under 799', []],
  ['shirt up to 799', ['P001']],
  ['shirt between 799 and 800', ['P001']],
  ['shirt above 799', ['P002']],
  ['shirt at least 1199', ['P002']],
  ['shirt over 1199', []],
  ['shirt below 500', []],
  ['not black shirt', ['P002']],
  ['white shirt under 800', []],
  ['linen summer shirt', ['P002']],
  ['cotton summer shirt', ['P001']],
  ['mug under 400', ['P006']],
  ['mug under 399', []],
  ['mug up to 399', ['P006']],
  ['mug between 200 and 399', ['P006']],
  ['canvas bag under 600', ['P004']],
  ['black bag under 800', []],
  ['black bag under 900', ['P005']],
  ['green summer scarf', ['P008']],
  ['scarf up to 349', ['P008']],
  ['scarf under 349', []],
  ['cushion up to 449', ['P007']],
  ['cushion under 449', []],
  ['ceramic shirt', []],
  ['purple spaceship', []],
  ['linen mug', []],
  ['black scarf', []],
  ['show me something casual for summer under 800', ['P001', 'P008']],
  ['cotton tee under 500', ['P003']],
  ['tote up to 599', ['P004']],
  ['tote under 599', []],
];
for (const [query, expected] of cases)
  test(`Search: ${query}`, () =>
    assert.deepEqual(
      search(products, query)
        .products.map((p) => p.product_id)
        .sort(),
      [...expected].sort(),
    ));
test('explicit budget cannot relax query budget', () =>
  assert.ok(
    search(products, 'under 500', { max: 100000 }).products.every((p) => price(p)! < 50000),
  ));
test('semantic retrieval cannot override a budget', () =>
  assert.equal(
    search(
      products,
      'shirt under 100',
      {},
      Object.fromEntries(products.map((p) => [p.product_id, [1, 0]])),
      [1, 0],
    ).products.length,
    0,
  ));
test('cosine compares vectors correctly', () => {
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
});
test('money parser handles decimal amounts', () =>
  assert.equal(parseQuery('under ₹799.50').max, 79950));
test('duplicate identities are rejected', () =>
  assert.throws(() => validateCatalogue([products[0], products[0]])));
test('unapproved marketplace host is rejected', () => {
  const p = structuredClone(products[0]);
  p.offers[0].url = 'https://evil.example';
  assert.throws(() => validateCatalogue([p]));
});
test('private product fields rejected', () =>
  assert.throws(() => validateCatalogue([{ ...products[0], supplier_cost: 100 }])));

test('local optional video is accepted, external video paths are rejected', () => {
  assert.equal(
    validateCatalogue([{ ...products[0], video: { src: '/videos/P001.mp4' } }])[0].video?.src,
    '/videos/P001.mp4',
  );
  assert.throws(() =>
    validateCatalogue([{ ...products[0], video: { src: 'https://example.com/private.mp4' } }]),
  );
});

test('popup offer event placement is accepted', () => {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: 'marketplace_click',
    occurred_at: new Date().toISOString(),
    session_id: crypto.randomUUID(),
    page_view_id: crypto.randomUUID(),
    page_path: '/',
    catalogue_version: 'v1',
    product_id: 'P001',
    marketplace_id: 'amazon',
    properties: {
      offer_id: 'P001-amazon',
      placement: 'product_modal',
      interaction_id: crypto.randomUUID(),
    },
  };
  assert.ok(batchSchema.safeParse({ events: [event] }).success);
});
test('search text is redacted', () =>
  assert.equal(redact('email me a@example.com or +91 9876543210'), 'email me [email] or [number]'));
test('arbitrary analytics properties rejected', () =>
  assert.equal(
    batchSchema.safeParse({
      events: [
        {
          event_id: crypto.randomUUID(),
          event_type: 'page_view',
          occurred_at: new Date().toISOString(),
          session_id: crypto.randomUUID(),
          page_view_id: crypto.randomUUID(),
          page_path: '/',
          catalogue_version: 'v1',
          properties: { page_type: 'home', password: 'bad' },
        },
      ],
    }).success,
    false,
  ));
