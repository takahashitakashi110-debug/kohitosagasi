import { test, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { buttonsOverlap } from '../tests/support/buttons';
import type { ButtonRect } from '../tests/support/buttons';

const SETTINGS = 'kohitosagasi.settings.v1';
const SAVE = 'kohitosagasi.save.v1';

async function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__kohitoE2E?.scene());
}
async function readButton(page: Page, action: string): Promise<ButtonRect> {
  await expect.poll(() => page.evaluate(action => window.__kohitoE2E?.buttons().some(b => b.action === action) ?? false, action)).toBe(true);
  const button = await page.evaluate(action => window.__kohitoE2E?.buttons().find(b => b.action === action), action);
  if (!button) throw new Error(`Missing button: ${action}`);
  return button;
}
async function tapButton(page: Page, action: string, lowerEdge = false): Promise<void> {
  const b = await readButton(page, action);
  const point = await page.locator('#game').evaluate((canvas, { b, lowerEdge }) => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (b.x + b.w / 2) * rect.width / 360,
      y: rect.top + (lowerEdge ? b.y + b.h - 2 : b.y + b.h / 2) * rect.height / 640 };
  }, { b, lowerEdge });
  await page.touchscreen.tap(point.x, point.y);
}
async function expectSeparated(page: Page): Promise<void> {
  const buttons = await page.evaluate(() => window.__kohitoE2E!.buttons());
  expect(buttons.length).toBeGreaterThan(1);
  for (let i = 0; i < buttons.length; i++) for (const b of buttons.slice(i + 1)) {
    expect(buttonsOverlap(buttons[i], b), `${buttons[i].action} overlaps ${b.action}`).toBe(false);
  }
}
async function screenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  errorLists.set(page, errors);
  // 新しいコンテキストに加え、各テストの初回読み込みで保存領域を明示的に空にする。
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?e2e=1');
  await expect.poll(() => scene(page)).toBe('title');
  await tapButton(page, 'start');
  await expect.poll(() => scene(page)).toBe('map');
  await tapButton(page, 'spot:kawazoi');
  await expect.poll(() => scene(page)).toBe('field');
  await readButton(page, 'toggle-sound');
});
const errorLists = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => { expect(errorLists.get(page) ?? []).toEqual([]); });

test('album lower edge opens album without changing mute', async ({ page }, info) => {
  await expectSeparated(page);
  const before = await page.evaluate(key => localStorage.getItem(key), SETTINGS);
  expect(before).toBeNull();
  await tapButton(page, 'album', true);
  await expect.poll(() => scene(page)).toBe('album');
  expect(await page.evaluate(key => localStorage.getItem(key), SETTINGS)).toBe(before);
  await screenshot(page, info, 'album-open');
});

test('mute taps change only mute and toggle back', async ({ page }, info) => {
  await expectSeparated(page);
  const before = await page.evaluate(key => localStorage.getItem(key), SAVE);
  expect(before).not.toBeNull();
  for (const muted of [true, false]) {
    await tapButton(page, 'toggle-sound');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.muted, SETTINGS)).toBe(muted);
    expect(await scene(page)).toBe('field');
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE)).toBe(before);
    await expectSeparated(page);
    await screenshot(page, info, muted ? 'muted' : 'unmuted');
  }
});
