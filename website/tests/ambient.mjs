import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
const base = 'http://127.0.0.1:8787';
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  await page.addInitScript(() => sessionStorage.setItem('shishu-brand-entry-v1', 'seen'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/mannpasand/?preview=ambient');
  await page.getByRole('button', { name: 'No thanks', exact: true }).click();
  const hero = page.locator('[data-ambient=mannpasand]');
  await page.waitForFunction(() =>
    document.querySelector('[data-ambient=mannpasand]').hasAttribute('data-running'),
  );
  assert.equal(await hero.getAttribute('aria-hidden'), 'true');
  assert.equal(await hero.evaluate((n) => getComputedStyle(n).pointerEvents), 'none');
  const initial = await hero.evaluate((n) => Number(getComputedStyle(n).opacity));
  const before = await page.locator('h1').boundingBox();
  await page.waitForFunction(
    () => { const style = getComputedStyle(document.querySelector('[data-ambient=mannpasand]')); return Number(style.opacity) >= Number(style.getPropertyValue('--ambient-opacity')) - 0.001; },
  );
  assert.ok(initial <= 0.72, 'entrance opacity remains bounded');
  assert.deepEqual(await page.locator('h1').boundingBox(), before, 'hero text never shifts');
  const motion = await hero
    .locator('.ambient-mote')
    .first()
    .evaluate((n) => getComputedStyle(n).transform);
  await page.screenshot({ path: 'work/ambient-home-desktop.png' });
  await page.waitForFunction(
    (prior) => getComputedStyle(document.querySelector('.ambient-mote')).transform !== prior,
    motion,
  );
  assert.equal(
    await page.locator('.product-grid [data-ambient], .product-image .ambient-mote').count(),
    0,
  );
  await page.setViewportSize({width:1440,height:300});
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-ambient=mannpasand]').hasAttribute('data-running') &&
      document.querySelector('[data-ambient=footer]').hasAttribute('data-running'),
  );
  assert.equal(
    await hero
      .locator('.ambient-mote')
      .first()
      .evaluate((n) => getComputedStyle(n).animationPlayState),
    'paused',
  );
  await page.screenshot({ path: 'work/ambient-footer.png' });
  // Emulate a background tab's visibility event without relying on headless focus.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.locator('[data-ambient][data-running]').count(), 0);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base);
  assert.equal(await page.locator('[data-ambient=hero]').count(), 0);
  await page.locator('#query').fill('blue baby caps');
  await page.locator('#search-form').evaluate((f) => f.requestSubmit());
  await page.waitForFunction(
    () => document.querySelector('#search-form').getAttribute('aria-busy') === 'false',
  );
  assert.equal(await page.locator('.product-card:visible').count(), 1);
  await page.getByRole('link', { name: 'Caps', exact: true }).click();
  assert.equal(await page.locator('#product-dialog').evaluate((n) => n.open), true);
  assert.equal(await page.locator('#dialog-offers .marketplace').count(), 3);
  assert.equal(
    await page.locator('#dialog-offers a').count(),
    0,
    'Demo marketplace offers remain disabled',
  );
  await page.locator('#product-dialog [data-save-product]').click();
  await page.keyboard.press('Escape');
  await page.locator('.mannpasand-link').click();
  assert.equal(await page.locator('.product-card:visible').count(), 1);
  await page.screenshot({ path: 'work/ambient-mannpasand-saved.png' });
  await page.getByRole('button', { name: 'Remove from Mannpasand', exact: true }).click();
  assert.equal(await page.locator('#mannpasand-empty').isVisible(), true);
  await page.screenshot({ path: 'work/ambient-mannpasand-empty.png' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/mannpasand/']) {
      await page.goto(base + path);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} no overflow ${width}`,
      );
      const dimensions = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      }));
      await page.addStyleTag({ content: '.ambient-particles {display:none!important}' });
      assert.deepEqual(
        await page.evaluate(() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
        })),
        dimensions,
        'no particle-induced horizontal/vertical overflow',
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/mannpasand/');
  await page.waitForFunction(
    () => { const style = getComputedStyle(document.querySelector('[data-ambient=mannpasand]')); return Number(style.opacity) >= Number(style.getPropertyValue('--ambient-opacity')) - 0.001; },
  );
  await page.screenshot({ path: 'work/ambient-home-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page.locator('[data-ambient=mannpasand]').evaluate((n) => getComputedStyle(n).display),
    'block',
  );
  assert.equal(
    await page
      .locator('.ambient-mote')
      .first()
      .evaluate((n) => getComputedStyle(n).animationName),
    'none',
  );
  await page.goto(base + '/mannpasand/');
  assert.equal(
    await page.locator('[data-ambient=mannpasand]').evaluate((n) => getComputedStyle(n).display),
    'block',
  );
  assert.deepEqual(errors, []);
  console.log(
    'Ambient checks passed: entrance, idle, offscreen/background pause, reduced motion, search/dialog/disabled marketplace offers, saved/empty Mannpasand, mobile/desktop overflow.',
  );
} finally {
  await browser.close();
}
