import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { freshSave, KOHITO_IDS } from '../src/game/state';
import { KOHITO } from '../src/data/kohito';
import { buttonsOverlap } from '../tests/support/buttons';

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

test('bundled images reach field, camera, feedback, all album pages and ending', async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) remote.push(r.url()); });
  // Test-side observation only: the shipped game exposes no new mutable hooks.
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { __summerDraws: seen });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: [CanvasImageSource, ...number[]]) {
      const image = args[0];
      if (image instanceof HTMLImageElement) {
        const scene = window.__kohitoE2E?.scene() ?? '';
        const key = image.src.includes('kohitos-') ? `${scene}:${Math.floor(Number(args[2]) / 256)}:${Number(args[1]) > 4}`
          : image.src.includes('town-') ? `${scene}:town` : '';
        if (key && !seen.includes(key)) seen.push(key);
      }
      return Reflect.apply(original, this, args);
    };
  });
  const draws = () => page.evaluate(() => (window as unknown as { __summerDraws: string[] }).__summerDraws);
  const separated = async () => {
    const buttons = await page.evaluate(() => window.__kohitoE2E!.buttons());
    for (let i = 0; i < buttons.length; i++) for (const b of buttons.slice(i + 1))
      expect(buttonsOverlap(buttons[i], b), `${buttons[i].action} overlaps ${b.action}`).toBe(false);
  };
  await page.goto('/?e2e=1');
  await expect.poll(draws).toContain('title:town');
  await page.screenshot({ path: info.outputPath('loaded-summer-title.png'), fullPage: true });
  for (const [row, id] of KOHITO_IDS.entries()) {
    const save = freshSave();
    save.day = 3; save.location = KOHITO[id].spot; save.time = KOHITO[id].time;
    save.hints = KOHITO_IDS.filter(k => k !== 'tarejiri');
    await page.evaluate(save => { localStorage.clear(); localStorage.setItem('kohitosagasi.save.v1', JSON.stringify(save)); }, save);
    await page.reload(); await tap(page, 'continue');
    await expect.poll(draws).toContain(`field:${id === 'tarejiri' ? 6 : row}:false`);
    await separated();
    await page.screenshot({ path: info.outputPath(`loaded-${id}-field.png`), fullPage: true });
    if (id === 'haritsuki') {
      await page.keyboard.down('Shift'); await page.keyboard.down('w');
      await expect.poll(() => page.evaluate(() => window.__kohitoE2E!.buttons().some(b => b.action === 'camera'))).toBe(true);
      await page.keyboard.up('w'); await page.keyboard.up('Shift');
    }
    if (id === 'tarejiri') await expect.poll(draws, { timeout: 7000 }).toContain('field:5:false');
    await page.keyboard.down('Space');
    await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('camera');
    await expect.poll(draws).toContain(`camera:${row}:false`);
    await separated();
    await page.screenshot({ path: info.outputPath(`loaded-${id}-camera.png`), fullPage: true });
    await page.waitForTimeout(1250);
    await page.keyboard.up('Space');
    await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('kohitosagasi.save.v1')!).album[id]?.best.framing, id)).toBe('full');
    if (id === 'tarejiri') {
      await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('ending');
      await expect.poll(draws).toContain('ending:5:false');
      await expect.poll(draws).toContain('ending:5:true');
      await expect.poll(() => page.evaluate(() => window.__kohitoE2E!.buttons().some(b => b.action === 'album')), { timeout: 12000 }).toBe(true);
      for (let i = 0; i < 5; i++) await expect.poll(draws).toContain(`ending:${i}:false`);
      await page.screenshot({ path: info.outputPath('loaded-summer-ending.png'), fullPage: true });
    } else {
      await expect.poll(draws).toContain(`field:${row}:false`);
      await tap(page, 'close');
    }
    await tap(page, 'album');
    for (let i = 0; i < row; i++) await tap(page, 'next');
    await expect.poll(draws).toContain(`album:${row}:false`);
    await separated();
    await page.screenshot({ path: info.outputPath(`loaded-${id}-album.png`), fullPage: true });
  }
  expect(remote).toEqual([]); expect(errors).toEqual([]);
});

test('image failures keep the game playable with vector art', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/\/assets\/(kohitos-.*\.png|town-.*\.webp)$/, route => route.abort());
  await page.goto('/?e2e=1');
  await tap(page, 'start'); await tap(page, 'spot:kawazoi');
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E!.buttons().some(b => b.action === 'camera'))).toBe(true);
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('camera');
  await page.waitForTimeout(1250); await page.keyboard.up('Space');
  await tap(page, 'close'); await tap(page, 'album');
  await tap(page, 'next'); await tap(page, 'next');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kohitosagasi.save.v1')!).album.dobunozoki.best.framing)).toBe('full');
  await page.screenshot({ path: info.outputPath('summer-vector-fallback-album.png'), fullPage: true });
  expect(errors).toEqual([]);
});
