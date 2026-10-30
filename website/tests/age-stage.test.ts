import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesAgeStage } from '../src/lib/age-stage';
import { productSchema } from '../src/lib/catalogue';
import sample from '../data/products/P101.json';

test('Age shopping excludes unknown suitability and partial boundary overlaps', () => {
  const unknown = productSchema.parse(sample);
  assert.equal(matchesAgeStage(unknown, ''), true);
  assert.equal(matchesAgeStage(unknown, 'newborn'), false);
  const verified = productSchema.parse({ ...sample, age_suitability: {
    min_months: 3, max_months: 12, source: 'Manufacturer specification reviewed',
    verified_at: '2026-10-28T00:00:00Z',
  }});
  assert.equal(matchesAgeStage(verified, 'newborn'), false);
  assert.equal(matchesAgeStage(verified, '3-6'), true);
  assert.equal(matchesAgeStage(verified, '6-12'), true);
  assert.equal(matchesAgeStage(verified, '12-24'), false);
  assert.equal(matchesAgeStage(verified, 'invalid'), false);
  assert.equal(productSchema.safeParse({ ...sample, age_suitability: {
    min_months: 12, max_months: 3, source: 'Manufacturer specification reviewed',
    verified_at: '2026-10-28T00:00:00Z',
  }}).success, false);
});
