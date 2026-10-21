import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
const base = 'http://127.0.0.1:8787';
try {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'CF-Connecting-IP': '198.51.100.45' },
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [],
    batches = [],
    recommendations = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('/api/events')) batches.push(...JSON.parse(r.postData()).events);
    if (r.url().endsWith('/api/recommendations')) recommendations.push(JSON.parse(r.postData()));
  });
  await page.goto(base + '/products/caps/');
  await page.getByRole('button', { name: 'No thanks' }).click();
  const detail = page.locator('[data-recommendations][data-placement="product_detail"]');
  await detail.locator('a').first().waitFor();
  assert.equal(await detail.locator('a').count(), 3);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('shishu-session-preferences-v1')),
    null,
  );
  assert.ok(recommendations.every((r) => !r.personalize && r.recent_ids.length === 0));
  assert.equal(batches.length, 0);
  await page.goto(base + '/privacy/');
  await page.locator('#session-personalization').check();
  await page.goto(base + '/products/caps/');
  await page.waitForResponse((r) => r.url().endsWith('/api/recommendations'));
  await page.goto(base + '/products/socks/');
  await page.waitForResponse((r) => r.url().endsWith('/api/recommendations'));
  assert.ok(
    recommendations.some(
      (r) => r.personalize && r.recent_ids.includes('P101') && r.recent_ids.includes('P103'),
    ),
  );
  await page.goto(base + '/privacy/');
  await page.locator('#session-personalization').uncheck();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('shishu-session-preferences-v1')),
    null,
  );
  await page.locator('#privacy-settings').click();
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await page.goto(base + '/products/caps/');
  await page.waitForResponse((r) => r.url().endsWith('/api/recommendations'));
  await detail.locator('a').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  await detail.locator('a').first().click();
  await page.waitForTimeout(500);
  assert.ok(batches.some((e) => e.event_type === 'recommendation_impression'));
  assert.ok(batches.some((e) => e.event_type === 'recommendation_click'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(base + '/');
  await page.getByRole('link', { name: 'Caps', exact: true }).click();
  const modal = page.locator('#product-dialog [data-recommendations]');
  await modal.locator('a').first().waitFor();
  await modal.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/discovery-mobile.png' });
  const peer = await context.newPage();
  await peer.goto(base + '/privacy/');
  await peer.locator('#privacy-settings').click();
  const revoked = page.waitForRequest(r => r.url().endsWith('/api/recommendations') && JSON.parse(r.postData()).analytics_consent === false);
  await peer.getByRole('button', { name: 'No thanks' }).click();
  await revoked;
  await peer.close();
  await page.keyboard.press('Escape');
  await page.goto(base + '/privacy/');
  await page.locator('#delete-history').click();
  await page.waitForResponse((r) => r.url().endsWith('/api/delete-history'));
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('shishu-session-preferences-v1')),
    null,
  );
  assert.deepEqual(errors, []);
  const token = (await readFile('.dev.vars', 'utf8')).match(/LOCAL_ADMIN_TOKEN=(.+)/)[1].trim();
  const owner = await browser.newPage({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    viewport: { width: 1440, height: 900 },
  });
  await owner.goto(base + '/internal/insights');
  await owner.waitForFunction(() =>
    document.querySelector('#status').textContent.startsWith('Updated'),
  );
  await owner.screenshot({ path: 'work/discovery-owner.png' });
  const nojs = await browser.newPage({ javaScriptEnabled: false });
  await nojs.goto(base + '/products/caps/');
  assert.equal(await nojs.locator('[data-placement="product_detail"] .related-item').count(), 3);
  console.log(
    'Discovery browser checks passed: no-consent/no-JS browsing, explicit session preference, tracked visibility/clicks, modal/mobile layout, deletion and private reports.',
  );
} finally {
  await browser.close();
}
