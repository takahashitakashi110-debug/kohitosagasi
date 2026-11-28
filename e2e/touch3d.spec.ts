import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true } });
test('touch-only walk, view, photograph and restore a framed print', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  if (info.project.name.includes('360')) await page.setViewportSize({ width: 640, height: 360 });
  const entry: string = info.project.metadata.entry ?? '/prototype3d.html';
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.status() + ' ' + r.url());
  });
  await page.goto(entry);
  await expect(page.locator('#prototype')).toHaveAttribute('data-mode', 'walk');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const pad = page.getByRole('group', { name: '移動スティック' });
  await expect(pad).toBeVisible();
  const session = await context.newCDPSession(page);
  const point = (id: number, x: number, y: number) => ({ id, x, y });
  const walkUntil = async (direction: 1 | -1, prompt: string, leave = false) => {
    const box = (await pad.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const start = point(1, x, y),
      move = point(1, x, y - direction * box.height * 0.43);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [move] });
      await page.waitForFunction(
        ({ prompt, leave }) =>
          Boolean(document.querySelector('.actions button')?.textContent?.includes(prompt)) !== leave,
        { prompt, leave },
        { polling: 'raf', timeout: 45000 },
      );
    } finally {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
  await button('走る').tap();
  await expect(button('走る')).toHaveAttribute('aria-pressed', 'true');
  await button('しゃがむ').tap();
  await expect(button('走る')).toHaveAttribute('aria-pressed', 'false');
  await button('しゃがむ').tap();

  // The left thumb can stay on the stick while the other finger pans and returns.
  const box = (await pad.boundingBox())!;
  const size = page.viewportSize()!;
  const left = point(1, box.x + box.width / 2, box.y + box.height / 2);
  const right = point(2, size.width * 0.68, size.height * 0.43);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [left, { ...right, x: right.x + 18 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [left, right] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await walkUntil(1, '葉の上の実を調べる');
  await page.locator('.actions button').tap();
  await button('葉の上の実を調べる').tap();
  await expect(page.locator('.message')).toContainText('殻の左右');
  await walkUntil(-1, '葉の上の実を調べる', true);
  await button('カメラ').tap();
  await expect(page.locator('#prototype')).toHaveAttribute('data-mode', 'camera');
  const zoom = page.locator('.zoom');
  const initialZoom = await zoom.textContent();
  await button('ズームイン').tap();
  await expect(zoom).not.toHaveText(initialZoom!);
  await button('ズームアウト').tap();
  await expect(zoom).toHaveText(initialZoom!);
  await page.touchscreen.tap(size.width * 0.55, size.height * 0.43);
  const pose = () => document.querySelector<HTMLElement>('.focus')?.dataset.sight === 'ecology';
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('.focus')?.dataset.sight !== 'ecology',
    null,
    { polling: 'raf', timeout: 25000 },
  );
  await page.waitForFunction(pose, null, { polling: 'raf', timeout: 25000 });
  const shutter = (await button('撮影').boundingBox())!;
  await page.touchscreen.tap(shutter.x + shutter.width / 2, shutter.y + shutter.height / 2);
  await expect(page.locator('.message')).toContainText('この一枚');
  await expect(page.locator('.save-state > span')).toHaveText('保存済み');
  await page.screenshot({ path: info.outputPath('mobile-camera.png') });
  await button('カメラ').tap();
  await walkUntil(-1, '自室でできること');
  await page.locator('.actions button').tap();
  await button('自室のフレーム').tap();
  await expect(pad).toBeHidden();
  await button('この写真を飾る').tap();
  const memo = 'スマホで見つけた。木の実を頬に。';
  await page.getByLabel('この写真の自由メモ').fill(memo);
  await page.getByLabel('仮説のしおり').selectOption('nuts');
  await expect(page.locator('.panel-save')).toHaveText('保存済み');
  const first = await printDetails(page);
  expect(first.bytes).toBeGreaterThan(5000);
  await page.reload();
  await button('観察手帳').tap();
  await expect(button('展示中')).toBeDisabled();
  await expect(page.locator('.thumb')).toHaveCount(1);
  await expect(page.getByLabel('この写真の自由メモ')).toHaveValue(memo);
  await expect(page.getByLabel('仮説のしおり')).toHaveValue('nuts');
  await expect(page.getByLabel('生態 記録あり')).toBeVisible();
  expect(await printDetails(page)).toEqual(first);
  await button('閉じる').tap();
  await expect(pad).toBeVisible();
  await page.screenshot({ path: info.outputPath('mobile-room-reloaded.png') });
  expect(errors).toEqual([]);
  await info.attach('mobile-print', {
    body: JSON.stringify({ url: page.url(), viewport: size, ...first }),
    contentType: 'application/json',
  });
});

async function printDetails(page: Page) {
  return page.locator('.print > img').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const data = await (await fetch(img.src)).arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', data);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      bytes: data.byteLength,
      hash: Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join(''),
    };
  });
}
