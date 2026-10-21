import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || undefined,
});
await mkdir('work', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
const sentEvents = [];
page.on('request', (request) => {
  if (request.url().endsWith('/api/events'))
    sentEvents.push(...(JSON.parse(request.postData() || '{}').events || []));
});
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
assert.match(
  await page.locator('body').evaluate((node) => getComputedStyle(node).fontFamily),
  /Poppins/,
);
assert.equal(await page.locator('header nav').getByRole('link', { name: 'How to buy' }).count(), 0);
assert.equal(await page.locator('.product-card:visible').count(), 7);
await page.getByRole('button', { name: 'No thanks' }).click();
await page.locator('#query').fill('pink baby caps');
await page.locator('#search-form').evaluate((form) => form.requestSubmit());
await page.waitForFunction(
  () => document.querySelector('#search-form').getAttribute('aria-busy') === 'false',
);
assert.equal(await page.locator('.product-card:visible').count(), 1);
await page.getByRole('button', { name: 'Clear filters' }).click();
await page.waitForFunction(
  () => document.querySelector('#search-form').getAttribute('aria-busy') === 'false',
);
await page.screenshot({ path: 'work/storefront-desktop.png', fullPage: true });
await page.locator('.product-card[data-product="P101"]').hover();
await page.waitForFunction(
  () =>
    new DOMMatrixReadOnly(
      getComputedStyle(document.querySelector('.product-card[data-product="P101"]')).transform,
    ).a > 1.01,
);
await page.screenshot({ path: 'work/product-hover.png' });
await page.getByRole('link', { name: 'Caps', exact: true }).click();
assert.equal(new URL(page.url()).pathname, '/');
assert.equal(await page.locator('#product-dialog').evaluate((dialog) => dialog.open), true);
assert.equal(await page.locator('#dialog-title').textContent(), 'Caps');
assert.equal(await page.locator('#photo-counter').textContent(), '1 / 1');
assert.equal(await page.getByRole('button', {name:'Next photo'}).isVisible(),false);
await page.locator('#dialog-colours').getByRole('button',{name:'blue',exact:true}).click();
assert.match(await page.locator('#dialog-image').getAttribute('src'), /blue/);
await page.keyboard.press('ArrowRight');
assert.match(await page.locator('#dialog-image').getAttribute('src'), /blue/);
assert.equal(await page.locator('a[data-offer]').count(), 0);
await page.locator('#product-dialog').evaluate(async (dialog) => {
  await Promise.all(
    dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
  );
});
await page.screenshot({ path: 'work/product-modal-desktop.png' });
for (let i = 0; i < 10; i++) {
  await page.keyboard.press('Tab');
  assert.ok(
    await page.evaluate(() =>
      document.querySelector('#product-dialog').contains(document.activeElement),
    ),
  );
}
await page.keyboard.press('Escape');
assert.equal(await page.locator('#product-dialog').evaluate((dialog) => dialog.open), false);
assert.equal(
  await page.evaluate(() => document.activeElement?.getAttribute('data-product-open')),
  'P101',
);
await page.getByRole('link', { name: 'Baby shawl', exact: true }).click();
assert.equal(await page.locator('#photo-counter').textContent(), '1 / 1');
assert.equal(await page.getByRole('button', { name: 'Next photo' }).isVisible(), false);
await page.mouse.click(2, 2);
assert.equal(await page.locator('#product-dialog').evaluate((dialog) => dialog.open), false);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${baseUrl}/`);
await page.screenshot({ path: 'work/storefront-mobile.png', fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  'Mobile should not overflow',
);
await page.getByRole('link', { name: 'Caps', exact: true }).click();
await page.locator('#product-dialog').evaluate(async (dialog) => {
  await Promise.all(
    dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
  );
});
await page.screenshot({ path: 'work/product-modal-mobile.png' });
assert.ok(
  await page
    .locator('#product-dialog')
    .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
);
await page.locator('#dialog-colours').getByRole('button',{name:'cream',exact:true}).click();
assert.equal(await page.locator('#photo-counter').textContent(), '1 / 1');
await page.locator('#dialog-offers').scrollIntoViewIfNeeded();
assert.ok(await page.locator('#dialog-offers .marketplace').last().isVisible());
assert.ok(
  await page.locator('.dialog-close').evaluate((button) => {
    const b = button.getBoundingClientRect();
    const d = document.querySelector('#product-dialog').getBoundingClientRect();
    return b.top >= d.top && b.bottom <= d.bottom;
  }),
  'Close control stays visible while modal is scrolled',
);
await page.screenshot({ path: 'work/product-modal-mobile-buy.png' });
await page.getByRole('button', { name: 'Close product details' }).click();
await page.getByRole('button', { name: 'Cookie preferences' }).click();
await page.getByRole('button', { name: 'Allow analytics' }).click();
await page.getByRole('link', { name: 'Caps', exact: true }).click();
await page.keyboard.press('Escape');
await page.getByRole('link', { name: 'Caps', exact: true }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(4500);
const productViews = sentEvents.filter((event) => event.event_type === 'product_view');
assert.equal(productViews.length, 2, 'One product view per modal opening, only after consent');
assert.equal(new Set(productViews.map((event) => event.page_view_id)).size, 2);
await page.goto(`${baseUrl}/privacy/`);
await page.getByRole('button', { name: 'Delete this browser’s history' }).click();
await page.waitForFunction(() => document.querySelector('#delete-status').textContent.length > 0);
assert.match(await page.locator('#delete-status').textContent(), /deleted|No stored history/);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(`${baseUrl}/categories/accessories/`);
await page.locator('.product-card[data-product="P101"]').hover();
assert.equal(
  await page
    .locator('.product-card[data-product="P101"]')
    .evaluate((card) => getComputedStyle(card).transform),
  'none',
);
await page.getByRole('link', { name: 'Caps', exact: true }).click();
assert.equal(await page.locator('#product-dialog').evaluate((dialog) => dialog.open), true);
assert.equal(new URL(page.url()).pathname, '/categories/accessories/');
await page.keyboard.press('Escape');
const token = (await readFile('.dev.vars', 'utf8')).match(/LOCAL_ADMIN_TOKEN=(.+)/)[1].trim();
await page.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${baseUrl}/internal/`);
await page.waitForFunction(() =>
  document.querySelector('#status').textContent.startsWith('Updated'),
);
await page.screenshot({ path: 'work/dashboard-desktop.png', fullPage: true });
assert.deepEqual(errors, []);
await browser.close();
console.log(
  'Browser checks passed: Poppins, navigation, search, modal carousel, focus trapping/restoration, Escape/backdrop dismissal, colour previews, mobile modal, consent, deletion, dashboard; no JS errors.',
);
