import { describe, expect, it } from 'vitest';
import { createGame, freshSave, KOHITO_IDS } from '../src/game/state';
import type { GameState, KohitoId } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import type { KohitoRuntime } from '../src/game/kohito';
import { evaluateCamera } from '../src/scenes/camera';
import { cameraCenter } from '../src/game/world';
import { KOHITO } from '../src/data/kohito';

/**
 * カメラ画面の画角。アイコンが出る距離（120px 以内）なら、
 * どの方向から構えても、横パン（±48）を合わせれば全身写真が撮れること。
 */

function setup(dx: number, dy: number, id: KohitoId = 'dobunozoki'): { game: GameState; k: KohitoRuntime } {
  const game = createGame(freshSave());
  game.save.location = KOHITO[id].spot;
  game.save.time = KOHITO[id].time;
  const k = createKohito(id, 300, 300);
  if (id === 'tarejiri') k.fullRemaining = 8; // 全身が出ている状態。隠れ時は通しプレイのテストで別途守る。
  game.player = { x: 300 - dx, y: 300 - dy };
  game.kohitos = [k];
  game.cameraTarget = k.id;
  game.heldMs = 1200;
  game.elapsed = 0;
  return { game, k };
}

/** パンを -48〜48 で振って、全身になるパンがあるか。 */
function canFrameFull(dx: number, dy: number, id: KohitoId): boolean {
  const { game, k } = setup(dx, dy, id);
  for (let pan = -48; pan <= 48; pan += 4) {
    game.pan = pan;
    if (evaluateCamera(game, k).framing === 'full') return true;
  }
  return false;
}

describe('カメラの画角', () => {
  const directions: [string, number, number][] = [
    ['真上 100px', 0, 100], ['真下 100px', 0, -100], ['真上 120px', 0, 119], ['真下 120px', 0, -119],
    ['右 120px', 119, 0], ['左 120px', -119, 0], ['斜め 85px', 84, 84], ['斜め 85px（逆）', -84, -84],
  ];
  const cases = KOHITO_IDS.flatMap(id => directions.map(([label, dx, dy]) => ({ id, label, dx, dy })));
  it.each(cases)('$id は $label から構えても全身を収められる', ({ id, dx, dy }) => {
    expect(canFrameFull(dx, dy, id)).toBe(true);
  });

  it('画面中心はプレイヤーと対象の間に寄る（対象そのものではない）', () => {
    const center = cameraCenter({ x: 0, y: 0 }, { x: 100, y: -50 });
    expect(center.x).toBeCloseTo(60);
    expect(center.y).toBeCloseTo(-30);
  });

  it('遠くて横にずれていると、パン 0 のままでは全身にならない（合わせる手間が残る）', () => {
    const { game, k } = setup(119, 0, 'urasumi');
    game.pan = 0;
    expect(evaluateCamera(game, k).framing).not.toBe('full');
  });
});
