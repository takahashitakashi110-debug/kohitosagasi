import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function tap(page: Page, action: string): Promise<void> {
  await expect.poll(() => page.evaluate(a => window.__kohitoE2E?.buttons().some(b => b.action === a), action)).toBe(true);
  const point = await page.locator('#game').evaluate((canvas, a) => {
    const b = window.__kohitoE2E!.buttons().find(b => b.action === a)!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (b.x + b.w / 2) * r.width / 360, y: r.top + (b.y + b.h / 2) * r.height / 640 };
  }, action);
  await page.touchscreen.tap(point.x, point.y);
}

test('summer title and all four spots remain playable on a phone', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?e2e=1');
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('title');
  await page.screenshot({ path: info.outputPath('summer-title.png'), fullPage: true });
  await tap(page, 'start');
  for (const spot of ['shoutengai', 'kawazoi', 'danchi', 'ekimae']) {
    await tap(page, `spot:${spot}`);
    await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('field');
    await page.screenshot({ path: info.outputPath(`summer-${spot}.png`), fullPage: true });
    await tap(page, 'map');
    if (spot === 'ekimae') {
      // 4か所目は夜。既存ルールどおり帰宅して、翌朝の地図へ進む。
      await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('dayend');
      await tap(page, 'tomorrow');
    }
    await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('map');
  }
  expect(errors).toEqual([]);
});
