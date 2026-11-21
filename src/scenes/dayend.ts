import { TEXT } from '../data/text';
import type { SaveData } from '../game/state';
import { P } from '../render/palette';
import type { UI } from '../render/ui';

export function drawDayend(ui: UI, save: SaveData): void {
  ui.ctx.fillStyle = P.paper; ui.ctx.fillRect(0, 0, 360, 640);
  ui.text(TEXT.day(save.day), 180, 99, 17, P.green, 'center');
  ui.text(TEXT.endTitle, 180, 144, 28, P.ink, 'center');
  ui.panel(38, 204, 284, 205);
  TEXT.endText.forEach((line, i) => ui.text(line, 180, 244 + i * 32, 15, P.ink, 'center'));
  ui.text(TEXT.recorded(Object.values(save.album).filter(entry => entry && entry.stage > 0).length), 180, 331, 17, P.green, 'center');
  ui.text(TEXT.hintCount(save.hints.length), 180, 369, 17, P.green, 'center');
  ui.button(TEXT.album, 'album', 68, 453, 224);
  ui.button(TEXT.tomorrow, 'tomorrow', 68, 519, 224, 48, true);
}
