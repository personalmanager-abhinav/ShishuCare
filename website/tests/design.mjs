import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8787/');
  await page.getByRole('button', { name: 'No thanks' }).click();
  assert.match(await page.locator('header .wordmark').innerText(), /Shi\s*shu care/);
  assert.equal(await page.locator('.boutique-hero').count(), 1);
  assert.equal(await page.locator('.cloud-edge').count(), 1);
  assert.equal(await page.locator('.boutique-deals .deal-card').count(), 2);
  assert.equal(await page.locator('.category-bubbles a').count(), 6);
  assert.equal(await page.locator('.service-ribbon > div').count(), 4);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'powder-sky');
  assert.match(
    await page.locator('.boutique-hero').evaluate((n) => getComputedStyle(n).backgroundImage),
    /linear-gradient/,
  );
  assert.equal(await page.locator('body').evaluate((n) => getComputedStyle(n).overflowX), 'clip');
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.getByRole('link', { name: 'Baby shawl', exact: true }).click();
  await page.locator('#product-dialog').evaluate(async (n) => {
    await Promise.all(n.getAnimations().map((a) => a.finished));
  });
  assert.equal(
    await page.locator('#product-dialog').evaluate((n) => n.scrollHeight > n.clientHeight),
    true,
  );
  assert.equal(
    await page
      .locator('#product-dialog')
      .evaluate((n) => getComputedStyle(n, '::-webkit-scrollbar').width),
    '8px',
  );
  assert.equal(
    await page
      .locator('#product-dialog')
      .evaluate((n) => getComputedStyle(n, '::-webkit-scrollbar-button').display),
    'none',
  );
  await page.screenshot({ path: 'work/product-modal-scrollbar.png' });
  await page.keyboard.press('Escape');
  console.log(
    'Design checks passed: boutique hero, clouds, deals, categories, service ribbon and slim modal scrollbar.',
  );
} finally {
  await browser.close();
}
