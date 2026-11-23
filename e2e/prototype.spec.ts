import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { freshSave } from '../src/game/state';
import { RESIDENTS } from '../src/data/townspeople';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const bytesToUrl = new WeakMap<ArrayBuffer, string>();
    const buffersToUrl = new WeakMap<AudioBuffer, string>();
    const cues: string[] = []; Object.assign(window, { __recordedCues: cues });
    const fetchOriginal = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await Reflect.apply(fetchOriginal, window, args);
      const url = String(args[0]);
      if (url.endsWith('.mp3')) {
        const read = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => { const bytes = await read(); bytesToUrl.set(bytes, url); return bytes; };
      }
      return response;
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (bytes: ArrayBuffer) {
      return decode.call(this, bytes).then(buffer => { const url = bytesToUrl.get(bytes); if (url) buffersToUrl.set(buffer, url); return buffer; });
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      const url = this.buffer && buffersToUrl.get(this.buffer);
      if (url) {
        const name = url.split('/').pop()!.split('-')[0]; cues.push(name);
        this.addEventListener('ended', () => cues.push(`${name}:ended`));
      }
      return Reflect.apply(start, this, args);
    };
  });
});

async function tap(page: Page, action: string): Promise<void> {
  await expect.poll(() => page.evaluate(a => window.__kohitoE2E?.buttons().some(b => b.action === a), action)).toBe(true);
  const p = await page.locator('#game').evaluate((canvas, action) => {
    const b = window.__kohitoE2E!.buttons().find(b => b.action === action)!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (b.x + b.w / 2) * r.width / 360, y: r.top + (b.y + b.h / 2) * r.height / 640 };
  }, action);
  await page.touchscreen.tap(p.x, p.y);
}
async function walk(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key); await page.waitForTimeout(milliseconds); await page.keyboard.up(key);
}
async function photograph(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.buttons().some(b => b.action === 'camera'))).toBe(true);
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('camera');
  await page.waitForTimeout(1350); await page.keyboard.up('Space');
}

test('a fresh game reaches the ending in three days with moving kohitos', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => localStorage.clear()); await page.goto('/?e2e=1');
  await tap(page, 'start');
  async function visit(spot: string, id?: string) {
    await tap(page, `spot:${spot}`);
    await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('field');
    if (id) {
      if (id === 'haritsuki') { await page.keyboard.down('Shift'); await walk(page, 'w', 650); await page.keyboard.up('Shift'); }
      if (id === 'tarejiri') await page.waitForTimeout(4300);
      await photograph(page);
      await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('kohitosagasi.save.v1')!).album[id]?.best.framing, id)).toBe('full');
      await page.screenshot({ path: info.outputPath(`prototype-shot-${id}.png`), fullPage: true });
      if (id === 'tarejiri') return;
      await tap(page, 'close');
    }
    await tap(page, 'map');
  }
  await visit('kawazoi', 'dobunozoki'); await visit('shoutengai', 'haritsuki');
  await visit('kawazoi'); await visit('danchi', 'kagebousi'); await tap(page, 'tomorrow');
  await visit('kawazoi'); await visit('ekimae'); await visit('shoutengai', 'noboriyurashi');
  await visit('ekimae', 'urasumi'); await tap(page, 'tomorrow');
  await visit('kawazoi'); await visit('shoutengai'); await visit('kawazoi', 'tarejiri');
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E?.scene())).toBe('ending');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('kohitosagasi.save.v1')!));
  expect(save.cleared).toBe(true); expect(save.clearedDay).toBe(3); expect(save.hints).toHaveLength(5);
  await expect.poll(() => page.evaluate(() => window.__kohitoE2E!.buttons().some(b => b.action === 'album')), { timeout: 12_000 }).toBe(true);
  await page.screenshot({ path: info.outputPath('prototype-three-day-ending.png'), fullPage: true });
  await tap(page, 'album'); await tap(page, 'tab:2');
  await page.screenshot({ path: info.outputPath('prototype-five-hints.png'), fullPage: true });
  for (const cue of ['shutter', 'hint', 'ending']) {
    await expect.poll(() => page.evaluate(() => (window as unknown as { __recordedCues: string[] }).__recordedCues)).toContain(`${cue}:ended`);
  }
  expect(errors).toEqual([]);
});

test('all four residents animate and photograph as harmless false positives', async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const seen: string[] = []; Object.assign(window, { __residentFrames: seen });
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: [CanvasImageSource, ...number[]]) {
      if (args[0] instanceof HTMLImageElement && args[0].src.includes('townspeople-motion-')) {
        const key = `${Math.floor(Number(args[2]) / 256)}:${Math.floor(Number(args[1]) / 256)}`;
        if (!seen.includes(key)) seen.push(key);
      }
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto('/?e2e=1');
  for (const [row, resident] of RESIDENTS.entries()) {
    const save = freshSave(); save.location = resident.spot;
    await page.evaluate(save => { localStorage.clear(); localStorage.setItem('kohitosagasi.save.v1', JSON.stringify(save)); }, save);
    await page.reload(); await tap(page, 'continue');
    for (let frame = 0; frame < 4; frame++) await expect.poll(() => page.evaluate(() => (window as unknown as { __residentFrames: string[] }).__residentFrames)).toContain(`${row}:${frame}`);
    if (resident.spot === 'ekimae') { await walk(page, 'a', 1050); await walk(page, 's', 800); }
    else if (resident.spot === 'kawazoi') { await walk(page, 'd', 1000); await walk(page, 's', 400); }
    else await walk(page, 's', 600);
    const before = await page.evaluate(() => localStorage.getItem('kohitosagasi.save.v1'));
    await photograph(page); await tap(page, 'close');
    const after = await page.evaluate(() => localStorage.getItem('kohitosagasi.save.v1'));
    expect(after).toBe(before);
    // Re-open the same target and retain a screenshot of the human result.
    await photograph(page);
    await page.screenshot({ path: info.outputPath(`prototype-resident-${resident.id}.png`), fullPage: true });
    await tap(page, 'close');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __recordedCues: string[] }).__recordedCues)).toContain('resident:ended');
  }
  expect(errors).toEqual([]);
});
