import { describe, expect, it } from 'vitest';
import { createGame, freshSave } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import { CAMERA_ZOOM, cameraCenter } from '../src/game/world';
import { evaluateCamera, FINDER } from '../src/scenes/camera';

describe('絵に合った被写体の矩形', () => {
  // 上端の210pxは採点関数の境界検証用。通常の撮影開始距離内での再現は右119pxで確認する。
  it.each([
    ['上端近く', 0, -210],
    ['撮影可能な距離の右端近く', 119, 0],
  ])('ドブノゾキの絵が%sに全部収まれば全身になる', (_label, dx, dy) => {
    const game = createGame(freshSave());
    game.save.location = 'kawazoi';
    const k = createKohito('dobunozoki', 300, 300);
    game.kohitos = [k]; game.cameraTarget = k.id;
    game.player = { x: k.x - dx, y: k.y - dy };
    game.heldMs = 1200; game.elapsed = 0; game.pan = 0;

    // 採点枠とは独立した、変更していない絵の実際の範囲（影を除く）。
    const center = cameraCenter(game.player, k);
    const actual = {
      left: 180 + (k.x - center.x - 13) * CAMERA_ZOOM,
      top: 320 + (k.y - center.y - 4) * CAMERA_ZOOM,
      right: 180 + (k.x - center.x + 13) * CAMERA_ZOOM,
      bottom: 320 + (k.y - center.y + 12) * CAMERA_ZOOM,
    };
    expect(actual.left).toBeGreaterThanOrEqual(FINDER.x);
    expect(actual.top).toBeGreaterThanOrEqual(FINDER.y);
    expect(actual.right).toBeLessThanOrEqual(FINDER.x + FINDER.w);
    expect(actual.bottom).toBeLessThanOrEqual(FINDER.y + FINDER.h);
    if (dy === -210) expect(actual.top).toBeCloseTo(FINDER.y + 3.2);

    const shot = evaluateCamera(game, k);
    expect(shot.framing).toBe('full');
    expect(shot.coverage).toBeCloseTo(1);
  });
});
