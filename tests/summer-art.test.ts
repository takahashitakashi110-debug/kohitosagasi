import { describe, expect, it } from 'vitest';
import { SPOT_IDS } from '../src/game/state';
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
