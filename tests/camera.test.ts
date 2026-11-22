import { describe, expect, it } from 'vitest';
import { createGame, freshSave } from '../src/game/state';
import type { GameState } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import type { KohitoRuntime } from '../src/game/kohito';
import { evaluateCamera } from '../src/scenes/camera';
import { cameraCenter } from '../src/game/world';

/**
 * カメラ画面の画角。アイコンが出る距離（120px 以内）なら、
 * どの方向から構えても、横パン（±48）を合わせれば全身写真が撮れること。
 */

function setup(dx: number, dy: number): { game: GameState; k: KohitoRuntime } {
  const game = createGame(freshSave());
  game.save.location = 'kawazoi';
  const k = createKohito('dobunozoki', 300, 300);
  game.player = { x: 300 - dx, y: 300 - dy };
  game.kohitos = [k];
  game.cameraTarget = k.id;
  game.heldMs = 1200;
  game.elapsed = 0;
  return { game, k };
}

/** パンを -48〜48 で振って、全身になるパンがあるか。 */
function canFrameFull(dx: number, dy: number): boolean {
  const { game, k } = setup(dx, dy);
  for (let pan = -48; pan <= 48; pan += 4) {
    game.pan = pan;
    if (evaluateCamera(game, k).framing === 'full') return true;
  }
  return false;
}

describe('カメラの画角', () => {
  it.each([
    ['真上 100px', 0, 100], ['真下 100px', 0, -100], ['真上 120px', 0, 119], ['真下 120px', 0, -119],
    ['右 120px', 119, 0], ['左 120px', -119, 0], ['斜め 85px', 84, 84], ['斜め 85px（逆）', -84, -84],
  ])('%s から構えても全身を収められる', (_label, dx, dy) => {
    expect(canFrameFull(dx, dy)).toBe(true);
  });

  it('画面中心はプレイヤーと対象の間に寄る（対象そのものではない）', () => {
    const center = cameraCenter({ x: 0, y: 0 }, { x: 100, y: -50 });
    expect(center.x).toBeCloseTo(60);
    expect(center.y).toBeCloseTo(-30);
  });

  it('遠くて横にずれていると、パン 0 のままでは全身にならない（合わせる手間が残る）', () => {
    const { game, k } = setup(119, 0);
    game.pan = 0;
    expect(evaluateCamera(game, k).framing).not.toBe('full');
  });
});
