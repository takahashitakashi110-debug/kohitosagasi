import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Photo, Record3D } from '../src/prototype3d/rules';

const url = '/prototype3d.html';
const dbName = 'kohitosagasi-3d-p0-v1';
const btn = (p: Page, name: string) => p.getByRole('button', { name, exact: true });
const act = (p: Page, name: string) => btn(p, 'E　' + name);
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (e) => list.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') list.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) list.push(r.status() + ' ' + r.url());
  });
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4173/')) list.push(r.url());
  });
  await page.goto(url);
  await expect(page.locator('#prototype')).toHaveAttribute('data-mode', 'walk');
});
test.afterEach(async ({ page }, info) => {
  const list = errors.get(page) ?? [];
  await info.attach('browser-errors', { body: JSON.stringify(list), contentType: 'application/json' });
  expect(list).toEqual([]);
});

async function walk(p: Page, key: string, until: Locator) {
  await p.keyboard.down(key);
  try {
    await until.waitFor({ state: 'visible', timeout: 40000 });
  } finally {
    await p.keyboard.up(key);
  }
}
async function investigate(p: Page) {
  await walk(p, 'w', act(p, '葉の上の実を調べる'));
  await p.keyboard.press('e');
  await btn(p, '葉の上の実を調べる').click();
  await expect(p.locator('.message')).toContainText('殻の左右');
}
async function home(p: Page) {
  await walk(p, 's', act(p, '自室でできること'));
}
async function book(p: Page) {
  await btn(p, '観察手帳').click();
  await expect(p.getByRole('dialog')).toBeVisible();
}
async function shoot(p: Page, sight: 'encounter' | 'ecology') {
  // Shoot through the normal left mouse binding while the rendered finder shows the desired pose.
  const mark = p.locator('.focus[data-sight="' + sight + '"]');
  await expect(mark).toBeVisible({ timeout: 25000 });
  const size = p.viewportSize()!;
  await p.mouse.click(size.width / 2, size.height / 2);
  await expect(p.locator('.save-state')).toContainText('保存済み');
}
async function screenshot(p: Page, info: TestInfo, name: string) {
  await p.screenshot({ path: info.outputPath(name + '.png') });
}

async function saved(p: Page) {
  return p.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(['journal', 'photos']);
    const a = tx.objectStore('journal').get('world'),
      b = tx.objectStore('photos').getAll();
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
    const photos = await Promise.all(
      (b.result as Photo[])
        .sort((x, y) => x.created - y.created)
        .map(async (photo) => {
          const digest = await crypto.subtle.digest('SHA-256', await photo.imageBlob.arrayBuffer());
          return {
            id: photo.id,
            hash: Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''),
            bytes: photo.imageBlob.size,
            width: photo.width,
            height: photo.height,
            behavior: photo.capturedBehaviorId,
            view: photo.cameraTransform,
            evidence: photo.evidenceGranted,
          };
        }),
    );
    return { record: a.result as Record3D | undefined, photos };
  }, dbName);
}
async function printPixels(p: Page) {
  return p.locator('.print > img').evaluate(async (node: HTMLImageElement) => {
    await node.decode();
    const blob = await (await fetch(node.src)).blob();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
      (n) => n.toString(16).padStart(2, '0'),
    ).join('');
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 24;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(node, 0, 0, 40, 24);
    return { hash, pixels: Array.from(ctx.getImageData(0, 0, 40, 24).data) };
  });
}
// Compare sampled RGBs on the 3D frame in an actual page screenshot with the selected JPEG.
async function wallError(p: Page, id: string) {
  const { width, height } = p.viewportSize()!;
  const camera = new PerspectiveCamera(64, width / height, 0.055, 90);
  camera.position.set(0, 1.52, 7.55);
  camera.rotation.set(-0.115, 0, 0, 'YXZ');
  camera.updateMatrixWorld();
  const scale = Math.min(1.43 / width, 0.82 / height);
  const points = [];
  for (let row = 1; row <= 6; row++)
    for (let col = 1; col <= 11; col++) {
      const u = col / 12,
        v = row / 7;
      const q = new Vector3(
        -2.22 + (u - 0.5) * width * scale,
        1.46 + (0.5 - v) * height * scale,
        4.142,
      ).project(camera);
      points.push({ x: Math.round(((1 + q.x) * width) / 2), y: Math.round(((1 - q.y) * height) / 2), u, v });
    }
  const screenshot = (await p.screenshot()).toString('base64');
  return p.evaluate(
    async ({ screenshot, points, id, name }) => {
      const db = await new Promise<IDBDatabase>((res) => {
        const q = indexedDB.open(name);
        q.onsuccess = () => res(q.result);
      });
      const photo = await new Promise<Photo>((res) => {
        const q = db.transaction('photos').objectStore('photos').get(id);
        q.onsuccess = () => res(q.result);
      });
      db.close();
      const wall = new Image();
      wall.src = 'data:image/png;base64,' + screenshot;
      await wall.decode();
      const print = await createImageBitmap(photo.imageBlob);
      const pixels = (img: HTMLImageElement | ImageBitmap) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        return ctx;
      };
      const a = pixels(wall),
        b = pixels(print);
      let difference = 0;
      for (const { x, y, u, v } of points) {
        const wallRGB = a.getImageData(x, y, 1, 1).data;
        const printRGB = b.getImageData(Math.round(u * print.width), Math.round(v * print.height), 1, 1).data;
        for (let k = 0; k < 3; k++) difference += Math.abs(wallRGB[k] - printRGB[k]);
      }
      print.close();
      return difference / (3 * points.length);
    },
    { screenshot, points, id, name: dbName },
  );
}

async function exportPrint(p: Page, info: TestInfo, name: string) {
  const waiting = p.waitForEvent('download');
  await p.locator('.print > img').evaluate((img: HTMLImageElement, n) => {
    const a = document.createElement('a');
    a.href = img.src;
    a.download = n;
    a.click();
  }, name);
  await (await waiting).saveAs(info.outputPath(name));
}

test('walk, photograph two compositions, select either print and restore the exact journal', async ({
  page: p,
}, info) => {
  const memo = '頬の左右が、ちょっと光った。\n同じ実かな？ <葉>　';
  await p.evaluate(() => {
    localStorage.setItem('kohitosagasi.save.v1', 'legacy-save-sentinel');
    localStorage.setItem('kohitosagasi.settings.v1', 'legacy-settings-sentinel');
  });
  await screenshot(p, info, '01-room');
  await investigate(p);
  await screenshot(p, info, '02-trace');
  const canvas = p.locator('#view');
  await canvas.click({ button: 'right', position: { x: 320, y: 270 } });
  await shoot(p, 'encounter');
  await expect
    .poll(async () => (await saved(p)).photos.map((x) => x.evidence))
    .toEqual([{ encounter: true, ecology: false }]);
  await p.mouse.move(480, 285);
  await p.mouse.wheel(0, -120);
  await p.mouse.wheel(0, -120);
  await p.locator('.focus[data-sight=ecology]').waitFor({ timeout: 25000 });
  await screenshot(p, info, '03-gesture');
  await shoot(p, 'ecology');
  await expect.poll(async () => (await saved(p)).photos.length).toBe(2);
  const before = await saved(p);
  const [one, two] = before.photos;
  expect(before.record).toMatchObject({ ecologySeen: true, trustEventSeen: false, dayPart: 'morning' });
  expect(one.hash).not.toBe(two.hash);
  expect(one.view.fov).not.toBe(two.view.fov);
  expect(two.behavior).toBe('cheek');
  expect(one.bytes).toBeGreaterThan(5000);
  expect(two.bytes).toBeGreaterThan(5000);
  expect([one.width, one.height]).toEqual([p.viewportSize()!.width, p.viewportSize()!.height]);
  await p.keyboard.press('Escape');
  await home(p);
  await p.keyboard.press('e');
  await btn(p, '自室のフレーム').click();
  await btn(p, 'この写真を飾る').click();
  await expect.poll(async () => (await saved(p)).record?.framePhotoId).toBe(two.id);
  const secondPrint = await printPixels(p);
  expect(secondPrint.hash).toBe(two.hash);
  await exportPrint(p, info, 'cheek.jpg');
  await p.getByRole('button', { name: /^写真 1 / }).click();
  await btn(p, 'この写真を飾る').click();
  const firstPrint = await printPixels(p);
  expect(firstPrint.hash).toBe(one.hash);
  expect(new Set(firstPrint.pixels).size).toBeGreaterThan(75);
  const changed = firstPrint.pixels.filter((v, i) => Math.abs(v - secondPrint.pixels[i]) > 12).length;
  expect(changed).toBeGreaterThan(firstPrint.pixels.length * 0.05);
  await exportPrint(p, info, 'portrait.jpg');
  await p.getByLabel('この写真の自由メモ').fill(memo);
  await p.getByLabel('仮説のしおり').selectOption('nuts');
  await expect
    .poll(async () => (await saved(p)).record?.notes[one.id])
    .toEqual({ memoText: memo, hypothesisId: 'nuts' });
  await screenshot(p, info, '04-exhibited');
  await p.reload();
  await expect(p.locator('#prototype')).toHaveAttribute('data-mode', 'walk');
  await expect(p.locator('.location')).toHaveText('自室');
  let wallRgbError = Infinity;
  await expect.poll(async () => (wallRgbError = await wallError(p, one.id))).toBeLessThan(12);
  await screenshot(p, info, '05-room-reloaded');
  await book(p);
  await expect(btn(p, '展示中')).toBeDisabled();
  await expect(p.getByLabel('この写真の自由メモ')).toHaveValue(memo);
  await expect(p.getByLabel('仮説のしおり')).toHaveValue('nuts');
  const reopened = await printPixels(p);
  expect(reopened).toEqual(firstPrint);
  const after = await saved(p);
  expect(after.photos).toEqual(before.photos);
  expect(after.record).toMatchObject({
    framePhotoId: one.id,
    encounterSeen: true,
    ecologySeen: true,
    trustEventSeen: false,
    traceSeen: true,
    day: 1,
    dayPart: 'morning',
  });
  await expect(p.locator('.records [aria-label="生態 記録あり"]')).toBeVisible();
  await screenshot(p, info, '06-journal-reloaded');
  await info.attach('capture-evidence', {
    body: JSON.stringify(
      {
        photos: before.photos,
        restoredHash: reopened.hash,
        changedColorChannels: changed,
        wallRgbError,
        errors: errors.get(p),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await p.keyboard.press('Escape');
  await walk(p, 'w', act(p, '葉の上の実を調べる'));
  await expect(p.locator('.hint')).toContainText('木の実が好き');
  expect(
    await p.evaluate(() => [
      localStorage.getItem('kohitosagasi.save.v1'),
      localStorage.getItem('kohitosagasi.settings.v1'),
    ]),
  ).toEqual(['legacy-save-sentinel', 'legacy-settings-sentinel']);
});

test('first ecology shot alone, optional trust, scare recovery, sitting and four explicit rests', async ({
  page: p,
}) => {
  await investigate(p);
  await btn(p, 'カメラ').click();
  await shoot(p, 'ecology');
  await expect
    .poll(async () => (await saved(p)).photos.map((x) => x.evidence))
    .toEqual([{ encounter: true, ecology: true }]);
  await p.keyboard.press('Escape');
  await home(p);
  await book(p);
  await btn(p, 'この写真を飾る').click();
  await expect.poll(async () => (await saved(p)).record?.framePhotoId).toBeTruthy();
  const single = await saved(p);
  expect(single.record).toMatchObject({ trustEventSeen: false, notes: {}, dayPart: 'morning' });
  await p.keyboard.press('Escape');
  await walk(p, 'w', act(p, '葉の上の実を調べる'));
  await p.keyboard.down('Shift');
  try {
    await walk(p, 'w', p.locator('.message').filter({ hasText: 'むむっ' }));
  } finally {
    await p.keyboard.up('Shift');
  }
  await walk(p, 's', p.locator('.message').filter({ hasText: 'またのぞいた' }));
  await walk(p, 'w', act(p, '葉の上の実を調べる'));
  await btn(p, 'カメラ').click();
  await shoot(p, 'ecology');
  await expect.poll(async () => (await saved(p)).photos.length).toBe(2);
  await p.keyboard.press('Escape');
  await p.keyboard.press('e');
  await btn(p, '転がった実を拾う').click();
  await walk(p, 'w', act(p, '実を葉の上へ返す'));
  await p.keyboard.press('e');
  await btn(p, '実を葉の上へ返す').click();
  await expect.poll(async () => (await saved(p)).record?.trustEventSeen, { timeout: 10000 }).toBe(true);
  await walk(p, 's', act(p, '小道のベンチ'));
  await p.keyboard.press('e');
  await btn(p, '腰を下ろす').click();
  await expect(p.locator('.when')).toHaveText('1日目 · 朝');
  const rest = async (expected: string) => {
    await p.keyboard.press('e');
    await btn(p, '次の時間帯まで休む').click();
    await btn(p, '休む').click();
    await expect(p.locator('.when')).toHaveText(expected);
  };
  await p.keyboard.press('e');
  await btn(p, '次の時間帯まで休む').click();
  await btn(p, '戻る').click();
  await btn(p, '閉じる').click();
  await expect(p.locator('.when')).toHaveText('1日目 · 朝');
  await rest('1日目 · 昼');
  await investigate(p);
  await btn(p, 'カメラ').click();
  await expect(p.locator('.focus')).toHaveAttribute('data-sight', 'scene');
  await p.keyboard.press('Escape');
  await home(p);
  await rest('1日目 · 夕');
  await rest('1日目 · 夜');
  await p.reload();
  await expect(p.locator('.when')).toHaveText('1日目 · 夜');
  await rest('2日目 · 朝');
  await investigate(p);
  await btn(p, 'カメラ').click();
  await shoot(p, 'ecology');
  await expect.poll(async () => (await saved(p)).photos.length).toBe(3);
  expect((await saved(p)).record).toMatchObject({ day: 2, dayPart: 'morning', trustEventSeen: true });
});

test('typing and closing a notebook cannot move the camera or release the shutter', async ({ page: p }) => {
  await btn(p, 'カメラ').click();
  await p.keyboard.press('Space');
  await expect.poll(async () => (await saved(p)).photos.length).toBe(1);
  await p.keyboard.press('Tab');
  await p.getByLabel('この写真の自由メモ').focus();
  await p.keyboard.down('w');
  await p.waitForTimeout(450);
  await p.keyboard.up('w');
  await p.keyboard.type('asd e');
  await p.getByLabel('この写真の自由メモ').fill('遠くの葉\n追記');
  await btn(p, '閉じる').click();
  await expect(p.locator('#prototype')).toHaveAttribute('data-mode', 'camera');
  expect((await saved(p)).photos.length).toBe(1);
  await p.keyboard.press('Tab');
  await p.getByLabel('この写真の自由メモ').focus();
  await p.keyboard.press('Escape');
  await p.keyboard.press('Space');
  await expect.poll(async () => (await saved(p)).photos.length).toBe(2);
  const { photos, record } = await saved(p);
  expect(photos[1].view).toEqual(photos[0].view);
  expect(record?.notes[photos[0].id].memoText).toBe('遠くの葉\n追記');
});

test('an aborted Blob transaction stays unsaved, retries atomically, and broken or missing images are reported', async ({
  page: p,
}) => {
  await p.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'photos' && sessionStorage.getItem('qa-fail') === 'yes')
        throw new DOMException('test quota', 'QuotaExceededError');
      return key === undefined ? put.call(this, value) : put.call(this, value, key);
    };
    sessionStorage.setItem('qa-fail', 'yes');
  });
  await btn(p, 'カメラ').click();
  await p.keyboard.press('Space');
  await expect(p.locator('.save-state')).toContainText('未保存');
  expect(await saved(p)).toEqual({ record: undefined, photos: [] });
  await p.keyboard.press('Tab');
  await expect(p.locator('.print > img')).toBeVisible();
  await btn(p, 'この写真を飾る').click();
  await p.evaluate(() => sessionStorage.removeItem('qa-fail'));
  await p.getByRole('dialog').getByRole('button', { name: '保存を再試行' }).click();
  await expect.poll(async () => (await saved(p)).photos.length).toBe(1);
  const s = await saved(p);
  expect(s.record?.framePhotoId).toBe(s.photos[0].id);
  async function corrupt(remove: boolean) {
    await p.evaluate(
      async ({ id, remove, name }) => {
        const db = await new Promise<IDBDatabase>((res) => {
          const q = indexedDB.open(name);
          q.onsuccess = () => res(q.result);
        });
        const tx = db.transaction('photos', 'readwrite'),
          store = tx.objectStore('photos');
        if (remove) store.delete(id);
        else {
          const q = store.get(id);
          q.onsuccess = () =>
            store.put({ ...q.result, imageBlob: new Blob(['broken'], { type: 'image/jpeg' }) });
        }
        await new Promise<void>((res, rej) => {
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      },
      { name: dbName, remove, id: s.photos[0].id },
    );
    await p.reload();
    await book(p);
  }
  await corrupt(false);
  await expect(p.locator('.print .image-error')).toHaveText('この写真の画像を読み込めません。');
  await expect(p.locator('.panel-save')).toContainText('読み込めません');
  await corrupt(true);
  await expect(p.locator('.panel-content .warning')).toHaveText('展示に選んだ写真が見つかりません。');
  await expect(p.locator('.panel-save')).toContainText('欠けています');
});

test('a blocked database keeps a playable session and a failed encoder never adds a pretend photo', async ({
  page: p,
}) => {
  await p.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('test storage denied', 'SecurityError');
      },
    });
    const encoder = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
      if (sessionStorage.getItem('encoder-test') === 'fail') {
        cb(null);
        return;
      }
      encoder.call(this, cb, type, quality);
    };
  });
  await p.reload();
  await expect(p.locator('.save-state')).toContainText('未保存');
  await btn(p, 'カメラ').click();
  await p.evaluate(() => sessionStorage.setItem('encoder-test', 'fail'));
  await p.keyboard.press('Space');
  await expect(p.locator('.message')).toContainText('この一枚は未保存');
  await p.keyboard.press('Tab');
  await expect(p.locator('.empty')).toBeVisible();
  await btn(p, '閉じる').click();
  await p.evaluate(() => sessionStorage.removeItem('encoder-test'));
  await p.keyboard.press('Space');
  await p.keyboard.press('Tab');
  await expect(p.locator('.print > img')).toBeVisible();
  await btn(p, 'この写真を飾る').click();
  await expect(btn(p, '展示中')).toBeDisabled();
  await expect(p.locator('.panel-save')).toContainText('未保存');
});
