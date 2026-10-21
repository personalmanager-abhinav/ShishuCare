import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8787/');
  await page.getByRole('button', { name: 'No thanks' }).click();
  assert.match(await page.locator('header .wordmark').innerText(), /Shi\s*shu care/);
  assert.match(await page.locator('.promotion-bar').innerText(), /10% off[\s\S]*MOTHERSBLESSING/);
  assert.equal(await page.locator('.discovery-arrows, .hero').count(), 0);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'powder-sky');
  assert.match(await page.locator('body').evaluate(n => getComputedStyle(n).backgroundImage), /svg/);
  const activeTheme = await page.locator('html').getAttribute('data-theme');
  const warm = await page.evaluate(() => getComputedStyle(document.documentElement).color);
  await page.evaluate(() => document.documentElement.dataset.theme = 'green-original');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).color), 'rgb(35, 59, 50)');
  await page.evaluate(theme => document.documentElement.dataset.theme = theme, activeTheme);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).color), warm);
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.getByRole('link', { name: 'Baby shawl', exact: true }).click();
  await page.locator('#product-dialog').evaluate(async n => { await Promise.all(n.getAnimations().map(a => a.finished)); });
  assert.equal(await page.locator('#product-dialog').evaluate(n => n.scrollHeight > n.clientHeight), true);
  assert.equal(await page.locator('#product-dialog').evaluate(n => getComputedStyle(n, '::-webkit-scrollbar').width), '8px');
  assert.equal(await page.locator('#product-dialog').evaluate(n => getComputedStyle(n, '::-webkit-scrollbar-button').display), 'none');
  await page.screenshot({ path: 'work/product-modal-scrollbar.png' });
  await page.keyboard.press('Escape');
  console.log('Design checks passed: brand, coupon, catalogue-first layout, doodle background, reversible palette, slim scrollbar without buttons.');
} finally { await browser.close(); }
