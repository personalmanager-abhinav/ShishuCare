import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of [1440, 390, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8787/?preview=brand-entry');
    await page.waitForSelector('.brand-entrance');
    for (const time of [0, 900, 1500, 1750, 2450, 3000]) {
      await page.evaluate(
        (t) =>
          document
            .querySelector('.brand-entrance')
            .getAnimations({ subtree: true })
            .forEach((a) => {
              a.pause();
              a.currentTime = t;
            }),
        time,
      );
      if (width !== 768 && [0, 1500, 2450, 3000].includes(time))
        await page.screenshot({ path: `work/entry-${width}-${time}.png` });
    }
    const delta = await page.evaluate(() => {
      const a = document.querySelector('.brand-entrance .brand-name').getBoundingClientRect(),
        b = document.querySelector('.site-header .brand-name').getBoundingClientRect();
      return { x: a.x - b.x, y: a.y - b.y, width: a.width - b.width, height: a.height - b.height };
    });
    assert.ok(
      Object.values(delta).every((n) => Math.abs(n) < 1),
      JSON.stringify(delta),
    );
    await page.evaluate(() =>
      document
        .querySelector('.brand-entrance')
        .getAnimations({ subtree: true })
        .forEach((a) => a.play()),
    );
    await page.waitForSelector('.brand-entrance', { state: 'detached' });
    assert.equal(await page.locator('[inert]').count(), 0);
    assert.equal(
      await page
        .locator('.site-header .brand-name')
        .evaluate((n) => getComputedStyle(n).visibility),
      'visible',
    );
    assert.equal(
      await page
        .locator('.site-header .brand-blue-dot')
        .evaluate((n) => getComputedStyle(n).backgroundColor),
      'rgb(43, 143, 214)',
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-brand-intro'), null);
    await page.locator('.mannpasand-link').click();
    await page.locator('header .wordmark').click();
    assert.equal(await page.locator('html').getAttribute('data-brand-intro'), null);
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const scenario of ['reduced', 'internal', 'keyboard', 'resize', 'nojs', 'storage']) {
    const context = await browser.newContext({
      reducedMotion: scenario === 'reduced' ? 'reduce' : 'no-preference',
      javaScriptEnabled: scenario !== 'nojs',
    });
    const page = await context.newPage();
    if (scenario === 'storage')
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
          throw new Error('blocked');
        };
      });
    await page.goto('http://127.0.0.1:8787/' + (scenario === 'internal' ? 'products/caps/' : ''));
    if (scenario === 'internal') await page.locator('header .wordmark').click();
    if (scenario === 'keyboard' || scenario === 'resize') {
      await page.waitForSelector('.brand-entrance');
      if (scenario === 'keyboard') await page.keyboard.press('Tab');
      else await page.setViewportSize({ width: 390, height: 844 });
    }
    if (scenario !== 'nojs')
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-brand-intro'), null, { timeout: 3000 });
    assert.equal(await page.locator('html').getAttribute('data-brand-intro'), null, scenario);
    assert.equal(await page.locator('[inert]').count(), 0, scenario);
    assert.equal(await page.locator('.brand-entrance').count(), 0, scenario);
    await context.close();
  }
  console.log(
    'Entrance verified: dot timeline, subpixel handoff at desktop/tablet/mobile, blue final dot, session/refresh/internal return, reduced motion, keyboard/resize exit, no JS, storage failure, no overflow/errors.',
  );
} finally {
  await browser.close();
}
