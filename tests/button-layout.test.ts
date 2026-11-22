import { describe, expect, it } from 'vitest';
import type { Input, HitButton } from '../src/engine/input';
import { createGame } from '../src/game/state';
import { createKohito } from '../src/game/kohito';
import { UI } from '../src/render/ui';
import { drawField } from '../src/scenes/field';
import { drawTitle } from '../src/scenes/title';
import { buttonsOverlap } from './support/buttons';

/** 実際のUI.button（既定の高さも含む）を通し、Canvasへの描画だけを省略する。 */
function makeUI(): UI {
  const context = new Proxy({ measureText: (text: string) => ({ width: text.length * 8 }) }, {
    get(target, key) { return Reflect.get(target, key) ?? (() => {}); },
  });
  return new UI(context as unknown as CanvasRenderingContext2D);
}

function expectSeparated(buttons: HitButton[]): void {
  expect(buttons.length).toBeGreaterThan(1);
  for (let i = 0; i < buttons.length; i++) {
    for (const b of buttons.slice(i + 1)) {
      const a = buttons[i];
      const overlap = buttonsOverlap(a, b);
      expect(overlap, `${a.action} overlaps ${b.action}`).toBe(false);
    }
  }
}

describe.each([false, true])('button rectangles (muted=%s)', muted => {
  it.each([false, true])('title has no overlapping buttons (hasSave=%s)', hasSave => {
    const ui = makeUI(); drawTitle(ui, hasSave, muted);
    expect(ui.buttons.map(b => b.action).sort()).toEqual(hasSave
      ? ['continue', 'start', 'toggle-sound'] : ['start', 'toggle-sound']);
    expectSeparated(ui.buttons);
  });
  it.each([false, true])('field has no overlapping buttons (camera available=%s)', cameraAvailable => {
    const game = createGame(); game.scene = 'field'; game.save.location = 'kawazoi';
    if (cameraAvailable) game.kohitos = [createKohito('dobunozoki', game.player.x, game.player.y - 90)];
    const input = { stick: { x: 0, y: 0 } } as Input;
    const ui = makeUI(); drawField(ui, game, input, muted);
    expect(ui.buttons.map(b => b.action).sort()).toEqual(cameraAvailable
      ? ['album', 'camera', 'map', 'toggle-sound'] : ['album', 'map', 'toggle-sound']);
    expectSeparated(ui.buttons);
  });
});
