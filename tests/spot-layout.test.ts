import { describe, expect, it } from 'vitest';
import { MAP_COLS, MAP_ROWS, SPAWN, SPOTS, TILE_SIZE } from '../src/data/spots';
import type { Tile } from '../src/data/spots';
import { KOHITO } from '../src/data/kohito';
import { PROPS } from '../src/data/props';
import { SPOT_IDS } from '../src/game/state';
import { drawProp } from '../src/render/props';

const CHANGED_SPOTS = ['shoutengai', 'danchi', 'ekimae'] as const;
const walkable = (tile: Tile): boolean => tile !== 1 && tile !== 3;

function reachable(tiles: Tile[][]): Set<number> {
  const start = Math.floor(SPAWN.y / TILE_SIZE) * MAP_COLS + Math.floor(SPAWN.x / TILE_SIZE);
  const seen = new Set([start]); const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i]; const row = Math.floor(index / MAP_COLS); const col = index % MAP_COLS;
    for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS || !walkable(tiles[r][c])) continue;
      const next = r * MAP_COLS + c;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

describe.each(CHANGED_SPOTS)('%s redesigned layout', spot => {
  const tiles = SPOTS[spot];
  it('retains the 24×32 dimensions and tile meanings', () => {
    expect(MAP_COLS).toBe(24); expect(MAP_ROWS).toBe(32); expect(TILE_SIZE).toBe(24);
    expect(tiles).toHaveLength(32);
    for (const row of tiles) {
      expect(row).toHaveLength(24);
      for (const tile of row) expect([0, 1, 2, 3, 4]).toContain(tile);
    }
  });
  it('keeps the entire outer border at tile 1', () => {
    for (let c = 0; c < 24; c++) { expect(tiles[0][c]).toBe(1); expect(tiles[31][c]).toBe(1); }
    for (let r = 0; r < 32; r++) { expect(tiles[r][0]).toBe(1); expect(tiles[r][23]).toBe(1); }
  });
  it('preserves every original tile in rows 7–14, columns 9–16', () => {
    const actual = tiles.slice(7, 15).map(row => row.slice(9, 17).join(''));
    expect(actual).toEqual(ORIGINAL_PROTECTED[spot]);
  });
  it('keeps SPAWN on a walkable tile', () => {
    expect(walkable(tiles[Math.floor(SPAWN.y / 24)][Math.floor(SPAWN.x / 24)])).toBe(true);
  });
  it('can approach every resident to a reachable tile center 60–100px away', () => {
    const seen = reachable(tiles);
    const residents = Object.values(KOHITO).filter(k => k.spot === spot);
    expect(residents.length).toBeGreaterThan(0);
    for (const k of residents) {
      expect([...seen].some(index => {
        const x = (index % MAP_COLS + 0.5) * TILE_SIZE;
        const y = (Math.floor(index / MAP_COLS) + 0.5) * TILE_SIZE;
        const distance = Math.hypot(x - k.x, y - k.y);
        return distance >= 60 && distance <= 100;
      }), k.id).toBe(true);
    }
  });
  it('reaches at least 90% of walkable tiles from SPAWN', () => {
    const total = tiles.flat().filter(walkable).length;
    expect(reachable(tiles).size / total).toBeGreaterThanOrEqual(0.9);
  });
  it('has a walkable fraction between 45% and 75%', () => {
    const fraction = tiles.flat().filter(walkable).length / (24 * 32);
    expect(fraction).toBeGreaterThanOrEqual(0.45); expect(fraction).toBeLessThanOrEqual(0.75);
  });
});

describe('map identity and fixed data', () => {
  const pairs = SPOT_IDS.flatMap((a, i) => SPOT_IDS.slice(i + 1).map(b => ({ a, b })));
  it.each(pairs)('$a and $b differ in passability on at least 120 tiles', ({ a, b }) => {
    const different = SPOTS[a].flat().filter((tile, index) => walkable(tile) !== walkable(SPOTS[b].flat()[index])).length;
    expect(different).toBeGreaterThanOrEqual(120);
  });
  it('keeps the river map exactly unchanged', () => {
    expect(SPOTS.kawazoi.map(row => row.join(''))).toEqual(ORIGINAL_RIVER);
  });
  it('keeps SPAWN unchanged', () => { expect(SPAWN).toEqual({ x: 288, y: 420 }); });
});

/** 色や図形の検査は既存props.test.tsが担い、ここでは実際のpaint時の透明度だけ記録する。 */
class AlphaContext {
  globalAlpha = 1;
  readonly paints: number[] = [];
  private stack: number[] = [];
  save(): void { this.stack.push(this.globalAlpha); }
  restore(): void { this.globalAlpha = this.stack.pop() ?? this.globalAlpha; }
  translate(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  ellipse(): void {}
  fill(): void { this.paints.push(this.globalAlpha); }
  stroke(): void { this.paints.push(this.globalAlpha); }
  fillRect(): void { this.paints.push(this.globalAlpha); }
  strokeRect(): void { this.paints.push(this.globalAlpha); }
}

describe('visible decoration', () => {
  const cases = SPOT_IDS.flatMap(spot => PROPS[spot].map((prop, index) => ({ spot, index, ...prop })));
  it.each(cases)('$spot #$index $kind paints only at alpha 0.5–0.8', prop => {
    const c = new AlphaContext(); drawProp(c as unknown as CanvasRenderingContext2D, prop);
    expect(c.paints.length).toBeGreaterThan(0);
    for (const alpha of c.paints) { expect(alpha).toBeGreaterThanOrEqual(0.5); expect(alpha).toBeLessThanOrEqual(0.8); }
  });
});

// 依頼Eの変更前 c1b6d80 から固定した値。現在の配置から生成し直さない。
const ORIGINAL_RIVER = [
  '111111111111111111111111',
  '100000020000000020000001',
  '100000200000000200000001',
  '101111111000002011111101',
  '101111111000020011111121',
  '101111111000200011111101',
  '101111111002000011111101',
  '121111111020000011111101',
  '101111111200000011111101',
  '101111111000000011111101',
  '100000020000000020000001',
  '100000200000000200000001',
  '100002000000002000000001',
  '100020000000020000333331',
  '100200000000200000333331',
  '102000000002000000333331',
  '120000000020000000333331',
  '100000000200000000333331',
  '100000002000000002333331',
  '100000020000000020333331',
  '100000200000000200333331',
  '100111111000002000333331',
  '100111111000020000333331',
  '100111111000200000333331',
  '102111111002000000333331',
  '120111111020000000333331',
  '100000000200000000333331',
  '122222222222200002333331',
  '122222222222200020333331',
  '122222222222200200000001',
  '122222222222202000000001',
  '111111111111111111111111',
];
const ORIGINAL_PROTECTED = {
  shoutengai: [
    '00200001',
    '02000001',
    '20000001',
    '00000000',
    '00000002',
    '00000020',
    '00000200',
    '00002000',
  ],
  danchi: [
    '20000001',
    '00000001',
    '00000001',
    '00000020',
    '00000200',
    '00002000',
    '00020000',
    '00200000',
  ],
  ekimae: [
    '00000001',
    '00000001',
    '00000021',
    '00000200',
    '00002000',
    '00020000',
    '00200000',
    '02000000',
  ],
};
