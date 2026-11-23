import { afterEach, describe, expect, it, vi } from 'vitest';
import { KOHITO_IDS, SPOT_IDS } from '../src/game/state';
import { SUBJECT_BOUNDS } from '../src/data/kohito';
import { drawSummerBuilding, drawSummerGarden, drawSummerSpotIcon, drawSummerTitle } from '../src/render/summer';
import { drawTiles } from '../src/render/tiles';

/** 曲線の制御点を含む安全側の範囲を記録。各建物が通行可能域へ張り出さないことを検査する。 */
class SceneryContext {
  points: { x: number; y: number }[] = [];
  private transform = [1, 1, 0, 0];
  private stack: number[][] = [];
  save(): void { this.stack.push([...this.transform]); }
  restore(): void { this.transform = this.stack.pop()!; }
  translate(x: number, y: number): void { this.transform[2] += x * this.transform[0]; this.transform[3] += y * this.transform[1]; }
  scale(x: number, y: number): void { this.transform[0] *= x; this.transform[1] *= y; }
  moveTo(x: number, y: number): void { const [sx, sy, tx, ty] = this.transform; this.points.push({ x: x * sx + tx, y: y * sy + ty }); }
  lineTo(x: number, y: number): void { this.moveTo(x, y); }
  fillRect(x: number, y: number, w: number, h: number): void { this.moveTo(x, y); this.moveTo(x + w, y + h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.fillRect(x, y, w, h); }
  ellipse(x: number, y: number, rx: number, ry: number): void { this.moveTo(x - rx, y - ry); this.moveTo(x + rx, y + ry); }
  beginPath(): void {}
  fill(): void {}
  stroke(): void {}
  get context(): CanvasRenderingContext2D { return this as unknown as CanvasRenderingContext2D; }
}

describe('summer scenery respects the existing play space', () => {
  for (const spot of SPOT_IDS) {
    it.each([[24, 24], [48, 48], [72, 60], [144, 168]])(`${spot} building %s×%s stays in its blocked footprint`, (w, h) => {
      const c = new SceneryContext(); drawSummerBuilding(c.context, spot, 48, 72, w, h);
      expect(c.points.length).toBeGreaterThan(0);
      for (const p of c.points) {
        expect(p.x).toBeGreaterThanOrEqual(48); expect(p.x).toBeLessThanOrEqual(48 + w);
        expect(p.y).toBeGreaterThanOrEqual(72); expect(p.y).toBeLessThanOrEqual(72 + h);
      }
    });
    it(`${spot} terrain stays inside the 576×768 map`, () => {
      const c = new SceneryContext(); drawTiles(c.context, spot);
      for (const p of c.points) {
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(576);
        expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(768);
      }
    });
    it(`${spot} map icon stays inside its card`, () => {
      const c = new SceneryContext(); drawSummerSpotIcon(c.context, spot, 28, 132);
      for (const p of c.points) {
        expect(p.x).toBeGreaterThanOrEqual(28); expect(p.x).toBeLessThanOrEqual(160);
        expect(p.y).toBeGreaterThanOrEqual(132); expect(p.y).toBeLessThanOrEqual(188);
      }
    });
  }
  it('all new drawing functions restore the caller transform', () => {
    const c = new SceneryContext(); c.translate(7, 13); c.scale(2, 3);
    drawSummerTitle(c.context);
    for (const spot of SPOT_IDS) {
      drawSummerGarden(c.context, spot); drawSummerSpotIcon(c.context, spot, 0, 0);
      drawSummerBuilding(c.context, spot, 0, 0, 96, 96); drawTiles(c.context, spot);
    }
    c.moveTo(1, 1); expect(c.points.at(-1)).toEqual({ x: 9, y: 16 });
  });
});

describe('bundled summer image loading and drawing', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  function images(loaded: boolean) {
    const created: FakeImage[] = [];
    class FakeImage {
      complete = loaded;
      naturalWidth = loaded ? 512 : 0;
      naturalHeight = loaded ? 1792 : 0;
      src = '';
      onerror: (() => void) | undefined;
      constructor() { created.push(this); }
    }
    vi.stubGlobal('Image', FakeImage);
    return created;
  }

  for (const id of KOHITO_IDS) for (const hidden of id === 'tarejiri' ? [false, true] : [false]) {
    it(`${id} hidden=${hidden} selects both frames and stays inside scoring bounds at 61 times`, async () => {
      vi.resetModules();
      const created = images(true);
      const { drawKohito } = await import('../src/render/kohitoArt');
      const calls: unknown[][] = [];
      const c = new SceneryContext();
      Object.assign(c, { drawImage: (...args: unknown[]) => { calls.push(args); } });
      const bounds = hidden ? { left: -6, top: -7, w: 26, h: 27 } : SUBJECT_BOUNDS[id];
      for (const special of [false, true]) for (let tick = 0; tick <= 60; tick++) {
        drawKohito(c.context, id, 100, 200, tick / 10, special, hidden);
        const [image, sx, sy, sw, sh, x, y, w, h] = calls.at(-1)! as [unknown, number, number, number, number, number, number, number, number];
        expect(image).toBe(created[0]);
        expect(sx).toBe(special ? 260 : 4);
        expect(sy).toBe((hidden ? 6 : KOHITO_IDS.indexOf(id)) * 256 + 4);
        expect([sw, sh]).toEqual([248, 248]);
        expect(x).toBeGreaterThanOrEqual(bounds.left);
        expect(y).toBeGreaterThanOrEqual(bounds.top);
        expect(x + w).toBeLessThanOrEqual(bounds.left + bounds.w);
        expect(y + h).toBeLessThanOrEqual(bounds.top + bounds.h);
        c.moveTo(0, 0);
        expect(c.points.at(-1)).toEqual({ x: 0, y: 0 });
      }
      expect(calls).toHaveLength(122);
      expect(created).toHaveLength(1);
      expect(created[0].src).toMatch(/assets\/summer\/kohitos\.png/);
    });
  }

  it('uses the original vector while loading, then switches once decoded', async () => {
    vi.resetModules(); const created = images(false);
    const { drawKohito } = await import('../src/render/kohitoArt');
    const calls: string[] = [];
    const c = new Proxy({}, { get: (_, key) => (..._args: unknown[]) => { calls.push(String(key)); }, set: () => true }) as CanvasRenderingContext2D;
    drawKohito(c, 'urasumi', 0, 0, 0);
    expect(calls).toContain('bezierCurveTo');
    expect(calls).not.toContain('drawImage');
    Object.assign(created[0], { complete: true, naturalWidth: 512, naturalHeight: 1792 });
    calls.length = 0; drawKohito(c, 'urasumi', 0, 0, 0);
    expect(calls).toContain('drawImage');
    expect(calls).not.toContain('bezierCurveTo');
  });

  it('keeps the vector fallback after an image error without retrying every frame', async () => {
    vi.resetModules(); const created = images(false);
    const { drawSummerKohito } = await import('../src/render/summerImages');
    const c = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    expect(drawSummerKohito(c, 'tarejiri', false, true)).toBe(false);
    created[0].onerror!();
    Object.assign(created[0], { complete: true, naturalWidth: 512, naturalHeight: 1792 });
    for (let i = 0; i < 60; i++) expect(drawSummerKohito(c, 'tarejiri', true, false)).toBe(false);
    expect(c.drawImage).not.toHaveBeenCalled(); expect(created).toHaveLength(1);
  });

  it('loads the local title image independently, preserving its panel bounds', async () => {
    vi.resetModules(); const created = images(false);
    const { drawSummerTitleImage } = await import('../src/render/summerImages');
    const drawImage = vi.fn(); const c = { drawImage } as unknown as CanvasRenderingContext2D;
    expect(drawSummerTitleImage(c)).toBe(false);
    Object.assign(created[0], { complete: true, naturalWidth: 1002, naturalHeight: 672 });
    expect(drawSummerTitleImage(c)).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(created[0], 12, 190, 336, 190);
    expect(created[0].src).toMatch(/assets\/summer\/town\.webp/);
  });
});
