import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const decline = page.getByRole('button', { name: 'No thanks' });
  if (await decline.isVisible()) await decline.click();

  await page.getByRole('link', { name: 'Caps', exact: true }).click();
  await page.getByRole('button', { name: /Make an offer/ }).click();
  await page.locator('#bargain-language').selectOption('en');
  await page.locator('#bargain-marketplace').selectOption('P101-amazon');
  await page.getByRole('button', { name: 'Begin chat' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#bargaining-chat')?.textContent?.includes('Hello!'),
  );
  assert.match(await page.locator('#bargaining-chat').innerText(), /Hello!/);

  await page.locator('#bargain-message-input').fill('₹50');
  await page.locator('#bargain-message-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() =>
    document.querySelector('#bargain-attempts')?.textContent?.startsWith('2'),
  );
  assert.match(await page.locator('#bargaining-chat').innerText(), /₹50/);
  assert.equal(await page.locator('#bargaining-coupon').isVisible(), false);

  await page.getByRole('button', { name: 'Close product details' }).click();
  await page.getByRole('link', { name: 'Caps', exact: true }).click();
  await page.getByRole('button', { name: /Make an offer/ }).click();
  await page.getByRole('button', { name: 'Begin chat' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#bargaining-status')?.textContent?.includes('Resumed'),
  );
  assert.match(await page.locator('#bargaining-status').innerText(), /Amazon/);
  assert.equal(await page.locator('#bargain-marketplace').inputValue(), 'P101-amazon');
  assert.match(await page.locator('#bargaining-chat').innerText(), /₹50/);
  assert.deepEqual(errors, []);
  console.log(
    'Bargaining browser checks passed: start, counter, private history resume, marketplace context and no coupon.',
  );
} finally {
  await browser.close();
}
